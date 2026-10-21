import type { APIRoute, GetStaticPaths } from "astro";
import { itemMarkdown, itemsOf, languagesOf } from "../../../../lib/laws";
import { getLaws, type Item } from "../../../../lib/packs";
import { SITE } from "../../../../lib/site";

// Each article and recital in its other languages as Markdown: /ar/laws/uae-pdpl/art-15.md.
export const getStaticPaths = (async () =>
  (await getLaws()).flatMap((law) =>
    languagesOf(law)
      .filter((lang) => lang !== "en")
      .flatMap((lang) =>
        itemsOf(law)
          .filter((item) => item.texts.has(lang))
          .map((item) => ({ params: { lang, law: law.slug, item: item.stem }, props: { item } })),
      ),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props, params }) =>
  new Response(itemMarkdown((props as { item: Item }).item, params.lang!, SITE.origin), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
