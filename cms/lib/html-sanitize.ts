/**
 * Minimal allowlist-sanitizer til redaktørskrevet HTML (manchet, afsnit, faktabokse …).
 * Ingen eksterne afhængigheder. Princip: kun kendte tags og attributter slipper
 * igennem, farlige tags fjernes MED indhold, URL'er skal have et tilladt skema,
 * og alt andet escapes. Output er sikkert at sætte i dangerouslySetInnerHTML.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup",
  "a", "ul", "ol", "li", "blockquote", "h2", "h3", "h4", "span", "hr", "time", "abbr", "cite", "q",
]);

const VOID_TAGS = new Set(["br", "hr"]);

/** Fjernes inklusive indhold. */
const DROP_WITH_CONTENT = /<\s*(script|style|iframe|frame|frameset|object|embed|noscript|template|svg|math|form|textarea|select|option|button|title|head|link|meta|base|applet)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DROP_OPENERS = /<\s*\/?\s*(script|style|iframe|frame|frameset|object|embed|noscript|template|svg|math|form|textarea|select|option|button|title|head|link|meta|base|applet)\b[^>]*>?/gi;

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export type SanitizeOptions = {
  /** Ekstra rel-tokens på eksterne links, fx ["sponsored"] eller ["ugc"]. */
  linkRel?: string[];
};

/** Navngivne entiteter vi dekoder (alle kræver afsluttende ;). Resten bevares som tekst. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  colon: ":", tab: "\t", newline: "\n", lpar: "(", rpar: ")", sol: "/", bsol: "\\", period: ".", semi: ";", num: "#",
};

/**
 * Dekoder EN gang, præcis som en browser dekoder en attributværdi (numeriske entiteter må mangle ;,
 * navngivne kræver den). Ét regex-gennemløb, så `&#38;amp;` giver `&amp;` og ikke `&`.
 */
function decodeOnce(v: string): string {
  return v.replace(/&(?:#x([0-9a-f]+);?|#(\d+);?|([a-z][a-z0-9]*);)/gi, (whole, hex: string | undefined, dec: string | undefined, name: string | undefined) => {
    if (hex !== undefined || dec !== undefined) {
      const n = hex !== undefined ? parseInt(hex, 16) : parseInt(dec as string, 10);
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "\ufffd";
    }
    const hit = NAMED_ENTITIES[(name as string).toLowerCase()];
    return hit === undefined ? whole : hit;
  });
}

/** Dekoder til fikspunkt (maks. 6 gennemløb) — bruges KUN til skematjekket, aldrig til output. */
function decodeToFixpoint(v: string): string {
  let cur = v;
  for (let i = 0; i < 6; i++) {
    const next = decodeOnce(cur);
    if (next === cur) return cur;
    cur = next;
  }
  return cur;
}

/** Fjerner tegn en browser ignorerer i/omkring et skema (C0/C1-kontroltegn, mellemrum, usynlige tegn). */
function compactForScheme(v: string): string {
  return v.replace(/[\u0000-\u0020\u007f-\u009f\u00ad\u200b-\u200f\u2028\u2029\u2060\ufeff]+/g, "");
}

const ALLOWED_SCHEME = /^(https?:|mailto:|tel:)/i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Returnerer en sikker href (dekodet EN gang, klar til escAttr) eller null. Tillader http(s), mailto, tel,
 * relative stier og #anker. Skemaet tjekkes på både den enkeltdekodede og den fuldt (fikspunkt-)dekodede værdi,
 * så `java&amp;#115;cript:`, `&amp;colon;` og lignende dobbeltkodninger afvises.
 */
export function safeHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const decoded = decodeOnce(raw);
  for (const candidate of [decoded, decodeToFixpoint(raw)]) {
    const compact = compactForScheme(candidate);
    if (!compact) return null;
    if (ALLOWED_SCHEME.test(compact)) continue;
    if (ANY_SCHEME.test(compact)) return null; // javascript:, data:, vbscript: …
    if (compact.startsWith("//") || compact.startsWith("\\")) return null;
  }
  const result = decoded.trim();
  return result ? result : null;
}

/** Escaper en allerede dekodet værdi til en dobbeltciteret attribut. ALLE & escapes, så browseren ikke dekoder igen. */
function escAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escText(v: string): string {
  // Stray "<" der ikke blev til et tag. Entiteter bevares.
  return v.replace(/</g, "&lt;");
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function sanitizeHtml(input: string | null | undefined, options: SanitizeOptions = {}): string {
  if (!input) return "";
  let html = String(input);

  html = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  // Gentag så indlejrede forsøg (<scr<script>ipt>) også fjernes.
  for (let i = 0; i < 3; i++) {
    const before = html;
    html = html.replace(DROP_WITH_CONTENT, "");
    if (html === before) break;
  }
  html = html.replace(DROP_OPENERS, "");

  const out: string[] = [];
  const stack: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;

  while ((m = TAG_RE.exec(html))) {
    out.push(escText(html.slice(last, m.index)));
    last = m.index + m[0].length;
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;

    if (closing) {
      const idx = stack.lastIndexOf(tag);
      if (idx === -1) continue;
      while (stack.length > idx) out.push(`</${stack.pop()}>`);
      continue;
    }

    const attrs: string[] = [];
    let href: string | null = null;
    if (tag === "a" || tag === "time" || tag === "abbr" || tag === "q" || tag === "blockquote") {
      ATTR_RE.lastIndex = 0;
      let a: RegExpExecArray | null;
      while ((a = ATTR_RE.exec(m[3]))) {
        const name = a[1].toLowerCase();
        const value = a[2] ?? a[3] ?? a[4] ?? "";
        if (tag === "a" && name === "href") {
          href = safeHref(value);
        } else if (tag === "a" && name === "title") {
          attrs.push(`title="${escAttr(decodeOnce(value))}"`);
        } else if (tag === "time" && name === "datetime") {
          if (/^[0-9T:+\-.Z ]{4,40}$/.test(value)) attrs.push(`datetime="${escAttr(value)}"`);
        } else if ((tag === "abbr" && name === "title") || (tag === "q" && name === "cite") || (tag === "blockquote" && name === "cite")) {
          if (name === "cite") {
            const c = safeHref(value);
            if (c) attrs.push(`cite="${escAttr(c)}"`);
          } else attrs.push(`title="${escAttr(decodeOnce(value))}"`);
        }
      }
    }
    if (tag === "a") {
      if (href !== null) {
        attrs.unshift(`href="${escAttr(href)}"`);
        if (isExternal(href)) {
          const rel = new Set(["noopener", "noreferrer", ...(options.linkRel ?? [])]);
          attrs.push(`rel="${[...rel].join(" ")}"`);
        }
      }
    }

    out.push(`<${tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`);
    if (!VOID_TAGS.has(tag)) stack.push(tag);
  }
  out.push(escText(html.slice(last)));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join("");
}
