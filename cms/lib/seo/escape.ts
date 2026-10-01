/**
 * Fælles escape-/tekst-hjælpere til SEO-lag (JSON-LD, XML, meta).
 * Ingen afhængigheder, så de kan testes med node --test.
 */

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

/** Fjerner undefined/null/""/tomme arrays og objekter rekursivt (false og 0 bevares). */
export function pruneEmpty<T>(value: T): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    return (value.trim() === "" ? undefined : value) as T | undefined;
  }
  if (Array.isArray(value)) {
    const arr = value.map((v) => pruneEmpty(v)).filter((v) => v !== undefined);
    return (arr.length === 0 ? undefined : arr) as unknown as T;
  }
  if (typeof value === "object") {
    if (value instanceof Date) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const p = pruneEmpty(v);
      if (p !== undefined) out[k] = p;
    }
    // Et objekt der kun består af @type (og evt. @context) er tomt.
    const keys = Object.keys(out).filter((k) => k !== "@type" && k !== "@context");
    return (keys.length === 0 ? undefined : out) as T | undefined;
  }
  return value;
}

/**
 * Serialiserer data til sikker brug i <script type="application/ld+json">.
 * `<` escapes (forhindrer </script>- og <!-- -breakout), samt U+2028/2029.
 * Tomme værdier fjernes, så der aldrig udsendes "" i schema.
 */
export function safeJsonLd(data: unknown): string {
  const pruned = pruneEmpty(data) ?? {};
  return JSON.stringify(pruned)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .split(LS)
    .join("\\u2028")
    .split(PS)
    .join("\\u2029");
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    });
}

/**
 * Fjerner HTML (også entity-escapet HTML som `&lt;p&gt;`) og samler whitespace.
 * Bruges til meta description, JSON-LD description og RSS description.
 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  let text = String(input);
  // Entity-escapet markup: afkod én gang så tags kan fjernes.
  if (/&lt;\/?[a-z][^&]*&gt;/i.test(text)) text = decodeEntities(text);
  text = text
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, " ")
    .replace(/<[^>]*>/g, "");
  text = decodeEntities(text);
  return text.replace(/\s+/g, " ").trim();
}

/** Afkorter ved ordgrænse og tilføjer "…" hvis noget blev klippet. */
export function truncateAtWord(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,.;:–—-]+$/, "")}…`;
}

/** Meta description: ren tekst, ≤155 tegn. */
export function metaDescription(input: string | null | undefined, fallback = "", max = 155): string {
  const clean = stripHtml(input) || stripHtml(fallback);
  return truncateAtWord(clean, max);
}

/** Title før suffix: ≤60 tegn, ordgrænse. */
export function fitTitle(title: string, max = 60): string {
  return truncateAtWord(stripHtml(title), max);
}

/** XML-escape til tekstnoder og attributter (RSS/sitemap). */
export function escapeXml(input: string | number | null | undefined): string {
  return String(input ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** CDATA der tåler "]]>" i indholdet. */
export function cdata(input: string | null | undefined): string {
  const text = String(input ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return `<![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}
