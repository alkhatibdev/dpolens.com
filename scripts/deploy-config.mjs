// Run by the deploy workflow before the build. The Cloud waitlist's two Cloudflare values are
// repository secrets rather than files here: TURNSTILE_SITE_KEY goes into the build, and
// D1_DATABASE_ID is written into wrangler.jsonc, so a deploy binds that one database and fails,
// rather than making a new one, if it is ever missing. Either secret unset stops the deploy.
import { readFileSync, writeFileSync } from "node:fs";

const fail = (message) => {
  console.error(`::error::${message}`);
  process.exit(1);
};

const siteKey = process.env.PUBLIC_TURNSTILE_SITE_KEY ?? "";
const databaseId = process.env.D1_DATABASE_ID ?? "";

if (siteKey === "") fail("The TURNSTILE_SITE_KEY secret is not set.");
// Cloudflare's test site keys start 1x, 2x or 3x and would leave the form unable to pass.
if (/^[123]x0{20}/.test(siteKey)) fail("TURNSTILE_SITE_KEY is one of Cloudflare's test keys.");
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(databaseId)) {
  fail("The D1_DATABASE_ID secret is not set to a D1 database's id.");
}

const file = "wrangler.jsonc";
const anchor = '"database_name": "dpolens-waitlist",';
const config = readFileSync(file, "utf8");
if (!config.includes(anchor)) fail(`${file} no longer names the dpolens-waitlist database.`);
writeFileSync(file, config.replace(anchor, `${anchor} "database_id": "${databaseId}",`));
console.log(`${file}: the waitlist's database is pinned by its id.`);
