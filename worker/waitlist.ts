// The Cloud waitlist's rules, kept apart from the Worker so they run in tests on their own.

/** One person on the waitlist. */
export interface Entry {
  email: string;
  useFor: string | null;
}

/** Why an entry is refused, as the form's script reads it. */
export type Refusal = "email" | "too-long";

/** The Turnstile action the form's widget names, so a token from any other widget fails. */
export const ACTION = "waitlist";

export const LIMITS = { email: 254, useFor: 300 };

/** An email address as people type one: no spaces, and none of the characters that cannot appear. */
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:".]+$/;

export function readEntry(form: FormData): Entry | Refusal {
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const useFor = String(form.get("use_for") ?? "").trim();
  if (email.length > LIMITS.email || !EMAIL.test(email)) return "email";
  if (useFor.length > LIMITS.useFor) return "too-long";
  return { email, useFor: useFor || null };
}

/** What Turnstile's siteverify says about a token. */
export interface Outcome {
  success: boolean;
  hostname?: string;
  action?: string;
  metadata?: { result_with_testing_key?: boolean };
}

/**
 * A token counts only from this site's own page, and from the waitlist's widget. Cloudflare's
 * test keys, used to try the form locally, answer for example.com with no action, and a
 * production secret key refuses their tokens, so their answer is taken as it comes.
 */
export function passed(outcome: Outcome, hostname: string): boolean {
  if (outcome.metadata?.result_with_testing_key) return outcome.success;
  return outcome.success && outcome.hostname === hostname && outcome.action === ACTION;
}

/** The email each new entry sends, written to be read in an inbox and answered from it. */
export function notice(entry: Entry, joinedAt: string): { subject: string; text: string } {
  return {
    subject: `Cloud waitlist: ${entry.email}`,
    text: [
      "Somebody joined the DPOLens Cloud waitlist.",
      "",
      `Email: ${entry.email}`,
      `What they would use it for: ${entry.useFor ?? "(no answer)"}`,
      `Joined: ${joinedAt}`,
      "",
      "A reply to this email goes to them. The whole list:",
      'npx wrangler d1 execute dpolens-waitlist --remote --command "SELECT * FROM waitlist ORDER BY joined_at"',
    ].join("\n"),
  };
}
