import type { OfferInput } from "./jsonld";

/**
 * Priser til OfferCatalog på /priser. SKAL holdes i sync med app/(site)/priser/page.tsx
 * (priserne er endnu hårdkodet dér). Alle priser ex. moms, DKK.
 */
export const PRISER_OFFERS: OfferInput[] = [
  { name: "Event i kalenderen", price: 125, service: "Kalenderannonce", description: "Pris pr. arrangement." },
  {
    name: "Sponsoreret artikel inkl. Facebook-distribution",
    price: 4995,
    service: "Sponsoreret artikel",
    description: "Journalistisk interview, fotoserie, placering på forsiden og deling på mediets Facebook-side.",
  },
  { name: "Profil i Lokalguiden", price: 249, perMonth: true, service: "Profil i Lokalguiden", description: "Pris pr. måned." },
  { name: "Partnerpakke 1: Naboskab", price: 795, perMonth: true, service: "Partnerskab Naboskab", description: "Pris pr. måned." },
  { name: "Partnerpakke 2: Fællesskab", price: 1995, perMonth: true, service: "Partnerskab Fællesskab", description: "Pris pr. måned." },
  { name: "Partnerpakke 3: Fyrtårn", price: 4495, perMonth: true, service: "Partnerskab Fyrtårn", description: "Pris pr. måned." },
];
