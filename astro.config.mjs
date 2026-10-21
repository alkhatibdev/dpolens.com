// @ts-check
import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
  site: "https://dpolens.com",
  // Pages are written as about.html and served as /about, so every address has one form.
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [sitemap()],
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
