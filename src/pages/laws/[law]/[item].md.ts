import type { APIRoute, GetStaticPaths } from "astro";
import { itemMarkdown, itemsOf } from "../../../lib/laws";
import { getLaws, type Item } from "../../../lib/packs";
import { SITE } from "../../../lib/site";

// Each article and recital in English as Markdown, for AI assistants: /laws/gdpr/art-17.md.
export const getStaticPaths = (async () =>
  (await getLaws()).flatMap((law) =>
    itemsOf(law)
      .filter((item) => item.texts.has("en"))
      .map((item) => ({ params: { law: law.slug, item: item.stem }, props: { item } })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(itemMarkdown((props as { item: Item }).item, "en", SITE.origin), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
