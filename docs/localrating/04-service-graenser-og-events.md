# 04 – Service-grænser, cron/job-model og domain events

Dato: 2. oktober 2026 (opdateret 3. oktober 2026: kilde-laget, discovery og `ingestOwner`, §2.13/§4/§4a). Status: Fase 0 (design). Signaturerne er forslag til `cms/lib/**` (Fase 1-6) og er korte kontrakter, ikke implementering. Alle funktioner tager `instansId` eksplicit (aldrig fra global tilstand) og er rene/injicerbare hvor muligt (tid via `now`, netværk via `fetchImpl`, DNS via `resolver`, AI via `AiGateway`, DB via `db`) så tests aldrig rammer nettet.

## 1. Modullayout

```
cms/lib/ai/                  gateway.ts  providers/{anthropic,gemini,deepseek}.ts  models.ts  pricing.ts
                             usage.ts  budget.ts  json-repair.ts  fakes.ts  types.ts
cms/lib/prompts/             registry.ts  core-prompts.ts  preamble.ts  render.ts  store.ts
cms/lib/localrating/         config.ts  rights.ts  feeds.ts  fetch.ts  robots.ts  feed-parser.ts  feed-discovery.ts
                             normalize.ts  feed-quality.ts  dates.ts  translate.ts  dedupe.ts  candidates.ts
                             taxonomy.ts  context/knowledge.ts  jobs.ts  events.ts  cron.ts  pool.ts
                             locality.ts                                                    (scoreLocality, ren funktion; `10-…` §11e)
                             sources/{registry-parser,access-rules,rights-defaults,import,check,approve,discover,
                                      entities,adapters/*}.ts                                (kilderegister som data; `10-…` §11)
                             rating/{model.ts,engine.ts,compare.ts,profiles.ts,features.ts,models/score.ts,models/local.ts}
                             generate/{pipeline.ts,schema.ts,guardrails.ts,factcheck.ts,to-draft.ts,profiles.ts,overlap.ts,
                                       citation.ts,synthese.ts,demo-case.ts}            (Local Citation / Local Syntese / Demo-case)
                             workspace/{service.ts,chat.ts,context.ts,formats.ts}       (Local Arbejdsrum)
                             assist/{compare,coeditor,angle,bulletin,dagens-tal,deep-research,verify-claim,research,
                                     semantic-search,score-sources,optimize-query,parse-file,extract-sources,summary,
                                     fetch-article,hero-brief,source-suggest,data-ask}.ts  (assistenter; alle via AiGateway + AssistantRun)
                             connectors/{oda,dst,reuters}.ts                            (senere, typede API-connectors)
                             simulator/{engine.ts,clock.ts,scenario.ts,policy.ts,planner.ts,apply.ts,shadow.ts,explain.ts}
cms/lib/operator/tools/localrating/**                      (værktøjer til AI-operatøren; se §5)
cms/components/chat/**                                     (delte chat-UI-komponenter efter skillet chat-module; se §6)
cms/app/redaktion/produktion/**   cms/app/redaktion/prompter/**   cms/app/redaktion/simulator/**
cms/app/api/cron/localrating/route.ts   cms/app/api/localrating/generation/[id]/events/route.ts
```

Importregler (håndhæves af en lille lint-/test-regel `tests/localrating-import-direction.test.ts`): `lib/localrating/**`, `lib/ai/**`, `lib/prompts/**` må importere CMS-kernen; **ingen fil uden for disse mapper** (undtagen nav/permissions/env-linjerne) må importere dem. `lib/prompts/core-prompts.ts` importerer *eksisterende* prompt-konstanter (`RANKER_SYSTEM_PROMPT`, `NL_SYSTEM_PROMPT`) – og ikke omvendt.

## 2. Interfaces (TypeScript-signaturer)

### 2.1 Hentning – `fetch.ts`
```ts
export type FetchErrorCode =
  | "scheme" | "userinfo" | "port" | "host_blocked" | "dns" | "ip_blocked" | "redirect_limit" | "redirect_blocked"
  | "too_large" | "timeout" | "content_type" | "http_error" | "tls" | "robots" | "network";

export interface FetchPolicy {
  maxBytes: number;          // feed 5 MB, HTML-discovery 1 MB
  maxDecompressedBytes: number;
  connectTimeoutMs: number;  // 5_000
  totalTimeoutMs: number;    // 15_000
  maxRedirects: number;      // 5
  allowedPorts: readonly number[]; // [80, 443]
  userAgent: string;         // ærligt; se 10-…
  acceptContentTypes: readonly RegExp[];
}
export interface SafeFetchResult {
  ok: boolean; status: number; finalUrl: string; headers: Record<string, string>;
  body: Uint8Array | null; bytes: number; notModified: boolean;
  etag?: string; lastModified?: string; retryAfterSec?: number;
  error?: { code: FetchErrorCode; detail?: string };
}
export interface DnsResolver { lookupAll(host: string): Promise<{ address: string; family: 4 | 6 }[]> }

export function safeFetch(url: string, opts?: {
  conditional?: { etag?: string | null; lastModified?: string | null };
  policy?: Partial<FetchPolicy>;
  resolver?: DnsResolver;      // tests: scriptede svar (DNS-rebinding)
  fetchImpl?: typeof fetch;    // tests
  signal?: AbortSignal;
}): Promise<SafeFetchResult>;
```
Kaster aldrig for forventede fejl (returnerer `{ ok:false, error }`); regelsæt og tests: `10-…` §3.

### 2.2 Parsing – `feed-parser.ts`
```ts
export interface ParsedFeedItem {
  guid?: string; link?: string; title: string; summaryHtml?: string; contentHtml?: string;
  author?: string; categories: string[]; publishedAt?: Date; modifiedAt?: Date;
  enclosure?: { url: string; type?: string; length?: number };
  raw: Record<string, unknown>;               // original (kappet) — gemmes i SourceItem.rawPayload hvis rights tillader
}
export interface ParsedFeed {
  title?: string; link?: string; language?: string; items: ParsedFeedItem[];
  parserUsed: "rss-parser" | "sanitized" | "loose" | "json";
}
export function parseFeed(body: Uint8Array | string, ctx: { contentType?: string; baseUrl: string; maxItems: number }): Promise<ParsedFeed>;
// 3 lag (som Y: sireRoute.ts:1110-1166): 1) rss-parser.parseString  2) XML-sanering (&-/<-regex)  3) loose sax. Kaster ParseError hvis alle fejler.
```

### 2.3 Normalisering og kvalitet – `normalize.ts`, `feed-quality.ts`, `rights.ts`
```ts
export interface NormalizedItem {
  headline: string; body: string; summary: string;          // body/summary efter rights-gate
  canonicalUrl: string | null; urlNorm: string;             // lib/validation/text.ts:84
  publishedAt: Date | null; author: string | null; sourceName: string;
  media: { url: string; type: string }[]; language: string; locations: string[];
  contentHash: string; titleHash: string;
  rightsApplied: RightsLevel; aiInput: "none" | "headline" | "snippet" | "fulltext";
  quality: { passes: boolean; reasons: string[] };
}
export function normalizeItem(item: ParsedFeedItem, source: SourceDefinitionLite, now: Date): NormalizedItem;
export function applyRights(item: NormalizedItem, level: RightsLevel): NormalizedItem; // fjerner/trunkerer felter iht. 10-… §5
export function hasRealFeedContent(item: NormalizedItem, gate: "strict" | "lenient" | "headline_only"): { passes: boolean; reasons: string[] };
```

### 2.4 Dedupe – `dedupe.ts`
```ts
export type DedupeResult = "NEW" | "DUPLICATE" | "UPDATE" | "RELATED";
export interface DedupeVerdict {
  result: DedupeResult;
  reason: "externalId" | "urlNorm" | "contentHash" | "titleSimilarity" | "semantic" | "article" | "signal";
  match?: { sourceItemId?: string; candidateId?: string; articleId?: string; signalId?: string };
  similarity?: number;       // 0-1 (titel-trigram/jaccard + geo/tid-bøtte)
}
export interface DedupeDeps { db: PrismaClient; now: Date; windowDays: number; semantic?: (a: string, b: string) => Promise<number> }
export function dedupeItem(instansId: string, item: NormalizedItem, source: SourceDefinitionLite, deps: DedupeDeps): Promise<DedupeVerdict>;
```
Algoritme og rækkefølge i `10-…`/`12-…` (Fase 2): (1) `(sourceId, externalId)` ⇒ UPDATE hvis `contentHash` ændret ellers DUPLICATE; (2) samme `urlNorm` hos anden kilde ⇒ DUPLICATE; (3) samme `contentHash` ⇒ DUPLICATE; (4) titel-lighed ≥ 0,85 inden for vindue ⇒ RELATED/UPDATE (afhængigt af om kandidaten allerede har artikel); (5) match mod `Article.titel`/`Signal.kildeUrlNorm` ⇒ DUPLICATE (`article`/`signal`); (6) valgfri semantisk (AI, kun hvis rights tillader). Resultat `RELATED` knytter til eksisterende kandidat uden at oprette ny.

### 2.5 Rating – `rating/model.ts` (fuld specifikation i `05-ratingmodeller.md`)
```ts
export type Band = "IGNORE" | "REVIEW" | "POTENTIAL" | "HIGH" | "URGENT";
export interface RatingModel<TConfig> {
  readonly id: "score" | "local"; readonly version: string;
  validateConfig(raw: unknown): { ok: true; value: TConfig } | { ok: false; errors: string[] };
  promptSlug(config: TConfig): string;                                   // PromptTemplate-slug
  buildUserPayload(input: RatingInput, config: TConfig): { user: string; retrieved: { label: string; content: string }[] };
  parseEstimates(raw: string, input: RatingInput): { ok: true; value: Estimates } | { ok: false; reason: string };
  computeDeterministic(input: RatingInput, ctx: DeterministicCtx, config: TConfig): Deterministic;   // ingen I/O: alt data kommer i ctx
  score(est: Estimates, det: Deterministic, config: TConfig): RatingResult;                          // PURE
}
export interface RatingEngine {
  rate(instansId: string, candidateId: string, opts: { profileVersionId: string; now: Date; ai: AiGateway; comparisonGroupId?: string; dryRun?: boolean }): Promise<RatingRunRecord | RatingFailure>;
  rateBoth(instansId: string, candidateId: string, opts: { now: Date; ai: AiGateway }): Promise<{ score: RatingRunRecord; local: RatingRunRecord }>;
}
```
AI-fejl, ugyldig JSON eller budget ⇒ `RatingFailure` (kandidaten bliver stående med `status=new`, job genforsøges) – aldrig tom/gættet score.

### 2.6 Generator – `generate/pipeline.ts`
```ts
export interface GenerationRequest {
  instansId: string; candidateId: string; profileId: string; userId: string; now: Date;
  editorialInstructions?: string;      // BRUGER-del (redaktørens vinkel); ubetroet-lignende: valideres/trunkeres
  sektionSlug: string;                 // påkrævet af createIngestDraft (kategori-slug)
  extraSources?: { url: string; dato: string; titel?: string; udgiver?: string; text?: string }[]; // redaktørens egne kilder
}
export type GenerationEvent =
  | { type: "status"; message: string } | { type: "delta"; text: string }
  | { type: "result"; runId: string } | { type: "blocked"; reason: string } | { type: "error"; code: string };
export interface Generator {
  start(req: GenerationRequest, deps: { ai: AiGateway; prompts: PromptRegistry; db: PrismaClient }): Promise<{ runId: string }>;      // opretter GenerationRun + job
  execute(runId: string, deps: GeneratorDeps): AsyncIterable<GenerationEvent>;                                                     // kører jobbet (stream til UI)
  handOver(runId: string, actor: { id: string; permissions: string[] }, deps: GeneratorDeps): Promise<{ articleId: string }>;      // createIngestDraft + revision + audit
}
```
`handOver` kræver `production.ai.use` **og** `article.create` og at faktatjek/guardrails ikke har blokerende fund (`06-…`).

### 2.7 Prompt-register – `lib/prompts/registry.ts` (design i `07-…`)
```ts
export type PromptSource = "code" | "db";
export interface PromptSummary { id: string; name: string; purpose: string; ownerModule: string; language: string; task: string; model: string; variables: PromptVariable[]; version: string | number; updatedAt: string | null; usedBy: string[]; source: PromptSource; editable: boolean }
export interface PromptRegistry {
  list(instansId: string, filter?: { ownerModule?: string; task?: string; q?: string }): Promise<PromptSummary[]>;
  get(instansId: string, id: string): Promise<PromptDetail>;                        // inkl. fuld tekst
  resolve(instansId: string, slug: string, opts?: { versionId?: string }): Promise<ResolvedPrompt>;   // aktiv version + præambel
  render(p: ResolvedPrompt, vars: Record<string, string>, retrieved?: { label: string; content: string }[]): { system: string; user: string };
  createVersion(instansId: string, slug: string, body: string, note: string, actor: Actor): Promise<{ versionId: string }>;
  activate(instansId: string, versionId: string, actor: Actor): Promise<void>;
  rollback(instansId: string, slug: string, toVersion: number, actor: Actor): Promise<void>;      // = ny aktiv version med gammel tekst
  diff(a: string, b: string): DiffHunk[];
}
```

### 2.8 AI-gateway – `lib/ai/gateway.ts` (design i `09-…`)
```ts
export type AiTask = "triage" | "rating" | "translate" | "generate" | "factcheck" | "coeditor" | "angle" | "planner" | "playground"
  | "workspace" | "research" | "parse_file" | "extract" | "data_ask" | "operator" | "other";
export interface AiGatewayRequest {
  instansId: string; task: AiTask;
  system: string;                                   // SYSTEM (faste instrukser + præambel)
  user: string;                                     // BRUGER (redaktørens/ opgavens variable input)
  retrieved?: { label: string; content: string }[]; // HENTET INDHOLD (ubetroet) — sendes adskilt, indrammet som data
  json?: { schema: import("zod").ZodType; repair?: boolean };
  attachments?: { kind: "image" | "pdf"; mime: string; data: Uint8Array }[];     // vision (parse_file); ≤ LOCALRATING_MAX_UPLOAD_MB
  maxTokens: number; temperature?: number; timeoutMs?: number;
  provider?: "anthropic" | "gemini" | "deepseek"; model?: string;   // default pr. task fra env/konfig
  runRef?: { kind: "RatingRun" | "GenerationRun" | "SimulationRun" | "Playground" | "SourceItem"; id: string };
  promptVersionId?: string; userId?: string;
  piiPolicy?: "no_pii" | "allow";                   // deepseek afvises ved "allow"/personhenførbart (GDPR)
}
export type AiGatewayResult<T = string> =
  | { ok: true; value: T; text: string; provider: string; model: string; usage: UsageRecord; attempts: number }
  | { ok: false; reason: "no_key" | "budget" | "policy" | "circuit_open" | "timeout" | "invalid_output" | "api_error"; detail?: string; usage?: UsageRecord };
export interface AiGateway {
  complete<T = string>(req: AiGatewayRequest): Promise<AiGatewayResult<T>>;
  stream(req: AiGatewayRequest): AsyncIterable<{ type: "delta"; text: string } | { type: "done"; result: AiGatewayResult }>;
  isConfigured(provider?: string): boolean;
}
```
Kaster aldrig (som `callJson`, `ai-client.ts:116`); skriver altid én `AiUsage`-række (også ved afvisning).

### 2.9 Simulator – `simulator/engine.ts` (design i `08-…`)
```ts
export interface VirtualClock { times: Date[]; tz: "Europe/Copenhagen" }
export interface SimulationScenario {
  articles: SimArticle[];            // rigtige (id'er) eller syntetiske (fuld Candidate-form + metrics)
  events: { at: Date; kind: "breaking" | "tip_cluster" | "sponsor_campaign"; articleId?: string; payload?: unknown }[];
  quota?: QuotaInput;                // ellers beregnet ud fra scenariets artikler
  modules?: ModuleInstance[];        // ellers instansens aktive layout (read-only)
}
export interface SimulationPolicy { version: string; rank: { halfLifeByStoryType?: Record<string, number> }; compose: { aiWeight?: number }; /* kun parametre kernen allerede har; nye kræver kernes-ændring */ }
export interface Simulator {
  run(instansId: string, scenario: SimulationScenario, policy: SimulationPolicy, clock: VirtualClock, deps: { ai?: AiGateway; now?: never }): Promise<SimulationResult>;   // ingen DB-skrivning udover SimulationRun
  compare(a: SimulationResult, b: SimulationResult): PolicyComparison;
  planWithAi(instansId: string, run: SimulationResult, deps: { ai: AiGateway; prompts: PromptRegistry }): Promise<PublicationPlanProposal>;
  applyAsProposal(user: FrontpageUser, runId: string, planId?: string): Promise<{ snapshotId: string } | ServiceError>;   // kun status "forslag"
}
```

### 2.10 Knowledge-adapter – `context/knowledge.ts`
```ts
export type KnowledgeContext =
  | { status: "disabled" }                                             // flag slukket: ingen kontekst, markeret i RatingRun.flags
  | { status: "unavailable"; reason: "timeout" | "http_error" | "auth" | "isolation_missing" }
  | { status: "ok"; stories: KStory[]; priorArticles: KArticleRef[]; entities: KEntity[]; sources: KSource[]; claims: KClaim[]; fetchedAt: Date };
export function getCandidateContext(instansId: string, candidate: CandidateLite, deps: { enabled: boolean; baseUrl?: string; fetchImpl?: typeof fetch; timeoutMs: number }): Promise<KnowledgeContext>;
```
Fail-closed: `disabled`/`unavailable` ⇒ rating kører uden kontekst og **markerer det** (`flags: ["knowledge:disabled"]`), aldrig stille no-op (jf. `knowledge-client.ts:186-201`).

### 2.11 Jobs og events – `jobs.ts`, `events.ts`
```ts
export function enqueue(tx: Tx, instansId: string, kind: JobKind, payload: unknown, opts?: { dedupeKey?: string; runAfter?: Date; priority?: number }): Promise<{ id: string; created: boolean }>;
export function claimDue(opts: { now: Date; limit: number; kinds?: JobKind[]; instansIds?: string[]; workerId: string; leaseMs: number }): Promise<ProductionJob[]>;
export function runJob(job: ProductionJob, deps: JobDeps): Promise<{ status: "done" | "failed" | "retry"; result?: unknown; nextRunAt?: Date; error?: string }>;
export function reapExpired(now: Date): Promise<number>;
export function emit(tx: Tx, e: Omit<DomainEventEnvelope, "eventId" | "occurredAt" | "schemaVersion">): Promise<void>;   // INSERT ProductionJob kind "event:<TYPE>" i samme transaktion som ændringen
```

### 2.12 Local Citation, Local Syntese, Local Arbejdsrum og assistenter (paritet med Y-familien)

```ts
// generate/citation.ts  (Y: POST /citation, sireRoute.ts:4719)
export interface CitationRequest {
  instansId: string; userId: string; now: Date;
  title?: string; text: string;                 // kildetekst (HENTET INDHOLD; ≥ 50 tegn)
  sourceUrl?: string; sourceName?: string; publishedDate?: string; sourceLanguage?: string;
  editorialBrief?: string;                      // fx fra Local Sammenligning ("BYG IND/MERGE"-regler bevares)
  extraSources?: { sourceName?: string; sourceUrl?: string; text: string }[];
  format: "kort" | "lang";                      // Y: format === "lang"
  candidateId?: string;                         // ellers oprettes manuel kandidat (origin "manual")
}
export interface CitationResult { overskrift: string; manchet: string; artikel: string; kilde: string; mangler: string[]; generationRunId: string }
export function runCitation(req: CitationRequest, deps: GeneratorDeps): Promise<CitationResult | GenerationFailure>;

// generate/synthese.ts  (Y: POST /synthesize, sireRoute.ts:6759)
export interface SyntheseRequest { instansId: string; userId: string; now: Date; items: { title: string; text: string; sourceName: string; sourceUrl: string; publishedDate?: string }[]; /* ≥ 2 */ candidateId?: string }
export function runSyntese(req: SyntheseRequest, deps: GeneratorDeps): Promise<CitationResult | GenerationFailure>;

// workspace/service.ts  (Y: /workspace*, sireRoute.ts:5064-5266)
export interface WorkspaceService {
  create(user: AuthUser, input: { candidateId?: string; generationRunId?: string; sourceContext?: SourceContextInput; draft?: Draft; targetFormat?: string | null }): Promise<LocalWorkspaceDTO>;
  get(user: AuthUser, id: string): Promise<LocalWorkspaceDTO | null>;
  chatTurn(user: AuthUser, id: string, turn: { userMessage: string; attachments?: AttachmentRef[]; webSearch?: boolean; searchQuery?: string }, deps: { ai: AiGateway; prompts: PromptRegistry }): AsyncIterable<WorkspaceEvent>;  // <svar>/<udkast>-tagget svar parses til { svar, udkast? }
  saveDraft(user: AuthUser, id: string, draft: Draft, expectedUpdatedAt: string): Promise<{ ok: true } | { ok: false; code: "conflict" }>;   // optimistisk samtidighed (som saveDraftLayout)
  setFormat(user: AuthUser, id: string, targetFormat: string | null): Promise<void>;
  formats(instansId: string): Promise<{ key: string; label: string; beskrivelse: string }[]>;     // format-kataloget er data (GenerationProfile), ikke kode
  handOver(user: AuthUser, id: string, opts: { sektionSlug: string }, deps: GeneratorDeps): Promise<{ articleId: string }>;   // → createIngestDraft (samme kontrakt som 06-… §7)
}

// assist/*.ts — fælles form for alle assistenter (Y: co-editor, suggest-angle, bulletin, suggest-dagens-tal, deep-research-prompt, compare, verify-claim, …)
export type AssistantKind = "coeditor" | "coeditor_queries" | "angle" | "bulletin" | "dagens_tal" | "deep_research" | "compare" | "verify_claim"
  | "research" | "semantic_search" | "score_sources" | "optimize_query" | "parse_file" | "extract_sources" | "summary" | "fetch_article" | "hero_brief" | "data_ask";
export interface AssistantRequest<K extends AssistantKind, I> { instansId: string; userId: string; kind: K; input: I; candidateId?: string; workspaceId?: string; now: Date }
export function runAssistant<K extends AssistantKind, I, O>(req: AssistantRequest<K, I>, deps: { ai: AiGateway; prompts: PromptRegistry; db: PrismaClient }): Promise<{ ok: true; value: O; runId: string } | { ok: false; reason: string }>;
// Skriver ÉN AssistantRun + ÉN AiUsage; input valideres med zod pr. kind; HENTET INDHOLD adskilles; resultat valideres; aldrig side-effekter på artikler/forside.
```
**Samme regler som `Generator`:** rights-gate på input, `piiPolicy`, budget, SYSTEM/BRUGER/HENTET-adskillelse, output kun som forslag; `fetch_article` bruger `safeFetch` (SSRF-regler, `10-…` §3) og returnerer udtrukket tekst som HENTET INDHOLD; `parse_file` modtager en uploadet filreference (≤ 20 MB, MIME-allowlist) og bruger gatewayens *vision*-evne for billeder.

### 2.13 Kilde-laget – `sources/**` og `locality.ts` (kilderegistrene; `10-…` §11)

Flow (registrets "StoryCandidate-flow"): **`SourceDefinition` → hent (adapter) → `SourceItem` → lokal relevans → dedupe → entity resolution → (valgfri Knowledge-opslag) → source authority → `StoryCandidate` → Editorial Rating**. Alle trin er `ProductionJob`s; ingen trin publicerer.

```ts
export type AccessMode = "API" | "RSS" | "ATOM" | "EMAIL" | "WEBHOOK" | "HTML_MONITOR" | "SITEMAP" | "LICENSED_FEED" | "MANUAL" | "SEED_DIRECTORY";
export type AuthorityLevel = "PRIMARY_OFFICIAL" | "PRIMARY_ORGANIZATION" | "LICENSED_NEWSWIRE" | "SECONDARY_MEDIA" | "AGGREGATOR" | "SOCIAL_SIGNAL";

// Typet adapter pr. parserType (rss-parser, atom, json-api, odata, wfs, gtfs, datex2, cvr, html-change, html-list, pdf-monitor, seed-directory, …).
// ALT netværk går gennem safeFetch (SSRF-regler S1-S15); adapteren får bytes og returnerer kandidat-items — aldrig en URL at hente selv.
export interface SourceAdapter {
  readonly parserType: string;
  validateConfig(raw: unknown): { ok: true; value: unknown } | { ok: false; errors: string[] };
  fetchItems(src: SourceDefinitionLite, ctx: { fetch: typeof safeFetch; now: Date; secrets: SecretsReader; maxItems: number }): Promise<{ items: ParsedSourceItem[]; etag?: string; lastModified?: string; parserUsed: string } | AdapterFailure>;
}                                                    // secrets: kun navngivne Railway-variabler (authRef); aldrig fra DB
export interface ParsedSourceItem extends ParsedFeedItem { externalId: string; structured?: Record<string, string | number | boolean | null>; /* hvidlistede felter (parserConfig.fields) */ }

// Seed-adaptere (SEED_DIRECTORY) poller ikke; de bruges kun af discovery.
export interface SeedAdapter { readonly parserType: "seed-directory" | "cvr-seed"; listRecords(seed: SourceDefinitionLite, ctx: AdapterCtx): Promise<{ records: SeedRecord[] } | AdapterFailure> }
export interface SeedRecord { name: string; officialUrl?: string; category?: string; places: string[]; cvr?: string; meta?: Record<string, string> }

// Import (tørkørsel som standard) og klassificering — rene funktioner + én skrivende funktion.
export function parseRegistry(markdown: string): { rows: RegistryRow[]; geoCore: { aliases: string[]; kommuneKode?: string }; mvp: { name: string; rank: number | null; wave: string }[]; warnings: string[] };
export function classifyRow(row: RegistryRow, geoCore: GeoCore): SourceDefinitionDraft;                 // access-rules.ts + rights-defaults.ts; ingen I/O
export function deriveRights(a: { authorityLevel: AuthorityLevel; licenseType: string; accessMode: AccessMode; sourceClass: string }): { rightsLevelSuggested: RightsLevel; personDataClass: "none" | "possible" | "likely"; qualityGate: string; trustStart: number };
export function importRegistry(instansId: string, file: { path: string; sha256: string; content: string }, opts: { apply: boolean; overlay?: UrlOverlay; actor: Actor }, db: PrismaClient): Promise<ImportReport>;

// Godkendelse (menneske). AI kan aldrig kalde disse.
export function approveSource(actor: Actor, sourceId: string, input: { rightsLevel?: RightsLevel; authorityLevel?: AuthorityLevel; note?: string }): Promise<{ ok: true } | ServiceError>;   // production.manage; rights/authority PRIMARY_* kræver production.rights.manage
export function rejectSource(actor: Actor, sourceId: string, note: string): Promise<{ ok: true } | ServiceError>;
export function enableSource(actor: Actor, sourceId: string): Promise<{ ok: true } | ServiceError>;     // kræver approvalStatus=godkendt, URL, robotsTermsCheckedAt, test ok, rightsLevel ≠ blocked

// Discovery
export function discoverSources(instansId: string, opts: { trigger: "cron" | "manual" | "operator"; seedSourceId?: string; now: Date }, deps: { db: PrismaClient; fetch: typeof safeFetch; ai?: AiGateway }): Promise<{ runId: string }>;

// Lokal relevans (ren): signaler, vægte og bånd er profildata
export function scoreLocality(item: LocalityInput, ctx: LocalityContext, cfg: LocalityConfig): { score: number; breakdown: LocalitySignal[]; band: "local" | "maybe" | "not_local"; rule?: string };
```

**`PROCESS_ITEM` (udvidet):** normalisér → rights-gate → `rawPayloadHash` → `scoreLocality` (Fase 2: forfilter; Fase 3: fuld) → afvis hvis under kildens `instanceScope`-tærskel (`filtered`/`locality`) → dedupe (inkl. `signal`/`story`) → entity resolution mod `LocalEntityRef` → (valgfri) Knowledge-opslag → kandidat med `sourceAuthority`, `localityScore`, `storyClusters`, `primaryFirst`. Kilder med `ingestOwner="ailibrary"` har ingen `FETCH_FEED`; deres `Signal`s læses som `RELATED`-evidens og som kandidatkilde (`origin="signal"`), se §4a.

## 3. Cron- og job-model

### 3.1 Endpoint
`GET|POST /api/cron/localrating[?task=tick|housekeeping|reconcile][&instans=<id>]` – kopieret mønster fra `app/api/cron/frontpage-rank/route.ts:21-59`: `Authorization: Bearer ${CRON_SECRET}` (konstant-tids `safeEqual`), 503 uden `CRON_SECRET` ≥ 16 tegn, rate limit 20 mislykkede forsøg/min/IP og 6 kørsler/min globalt, `Cache-Control: no-store`, `dynamic = "force-dynamic"`. Ruten **publicerer aldrig** og tager ingen bruger-input ud over `task`/`instans`.

**Railway:** 2. cron-service `cron-localrating` med start-kommando `curl -fsS --max-time 55 -X POST -H "Authorization: Bearer $CRON_SECRET" "http://lysdalcms.railway.internal:$APP_PORT/api/cron/localrating?task=tick"`, schedule `*/5 * * * *` (Railway-cron min. 5 min; `docs/review/T8-kildematrix.md` §5.1). Nattelig `housekeeping` (03:15 UTC) og `reconcile` hvert 15. min. Opsætning dokumenteres i `docs/ops/LOCALRATING.md` (Fase 5) og `RAILWAY-SETUP.md` §4-mønstret.

### 3.2 Et `tick`
1. **Gate:** spring instanser over uden `LocalRatingConfig.enabled && schedulerEnabled`.
2. **Planlæg kilder:** for hver instans: `SourceDefinition where enabled && approvalStatus="godkendt" && ingestOwner="localrating" && nextFetchAt <= now` (maks `N=10` pr. instans — **P0 undtaget: op til 20**, `M=40` samlet, `ORDER BY priority, nextFetchAt`; P0 reserverer halvdelen af tickets kapacitet, `10-…` §11f) ⇒ `enqueue(FETCH_FEED, { sourceId }, dedupeKey = "fetch:<id>:<floor(now/pollInterval)>", priority P0=10 | P1=50 | P2=100)`. Ugentligt: `enqueue(DISCOVER_SOURCES, { instansId }, dedupeKey = "discover:<instans>:<ISO-uge>")` for instanser med godkendte seeds. Dedupe-nøglen gør ticket idempotent ved dobbeltkald.
3. **Kør jobs inden for tidsbudget** (`TICK_BUDGET_MS = 40_000`): `claimDue` ⇒ `runJob` med samtidighed ≤ 6 (≤ 1 pr. host for fetch). AI-jobs (`RATE_CANDIDATE`, `TRANSLATE_ITEM`) har eget loft pr. tick (fx 20) og afvises af budget-gate hvis månedsloft er nået.
4. **Reaper:** `lockedUntil < now` og `status=running` ⇒ `queued` (`attempts+1`) eller `dead` hvis `attempts ≥ maxAttempts`.
5. Svar: `{ ok, published:false, processed, remaining, instanser:[{id, fetched, newItems, candidates, rated, errors}] }`.

### 3.3 Claim og lease (uden `SKIP LOCKED`)
SQLite (dev) og Prisma mangler `FOR UPDATE SKIP LOCKED`; claim sker optimistisk: `findMany` (forfaldne, `status=queued`) ⇒ for hvert id `updateMany({ where:{ id, status:"queued" }, data:{ status:"running", lockedUntil: now+leaseMs, lockedBy, attempts:{increment:1}, startedAt: now } })`; kun `count===1` tæller som claim. Lease 60 s; langvarige jobs (generering) fornyer lease hvert 15. sekund. CMS kører `numReplicas: 1` (`railway.json:12`), men mønstret er sikkert ved flere processer.

### 3.4 Lange AI-trin (Railway-timeout)
Ingen lang HTTP-request: UI "Generér kladde" kalder `Generator.start` (opretter `GenerationRun` + `GENERATE_DRAFT`-job, svarer 202). Jobbet påbegyndes straks i samme (langlivede) Node-proces uden for request-livscyklussen (detached promise med lease-heartbeat) og kan genoptages af cron/reaper efter nedbrud. UI følger fremdrift via `GET /api/localrating/generation/<id>/events` (NDJSON, same-origin, `production.view`), som tailer `GenerationRun`/delta-buffer. Y's NDJSON-mønster (`sireRoute.ts:8357-8441`) bevares for brugeroplevelsen, men afkobles fra selve kørslen.

### 3.5 Retries, backoff, idempotens
| Lag | Regel |
|---|---|
| Job | `maxAttempts=5`; forsinkelse `backoffDelay(attempt, 30_000, 6*3600_000)` (`lib/resilience.ts:128`); 4xx-lignende "kontraktfejl" (`invalid_output` efter reparation, `blocked_*`) ⇒ **ingen retry**, `dead`/`failed` med årsag |
| Feed | `nextFetchAt = now + min(pollInterval·2^fejl, 6 t) + jitter(0-20 %)`; respekter `Retry-After`; 5 fejl i træk ⇒ `status=down` (prøv hver 6. time); 404 på tidligere OK feed ⇒ struktureret fejl (ikke "0 nye"); HTML-svar på feed ⇒ fejl (T8 §5.3) |
| AI | `callJson`-lignende: ét genforsøg ved timeout/5xx/429/ugyldigt svar; breaker pr. provider åbner ved 3 fejl i træk i 30 s (`resilience.ts:162`, `ai-client.ts:44`) |
| Idempotens | `SourceItem` unik `(instansId, sourceId, externalId)`; `ProductionJob.dedupeKey` unik pr. instans; `Article.externalId = localrating:<runId>`; events: `dedupeKey = <TYPE>:<aggregateId>:<aggregateVersion>` |

### 3.6 Retention (`housekeeping`)
`IngestionLog` > 90 dage slettes; `SourceItem` uden kandidat > `itemRetentionDays` slettes (rå payload er den tungeste kolonne); `ProductionJob` `done` > 14 dage slettes, `dead` > 90 dage; `StoryCandidate` `new/rated` uden aktivitet i 14 dage ⇒ `archived`. Aldrig sletning af `RatingRun`/`GenerationRun`/`AiUsage` (audit).

## 4. Domain events (spec §25)

**Realisering uden ny infrastruktur (ADR-012):** en hændelse er en række i `ProductionJob` med `kind = "event:<TYPE>"`, skrevet i **samme transaktion** som den kanoniske ændring (transaktionel outbox, jf. Knowledge ADR-008). Dispatch bruger samme claim/lease/retry-mekanik; handlere opretter opfølgende jobs. At-least-once, ingen exactly-once-påstand; modtager-dedupe via `dedupeKey`; ordering kun pr. aggregat via `aggregateVersion`.

```ts
export interface DomainEventEnvelope {
  eventId: string; eventType: DomainEventType; schemaVersion: 1;
  instansId: string; aggregateType: "SourceDefinition" | "SourceItem" | "SourceDiscoveryRun" | "LocalEntityRef" | "StoryCandidate" | "GenerationRun" | "Article" | "FrontpageSnapshot";
  aggregateId: string; aggregateVersion: number; occurredAt: string; correlationId: string;
  data: Record<string, string | number | boolean | null>;    // minimal, ingen persondata/tekst
}
```

| Event (spec §25) | Hvem producerer | Aggregat / udløser | Handlere (opfølgende job) | Status i v1 |
|---|---|---|---|---|
| `FEED_ITEM_INGESTED` *(spec §25-navn bevaret; udløses for en `SourceItem`)* | LocalRating (`ingest.ts`) | `SourceItem` indsat/opdateret (`NEW`/`UPDATE`) | `PROCESS_ITEM` (normalisér→dedupe→kandidat), evt. `TRANSLATE_ITEM` | **Emitteret** |
| `SOURCE_CREATED` | LocalRating (`sources/*`) | `SourceDefinition` oprettet (import, discovery, manuel) | (valgfri) Knowledge-kildekobling | **Emitteret** (ingen handler i v1) |
| `SOURCE_APPROVED` / `SOURCE_REJECTED` | LocalRating (`sources/approve.ts`) | `approvalStatus` ændret af et **menneske** | `SOURCE_APPROVED` ⇒ (valgfri) `sources:check`-job; ingen automatisk aktivering | **Emitteret** |
| `DISCOVERY_STARTED` / `DISCOVERY_COMPLETED` | LocalRating (`discover.ts`) | `SourceDiscoveryRun` start/slut (`stats` i data som skalarer) | drift-/godkendelseskø-badge | **Emitteret** |
| `DISCOVERY_SOURCE_PROPOSED` | LocalRating | child `SourceDefinition` oprettet som `foreslået` (aggregat `SourceDefinition`; `data`: `parentSourceId`, `accessMode`, `proposedAuthority`) | godkendelseskø | **Emitteret** |
| `DISCOVERY_SOURCE_DEAD` / `DISCOVERY_SOURCE_MOVED` | LocalRating | child markeret `dead` / `moved` (`data`: `movedToUrlNorm`) | notifikation; forslag for ny URL ved `moved` | **Emitteret** |
| `DISCOVERY_ALIAS_PROPOSED` | LocalRating | `LocalEntityRef(place_alias)` foreslået | alias-/GeoTag-gap-visning (redaktør opretter evt. GeoTag i CMS) | **Emitteret** |
| `STORY_CANDIDATE_CREATED` | LocalRating | `StoryCandidate` oprettet | `KNOWLEDGE_CONTEXT` (hvis slået til), `RATE_CANDIDATE` | **Emitteret** |
| `STORY_CANDIDATE_RATED` | LocalRating | `RatingRun` oprettet | opdatér `latest*` på kandidat; (valgfri) shadow-rating; notifikation i inbox | **Emitteret** |
| `DRAFT_GENERATED` | LocalRating | `GenerationRun` → `generated`/`factchecked` | `FACTCHECK` hvis profil kræver det; ellers klar til `handOver` | **Emitteret** |
| `ARTICLE_CREATED` | LocalRating (`to-draft.ts`) | `createIngestDraft` lykkedes | opdatér `StoryCandidate.articleId/status=drafted`; `ArticleRevision` + audit | **Emitteret af LocalRating** (kernen emitterer ikke) |
| `ARTICLE_PUBLISHED` / `ARTICLE_UPDATED` | **CMS-kernen** (ændres ikke) | – | `RECONCILE` (hvert 15. min.) poller `Article.status/publiceretTid/opdateretTid` for artikler med `StoryCandidate.articleId` og emitterer **`ARTICLE_PUBLISHED_OBSERVED` / `ARTICLE_UPDATED_OBSERVED`** | **Observeret (polling)**, ikke push |
| `COMPOSITION_PUBLISHED` | CMS-kernen (`approveSnapshot`, `publishLayout`) | – | `RECONCILE` observerer `FrontpageSnapshot.status=godkendt` ⇒ `COMPOSITION_PUBLISHED_OBSERVED` (bruges af shadow-mode til at sammenligne) | **Observeret** |
| `TIP_RECEIVED` | CMS (`Submission`, `MeddelerSag`) / Knowledge | – | `RECONCILE` tæller nye tips pr. GeoTag til rating (kun tællinger, aldrig tekst) | **Observeret (kun optælling)** |
| `STORY_UPDATED` | Knowledge OS | – | – | **Uden for v1** (kræver Knowledge-events) |
| `METRICS_AGGREGATED` | Analytics (CMS `ArticleMetric`) | – | – | **Ikke brugt** (simulator læser metrics direkte) |
| `RECOMMENDATION_REQUESTED` | Recommendation | – | – | **Uden for scope** (forsidekernen er uændret) |

### 4a. Grænsen mod aI-library: `ingestOwner` og den konkrete dedupe-regel (opdaterer D18/ADR-005)

**Før kilderegistrene:** dagsorden/politi/trafik/vejr = aI-library (`Signal`); LocalRating seedede dem ikke (én kilde, ét system). **Nu:** kilderegistrene er LocalRatings **kilde-til-sandhed** (ADR-015) og indeholder netop politi, dagsordener, trafik og DMI som P0/P1-rækker. Grænsen flyttes derfor fra *"hvilke kilder findes i LocalRating"* til *"hvem henter dem"*:

1. **Registret ejes af LocalRating.** Alle registerrækker findes som `SourceDefinition`, også dem aI-library henter.
2. **Én ingest-ejer pr. kilde og instans:** `SourceDefinition.ingestOwner ∈ { localrating, ailibrary, manual }`. Default ved import: `ailibrary` for politi (Politi Update, døgnrapporter), dagsordener/referater, Vejdirektoratet Trafikinfo og DMI (T8 §5), ellers `localrating` — **indtil ejeren afgør D18** pr. kilde.
3. **`ailibrary`-ejede rækker:** LocalRating poller ikke (ingen `FETCH_FEED`, ingen `SourceItem`s). `Signal`-rækker (`Signal.kildeUrlNorm`/`kilde`) matches til rækken på vært+sti-præfiks og bruges som (a) `RELATED`-evidens, (b) **kandidatkilde** (`StoryCandidate.origin="signal"`, `sourceAuthority` arvet fra den matchede række, så registrets primærdata-kriterium også gælder disse), (c) dedupe-reference. AI-udkast fra politi/112 er fortsat spærret (`createIngestDraft`).
4. **`localrating`-ejede rækker:** LocalRating poller og skaber `SourceItem`s. aI-library må **ikke** samtidig have en agent for samme kilde. Skift af ejer er en **to-trins, manuel handling** (checklist i UI): (i) slå aI-librarys agent for kilden fra, (ii) sæt `ingestOwner="localrating"`, (iii) aktivér. Operatøren/AI kan ikke skifte ejer (`confirm`, kun menneske).
5. **Konkret dedupe-regel (sikkerhedsnet mod dobbelt-ingest):** i `dedupeItem` trin (5) slås en ny `SourceItem` op mod `Signal` i vinduet (14 dage) på **`urlNorm` eller `contentHash` eller (vært + titel-lighed ≥ 0,9 + |Δ publiceret| ≤ 24 t)**. Træf ⇒ `DUPLICATE`, `dedupeReason="signal"`, `storyMatches += { signalId }` — ingen ny kandidat. I den anden retning rører LocalRating **aldrig** Signal-ingest (kernen uændret); derfor kan en `Signal` ikke dedupes mod en senere `SourceItem` — reglen er envejs og forudsætter at `ingestOwner` er korrekt. **Drift-vagt:** `RECONCILE` tæller pr. `localrating`-ejet kilde antal `Signal`s siste 24 t med samme vært; ≥ 3 ⇒ advarsel "mulig dobbelt-ingest" i `/redaktion/produktion/drift` og kilden sættes `status="degraded"` til ejeren har afgjort.
6. **`ailibrary`-agenter er uændrede.** LocalRating ændrer ikke aI-library (Firebase-repo) eller Signal-API'et.

**Hvorfor "observeret" frem for "emitteret":** CMS-kernen må ikke ændres, så den kan ikke skrive til LocalRatings outbox ved publicering. En reconciliation-handler er den eneste løsning uden kernekobling; ulempen er op til 15 minutters forsinkelse (acceptabelt: ingen forretningsprocess afhænger af realtid). Hvis ejeren senere tillader en minimal hook i `publishArticle`, kan `*_OBSERVED` blive til push uden at ændre handlerne.

**Fejl/dead-letter:** event-job med `dead` ses i `/redaktion/produktion/drift` (Fase 5) og kan gen-afspilles (nulstil til `queued`; dedupe beskytter). Events bærer kun id'er og små skalarer – aldrig titler/tekst/tips.

## 5. AI-operatør og værktøjsregister (LocalRating-værktøjer)

**Status i CMS'et på auditdagen (verificeret):** AI-operatøren er under opbygning af en anden agent: `lib/operator/{types,policy,prompt,confirm,events,sanitize,audit}.ts`, `lib/operator/tools/{shared,sections,areas}.ts`, permission `OPERATOR_USE` (`lib/permissions.ts:26-27`), tabel `OperatorAction` (`prisma/schema.prisma:915`), tomme mapper `app/redaktion/operator/` og `app/api/operator/{confirm,undo}/`. Der findes endnu **ingen** `/api/operator`-route, ingen UI og intet samlet register-index (`tools/index.ts`) – hvordan registret samles er **uverificeret**; LocalRating antager mønstret `defineTool({...})` (`lib/operator/types.ts:60-87`) og at hvert værktøj eksporteres og tilføjes registret. LocalRating-værktøjerne lever i `lib/operator/tools/localrating/*.ts` (egen mappe; ét import-led i registret pr. fase) så der ikke opstår filkonflikt med operatørens egne værktøjer (spor S0/S8, se `12-…`).

**Mål (ejerens tilføjelse):** operatøren skal kunne **oprette alt** via værktøjsregistret – sektioner, artikler/kladder, feeds, kilder, kandidater, rating-/genereringskørsler, udgivelsesplaner, simulatorscenarier, prompt-versioner m.m. – inden for brugerens egne rettigheder. LocalRating-værktøjer **registreres fase for fase** (en værktøjsfase følger hver leverance-fase).

**Regler fra operatørens eksisterende kontrakt (genbruges uændret):** risikoniveauer `read` (udføres direkte), `safe-write` (udføres + `AuditLog` + fortryd-recept), `confirm` (modellen *foreslår*; først efter brugerens klik "Anvend" med engangs-token, `CONFIRM_TTL_MS` 10 min), `blocked` (findes ikke; `BLOCKED_TOOLS`, `lib/operator/policy.ts:50-62`); `permissions` = mindst én, `alsoRequires` = alle; maks 8 værktøjskald/tur og 20 elementer/kald; `instansId` og bruger kommer aldrig fra modellen (`ToolCtx`, `types.ts:11-21`); værktøjsresultater er **HENTET INDHOLD** (`<hentet_indhold>`, `prompt.ts`), operatørprompten har selv SYSTEM/BRUGER/HENTET-adskillelsen (`prompt.ts:11-22`).

**LocalRating-tilføjelser til disse regler:**
1. Værktøjer kalder **servicelaget** (`lib/localrating/**`, `lib/prompts/**`) som selv tjekker rettigheder/instans/budget – aldrig `db` direkte.
2. **Rights-gate gælder også operatøren** (operatørmodellen er en AI-modtager): værktøjer returnerer højst det en `aiInput`-regel tillader (`metadata_only` ⇒ kun overskrift/URL/kilde; aldrig `rawPayload`, aldrig tipindhold – kun tællinger).
3. **AI-forbrug = `confirm`.** Alt der udløser AI-kald/penge (rating, generering, faktatjek, assistent, simulator med AI-plan, playground med rigtig AI) er `confirm`, og `details()` viser **estimeret pris** og månedsforbrug (`09-…` §4); `blocked_budget` returneres som værktøjsfejl.
4. **Aldrig publicering.** Eksisterende `BLOCKED_TOOLS` dækker publicering/forside-godkendelse; LocalRating **tilføjer** blokerede handlinger: ændring af forbrugsloft, udbyder-/`allowedProviders`-indstillinger (inkl. DeepSeek), nøgler, rettigheds-/rollerelaterede `production.*`-ændringer (`set_budget`, `raise_budget`, `set_provider`, `enable_deepseek`, `grant_production_permission`) → henvisning til `/redaktion/produktion/indstillinger`. Operatøren kan **ikke** aktivere en prompt eller en ratingprofil uden brugerens klik (`confirm`), og `approve_snapshot`/`publish_layout` forbliver blokeret (Anvend-som-forslag er `confirm` og skriver kun status `forslag`). **Kilderegistrene (3. oktober 2026) tilføjer blokerede handlinger:** aktivering af en kilde der ikke er `godkendt`, ændring af `approvalStatus` uden brugerklik, hævning af `rightsLevel`/`authorityLevel` uden `production.rights.manage`-klik, og aktivering af Ritzau nyhedstjeneste uden licens (`enable_unapproved_source`, `set_approval_status`, `raise_source_rights`) — operatøren (AI) kan kun *foreslå*; kun et menneske klikker "Anvend" (ADR-015).
5. **Idempotens og dedupe:** oprettelsesværktøjer bruger `dedupeKey`/unikke nøgler (feed `urlNorm`, kandidat `inputHash`, kørsel `articleExternalId`), så et gentaget operatørkald ikke giver dubletter.
6. **Fortryd** gives kun for objekter operatøren selv oprettede og som endnu ikke er brugt (feed → arkivér, kladde-prompt → arkivér, scenarie/plan-udkast → slet, kandidat-beslutning → gendan). Eksterne hentninger og AI-kald kan ikke fortrydes (kun "afvis resultat").
7. Alle skrivende værktøjer logges i `AuditLog` (`operator.<værktøj>`) **og** i `OperatorAction`; prompt-version og `OPERATOR_PROMPT_VERSION` følger med.

### 5.1 Værktøjsliste og risikoniveau pr. værktøj

Kolonnen **Fase** = den LocalRating-fase hvor værktøjet registreres. Rettighed = `permissions` (mindst én) + `alsoRequires` (alle); alle kræver desuden `operator.use`. `LR` = `production.*`. Kategori i UI: "LocalRating" (feeds/kandidater/rating/generering), "Prompter", "Simulator", "Arbejdsrum".

| Værktøj | Fase | Risiko | Rettigheder | Hvad det gør / bemærkning |
|---|---|---|---|---|
| `lr_status` | 1 | read | `LR.view` | Aktiveret/ikke, budget brugt, sidste cron, kø-dybde |
| `lr_usage` | 1 | read | `LR.view` | Forbrug pr. opgave/udbyder/periode |
| `prompts_list`, `prompts_get` | 1 | read | `prompts.view` | Kerne- (kode) og DB-prompter; fuld tekst |
| `prompts_create_draft` | 4 | safe-write | `prompts.edit` | Ny *udkast*-version af DB-prompt (ikke aktiv); fortryd = arkivér |
| `prompts_activate`, `prompts_rollback` | 4/7 | **confirm** | `prompts.edit` | Kort viser diff-resumé; kræver playground-kontraktbestået (Fase 7) |
| `prompts_playground_run` | 7 | **confirm** (rigtig AI) / read (falsk AI) | `prompts.view` + `LR.ai.use` | Pris vises |
| `feeds_list`, `feed_get` | 2 | read | `LR.view` | Status, seneste hentning, fejl; ingen rå indhold |
| `feed_test` | 2 | read (netværk, `safeFetch`) | `LR.manage` | Viser parser-lag, antal items (overskrifter efter rights), robots, `aiHostile`; rate-limited |
| `feed_create` | 2 | safe-write | `LR.manage` | Opretter **deaktiveret**, `metadata_only`; SSRF-test; fortryd = arkivér |
| `feed_update` | 2 | safe-write | `LR.manage` | Navn/interval/kategori/geo/trust (ikke rights) |
| `feed_enable`, `feed_disable` | 2 | **confirm** / safe-write | `LR.manage` | Tænd = start ekstern hentning (confirm); sluk = safe-write |
| `feed_set_rights` | 2 | **confirm** | `LR.rights.manage` | Kun med `rightsNote`; `aiHostile` kræver ekstra begrundelse; sænkning udløser minimering |
| `feed_fetch_now` | 2 | safe-write | `LR.manage` | Lægger `FETCH_FEED`-job i kø (ingen AI) |
| `feed_import_y_list` | 2 | **confirm** | `LR.manage` | Dry-run først; maks 50; alle deaktiveret; `foreslået` |
| `sources_import` | 2 | **confirm** | `LR.manage` | Kører `sources:import` (kun filer fra `source-registries/`); dry-run-rapporten vises i kortet; alle rækker `enabled=false`, `foreslået` |
| `sources_check` | 2 | read (netværk, `safeFetch`) | `LR.manage` | robots/`aiHostile`/feed-discovery/adaptertest pr. kilde; rate-limited; sætter ikke `robotsTermsCheckedAt` |
| `source_approve`, `source_reject` | 2 | **confirm** | `LR.manage` (+ `LR.rights.manage` ved PRIMARY_*-autoritet eller rights > `metadata_only`) | **Kun et menneske klikker "Anvend"**; AI kan foreslå men aldrig godkende (`BLOCKED_TOOLS`-linje: `source_approve` uden brugerklik findes ikke) |
| `source_set_owner` | 2 | **confirm** | `LR.manage` | Skifter `ingestOwner` (checklist for aI-library-agent, §4a) |
| `discovery_run` | 2 | **confirm** (netværk, evt. AI-triage) | `LR.manage` | Starter `discoverSources`; resultatet er kun forslag |
| `discovery_runs_list`, `entities_list` | 2 | read | `LR.view` | Kørselshistorik; `LocalEntityRef` (aliaser, CVR-poster uden persondata) |
| `entity_approve` | 2 | **confirm** | `LR.manage` | Godkend alias/entitet (kun mennesker; tæller først i `localityScore` derefter) |
| `feed_archive` | 2 | safe-write | `LR.manage` | Aldrig sletning |
| `feed_items_list` | 2 | read | `LR.view` | Titler/URL/dato (rights-gated) |
| `candidates_list`, `candidate_get` | 3 | read | `LR.view` | Overskrift, bånd, A/B/C-forslag, delscorer; **kun tilladt tekst** |
| `candidate_create_manual` | 3 | safe-write | `LR.manage` | Fra indsat tekst/URL (origin `manual`); dedupe |
| `candidate_decide` | 3 | safe-write | `LR.manage` | accept / afvis / arkivér; fortryd = gendan status |
| `rating_run` / `rating_run_batch` (≤ 20) | 3 | **confirm** | `LR.ai.use` | Model `local` eller `score` (Local Score); pris vises |
| `rating_get`, `rating_compare` | 3 | read | `LR.view` | Delscorer, begrundelser, score-vs-local |
| `rating_profile_create_draft` | 3 | safe-write | `LR.manage` | Ny profilversion (udkast) |
| `rating_profile_activate` | 3 | **confirm** | `LR.manage` | "forhåndsvis på seneste 50" vises |
| `score_text` (Local Lab "Rate tekst") | 3 | **confirm** | `LR.ai.use` | Opretter manuel kandidat + kørsel |
| `workspace_create` | 4 | safe-write | `LR.view` + `article.create` | Fra kandidat/kørsel/indsat kilde |
| `workspace_add_source` | 4 | safe-write | samme | Tekst/fil (parse-file)/URL via `safeFetch` (ingen paywall-omgåelse) |
| `workspace_update_draft`, `workspace_set_format` | 4 | safe-write | samme | Fortryd = forrige draft-version |
| `workspace_message` | 4 | **confirm** | `LR.ai.use` | Én chat-tur (pris); svar bliver udkast-forslag, ikke gem |
| `generation_start` (`kind`: article / citation / citation_lang / synthese) | 4 | **confirm** | `LR.ai.use` + `article.create` | Profil + sektion; pris; preflight-blokeringer vises |
| `generation_get`, `library_list` | 4 | read | `LR.view` | Status, guardrail-/faktatjek-resumé, Bibliotek |
| `factcheck_run` | 4 | **confirm** | `LR.ai.use` | |
| `assistant_run` (`coeditor`, `angle`, `bulletin`, `dagens_tal`, `deep_research`, `compare`, `semantic_search`, `score_sources`, `optimize_query`, `extract_sources`, `summary`) | 4 | **confirm** | `LR.ai.use` | Pr. `kind`; pris |
| `research_run`, `verify_claim_run` | 4 | **confirm** | `LR.ai.use` | Kræver `EXA_API_KEY`; ellers fejl |
| `parse_file` | 4 | **confirm** | `LR.ai.use` | Fil via UI-upload (operatøren får filreference, ikke bytes) |
| `draft_handover` | 4 | **confirm** | `LR.ai.use` + `article.create` | `createIngestDraft` (status `Idé`); kort viser guardrail-/faktatjek-status, kilder, sektion; **aldrig publicering**; kræver redaktørkommentar ved blokerende fund |
| `jobs_list`, `reconcile_status` | 5 | read | `LR.view` | |
| `job_retry` | 5 | safe-write | `LR.manage` | `dead` → `queued` |
| `lr_set_scheduler`, `lr_set_simulator`, `lr_set_knowledge` | 5 | **confirm** | `LR.manage` | Instans-flag; budget/udbyder **blokeret** |
| `scenario_create`, `scenario_update` | 6 | safe-write | `simulator.use` | Rigtige/syntetiske artikler, hændelser, ur |
| `simulation_run` (uden AI) | 6 | safe-write | `simulator.use` | Skriver kun `SimulationRun` |
| `simulation_run` (med AI-plan) | 6 | **confirm** | `simulator.use` + `LR.ai.use` | Pris |
| `simulation_get`, `plans_list`, `plan_get` | 6 | read | `simulator.use` | |
| `plan_create_manual`, `plan_item_update` | 6 | safe-write | `simulator.use` | Udkast; fortryd = slet udkast |
| `plan_approve`, `plan_reject` | 6 | **confirm** | `simulator.use` + `frontpage.edit` | Markerer poster; **udfører intet** |
| `priority_set` (A/B/C) | 6 | safe-write | `frontpage.edit` | `EditorialPriority`; fortryd |
| `simulator_apply_as_proposal` | 6 | **confirm** | `simulator.use` + `frontpage.edit` | Skriver `FrontpageSnapshot(status=forslag)`; erstatter nuværende forslag (vises) |
| *(eksisterende operatørværktøjer)* sektioner, områder, artikelkladder m.m. | – | iflg. operatørens register | iflg. register | LocalRating ændrer dem ikke |

**Mangler/åbent:** operatørens register indeholder pt. kun sektioner og områder (`tools/sections.ts`, `tools/areas.ts`); artikelkladde-, signal- og forside-værktøjer forventes tilføjet af operatør-sporet. LocalRating afhænger ikke af dem, men `workspace_create`/`draft_handover` bruger samme `createIngestDraft`-sti.

### 5.2 Tests (`tests/localrating-operator-*.test.ts`)
Hvert værktøj: rettigheder (any-of/also), tenant (fremmed id ⇒ "findes ikke"), risiko-politik (confirm udfører intet før token), rights-gate på udgående data (ingen `rawPayload`/tipindhold), budget (`blocked_budget`), idempotens, `AuditLog`/`OperatorAction`-spor, fortryd-recept, injektion (feedtitel med "ignorer reglerne" ⇒ ingen handling; resultat står i `<hentet_indhold>`), blokerede navne afvises (`set_budget` m.fl.).

## 6. Chat-/operator-UI: skillet `chat-module`

Alle chat-lignende flader i LocalRating følger skillet **`chat-module`** (besked-rendering, auto-scroll, streaming-indikator, input, kopi-knap, fejl/retry): **AI-operatøren** (`/redaktion/operator`), **Local Arbejdsrum** (chat-panel), **prompt-playground** og **simulatorens "forklar/spørg"-panel** (`08-…` §8). De bygges på **delte komponenter** i `cms/components/chat/` (ny mappe) i stedet for at hver side finder sin egen løsning:

| Skill-område | Krav (fra skillet) | Konkret i LocalRating |
|---|---|---|
| 1. Besked-rendering | Streaming-sikker markdown (tåler ufuldstændig markdown), `remark-gfm` (tabeller), synlige kodeblokke, links `target=_blank rel="noopener noreferrer"` | `MessageBody` med `streamdown` (anbefalet) eller `react-markdown` + `remark-gfm`; **ny afhængighed – ejerbeslutning D23**. Al AI-tekst renses/escapes (ingen rå HTML); arbejdsrums-`:::`-blokke renderes som komponenter. CMS bruger Next + egne CSS-klasser (`chat-*`), ikke Tailwind – mønstrene overføres, ikke klasserne |
| 2. Auto-scroll | Kun hvis brugeren er nederst (≤ 100 px), `{ block: "end" }` uden `smooth` | `useStickToBottom()` (delt hook) |
| 3. Streaming-/typing-indikator | Tre prikker, `prefers-reduced-motion` ⇒ statisk "Skriver…" | `TypingIndicator`; operatør viser desuden `tool_call`/`tool_result`-kort fra NDJSON-events (`lib/operator/events.ts:7-23`) |
| 4. Input | Enter sender, Shift+Enter linjeskift, auto-grow ≤ ~160 px, disabled mens der streames, send disabled ved tomt input | `ChatInput` |
| 5. Kopi-knap | På hver AI-besked (synlig ved hover/fokus), `aria-label` skifter | `CopyButton` |
| 6. Fejl/retry | Mislykket besked vises som fejltilstand med "Prøv igen" (gensend sidste brugerbesked); NDJSON `error`-event ⇒ retry | `RetryBar`; `confirm_required` ⇒ bekræftelseskort (Anvend/Annuller, TTL-nedtælling); `undo` ⇒ "Fortryd"-knap |

Tilgængelighed: `aria-live="polite"` på nyeste AI-besked, fokus tilbage til input efter svar, tastaturbetjent bekræftelseskort, kontrast (jf. `FIX-design`).

**Audit af eksisterende `/redaktion/chat` (`app/redaktion/chat/chat-interface.tsx`):** scroller med `scrollIntoView({behavior:"smooth"})` ved *hver* ændring (`:26-28`) – bryder skill-punkt 2 (hopper ned under læsning); renderer ren tekst i `chat-bubble` uden markdown/tabeller (punkt 1); ingen kopi-knap (punkt 5); fejl **erstatter** beskeden med "Der opstod en fejl" uden retry (punkt 6); inputfeltet er ikke `disabled` under streaming (punkt 4, sendning blokeres dog i `send`). **Fase 0 ændrer intet**; de nye komponenter bygges først til operatør/arbejdsrum, og ejeren beslutter (D24), om `/redaktion/chat` skal migreres til dem (adfærdsændring i et eksisterende modul).
