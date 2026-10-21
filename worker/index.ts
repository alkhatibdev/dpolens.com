// dpolens.com is static files. This Worker answers only what wrangler.jsonc sends it, the
// paths under /api/: today the DPOLens Cloud waitlist's form.
import { notice, passed, readEntry, type Entry, type Outcome } from "./waitlist.ts";

interface Env {
  ASSETS: Fetcher;
  WAITLIST: D1Database;
  NOTIFY: SendEmail;
  /** The secret key of the waitlist's Turnstile widget. */
  TURNSTILE_SECRET: string;
  /** The verified address each new entry is sent to. */
  NOTIFY_TO: string;
}

const SENDER = { name: "DPOLens waitlist", email: "waitlist@dpolens.com" };

/** The form's two fields and its Turnstile token come to well under this. */
const MAX_BODY = 4096;

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/waitlist") return join(request, env, ctx);
    if (pathname.startsWith("/api/")) return answer(404, { error: "not-found" });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function join(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== "POST") return answer(405, { error: "method" }, { Allow: "POST" });
  const url = new URL(request.url);
  // Only the site's own page may send the form.
  if (request.headers.get("Origin") !== url.origin) return answer(403, { error: "origin" });

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY) return answer(413, { error: "too-long" });
  let form: FormData;
  try {
    const type = request.headers.get("Content-Type") ?? "";
    form = await new Response(body, { headers: { "Content-Type": type } }).formData();
  } catch {
    return answer(415, { error: "form" });
  }

  const entry = readEntry(form);
  if (typeof entry === "string") return answer(400, { error: entry });
  if (!(await human(form.get("cf-turnstile-response"), url.hostname, env))) {
    return answer(403, { error: "check" });
  }

  const joinedAt = new Date().toISOString();
  try {
    const { meta } = await env.WAITLIST.prepare(
      "INSERT INTO waitlist (email, use_for, joined_at) VALUES (?1, ?2, ?3) ON CONFLICT (email) DO NOTHING",
    )
      .bind(entry.email, entry.useFor, joinedAt)
      .run();
    // Somebody already on the list gets the same answer, so the form tells nobody who is on it.
    if (meta.changes > 0) ctx.waitUntil(tell(env, entry, joinedAt));
  } catch (error) {
    console.error("waitlist: the entry was not stored", error);
    return answer(500, { error: "server" });
  }
  return answer(200, { ok: true });
}

/** Asks Turnstile whether the form's token is real, unused, and from this site's widget. */
async function human(token: File | string | null, hostname: string, env: Env) {
  if (typeof token !== "string" || token === "" || token.length > 2048) return false;
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }),
  });
  return response.ok && passed((await response.json()) as Outcome, hostname);
}

async function tell(env: Env, entry: Entry, joinedAt: string) {
  try {
    await env.NOTIFY.send({
      from: SENDER,
      to: env.NOTIFY_TO,
      replyTo: entry.email,
      ...notice(entry, joinedAt),
    });
  } catch (error) {
    // The entry is stored either way, and the list in the database is the record.
    console.error("waitlist: the notice was not sent", error);
  }
}

function answer(status: number, body: object, headers: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
  });
}
