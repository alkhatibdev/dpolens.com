import type { APIRoute } from "astro";
import { AUTHOR, getPosts, postPath } from "../../lib/blog";
import { SITE } from "../../lib/site";

const xml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The blog as an RSS 2.0 feed, newest post first.
export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const items = posts
    .map((post) => {
      const url = `${SITE.origin}${postPath(post)}`;
      return [
        "    <item>",
        `      <title>${xml(post.data.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${post.data.date.toUTCString()}</pubDate>`,
        `      <description>${xml(post.data.description)}</description>`,
        `      <category>${xml(post.data.tag)}</category>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE.name} blog</title>
    <link>${SITE.origin}/blog</link>
    <atom:link href="${SITE.origin}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>Notes from building DPOLens, by ${xml(AUTHOR.name)}.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
