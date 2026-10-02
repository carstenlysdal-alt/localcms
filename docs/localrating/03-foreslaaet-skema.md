# 03 – Foreslået skema (Prisma) – kun forslag, ingen migration

Dato: 2. oktober 2026 (opdateret 3. oktober 2026: kilderegistre for Næstved/Slagelse ⇒ `SourceDefinition`/`SourceItem`, se §2a). Status: Fase 0. **Intet i dette dokument er anvendt:** `prisma/schema.prisma`, `prisma/postgres/schema.prisma` og `prisma/postgres/migrations/` er ikke ændret. Modellerne herunder indsættes først i Fase 1+ efter ejerens godkendelse, via `npm run prisma:pg:migration -- localrating_<navn>` (flow: `docs/ops/RAILWAY-SETUP.md` §0).

## 0. Skemaprincipper

1. **Kun additivt.** Kun `CREATE TABLE`/`CREATE INDEX`. `Article`, `Signal`, `Instance`, `GeoTag`, `Category`, `ArticleRevision`, `AuditLog` og alle `Frontpage*` er uændrede (inkl. ingen nye relationsfelter på dem – derfor ingen Prisma-relation *til* eksisterende modeller).
2. **Cross-provider** (SQLite dev + PostgreSQL prod): enums er `String` valideret af zod i `lib/localrating/**` (som `Article.status`, `schema.prisma:198`); lister/strukturer er `Json`; ingen `@db.*`, ingen Prisma-enums, ingen `BigInt`/`Decimal` (omkostning gemmes som heltal **mikro-USD**). `Json @default("[]")` er allerede brugt (`Topic.kategorier`, `schema.prisma:410`).
3. **Tenant.** Alle tabeller har `instansId String` + indeks. Ingen `instansId = null`. Standard-data (profiler/prompter) seedes *pr. instans*.
4. **Tenant-sikre fremmednøgler** (*uverificeret mod `prisma validate` – skemaet er ikke kørt; Fase 1 starter med at validere at to sammensatte relationer kan dele skalarfeltet `instansId`, og falder ellers tilbage til bløde pegere + servicetjek*). Obligatoriske forældrelinks bruger sammensatte FK'er `(instansId, parentId) → (instansId, id)` (kræver `@@unique([instansId, id])` på forælderen), så en række aldrig kan pege på en anden instans' forælder – håndhævet af databasen. Valgfrie links (og links til eksisterende CMS-tabeller) er **bløde** `String?` uden relation (Prisma kræver at en sammensat relation er helt påkrævet eller helt valgfri).
5. **Uforanderlige versionsrækker.** `*Version`-tabeller og `RatingRun`/`GenerationRun.result` er append-only (kun `status`/`note` kan ændres på versionsrækker; håndhæves i servicelaget + test).
6. **Ingen hemmeligheder i tabeller.** Ingen API-nøgler (plan beslutning 2: kun globale Railway-variabler).
7. **Status-/typekoder er engelske, UI er dansk.** (Som spec'ens `NEW/DUPLICATE/UPDATE/RELATED`; forsidemodellen bruger danske koder – de to systemer blandes ikke i samme kolonne.)
8. **Størrelsesgrænser** (håndhæves ved indsættelse, ikke i DB): `SourceItem.rawPayload` ≤ 64 KB, `description` ≤ 8.000 tegn, `detectedPlaces` ≤ 20, `detectedEntities` ≤ 50, `detectedClaims` ≤ 20 (hver ≤ 300 tegn), `GenerationRun.result` ≤ 256 KB.
9. **Kilderegisteret er data, ikke kode** (ejerens kilderegistre for Næstved og Slagelse, `source-registries/`): ingen kildenavne, URL'er, prioriteter eller geo-aliaser i kode; alt ligger som `SourceDefinition`-rækker pr. instans (importeret fra registrenes markdown, `10-…` §11c). Registrenes engelske kodeord (`accessMode`, `authorityLevel`, `P0/P1/P2`) bevares som `String`-værdier (princip 2: ingen Prisma-enums; valideres af zod).

## 1. Modeloversigt og migrationsrækkefølge

| Migration (navn) | Fase | Tabeller | Begrundelse |
|---|---|---|---|
| `localrating_foundation` | 1 | `LocalRatingConfig`, `AiUsage`, `ProductionJob`, `IngestionLog`, `PromptTemplate`, `PromptTemplateVersion`, `SourceDefinition`, `SourceItem` | Fælles grundlag + kilderegister som data (plan Fase 1; `SourceDefinition`/`SourceItem` hed `FeedSource`/`FeedItem` før kilderegistrene, se §2a) |
| `localrating_sources` | 2 | `SourceDiscoveryRun`, `LocalEntityRef` | Discovery-kørsler og lokale entiteter/aliaser (kommunekode, postnr., CVR/P-nummer, institutioner, stedaliaser) til lokal-relevans-scoring (`10-…` §11e). **Ny ift. forrige Fase 0-udkast** (kilderegistrene) |
| `localrating_candidates_rating` | 3 | `StoryCandidate` (inkl. `localityScore`, `sourceAuthority`, klynge-felter), `RatingProfile`, `RatingProfileVersion`, `RatingRun` | Kandidater og rating |
| `localrating_generation` | 4 | `GenerationProfile`, `GenerationRun`, `LocalWorkspace`, `AssistantRun` | Generering, Citation/Syntese, Local Arbejdsrum og assistenter (paritet med Y-familien) |
| `localrating_planning` | 6 | `EditorialPriority`, `PublicationPlan`, `PlanItem`, `SimulationRun` | Simulator/udgivelsesplan |

**Rækkefølgen er bundet af afhængigheder:** `SourceItem` → `SourceDefinition` (FK i foundation); `LocalEntityRef`/`SourceDiscoveryRun` peger blødt på `SourceDefinition`/`GeoTag` (Fase 2); `StoryCandidate.localityScore` kræver `LocalEntityRef` (Fase 3).

**Afvigelse fra planen:** `LocalRatingConfig` (feature-flag + forbrugsloft + aktiv profil pr. instans) er ikke i planens tabelliste. Alternativet (kun env-variabler som `LOCALRATING_ENABLED_INSTANCES`) kan ikke bære månedligt loft/aktiv profil pr. instans uden hardcodede domæner. Åbent spørgsmål i `README.md` nr. 1.

## 2. Modeller

> Notation: `// FK` = tenant-sikker sammensat relation; `// soft` = bløde pegere uden DB-FK.

```prisma
// ═══════════════════════════ LocalRating (additivt) ═══════════════════════════
// Spec: docs/localrating/03-foreslaaet-skema.md. Kode: lib/localrating/**, lib/ai/**, lib/prompts/**.

/// Feature-flag og grænser pr. instans. Én række pr. instans (oprettes når LocalRating aktiveres).
model LocalRatingConfig {
  id                         String   @id @default(cuid())
  instansId                  String   @unique
  enabled                    Boolean  @default(false)  // master-switch: slukket => ingen cron-arbejde, ingen UI-handlinger der koster
  schedulerEnabled           Boolean  @default(false)  // cron må hente feeds/køre jobs for instansen
  simulatorEnabled           Boolean  @default(false)
  knowledgeEnabled           Boolean  @default(false)  // valgfri Knowledge-kontekst (fail-closed; kun én instans i v1)
  translationEnabled         Boolean  @default(true)
  activeRatingProfileId      String?  // soft -> RatingProfile.id
  shadowRatingProfileId      String?  // soft -> kører parallelt til sammenligning (score vs local)
  defaultGenerationProfileId String?  // soft
  defaultProvider            String   @default("anthropic") // anthropic | gemini | deepseek
  allowedProviders           Json     @default("[\"anthropic\"]") // string[]; deepseek kun hvis ejeren har godkendt (GDPR)
  monthlyBudgetMicroUsd      Int      @default(0)      // 0 = AI spærret (fail-closed); loft pr. kalendermåned (UTC)
  maxItemsPerFetch           Int      @default(100)
  itemRetentionDays          Int      @default(90)     // SourceItem uden kandidat slettes efter N dage
  updatedById                String?
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
}

/// Én række pr. AI-kald (også fejlede og blokerede). Grundlag for forbrugsoversigt og månedsloft.
model AiUsage {
  id               String   @id @default(cuid())
  instansId        String
  period           String   // "YYYY-MM" (UTC) — hurtig sum pr. måned
  task             String   // triage | rating | translate | generate | factcheck | coeditor | angle | planner | playground | workspace | research | parse_file | extract | data_ask | operator | other
  provider         String   // anthropic | gemini | deepseek | fake
  model            String
  inputTokens      Int      @default(0)
  outputTokens     Int      @default(0)
  cacheReadTokens  Int      @default(0)
  cacheWriteTokens Int      @default(0)
  costMicroUsd     Int      @default(0) // estimeret (prisliste-version i priceVersion)
  priceVersion     String?
  status           String   // ok | error | timeout | circuit_open | blocked_budget | blocked_policy | invalid_output
  errorCode        String?  // kort kode, aldrig svartekst/nøgle
  latencyMs        Int      @default(0)
  attempt          Int      @default(1)
  runKind          String?  // RatingRun | GenerationRun | SimulationRun | Playground | SourceItem
  runId            String?  // soft
  promptVersionId  String?  // soft -> PromptTemplateVersion.id
  userId           String?
  createdAt        DateTime @default(now())

  @@index([instansId, period, provider])
  @@index([instansId, createdAt])
  @@index([runKind, runId])
}

/// Jobkø + tabel-baseret outbox (domain events er jobs med kind "event:<TYPE>"; ADR-012).
model ProductionJob {
  id          String    @id @default(cuid())
  instansId   String
  kind        String    // FETCH_FEED (poll/hent en SourceDefinition) | PROCESS_ITEM | TRANSLATE_ITEM | RATE_CANDIDATE | GENERATE_DRAFT | FACTCHECK | KNOWLEDGE_CONTEXT | SIMULATE | RECONCILE | HOUSEKEEPING | DISCOVER_SOURCES | DISCOVER_SEED | DISCOVER_HOST | event:<EVENT_TYPE>
  status      String    @default("queued") // queued | running | done | failed | dead | cancelled
  priority    Int       @default(100)      // lavere = først
  payload     Json
  result      Json?
  attempts    Int       @default(0)
  maxAttempts Int       @default(5)
  runAfter    DateTime  @default(now())
  lockedUntil DateTime? // lease; reaper sætter udløbne tilbage til queued
  lockedBy    String?   // procesens id
  dedupeKey   String?   // idempotens: unik pr. instans for ikke-null
  createdById String?
  lastError   String?   // trunkeret, ingen hemmeligheder
  startedAt   DateTime?
  finishedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([instansId, dedupeKey])
  @@index([status, runAfter, priority])
  @@index([instansId, kind, status])
}

/// Én række pr. hentning/poll af en kilde (SourceDefinition; også ikke-ændrede og blokerede).
model IngestionLog {
  id            String   @id @default(cuid())
  instansId     String
  sourceId      String?  // soft -> SourceDefinition.id
  runId         String?  // cron-/job-kørsel
  jobId         String?  // soft
  startedAt     DateTime @default(now())
  finishedAt    DateTime?
  outcome       String   // ok | not_modified | error | skipped_backoff | skipped_robots | skipped_unapproved | skipped_unchecked | blocked_rights | blocked_ssrf | blocked_pii | parse_failed | quality_filtered | auth_missing (API-nøgle ikke sat) | adapter_missing
  httpStatus    Int?
  bytes         Int?
  durationMs    Int?
  itemsSeen     Int      @default(0)
  itemsNew      Int      @default(0)
  itemsUpdated  Int      @default(0)
  itemsDuplicate Int     @default(0)
  itemsFiltered Int      @default(0)
  parserUsed    String?  // rss-parser | sanitized | loose | json | <parserType-adapter> (odata, gtfs, datex2, html-change …)
  etagUsed      Boolean  @default(false)
  errorCode     String?  // fx ssrf_private_ip | too_large | timeout | dns | tls | http_4xx | http_5xx | parse
  errorMessage  String?  // trunkeret (≤ 300), ingen URL-hemmeligheder
  createdAt     DateTime @default(now())

  @@index([instansId, sourceId, startedAt])
  @@index([instansId, startedAt])
}

/// Prompt-skabelon (identitet). Teksten ligger i PromptTemplateVersion. Kerne-prompts i kode er IKKE her (read-only i registret).
model PromptTemplate {
  id              String   @id @default(cuid())
  instansId       String
  slug            String   // fx "rating.score", "rating.local", "generate.news", "factcheck", "translate", "simulator.planner", "base.sprog"
  name            String
  purpose         String
  ownerModule     String   // localrating | simulator
  task            String   // triage | rating | translate | generate | factcheck | coeditor | angle | planner
  kind            String   @default("system") // system | format | base | user_template
  language        String   @default("da")
  variables       Json     @default("[]")      // [{ name, description, required, source: "system"|"user"|"retrieved" }]
  activeVersionId String?  // soft -> PromptTemplateVersion.id
  locked          Boolean  @default(false)     // true => kun læsbar (fx sikkerheds-præambel-fragmenter)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  versions PromptTemplateVersion[]

  @@unique([instansId, slug])
  @@unique([instansId, id])
}

model PromptTemplateVersion {
  id              String   @id @default(cuid())
  instansId       String
  templateId      String
  template        PromptTemplate @relation(fields: [instansId, templateId], references: [instansId, id], onDelete: Restrict) // FK
  version         Int
  body            String   // den redigerbare tekst (uden den uforanderlige præambel, som sammensættes i kode)
  bodyHash        String   // sha256
  preambleVersion String   // hvilken låst sikkerheds-præambel-version der blev brugt ved sidste test/aktivering
  status          String   @default("draft") // draft | active | archived
  note            String?
  createdById     String?
  createdAt       DateTime @default(now())
  activatedAt     DateTime?

  @@unique([templateId, version])
  @@index([instansId, status])
}

/// Kilde-definition = kilderegisteret som DATA (ejerens kilderegistre for Næstved/Slagelse; `source-registries/`). Hed `FeedSource` før
/// kilderegistrene; udvidet med registrets `SourceDefinition`-felter. Svarer til Knowledge OS' Source-begreb, ikke til en fil.
/// En række = én kilde (en API, et feed, en monitoreret side, et seed-katalog eller en manuel kilde). Child sources (fra discovery)
/// er almindelige rækker med `parentSourceId`. Oprettes ALTID `enabled=false`; AI-opdagede rækker kræver menneskelig godkendelse.
model SourceDefinition {
  id                  String    @id @default(cuid())
  instansId           String

  // ── Registrets felter (Næstved_/Slagelse_Source_Registry: "Anbefalet source-arkitektur") ──
  name                String
  sourceClass         String    // registrets "Område" som slug: politi | beredskab | vejr | trafik | infrastruktur | jernbane | bus | kollektiv_trafik | forsyning | fjernvarme | affald | sundhed | kommune | kommunalpolitik | plan | udbud | oekonomi | national_politik | lovgivning | juridisk | domstole | tilsyn | miljoe | kyst | kulturarv | demokrati | havn | erhverv | statistik | geodata | ejendom | newswire | presse | medie | aggregator | forening | lokalsamfund | skole | dagtilbud | uddannelse | kultur | sport | virksomhed | social | pr | andet (fri slug; zod-liste i `lib/localrating/sources/classes.ts`)
  authorityLevel      String    // PRIMARY_OFFICIAL | PRIMARY_ORGANIZATION | LICENSED_NEWSWIRE | SECONDARY_MEDIA | AGGREGATOR | SOCIAL_SIGNAL
  priority            String    @default("P2") // P0 | P1 | P2 (poll/push typisk 1-5 min | 15-60 min | 1-12 t; se pollIntervalMinutes og `10-…` §11f)
  accessMode          String    @default("MANUAL") // API | RSS | ATOM | EMAIL | WEBHOOK | HTML_MONITOR | SITEMAP | LICENSED_FEED | MANUAL | SEED_DIRECTORY
  urlOrEndpoint       String?   // NULL for rækker importeret uden kendt URL (registrene indeholder ingen URL'er) — kan ikke aktiveres før sat og testet
  urlNorm             String?   // CMS normalizeUrl (lib/validation/text.ts:84) — dedupe-nøgle (NULL når urlOrEndpoint er NULL)
  licenseType         String    @default("unknown") // open_data | api_terms | public_pr | own_content | media_copyright | licensed | personal_data_restricted | unknown
  instanceScope       String    @default("instance") // instance (lokal kilde) | region (fx politikreds, Region Sjælland) | national (Folketinget, Retsinformation, Statstidende: kræver strengt lokalitetsfilter før kandidat)
  geoFilter           Json      @default("{}") // { kommuneKoder:["370"], geoTagSlugs:[], aliases:[], postnumre:[], bbox?:[w,s,e,n], geometryRef?, matchMode:"any"|"strict" } — data, aldrig kode
  entityFilters       Json      @default("[]") // [{ kind:"cvr"|"pnummer"|"institution"|"person"|"organisation"|"matrikel", key, label? }] (kan pege på LocalEntityRef.id)
  keywordFilters      Json      @default("[]") // string[] (inkl./ekskl.: { include:[], exclude:[] } tilladt)
  pollIntervalMinutes Int       @default(360)  // afledt af priority ved import (P0 5, P1 30, P2 360); 0 = ingen polling (push/manual/seed); min 5 for P0-API/RSS, ellers min 15 (valideres)
  parserType          String    @default("manual") // rss-parser | atom | json-api | odata | wfs | gtfs | datex2 | html-change | html-list | pdf-monitor | sitemap | email-ingest | webhook | seed-directory | licensed-ritzau | manual (adapter-nøgle; `10-…` §11a)
  parserConfig        Json?     // typet pr. parserType: { query?, itemSelector?, regionSelector?, params?, authRef? } — INGEN hemmeligheder (nøgler = Railway-variabler; authRef er kun et variabelnavn)
  robotsTermsCheckedAt DateTime? // sidste manuelle/automatiske robots.txt- og vilkårstjek (logges i AuditLog); NULL = ikke tjekket ⇒ kan ikke aktiveres
  enabled             Boolean   @default(false)      // oprettes slået fra; tændes først når approvalStatus="godkendt", URL sat, robots/vilkår tjekket og test bestået
  lastSuccessAt       DateTime?
  lastFailureAt       DateTime?

  // ── Fælles felter fra det tidligere FeedSource (bevaret) ──
  sourceType          String    @default("andet") // CMS SOURCE_TYPES (lib/ingest/schema.ts:13): kommune_dagsorden | politi | beredskab_112 | trafik | vejr | forening | klub | lokalt_medie | kommune_pressemeddelelse | andet (mappes fra registrets "Område", `10-…` §11a)
  category            String?   // redaktionel gruppe (fri tekst, vises i UI)
  defaultSektionSlug  String?   // soft -> Category.slug (til createIngestDraft.sektion)
  geoTagId            String?   // soft -> GeoTag.id
  geoNote             String?   // fri geografi-hint ("Næstved kommune, kommunekode 370")
  language            String    @default("da")
  trustLevel          Int       @default(50)  // 0-100, redaktørens tillid (indgår i Source Quality); startværdi afledt af authorityLevel (PRIMARY_OFFICIAL 80 · PRIMARY_ORGANIZATION 65 · LICENSED_NEWSWIRE 70 · SECONDARY_MEDIA 50 · AGGREGATOR 35 · SOCIAL_SIGNAL 30)
  qualityGate         String    @default("strict")   // strict | lenient | headline_only
  status              String    @default("pending")  // pending | ok | degraded | down | disabled | moved | dead
  etag                String?
  lastModified        String?   // rå header-værdi
  lastFetchedAt       DateTime?
  lastHttpStatus      Int?
  lastError           String?
  consecutiveFailures Int       @default(0)
  nextFetchAt         DateTime  @default(now())
  knowledgeSourceRef  String?   // valgfri: Knowledge OS Source-id
  createdById         String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // ── Rettigheder (afledt af authorityLevel + licenseType; håndhævelse: `10-…` §5 og §11b) ──
  rightsLevel         String    @default("metadata_only") // EFFEKTIVT niveau: metadata_only | snippet_allowed | fulltext_allowed | licensed | blocked
  rightsLevelSuggested String   @default("metadata_only") // standard udledt af deriveRights(authorityLevel, licenseType) ved import/oprettelse (ren funktion; tabel i `10-…` §11b). Hæves til rightsLevel først ved godkendelse med production.rights.manage
  rightsNote          String?   // licens-/ToS-henvisning (påkrævet for licensed og for niveau > metadata_only)
  aiHostile           Boolean   @default(false) // robots.txt forbyder AI-crawlere (T8 §0): rightsLevel kan ikke hæves over metadata_only uden rights.manage + begrundelse
  personDataClass     String    @default("none") // none | possible | likely (retslister, CVR-personer, Statstidende, tips, sociale signaler) ⇒ no_pii-AI, redaktionel gennemgang (`10-…` §11b)
  ingestOwner         String    @default("localrating") // localrating | ailibrary | manual — ÉN ejer pr. kilde (D18/ADR-005, `04-…` §4a). "ailibrary" ⇒ LocalRating poller ikke; leverer Signal og bruges kun som dedupe-/RELATED-reference

  // ── Seed → discovery og godkendelse (ADR-015) ──
  parentSourceId      String?   // soft -> SourceDefinition.id: seed-/forældrekilde (fx Foreningsportalen -> en forenings nyhedsside); NULL for registerrækker
  discoveredBy        String    @default("registry") // registry (importeret fra kilderegister) | discovery (opdaget af discoverSources) | manual | operator | y-import
  discoveryRunId      String?   // soft -> SourceDiscoveryRun.id
  approvalStatus      String    @default("foreslået") // foreslået | godkendt | afvist — ALLE importerede og opdagede rækker starter "foreslået"; AI kan aldrig sætte "godkendt"
  approvedById        String?
  approvedAt          DateTime?
  approvalNote        String?   // begrundelse (påkrævet ved "afvist" og ved godkendelse af discovery-kilder med authorityLevel PRIMARY_*)
  aiClassification    Json?     // AI-forslag fra discovery (kun forslag): { suggestedClass, suggestedAuthority, suggestedAccessMode, relevance, reason, modelVersion }; aldrig bindende
  sourceKey           String    // stabil identitet: "reg:<slug(name)>" (registerrække) | "child:<parentSourceId>:<sha1(urlNorm)[0..10]>" (discovery) | "man:<cuid>" (manuel) — gør re-import idempotent
  registryRef         String?   // fx "Naestved_Source_Registry_Artikelmotor.md#P0:Politi Update ..." (kilde-til-sandhed i source-registries/)
  registryRowHash     String?   // sha256 af den normaliserede registerrække ved import (ændringsdetektion ved re-import)
  importedFrom        String?   // fx "registry:naestved:2026-10-03" | "y-feedlist:2026-10"
  movedToUrl          String?   // sat når discovery/hentning ser permanent redirect (status="moved")

  items SourceItem[]

  @@unique([instansId, sourceKey])
  @@unique([instansId, urlNorm])        // flere NULL tilladt (rækker uden URL)
  @@unique([instansId, id])
  @@index([instansId, enabled, nextFetchAt])
  @@index([instansId, approvalStatus, priority])
  @@index([instansId, parentSourceId])
  @@index([instansId, authorityLevel])
}

/// Rå input — aldrig en Article. Original payload bevares til audit/reproducerbarhed. Hed `FeedItem` før kilderegistrene; udvidet med
/// registrets "minimum metadata fra hvert source-hit". Registrets `sourceId` = `sourceId` her; registrets `sourceItemId` = `id` her.
model SourceItem {
  id             String    @id @default(cuid())
  instansId      String
  sourceId       String
  source         SourceDefinition @relation(fields: [instansId, sourceId], references: [instansId, id], onDelete: Restrict) // FK
  externalId     String    // guid, ellers link, ellers sha256(titel|pubDate) — stabil pr. kilde (API'er: kildens eget id)
  url            String
  urlNorm        String
  canonicalUrl   String?
  title          String
  description    String?   // ren tekst (stripHtml), efter rights-gate; ≤ 8.000
  rawPayload     Json      // original item-objekt (kapped ≤ 64 KB); tomt objekt hvis rightsLevel forbyder lagring
  rawPayloadHash String    // sha256 af den kanoniserede RÅ payload FØR rights-minimering (provenance bevares selv når rawPayload ikke må lagres)
  normalized     Json?     // { headline, body, summary, language, locations[], media[], author, translation{hash,...} }
  rightsLevel    String    // snapshot af kildens niveau ved indtag
  reuseLicenceRule String  // kompakt snapshot af genbrugsreglen: "<rightsLevel>|<licenseType>|<maxQuote>" fx "metadata_only|media_copyright|no-fulltext" eller "snippet_allowed|open_data|15w"
  sourceAuthority String   // snapshot af authorityLevel ved indtag (PRIMARY_OFFICIAL … SOCIAL_SIGNAL)
  personDataClass String   @default("none") // snapshot (none | possible | likely)
  publishedAt    DateTime?
  retrievedAt    DateTime  @default(now())
  firstSeenAt    DateTime  @default(now())
  lastSeenAt     DateTime  @default(now())
  contentHash    String    // sha256(normaliseret titel + brødtekst)
  prevContentHash String?  // sat ved UPDATE
  titleHash      String
  revision       Int       @default(1)
  // ── Lokal-relevans og story-match (registrets minimum metadata; beregnes i PROCESS_ITEM, `10-…` §11e) ──
  detectedPlaces   Json    @default("[]") // [{ text, kind:"place"|"address"|"postcode"|"kommune"|"matrikel"|"coords", geoTagId?, kommuneKode?, via:"alias"|"geotag"|"postnr"|"dawa"|"geometry"|"text", confidence }] (≤ 20)
  detectedEntities Json    @default("[]") // [{ kind:"cvr"|"pnummer"|"institution"|"person"|"organisation", key?, label, entityRefId?, localRole?:"local"|"unknown", confidence }] (≤ 50; personer kun når rights/PII tillader)
  detectedClaims   Json    @default("[]") // [{ text(≤300), type:"decision"|"number"|"date"|"allegation"|"event"|"other", needsVerification }] (≤ 20; kun fra tekst AI må se)
  storyMatches     Json    @default("[]") // [{ candidateId?, storyRef?, clusterKey?, score, reason:"entity"|"place"|"cluster"|"title"|"knowledge" }]
  localityScore    Int?    // 0-100: kombineret lokal relevans (deterministisk, `10-…` §11e); NULL = ikke beregnet
  localityBreakdown Json?  // [{ signal, matched, weight, contribution }] + { rule, cap?, floor? } — gør scoren forklarlig og testbar
  duplicateScore   Float?  // 0-1: højeste lighed mod eksisterende items/kandidater/artikler/signaler
  status         String    @default("new") // new | processed | candidate | duplicate | filtered | rejected | held_review | error
  dedupeResult   String?   // NEW | DUPLICATE | UPDATE | RELATED
  dedupeReason   String?   // externalId | urlNorm | contentHash | titleSimilarity | semantic | article | signal | story
  dedupeOfId     String?   // soft -> SourceItem.id
  candidateId    String?   // soft -> StoryCandidate.id
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([instansId, sourceId, externalId])
  @@index([instansId, urlNorm])
  @@index([instansId, contentHash])
  @@index([instansId, titleHash])
  @@index([instansId, rawPayloadHash])
  @@index([instansId, status, retrievedAt])
  @@index([instansId, candidateId])
  @@index([instansId, localityScore])
}

// ─── Fase 2: kilde-lag (migration `localrating_sources`) ──────────────────────────

/// Én kørsel af `discoverSources(instance)` (ugentligt) eller en manuel kørsel. Børnekilder oprettes som SourceDefinition (foreslået).
model SourceDiscoveryRun {
  id               String    @id @default(cuid())
  instansId        String
  trigger          String    @default("cron")  // cron | manual | operator
  seedSourceId     String?   // soft -> SourceDefinition.id (NULL = alle seeds)
  status           String    @default("queued") // queued | running | done | partial | failed
  steps            Json      @default("[]")     // [{ step: 1..10, name, status, durationMs, counts{} , errorCode? }] — de 10 trin fra registret (`10-…` §11d)
  stats            Json      @default("{}")     // { hostsFetched, seedRecords, officialSitesFound, feedsFound, sitemapsFound, childProposed, childUpdated, markedDead, markedMoved, aliasProposed, blockedSsrf, skippedRobots }
  startedAt        DateTime?
  finishedAt       DateTime?
  errorCode        String?   // kort kode, ingen svartekst
  createdById      String?
  createdAt        DateTime  @default(now())

  @@unique([instansId, id])
  @@index([instansId, createdAt])
}

/// Lokale entiteter og aliaser pr. instans: grundlaget for lokal-relevans uden `contains("<by>")`. Kan senere spejles mod Knowledge OS
/// (`knowledgeRef`), men LocalRating er ikke afhængig af Knowledge (ADR-004). Forslag fra discovery/CVR kræver godkendelse.
model LocalEntityRef {
  id               String    @id @default(cuid())
  instansId        String
  kind             String    // place_alias | postcode | kommune | matrikel | address | cvr | pnummer | institution | person | organisation | lokalraad | forening | skole
  key              String    // normaliseret nøgle: alias "karrebaeksminde", postnr "4736", kommunekode "370", CVR "12345678", P-nr, matrikel "123a Næstved Bygrunde"
  keyNorm          String    // slugify(key) — unik nøgle sammen med kind
  label            String    // visningsnavn ("Karrebæksminde")
  geoTagId         String?   // soft -> GeoTag.id (stednavn/alias peger på instansens GeoTag; kerne uændret)
  kommuneKode      String?   // "370" | "330"
  weight           Int       @default(60)     // 0-100: hvor stærkt signalet er (kommunekode 100, postnr 80, alias 70, CVR i kommunen 85, institution 80 …) — profilen kan overstyre
  status           String    @default("foreslået") // foreslået | godkendt | afvist
  origin           String    @default("registry")  // registry (kilderegister: geo-kerne) | discovery | cvr | dawa | manual | knowledge
  sourceId         String?   // soft -> SourceDefinition.id (hvor aliaset/entiteten blev set)
  knowledgeRef     String?   // valgfri Knowledge OS-id
  meta             Json?     // { postnr?, adresse?, branche?, medarbejdere?, validFrom?, validTo? } — ingen persondata om privatpersoner uden redaktionel godkendelse
  approvedById     String?
  approvedAt       DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@unique([instansId, kind, keyNorm])
  @@unique([instansId, id])
  @@index([instansId, status, kind])
  @@index([instansId, geoTagId])
}

// ─── Fase 3 ───────────────────────────────────────────────────────────────────

/// Pre-publication-objektet: noget systemet mener potentielt kan blive journalistik. Aldrig en Article.
model StoryCandidate {
  id                  String    @id @default(cuid())
  instansId           String
  title               String
  summary             String?
  origin              String    @default("feed") // feed (= SourceItem fra en kilde) | manual | signal | submission — "manual" = Local Lab/Arbejdsrum (indsat tekst/URL/fil); alle rating-/genereringskørsler hænger på en kandidat
  status              String    @default("new") // new | rated | review | accepted | rejected | drafting | drafted | blocked | archived | lab (manuelt input der ikke indgår i inbox)
  blockedReason       String?   // restricted_source_type | restricted_category | rights | policy
  sourceRefs          Json      @default("[]")  // [{ sourceItemId, sourceId, url, rightsLevel, sourceType, sourceAuthority, localityScore, role: "primary"|"supporting" }]
  inputRefs           Json      @default("[]")  // ikke-feed input: [{ kind: "signal"|"submission"|"manual", id }]
  primarySourceItemId   String?   // soft
  storyRef            String?   // soft -> Knowledge Story (valgfri)
  entityRefs          Json      @default("[]")
  topicRefs           Json      @default("[]")
  locationRefs        Json      @default("[]")  // [{ geoTagId?, text, via: "slug"|"navn"|"normaliseret"|"postnr"|"text" }]
  geoTagIds           Json      @default("[]")  // string[] (GeoTag.id i instansen)
  restricted          Boolean   @default(false) // politi/112-kildetype eller Krimi/Sundhed: AI-udkast spærret af createIngestDraft
  dedupeResult        String    @default("NEW") // NEW | DUPLICATE | UPDATE | RELATED
  relatedCandidateIds Json      @default("[]")
  clusterKey          String?
  // ── Lokalitet og kildeautoritet (kilderegistrene; `05-…` §5.1b, `10-…` §11e) ──
  localityScore       Int?      // 0-100: kandidatens kombinerede lokal-relevans (max over primære sourceRefs, jf. regler i `10-…` §11e); NULL = ikke beregnet
  localityBreakdown   Json?     // [{ signal, matched, weight, contribution }] + regler — samme form som SourceItem.localityBreakdown
  sourceAuthority     String?   // højeste autoritet blandt sourceRefs: PRIMARY_OFFICIAL > PRIMARY_ORGANIZATION > LICENSED_NEWSWIRE > SECONDARY_MEDIA > AGGREGATOR > SOCIAL_SIGNAL
  storyClusters       Json      @default("[]") // [{ key:"harbor"|"coast"|"utilities"|"naestved-roennede"|"storebaelt"|…, score, via:"entity"|"place"|"source"|"keyword" }] — klyngenøgler er profildata (`05-…` §5.1b), aldrig kode
  firstPrimarySeenAt  DateTime? // første gang en PRIMARY_*-kilde så historien (min. over sourceRefs/RELATED)
  firstSecondarySeenAt DateTime? // første gang SECONDARY_MEDIA/AGGREGATOR så samme klynge (via dedupe/RELATED) — NULL hvis aldrig set
  primaryFirst        Boolean?  // firstPrimarySeenAt < firstSecondarySeenAt (eller sekundær aldrig set). Registrets succeskriterium; måles i metrikker (`05-…` I21)
  personDataClass     String    @default("none") // none | possible | likely — arvet (højeste) fra sourceRefs; likely ⇒ restricted=true og status "review" før generering
  latestRatingRunId   String?   // soft
  latestScore         Float?    // fra aktiv profil (til inbox-sortering)
  latestBand          String?   // IGNORE | REVIEW | POTENTIAL | HIGH | URGENT
  latestPriority      String?   // A | B | C (forslag)
  articleId           String?   // soft -> Article.id
  latestGenerationRunId String? // soft
  decidedById         String?
  decidedAt           DateTime?
  expiresAt           DateTime? // ikke-behandlede kandidater arkiveres
  firstSeenAt         DateTime  @default(now())
  lastActivityAt      DateTime  @default(now())
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  ratingRuns     RatingRun[]
  generationRuns GenerationRun[]

  @@unique([instansId, id])
  @@unique([instansId, articleId]) // højst én kandidat pr. artikel (flere NULL tilladt)
  @@index([instansId, status, latestScore])
  @@index([instansId, clusterKey])
  @@index([instansId, localityScore])
  @@index([instansId, sourceAuthority, firstSeenAt])
  @@index([instansId, lastActivityAt])
}

/// Rating er konfiguration: en profil har versioner (dimensioner, vægte, tærskler, regler som data).
model RatingProfile {
  id              String   @id @default(cuid())
  instansId       String
  slug            String   // "default-local-news" | "local-score" | "breaking" | "community" | "sport" | "events" | "feed-content"
  name            String
  modelId         String   // "score" | "local" (RatingModel-implementering; "score" = Local Score, porteret Y Rating)
  description     String?
  activeVersionId String?  // soft -> RatingProfileVersion.id
  enabled         Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  versions RatingProfileVersion[]

  @@unique([instansId, slug])
  @@unique([instansId, id])
}

model RatingProfileVersion {
  id          String   @id @default(cuid())
  instansId   String
  profileId   String
  profile     RatingProfile @relation(fields: [instansId, profileId], references: [instansId, id], onDelete: Restrict) // FK
  version     Int
  config      Json     // { dimensions[], weights{}, thresholds[], rules[], storyTypeHalfLives{}, sourceTypePriors{}, ... } — valideret af RatingModel.validateConfig
  configHash  String   // sha256 af kanoniseret config
  modelId     String   // score | local (redundant: versionen er kun gyldig for denne model)
  status      String   @default("draft") // draft | active | archived
  note        String?
  createdById String?
  createdAt   DateTime @default(now())
  activatedAt DateTime?

  runs RatingRun[]

  @@unique([profileId, version])
  @@unique([instansId, id])
  @@index([instansId, status])
}

/// Én rating af én kandidat med én model/profilversion. Gemmer ALLE delscorer (spec §31), ikke kun total.
model RatingRun {
  id                String   @id @default(cuid())
  instansId         String
  candidateId       String
  candidate         StoryCandidate @relation(fields: [instansId, candidateId], references: [instansId, id], onDelete: Restrict) // FK
  profileVersionId  String
  profileVersion    RatingProfileVersion @relation(fields: [instansId, profileVersionId], references: [instansId, id], onDelete: Restrict) // FK
  modelId           String   // y | local
  modelVersion      String   // implementeringens semver, fx "local@1.0.0" (ændres når en formel ændres)
  comparisonGroupId String?  // samme kandidat+input vurderet af flere modeller
  inputHash         String   // sha256 af rating-input (titel, tekst efter rights-gate, geo, kontekst)
  inputVersion      Int      @default(1)
  promptVersionId   String?  // soft -> PromptTemplateVersion.id
  aiProvider        String?
  aiModel           String?
  features          Json     // AI's validerede estimater + begrundelser (rå efter zod)
  deterministic     Json     // deterministiske features (geoFit, sourceQuality, duplication, timeliness, …)
  dimensions        Json     // endelige delscorer 0-100 pr. dimension
  total             Float
  band              String   // IGNORE | REVIEW | POTENTIAL | HIGH | URGENT
  suggestedPriority String?  // A | B | C
  priorityConfidence Float?
  priorityReason    String?
  explanation       Json     // bidrag pr. dimension: [{ dimension, value, weight, contribution }] + anvendte regler
  flags             Json     @default("[]") // fx ["capped:no_geo", "capped:unverified", "rights:metadata_only"]
  status            String   @default("ok") // ok | partial | failed
  error             String?
  usageId           String?  // soft -> AiUsage.id
  savedAt           DateTime? // Local Bibliotek: bogmærket af bruger (Y: gemte analyse-artikler)
  savedById         String?
  label             String?  // frit navn i biblioteket
  ratedAt           DateTime @default(now())
  createdAt         DateTime @default(now())

  @@index([instansId, candidateId, ratedAt])
  @@index([instansId, comparisonGroupId])
  @@index([instansId, modelId, ratedAt])
}

// ─── Fase 4 ───────────────────────────────────────────────────────────────────

/// Genre/profil for generering. Config er data; prompts er PromptTemplate-versioner; en kørsel fryser et snapshot.
model GenerationProfile {
  id              String   @id @default(cuid())
  instansId       String
  slug            String   // NEWS | SHORT_NOTE | SERVICE | SPORT_RESULT | EVENT | COMMUNITY | BREAKING_UPDATE | lb:nyhedsartikel | lb:blind_spot_artikel | …
  name            String
  kind            String   @default("local") // local | local-business | local-citation | local-syntese
  legacyArticleType String? // Local Business ArticleType (Y: ArticleType)
  promptTemplateId String?  // soft -> PromptTemplate.id (format-skabelon)
  config          Json     // { structure[], length{min,max}, tone, requiredSources{min,minDistinct,requireCounterSource}, verification{factcheck,allowedVerdicts}, allowedRights[], defaultSektionSlug?, aiBrug[], blockedSourceTypes[] }
  configVersion   Int      @default(1)
  enabled         Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  runs GenerationRun[]

  @@unique([instansId, slug])
  @@unique([instansId, id])
}

model GenerationRun {
  id                String   @id @default(cuid())
  instansId         String
  candidateId       String
  candidate         StoryCandidate @relation(fields: [instansId, candidateId], references: [instansId, id], onDelete: Restrict) // FK
  profileId         String
  profile           GenerationProfile @relation(fields: [instansId, profileId], references: [instansId, id], onDelete: Restrict) // FK
  kind              String   @default("article") // article | citation | citation_lang | synthese | demo_case (Local Business / Citation / Syntese / Demo-case)
  profileSnapshot   Json     // fryst GenerationProfile.config + configVersion
  promptVersionIds  Json     // [{ slug, versionId }] for alle fragmenter (base, format, faktatjek, …) + preambleVersion
  aiProvider        String
  aiModel           String
  inputRefs         Json     // [{ sourceItemId, url, rightsLevel, allowedUse: "headline"|"snippet"|"fulltext", segmentLabel }]
  inputHash         String
  status            String   @default("queued") // queued | running | generated | factchecked | failed | blocked | handed_over | superseded
  result            Json?    // valideret output (generate/schema.ts): segmenter med status/kildeReference, rubrikforslag, manchet, hvadSkerDer, …
  segmentMap        Json?    // { "<blockId>": { segmentIndex, status, sourceRefs[] } } — blockId = "ingest-<n>"
  guardrailReport   Json?    // fund + rettelser fra guardrails
  factCheckReport   Json?    // verdicts pr. påstand
  overlapReport     Json?    // n-gram-overlap mod kilder (rights)
  articleId         String?  // soft -> Article.id
  articleExternalId String?  // "localrating:<id>" (idempotens-nøgle i createIngestDraft)
  usageIds          Json     @default("[]")
  savedAt           DateTime? // Local Bibliotek (Y: gemte business-artikler)
  savedById         String?
  label             String?
  createdById       String?
  error             String?
  startedAt         DateTime?
  finishedAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([instansId, articleExternalId])
  @@index([instansId, candidateId, createdAt])
  @@index([instansId, status])
}

/// Local Arbejdsrum (Y Story Workspace): chat + udkast + versionshistorik omkring én kandidat/kørsel. IKKE en artikeleditor:
/// endelig kladde sker via hand-over (createIngestDraft) og redigeres i CMS-editoren.
model LocalWorkspace {
  id               String   @id @default(cuid())
  instansId        String
  candidateId      String?  // soft -> StoryCandidate.id (manuelt input får en kandidat med origin "manual")
  generationRunId  String?  // soft: kørslen arbejdsrummet blev åbnet med (Citation/Syntese/Business)
  title            String?
  targetFormat     String?  // nøgle fra format-kataloget (blind_spot, signalradaren, det_betyder_det, casen_virker, den_blinde_vinkel, morgenbriefet, klumme — data i GenerationProfile)
  sourceContext    Json     // { originalSources[{sourceName,sourceUrl,title,text(kappet ≤16.000)}], mangler[], kilde } — efter rights-gate
  draft            Json     // { headline, manchet, artikel, kilde } (som Y); ":::bullets|:::factbox|:::chart"-blokke bevares som arbejdsmarkup
  messages         Json     @default("[]") // [{ role, content, at, usageId? }] — begrænset (≤ 200), ældre arkiveres
  versionHistory   Json     @default("[]") // [{ headline, manchet, source: "workspace"|"generated", createdAt }] (≤ 50)
  attachments      Json     @default("[]") // metadata for uploadede kilder (selve udtrukket tekst ligger i sourceContext)
  status           String   @default("open") // open | handed_over | archived
  articleId        String?  // soft -> Article.id efter hand-over
  savedAt          DateTime?
  createdById      String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([instansId, createdById, updatedAt])
  @@index([instansId, candidateId])
}

/// Log/historik for assistent-kald uden egen tabel i Y: Local Co-Redaktør, Vinkel, Bulletin, Dagens tal, Deep research,
/// Sammenligning, Verify-claim, Research (Exa), Semantisk søgning, Hurtig score, Parse-file, Resumé, Hent artikel m.fl.
model AssistantRun {
  id              String   @id @default(cuid())
  instansId       String
  kind            String   // coeditor | coeditor_queries | angle | bulletin | dagens_tal | deep_research | compare | verify_claim | research | semantic_search | score_sources | optimize_query | parse_file | extract_sources | summary | fetch_article | hero_brief | data_ask
  candidateId     String?  // soft
  workspaceId     String?  // soft
  inputHash       String
  inputMeta       Json     // små, ikke-følsomme nøgler (længder, antal kilder, format) — ikke selve teksten
  result          Json?    // valideret output (kappet ≤ 128 KB)
  status          String   @default("ok") // ok | failed | blocked
  error           String?
  usageId         String?  // soft -> AiUsage.id
  promptVersionId String?  // soft
  createdById     String?
  createdAt       DateTime @default(now())

  @@index([instansId, kind, createdAt])
  @@index([instansId, candidateId])
}

// ─── Fase 6 ───────────────────────────────────────────────────────────────────

/// A/B/C pr. artikel (Article røres ikke). A/B/C er ikke provenance (spec §11).
model EditorialPriority {
  id          String    @id @default(cuid())
  instansId   String
  articleId   String    // soft -> Article.id
  priority    String    // A | B | C
  reason      String?
  setByKind   String    // user | simulator | system
  setById     String?
  source      String?   // "manual" | "simulation:<id>" | "plan:<id>"
  setAt       DateTime  @default(now())
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([instansId, articleId])
  @@index([instansId, priority])
}

model PublicationPlan {
  id               String    @id @default(cuid())
  instansId        String
  name             String
  status           String    @default("draft") // draft | proposed | approved | closed | rejected
  source           String    @default("manual") // manual | simulator
  simulationRunId  String?   // soft
  policyVersion    String?
  horizonStart     DateTime
  horizonEnd       DateTime
  aiProvider       String?
  aiModel          String?
  promptVersionId  String?
  createdById      String?
  approvedById     String?
  approvedAt       DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  items PlanItem[]

  @@unique([instansId, id])
  @@index([instansId, status])
}

model PlanItem {
  id                String    @id @default(cuid())
  instansId         String
  planId            String
  plan              PublicationPlan @relation(fields: [instansId, planId], references: [instansId, id], onDelete: Cascade) // FK
  kind              String    // write | publish | promote | update
  candidateId       String?   // soft
  articleId         String?   // soft
  plannedAt         DateTime
  moduleType        String?   // ModuleTypeId (lib/frontpage/types.ts:7)
  moduleId          String?
  slotIndex         Int?
  priority          String?   // A | B | C
  rationale         String    // ≤ 200 tegn
  confidence        Float?
  constraintsReport Json?     // guardrail-overtrædelser fundet ved validering
  status            String    @default("proposed") // proposed | approved | done | rejected
  executedAt        DateTime?
  executedById      String?
  resultRef         Json?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([instansId, planId, plannedAt])
  @@index([instansId, status, plannedAt])
}

/// Sandbox-kørsel med virtuelt ur. Skriver aldrig til live. Samme input + policy + ur => samme resultat (inputHash).
model SimulationRun {
  id                 String   @id @default(cuid())
  instansId          String
  name               String
  scenario           Json     // { articles[], events[], campaigns[], quota?, realArticleIds[]? }
  policyVersion      String
  policySnapshot     Json     // lag-1 rank/compose/guardrail-konfiguration brugt (modules, kvoteloft, …)
  virtualClock       Json     // { times: ["2026-10-02T07:00:00+02:00", …] }
  inputHash          String
  result             Json?    // pr. tidspunkt: assignments, violations, source, explanations; + shadow-diff
  aiPlan             Json?    // { promptVersionId, model, usageId, planId? }
  compareToRunId     String?  // soft
  appliedSnapshotId  String?  // soft -> FrontpageSnapshot.id (hvis "anvend som forslag")
  appliedPlanId      String?  // soft
  status             String   @default("queued") // queued | running | done | failed
  durationMs         Int?
  error              String?
  createdById        String?
  createdAt          DateTime @default(now())

  @@index([instansId, createdAt])
  @@index([instansId, inputHash])
}
```

## 2a. Omdøbning FeedSource → SourceDefinition og FeedItem → SourceItem (kilderegistrene)

Ejeren har leveret to kilderegistre (`source-registries/Naestved_…md`, `Slagelse_…md`) der kræver at kilden er **data** med registrets `SourceDefinition`-felter. Det tidligere udkast hed `FeedSource`/`FeedItem`; de to modeller er **omdøbt og udvidet** (ikke erstattet): alle gamle felter er bevaret (navneændringer: `url`→`urlOrEndpoint`, `type`→`accessMode`, `pollIntervalMinutes` uændret, `feedSourceId`→`sourceId`, `primaryFeedItemId`→`primarySourceItemId`, `feedItemId`→`sourceItemId` i JSON-referencer). Gamle navne forekommer ikke længere i dokumenterne, men bevares som reference her og i `README.md` §7 nr. 21 (afvigelser). Intet var anvendt (ingen migration), så omdøbningen koster intet.

**Mapping fra registrets felter til Prisma (`SourceDefinition`):**

| Registerfelt (`SourceDefinition`) | Prisma-felt | Bemærkning |
|---|---|---|
| `id` | `id` | cuid; stabil identitet på tværs af re-import er `sourceKey` |
| `name` | `name` | registrets "Kilde" |
| `sourceClass` | `sourceClass` | registrets "Område" som slug; **adskilt** fra `sourceType` (CMS' `SOURCE_TYPES`, bruges af `createIngestDraft`-spærringen) |
| `authorityLevel` | `authorityLevel` | `PRIMARY_OFFICIAL` … `SOCIAL_SIGNAL` (String) |
| `priority` | `priority` | `P0`/`P1`/`P2` |
| `accessMode` | `accessMode` | `API`, `RSS`, `ATOM`, `EMAIL`, `WEBHOOK`, `HTML_MONITOR`, `SITEMAP`, `LICENSED_FEED`, `MANUAL`, `SEED_DIRECTORY` |
| `urlOrEndpoint` | `urlOrEndpoint` (+ `urlNorm`) | `NULL` indtil URL er fundet/verificeret (registrene har ingen URL'er) |
| `licenseType` | `licenseType` | se `10-…` §11b |
| `instanceScope` | `instanceScope` (+ `instansId`) | pr.-instans-rækker; `national`/`region` markerer kilder der kræver strengt lokalitetsfilter |
| `geoFilter` | `geoFilter` Json | kommunekode, aliaser, postnumre, bbox |
| `entityFilters[]` | `entityFilters` Json | |
| `keywordFilters[]` | `keywordFilters` Json | |
| `pollInterval` | `pollIntervalMinutes` Int | afledt af `priority` |
| `parserType` | `parserType` (+ `parserConfig`) | adapter-nøgle |
| `robotsTermsCheckedAt` | `robotsTermsCheckedAt` | NULL ⇒ kan ikke aktiveres |
| `enabled` | `enabled` | altid `false` ved import/discovery |
| `lastSuccessAt` / `lastFailureAt` | samme | |
| *(nyt)* | `parentSourceId`, `discoveredBy`, `discoveryRunId`, `approvalStatus`, `approvedById/At`, `approvalNote`, `aiClassification`, `rightsLevel`, `rightsLevelSuggested`, `aiHostile`, `personDataClass`, `ingestOwner`, `sourceKey`, `registryRef`, `registryRowHash`, `movedToUrl` | Se kommentarer i modellen |

**Mapping fra registrets "minimum metadata fra hvert source-hit" til `SourceItem`:** `sourceId`→`sourceId`; `sourceItemId`→`id`; `canonicalUrl`→`canonicalUrl`; `title`→`title`; `publishedAt`→`publishedAt`; `retrievedAt`→`retrievedAt`; `rawPayloadHash`→`rawPayloadHash`; `sourceAuthority`→`sourceAuthority`; `detectedPlaces[]`/`detectedEntities[]`/`detectedClaims[]`/`storyMatches[]`→samme Json-felter; `localityScore`→`localityScore` (+ `localityBreakdown`); `duplicateScore`→`duplicateScore`; `reuseLicenceRule`→`reuseLicenceRule`. *Registrets "Bevar altid original provenance"* håndhæves ved at `rawPayloadHash` altid gemmes (selv når `rawPayload` af rettighedshensyn er minimeret) og `SourceItem.rawPayload`/`rawPayloadHash` er append-only (`02-…` §6).

## 3. Relationer og kardinalitet (oversigt)

| Fra | Til | Type | Håndhævelse |
|---|---|---|---|
| `SourceItem` | `SourceDefinition` | N:1 påkrævet | **FK** `(instansId, sourceId)`; `Restrict` (kilder arkiveres, slettes ikke) |
| `StoryCandidate` | `SourceItem` | N:M via `sourceRefs`/`SourceItem.candidateId` | soft (kandidater kan samle flere items; items kan genbruges ved RELATED) |
| `RatingRun` | `StoryCandidate`, `RatingProfileVersion` | N:1 påkrævet | **FK** (tenant-sikre) |
| `RatingProfileVersion` | `RatingProfile` | N:1 | **FK** |
| `GenerationRun` | `StoryCandidate`, `GenerationProfile` | N:1 | **FK** |
| `PromptTemplateVersion` | `PromptTemplate` | N:1 | **FK** |
| `PlanItem` | `PublicationPlan` | N:1 | **FK**, `Cascade` |
| `StoryCandidate.articleId`, `EditorialPriority.articleId`, `PlanItem.articleId`, `GenerationRun.articleId` | `Article` | soft | Ingen FK/relationsfelt (Article uændret). Applikationen tjekker `instansId`-lighed ved skrivning; slettet artikel efterlader dangling id (accepteret; artikler slettes sjældent) |
| `SourceDefinition.geoTagId`, `StoryCandidate.geoTagIds`, `LocalEntityRef.geoTagId` | `GeoTag` | soft | `matchGeo`/`resolveGeoIds` (`lib/ingest/geo.ts`) tjekker `instansId` |
| `SourceDefinition.parentSourceId` | `SourceDefinition` | soft (selv-reference) | Service tjekker samme `instansId`, ingen cyklusser, maks dybde 3; forælder skal være `godkendt` før børn kan godkendes |
| `SourceDefinition.discoveryRunId`, `SourceDiscoveryRun.seedSourceId` | `SourceDiscoveryRun` / `SourceDefinition` | soft | |
| `LocalEntityRef.sourceId` | `SourceDefinition` | soft | |
| `StoryCandidate.sourceRefs[].sourceId` | `SourceDefinition` | soft (Json) | |
| Alle `instansId` | `Instance` | soft | Ingen relation (samme som `AuditLog`); konsistens testes |

## 4. Indeksstrategi (hot paths)

| Forespørgsel | Indeks |
|---|---|
| Cron: forfaldne kilder pr. instans | `SourceDefinition(instansId, enabled, nextFetchAt)` (kun `approvalStatus="godkendt"` og `ingestOwner="localrating"` poller; prioritet sorterer P0 først) |
| Godkendelseskø (foreslåede kilder) | `SourceDefinition(instansId, approvalStatus, priority)` |
| Child sources under en seed | `SourceDefinition(instansId, parentSourceId)` |
| Lokal-relevans: entitet-/aliasopslag | unik `LocalEntityRef(instansId, kind, keyNorm)` (CVR, postnr., alias) |
| Metrik "primærdata før sekundære medier" | `StoryCandidate(instansId, sourceAuthority, firstSeenAt)` |
| Inbox: filtrér efter lokalitet | `StoryCandidate(instansId, localityScore)`, `SourceItem(instansId, localityScore)` |
| Dedupe: samme rå payload | `SourceItem(instansId, rawPayloadHash)` |
| Jobkø: næste jobs | `ProductionJob(status, runAfter, priority)` |
| Dedupe: URL/hash/titel pr. instans | `SourceItem(instansId, urlNorm)`, `(instansId, contentHash)`, `(instansId, titleHash)`, unik `(instansId, sourceId, externalId)` |
| Inbox: kandidater efter score | `StoryCandidate(instansId, status, latestScore)` |
| Kandidat-detalje: rating-historik | `RatingRun(instansId, candidateId, ratedAt)` |
| Forbrug: månedssum pr. udbyder | `AiUsage(instansId, period, provider)` |
| Plan-tidslinje | `PlanItem(instansId, planId, plannedAt)` |

## 5. Kompatibilitet med eksisterende modeller (verificeret mod `schema.prisma`)

- `Article.externalId` + `@@unique([instansId, externalId])` (`schema.prisma:240-245`) bruges som idempotensnøgle: `localrating:<generationRunId>`; `GenerationRun.articleExternalId` har egen unik nøgle for at forhindre dobbelt-oprettelse selv hvis kladden slettes.
- `Article.provenance` (`:243`) skrives kun af `createIngestDraft` (`lib/ingest/articles.ts:104-111`): `meta` ← `{ storyCandidateId, generationRunId, ratingRunId, promptVersion, model }` (≤ 20 skalarer, ≤ 500 tegn).
- `ArticleRevision` (`:250-261`): LocalRating indsætter én række efter kladdeoprettelse (`note: "AI-kladde fra LocalRating (kørsel <id>)"`).
- `AuditLog` (`:107-120`): handlinger `localrating.feed.*` (alias for `localrating.source.*`), `localrating.source.import|approve|reject|rights|discover`, `localrating.entity.approve`, `localrating.candidate.*`, `localrating.draft.create`, `localrating.prompt.*`, `localrating.simulator.apply` via `writeAudit` (`lib/audit.ts:19`).
- Ingen ændring i `Instance`-relationslisten (`schema.prisma:36-67`), derfor ingen Prisma back-relations.

## 6. Migrationssikkerhed og rollback

**Pr. migration (Fase 1/2/3/4/6):**
1. `npm run prisma:pg:migration -- localrating_<navn>` genererer pg-skema + `migration.sql`.
2. **Gennemlæs `migration.sql`:** må kun indeholde `CREATE TABLE`/`CREATE UNIQUE INDEX`/`CREATE INDEX`/`ADD CONSTRAINT … FOREIGN KEY` på de nye tabeller. Ingen `ALTER TABLE "Article"|"Signal"|"Instance"|…`, ingen `DROP`, ingen omdøbning.
3. Automatisk test `tests/localrating-migration-additive.test.ts` scanner alle migrationer med navn `*_localrating_*` og fejler ved `DROP`/`ALTER TABLE` mod ikke-LocalRating-tabeller (tabelliste hardkodet = eksisterende modeller i `schema.prisma` ved Fase 0-snapshot).
4. `npm run prisma:pg:check` og `npm test` (inkl. `tests/pg-schema.test.ts`) er grønne.
5. `pg_dump` før deploy (RAILWAY-SETUP §8).

**Rollback pr. migration (kilde-laget):** `localrating_sources` (Fase 2) kan rulles tilbage alene ved at slå `schedulerEnabled=false` (ingen discovery-job) og — kun efter beslutning — `DROP TABLE "LocalEntityRef", "SourceDiscoveryRun"` som ny fremadrettet migration; intet i `localrating_foundation` peger på dem (bløde pegere). Seed-importen kan fortrydes uden skemaændring: importerede rækker har `importedFrom="registry:<instans>:<dato>"` og er alle `enabled=false`, `approvalStatus="foreslået"`; `npm run sources:import -- … --revert <importedFrom>` (design i `10-…` §11c) sætter ikke-godkendte importerede rækker til `status="disabled"`/arkiveret (aldrig sletning af rækker der har `SourceItem`s). `StoryCandidate`-felterne (`localityScore` …) er nullable/har default og ignoreres hvis kode rulles tilbage.

**Rollback (kode):** slå `LocalRatingConfig.enabled=false` (eller `schedulerEnabled=false`) – ingen CMS-funktion afhænger af LocalRating; Railway "Rollback" af deploy virker, fordi migrationerne er additive (RAILWAY-SETUP §7).

**Rollback (tabeller)** – kun hvis ejeren ønsker LocalRating fjernet helt; skrives som ny *fremadrettet* migration (aldrig redigering af anvendte), i omvendt afhængighedsrækkefølge:

```sql
-- localrating_remove (eksempel; køres kun efter eksplicit beslutning + pg_dump)
DROP TABLE IF EXISTS "PlanItem", "PublicationPlan", "SimulationRun", "EditorialPriority";
DROP TABLE IF EXISTS "AssistantRun", "LocalWorkspace", "GenerationRun", "GenerationProfile";
DROP TABLE IF EXISTS "RatingRun", "RatingProfileVersion", "RatingProfile", "StoryCandidate";
DROP TABLE IF EXISTS "LocalEntityRef", "SourceDiscoveryRun";   -- localrating_sources (Fase 2)
DROP TABLE IF EXISTS "SourceItem", "SourceDefinition", "IngestionLog", "ProductionJob";
DROP TABLE IF EXISTS "PromptTemplateVersion", "PromptTemplate", "AiUsage", "LocalRatingConfig";
```

Kladder LocalRating allerede har oprettet er almindelige `Article`-rækker og forbliver (provenance peger blot på nu slettede id'er). `AuditLog`/`ArticleRevision`-rækker bevares.

## 7. Åbne skemaspørgsmål

1. `LocalRatingConfig` (afvigelse fra planen) – godkendes eller erstattes af env + konvention?
2. Må `instansId` mangle DB-FK til `Instance` (som `AuditLog`), eller skal `Instance` få back-relations (kun Prisma-niveau; ingen DB-kolonne) for referentiel integritet?
3. `EditorialPriority` bor her (additiv tabel) – eller skal kernen eje den (ændring uden for scope)?
4. Opbevaringstid for `SourceItem.rawPayload` (nu 90 dage uden kandidat) og for `IngestionLog` (forslag 90 dage) – juridisk afklaring (ophavsret/persondata i feeds). Retslister/CVR-personer/Statstidende (`personDataClass="likely"`) foreslås kortere (30 dage) – D31.
5. `LocalEntityRef` og `SourceDiscoveryRun` er nye ift. det forrige udkast (kilderegistrene kræver lokale aliaser/CVR og en discovery-historik). Godkendes de, eller skal aliaser/CVR ligge i Knowledge OS (kræver tenant-isolation, ADR-004, og er derfor ikke realistisk i v1)? Default: egne tabeller, Knowledge valgfrit spejl (`knowledgeRef`).
6. Sammensatte unikke nøgler med `NULL` (`@@unique([instansId, urlNorm])`, `@@unique([instansId, articleId])`): både SQLite og PostgreSQL behandler `NULL` som forskellige i unikke indekser – **uverificeret** i Prisma-valideringen; Fase 1 verificerer.
