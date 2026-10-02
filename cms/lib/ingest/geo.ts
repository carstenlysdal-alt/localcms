import { db } from "../db";
import { slugify } from "../slug";
import type { IngestGeo } from "./schema";

/**
 * Postnummer -> GeoTag-slug pr. instans (domæne). Kilde: docs/review/T8-kildematrix.md afsnit 3 (kun GeoTags der FINDES i
 * seed; kommunetilhør er ikke verificeret mod officielt register). Et postnummer må kun optræde ét sted pr. instans;
 * tests/ingest-geo.test.ts verificerer at alle slugs findes i seed-data. Udvid tabellen, når nye GeoTags oprettes.
 */
export const POSTNR_TABLE: Record<string, Record<string, string>> = {
  "slagelselokalt.dk": {
    "4200": "slagelse-by", "4201": "slagelse-by", "4202": "slagelse-by",
    "4220": "korsoer", "4221": "korsoer", "4222": "korsoer",
    "4230": "skaelskoer", "4231": "skaelskoer",
    "4261": "dalmose", "4241": "vemmelev", "4242": "boeslunde", "4244": "agersoe", "4245": "omoe",
  },
  "naestvedlokalt.dk": {
    "4700": "naestved-by", "4736": "karrebaeksminde", "4250": "fuglebjerg", "4171": "glumsoe",
    "4685": "fensmark", "4684": "holme-olstrup", "4742": "mogenstrup", "4733": "tappernoeje",
  },
  "holbaeklokalt.dk": {
    "4300": "holbaek-by", "4450": "jyderup", "4340": "toelloese", "4520": "svinninge",
    "4390": "vipperoed", "4420": "regstrup", "4440": "moerkoev", "4305": "oroe",
  },
  "koegelokalt.dk": {
    "4600": "koege-by", "4681": "herfoelge", "4686": "herfoelge", "4140": "borup", "4141": "borup",
    "4632": "bjaeverskov", "4633": "bjaeverskov",
  },
  "roskildelokalt.dk": {
    "4000": "roskilde-by", "4040": "jyllinge", "4041": "jyllinge", "4130": "viby-sjaelland", "4131": "viby-sjaelland",
    "4015": "svogerslev", "4025": "vindinge", "4621": "gadstrup",
  },
  "ringstedlokalt.dk": {
    "4100": "ringsted-by", "4102": "benloese", "4174": "jystrup", "4150": "kvaerkeby",
  },
};

/** Generiske tillægsord der ikke adskiller et område fra dets by ("Næstved By", "Næstved Kommune", "Næstved"). */
const GENERIC_TOKENS = new Set(["by", "bys", "kommune", "kommunen", "sogn", "bymidte", "centrum"]);

/** Normaliseret nøgle: translittereret, små bogstaver, uden generiske tillægsord ("Næstved Kommune" -> "naestved"). */
export function geoKey(value: string): string {
  const tokens = slugify(value).split("-").filter(Boolean);
  const kept = tokens.filter((t) => !GENERIC_TOKENS.has(t));
  return (kept.length ? kept : tokens).join("-");
}

export type GeoTagRef = { id: string; navn: string; slug: string };
export type GeoResolution = { omraadeId: string | null; omraadeTekst: string | null; via?: "slug" | "navn" | "normaliseret" | "postnr" };

/**
 * Ren opløsning (testbar). Rækkefølge pr. kandidat: 1) præcis slug, 2) præcist navn (translittereret),
 * 3) normaliseret navn uden "By"/"Kommune" (kun hvis entydigt), og til sidst 4) postnummer via instansens tabel
 * (og som sidste udvej et GeoTag hvis slug er selve postnummeret).
 */
export function matchGeo(tags: readonly GeoTagRef[], geo: IngestGeo | undefined, instanceDomain: string | null): GeoResolution {
  if (!geo) return { omraadeId: null, omraadeTekst: null };
  const candidates = (typeof geo === "string" ? [geo] : [geo.omraade, geo.by, geo.kommune]).filter((v): v is string => Boolean(v?.trim()));
  const postnr = typeof geo === "string" ? (/^\d{4}$/.test(geo.trim()) ? geo.trim() : undefined) : geo.postnr;

  for (const candidate of candidates) {
    const slug = slugify(candidate);
    const bySlug = tags.find((t) => t.slug === candidate.trim().toLowerCase()) ?? tags.find((t) => t.slug === slug);
    if (bySlug) return { omraadeId: bySlug.id, omraadeTekst: null, via: "slug" };
    const byName = tags.find((t) => t.navn.toLowerCase() === candidate.trim().toLowerCase() || slugify(t.navn) === slug);
    if (byName) return { omraadeId: byName.id, omraadeTekst: null, via: "navn" };
    const key = geoKey(candidate);
    if (key) {
      const hits = tags.filter((t) => geoKey(t.navn) === key || geoKey(t.slug) === key);
      if (hits.length === 1) return { omraadeId: hits[0].id, omraadeTekst: null, via: "normaliseret" };
    }
  }

  if (postnr) {
    const slugFromTable = instanceDomain ? POSTNR_TABLE[instanceDomain.replace(/^www\./, "").toLowerCase()]?.[postnr] : undefined;
    const hit = (slugFromTable ? tags.find((t) => t.slug === slugFromTable) : undefined) ?? tags.find((t) => t.slug === postnr);
    if (hit) return { omraadeId: hit.id, omraadeTekst: null, via: "postnr" };
  }

  const hint = [...candidates, postnr].filter(Boolean).join(" / ");
  return { omraadeId: null, omraadeTekst: hint ? hint.slice(0, 200) : null };
}

/** Slå en geo-angivelse op i instansens GeoTags. Aldrig på tværs af instanser. */
export async function resolveGeo(instansId: string, geo: IngestGeo | undefined): Promise<GeoResolution> {
  if (!geo) return { omraadeId: null, omraadeTekst: null };
  const [tags, instance] = await Promise.all([
    db.geoTag.findMany({ where: { instansId }, select: { id: true, navn: true, slug: true } }),
    db.instance.findUnique({ where: { id: instansId }, select: { domaene: true } }),
  ]);
  return matchGeo(tags, geo, instance?.domaene ?? null);
}

/** Opløs en liste af områdenavne/-slugs (artikelkladders `omraader`) til GeoTag-id'er i instansen. */
export async function resolveGeoIds(instansId: string, wanted: readonly string[]): Promise<string[]> {
  const [tags, instance] = await Promise.all([
    db.geoTag.findMany({ where: { instansId }, select: { id: true, navn: true, slug: true } }),
    db.instance.findUnique({ where: { id: instansId }, select: { domaene: true } }),
  ]);
  const ids = new Set<string>();
  for (const w of wanted) {
    const hit = matchGeo(tags, w, instance?.domaene ?? null);
    if (hit.omraadeId) ids.add(hit.omraadeId);
  }
  return [...ids];
}
