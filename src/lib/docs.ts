import type { CollectionEntry } from "astro:content";
import { SITE } from "./site";

/** The release the docs describe. It changes with each release of DPOLens. */
export const DOCS_VERSION = "0.1.0-rc.3";

/** The docs' menu: each group's pages, by file name in src/content/docs, in reading order. */
export const DOCS_NAV = [
  { title: "Start", pages: ["get-started", "connect"] },
  { title: "Use", pages: ["policies", "laws"] },
  { title: "Run", pages: ["configuration", "releases"] },
  { title: "Reference", pages: ["mcp", "api"] },
];

export const DOCS_ORDER = DOCS_NAV.flatMap((group) => group.pages);

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let tabSets = 0;

/**
 * Turns `<!-- tabs -->`, a level-4 heading per tab, and `<!-- /tabs -->` into tabs. In the
 * Markdown, and in the copy given to AI assistants, they stay plain headings.
 */
const tabs = (html: string) =>
  html.replace(/<!-- tabs -->([\s\S]*?)<!-- \/tabs -->/g, (_, inner: string) => {
    const set = ++tabSets;
    const parts = inner.split(/<h4 id="[^"]*">([\s\S]*?)<\/h4>/).slice(1);
    const names: string[] = parts.filter((_, index) => index % 2 === 0);
    const panels: string[] = parts.filter((_, index) => index % 2 === 1);
    const id = (index: number) => `tabs${set}-${index}`;
    const buttons = names
      .map(
        (name, index) =>
          `<button type="button" role="tab" id="${id(index)}" aria-controls="${id(index)}-panel" ` +
          `aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${name}</button>`,
      )
      .join("");
    const bodies = panels
      .map(
        (panel, index) =>
          `<div class="panel" role="tabpanel" id="${id(index)}-panel" aria-labelledby="${id(index)}"` +
          `${index === 0 ? "" : " hidden"}>${panel}</div>`,
      )
      .join("");
    return `<div class="tabs" data-tabs><div class="tablist" role="tablist" aria-label="Your AI assistant">${buttons}</div>${bodies}</div>`;
  });

/**
 * What the docs add to a page's rendered Markdown: tabs, a number beside each numbered step, a
 * link on each heading, a bar with the language and Copy above each code block, and tables
 * that scroll inside their own box on a narrow screen.
 */
export function enhance(html: string): string {
  return tabs(html)
    .replace(/<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g, (_, level, id, text: string) => {
      const step = text.match(/^(\d+)\. ([\s\S]*)$/);
      const inner = step
        ? `<span class="step" aria-hidden="true">${step[1]}</span>${step[2]}`
        : text;
      return (
        `<h${level} id="${id}"${step ? ' class="numbered"' : ""}>${inner}` +
        `<a class="anchor" href="#${id}" aria-label="Link to this section" data-pagefind-ignore>#</a>` +
        `</h${level}>`
      );
    })
    .replace(/<pre([^>]*)>[\s\S]*?<\/pre>/g, (pre, attributes: string) => {
      const language = attributes.match(/data-language="([^"]*)"/)?.[1] ?? "";
      const label = language === "plaintext" ? "" : language;
      return (
        `<div class="code"><div class="bar" data-pagefind-ignore><span>${escape(label)}</span>` +
        `<button type="button" data-copy>Copy</button></div>${pre}</div>`
      );
    })
    .replace(/<table>([\s\S]*?)<\/table>/g, '<div class="table"><table>$1</table></div>');
}

/** The page as Markdown, for AI assistants: its title and summary first, links in full. */
export function markdownCopy(entry: CollectionEntry<"docs">): string {
  const body = (entry.body ?? "")
    .replace(/^<!-- \/?tabs -->\n\n?/gm, "")
    .replace(/\]\(\/([^)]*)\)/g, `](${SITE.origin}/$1)`)
    .trim();
  return `# ${entry.data.title}\n\n${entry.data.description}\n\n${body}\n`;
}
