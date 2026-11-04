import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const docs = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    /** One or two sentences: the answer at the top of the page, and what search results show. */
    description: z.string(),
    /** Labels that divide On this page: each over the heading whose id is `from`, and the ones after it. */
    sections: z.array(z.object({ label: z.string(), from: z.string() })).optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    /** One or two sentences: the answer the post gives, and what search results show. */
    description: z.string(),
    /** The line under the title in the list of posts. */
    summary: z.string(),
    date: z.coerce.date(),
    /** One word for what the post is about: Search, Measured, In use. */
    tag: z.string(),
    /**
     * The cover, in the list of posts and over the post, drawn from the post's own numbers: bars
     * from 0 to 1, or one number on the brand's green.
     */
    cover: z.union([
      z.array(
        z.object({
          label: z.string(),
          value: z.number().min(0).max(1),
          /** What the column shows over its bar, when not the value itself: 36 of 36. */
          text: z.string().optional(),
          best: z.boolean().optional(),
        }),
      ),
      z.object({
        /** Over the number: what was measured. */
        label: z.string(),
        number: z.string(),
        /** After the number, smaller: ×. */
        unit: z.string().optional(),
        /** Under the number: where it came from. */
        line: z.string(),
      }),
    ]),
  }),
});

export const collections = { docs, blog };
