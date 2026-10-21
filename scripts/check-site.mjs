// Checks the built site in dist/ before it is deployed, and the text the repository publishes:
//
// - every page has a title and a description, and every page but the 404 a canonical address
//   in the form the site serves (https://dpolens.com/about, never about.html or about/);
// - every link from one page of the site to another leads to a file the site serves;
// - the search index is there;
// - no text uses an em dash or an en dash. The site punctuates with commas, colons, full stops
//   and parentheses, and a plain hyphen where a dash cannot be avoided.
//
//   npm run build && npm run check:site

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = "dist";
const ORIGIN = "https://dpolens.com";
// U+2013 and U+2014, built from their codes so that this file passes its own check.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
// Files written by Pagefind and font files are not the site's own text.
const SKIP = [join(DIST, "pagefind"), join(DIST, "_astro", "fonts")];
const TEXT = /\.(astro|css|html|js|json|jsonc|md|mjs|ts|txt|webmanifest|xml|ya?ml)$/;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const problems = [];
const built = walk(DIST).filter((file) => !SKIP.some((skip) => file.startsWith(skip)));

// An address inside the site resolves the way the host serves it: /about from about.html.
const served = (href) => {
  const path = decodeURIComponent(href.split(/[?#]/)[0]);
  const target = join(DIST, path);
  return [target, `${target}.html`, join(target, "index.html")].some(
    (file) => existsSync(file) && statSync(file).isFile(),
  );
};

for (const file of built.filter((file) => file.endsWith(".html"))) {
  const page = readFileSync(file, "utf8");
  const name = `/${relative(DIST, file)}`;
  const head = page.slice(0, page.indexOf("</head>"));
  if (!/<title>[^<]+<\/title>/.test(head)) problems.push(`${name}: no title`);
  if (!/<meta name="description" content="[^"]+"/.test(head))
    problems.push(`${name}: no description`);
  if (name !== "/404.html") {
    const canonical = head.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    const path = canonical?.startsWith(`${ORIGIN}/`) ? canonical.slice(ORIGIN.length) : undefined;
    if (!path || /\.html$/.test(path) || (path !== "/" && path.endsWith("/"))) {
      problems.push(`${name}: canonical address ${canonical ?? "missing"}`);
    }
  }
  for (const [, href] of page.matchAll(/\shref="([^"]+)"/g)) {
    if (href.startsWith("/") && !href.startsWith("//") && !served(href)) {
      problems.push(`${name}: the link to ${href} leads nowhere`);
    }
  }
}

if (!existsSync(join(DIST, "pagefind", "pagefind.js")))
  problems.push("dist/pagefind: no search index");

const sources = [
  ...["src", "public", "scripts", ".github"].flatMap((dir) => walk(dir)),
  "README.md",
  "astro.config.mjs",
  "wrangler.jsonc",
  "package.json",
];
for (const file of [...built, ...sources].filter((file) => TEXT.test(file))) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (DASHES.test(line)) problems.push(`${file}:${index + 1}: an em or en dash`);
    });
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`dist/ and the sources: ${built.length} files checked, no problems.`);
