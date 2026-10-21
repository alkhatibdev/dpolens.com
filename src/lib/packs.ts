/**
 * The law packs, as the site reads them: the newest release of each pack in the DPOLens
 * repository, downloaded at build time, checked against its SHA-256, and read clause by clause.
 * A build reads the same archives an instance's `dpolens pack update` would load.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { parse } from "yaml";

const REPOSITORY = process.env.DPOLENS_PACKS_REPOSITORY ?? "alkhatibdev/dpolens";
// Archives already downloaded, by file name, so a rebuild reads them from disk.
const CACHE = join(process.cwd(), ".cache", "packs");

export interface Ref {
  /** The clause referred to. */
  key: string;
  /** The words that refer to it, as they stand in the text. */
  text: string;
  /** The clause the words are in. */
  from: string;
}

export interface Clause {
  key: string;
  /** Its anchor on the page: para-1, or para-1-pt-a for a point. */
  anchor: string;
  /** As printed in the law: 1., (a), أ. */
  label: string;
  paragraphs: string[];
  points: Clause[];
}

export interface Text {
  key: string;
  lang: string;
  label: string;
  title?: string;
  clauses: Clause[];
  refs: Ref[];
}

export interface Item {
  /** The file's name without its extension: art-17, rec-1. */
  stem: string;
  kind: "article" | "recital";
  number: number;
  key: string;
  law: Law;
  doc: Doc;
  /** The item in each language the law has, by language code. */
  texts: Map<string, Text>;
}

export interface Doc {
  slug: string;
  title: string;
  normative: boolean;
  sourceUrl: string;
  sourceSha256: string;
  items: Item[];
}

export interface Translation {
  lang: string;
  status: string;
  license: string;
  sourceUrl: string;
}

export interface Law {
  slug: string;
  /** How people name it: GDPR, UAE PDPL. */
  short: string;
  name: string;
  jurisdiction: string;
  version: string;
  effectiveDate: string;
  trustTier: string;
  sourceUrl: string;
  license: string;
  /** The language whose text is the law. */
  authoritative: string;
  translations: Translation[];
  docs: Doc[];
  archive: { name: string; url: string; sha256: string; release: string };
}

interface Asset {
  name: string;
  browser_download_url: string;
}

interface Release {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  assets: Asset[];
}

const github = async (path: string): Promise<unknown> => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "dpolens.com",
  };
  // On CI the workflow's token lifts the API's limit of 60 calls an hour for an address.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${path}`);
  return response.json();
};

const download = async (url: string): Promise<Buffer> => {
  const response = await fetch(url, { headers: { "User-Agent": "dpolens.com" } });
  if (!response.ok) throw new Error(`Downloading ${url} answered ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

const newer = (a: string, b: string) => {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return difference > 0;
  }
  return false;
};

/** Each pack's newest published release: its tag is pack/<slug>/<version>. */
const newestReleases = async () => {
  const releases: Release[] = [];
  for (let page = 1; ; page++) {
    const batch = (await github(
      `/repos/${REPOSITORY}/releases?per_page=100&page=${page}`,
    )) as Release[];
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  const newest = new Map<string, { version: string; release: Release }>();
  for (const release of releases) {
    const match = /^pack\/([a-z0-9-]+)\/([\d.]+)$/.exec(release.tag_name);
    if (!match || release.draft || release.prerelease) continue;
    const [, slug, version] = match;
    const known = newest.get(slug);
    if (!known || newer(version, known.version)) newest.set(slug, { version, release });
  }
  return newest;
};

/** The archive's files, by path. Archives hold plain files, written by Python's tarfile. */
const untar = (archive: Buffer) => {
  const files = new Map<string, string>();
  let offset = 0;
  let longName: string | undefined;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start: number, length: number) =>
      header
        .subarray(start, start + length)
        .toString("utf8")
        .replace(/\0[\s\S]*$/, "");
    const prefix = field(345, 155);
    const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    const size = parseInt(field(124, 12).trim() || "0", 8);
    const type = String.fromCharCode(header[156]);
    const body = archive.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === "x") {
      longName = /\d+ path=([^\n]*)\n/.exec(body.toString("utf8"))?.[1];
    } else if (type === "L") {
      longName = body.toString("utf8").replace(/\0[\s\S]*$/, "");
    } else if (type === "0" || type === "\0") {
      files.set(longName ?? name, body.toString("utf8"));
      longName = undefined;
    } else if (type !== "g") {
      longName = undefined;
    }
  }
  return files;
};

const fetchArchive = async (name: string, url: string, expected: string) => {
  mkdirSync(CACHE, { recursive: true });
  const cached = join(CACHE, name);
  const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  if (existsSync(cached)) {
    const bytes = readFileSync(cached);
    if (sha256(bytes) === expected) return bytes;
  }
  const bytes = await download(url);
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new Error(`${name} has the SHA-256 ${actual}, and its release says ${expected}`);
  }
  writeFileSync(cached, bytes);
  return bytes;
};

const HEADING = /^(#{2,3}) ?(.*?)\s*\{#([\w-]+)\}\s*$/;

/** A file's front matter and its clauses: level-2 headings are paragraphs, level-3 points. */
const read = (source: string) => {
  const [, head, body] = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(source) ?? ["", "", source];
  const meta = (parse(head) ?? {}) as Record<string, unknown>;
  const base = String(meta.key);
  const clauses: Clause[] = [];
  let current: Clause | undefined;
  let lines: string[] = [];
  const flush = () => {
    if (current && lines.length) current.paragraphs.push(lines.join(" "));
    lines = [];
  };
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const [, level, label, id] = heading;
      const paragraph = clauses.at(-1);
      if (level === "###" && paragraph) {
        current = {
          key: `${paragraph.key}:${id}`,
          anchor: `${paragraph.anchor}-${id}`,
          label,
          paragraphs: [],
          points: [],
        };
        paragraph.points.push(current);
      } else {
        current = { key: `${base}:${id}`, anchor: id, label, paragraphs: [], points: [] };
        clauses.push(current);
      }
    } else if (!line) {
      flush();
    } else {
      // Text before the first heading is the item's own, as a recital's is.
      current ??=
        clauses[
          clauses.push({ key: base, anchor: "text", label: "", paragraphs: [], points: [] }) - 1
        ];
      lines.push(line);
    }
  }
  flush();
  return { meta, clauses };
};

const short = (slug: string) => slug.toUpperCase().replace(/-/g, " ");

const readLaw = (files: Map<string, string>, slug: string, archive: Law["archive"]): Law => {
  const pack = parse(files.get(`${slug}/pack.yaml`) ?? "") as Record<string, any>;
  if (!pack) throw new Error(`The ${slug} archive has no ${slug}/pack.yaml`);
  const translations: Translation[] = (pack.translations ?? []).map(
    (t: Record<string, string>) => ({
      lang: t.lang,
      status: t.status,
      license: String(t.license ?? "").trim(),
      sourceUrl: t.source_url,
    }),
  );
  const law: Law = {
    slug,
    short: short(slug),
    name: pack.name,
    jurisdiction: pack.jurisdiction,
    version: String(pack.version),
    effectiveDate: String(pack.effective_date),
    trustTier: pack.trust_tier,
    sourceUrl: pack.source_url,
    license: String(pack.license ?? "").trim(),
    authoritative: pack.authoritative_language ?? "en",
    translations,
    docs: [],
    archive,
  };
  for (const document of pack.documents as Record<string, any>[]) {
    const doc: Doc = {
      slug: document.slug,
      title: document.title,
      normative: document.normative !== false,
      sourceUrl: document.source_url,
      sourceSha256: document.source_sha256,
      items: [],
    };
    const folder = `${slug}/${doc.slug}/`;
    const stems = new Set(
      [...files.keys()]
        .filter((path) => path.startsWith(folder) && path.endsWith(".md"))
        .map((path) => path.slice(folder.length).split(".")[0]),
    );
    for (const stem of stems) {
      const number = Number(stem.split("-")[1]);
      const texts = new Map<string, Text>();
      for (const lang of [law.authoritative, ...translations.map((t) => t.lang)]) {
        const path =
          lang === law.authoritative ? `${folder}${stem}.md` : `${folder}${stem}.${lang}.md`;
        const source = files.get(path);
        if (!source) continue;
        const { meta, clauses } = read(source);
        texts.set(lang, {
          key: String(meta.key),
          lang,
          label: String(meta.label),
          title: meta.title ? String(meta.title) : undefined,
          clauses,
          refs: (meta.cross_references as Ref[] | undefined) ?? [],
        });
      }
      const own = texts.get(law.authoritative);
      if (!own) continue;
      doc.items.push({
        stem,
        kind: stem.startsWith("rec-") ? "recital" : "article",
        number,
        key: own.key,
        law,
        doc,
        texts,
      });
    }
    doc.items.sort((a, b) => a.number - b.number);
    law.docs.push(doc);
  }
  return law;
};

let laws: Promise<Law[]> | undefined;

/** Every law with a published pack, read once a build. */
export const getLaws = () => {
  laws ??= (async () => {
    const found: Law[] = [];
    for (const [slug, { release }] of await newestReleases()) {
      const archive = release.assets.find((asset) => asset.name.endsWith(".tar.gz"));
      const checksum = release.assets.find((asset) => asset.name.endsWith(".tar.gz.sha256"));
      if (!archive || !checksum) {
        throw new Error(`${release.tag_name} has no archive and checksum to read`);
      }
      const expected = (await download(checksum.browser_download_url))
        .toString("utf8")
        .trim()
        .split(/\s+/)[0];
      const bytes = await fetchArchive(archive.name, archive.browser_download_url, expected);
      found.push(
        readLaw(untar(gunzipSync(bytes)), slug, {
          name: archive.name,
          url: archive.browser_download_url,
          sha256: expected,
          release: release.html_url,
        }),
      );
    }
    return found.sort((a, b) => a.slug.localeCompare(b.slug));
  })();
  return laws;
};

const indexes = new Map<string, Map<string, { item: Item; clause: Clause }>>();

/** Every keyed clause of a law in a language, the item it is in, and its words. */
export const clauseIndex = (law: Law, lang: string) => {
  const cached = indexes.get(`${law.slug}:${lang}`);
  if (cached) return cached;
  const index = new Map<string, { item: Item; clause: Clause }>();
  indexes.set(`${law.slug}:${lang}`, index);
  for (const doc of law.docs) {
    for (const item of doc.items) {
      const text = item.texts.get(lang) ?? item.texts.get(law.authoritative)!;
      const walk = (clauses: Clause[]) =>
        clauses.forEach((clause) => {
          index.set(clause.key, { item, clause });
          walk(clause.points);
        });
      walk(text.clauses);
      index.set(item.key, { item, clause: text.clauses[0] });
    }
  }
  return index;
};

/** How many clauses a law has: every item, paragraph and point with its own key. */
export const clauseCount = (law: Law) => clauseIndex(law, law.authoritative).size;

/** Every other item of the law that refers to this one, with the clause that does. */
export const referredBy = (item: Item) => {
  const found = new Map<string, { item: Item; from: string }>();
  for (const doc of item.law.docs) {
    for (const other of doc.items) {
      if (other === item) continue;
      for (const ref of other.texts.get(item.law.authoritative)?.refs ?? []) {
        if ((ref.key === item.key || ref.key.startsWith(`${item.key}:`)) && !found.has(other.key)) {
          // An item with no paragraphs refers from itself, and its references name no clause.
          found.set(other.key, { item: other, from: ref.from ?? other.key });
        }
      }
    }
  }
  return [...found.values()];
};
