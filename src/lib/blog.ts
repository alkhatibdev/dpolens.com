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

const percent = (value: number) => `${Math.round(value * 1000) / 1000}%`;
const px = (value: number) => Math.round(value * 100) / 100;

/** What a slice holds, as one bar split by share, in SVG for the same reason. */
export const split = (values: number[]) => {
  const total = values.reduce((sum, value) => sum + value, 0);
  let x = 0;
  const rects = values.map((value, i) => {
    const width = (value / total) * 100;
    // Each part runs under the next a little, so no seam shows between them.
    const rect = `<rect x="${percent(x)}" width="${percent(width + (i < values.length - 1 ? 1 : 0))}" height="100%" />`;
    x += width;
    return rect;
  });
  return `<svg class="split" aria-hidden="true">${rects.join("")}</svg>`;
};

/**
 * The strip of a slice cover, in pixels: its bars, the viewfinder past the strip above and below
 * (`over`), and the panel's tail (`gap` long, curving over `sweep`, `band` being the panel's
 * corner it squares). blog.css leaves `over` and `gap` above the strip.
 */
const STRIP = {
  small: { bars: 96, height: 12, over: 5, gap: 16, band: 9.5, sweep: 26, radius: 3, arm: 1.8 },
  large: { bars: 116, height: 16, over: 7, gap: 25, band: 12.5, sweep: 38, radius: 4, arm: 2.4 },
};

/**
 * A slice of a whole, in SVG: the whole as a strip of bars, the slice's share of them in green at
 * its end, framed by the logo's viewfinder. The panel above opens the slice, and its tail runs
 * down to the viewfinder as wide as the slice, whatever the width of the cover.
 */
export const strip = (share: number, large: boolean) => {
  const {
    bars,
    height,
    over,
    gap,
    band,
    sweep,
    radius: r,
    arm,
  } = large ? STRIP.large : STRIP.small;
  const lit = Math.min(bars - 1, Math.max(1, Math.round(share * bars)));
  const pitch = 100 / bars;
  const rects = Array.from(
    { length: bars },
    (_, i) =>
      `<rect x="${percent(i * pitch)}" width="${percent(pitch * 0.6)}" height="100%"${i < bars - lit ? "" : ' class="lit"'} />`,
  ).join("");
  const top = -over;
  const bottom = height + over;
  const edge = top - gap;
  // The tail: the slice's width straight down from the panel, and a curve on its left that leaves
  // the panel's bottom edge level and meets the viewfinder upright. The two overlap by a pixel.
  const tail =
    `<path class="tail" d="M1 ${top}H0C0 ${px(top - 0.55 * gap)} ${px(-sweep / 2)} ${edge} ${-sweep} ${edge}V${px(edge - band)}H1Z" />` +
    `<rect class="tail" y="${px(edge - band)}" width="100%" height="${px(gap + band)}" />`;
  const corner = (n: number, d: string) => `<path class="corner c${n}" d="${d}" />`;
  const finder =
    corner(1, `M${-r} ${px(top + r + arm)}V${top + r}A${r} ${r} 0 0 1 0 ${top}H${arm}`) +
    corner(4, `M${arm} ${bottom}H0A${r} ${r} 0 0 1 ${-r} ${bottom - r}V${px(bottom - r - arm)}`) +
    `<svg x="100%" overflow="visible">` +
    corner(2, `M${-arm} ${top}H0A${r} ${r} 0 0 1 ${r} ${top + r}V${px(top + r + arm)}`) +
    corner(3, `M${r} ${px(bottom - r - arm)}V${bottom - r}A${r} ${r} 0 0 1 0 ${bottom}H${-arm}`) +
    `</svg>`;
  const slice = `<svg x="${percent((bars - lit) * pitch)}" width="${percent(lit * pitch)}" overflow="visible">${tail}${finder}</svg>`;
  return `<svg class="strip" aria-hidden="true">${rects}${slice}</svg>`;
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
