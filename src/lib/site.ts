export const SITE = {
  name: "DPOLens",
  origin: "https://dpolens.com",
  tagline: "Privacy law your AI assistant can cite",
  description:
    "An open-source MCP server for GDPR, the UAE PDPL and your own policies. Every answer is the exact clause, with its version.",
  repo: "https://github.com/alkhatibdev/dpolens",
  repoName: "alkhatibdev/dpolens",
  security: "security@dpolens.com",
};

export interface Link {
  name: string;
  href: string;
  /** For a section's link: the start of every address in the section, to mark it as current. */
  section?: string;
}

/** The site's sections in the header. A section is listed once its pages exist. */
export const NAV: Link[] = [
  { name: "Docs", href: "/docs/get-started", section: "/docs" },
  { name: "Laws", href: "/laws" },
];

/** The footer's columns. A link is listed once the page it leads to exists. */
export const FOOTER: { title: string; links: Link[] }[] = [
  {
    title: "Product",
    links: [{ name: "Laws", href: "/laws" }],
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
      { name: "GitHub", href: SITE.repo },
      { name: "Releases", href: `${SITE.repo}/releases` },
      { name: "Contributing", href: `${SITE.repo}/blob/main/CONTRIBUTING.md` },
      { name: "Security", href: `${SITE.repo}/blob/main/SECURITY.md` },
    ],
  },
];

/** What llms.txt lists beside the docs, which it takes from the docs themselves. */
export const LLMS: { title: string; links: Link[] }[] = [
  {
    title: "Project",
    links: [
      { name: "Source code, README and releases", href: SITE.repo },
      { name: "Security policy", href: `${SITE.repo}/blob/main/SECURITY.md` },
    ],
  },
];

/** A page's address as people use it: /about rather than the built file's /about.html. */
export const pagePath = (url: URL) => url.pathname.replace(/(\/index)?\.html$/, "") || "/";
