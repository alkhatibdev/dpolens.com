import type { APIRoute, GetStaticPaths } from "astro";
import { type CollectionEntry, getCollection } from "astro:content";
import { markdownCopy } from "../../lib/docs";

// Each docs page as Markdown, for AI assistants: /docs/get-started.md beside /docs/get-started.
export const getStaticPaths = (async () => {
  const pages = await getCollection("docs");
  return pages.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(markdownCopy((props as { entry: CollectionEntry<"docs"> }).entry), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
