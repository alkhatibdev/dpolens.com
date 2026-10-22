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

const METHOD = "GET|POST|PUT|PATCH|DELETE";
const LOCK =
  '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="12" height="8" rx="2"/>' +
  '<path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>';

/** A route's anchor: post-v1-search for POST /v1/search. */
const routeId = (method: string, path: string) =>
  `${method} ${path}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** A route's path, its parameters set apart, with room to break after each slash. */
const routePath = (path: string) =>
  path
    .split("/")
    .map((part) => (part.startsWith("{") ? `<i>${part}</i>` : part))
    .join("/<wbr>");

/** What a route needs, each alternative kept with its "or", so a wrapped line starts with it. */
const needs = (text: string) =>
  text.replace(/ or (<code>[^<]+<\/code>)/g, ' <span class="or">or $1</span>');

/**
 * Turns a heading such as `### POST /v1/search`, and the "Needs ..." line under it, into the
 * route's header. Headers with nothing between them share one box.
 */
const routes = (html: string) =>
  html
    .replace(
      new RegExp(`<h3 id="[^"]*">(${METHOD}) (/[^<]*)</h3>\\s*<p>Needs ([\\s\\S]*?)\\.</p>`, "g"),
      (_, method: string, path: string, need: string) => {
        const id = routeId(method, path);
        return (
          `<div class="routes"><h3 class="route" id="${id}">` +
          `<span class="method ${method.toLowerCase()}">${method}</span>` +
          `<span class="line"><code class="path">${routePath(path)}</code>` +
          `<a class="anchor" href="#${id}" aria-label="Link to this route" data-pagefind-ignore>#</a></span>` +
          `<span class="needs">${LOCK}<span>Needs</span> ${needs(need)}</span></h3></div>`
        );
      },
    )
    .replace(/<\/div>\s*<div class="routes">/g, "");

/**
 * Turns the list between `<!-- routes -->` and `<!-- /routes -->`, each group a link with its
 * routes under it, into the index of every route: the method, the path over what it does, and
 * what it needs. In the Markdown it stays a plain list.
 */
const routeIndex = (html: string) =>
  html.replace(/<!-- routes -->([\s\S]*?)<!-- \/routes -->/g, (_, inner: string) => {
    const groups = [
      ...inner.matchAll(/<li><a href="#([^"]+)">([^<]+)<\/a>\s*<ul>([\s\S]*?)<\/ul>\s*<\/li>/g),
    ];
    const item = new RegExp(
      `<li><a href="#([^"]+)"><code>(${METHOD}) ([^<]+)</code></a>: ([\\s\\S]*?)\\. Needs ([\\s\\S]*?)\\.</li>`,
      "g",
    );
    const body = groups
      .map(([, anchor, name, list]) => {
        const rows = [...list.matchAll(item)]
          .map(
            ([, href, method, path, does, need]) =>
              `<li><a class="gi" href="#${href}"><span class="method sm ${method.toLowerCase()}">${method}</span>` +
              `<span class="gp"><code>${routePath(path)}</code><small>${does}</small></span>` +
              `<span class="gn">${need}</span></a></li>`,
          )
          .join("");
        return `<div class="gg"><a class="gh" href="#${anchor}">${name}</a><ul>${rows}</ul></div>`;
      })
      .join("");
    return `<nav class="glance" aria-label="Every route">${body}</nav>`;
  });

/** "Base URL: `...`. What else to know." becomes the box the address sits in. */
const baseUrl = (html: string) =>
  html.replace(
    /<p>Base URL: <code>([^<]+)<\/code>\. ([\s\S]*?)<\/p>/,
    '<p class="base"><span>Base URL</span><code>$1</code><small>$2</small></p>',
  );

/** A label over the first heading of each part of a page, as the page's `sections` name them. */
const labels = (html: string, sections: { label: string; from: string }[]) =>
  sections.reduce(
    (out, { label, from }) =>
      out.replace(`<h2 id="${from}">`, `<p class="kicker">${label}</p><h2 id="${from}">`),
    html,
  );

/**
 * What the docs add to a page's rendered Markdown: tabs, a number beside each numbered step, a
 * link on each heading, a header for each API route and an index of them, a bar with the language
 * and Copy above each code block, and tables that scroll inside their own box on a narrow screen.
 */
export function enhance(html: string, sections: { label: string; from: string }[] = []): string {
  return labels(baseUrl(routeIndex(routes(tabs(html)))), sections)
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
    .replace(/^<!-- \/?(tabs|routes) -->\n\n?/gm, "")
    .replace(/\]\(\/([^)]*)\)/g, `](${SITE.origin}/$1)`)
    .trim();
  return `# ${entry.data.title}\n\n${entry.data.description}\n\n${body}\n`;
}
