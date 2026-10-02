# LocalRating – Fase 0: audit, arkitektur og ADR'er

Dato: 2. oktober 2026 (opdateret 3. oktober 2026 med ejerens kilderegistre for Næstved og Slagelse). **Status: Fase 0 afleveret til arkitekturgodkendelse (GATE); opdateret med kilderegistrene (ADR-015, D29-D32).** Kun dokumentation: ingen kode, ingen schemaændringer, ingen migrationer, ingen ændringer i andre repos.

LocalRating er CMS'ets **artikelmotor** (kilderegister → kilde-ingest → kandidater → rating → generering → kladde; for Næstved og Slagelse med udgangspunkt i ejerens to kilderegistre) som et **lag ovenpå** det eksisterende CMS, bygget som en **engangsportering af Y Rating-familien** med **funktionel paritet** (omdøbt til Local), plus AI-simulator/udgivelsesplan, prompt-bibliotek og værktøjer til CMS'ets AI-operatør. Mennesket har altid den redaktionelle autoritet: **LocalRating publicerer aldrig noget.**

## 1. Indeks

| Fil | Indhold |
|---|---|
| `README.md` | Dette dokument: indeks, principper, navne-mapping, gate, afvigelser/åbne spørgsmål |
| [`00-system-map.md`](00-system-map.md) | Systemkort: CMS, Knowledge OS, Y Rating; hvor LocalRating sidder; dataflow (mermaid); overlap/huller |
| [`01-y-rating-reuse-matrix.md`](01-y-rating-reuse-matrix.md) | Y-familien → Local: REUSE/ADAPT/REPLACE/DROP pr. funktion og **komplet route-katalog**, med fil:linje og Local-destination |
| [`02-data-ownership-og-bounded-contexts.md`](02-data-ownership-og-bounded-contexts.md) | Ejerskab, Story≠Article, Source≠Artifact, ExternalObjectRef, afhængighedsretning |
| [`03-foreslaaet-skema.md`](03-foreslaaet-skema.md) | Præcise Prisma-modeller (forslag), migrationsrækkefølge, rollback |
| [`04-service-graenser-og-events.md`](04-service-graenser-og-events.md) | Service-interfaces (TypeScript), cron/job-model, domain events/outbox, **AI-operatørens værktøjsregister (værktøjsliste + risiko)**, **chat-UI efter skillet `chat-module`** |
| [`05-ratingmodeller.md`](05-ratingmodeller.md) | `RatingModel`; modellen `score` (Local Score = porteret Y Rating) og den nye `local`; formler, tærskler, versionering, invarianter |
| [`06-generering-og-prompts.md`](06-generering-og-prompts.md) | GenerationProfiles, pipeline, kildesporbarhed, guardrails, faktatjek, kladde-kontrakt, injection-separation; **paritet: Local Citation/Syntese/Arbejdsrum/assistenter** |
| [`07-prompt-inventar.md`](07-prompt-inventar.md) | Faktisk prompt-inventar i CMS i dag, `PromptRegistry`, `/redaktion/prompter`, **porteringsinventar for alle Y-prompter** |
| [`08-simulator-design.md`](08-simulator-design.md) | `/redaktion/simulator`: sandbox, virtuelt ur, AI-udgivelsesplan, forklaring, "anvend som forslag", shadow-mode |
| [`09-ai-gateway-og-noegler.md`](09-ai-gateway-og-noegler.md) | Provider-agnostisk gateway, globale nøgler, forbrugsloft, GDPR/DeepSeek |
| [`10-feeds-rettigheder-og-ssrf.md`](10-feeds-rettigheder-og-ssrf.md) | `accessMode`/feed-typer, parser, SSRF-regelsæt, `rightsLevel`, **§11 Kilderegistre for Næstved og Slagelse** (mapping, rights-defaults, `sources:import`, discovery, lokal-relevans, poll-prioriteter, MVP-rækkefølge), Y-import (sekundær) |
| [`11-migrationsrisici-rollback-og-test.md`](11-migrationsrisici-rollback-og-test.md) | Risici, rollback, teststrategi, faseporte, DoD |
| [`12-implementeringsrækkefølge.md`](12-implementeringsrækkefølge.md) | Faser 1-7, omfang, afhængigheder, parallelle spor, beslutningsregister |
| [`source-registries/`](source-registries/) | **Ejerens kilderegistre** (kilde-til-sandhed, uændrede): `Naestved_Source_Registry_Artikelmotor.md` (93 rækker), `Slagelse_Source_Registry_Artikelmotor.md` (74 rækker). Importeres til `SourceDefinition` (`10-…` §11c) |
| [`adr/ADR-001…015`](adr/) | Arkitekturbeslutninger (001-012 som aftalt; 013 AI-operatør/værktøjsregister; 014 Local-familien/paritet; **015 kilderegister som data**) |

## 2. Læsevejledning

- **Ejeren (godkendelse):** denne README → `12-…` (beslutningsregister D1-D32; **nye: D29-D32**) → ADR'erne (**ADR-015**) → `00-…` for helheden → `10-…` §11 (kilderegistre).
- **Udvikler:** `00` → `03` → `04` → `05`/`06` → `10` → `11`.
- **Redaktion/jura/drift:** `05` (hvordan rating udregnes), `06` (hvad AI må skrive), `10` (rettigheder; §11b rights pr. autoritet/persondata), `09` §6 (GDPR), `11` (rollback).
- **Referencer** er `fil:linje` fra koden på auditdagen. **"Uverificeret"** = ikke læst/ikke kørt. Hemmeligheder gengives aldrig; Y's hardcodede nøgler omtales kun som *eksisterende* (se `09-…` §7).

## 3. Principper (gælder alle dokumenter)

1. **Lag ovenpå.** LocalRating ejer kun (a) kilderegister + kilde-ingest (`SourceDefinition`/`SourceItem`), (b) kandidater + rating, (c) artikelskrivning (prompts, generering, faktatjek, arbejdsrum). Alt andet i CMS'et genbruges **uændret**. Afhængigheden går kun én vej: `LocalRating → CMS-kerne` (ADR-001/003).
2. **Ingen refaktorering af eksisterende CMS-moduler.** Kun additive tabeller og additive linjer (permissions, default-roller, `PAGE_PERMISSIONS`, nav, env, `check-secrets`, `.env.example`, `RAILWAY-SETUP`). Hvor noget mangler (revision/audit ved kladde), gør LocalRating det selv *oven på* `createIngestDraft`.
3. **Aldrig auto-publicering.** Output er en almindelig CMS-kladde (`Idé`, `AI-assisteret`, `maskinleveret`, kilder med dato). Publicering, forside-godkendelse m.m. kræver et menneske (også for AI-operatøren: `BLOCKED_TOOLS`).
4. **Engangsportering – og Y fortsætter uændret.** Portering er **envejs og read-only mod Y**: ingen løbende synk, ingen delt pakke, ingen peg-om af Y, **ingen ændringer i Y's filer, scripts eller deploy**. Y Rating-repoet (`/Volumes/SSD Data/Gits/SN-DeepDive`) må aldrig ændres, omdøbes, refaktoreres eller peges om af dette arbejde. **Navnet LocalRating/Local Citation m.fl. findes kun i CMS-koden og -UI; Y-navnene bevares i Y.** Der er ikke to *permanente* implementeringer i CMS'et: LocalRating er den eneste motor *i localcms* (ADR-002).
5. **Funktionel paritet med Y-familien** (artikelgenerator, arbejdsrum, feeds, kilder, scoring/rating, Citation, Syntese, Business, faktatjek, co-editor/vinkel/bulletin, parse-file …) med **samme attributter, felter og funktioner**, omdøbt til Local (§4). Alle Y-prompter portes (`07-…` §6).
6. **Kun globale AI-nøgler som Railway-variabler.** Ingen BYOK, ingen nøgler i databasen (ADR-007). Default-udbyder Anthropic; DeepSeek spærret som standard.
7. **Rating er pre-publication** og adskilt fra forsidens post-publication-ranking. AI estimerer delscorer; total, tærskler og A/B/C beregnes transparent af kode ud fra konfiguration (ADR-006).
8. **Tenancy:** alt har `instansId`; eksplicitte cross-tenant-tests; ingen hardcodede bynavne (ADR-011).
9. **Hentet indhold er data** (SYSTEM / BRUGER / HENTET INDHOLD adskilt); rights-niveau bestemmer hvad AI må se (`06-…` §6, `10-…` §5).
10. **Fase 0 = dokumentation.** Selve prompt-teksterne, koden og tabellerne bygges først efter godkendelse (Fase 1-7).

## 4. Navne-mapping (Y → Local) – gælder kun localcms

| Y-navn | Local-navn | Id/destination i CMS |
|---|---|---|
| Y Rating | **LocalRating** | `lib/localrating/**`, `/redaktion/produktion/*` |
| Y Test Lab / SIRE (Story Intelligence Rating Engine) | **Local Lab** / **LocalRating-motor** | `/redaktion/produktion/lab`, `lib/localrating/rating/**` |
| Y Score | **Local Score** | `RatingModel.id = "score"`, JSON `local_score` (Y: `y_score`) |
| Y Citation | **Local Citation** | `generate/citation.ts`; profiler `local-citation`, `local-citation-lang` |
| Y Syntese | **Local Syntese** | `generate/synthese.ts`; profil `local-syntese` |
| Y Business (artikelgenerator) | **Local Business** | `GenerationProfile.kind="local-business"`, slug `lb:<type>` |
| Y Workspace / Story Workspace | **Local Arbejdsrum** | `workspace/*`, tabel `LocalWorkspace`, `/redaktion/produktion/arbejdsrum/<id>` |
| Y Compare | **Local Sammenligning** | `assist/compare.ts` |
| Y Co-Redaktør / Vinkel / Bulletin / Dagens tal / Deep research | **Local Co-Redaktør / Vinkel / Bulletin / Dagens tal / Deep research** | `assist/*`, tabel `AssistantRun` |
| Y Faktatjek / verify-claim | **Local Faktatjek / Local Verify-claim** | `generate/factcheck.ts`, `assist/verify-claim.ts` |
| Y Prompt-bibliotek | **Local Prompt-bibliotek** | `/redaktion/prompter`, `lib/prompts/**` |
| Y gemte artikler | **Local Bibliotek** | `savedAt` på `RatingRun`/`GenerationRun`/`LocalWorkspace` |
| Y-sprog / rubrikstandard | **Local sprog / Local rubrikstandard** | prompt-fragmenter `base.sprog`, `base.rubrik` |
| `yRating`, `YRatingDimensions`, `Y_SCORE_WEIGHTS` | `localRating`, `LocalRatingDimensions`, `LOCAL_SCORE_WEIGHTS` | – |
| "Mediet Y", "Projekt Y", "Y.dk" i prompter/UI | instansens medienavn (`{{medienavn}}`) | prompt-variabel |

Uændrede (data, ikke brand): pillarer Challenge/Inspire/Understand, de 11 journalistiske funktioner, Blind Spot, Signalradaren, Casen der virker m.fl. Fuld tabel og omdøbningsregler: `01-…` §0, `07-…` §6.2.

## 5. Nye rettigheder (forslag; additive i `lib/permissions.ts`)

| Konstant | Nøgle | Giver | Standardroller (D15) |
|---|---|---|---|
| `PRODUCTION_VIEW` | `production.view` | Se feeds, kandidater, ratings, forbrug | Ansvarshavende, Redaktionsleder |
| `PRODUCTION_MANAGE` | `production.manage` | Oprette/ændre feeds, beslutte kandidater, profiler | Ansvarshavende, Redaktionsleder |
| `PRODUCTION_AI_USE` | `production.ai.use` | Udløse AI (rating, generering, assistenter) | Ansvarshavende, Redaktionsleder |
| `PRODUCTION_RIGHTS_MANAGE` | `production.rights.manage` | Hæve `rightsLevel` / sætte `licensed` *(ekstra ift. plan; D19)* | Ansvarshavende |
| `PROMPTS_VIEW` / `PROMPTS_EDIT` | `prompts.view` / `prompts.edit` | Se / redigere prompter | view: begge; edit: Ansvarshavende |
| `SIMULATOR_USE` | `simulator.use` | Køre simulator/planer | Ansvarshavende, Redaktionsleder |

Operatøren kan aldrig mere end brugerens egne rettigheder (`OPERATOR_USE` findes allerede, `lib/permissions.ts:26-27`).

## 6. GATE: ejerens godkendelse før Fase 1

**Ingen kode, tabeller eller migrationer før ejerens skriftlige arkitekturgodkendelse** (master-spec §29 "STOP og få arkitekturgodkendelse"). Godkendelsen dækker:

1. Arkitekturen "lag ovenpå" og afhængighedsretningen (ADR-001/003).
2. Engangsportering + at **Y fortsætter uændret** (ADR-002) og navngivningen (ADR-014).
3. Skemaforslaget (`03-…`) inkl. afvigelserne i §7 (nr. 1-2).
4. AI-gateway, globale nøgler, default-udbyder og DeepSeek-spærring (ADR-007, `09-…`).
5. SSRF-regelsæt og `rightsLevel`-håndhævelse (ADR-008, `10-…`).
6. Rating-modellerne og versioneringen (ADR-006, `05-…`).
7. AI-operatørens værktøjsregister og risikoniveauer (ADR-013, `04-…` §5).
8. Beslutningsregisteret D1-D32 (`12-…` §4) – mindst D1-D5, D15, D19, D27; **nye pr. 3. oktober: D29-D32** (kilderegistrene; D6 besvaret, D18 opdateret).
9. Kilderegister som data, godkendelsesflow for opdagede kilder og rights pr. `authorityLevel` (ADR-015, `10-…` §11).

**Leveret i Fase 0:** README, `00`-`12`, ADR-001…015, `source-registries/` (ejerens filer). **Ikke leveret (bevidst):** kode, migrationer, prompt-tekster (portes i Fase 1/3/4), tests.

## 7. Afvigelser fra den godkendte plan og åbne spørgsmål til ejeren

Afvigelser skrives her (krav: konsistens med planen). Hvert punkt har et default i `12-…` §4.

| # | Emne | Afvigelse / spørgsmål | Ref. |
|---|---|---|---|
| 1 | **Ekstra tabel `LocalRatingConfig`** (feature-flag, loft, aktiv profil pr. instans) | Ikke i planens tabelliste; alternativet (kun env) kan ikke bære månedsloft/aktiv profil pr. instans uden hardcodede domæner | `03-…` §1, D2 |
| 2 | **Ingen DB-FK til `Instance`/`Article`/`GeoTag`** (bløde pegere, som `AuditLog`); sammensatte tenant-FK'er internt | Holder `Instance`/`Article` uændrede. Sammensatte FK'er med delt `instansId` er **uverificeret** mod `prisma validate` (valideres først i Fase 1) | `03-…` §0, D3 |
| 3 | **Y-feedlisten:** planen siger ~376 feeds; optalt 418 URL-literaler i `sireRoute.ts:371-949` (ingen lokale) | Importværktøj er en bekvemmelighed (højst ~50 relevante); ingen feeds importeres aktive. **Nu sekundær** i forhold til kilderegistrene (`foreslået`, kan ikke overskrive registerrækker) | `10-…` §8, §11 |
| 4 | **Y's 49 tests** ligger i frontend-mappen `SN-DeepDive/y-test-lab/*.test.ts` (9+6+12+10+2+5+5) og importerer `./sireRoute` | Portering kræver først udtræk af rene funktioner; Y's filer ændres ikke | `01-…` §8 |
| 5 | **Hardcodet bynavn i CMS-kernen:** `lib/distribution-engine.ts:100` (`"slagelse-by"`) og sektions-slugs `:41,:53` | Ikke i scope at rette; simulatoren arver adfærden (advarsel). Ejeren afgør om kernen rettes (D13) | `08-…` §2 |
| 6 | **Simulatoren kan ikke bygge på `resolveFrontpageForRender({now})`:** `calculateSupportedContentQuota` bruger `Date.now()` (`frontpage-governance.ts:28`); layout/snapshot/metrics er ikke "as-of" | Planen antog at `now` kunne injiceres overalt (**verificeret ikke tilfældet**). Simulatoren bruger de *rene* funktioner (`rank/compose/guardrails/fallback`) og egen kvoteberegning med ækvivalenstest | `08-…` §2 |
| 7 | **Domain events:** CMS-kernen kan ikke skrive til LocalRatings outbox | `ARTICLE_*`/`COMPOSITION_PUBLISHED`/`TIP_RECEIVED` **observeres** via reconciliation (≤ 15 min), ikke push | `04-…` §4, D17 |
| 8 | **Grænsen aI-library ↔ LocalRating (OPDATERET 3. oktober, D18):** T7/T8 placerer dagsorden/politi/trafik hos aI-library (Signal) | Kilderegistret ejes nu af LocalRating (registrene indeholder politi/dagsorden/trafik/DMI); **én ingest-ejer pr. kilde** (`SourceDefinition.ingestOwner`, default `ailibrary` for disse indtil ejeren beslutter); aI-library kan fortsat levere Signal; konkret envejs dedupe-regel + drift-vagt | `00-…` §5a, `04-…` §4a, D18 |
| 9 | **`EditorialPriority`** er en additiv LocalRating-tabel (spec placerer den hos CMS) og læses ikke af forsidekernen | Ingen live-effekt uden kerneændring; virker via snapshot-placeringer (A→5, B→3, C→2) | `08-…` §7, D12 |
| 10 | **Default AI-udbyder** Anthropic; DeepSeek kun for ikke-personhenførbar feedtekst, spærret som standard | Ejerens godkendelse (planens spørgsmål); juridisk verificering af DeepSeek/Gemini | `09-…` §6, D4 |
| 11 | **Pilotkilder (D6 BESVARET 3. oktober):** pilot = **Næstved OG Slagelse efter de to kilderegistre**; MVP-listerne er Fase 2-køen. T8 fandt ingen kommune-RSS for Næstved/Slagelse ⇒ `HTML_MONITOR`. Rest: hvilke af ~167 rækker aktiveres først = **D32** | Registrenes MVP-lister; bølge A+B først; T8-verificerede feeds som overlay | `10-…` §7, §11g, D6, D32 |
| 12 | **Y's hardcodede nøgler** (Reuters, Exa) i Y's kildekode | **Ejeren roterer hos udbyderne.** Y-repoet røres ikke af dette arbejde | `09-…` §7, D8 |
| 13 | **Prompt-bibliotek Fase 4 vs 7:** Fase 4 kræver basis DB-prompt-redigering; Fase 7 fuldfører | Ikke en afvigelse, gjort eksplicit | `12-…` |
| 14 | **Local Arbejdsrum (ejerens tilføjelse)** overstyrer plan-princip 3 ("ingen egen artikeleditor") *delvist* | Arbejdsrummet er et chat-/skrivevaerksted; endelig kladde = hand-over via `createIngestDraft` til CMS-editoren. `:::chart` har ingen CMS-blok (D25) | `06-…` §11.4, ADR-014 |
| 15 | **Paritetsomfang:** Fase 4 udvides og deles i 4a-4e; **Demo-case/klumme** kun i sandbox (hand-over spærret, D21); **AI-billeder** kun efter ejerbeslutning (D22) | Kan udskyde 4d/4e | `12-…`, `06-…` §11 |
| 16 | **AI-operatøren bygges af en anden agent** (WIP på auditdagen: ingen route/UI/register-index) | LocalRating registrerer værktøjer fase for fase i egen mappe; D28 afklarer ejerskab af registret. Ny afhængighed til chat-markdown (D23); eksisterende `/redaktion/chat` bryder skillet `chat-module` på flere punkter (migration D24) | `04-…` §5-§6, ADR-013 |
| 17 | **Knowledge OS** er auditeret fra repoet; MCP-serveren kunne ikke forbinde i sessionen (uverificeret mod kørende instans); ingen tenant-isolation | Kontekst er valgfri, fail-closed, én instans (D14) | `00-…` §3, ADR-004 |
| 18 | **SIRE-teksten:** konstanten og `custom_prompt.txt` afviger (13 diff-linjer) | Hvilken er autoritativ? | `07-…` §6, D26 |
| 19 | **`production.rights.manage`** (ekstra rettighed) | Ekstra ift. plan | D19 |
| 20 | **Rating-kalibrering:** ≥ 50 manuelle "gold"-kandidater før `local`-vægte låses (Fase 3-gate); nu også `localityScore`-vægte, `authorityPrior` og klynger | Hvem leverer dem? | `05-…` §9 |
| 21 | **`FeedSource` → `SourceDefinition` og `FeedItem` → `SourceItem`** (omdøbt og udvidet efter kilderegistrene); gamle felter bevaret (`url`→`urlOrEndpoint`, `type`→`accessMode`, `feedSourceId`→`sourceId`, `feedItemId`→`sourceItemId`, `primaryFeedItemId`→`primarySourceItemId`). Spec-eventnavnet `FEED_ITEM_INGESTED` bevares. Intet var anvendt, så omdøbningen er gratis | Alle dokumenter og ADR'er er opdateret; mapping registerfelt → Prisma i `03-…` §2a | `03-…` §2a, ADR-015 |
| 22 | **To nye tabeller** (`SourceDiscoveryRun`, `LocalEntityRef`; migration `localrating_sources`, Fase 2) og nye felter på `SourceDefinition`/`SourceItem`/`StoryCandidate` | Registrenes discovery og lokal-relevans (aliaser, CVR, institutioner) kræver lokal lagring; Knowledge OS har ingen tenant-isolation (ADR-004) | `03-…` §1, §7 nr. 5 |
| 23 | **P0-poll er effektivt 5 min** (Railway-cron-minimum), ikke registrenes "1–5 min" | 1–4 min kræver push/webhook/e-mail-indtag eller worker-service (ny infrastruktur) – ikke i v1 | `10-…` §11f, ADR-015 |
| 24 | **SSRF-regel S16 får én undtagelse (S16b):** discovery henter officielle websites fra *godkendte* seed-kataloger | Uden undtagelsen kan registrenes seed → discovery ikke fungere; fastholder S1-S15 og lofter | `10-…` §11d, ADR-008 |
| 25 | **`HTML_MONITOR`** (registrenes "web/change monitor") ændrer Fase 0-udkastets "ingen HTML-scraping": ændringsdetektion/liste-udtræk fra *konfigureret* URL med typet config; kræver `cheerio` (D9 ændret) | Optalt: 104 af 167 rækker (Næstved 61, Slagelse 43) har en "Adgang"-tekst uden API/RSS/Atom/seed/licens/manuel (web/monitor/søg) – alternativet er at lade dem være manuelle | `10-…` §1, §11a, D9 |
| 26 | **Ingen URL'er i registrene** og kun T8-verificerede feeds er kendt; nøgle-/aftalekrav (CVR, Rejseplanen, Vejdirektoratet DATEX II, Ritzau-licens m.fl.) er **uverificerede** | Importen opretter rækker uden URL (kan ikke aktiveres); URL-overlay + `sources:check` + D30 | `10-…` §11a, §11g, D30 |

## 8. Status pr. leverance (Fase 0)

| Leverance | Status |
|---|---|
| README, 00-12 | ✔ afleveret (opdateret 3. oktober med kilderegistrene) |
| `source-registries/` (ejerens to registre) | ✔ bevaret uændret; indarbejdet i `03`, `04`, `05`, `10` §11, `12`, ADR-015 |
| ADR-001…015 | ✔ afleveret (status "Foreslået") |
| Verificeret mod kode: CMS, Y Rating, Knowledge OS (repo) | ✔ (se "uverificeret"-markeringer) |
| Kode/migrationer/prompt-tekster | ✘ bevidst ikke (Fase 1+) |
