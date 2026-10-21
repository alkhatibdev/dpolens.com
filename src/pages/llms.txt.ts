import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { DOCS_ORDER } from "../lib/docs";
import { LLMS, SITE } from "../lib/site";

// https://llmstxt.org: a plain index of the site for AI assistants and answer engines. Each docs
// page is listed by its Markdown copy, with its summary.
export const GET: APIRoute = async () => {
  const docs = (await getCollection("docs")).sort(
    (a, b) => DOCS_ORDER.indexOf(a.id) - DOCS_ORDER.indexOf(b.id),
  );
  const list = (links: { name: string; href: string; note?: string }[]) =>
    links
      .map((link) => `- [${link.name}](${link.href})${link.note ? `: ${link.note}` : ""}`)
      .join("\n");
  const sections = [
    `## Docs\n${list(
      docs.map((page) => ({
        name: page.data.title,
        href: `${SITE.origin}/docs/${page.id}.md`,
        note: page.data.description,
      })),
    )}`,
    ...LLMS.map((section) => `## ${section.title}\n${list(section.links)}`),
  ];
  const body = [`# ${SITE.name}`, `> ${SITE.description}`, ...sections].join("\n\n");
  return new Response(`${body}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
