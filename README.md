# dpolens.com

The website of [DPOLens](https://github.com/alkhatibdev/dpolens), an open-source MCP server for
privacy law and an organisation's own policies. It holds the product's pages, the user
docs, a page for every article of every supported law, and a blog.

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

## The blog

Each post is a Markdown file in `src/content/blog`, its name the post's address:
`reranker-made-search-worse.md` is `/blog/reranker-made-search-worse`, with a copy in Markdown at
`/blog/reranker-made-search-worse.md`. The posts are written by Alkhatib Adam, in his own voice;
the rest of the site speaks as DPOLens.

At the top of each file:

- `title`, and `description`: the answer the post gives, which search results show
- `summary`: the line under the title in the list of posts
- `date`, the day it is published, and `tag`, one word for what it is about
- `cover`: the post's own numbers, from 0 to 1, drawn as bars in the list of posts; `best: true`
  marks the one in green

A table after `<!-- bars -->` draws its second column as bars. The posts are listed in
`/blog/rss.xml` and `llms.txt`.

## The Cloud waitlist

The home page's DPOLens Cloud section has a form, the site's only code that runs on the server.
`wrangler.jsonc` sends the paths under `/api/` to a small Worker, `worker/index.ts`; every other
request is a static file. For `POST /api/waitlist`, the Worker:

1. accepts the form only from the site's own page, and only small;
2. checks the email address and the optional answer (`worker/waitlist.ts`);
3. asks Turnstile whether the bot check's token is real, unused, from dpolens.com and from the
   waitlist's widget;
4. stores the entry in a D1 database, once for each address, and answers the same whether or
   not the address was already on the list;
5. emails a new entry to the maintainer through Cloudflare Email Routing.

Turnstile's script loads when somebody starts filling in the form, and only the home page's
Content Security Policy allows it. The database's table is in `migrations/`.

A build outside the deploy uses Cloudflare's test site key, which always passes. To try the form
locally, give the Worker the matching test secret:

```bash
printf 'TURNSTILE_SECRET=1x0000000000000000000000000000000AA\nNOTIFY_TO=you@example.com\n' > .dev.vars
npm run build
npx wrangler d1 migrations apply dpolens-waitlist --local
npm run preview                     # the email is not sent, only shown in the terminal
```

The Worker's own rules are tested with `npm run check:worker`.

## Deploying

Every merge to `main` deploys the site to Cloudflare Workers, and so does a run once a day.
The workflow needs four repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`TURNSTILE_SITE_KEY` and `D1_DATABASE_ID`. It stops before building if either of the last two is
missing (`scripts/deploy-config.mjs`).

The Worker needs, once, on the Cloudflare account:

- the D1 database: `npx wrangler d1 create dpolens-waitlist --jurisdiction eu`, its id as the
  repository secret `D1_DATABASE_ID`, and its table:
  `npx wrangler d1 migrations apply dpolens-waitlist --remote`, which finds the database by name;
- a Turnstile widget for `dpolens.com`, its site key as the repository secret
  `TURNSTILE_SITE_KEY`, and its secret key as the Worker's secret:
  `npx wrangler secret put TURNSTILE_SECRET`;
- Email Routing on `dpolens.com`, and the address the entries go to, verified there, as the
  Worker's secret `NOTIFY_TO`.

A new migration is applied with the same `migrations apply` command, before the deploy that
needs it.

## Licence

- The code is under the [Apache License 2.0](LICENSE).
- The docs and the blog posts are under [CC BY 4.0](LICENSE-CC-BY-4.0.txt): you may reuse them
  if you credit DPOLens and link to the page.
- The law texts keep the terms of their official sources, stated on each law's page.
- Neither licence grants the use of the DPOLens name or logo.
