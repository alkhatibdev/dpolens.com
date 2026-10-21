# dpolens.com

The website of [DPOLens](https://github.com/alkhatibdev/dpolens), an open-source MCP server for
GDPR, the UAE PDPL and an organisation's own policies. It holds the product's pages, the user
docs and a page for every article of every supported law. A blog is coming.

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
npm run build && npm run check:site # titles, URLs, links, punctuation
```

## How it is built

- [Astro](https://astro.build), static output, no client framework. Each page is written as
  `about.html` and served as `/about`.
- The look is the DPOLens dashboard's. `src/styles/theme.css` copies the tokens of
  `dashboard/src/index.css` in the DPOLens repository, and the two change together.
- Readex Pro and JetBrains Mono are downloaded at build time and served from the site itself.
- Search is [Pagefind](https://pagefind.app), indexed from the built pages.
- `src/lib/site.ts` holds the site's name, its description, the community version's URL,
  and the links in the header, the footer and `llms.txt`.

## The product pages

The home page, the community version's page (`/community`) and the legal pages (`/privacy` and
`/terms`) share `src/styles/home.css`. Their scenes are plain HTML and CSS, moved by small scripts,
and the law versions they quote come from the law packs.

`/privacy` says what DPOLens keeps about the people who use it. When the community version
changes what it keeps, how long it keeps it, or what it takes out of a question, `/privacy`
changes in the same release, with a new date at the top.

## The law pages

Every page under `/laws` is built from the newest release of each law pack in the DPOLens
repository, `pack/<slug>/<version>`, the archive an instance's `dpolens pack update` would load.
The build downloads it, checks it against its SHA-256, and reads it (`src/lib/packs.ts`). A
new pack release reaches the site with the next daily deploy. Archives are kept in `.cache/packs`
between builds, and `DPOLENS_PACKS_REPOSITORY` names another repository to read them from, as it
does for an instance.

Each article and recital has its own page, in every language the pack has, with a key on every
clause and a Markdown copy beside it: `/laws/gdpr/art-17` and `/laws/gdpr/art-17.md`, and the
text that prevails at `/ar/laws/uae-pdpl/art-15`.

## The docs

The docs describe the newest release of DPOLens, which `DOCS_VERSION` in `src/lib/docs.ts`
names. Each page is a Markdown file in `src/content/docs`, with a `title` and a `description`
at the top: the description is the answer the page opens with, and what search results show.
`DOCS_NAV` beside it sets the menu and the reading order.

Write a page as plain Markdown, so it reads the same on GitHub and in the copy given to AI
assistants at `/docs/<page>.md`. Two conventions:

- A heading such as `## 1. Set it up` is a numbered step.
- Level-4 headings between `<!-- tabs -->` and `<!-- /tabs -->` become tabs, one for each
  AI assistant.

When a change to DPOLens touches a setting, a command, an API route, an MCP tool or a law
pack, the page that describes it changes too, merged when that release ships.

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
