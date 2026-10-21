import { type Clause, type Item, type Law, type Ref, clauseIndex } from "./packs";

/** The region a law's jurisdiction is listed under on the site. */
export const REGIONS: Record<string, string> = {
  "European Union": "Europe",
  "United Arab Emirates": "Middle East",
};

export const region = (law: Law) => REGIONS[law.jurisdiction] ?? "Other";

const LANGUAGES: Record<string, string> = { en: "English", ar: "Arabic" };

export const languageName = (lang: string) => LANGUAGES[lang] ?? lang;

/** The languages a law can be read in, the one that is the law first. */
export const languagesOf = (law: Law) => [
  law.authoritative,
  ...law.translations.map((t) => t.lang),
];

/** What the Text column and the facts say: English, or Arabic, which prevails, and English. */
export const textOf = (law: Law) =>
  law.translations.length
    ? `${languageName(law.authoritative)}, which prevails, and ${law.translations
        .map((t) => languageName(t.lang))
        .join(" and ")}`
    : languageName(law.authoritative);

/** An item's page: /laws/gdpr/art-17, and /ar/laws/uae-pdpl/art-15 for a text in Arabic. */
export const itemPath = (item: Item, lang = "en") =>
  `${lang === "en" ? "" : `/${lang}`}/laws/${item.law.slug}/${item.stem}`;

/** The language a law's pages default to: English where it has English, else the law's own. */
export const pageLanguage = (law: Law) =>
  languagesOf(law).includes("en") ? "en" : law.authoritative;

export const formatDate = (iso: string, lang = "en") =>
  new Intl.DateTimeFormat(lang === "ar" ? "ar-u-nu-latn" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

/** An item's name in a language: Article 17, المادة (15), Recital 1. */
export const itemName = (item: Item, lang = "en") =>
  item.kind === "recital"
    ? `Recital ${item.number}`
    : (item.texts.get(lang) ?? item.texts.get(item.law.authoritative)!).label;

/** A key as people write it: gdpr:art-58:para-2:pt-g is Article 58(2)(g). */
export const cite = (key: string, item: Item, lang = "en") => {
  const rest = key.split(":").slice(2);
  return (
    itemName(item, lang) +
    rest
      .map((part) => /^(?:para|pt)-(.+)$/.exec(part)?.[1])
      .filter(Boolean)
      .map((value) => `(${value})`)
      .join("")
  );
};

export const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A clause's words, its points' too, as one string. */
export const wordsOf = (clause: Clause): string =>
  [
    ...clause.paragraphs,
    ...clause.points.map((point) => `${point.label} ${wordsOf(point)}`.trim()),
  ].join(" ");

/**
 * A paragraph of a clause, with each reference the pack found in it made a link to the clause it
 * names, carrying that clause's words for the preview.
 */
export const linkRefs = (text: string, refs: Ref[], law: Law, lang: string) => {
  const index = clauseIndex(law, lang);
  const spans: { at: number; end: number; ref: Ref }[] = [];
  for (const ref of [...refs].sort((a, b) => b.text.length - a.text.length)) {
    let start = 0;
    for (;;) {
      const at = text.indexOf(ref.text, start);
      if (at === -1) break;
      const end = at + ref.text.length;
      if (spans.every((span) => end <= span.at || at >= span.end)) {
        spans.push({ at, end, ref });
        break;
      }
      start = end;
    }
  }
  let html = "";
  let position = 0;
  for (const { at, end, ref } of spans.sort((a, b) => a.at - b.at)) {
    const target = index.get(ref.key);
    html += escape(text.slice(position, at));
    if (target) {
      const words = wordsOf(target.clause);
      const preview =
        words.length <= 300 ? words : `${words.slice(0, 300).replace(/\s+\S*$/, "")} ...`;
      const title =
        target.item.texts.get(lang)?.title ?? target.item.texts.get(law.authoritative)?.title;
      const href = `${itemPath(target.item, lang)}${target.clause.key === target.item.key ? "" : `#${target.clause.anchor}`}`;
      html +=
        `<a class="xref" href="${href}" data-key="${ref.key}" ` +
        `data-title="${escape(cite(ref.key, target.item, "en"))}${title ? ` · ${escape(title)}` : ""}" ` +
        `data-text="${escape(preview)}">${escape(ref.text)}</a>`;
    } else {
      html += escape(ref.text);
    }
    position = end;
  }
  return html + escape(text.slice(position));
};

/** Every item of a law that people read on their own pages: the articles, then the recitals. */
export const itemsOf = (law: Law) => law.docs.flatMap((doc) => doc.items);

/** An item as Markdown, for AI assistants: each clause under its key, which is how to cite it. */
export const itemMarkdown = (item: Item, lang: string, origin: string) => {
  const law = item.law;
  const text = item.texts.get(lang)!;
  const name = itemName(item, lang);
  const lines = [
    `# ${law.short} ${name}${text.title ? `: ${text.title}` : ""}`,
    "",
    `${law.name} (${law.short}), version ${law.version}, in force since ${formatDate(law.effectiveDate)}. ` +
      `Read from ${item.doc.sourceUrl}. Each clause starts with its key, which is how to cite it.`,
  ];
  if (lang !== law.authoritative) {
    lines.push(
      "",
      `This is the official ${languageName(lang)} translation. Where the two differ, the ` +
        `${languageName(law.authoritative)} text prevails: ${origin}${itemPath(item, law.authoritative)}.md`,
    );
  }
  const write = (clause: Clause, depth: number) => {
    if (clause.paragraphs.length) {
      lines.push("", `${"#".repeat(depth)} ${clause.key}`, "");
      clause.paragraphs.forEach((paragraph, index) =>
        lines.push(`${index === 0 && clause.label ? `${clause.label} ` : ""}${paragraph}`, ""),
      );
      lines.pop();
    }
    clause.points.forEach((point) => write(point, depth + 1));
  };
  text.clauses.forEach((clause) => write(clause, 2));
  lines.push("", `Page: ${origin}${itemPath(item, lang)}`);
  return `${lines.join("\n")}\n`;
};

/** A law as Markdown: its facts, and a link to every article and recital's own copy. */
export const lawMarkdown = (law: Law, origin: string) => {
  const lang = languagesOf(law).includes("en") ? "en" : law.authoritative;
  const lines = [
    `# ${law.short}: ${law.name}`,
    "",
    `The privacy law of the ${law.jurisdiction}, version ${law.version}, in force since ` +
      `${formatDate(law.effectiveDate)}. Text: ${textOf(law)}. Source: ${law.sourceUrl}`,
    "",
    `Reuse: ${law.license}`,
    "",
    `The pack archive: ${law.archive.url}`,
  ];
  for (const doc of law.docs) {
    lines.push("", `## ${doc.items[0]?.kind === "recital" ? "Recitals" : "Articles"}`, "");
    for (const item of doc.items) {
      const title = item.texts.get(lang)?.title;
      lines.push(
        `- [${itemName(item, lang)}${title ? `: ${title}` : ""}](${origin}${itemPath(item, lang)}.md)`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
};
