import type { APIRoute, GetStaticPaths } from "astro";
import { lawMarkdown } from "../../lib/laws";
import { getLaws, type Law } from "../../lib/packs";
import { SITE } from "../../lib/site";

// A law as Markdown, for AI assistants: /laws/gdpr.md.
export const getStaticPaths = (async () =>
  (await getLaws()).map((law) => ({
    params: { law: law.slug },
    props: { law },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(lawMarkdown((props as { law: Law }).law, SITE.origin), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
