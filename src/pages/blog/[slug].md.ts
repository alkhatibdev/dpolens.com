import type { APIRoute, GetStaticPaths } from "astro";
import { getPosts, markdownCopy, type Post } from "../../lib/blog";

// Each post as Markdown, for AI assistants: /blog/<post>.md beside /blog/<post>.
export const getStaticPaths = (async () =>
  (await getPosts()).map((post) => ({
    params: { slug: post.id },
    props: { post },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(markdownCopy((props as { post: Post }).post), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
