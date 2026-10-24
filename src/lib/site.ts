export const SITE = {
  name: "DPOLens",
  origin: "https://dpolens.com",
  tagline: "Privacy law your AI assistant can cite",
  description:
    "An open-source, self-hosted MCP server that gives AI coding assistants your privacy policies and the law, so they cite the exact clause while code is written. Laws come as packs, GDPR and the UAE PDPL today.",
  repo: "https://github.com/alkhatibdev/dpolens",
  repoName: "alkhatibdev/dpolens",
  contact: "hello@dpolens.com",
};

/**
 * The DPOLens Cloud waitlist's bot check. A deploy builds with the Turnstile widget's site key,
 * the repository secret TURNSTILE_SITE_KEY; every other build uses Cloudflare's test key, which
 * always passes.
 */
export const WAITLIST = {
  siteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
};

/** The community version: DPOLens hosted for anyone, with public law only. */
export const COMMUNITY = {
  url: "https://mcp.dpolens.com",
};

export interface Link {
  name: string;
  href: string;
  /** For a section's link: the start of every path in the section, to mark it as current. */
  section?: string;
}

/** The site's sections in the header. A section is listed once its pages exist. */
export const NAV: Link[] = [
  { name: "Docs", href: "/docs/introduction", section: "/docs" },
  { name: "Laws", href: "/laws" },
  { name: "Community", href: "/community" },
  { name: "Blog", href: "/blog", section: "/blog" },
];

/** The footer's columns. A link is listed once the page it leads to exists. */
export const FOOTER: { title: string; links: Link[] }[] = [
  {
    title: "Product",
    links: [
      { name: "Community version", href: "/community" },
      { name: "Cloud", href: "/#cloud" },
      { name: "Laws", href: "/laws" },
    ],
  },
  {
    title: "Docs",
    links: [
      { name: "Get started", href: "/docs/get-started" },
      { name: "Connect your AI assistant", href: "/docs/connect" },
      { name: "Your own policies", href: "/docs/policies" },
      { name: "The HTTP API", href: "/docs/api" },
    ],
  },
  {
    title: "Project",
    links: [
      { name: "Blog", href: "/blog" },
      { name: "GitHub", href: SITE.repo },
      { name: "Releases", href: `${SITE.repo}/releases` },
      { name: "Contributing", href: `${SITE.repo}/blob/main/CONTRIBUTING.md` },
      { name: "Security", href: `${SITE.repo}/blob/main/SECURITY.md` },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy", href: "/privacy" },
      { name: "Terms", href: "/terms" },
    ],
  },
];

/** What llms.txt lists beside the docs, which it takes from the docs themselves. */
export const LLMS: { title: string; links: (Link & { note?: string })[] }[] = [
  {
    title: "Community version",
    links: [
      {
        name: "DPOLens, hosted for anyone",
        href: `${SITE.origin}/community`,
        note: `add ${COMMUNITY.url} to an AI assistant, with no sign-in and no token; public law only`,
      },
    ],
  },
  {
    title: "Project",
    links: [
      { name: "Source code, README and releases", href: SITE.repo },
      { name: "Security policy", href: `${SITE.repo}/blob/main/SECURITY.md` },
    ],
  },
];

/** A page's path as people use it: /about rather than the built file's /about.html. */
export const pagePath = (url: URL) => url.pathname.replace(/(\/index)?\.html$/, "") || "/";
