import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getPosts } from "../lib/blog";
import { DOCS_ORDER } from "../lib/docs";
import { itemsOf } from "../lib/laws";
import { getLaws } from "../lib/packs";
import { LLMS, SITE } from "../lib/site";

// https://llmstxt.org: a plain index of the site for AI assistants and answer engines. Each docs
// page and post is listed by its Markdown copy, with its summary.
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
    `## Laws\n${list([
      {
        name: "Supported laws",
        href: `${SITE.origin}/laws`,
        note: "every law, its version and source",
      },
      ...(await getLaws()).map((law) => {
        const items = itemsOf(law);
        const articles = items.filter((item) => item.kind === "article").length;
        const recitals = items.length - articles;
        return {
          name: `${law.short}: ${law.name}`,
          href: `${SITE.origin}/laws/${law.slug}.md`,
          note: `the privacy law of the ${law.jurisdiction}, version ${law.version}, ${articles} articles${recitals ? ` and ${recitals} recitals` : ""}, each with a Markdown copy`,
        };
      }),
    ])}`,
    `## Blog\n${list(
      (await getPosts()).map((post) => ({
        name: post.data.title,
        href: `${SITE.origin}/blog/${post.id}.md`,
        note: post.data.description,
      })),
    )}`,
    ...LLMS.map((section) => `## ${section.title}\n${list(section.links)}`),
  ];
  const body = [`# ${SITE.name}`, `> ${SITE.description}`, ...sections].join("\n\n");
  return new Response(`${body}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
