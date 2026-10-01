// Fælles slug-hjælpere. Alle offentlige slugs er ren ASCII ([a-z0-9-]);
// danske tegn translittereres (æ→ae, ø→oe, å→aa) så URL'er aldrig skal percent-kodes.

const TRANSLITERATION: Record<string, string> = {
  æ: "ae",
  ø: "oe",
  å: "aa",
  Æ: "ae",
  Ø: "oe",
  Å: "aa",
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  é: "e",
  è: "e",
};

/** Translittererer danske (og enkelte europæiske) tegn til ASCII uden at ændre øvrige tegn. */
export function transliterateDa(input: string): string {
  return input.replace(/[æøåÆØÅäöüßéè]/g, (ch) => TRANSLITERATION[ch] ?? ch);
}

/** Laver en URL-sikker slug: små bogstaver, tal og enkelte bindestreger. */
export function slugify(text: string, maxLength = 80): string {
  const base = transliterateDa(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, maxLength).replace(/-+$/g, "");
}

/** Sand hvis slug allerede er ren ASCII-slug. */
export function isAsciiSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Normaliserer en URL-sti til ASCII-slugs. Bruges til at 301-omdirigere
 * ældre URL'er med rå/percent-kodede æ/ø/å (fx /nyheder/døgnrapport-…)
 * til den nuværende ASCII-sti. Returnerer null hvis stien allerede er ren.
 */
export function legacyPathToAscii(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (!/[æøåÆØÅ]/.test(decoded)) return null;
  const fixed = decoded
    .split("/")
    .map((seg) => (/[æøåÆØÅ]/.test(seg) ? transliterateDa(seg).toLowerCase() : seg))
    .join("/");
  return fixed === decoded ? null : fixed;
}

/** Normaliserer søgetekst: små bogstaver, æ/ø/å → ae/oe/aa, diakritik fjernet. */
export function foldSearchText(text: string): string {
  return transliterateDa(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Giver alle rimelige varianter af et søgeord så "byraad" finder "byråd" og omvendt:
 * originalen, ae/oe/aa-formen og æ/ø/å-formen.
 */
export function searchVariants(term: string): string[] {
  const t = term.trim();
  if (!t) return [];
  const lower = t.toLowerCase();
  const ascii = foldSearchText(t);
  const danish = ascii.replace(/ae/g, "æ").replace(/oe/g, "ø").replace(/aa/g, "å");
  const variants = new Set<string>([t, lower, ascii, danish]);
  // Delvise varianter (kun én af æ/ø/å-parrene) for blandede ord
  for (const [from, to] of [["aa", "å"], ["oe", "ø"], ["ae", "æ"]] as const) {
    if (ascii.includes(from)) variants.add(ascii.replace(new RegExp(from, "g"), to));
    if (lower.includes(to)) variants.add(lower.replace(new RegExp(to, "g"), from));
  }
  return Array.from(variants).filter(Boolean);
}
