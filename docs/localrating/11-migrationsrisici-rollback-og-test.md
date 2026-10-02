# 11 – Migrationsrisici, rollback, teststrategi, faseporte og Definition of Done

Dato: 2. oktober 2026. Status: Fase 0 (design). Kilder: master-spec §29-§31; plan "Faser", "Verifikation", "Risici"; `docs/ops/RAILWAY-SETUP.md` §7-§8; `cms/scripts/test-runner.ts`.

## 1. Risikoregister

| # | Risiko | Fase | Sandsynlighed / konsekvens | Forebyggelse | Opdagelse | Rollback |
|---|---|---|---|---|---|---|
| R1 | **Ophavsret/licens** på feed-indhold (lagring, AI-input, gengivelse) | 2-4 | Mellem / **Høj** (juridisk) | `rightsLevel` default `metadata_only`; håndhævelse ved indtag/rating/generering + overlap-værn; `aiHostile`; skriftlig licensafklaring før opgradering (`10-…` §5) | Tests (rights, overlap); `IngestionLog.blocked_rights`; juridisk gennemgang i Fase 2-gate | Sænk niveau ⇒ retroaktiv minimering; slå kilde fra; slet `SourceItem`s |
| R2 | **Hallucination/injuria** (opdigtede fakta/citater; krimi/112) | 4 | Mellem / **Høj** | Kildepakke-id'er, tal-/citatkontrol, faktatjek, `createIngestDraft`-spærringer (politi/112, Krimi/Sundhed), kun kladde, menneske publicerer (`06-…`) | Guardrail-/faktatjek-rapporter; redaktør | Slå `GenerationProfile` fra; `LocalRatingConfig.enabled=false` |
| R3 | **AI-omkostning på delt nøgle** | 1+ | Mellem / Mellem | `AiUsage`, loft pr. instans + globalt, 0 = spærret, 80 %-advarsel, tick-grænser (`09-…`) | Forbrugsside; advarsler | Sæt loft = 0 |
| R4 | **Railway/hosting request-timeout** | 3-4 | Høj / Mellem | Ingen lange requests: `ProductionJob`, batches, lease/heartbeat, NDJSON afkoblet (`04-…` §3) | `ProductionJob` `dead`/`failed`; cron-svar `remaining` | Sænk batch-størrelser; pause cron |
| R5 | **DeepSeek/GDPR** (databehandling uden for EU) | 1+ | Lav (spærret) / Høj | Spærret som standard; `piiPolicy`; aldrig tips/politi/kladder (`09-…` §6) | Test på afvisning; `AiUsage.blocked_policy` | Fjern nøgle/`allowedProviders` |
| R6 | **Knowledge OS mangler tenant-isolation** | 3 | Mellem / **Høj** ved 2. by | Feature-flag; kun én instans; fail-closed adapter; ingen rå tekst; Story/ExternalObjectRef ikke brugt (ADR-004) | `flags: knowledge:*`; test | `knowledgeEnabled=false` |
| R7 | **Y-koden er monolitisk/tæt koblet** (portering fejler) | 3-4 | Mellem / Mellem | Port i små, rene moduler; Y-golden-tests (I5); porterede 49 tests; ingen kopiering af filen | Golden-forskelle | Behold `y` som shadow; ret modul |
| R8 | **Lækkede nøgler i Y's kilde** | 0 (nu) | **Sikker** / Høj | Ejer roterer Reuters/Exa (`09-…` §7); `check-secrets` får `env-fallback-literal`-regel | – | – |
| R9 | **SSRF i ny feed-hentning** | 2 | Mellem / **Høj** | S1-S18, IP-pinning, redirect-genvalidering, `production.manage`, evt. allow-list; 25-punkts testsuite (`10-…` §3) | `IngestionLog.blocked_ssrf`; test | Slå cron/feeds fra |
| R10 | **Prisma sammensatte FK'er deler `instansId`** (ikke verificeret) | 1 | Mellem / Lav | `prisma validate` i Fase 1 før noget andet; fallback: bløde pegere + servicetjek | Fase 1-gate | Skift til bløde pegere i samme (endnu ikke udrullede) migration |
| R11 | **Dobbeltkørsel/overlap** (cron, flere processer) | 2+ | Mellem / Lav | `dedupeKey`, guarded `updateMany`-claims, lease/reaper, idempotente handlere | Metrik: duplikerede jobs | – |
| R12 | **Databasevækst** (`rawPayload`, logs) | 2+ | Høj / Lav | Størrelsesloft, retention (`housekeeping`), rights-minimering | Tabelstørrelser (`pg_total_relation_size`) | Sænk retention |
| R13 | **Støj i inbox** (redaktør drukner) | 3 | Mellem / Mellem | Dedupe, tærskler, `IGNORE/REVIEW` skjult som standard, forfilter (geo/civic), kalibrering mod "gold"-sæt | Acceptrate; "shadow" | Hæv tærskler (profilversion) |
| R14 | **Simulator ≠ live** (kvote `Date.now`, hardcodes, as-of metrics) | 6 | Mellem / Mellem | Ækvivalens-test; advarsler; ingen live-skrivning (§3) | Test; shadow-metrik | `simulatorEnabled=false` |
| R15 | **Hardcodede bynavne i CMS-kernen** (`distribution-engine.ts:100`) | 6 | **Sikker** / Lav-Mellem | Flaget; arves bevidst; ejerbeslutning (`08-…` §2) | Advarsel i UI | – |
| R16 | **Prompt-redigering regresserer/injiceres** | 4/7 | Mellem / Mellem | Låst præambel; versionering, diff, rollback; kontraktvalidering før aktivering; `PROMPTS_EDIT` kun ansvarshavende | Kørsler med `invalid_output` stiger | Rollback til forrige version |
| R17 | **Scope-creep ind i eksisterende moduler** | alle | Mellem / Mellem | Importretning-test; `migration-additive`-test; kode-review-regel "ingen refaktorering"; kun additive linjer | CI | Revert |
| R18 | **Forsinket observation af artikelstatus** (reconciliation 15 min) | 5 | Høj / Lav | Dokumenteret; ingen realtids-forretningskrav | – | – |
| R19 | **Nye afhængigheder** (`rss-parser`, evt. `cheerio`) – supply chain | 2 | Lav / Mellem | Fastlåst version; `npm run audit:prod`; minimal brug; ejergodkendelse | `audit:prod` i CI | Fjern pakke; parser-modul isoleret |
| R20 | **Detached jobs mistes ved genstart** (én replika) | 4 | Mellem / Lav | Lease + reaper + idempotens (`articleExternalId`) | Jobs med udløbet lease | Gen-kør |
| R21 | **Tenant-lækage** (queries uden `instansId`) | alle | Lav / **Høj** | Alle repositories tager `instansId`; cross-tenant tests; lint-regel på `db.<localrating-model>.find*` uden `instansId` | Test | Ret + udrul |
| R22 | **Persondata i feeds/kandidater** (navne i politi/retslister/kommunetekst) | 2-4 | Mellem / **Høj** | Politi/retsliste ikke i LocalRating; privatlivs-guardrail; AI-spærring | Test; redaktør | Slet berørte rækker |
| R23 | **Paritetsomfanget** (Citation, Syntese, Arbejdsrum, assistenter, parse-file, Exa, DST …) udvider Fase 4 kraftigt | 4 | Høj / Mellem | Opdeling 4a-4e (`12-…`); fælles pipeline/gateway; assistenter deler `runAssistant`; connectors (4e) kan udskydes; hver delfase har egen gate | Fremdrift pr. delfase | Udskyd 4d/4e |
| R24 | **Citation/Syntese gengiver andre mediers indhold** (ophavsret) | 4 | Mellem / **Høj** | `rightsLevel` ≥ `snippet_allowed` for tekstgrundlag; overlap-værn pr. kilde; deeplink + kildenavn; kun kladde; juridisk gennemgang (D7) | Overlap-test; redaktør | Slå profiler fra |
| R25 | **Arbejdsrummet bliver en "anden editor"** (plan-princip 3) | 4 | Mellem / Mellem | Ingen artikeleditor: kun draft-tekst + chat; hand-over til CMS-editor; draft er forslag | Review | Fjern direkte-gem; kun hand-over |
| R26 | **AI-operatør misbruges via LocalRating-værktøjer** (injektion i feedtitler, privilegie-eskalering, ukontrolleret AI-forbrug) | 1+ | Mellem / Høj | Værktøjsresultater = HENTET INDHOLD; rights-gate på udgående data; AI-forbrug = `confirm` m. pris; blokerede handlinger (budget, udbyder, publicering); rettigheder = brugerens egne; rate limit | Operatør-tests (`04-…` §5.2); `OperatorAction`/`AuditLog` | Fjern værktøjer fra registret pr. fase |
| R27 | **Operatør-koden er under opbygning** (andres filer ændrer sig) | 1+ | Høj / Lav | LocalRating rører ikke operatørens filer; egen mappe `tools/localrating/`; kun ét import-led i registret; D28 | Merge-konflikter | Afregistrér værktøjer |
| R28 | **Y-repoet ændres ved et uheld** (omdøbning/refaktorering) | alle | Lav / Høj | Y er read-only donor; ingen skriveadgang i scripts; portering envejs; D27; ingen delt pakke | Review af alle scripts (`scripts/localrating-*`) | – |
| R29 | **AI godkender/aktiverer opdagede kilder** (discovery, injektion i websites) – en ukendt side bliver "primærkilde" | 2 | Mellem / **Høj** | `approvalStatus` kun sat af menneske; `aiClassification` er kun forslag; ingen kodesti fra AI-output til `approvalStatus`/`enabled`/`rightsLevel`/`authorityLevel`; værter fra `aiHostile`/ikke-godkendte seeds hentes ikke; discovery-lofter (300 værter, 5 sider/vært) (`10-…` §11d) | Test `localrating-source-approval` (fuzz); godkendelseskø | Afvis/arkivér forslag; `LocalRatingConfig.schedulerEnabled=false` stopper discovery |
| R30 | **Dobbelt-ingest** mellem aI-library (`Signal`) og LocalRating (`SourceItem`) for politi/dagsorden/trafik/DMI | 2 | Mellem / Mellem | `ingestOwner` pr. kilde; envejs dedupe-regel (`Signal` urlNorm/hash/vært+titel); drift-vagt (≥ 3 Signals/24 t på en `localrating`-ejet kilde ⇒ `degraded`) (`04-…` §4a) | Test `localrating-ingest-owner`; drift-siden | Sæt `ingestOwner=ailibrary` / slå kilden fra |
| R31 | **Persondata i retslister/CVR/Statstidende/sociale signaler/tips** hos kilder fra registrene | 2-4 | Mellem / **Høj** | `personDataClass`; `no_pii`-AI; `likely` ⇒ kun overskrift, 30 dages retention, ingen AI-udkast, redaktionel gennemgang; retslister først efter D31; enkeltmandsvirksomheder/privatpersoner ikke i `LocalEntityRef` (`10-…` §11b) | Tests (rights/PII-matrix); `blocked_pii` i `IngestionLog` | Sæt `personDataClass` op; slet berørte `SourceItem`s; slå kilden fra |
| R32 | **Ophavsret på sekundære medier og Ritzau** (TV2 ØST, sn.dk, DR, lokale medier, Ritzau nyhedstjeneste) | 2-4 | Mellem / **Høj** | `SECONDARY_MEDIA`/`AGGREGATOR`/`SOCIAL_SIGNAL` = `metadata_only`, kan kun hæves med licens; Ritzau nyhedstjeneste `blocked` (kan ikke aktiveres); Via Ritzau ≠ Ritzau; `aiHostile` (`10-…` §11b) | `localrating-source-rights`; overlap-test | Sænk niveau ⇒ retroaktiv minimering |
| R33 | **Registrene er ufuldstændige/forældede** (ingen URL'er, døde sites, uverificerede nøgle-/aftalekrav) | 2 | **Høj** / Mellem | Import opretter kun `foreslået`/`enabled=false` uden URL; `sources:check`; `robotsTermsCheckedAt` kræves; discovery markerer døde/flyttede kilder; D30/D32 | Drift-siden (`status`), `lastFailureAt` | Deaktivér kilden |
| R34 | **Lokal-relevans fejlklassificerer** (falsk lokal/falsk ikke-lokal) – støj eller tabte historier | 2-3 | Mellem / Mellem | Ren, testet `scoreLocality` (T1-T14); profildata (vægte/lofter); kalibrering mod "gold" (inkl. nationale dokumenter uden bynavn); tærskler pr. `instanceScope`; `filtered` items kan inspiceres 7 dage | Acceptrate; andel `filtered/locality` | Justér vægte/tærskler (profilversion) |
| R35 | **P0-kapacitet**: 32+ P0-kilder pr. 5 min kan overskride `tick`-budgettet; registrets 1–5 min ikke opnåeligt uden ny infrastruktur | 2 | Mellem / Mellem | P0-kapacitetsreservation, jitter, tier-baseret backoff; 5 min er gulv (afvigelse `README` nr. 23); evt. 2. cron-service (`10-…` §11f) | `remaining` i cron-svar; job-latenstid pr. tier | Sænk P0 → P1 for mindre kritiske kilder |

## 2. Risici pr. fase (kort)

| Fase | Hovedrisici | Port-kriterium (sammen med DoD §5) |
|---|---|---|
| 1 Grundlag | R3, R10, R16-start, R17, R19 | `prisma validate`; migration additiv (test); `lib/ai` + `lib/prompts` testet med fakes; ingen eksisterende test ændret/rød |
| 2 Kilde-lag + ingest | R1, R9, R11, R12, R19, R22, R29-R33, R35 | SSRF-suite 25/25 (+discovery/S16b); dedupe-matrix (+`signal`); rights-test (+`source-rights`); cron-auth; feed-test mod lokal testserver; registry-parser mod de to registerfiler; godkendelses-/AI-grænse-fuzz; ejer har besvaret D29-D32 |
| 3 Kandidater/rating | R6, R7, R13, R34 | Y-golden (I5) 100 %; I1-I20 grønne; shadow-sammenligning på ≥ 50 manuelle "gold"-kandidater |
| 4 Generering | R2, R4, R7, R16, R20 | Kladde-kontrakt-suite; guardrail-tests (porterede + nye); faktatjek-gate; ingen kladde uden kilder med dato |
| 5 Overlevering/drift | R3, R18 | Runbook; forbrugsside; rollback øvet (slå fra pr. instans); nøglerotation bekræftet af ejer |
| 6 Simulator | R14, R15, R21 | Determinisme; **ingen live-skrivning**; rækværk kan ikke omgås; tenant; kvote-ækvivalens |
| 7 Prompt-bibliotek (fuld) | R16 | Kontraktvalidering før aktivering; audit; rettigheder |

## 3. Rollback-strategi

**Princip (spec §31, §29):** små, reversible ændringer; additive migrationer; ingen destruktiv migration uden rollback-plan; feature-flag pr. instans.

| Niveau | Handling | Virkning | Data |
|---|---|---|---|
| **A. Pause** | `LOCALRATING_PAUSED=1` (global, env) eller stop `cron-localrating`-servicen | Ingen cron-arbejde; UI kan stadig læse | Intet tabt |
| **B. Slå fra pr. instans** | `LocalRatingConfig.enabled=false` (og/eller `schedulerEnabled=false`) | Pipeline/AI/UI-handlinger der koster pengene stoppes; nav-link skjules; CMS uændret | Intet tabt |
| **C. Slå del fra** | `simulatorEnabled=false`, `knowledgeEnabled=false`, `GenerationProfile.enabled=false`, `SourceDefinition.enabled=false` (pr. kilde, pr. `priority`, pr. `authorityLevel` eller pr. forælder `parentSourceId`), discovery slået fra via `schedulerEnabled=false`, `monthlyBudgetMicroUsd=0` | Fin-granulær afbrydelse (også "slå alle `SOCIAL_SIGNAL`/`SECONDARY_MEDIA` fra" med én handling) | Intet tabt |
| **D. Kode-rollback** | Railway "Rollback" til tidligere deploy (`RAILWAY-SETUP` §7) | Virker fordi migrationerne er additive | Tabeller bliver stående |
| **E. Aktivér gammel profil/prompt** | Aktivér forrige `RatingProfileVersion`/`PromptTemplateVersion`; `GenerationProfile.configVersion` | Ændret adfærd uden deploy | Historik bevaret |
| **F. Fjern LocalRating helt** | Ny *fremadrettet* migration `localrating_remove` (`03-…` §6) i omvendt rækkefølge efter `pg_dump` | Tabeller væk | Kladder (`Article`) bevares; `AuditLog`/`ArticleRevision` bevares; provenance-id'er peger i det tomme |
| **G. Fjern nav/rettigheder** | Fjern de additive linjer (nav, `PERMISSIONS`, default-roller, `PAGE_PERMISSIONS`); `roles:sync` fjerner ikke rettigheder fra eksisterende roller (`default-roles.ts` kommentar) – ryd manuelt | UI væk | – |

**Hvordan man fjerner tabeller (F):** 1) `LocalRatingConfig.enabled=false` overalt; 2) stop cron; 3) `pg_dump`; 4) deploy kode der ikke refererer tabellerne; 5) deploy migration med `DROP TABLE`-rækkefølgen i `03-…` §6; 6) fjern modellerne fra `schema.prisma` + `npm run prisma:pg:migration -- localrating_remove`; 7) verificér `prisma migrate status`. Ingen eksisterende tabel røres; ingen FK fra eksisterende tabeller peger på LocalRating-tabeller (derfor ingen kaskade-risiko).

**Pr. fase – rollback-note (kort changelog-krav fra spec):** hver fase leveres med `docs/localrating/CHANGELOG.md`-afsnit: hvad ændret, filer/modeller, migration, tests, rollback (A-G ovenfor), kendte begrænsninger.

## 4. Teststrategi

### 4.1 Rammer
- `npm test` = `scripts/test-runner.ts`: `node --test` mod isolerede SQLite-databaser (skabelon bygges pr. schema/seed-hash; hver testfil får egen kopi; `prisma/dev.db` røres aldrig). **Alle nye tests bruger denne ramme** og må ikke ramme nettet (AI via `FakeAiGateway`, hentning via `fetchImpl`/lokal testserver/scriptet `DnsResolver`).
- Skabelon-hash udvides ikke; seed bruger eksisterende instanser (flere byer findes i `network-seed-data.ts`) – tenant-tests bruger to af dem.
- Postgres-sync: `tests/pg-schema.test.ts` + `npm run prisma:pg:check` fanger drift mellem SQLite- og pg-skema.

### 4.2 Testmatrix

| Område | Filer (`cms/tests/`) | Hvad |
|---|---|---|
| **Porterede Y-tests (49)** | `ai-json-repair`, `localrating-taxonomy`, `localrating-guardrails-citation`, `localrating-guardrails-format`, `localrating-generation-profiles`, `localrating-factcheck` | JSON-repair (5), taksonomi (5), citationdisciplin (12), formatguardrails (6), artikeltyper (9), faktatjek (10); `fictiveCaseGuardrails` (2) → `localrating-demo-case` (Local Demo-case er ADAPT-gated). Kræver at funktioner først udtrækkes af `sireRoute.ts` (`01-…` §8) |
| **Rating-matematik** | `localrating-rating-score`, `localrating-rating-local`, `localrating-rating-invariants` | I1-I20 (`05-…` §8); **Y-golden** ≥ 30 fixtures |
| **Feed-parser** | `localrating-feed-parser` | RSS/Atom/RSS 1.0, løse `&`, forkerte tags (loose), DOCTYPE, tomme felter, danske datoer, 500-item-loft, `hasRealFeedContent`-matrix |
| **Dedupe-matrix** | `localrating-dedupe` | NEW/DUPLICATE/UPDATE/RELATED for: samme guid, samme URL (utm/www/http↔https), samme hash, titel-lighed, mod `Article`/`Signal.kildeUrlNorm`, på tværs af kilder; **ikke** på tværs af instanser |
| **SSRF** | `localrating-fetch-ssrf` | 25 punkter (`10-…` §3) |
| **Rights** | `localrating-rights` | Matrix niveau × (lagring, AI-input, generering, overlap, UI); retroaktiv minimering; `aiHostile`; rettighedskrav ved ændring |
| **Kilderegister-parser og klassificering** | `localrating-registry-parser` | Parser **de to rigtige registerfiler** (fixtures = uændrede kopier): 93 + 74 rækker, P0/P1/P2-antal (18/43/32 og 14/35/25); begge kolonneformater; geo-kerne (aliaser, kommunekode 370/330); `Adgang` → `accessMode`/`parserType` for alle distinkte "Adgang"-strenge (ingen ukendte uden `needs_review`); `Område` → `sourceClass`/`sourceType`; `instanceScope`/`ingestOwner`; MVP-lister → `parserConfig.mvp`; tørkørsel skriver intet og laver ingen netværkskald (stub på `fetch`/`dns`); idempotent re-import; menneskeejede felter overskrives aldrig; `--revert` |
| **Kilde-rights og persondata** | `localrating-source-rights` | `deriveRights` for alle `authorityLevel`×`licenseType`-kombinationer (`10-…` §11b): primær offentlig ⇒ `snippet_allowed`, sekundær/aggregator/social ⇒ `metadata_only` + forbud mod fuldtekst, Via Ritzau ≠ Ritzau nyhedstjeneste, Ritzau nyhedstjeneste `blocked` og kan ikke aktiveres, sociale ⇒ `MANUAL`/ingen scraping; `rightsLevel` > `metadata_only` kræver godkendelse + `production.rights.manage`; `personDataClass` ⇒ `no_pii`, retention, `restricted`, ingen AI-udkast ved `likely` |
| **Godkendelsesflow og AI-grænse** | `localrating-source-approval` | Importerede/opdagede rækker er `foreslået`+`enabled=false`; kun menneske med rettighed kan godkende; PRIMARY_*/rights kræver `production.rights.manage`+note; børn kræver godkendt forælder; **fuzz på AI-output** (`aiClassification`) kan ikke ændre `approvalStatus`/`enabled`/`rightsLevel`/`authorityLevel`/`robotsTermsCheckedAt` (I-S3); aktivering kræver URL + `robotsTermsCheckedAt` + test + `rightsLevel` ≠ `blocked`; operatørværktøjer er `confirm` |
| **Discovery** | `localrating-source-discovery` | 10 trin mod scriptede seed-fixtures (Foreningsportal/Winkas, lokalråd, skoler, CVR) med falsk `fetch`/DNS: child sources `foreslået` med `parentSourceId`; lofter (300 værter/5 sider); S16b: kun godkendte seeds, ellers ingen hentning; SSRF-suite gælder også discovery; døde (≥ 4 fejl) ⇒ `dead`, flyttede ⇒ `moved` + nyt forslag; alias-forslag ⇒ `LocalEntityRef(foreslået)`, ingen `GeoTag`-skrivning; idempotent pr. uge |
| **Ingest-ejer (aI-library)** | `localrating-ingest-owner` | `ingestOwner="ailibrary"` ⇒ ingen `FETCH_FEED`; `Signal` bruges som RELATED/kandidatkilde; dedupe mod `Signal` (urlNorm/hash/vært+titel); skift af ejer kræver menneske; drift-vagt ved ≥ 3 Signals/24 t |
| **Lokal-relevans** | `localrating-locality` | T1-T14 (`10-…` §11e): nationalt dokument uden bynavn via CVR/matrikel/institution; fremmed kommune ≤ 40; tvetydigt alias; tenant; ingen hardcodede bynavne; determinisme/monotoni |
| **Primærdata først** | `localrating-primary-first` | I21 (`05-…` §8): havn- og kyst-scenarier med falske kilder og scriptet ur; `primaryFirst`, `firstPrimarySeenAt < firstSecondarySeenAt` |
| **Tenant-isolation** | `localrating-tenant-isolation` | To instanser: ingen læsning/skrivning på tværs for alle LocalRating-services/actions/routes; fremmed id ⇒ "findes ikke"; cron pr. instans; dedupe/cache-nøgler indeholder `instansId`; GeoTag-match kun egne; simulatorscenarie med fremmed id |
| **Determinisme** | `localrating-determinism` | `score()`, `dedupeItem` (givet DB-tilstand), prompt-render (samme input ⇒ samme tekst), simulator (§`08-…` §10) |
| **Kladde-kontrakt** | `localrating-draft-contract` | Via `createIngestDraft`: status `Idé`, `AI-assisteret`, `aiBrug`, `marking.maskinleveret=true` og `godkendtAf=""`, kilder med `dato`, ingen `publiceretTid`; Krimi/Sundhed + politi/112 spærret (403 ⇒ `blocked`); manglende sektion (422); idempotens (`externalId`); `ArticleRevision` + `AuditLog` skrevet; kan ikke nå `Publiceret` |
| **Kildesporbarhed** | `localrating-provenance` | Invarianter (a)-(f) fra `06-…` §4; `segmentMap`; ingen URL uden for kildepakken |
| **Forbrugsloft/gateway** | `ai-gateway-budget`, `ai-gateway-policy`, `ai-gateway-breaker`, `ai-gateway-usage` | Loft 0/80 %/100 %/globalt; `piiPolicy`/deepseek-spærring; breaker pr. provider; `AiUsage` ved alle udfald; ingen nøgler i fejl; `retrieved[]` ikke i `system`; ingen stille fallback |
| **Cron-auth** | `localrating-cron` | 503 uden `CRON_SECRET`; 401 + rate limit på forkert token (som `frontpage-service`-cron-testen); idempotent `tick` (dobbeltkald); budget-/tid-loft; kun forslag/ingen publicering; reaper; `task` valideres |
| **Jobs/events** | `localrating-jobs` | Claim-race (to samtidige `claimDue` ⇒ ét claim), lease, retry/backoff, `dead`, `dedupeKey`, outbox i samme transaktion, event-handlere idempotente, reconciliation (`*_OBSERVED`) |
| **Prompt-register** | `prompts-core-golden`, `prompts-registry`, `prompts-preamble` | Kerne-prompts byte-identiske (golden); versionering/rollback/diff; præambel kan ikke fjernes; ugyldige variabler/tags afvises; audit |
| **Simulator** | `localrating-simulator-*` | Se `08-…` §10 |
| **Local Citation/Syntese** | `localrating-citation`, `localrating-synthese` | Samme input-/output-kontrakt som Y (tags, deeplink-regel, mangler med entiteter, `stripDuplicateLead`, kort/lang, `editorialBrief`-integrate); kildetekst som HENTET INDHOLD; rights-gate; kladde-kontrakt via hand-over |
| **Local Arbejdsrum** | `localrating-workspace` | CRUD + tenant; chat-tur parser `<svar>/<udkast>`; kontekstblokke ikke i `system`; optimistisk samtidighed; `:::`-blokke → `factbox`/`paragraph`; hand-over = `createIngestDraft`; ingen publicering |
| **Assistenter** | `localrating-assist-*` | Pr. `AssistantKind`: zod-input/-output, `AssistantRun` + `AiUsage`, ingen side-effekter, rights/pii/budget; `fetch_article` mod SSRF-suiten; `parse_file`: MIME-allowlist/størrelse/vision-fake |
| **Operatør-værktøjer** | `localrating-operator-*` | Se `04-…` §5.2 |
| **Chat-UI (skillet `chat-module`)** | `chat-ui-*` (komponent-/DOM-tests) | Auto-scroll kun nær bund, ingen `smooth`; typing-indikator + reduced motion; Enter/Shift+Enter, disabled under stream; kopi-knap; retry-tilstand; markdown streaming-sikker (ufuldstændig kodeblok); links `noopener noreferrer` |
| **Y urørt** | `localrating-y-untouched` | Intet script/test skriver til eller importerer fra `SN-DeepDive` ved kørsel (kun engangs-portering læser filer manuelt); lint: ingen sti til `/SN-DeepDive` i `cms/**` |
| **Struktur/vagthunde** | `localrating-import-direction`, `localrating-migration-additive`, `localrating-no-hardcoded-city`, `localrating-no-public-keys`, `check-secrets` (udvidet) | Importretning; kun additive migrationer; ingen bynavne/`slagelse-by` i `lib/localrating/**`; ingen nøgler i klient; nye hemmelighedsregler (`09-…` §8) |
| **Smoke** | `scripts/smoke.ts` (tilføjelser) | `/redaktion/produktion`, `/redaktion/prompter`, `/redaktion/simulator` giver login-redirect uden session og 200 med session; `/api/cron/localrating` giver 503/401 uden/med forkert secret |
| **E2E (manuelt/Playwright, senere)** | – | Næstved-pilot: feed → kandidat → rating → kladde → redaktør, med falske AI-klienter; derefter rigtig nøgle på staging; ingen publicering uden menneske (plan "Verifikation") |

### 4.3 Antal og fixtures (estimat)
Nye tests ≈ 220-300 på tværs af faser (pure-funktions-tunge); fixtures: ~40 feed-filer (RSS/Atom/defekte), 30 Y-golden, 15 SSRF-opskrifter, 3 simulator-scenarier. Fixtures indeholder **ingen** rigtige nøgler og ingen persondata.

## 5. Faseporte og Definition of Done (DoD)

**Fælles DoD for hver fase (1-7)** (plan "Verifikation", spec §29-§30):
1. `tsc` uden fejl; `eslint --quiet` rent (lint-budget uændret).
2. `npm test` grøn (alle eksisterende 429 + nye).
3. `npm run prisma:pg:check` grøn; migration gennemlæst: kun `CREATE`; `localrating-migration-additive`-test grøn.
4. `npm run secrets` grøn; ingen nøgler i diff.
5. `npm run build` + `npm run smoke` grønne.
6. Tenant-isolation-tests for fasens nye kode grønne.
7. Changelog + rollback (A-G) dokumenteret; `docs/ops/LOCALRATING.md` opdateret (fra Fase 5).
8. Review: *hvad fandt jeg / hvad ændrer jeg / hvorfor / berørte filer / migrationsrisiko / testplan* vist **før** større ændring (spec).
9. **Ingen ændring i eksisterende moduler** ud over de additive linjer, og ejeren har set listen over berørte eksisterende filer.
10. Ejerens skriftlige godkendelse af fasen (gate).

| Fase | Specifik DoD (udover fælles) |
|---|---|
| **0** | Dokumenterne i `docs/localrating/` (README, 00-12, ADR-001…015, `source-registries/`) afleveret; åbne spørgsmål besvaret af ejeren; **ingen kode/migration** → *gate: arkitekturgodkendelse* |
| **1** | `lib/ai/` (gateway, usage, loft, json-repair, fakes) + `lib/prompts/` (registry, kerne-prompts read-only, præambel) + `/redaktion/prompter` (read-only, 4 kerne-prompts); permissions + nav + `PAGE_PERMISSIONS`; env/secrets-tilføjelser; migration `localrating_foundation`; `prisma validate` bekræfter FK-design; golden-test for kerne-prompts; evt. `chatSystemPrompt`-udtræk (hvis godkendt) |
| **2** | `safeFetch` + SSRF-suite (inkl. discovery, S16b); parser (3 lag) + kvalitetsgate; normalisering/rights; dedupe (inkl. `signal`-regel); oversættelse (cachet); `SourceDefinition`/`SourceItem` + `localrating_sources`; **`sources:import`/`check` testet mod de to rigtige registerfiler**; godkendelsesflow + AI-grænse-fuzz; adaptere for bølge A/B-kilder med fixtures; forfilter-`scoreLocality`; discovery (2d); `/redaktion/produktion/{feeds,kilder}`; cron-endpoint + Railway-cron-opskrift; jobs/outbox; juridisk gennemgang af rights-defaults; **ejerens svar på D29-D32** |
| **3** | `StoryCandidate` (inkl. `localityScore`, `sourceAuthority`, klynger, `primaryFirst`); `RatingModel` + `score` + `local`; `RatingProfile` (+versioner, `rescore`); sammenligning; fuld `scoreLocality` + `LocalEntityRef`-vedligehold; story-klynger som profildata; Knowledge-adapter (fail-closed); inbox + kandidat-detalje; Y-golden og I1-I25 (inkl. I21 primærdata først); kalibrering mod ≥ 50 "gold"-kandidater (inkl. nationale dokumenter uden bynavn) |
| **4** | `GenerationProfile`/`PromptTemplate` (DB, versioner, playground begyndelse); generator (stream+job); guardrails + faktatjek (porterede tests); kladde → editor; kildesporbarhedsvisning; kladde-kontrakt-suite |
| **5** | Overlevering i eksisterende workflow; forbrugsside; produktionsnøgletal (feed→kandidat→kladde→publiceret); runbook `docs/ops/LOCALRATING.md`; rollback øvet; **ejer har roteret Y's nøgler** |
| **6** | `EditorialPriority`/`PublicationPlan`/`PlanItem`/`SimulationRun`; sandbox + ur; AI-planlægger; tidslinje/forside pr. tid; "hvorfor?"; "Anvend som forslag"; shadow; politiksammenligning; alle simulator-tests |
| **7** | Fuld prompt-redigering (versionering, diff, rollback, playground, kontraktvalidering før aktivering) for LocalRating-/simulator-prompts; kerne-prompts stadig read-only |

**Eksplicit uden for scope (kræver ny godkendelse):** AUTO_WITH_APPROVAL/AUTO, historisk replay, Knowledge-write-back/ExternalObjectRef, flere byer med Knowledge-kontekst, flytning af forside/chat til gatewayen, ændringer i `lib/frontpage/*`/`distribution-engine`.

## 6. Observerbarhed i drift (Fase 5)
`IngestionLog` (hentning), `AiUsage` (forbrug/fejl), `ProductionJob` (kø-dybde, `dead`), `RatingRun`/`GenerationRun` (status). Alarm-forslag (ejeren vælger kanal): P1-kilde uden succes i 3× kadence; `dead`-jobs > 0; AI-fejlrate > 20 % / time; månedsforbrug > 80 %; cron ikke kørt i 15 min. `/api/ready` og `/api/health` ændres ikke.
