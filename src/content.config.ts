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

export const collections = { docs };
