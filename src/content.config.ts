import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const docs = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    /** One or two sentences: the answer at the top of the page, and what search results show. */
    description: z.string(),
  }),
});

export const collections = { docs };
