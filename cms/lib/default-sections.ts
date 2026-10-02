/**
 * Standardstruktur for sektioner (ejerens ønske, okt. 2026): få topsektioner — Nyheder, Politik, Erhverv, 112 og Kultur.
 * Alle øvrige emner (trafik, skole, sundhed, bolig, natur, sport, foreningsliv, debat) ligger som undersektioner under Nyheder.
 * Højst to niveauer (se `validateCategoryNesting`). Strukturen er DATA: den bruges af `npm run sections:sync` og kan bruges af
 * AI-operatøren/seed — den hardcodes aldrig i navigationen (siden læser kategoritræet fra databasen).
 *
 * AI-spærring: "112" og "Sundhed" følger reglen i lib/marking.ts (AI_RESTRICTED_SLUGS).
 */
export type DefaultSection = {
  navn: string;
  slug: string;
  beskrivelse: string;
  sortering: number;
  children: Array<{ navn: string; slug: string; beskrivelse?: string; sortering: number }>;
};

export const DEFAULT_SECTIONS: readonly DefaultSection[] = [
  {
    navn: "Nyheder",
    slug: "nyheder",
    beskrivelse: "Nyheder fra hele kommunen",
    sortering: 1,
    children: [
      { navn: "Trafik", slug: "trafik", sortering: 1 },
      { navn: "Skole og børn", slug: "skole-og-boern", sortering: 2 },
      { navn: "Sundhed", slug: "sundhed", sortering: 3 },
      { navn: "Bolig og byggeri", slug: "bolig-og-byggeri", sortering: 4 },
      { navn: "Natur og klima", slug: "natur-og-klima", sortering: 5 },
      { navn: "Sport", slug: "sport", sortering: 6 },
      { navn: "Foreningsliv", slug: "foreningsliv", sortering: 7 },
      { navn: "Debat", slug: "debat", sortering: 8 },
    ],
  },
  {
    navn: "Politik",
    slug: "politik",
    beskrivelse: "Byråd, udvalg og lokalpolitik",
    sortering: 2,
    children: [
      { navn: "Byråd og udvalg", slug: "byraad-og-udvalg", sortering: 1 },
      { navn: "Planer og høringer", slug: "planer-og-hoeringer", sortering: 2 },
      { navn: "Økonomi og budget", slug: "oekonomi-og-budget", sortering: 3 },
    ],
  },
  {
    navn: "Erhverv",
    slug: "erhverv",
    beskrivelse: "Handel, erhvervsliv og arbejdsmarked",
    sortering: 3,
    children: [
      { navn: "Handel", slug: "handel", sortering: 1 },
      { navn: "Job og arbejdsmarked", slug: "job-og-arbejdsmarked", sortering: 2 },
      { navn: "Iværksættere", slug: "ivaerksaettere", sortering: 3 },
      { navn: "Landbrug", slug: "landbrug", sortering: 4 },
      { navn: "Byggeri og ejendomme", slug: "byggeri-og-ejendomme", sortering: 5 },
    ],
  },
  {
    navn: "112",
    slug: "112",
    beskrivelse: "Politi, brand og redning, ulykker og retsvæsen",
    sortering: 4,
    children: [
      { navn: "Politi", slug: "politi", sortering: 1 },
      { navn: "Brand og redning", slug: "brand-og-redning", sortering: 2 },
      { navn: "Ulykker", slug: "ulykker", sortering: 3 },
      { navn: "Retsvæsen", slug: "retsvaesen", sortering: 4 },
    ],
  },
  {
    navn: "Kultur",
    slug: "kultur",
    beskrivelse: "Kultur, musik og oplevelser",
    sortering: 5,
    children: [
      { navn: "Musik", slug: "musik", sortering: 1 },
      { navn: "Scene og film", slug: "scene-og-film", sortering: 2 },
      { navn: "Kunst og museer", slug: "kunst-og-museer", sortering: 3 },
      { navn: "Mad og drikke", slug: "mad-og-drikke", sortering: 4 },
    ],
  },
];
