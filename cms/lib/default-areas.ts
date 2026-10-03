/**
 * Standardområder (GeoTag) pr. by: delområderne fra prisma/network-seed-data.ts (og Slagelses fra prisma/seed.ts) plus de små byer og
 * lokale stednavne fra kilderegistrene (docs/localrating/source-registries/*.md: Næstved og Slagelse).
 *
 * Koordinater: KUN hvor de allerede står i seed-dataene. Alt andet er `null` — der opfindes aldrig koordinater (GeoTag.lat/lng er valgfrie).
 * Slugs er ren ASCII (æ->ae, ø->oe, å->aa) og unikke pr. by. Brug lib/default-areas-sync.ts til at oprette dem (idempotent, ikke-destruktivt).
 */
import { NETWORK_SITES } from "../prisma/network-seed-data";
import { ALL_NETWORK_SITES } from "./network-sites";

export type DefaultArea = { navn: string; slug: string; lat: number | null; lng: number | null };

const withCoords = (navn: string, slug: string, lat: number, lng: number): DefaultArea => ({ navn, slug, lat, lng });
const noCoords = (navn: string, slug: string): DefaultArea => ({ navn, slug, lat: null, lng: null });

/** Slagelses delområder er kopieret uændret fra `areas` i prisma/seed.ts (en test holder dem synkrone med seed-databasen). */
const SLAGELSE_SEED_AREAS: DefaultArea[] = [
  withCoords("Slagelse By", "slagelse-by", 55.4038, 11.3544),
  withCoords("Korsør", "korsoer", 55.3292, 11.1378),
  withCoords("Skælskør", "skaelskoer", 55.2536, 11.2947),
  withCoords("Dalmose", "dalmose", 55.2936, 11.4192),
  withCoords("Vemmelev", "vemmelev", 55.3528, 11.2361),
  withCoords("Boeslunde", "boeslunde", 55.3022, 11.2783),
  withCoords("Agersø", "agersoe", 55.2158, 11.1969),
  withCoords("Omø", "omoe", 55.1583, 11.1611),
];

/** Lokale aliaser/steder fra kilderegistrene uden koordinater i seed-dataene (lat/lng = null). */
const EXTRA_AREAS: Record<string, DefaultArea[]> = {
  "slagelselokalt.dk": [noCoords("Antvorskov", "antvorskov"), noCoords("Halsskov", "halsskov"), noCoords("Stigsnæs", "stigsnaes")],
  "naestvedlokalt.dk": [
    noCoords("Herlufmagle", "herlufmagle"),
    noCoords("Sandved", "sandved"),
    noCoords("Toksværd", "toksvaerd"),
    noCoords("Enø", "enoe"),
    noCoords("Suså", "susaa"),
  ],
};

/** Standardområderne for et instans-domæne (tom liste for ukendte domæner, fx testinstanser). */
export function defaultAreasFor(domaene: string): DefaultArea[] {
  const domain = domaene.trim().toLowerCase();
  const base: DefaultArea[] =
    domain === "slagelselokalt.dk"
      ? SLAGELSE_SEED_AREAS
      : (NETWORK_SITES.find((s) => s.domaene === domain)?.areas ?? []).map((a) => withCoords(a.navn, a.slug, a.lat, a.lng));
  return [...base, ...(EXTRA_AREAS[domain] ?? [])];
}

/** Alle seks byer -> deres standardområder (til tests og dokumentation). */
export function allDefaultAreas(): Record<string, DefaultArea[]> {
  return Object.fromEntries(ALL_NETWORK_SITES.map((s) => [s.domaene, defaultAreasFor(s.domaene)]));
}
