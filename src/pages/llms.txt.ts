import type { APIRoute } from "astro";
import { LLMS, SITE } from "../lib/site";

// https://llmstxt.org: a plain index of the site for AI assistants and answer engines.
export const GET: APIRoute = () => {
  const sections = LLMS.map(
    (section) =>
      `## ${section.title}\n${section.links.map((link) => `- [${link.name}](${link.href})`).join("\n")}`,
  );
  const body = [`# ${SITE.name}`, `> ${SITE.description}`, ...sections].join("\n\n");
  return new Response(`${body}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
