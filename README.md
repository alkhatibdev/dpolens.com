# dpolens.com

The website of [DPOLens](https://github.com/alkhatibdev/dpolens), an open-source MCP server for
GDPR, the UAE PDPL and an organisation's own policies. It holds the product's pages, the user
docs, a page for every article of every supported law, and the blog.

dpolens.com is not open yet. Until it opens, every response asks search engines not to list it
(`public/_headers`).

## Run it

You need Node 24.

```bash
npm ci
npm run dev        # http://localhost:4321, rebuilt as you edit
```

Search and the security headers exist only in the built site:

```bash
npm run build      # the site into dist/, then Pagefind's search index
npm run preview    # dist/ served the way production serves it, headers included
```

Before a pull request:

```bash
npm run format:check
npm run check                       # types
npm run build && npm run check:site # titles, addresses, links, punctuation
```

## How it is built

- [Astro](https://astro.build), static output, no client framework. Each page is written as
  `about.html` and served as `/about`.
- The look is the DPOLens dashboard's. `src/styles/theme.css` copies the tokens of
  `dashboard/src/index.css` in the DPOLens repository, and the two change together.
- Readex Pro and JetBrains Mono are downloaded at build time and served from the site itself.
- Search is [Pagefind](https://pagefind.app), indexed from the built pages.
- `src/lib/site.ts` holds the site's name, its description, and the links in the header, the
  footer and `llms.txt`.

## Deploying

Every merge to `main` deploys the site to Cloudflare Workers as static files, and so does a
run once a day. The workflow needs two repository secrets: `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`.

## Licence

- The code is under the [Apache License 2.0](LICENSE).
- The docs and the blog posts are under [CC BY 4.0](LICENSE-CC-BY-4.0.txt): you may reuse them
  if you credit DPOLens and link to the page.
- The law texts keep the terms of their official sources, stated on each law's page.
- Neither licence grants the use of the DPOLens name or logo.
