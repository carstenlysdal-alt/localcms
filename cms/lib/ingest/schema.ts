import { z } from "zod";
import { cleanText, isHttpUrl } from "../validation/text";

/**
 * Kontrakt for agent-indtaget (POST /api/ingest/signals og /api/ingest/articles).
 * Eksporterede typer er til agenter/klienter (importeres i aI-library via kopi eller som pakke).
 * Se docs/review/AGENT-INGEST-API.md for eksempler og mapping til aI-librarys LocalMonitoringItem/SourceItem.
 */

export const SOURCE_TYPES = [
  "kommune_dagsorden",
  "politi",
  "beredskab_112",
  "trafik",
  "vejr",
  "forening",
  "klub",
  "lokalt_medie",
  "kommune_pressemeddelelse",
  "andet",
] as const;
export type SourceTypeValue = (typeof SOURCE_TYPES)[number];

/** Kilder der indikerer krimi/beredskab — AI-udkast herfra spærres (jf. lib/marking.ts → isAiRestrictedCategory). */
export const AI_RESTRICTED_SOURCE_TYPES: readonly SourceTypeValue[] = ["politi", "beredskab_112"];

export const INGEST_SCOPES = ["signals:write", "articles:draft", "health:read"] as const;
export type IngestScope = (typeof INGEST_SCOPES)[number];

/** Tilladte AI-brugsværdier = de samme som redaktørens AI-brug-felt (components/editor/article-form.tsx). */
export const AI_USAGE_VALUES = ["Sproglig korrektur", "Omskrivning", "Transskribering", "Udkast"] as const;

const RAW = 3;
const plain = (max: number, min = 1) =>
  z.string().max(max * RAW).transform((v) => cleanText(v, max)).pipe(z.string().min(min).max(max));
const longPlain = (max: number, min = 0) =>
  z.string().max(max * RAW).transform((v) => cleanText(v, max, { multiline: true })).pipe(z.string().min(min).max(max));
const httpUrl = z.string().max(2048).refine(isHttpUrl, "Skal være en gyldig http(s)-URL.");
const isoDate = z.string().max(40).refine((v) => !Number.isNaN(new Date(v).getTime()), "Skal være en gyldig ISO-8601 dato/tid.");

export const geoSchema = z.union([
  plain(120),
  z.object({
    omraade: plain(120).optional(), // GeoTag-slug eller -navn
    postnr: z.string().regex(/^\d{4}$/, "Postnummer skal være 4 cifre.").optional(),
    by: plain(120).optional(),
    kommune: plain(120).optional(),
  }).strict(),
]);
export type IngestGeo = z.infer<typeof geoSchema>;

const metaSchema = z.record(z.string().max(64), z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).refine((m) => Object.keys(m).length <= 20, "For mange meta-felter.");

export const signalInputSchema = z.object({
  externalId: plain(200),
  overskrift: plain(300, 3),
  braedtekst: longPlain(20_000).optional(),
  "brødtekst": longPlain(20_000).optional(),
  kilde: plain(120),
  kildeUrl: httpUrl,
  sourceType: z.enum(SOURCE_TYPES),
  geo: geoSchema.optional(),
  publishedAt: isoDate.optional(),
  meta: metaSchema.optional(),
}).strict();
export type SignalInput = z.input<typeof signalInputSchema>;

export const signalBatchSchema = z.union([
  signalInputSchema,
  z.object({ signals: z.array(signalInputSchema).min(1).max(100) }).strict(),
]);

export const ingestBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: longPlain(10_000, 1) }).strict(),
  z.object({ type: z.literal("heading"), text: plain(200), level: z.union([z.literal(2), z.literal(3)]).default(2) }).strict(),
  z.object({ type: z.literal("subheading"), text: plain(200) }).strict(),
  z.object({
    type: z.literal("quote"),
    quote: longPlain(2000, 1),
    attribution: plain(200).optional(),
    // Citater SKAL kunne efterprøves: kilde-URL og dato er obligatoriske.
    kildeUrl: httpUrl,
    dato: isoDate,
  }).strict(),
  z.object({ type: z.literal("factbox"), title: plain(200), content: longPlain(3000, 1) }).strict(),
]);
export type IngestBlock = z.infer<typeof ingestBlockSchema>;

export const articleSourceSchema = z.object({
  url: httpUrl,
  dato: isoDate, // hvornår kilden blev udgivet/hentet — påkrævet
  titel: plain(300).optional(),
  udgiver: plain(200).optional(), // fx SourceItem.publisher
  sourceType: z.enum(SOURCE_TYPES).optional(),
}).strict();
export type ArticleSource = z.infer<typeof articleSourceSchema>;

export const articleInputSchema = z.object({
  externalId: plain(200),
  titel: plain(200, 5),
  manchet: plain(400, 1).optional(),
  tekst: longPlain(60_000).optional(),
  blocks: z.array(ingestBlockSchema).max(200).optional(),
  sektion: plain(80).optional(), // kategori-slug i instansen
  omraader: z.array(plain(120)).max(10).optional(),
  indholdstype: z.literal("AI-assisteret").optional(),
  aiBrug: z.array(z.enum(AI_USAGE_VALUES)).min(1, "aiBrug er påkrævet: angiv hvad AI har været brugt til."),
  sources: z.array(articleSourceSchema).min(1, "Mindst én kilde med url og dato er påkrævet.").max(30),
  signalIds: z.array(plain(200)).max(30).optional(), // externalIds på signaler, artiklen bygger på
  agent: z.object({ name: plain(120), version: plain(60).optional(), runId: plain(120).optional() }).strict().optional(),
  meta: metaSchema.optional(),
}).strict().refine((v) => Boolean(v.tekst) || (v.blocks && v.blocks.length > 0), { message: "Angiv enten `tekst` eller `blocks`.", path: ["tekst"] });
export type ArticleInput = z.input<typeof articleInputSchema>;

export type IngestItemResult = {
  status: "created" | "updated" | "duplicate" | "rejected";
  id?: string;
  externalId?: string;
  reason?: string;
  duplicateOf?: "externalId" | "kildeUrl";
};

export type IngestHealth = {
  ok: true;
  service: "lokalt-cms-ingest";
  version: 1;
  instance: { id: string; domaene: string; navn: string };
  key: { prefix: string; scopes: string[] };
  limits: { signalsPerRequest: number; requestsPerMinute: number };
  serverTime: string;
};
