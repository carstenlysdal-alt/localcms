import { MODULE_TYPE_IDS, type ModuleTypeId, type Variant } from "./types";

/**
 * Modulregister (T11/T12). Ét modul = en type med slots, tilladte indholdstyper, layout-varianter og regler.
 * Rent og serialiserbart: UI, validering (layout-schema.ts), ranker og guardrails læser alle herfra.
 *
 * kind:
 *  - "artikel":  slots fyldes af komponeringen (compose.ts) med artikler.
 *  - "dynamisk": slots hentes af rendereren fra en anden kilde (AdCampaign, Signal, kalender, opslagstavle, egen-promo).
 *                Komponeringen rører dem ikke; de er stadig placerbare/flytbare i layoutet og altid mærkede.
 */

export type ModuleKind = "artikel" | "dynamisk";
export type DynamicSource = "AdCampaign" | "Signal" | "Kalender" | "Opslagstavle" | "EgenPromo";

export interface ModuleDef {
  id: ModuleTypeId;
  label: string;
  beskrivelse: string;
  kind: ModuleKind;
  dataSource?: DynamicSource;
  slots: { min: number; max: number; default: number };
  /** Hvad en redaktør må placere manuelt (pin). */
  allowedContentTypes: readonly string[];
  /** Hvad ranker/AI automatisk må placere. Altid en delmængde af allowedContentTypes. */
  autoContentTypes: readonly string[];
  variants: readonly Variant[];
  defaultVariant: Variant;
  /** Topzone = hero + top-grid: diversitet (1 pr. emne) og skærpet kvoteloft gælder her. */
  topZone: boolean;
  /** Break-moduler kan indsættes inline i et værtsmodul efter slot N (config.breaks på værten). */
  isBreak: boolean;
  /** Kan være vært for inline-breaks. */
  breakHost: boolean;
  order: "score" | "kronologisk";
  /** Kun breaking-artikler (breaking-bar). */
  breakingOnly: boolean;
  /** Standard-friskhedsgrænse i timer (config.maxAgeHours overstyrer). */
  maxAgeHours: number;
  /** Tilladte config-nøgler (alt andet afvises af layout-schema). */
  allowedConfigKeys: readonly string[];
  /** Maks antal instanser i ét layout. */
  maxInstances: number;
  /** Fast tekst til mærkning af dynamiske moduler (artikelmoduler mærkes pr. artikel). */
  fastMaerkning?: string;
  /** Menneskelæselige render-regler (spec + UI-hjælpetekst). */
  renderRules: readonly string[];
}

const EDITORIAL_AUTO = ["Uafhængig", "Brugerindsendt", "AI-assisteret", "PR"] as const;
const EDITORIAL_ALL = ["Uafhængig", "Brugerindsendt", "AI-assisteret", "PR", "Partner", "Sponsoreret"] as const;
const TOP_ALLOWED = ["Uafhængig", "Brugerindsendt", "AI-assisteret", "Partner", "Sponsoreret", "PR"] as const;

export const MODULE_REGISTRY: Record<ModuleTypeId, ModuleDef> = {
  hero: {
    id: "hero",
    label: "Hero (tophistorie)",
    beskrivelse: "Dagens vigtigste historie, stort format. Ét slot.",
    kind: "artikel",
    slots: { min: 1, max: 1, default: 1 },
    allowedContentTypes: TOP_ALLOWED,
    autoContentTypes: ["Uafhængig", "Brugerindsendt"],
    variants: ["hero"],
    defaultVariant: "hero",
    topZone: true,
    isBreak: false,
    breakHost: false,
    order: "score",
    breakingOnly: false,
    maxAgeHours: 72,
    allowedConfigKeys: ["maxAgeHours", "titel", "sektionSlug", "omraadeSlug"],
    maxInstances: 1,
    renderRules: [
      "Mærkning vises altid over titlen.",
      "AI-assisteret indhold placeres aldrig automatisk her (kun manuelt af redaktør) og aldrig i Krimi/Sundhed.",
      "Kommercielt indhold kun som redaktør-pin og kun hvis kvoteloftet tillader det.",
    ],
  },
  "top-grid": {
    id: "top-grid",
    label: "Top-grid",
    beskrivelse: "Rækken af næststørste historier under heroen. Typisk 3 slots.",
    kind: "artikel",
    slots: { min: 2, max: 6, default: 3 },
    allowedContentTypes: TOP_ALLOWED,
    autoContentTypes: ["Uafhængig", "Brugerindsendt"],
    variants: ["kort", "kompakt"],
    defaultVariant: "kort",
    topZone: true,
    isBreak: false,
    breakHost: true,
    order: "score",
    breakingOnly: false,
    maxAgeHours: 72,
    allowedConfigKeys: ["maxAgeHours", "breaks", "titel", "sektionSlug", "omraadeSlug"],
    maxInstances: 2,
    renderRules: [
      "Højst én artikel pr. emne i topzonen (diversitet).",
      "Break-moduler kan indsættes efter slot N via config.breaks.",
      "Mærkning på alle kort.",
    ],
  },
  "breaking-bar": {
    id: "breaking-bar",
    label: "Breaking-bjælke",
    beskrivelse: "Tekstlinje(r) øverst med breaking-historier. Skjules helt når der intet er.",
    kind: "artikel",
    slots: { min: 1, max: 3, default: 1 },
    allowedContentTypes: ["Uafhængig"],
    autoContentTypes: ["Uafhængig"],
    variants: ["tekstlinje"],
    defaultVariant: "tekstlinje",
    topZone: false,
    isBreak: false,
    breakHost: false,
    order: "kronologisk",
    breakingOnly: true,
    maxAgeHours: 12,
    allowedConfigKeys: ["maxAgeHours", "titel"],
    maxInstances: 1,
    renderRules: [
      "Kun artikler markeret breaking og indholdstype Uafhængig.",
      "Må vise en artikel der også er hero (bjælken er en peger, ikke en ekstra placering).",
      "Skjules når ingen breaking er frisk.",
    ],
  },
  "seneste-nyt": {
    id: "seneste-nyt",
    label: "Seneste nyt",
    beskrivelse: "Kronologisk liste. Aldrig AI-rangeret — dette er forsidens fallback.",
    kind: "artikel",
    slots: { min: 3, max: 15, default: 8 },
    allowedContentTypes: EDITORIAL_ALL,
    autoContentTypes: EDITORIAL_AUTO,
    variants: ["liste", "tekstlinje"],
    defaultVariant: "liste",
    topZone: false,
    isBreak: false,
    breakHost: true,
    order: "kronologisk",
    breakingOnly: false,
    maxAgeHours: 168,
    allowedConfigKeys: ["maxAgeHours", "breaks", "titel", "sektionSlug"],
    maxInstances: 2,
    renderRules: [
      "Sorteret efter publiceringstid, nyeste først.",
      "Udelukker artikler der allerede er vist højere på forsiden.",
      "Annonce-break kan gentages hver N. slot (breaks[].repeatEvery).",
    ],
  },
  "dit-omraade": {
    id: "dit-omraade",
    label: "Dit område",
    beskrivelse: "Lokale historier for besøgendes valgte område (cookie-fri: valg i URL/lokal lagring).",
    kind: "artikel",
    slots: { min: 2, max: 6, default: 3 },
    allowedContentTypes: EDITORIAL_AUTO,
    autoContentTypes: EDITORIAL_AUTO,
    variants: ["kort", "kompakt", "liste"],
    defaultVariant: "kort",
    topZone: false,
    isBreak: false,
    breakHost: true,
    order: "score",
    breakingOnly: false,
    maxAgeHours: 120,
    allowedConfigKeys: ["maxAgeHours", "omraadeSlug", "titel", "breaks"],
    maxInstances: 1,
    renderRules: [
      "Kun artikler med geotag; config.omraadeSlug låser området, ellers filtrerer rendereren på besøgendes område.",
      "Uden match falder modulet tilbage til nyeste artikler med geotag.",
    ],
  },
  "sektion-rail": {
    id: "sektion-rail",
    label: "Sektion",
    beskrivelse: "Række for én sektion (fx Erhverv, Kultur, Sport).",
    kind: "artikel",
    slots: { min: 2, max: 6, default: 4 },
    allowedContentTypes: EDITORIAL_AUTO,
    autoContentTypes: EDITORIAL_AUTO,
    variants: ["kort", "kompakt", "liste"],
    defaultVariant: "kort",
    topZone: false,
    isBreak: false,
    breakHost: true,
    order: "score",
    breakingOnly: false,
    maxAgeHours: 168,
    allowedConfigKeys: ["maxAgeHours", "sektionSlug", "titel", "breaks"],
    maxInstances: 8,
    renderRules: ["config.sektionSlug skal angives for at rækken er meningsfuld; ellers vises blandet indhold."],
  },
  "partner-break": {
    id: "partner-break",
    label: "Partner-boks",
    beskrivelse: "Dedikeret, tydeligt mærket plads til partnerindhold.",
    kind: "artikel",
    slots: { min: 1, max: 2, default: 1 },
    allowedContentTypes: ["Partner"],
    autoContentTypes: ["Partner"],
    variants: ["kort", "kompakt"],
    defaultVariant: "kompakt",
    topZone: false,
    isBreak: true,
    breakHost: false,
    order: "score",
    breakingOnly: false,
    maxAgeHours: 336,
    allowedConfigKeys: ["maxAgeHours", "placement", "titel"],
    maxInstances: 3,
    renderRules: [
      "Altid mærket 'Partner' + sponsor; mærkningen kan ikke skjules.",
      "Tæller i kvoteloftet; tom (skjult) når loftet er nået.",
    ],
  },
  "sponsoreret-break": {
    id: "sponsoreret-break",
    label: "Sponsoreret boks",
    beskrivelse: "Dedikeret, tydeligt mærket plads til sponsoreret indhold.",
    kind: "artikel",
    slots: { min: 1, max: 2, default: 1 },
    allowedContentTypes: ["Sponsoreret"],
    autoContentTypes: ["Sponsoreret"],
    variants: ["kort", "kompakt"],
    defaultVariant: "kompakt",
    topZone: false,
    isBreak: true,
    breakHost: false,
    order: "score",
    breakingOnly: false,
    maxAgeHours: 336,
    allowedConfigKeys: ["maxAgeHours", "placement", "titel"],
    maxInstances: 3,
    renderRules: [
      "Altid mærket 'Sponsoreret' + sponsor; mærkningen kan ikke skjules.",
      "Tæller i kvoteloftet; tom (skjult) når loftet er nået.",
    ],
  },
  "ad-break": {
    id: "ad-break",
    label: "Annonce-break",
    beskrivelse: "Annoncekampagne (AdCampaign) indsat som break i en liste eller mellem moduler.",
    kind: "dynamisk",
    dataSource: "AdCampaign",
    slots: { min: 1, max: 1, default: 1 },
    allowedContentTypes: [],
    autoContentTypes: [],
    variants: ["kort", "kompakt", "tekstlinje"],
    defaultVariant: "kompakt",
    topZone: false,
    isBreak: true,
    breakHost: false,
    order: "score",
    breakingOnly: false,
    maxAgeHours: 0,
    allowedConfigKeys: ["adFormat", "placement", "titel"],
    maxInstances: 4,
    fastMaerkning: "Annonce",
    renderRules: [
      "Mærket 'Annonce' (fast tekst). Aktiv kampagne vælges af ad-motoren; ingen aktiv kampagne = modulet skjules.",
      "Impressions/klik registreres via /api/ads/track.",
    ],
  },
  "egen-promo": {
    id: "egen-promo",
    label: "Egen promo",
    beskrivelse: "Mediets egne opfordringer: støt, nyhedsbrev eller indsend et tip.",
    kind: "dynamisk",
    dataSource: "EgenPromo",
    slots: { min: 1, max: 1, default: 1 },
    allowedContentTypes: [],
    autoContentTypes: [],
    variants: ["kompakt", "tekstlinje"],
    defaultVariant: "kompakt",
    topZone: false,
    isBreak: true,
    breakHost: false,
    order: "score",
    breakingOnly: false,
    maxAgeHours: 0,
    allowedConfigKeys: ["promoKind", "placement", "titel"],
    maxInstances: 3,
    fastMaerkning: "Fra redaktionen",
    renderRules: ["Mærket 'Fra redaktionen'. promoKind: stoet | nyhedsbrev | indsend."],
  },
  "kalender-strip": {
    id: "kalender-strip",
    label: "Kalender-strip",
    beskrivelse: "Kommende begivenheder i området.",
    kind: "dynamisk",
    dataSource: "Kalender",
    slots: { min: 3, max: 8, default: 4 },
    allowedContentTypes: [],
    autoContentTypes: [],
    variants: ["kompakt", "liste"],
    defaultVariant: "kompakt",
    topZone: false,
    isBreak: false,
    breakHost: false,
    order: "kronologisk",
    breakingOnly: false,
    maxAgeHours: 0,
    allowedConfigKeys: ["omraadeSlug", "titel"],
    maxInstances: 1,
    fastMaerkning: "Kalender",
    renderRules: ["Begivenheder sorteret efter startdato. Brugerindsendte begivenheder mærkes 'Brugerindsendt'."],
  },
  "fra-kommunen": {
    id: "fra-kommunen",
    label: "Fra kommunen",
    beskrivelse: "Maskinindsamlede signaler fra kommunale kilder (dagsordener, pressemeddelelser).",
    kind: "dynamisk",
    dataSource: "Signal",
    slots: { min: 2, max: 6, default: 3 },
    allowedContentTypes: [],
    autoContentTypes: [],
    variants: ["liste", "tekstlinje"],
    defaultVariant: "liste",
    topZone: false,
    isBreak: false,
    breakHost: false,
    order: "kronologisk",
    breakingOnly: false,
    maxAgeHours: 0,
    allowedConfigKeys: ["sourceTypes", "omraadeSlug", "titel"],
    maxInstances: 1,
    fastMaerkning: "Maskinindsamlet – ikke redaktionelt vurderet",
    renderRules: [
      "Signaler er IKKE artikler: altid mærket 'Maskinindsamlet – ikke redaktionelt vurderet'; link til kilden.",
      "Kun signaler med maskinindsamlet=true og sourceType kommune_dagsorden | kommune_pressemeddelelse.",
    ],
  },
  "fra-politiet": {
    id: "fra-politiet",
    label: "Fra politiet",
    beskrivelse: "Maskinindsamlede signaler fra politi/beredskab.",
    kind: "dynamisk",
    dataSource: "Signal",
    slots: { min: 2, max: 5, default: 3 },
    allowedContentTypes: [],
    autoContentTypes: [],
    variants: ["liste", "tekstlinje"],
    defaultVariant: "liste",
    topZone: false,
    isBreak: false,
    breakHost: false,
    order: "kronologisk",
    breakingOnly: false,
    maxAgeHours: 0,
    allowedConfigKeys: ["sourceTypes", "omraadeSlug", "titel"],
    maxInstances: 1,
    fastMaerkning: "Maskinindsamlet – ikke redaktionelt vurderet",
    renderRules: [
      "Kun sourceType politi | beredskab_112; aldrig AI-genereret resumé; altid mærket maskinindsamlet.",
      "Redaktøren kan skjule hele modulet; følsomt indhold vises ikke uden redaktionel gennemgang (spec: åben beslutning).",
    ],
  },
  debat: {
    id: "debat",
    label: "Debat",
    beskrivelse: "Debatindlæg og læserbreve.",
    kind: "artikel",
    slots: { min: 2, max: 4, default: 3 },
    allowedContentTypes: ["Uafhængig", "Brugerindsendt"],
    autoContentTypes: ["Uafhængig", "Brugerindsendt"],
    variants: ["kort", "liste", "tekstlinje"],
    defaultVariant: "liste",
    topZone: false,
    isBreak: false,
    breakHost: false,
    order: "kronologisk",
    breakingOnly: false,
    maxAgeHours: 336,
    allowedConfigKeys: ["maxAgeHours", "sektionSlug", "titel"],
    maxInstances: 1,
    renderRules: ["Artikler i sektionen 'debat' (config.sektionSlug) eller brugerindsendt. Brugerindsendt mærkes med afsender."],
  },
  opslagstavle: {
    id: "opslagstavle",
    label: "Opslagstavle",
    beskrivelse: "Lokale opslag fra borgere og foreninger.",
    kind: "dynamisk",
    dataSource: "Opslagstavle",
    slots: { min: 3, max: 6, default: 4 },
    allowedContentTypes: [],
    autoContentTypes: [],
    variants: ["kompakt", "liste"],
    defaultVariant: "kompakt",
    topZone: false,
    isBreak: false,
    breakHost: false,
    order: "kronologisk",
    breakingOnly: false,
    maxAgeHours: 0,
    allowedConfigKeys: ["omraadeSlug", "titel"],
    maxInstances: 1,
    fastMaerkning: "Brugerindsendt",
    renderRules: ["Altid mærket 'Brugerindsendt'. Kun godkendte opslag (moderation sker i opslagstavlens eget flow)."],
  },
};

export function getModuleDef(type: string): ModuleDef | null {
  return (MODULE_TYPE_IDS as readonly string[]).includes(type) ? MODULE_REGISTRY[type as ModuleTypeId] : null;
}

export const MODULE_LIST: readonly ModuleDef[] = MODULE_TYPE_IDS.map((id) => MODULE_REGISTRY[id]);

/** Render-regler pr. variant. Mærkning er altid synlig — der findes bevidst ingen mulighed for at slå den fra. */
export interface VariantRule {
  billede: boolean;
  manchet: boolean;
  maxTitelTegn: number;
  /** Placering af mærkningen: altid til stede. */
  maerkning: "over-titel" | "foran-titel";
}

export const VARIANT_RULES: Record<Variant, VariantRule> = {
  hero: { billede: true, manchet: true, maxTitelTegn: 120, maerkning: "over-titel" },
  kort: { billede: true, manchet: true, maxTitelTegn: 90, maerkning: "over-titel" },
  kompakt: { billede: true, manchet: false, maxTitelTegn: 80, maerkning: "over-titel" },
  liste: { billede: false, manchet: false, maxTitelTegn: 110, maerkning: "foran-titel" },
  tekstlinje: { billede: false, manchet: false, maxTitelTegn: 100, maerkning: "foran-titel" },
};

/** Standardtekst til mærkning pr. indholdstype (marking.labelTekst overstyrer når den findes). */
export const DEFAULT_LABEL_TEXT: Record<string, string> = {
  Uafhængig: "Uafhængig",
  Partner: "Partner",
  Sponsoreret: "Sponsoreret",
  Brugerindsendt: "Brugerindsendt",
  "AI-assisteret": "AI-assisteret",
  PR: "Pressemeddelelse",
  Annonce: "Annonce",
};
