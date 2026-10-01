/**
 * Tekst-hygiejne til alt, hvad offentligheden eller en agent kan sende ind.
 * Princip: gem ren tekst. Al HTML fjernes ved indtag; hvor et felt senere
 * rendres som HTML (artikel-blok `paragraph`), erstattes det med escaped HTML.
 */

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(input: string) {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return " ";
      try { return String.fromCodePoint(code); } catch { return " "; }
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Fjern HTML-tags/kommentarer/script+style-indhold og kontroltegn. Bevarer linjeskift. */
export function stripHtml(input: string): string {
  let text = String(input ?? "");
  // Dekod først, så "&lt;script&gt;" ikke slipper igennem som tekst der senere dekodes til tags.
  text = decodeEntities(text);
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<(script|style|iframe|object|embed|template)\b[\s\S]*?<\/\1\s*>/gi, " ");
  text = text.replace(/<\/?[a-z!?][^>]*>?/gi, " ");
  // Eventuelle løse < eller > bliver stående som tegn; de escapes ved rendering.
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g, "");
  return text;
}

/** Ren tekst med længdeloft, trimmet og med sammenfaldne mellemrum. */
export function cleanText(input: unknown, max: number, options: { multiline?: boolean } = {}): string {
  if (typeof input !== "string") return "";
  let text = stripHtml(input).replace(/\r\n?/g, "\n");
  if (options.multiline) {
    text = text.split("\n").map((line) => line.replace(/[ \t]+/g, " ").trimEnd()).join("\n").replace(/\n{3,}/g, "\n\n");
  } else {
    text = text.replace(/\s+/g, " ");
  }
  return text.trim().slice(0, max);
}

export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Ren tekst -> escaped `<p>`-afsnit (til `paragraph`-blokken, som renderes som HTML). */
export function textToParagraphHtml(input: string): string {
  const paragraphs = cleanText(input, 100_000, { multiline: true })
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "";
  return paragraphs.map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`).join("");
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** URL til offentlig brug: kun http(s) eller lokal sti under /uploads|/media. */
export function isSafePublicUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.startsWith("/uploads/") || value.startsWith("/media/")) return !value.includes("..");
  return isHttpUrl(value);
}

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid|igshid|ref|ref_src|_ga)$/i;

/** Normaliser en kilde-URL til dedupe: lowercase vært, uden fragment/tracking-parametre/afsluttende slash, sorterede parametre. */
export function normalizeUrl(value: string): string | null {
  if (!isHttpUrl(value)) return null;
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  const kept = [...url.searchParams.entries()].filter(([key]) => !TRACKING_PARAMS.test(key)).sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [key, val] of kept) url.searchParams.append(key, val);
  let path = url.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  url.pathname = path;
  // http og https behandles som samme ressource.
  const protocol = "https:";
  return `${protocol}//${url.host}${url.pathname}${url.search}`;
}

/** Sikkert filnavn til visning/lagring (aldrig til filsystemstien — den er et uuid). */
export function safeFilename(input: string | null | undefined, fallback = "fil"): string {
  const base = String(input ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001F\u007F"<>:|?*\\]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

/** CSV-celle med citering og beskyttelse mod formel-injektion (=, +, -, @, tab, CR). */
export function csvCell(value: string | number | boolean | Date | null | undefined): string {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "");
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
