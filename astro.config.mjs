// @ts-check
import { readdirSync, readFileSync } from "node:fs";
import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";
import { parse } from "yaml";

// The day each post was published, as its date in the sitemap, and the newest one as the blog's.
// Other pages carry no date: the build's would claim that every page changed every day.
const BLOG = "src/content/blog";
const posted = new Map(
  readdirSync(BLOG)
    .filter((file) => file.endsWith(".md"))
    .map((file) => [
      `https://dpolens.com/blog/${file.replace(/\.md$/, "")}`,
      new Date(parse(readFileSync(`${BLOG}/${file}`, "utf8").split("---")[1]).date),
    ]),
);
const newest = Math.max(...[...posted.values()].map((date) => date.getTime()));
posted.set("https://dpolens.com/blog", new Date(newest));

export default defineConfig({
  site: "https://dpolens.com",
  // Pages are written as about.html and served as /about, so every address has one form.
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [
    sitemap({
      serialize: (item) => ({ ...item, lastmod: posted.get(item.url)?.toISOString() }),
    }),
  ],
  markdown: {
    // Prism marks code with classes, which the Content Security Policy allows, where inline
    // styles would be blocked. Straight quotes stay straight, and two hyphens never become a dash.
    syntaxHighlight: "prism",
    smartypants: false,
  },
  // Downloaded at build time and served from the site itself, with fallbacks sized to match.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Readex Pro",
      cssVariable: "--font-sans",
      weights: [300, 400, 500, 600, 700],
      styles: ["normal"],
      subsets: ["latin", "latin-ext", "arabic"],
      fallbacks: ["system-ui", "sans-serif"],
    },
    {
      provider: fontProviders.fontsource(),
      name: "JetBrains Mono",
      cssVariable: "--font-mono",
      weights: [400, 500],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-monospace", "monospace"],
    },
  ],
  security: {
    // Sent as a meta tag on every page, with a hash for each inline script and style.
    // frame-ancestors cannot go in a meta tag, so public/_headers sends it.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ],
      // Search runs Pagefind's WebAssembly in the page. Cloudflare Web Analytics adds its
      // script to every page as it is served, and reports to the site's own /cdn-cgi/rum.
      scriptDirective: {
        resources: ["'self'", "'wasm-unsafe-eval'", "https://static.cloudflareinsights.com"],
      },
    },
  },
});
