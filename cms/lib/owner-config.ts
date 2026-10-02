/**
 * Ejer-afhængige udsagn samlet ét sted (T6 nr. 30-31). Intet her må gættes eller opfindes i koden: juridiske formuleringer
 * (Pressenævnet), navngiven ansvarshavende redaktør og privatlivssidens felter skal bekræftes af ejeren. Er en værdi ikke
 * konfigureret, udelades udsagnet (neutral tekst) i stedet for at vise en pladsholder eller en uverificeret påstand.
 *
 * Kilder (højeste prioritet først), pr. by:
 *   1. env `OWNER_CONFIG` — JSON keyed på domæne (eller "*" for alle byer):
 *        {"*":{"pressenaevnetTilmeldt":true},
 *         "naestvedlokalt.dk":{"ansvarshavendeRedaktoer":"Navn Navnesen",
 *           "privatliv":{"dataansvarlig":"CVR 12345678, Gade 1, 4700 Næstved","gennemgaaetDato":"1. november 2026","godkendt":true}}}
 *   2. `Instance.sideTekster.ejer` (samme felter) — redigerbart i databasen.
 */

export type OwnerPrivacyConfig = {
  /** CVR-nr. og postadresse på dataansvarlig. */
  dataansvarlig?: string;
  /** Fx "efter 24 måneder uden aktivitet". */
  nyhedsbrevOpbevaring?: string;
  /** Fx "efter 12 måneder". */
  indsendelserSletning?: string;
  /** Teknisk afgrænsning af den anonyme måling. */
  maalingAfgraensning?: string;
  /** Leverandører og databehandleraftaler. */
  leverandoerer?: string;
  /** Mediets tilknytning til Pressenævnet (ved klager). */
  pressenaevnTilknytning?: string;
  gennemgaaetDato?: string;
  /** Ejeren har godkendt privatlivssiden (først da indekseres den og "udkast"-noten forsvinder). */
  godkendt: boolean;
};

export type OwnerConfig = {
  ansvarshavendeRedaktoer?: string;
  /** Må siden påstå, at mediet er tilmeldt Pressenævnet? Kun når ejeren udtrykkeligt har sat true. */
  pressenaevnetTilmeldt: boolean;
  privatliv: OwnerPrivacyConfig;
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const text = (v: unknown, max = 300): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

function fromEnv(env: NodeJS.ProcessEnv, domain: string): Json {
  const raw = env.OWNER_CONFIG;
  if (!raw) return {};
  try {
    const all = obj(JSON.parse(raw));
    return { ...obj(all["*"]), ...obj(all[domain.replace(/^www\./, "").toLowerCase()]) };
  } catch {
    return {};
  }
}

function merge(a: Json, b: Json): Json {
  return { ...a, ...b, privatliv: { ...obj(a.privatliv), ...obj(b.privatliv) } };
}

export function resolveOwnerConfig(site: { domaene: string; sideTekster?: unknown }, env: NodeJS.ProcessEnv = process.env): OwnerConfig {
  const merged = merge(obj(obj(site.sideTekster).ejer), fromEnv(env, site.domaene));
  const p = obj(merged.privatliv);
  return {
    ansvarshavendeRedaktoer: text(merged.ansvarshavendeRedaktoer, 120),
    pressenaevnetTilmeldt: merged.pressenaevnetTilmeldt === true,
    privatliv: {
      dataansvarlig: text(p.dataansvarlig),
      nyhedsbrevOpbevaring: text(p.nyhedsbrevOpbevaring),
      indsendelserSletning: text(p.indsendelserSletning),
      maalingAfgraensning: text(p.maalingAfgraensning),
      leverandoerer: text(p.leverandoerer),
      pressenaevnTilknytning: text(p.pressenaevnTilknytning),
      gennemgaaetDato: text(p.gennemgaaetDato, 80),
      godkendt: p.godkendt === true,
    },
  };
}
