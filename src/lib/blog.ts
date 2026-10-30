import { type CollectionEntry, getCollection } from "astro:content";
import { SITE } from "./site";

/** Who writes the blog. Everywhere else on the site, DPOLens speaks for itself. */
export const AUTHOR = {
  name: "Alkhatib Adam",
  initials: "AA",
  role: "Builds DPOLens",
  url: "https://alkhatib.dev",
};

export type Post = CollectionEntry<"blog">;

/** Every post, newest first. */
export const getPosts = async (): Promise<Post[]> =>
  (await getCollection("blog")).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

export const postPath = (post: Post) => `/blog/${post.id}`;

const long = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const short = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** 27 October 2026, and 27 Oct 2026 in the list of posts. */
export const longDate = (date: Date) => long.format(date);
export const shortDate = (date: Date) => short.format(date).replace("Sept", "Sep");

/** Minutes to read, at about 230 words a minute. */
export const readingMinutes = (post: Post) =>
  Math.max(1, Math.round((post.body ?? "").split(/\s+/).filter(Boolean).length / 230));

/**
 * A bar from 0 to 1, drawn in SVG: its size is an attribute, which the Content Security Policy
 * allows where an inline style would be blocked.
 */
export const bar = (value: number, direction: "across" | "up", best = false) => {
  const size = `${Math.round(value * 1000) / 10}%`;
  const rect =
    direction === "across"
      ? `<rect width="${size}" height="100%" rx="6" />`
      : `<rect y="${100 - parseFloat(size)}%" width="100%" height="${size}" rx="7" />`;
  return `<svg class="bar${best ? " best" : ""}" aria-hidden="true">${rect}</svg>`;
};

/**
 * What the blog adds to a post's rendered Markdown. A table after `<!-- bars -->` draws its
 * second column as bars, the highest in the brand's green: numbers from 0 to 1, or counts such as
 * "36 of 36". Every table scrolls inside its own box on a narrow screen.
 */
export function enhance(html: string): string {
  const row = /(<tr>\s*<td>[\s\S]*?<\/td>\s*)<td>(\d+ of \d+|[\d.]+)<\/td>/g;
  const valueOf = (cell: string) => {
    const [part, whole] = cell.split(" of ").map(Number);
    return whole === undefined ? part : part / whole;
  };
  return html
    .replace(/<!-- bars -->\s*<table>([\s\S]*?)<\/table>/g, (_, table: string) => {
      const top = Math.max(...[...table.matchAll(row)].map((match) => valueOf(match[2])));
      const body = table.replace(row, (_, start: string, cell: string) => {
        const value = valueOf(cell);
        return `${start}<td class="value"><div>${bar(value, "across", value === top)}<span>${cell}</span></div></td>`;
      });
      // Counts such as "36 of 36" need a wider column for their numbers than shares do.
      const counts = [...table.matchAll(row)].some((match) => match[2].includes(" of "));
      return `<table class="bars${counts ? " counts" : ""}">${body}</table>`;
    })
    .replace(
      /<table( class="bars(?: counts)?")?>([\s\S]*?)<\/table>/g,
      '<div class="table"><table$1>$2</table></div>',
    );
}

/** The post as Markdown, for AI assistants: its title, author, date and summary first. */
export function markdownCopy(post: Post): string {
  const body = (post.body ?? "")
    .replace(/^<!-- bars -->\n\n?/gm, "")
    .replace(/\]\(\/([^)]*)\)/g, `](${SITE.origin}/$1)`)
    .trim();
  const by = `By ${AUTHOR.name}, ${longDate(post.data.date)}.`;
  return `# ${post.data.title}\n\n${by}\n\n${post.data.description}\n\n${body}\n`;
}
