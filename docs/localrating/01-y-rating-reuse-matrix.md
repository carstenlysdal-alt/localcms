# 01 – Y-familien → Local-familien: reuse-matrix (REUSE / ADAPT / REPLACE / DROP)

Dato: 2. oktober 2026 (opdateret efter ejerens tilføjelse om **funktionel paritet**). Status: Fase 0. Y Rating-familien er read-only donor; **engangsportering** (ADR-002): envejs, read-only mod Y – ingen løbende synk, ingen delt pakke, ingen ændringer i Y's filer, scripts eller deploy. **Omdøbningen til Local gælder kun i localcms (kode og UI): *Navnet LocalRating/Local Citation m.fl. findes kun i CMS-koden og -UI; Y-navnene bevares i Y.* Y Rating (`/Volumes/SSD Data/Gits/SN-DeepDive`) fortsætter UÆNDRET og må aldrig ændres, omdøbes, refaktoreres eller peges om af dette arbejde.**

**Klasser:** **REUSE** = logik/formler overtages (kodes om i TypeScript-moduler i CMS'et med tests, ikke kopieret som fil). **ADAPT** = funktion og felter bevares, men omskrives (tenant, Prisma, zod, SSRF, gateway, rights). **REPLACE** = funktionen findes, men erstattes af CMS-eksisterende kode eller ny konstruktion. **DROP** = tages ikke med (begrundet).

Konventioner: `Y:` = `SN-DeepDive/functions/src/` (`sireRoute.ts` = `y-test-lab/sireRoute.ts`). Destinationer er under `cms/lib/localrating/` medmindre andet er angivet. `lib/ai/`, `lib/prompts/`, `lib/operator/` er fælles moduler. Linjetal er læst på auditdagen. Hemmeligheder er **ikke** gengivet (se §Sikkerhed).

---

## 0. Paritetskrav og navne-mapping (ejerens tilføjelse)

**Krav:** LocalRating skal have **funktionel paritet med Y-familien** – artikelgenerator, **arbejdsrum (Story Workspace)**, feeds, kilder, scoring og rating, Citation, Syntese, Business-artikler, faktatjek, co-editor/vinkel/bulletin, parse-file m.fl. – **omdøbt til Local, men med de samme attributter, felter og funktioner**. Hver Y-route/funktion har en række i §9 med klasse og Local-destination. Tidligere "DROP"-valg for funktioner med paritetskrav er ændret til ADAPT; det der stadig er DROP er begrundet (sikkerhed/juridisk/ikke-redaktionelt) og kan genåbnes af ejeren.

### 0.1 Navne-mapping (Y → Local)

| Y-navn | Local-navn | Kode-id / destination | Bemærkning |
|---|---|---|---|
| Y Rating | **LocalRating** | `lib/localrating/**`, `/redaktion/produktion/*` | Samlet motor + UI |
| Y Test Lab / SIRE (Story Intelligence Rating Engine) | **Local Lab** (UI) / **LocalRating-motor** (kode) | `/redaktion/produktion/lab`, `lib/localrating/rating/**` | Manuel rating/analyse, feed-browser, sammenligning |
| Y Score | **Local Score** | `RatingModel.id = "score"`, JSON `local_score` | Y's `y_score` → `local_score`; vægte/bånd uændrede |
| Y Rating-dimensioner (7), funktioner (11), pillars (3) | samme, uændrede nøgler | `rating/models/score.ts` | `audience_relevance … production_potential` m.fl. bevares |
| `yRating` / `YRatingDimensions` / `Y_SCORE_WEIGHTS` | `localRating` / `LocalRatingDimensions` / `LOCAL_SCORE_WEIGHTS` | – | kun præfiks |
| Y Citation | **Local Citation** | `generate/citation.ts`, profiler `local-citation`, `local-citation-lang` | kort og lang udgave; tagget output uændret |
| Y Syntese (`/synthesize`) | **Local Syntese** | `generate/synthese.ts`, profil `local-syntese` | |
| Y Business (artikelgenerator) | **Local Business** | `GenerationProfile.kind = "local-business"`, slug `lb:<type>` | 10 artikeltyper bevares |
| Y Workspace / Story Workspace | **Local Arbejdsrum** | `workspace/*`, `/redaktion/produktion/arbejdsrum/<id>`, tabel `LocalWorkspace` | chat + udkast + versionshistorik; hand-over til CMS-kladde |
| Y Compare (`/compare`) | **Local Sammenligning** | `assist/compare.ts` | |
| Y Co-Redaktør, Vinkel, Bulletin, Dagens tal, Deep research-prompt | **Local Co-Redaktør**, **Local Vinkel**, **Local Bulletin**, **Local Dagens tal**, **Local Deep research** | `assist/*` | `AssistantRun` |
| Y Faktatjek / verify-claim | **Local Faktatjek** / **Local Verify-claim** | `generate/factcheck.ts`, `assist/verify-claim.ts` | |
| Y Prompt-bibliotek (`/prompt*`) | **Local Prompt-bibliotek** (`/redaktion/prompter`) | `lib/prompts/**` | |
| Y Test Lab "Feeds"/"Kilder" | **Local Feeds** / **Local Kilder** | `/redaktion/produktion/feeds` | `SourceDefinition` |
| Y gemte artikler (analysis/business saved-articles) | **Local Bibliotek** | `RatingRun`/`GenerationRun` + `savedAt` | |
| Y Y-sprog / rubrikstandard | **Local Sprog** (`base.sprog`) / **Local Rubrikstandard** (`base.rubrik`) | `lib/prompts` fragmenter | kilde: skillet `y-sprog` |
| Mediet Y / Projekt Y / Y.dk / "Y's" (brandreferencer i prompts og UI) | instansens medienavn (`{{medienavn}}`) / "Local" | prompt-variabler | redaktionel stemme og pillarer bevares som *data* |

Brand-/felt-omdøbningen gælder **kun i localcms: UI, kode-id'er, prompt-slugs og JSON-nøgler med "y"-præfiks** – i Y bevares alle Y-navne uændret (`y_score`, `Y_CITATION_SYSTEM_PROMPT` osv.). Redaktionelle begreber der ikke er brandede (Challenge/Inspire/Understand, Blind Spot, Signalradaren, Casen der virker …) beholder deres navne og bliver **data** (profil-/promptindhold), ikke kode.

---

## 1. Feed-konfiguration og kildestyring

| Y-funktion | Y fil:linje | Klasse | Destination | Noter |
|---|---|---|---|---|
| Statiske feedlister: `INTERNATIONAL_NEWS_FEEDS`, `NORDIC_NEWS_FEEDS`, `CORPORATE_FEEDS`, `RITZAU_FEEDS`, `DANISH_BUSINESS_ORGANIZATION_FEEDS`, `Y_TEST_FEEDS` | `sireRoute.ts:371-452`, `:453-483`, `:484-574`, `:613-636`, `:637-646`, `:647-~712`, `:713-949` (418 URL-literaler i 371-949) | **DROP** som kodeliste; **ADAPT** som engangs-importværktøj | `scripts/localrating-import-y-feeds.ts` (Fase 2) | Listen er international/erhverv; importeres kun filtreret, deaktiveret og `metadata_only` (`10-…` §8). **Sekundær efter 3. oktober 2026:** ejerens kilderegistre for Næstved og Slagelse er LocalRatings primære kildekatalog (`10-…` §11, ADR-015); Y-importen kan kun tilføje `foreslået`-rækker og aldrig overskrive registerrækker. *Paritet:* Local Feeds kan oprette/importere de samme kilder; kataloget er data pr. instans, ikke kode |
| Brugerdefinerede feeds i Firestore/fil (`custom_feeds.json`, **tom**: 0 poster) | `sireRoute.ts:2057-2098`; `GET /feeds :2100`, `POST /custom-feeds :2121`, `DELETE :2158` | **REPLACE** | `SourceDefinition` + `/redaktion/produktion/feeds` | Ingen auth i Y; her `production.manage`, tenant, SSRF-test før aktivering |
| Kildemodel `Source` (type rss/atom/sitemap/api/manual/html, `fetchIntervalMinutes`, `rightsLevel`, `lastError`) | `types/content-intelligence.ts:16-31` | **ADAPT** | `SourceDefinition` | Udvidet med registrets felter (`accessMode` i stedet for `type`, `authorityLevel`, `priority`, `geoFilter` …; `03-…` §2a). Y's `html`-type erstattes af `HTML_MONITOR` (ændringsdetektion på *konfigureret* URL – ikke generisk scraping); `EMAIL`/`WEBHOOK` reserveres |
| Kilde-CRUD i Firestore | `server/services/sourceService.ts:7-57` | **REPLACE** | `lib/localrating/feeds.ts` | |
| "Test feed" – naken `fetch(source.url)` uden SSRF-værn | `sourceService.ts:59-74` | **REPLACE** | `testFeed()` via `safeFetch` + `parseFeed` | |
| Feed-opdagelse (`POST /find-feed`: DuckDuckGo + cheerio efter `<link rel=alternate>`) | `sireRoute.ts:2171-2275` | **ADAPT** (kun discovery fra indtastet URL) | `feed-discovery.ts` | DuckDuckGo-søgning **DROP** (tredjepart); redaktøren indtaster URL/medienavn → forslag til feed-URL'er fra siden |
| Geografi/emneafgrænsning pr. kilde | `types/content-intelligence.ts:11,55-69` | **REPLACE** | `SourceDefinition.geoTagId`, `StoryCandidate.geoTagIds` | Instansens `GeoTag`; `matchGeo` (`lib/ingest/geo.ts:56`) |
| Kildegrupper ("Danske nyhedsmedier", "Ministerier" …) | `group:`-felter | **ADAPT** | `SourceDefinition.category` + `sourceType` | |
| TopicFeed (emnebaserede feeds + Notion-push) | `server/services/topicFeedService.ts:8-59`, `notionService.ts:14-128`, `types/…:136-148` | **ADAPT** (TopicFeed) / **DROP** (Notion) | `lib/localrating/topics.ts` (gemt søgning/filter over kandidater) | Notion-integration uden for scope |

## 2. Hentning, parsing, retries, scheduling

| Y-funktion | Y fil:linje | Klasse | Destination | Noter |
|---|---|---|---|---|
| 3-lags feed-parser (`rss-parser` → rå fetch + sanering → "loose" sax) | `sireRoute.ts:951-987`, `:1110-1166` | **ADAPT** | `feed-parser.ts` | Parseren får *bytes* fra `safeFetch` (`parseString`, aldrig `parseURL`) |
| Site-specifikke hacks (JP-/TBIJ-scrapere, URL-omskrivninger, SEC-UA) | `sireRoute.ts:991-1108,1110-1112` | **DROP** | – | Scraping af enkeltsites |
| "slowAES"-udfordringsløser med `vm.runInContext` på **fjern JS** | `sireRoute.ts:1127-1152` | **DROP** | – | Fjernkodeudførelse; omgår bot-beskyttelse |
| Browser-UA til feeds | `sireRoute.ts:951-957` | **REPLACE** | `fetch.ts` ærligt UA | |
| **Googlebot-UA** til artikelscraping/paywall-tjek | `sireRoute.ts:4092,4165`; `scraperService.ts:14` | **DROP** | – | Forklædning; paywall-omgåelse |
| `mapWithConcurrency` (12 samtidige, hård deadline) | `sireRoute.ts:1174-1209`, `:5831-5833` | **ADAPT** | `pool.ts` | pr. host 1, globalt ≤ 6 |
| Dato-parsing (`parseDanishDate`, `dateKey`) | `sireRoute.ts:1211-1245` | **ADAPT** | `dates.ts` | |
| Feed-item-mapping (content:encoded/description/…) | `sireRoute.ts:6489-6527` | **ADAPT** | `normalize.ts` | |
| Fuldtekst-berigelse af "tynde" feeds ved at hente `item.url` | `sireRoute.ts:6529-6550`, `THIN_FEED_ENRICHMENT_URLS :594` | **ADAPT** (opt-in senere) | `fetchArticle` (Fase 2b) | **SSRF-flade**: kun `fulltext_allowed`/`licensed` + `safeFetch` + robots; *ikke i v1* |
| Særkilder: OAI-PMH, OpenAlex, HAL, Nasdaq, Oslo Børs | `sireRoute.ts:1247-1520` | **DROP** | – | Ikke lokale (forskning/børs) |
| Retsinformation, Folketingets ODA, Regelforum-CSV, åbne data-websites | `sireRoute.ts:5972-6019`, `:6021-6064`, `:6066-6103`, `:6105-~6380` | **ADAPT** (senere, typede `API`-connectors) | `lib/localrating/connectors/*` | Lovforslag/regler er relevante lokalt; kun typede adaptere, ingen HTML-scraping |
| Reuters Connect | `sireRoute.ts:5275-5480` (`/reuters-feed`, `/reuters-item`) | **ADAPT** (valgfri `licensed`-connector, **slået fra**) | `connectors/reuters.ts` | Nøgler kun som Railway-variabler (aldrig Y's hardcodede) |
| sn.dk "chattymakker" søge-API | `sireRoute.ts:5853-5970`; `index.ts:~195-205` | **DROP** | – | Uofficiel API hos medie der forbyder AI-crawlere (T8 §0.5) |
| Retries af feed-hentning | (findes ikke) | **NY** | `fetch.ts` + `jobs.ts` | Backoff m. jitter, `Retry-After`, `down` efter 5 fejl |
| Betinget GET (ETag/Last-Modified), `robots.txt` | (findes ikke) | **NY** | `fetch.ts`, `robots.ts` | |
| Scheduler: `scheduledIngestion` (returnerer tidligt) | `index.ts:226-234` | **REPLACE** | `/api/cron/localrating` + Railway-cron | |
| `runIngestionCycle`, `startScheduler` | `server/services/schedulerService.ts:10-56` | **REPLACE** | `jobs.ts` | in-memory-lås/`setInterval` droppes |

## 3. Ingest, normalisering, kanonisering, hashes, dedupe

| Y-funktion | Y fil:linje | Klasse | Destination | Noter |
|---|---|---|---|---|
| Ingest-flow (`checkSource`) | `feedService.ts:29-128` | **ADAPT** | `ingest.ts` | Fjern inline-scrape (`:66-72`) og inline AI-attribution (`:94-99`) |
| **`POST /rss-items`** – hent items fra valgte feeds, filtrér pr. dato/interval, `limitPerFeed`, `skipDanishSnippets`, fejl pr. feed | `sireRoute.ts:5790-6595` | **ADAPT** | `GET/POST /api/localrating/feed-items` (server action) + Local Lab-feedbrowser | Samme parametre (feeds, dato/dateFrom/dateTo, limit) men mod `SourceItem`-tabellen (ikke live-hentning pr. klik); "hent nu" = job |
| Kvalitetsgate `hasRealFeedContent` | `sireRoute.ts:1598-1649` | **ADAPT** | `feed-quality.ts` | pr. kilde-gate; domæneundtagelser droppes |
| HTML-strip (`stripFeedHtml`, `safeString`) | `sireRoute.ts:1565-1596` | **REPLACE** | `lib/validation/text.ts:26-45` | |
| URL-normalisering | `server/utils/url.ts:1-48` | **REPLACE** | `lib/validation/text.ts:84-100` | Matcher `Signal.kildeUrlNorm` |
| Hashes | `server/utils/hash.ts:3-5` | **REUSE** (idé) | `lib/validation/tokens.ts:11` (`sha256Hex`) | + `contentHash` |
| Dedupe på URL-hash | `externalArticleService.ts:31-39` | **ADAPT** | `dedupe.ts` | NEW/DUPLICATE/UPDATE/RELATED |
| Ændringsdetektion | `versioningService.ts:5-54` | **ADAPT** | `dedupe.ts` (`UPDATE`) | |
| Klyngning (`processForClusters`), `StoryCluster` | `clusteringService.ts:40-73`; `types/…:118-134`; `routes/storyClusterRoutes.ts` | **ADAPT** | `StoryCandidate.clusterKey`/`relatedCandidateIds` + kandidat-klynge-visning | Lighedsbaseret i stedet for lig-`mainTopic` |
| Ekstern-artikel-attribution (topic, subtopic, entities, geography, urgency/novelty/**localRelevance**/followup/citationStoryPotential/sourceImportance, confidence, shortSummary, editorialRecommendation) | `aiAttributionService.ts:9-92` (prompt `:9-37`); `ExternalArticleAttributes` `types/…:55-69` | **ADAPT** | `rating/features.ts` (triage-opgave, prompt `triage`) | Felterne bevares som *triage-attributter* på `StoryCandidate` (`entities`, `topics`, `geography`, `shortSummary`) og indgår som ratinginput; 0-1-skalaer omsættes til 0-100 |
| Resuméer (`one_line, short_summary, editorial_brief, followup_brief, citation_story_brief, version_summary`) | `summaryService.ts:12-81`; `ArticleSummary` `types/…:86-100` | **ADAPT** | `assist/summary.ts` (prompt-skabeloner pr. type) | |
| Citation-briefs (`CitationBrief`: mainPoint, ownAngle, verificationNeeded, possibleSources, headlineSuggestions …) | `citationBriefService.ts:12-89` (prompt `:11-25`); `types/…:102-116` | **ADAPT** | `assist/citation-brief.ts` → fødes ind i **Local Citation** | "Sjællandske Nyheder"-brandreference erstattes af `{{medienavn}}` |
| Oversættelse + resumé af udenlandske feed-items | `sireRoute.ts:1655-1753`; `isForeignFeed :1559-1563` | **ADAPT** | `translate.ts` | Cache pr. `contentHash`; `SourceDefinition.language`; rights-gate |
| Taksonomi (`normalizeArticleTaxonomy`, `TAXONOMY_PROMPT`) | `taxonomy.ts:230-267`, `:282-324` | **ADAPT** algoritme+prompt / **REPLACE** data | `taxonomy.ts` + prompt `rating.taxonomy` | Sektioner fra instansens `Category`-træ (data) |
| Mediernavns-normalisering (`MEDIA_NAME_MAP`, `cleanMediaName`) | `sireRoute.ts:3632-3805`, `:3825-` | **ADAPT** | `generate/guardrails.ts` + data | Lokal medieliste som data |

## 4. Rating: dimensioner, vægte, tærskler, score (**Local Score**)

| Y-funktion | Y fil:linje | Klasse | Destination | Noter |
|---|---|---|---|---|
| 7 dimensioner + vægte (`.20/.15/.15/.15/.15/.15/.05`) | `businessArticleTypes.ts:758-776`; `sireRoute.ts:1860-1870`, `:2013-2021` | **REUSE** | `rating/models/score.ts` + profil `local-score` | Y Score → Local Score (`local_score`) |
| Prioritetsbånd 85/70/55/40 | `businessArticleTypes.ts:783-785`; `sireRoute.ts:2022-2023` | **REUSE** | `local-score`-profilens `thresholds` | |
| 11 funktioner + signalord | `sireRoute.ts:1777-1857`; `businessArticleTypes.ts:445-649` | **REUSE** | `rating/models/score.ts` + prompt `rating.score` | |
| `resolvePrimaryFunction` + `TIEBREAK_ORDER`; sekundære | `sireRoute.ts:1953-1967`, `:366-369`, `:2027-2034` | **REUSE** | samme | |
| Pillar-scores | `sireRoute.ts:1975-2007` | **REUSE** | samme | |
| `PILLAR_BY_FUNCTION`, `FORMAT_BY_FUNCTION` | `sireRoute.ts:337-363`, `:2036-2040` | **REUSE** | samme | |
| `clampScore`, `applyServerSideRules` | `sireRoute.ts:1969-1973`, `:2009-2050` | **REUSE** | `rating/models/score.ts#score` | |
| Kildekritisk lag | `sireRoute.ts:1888-1897` | **ADAPT** | `score`-feltsæt + `local`-estimater | |
| Korte-artikler-straf (kun i prompt) | `sireRoute.ts:1881` | **ADAPT** | `score`: som Y; `local`: deterministisk cap | |
| SIRE-systemprompt (+ `custom_prompt.txt` override) | `sireRoute.ts:1759-1947`; `y-test-lab/custom_prompt.txt` (17.657 B; afviger fra konstanten i 13 diff-linjer) | **ADAPT** | `PromptTemplate` `rating.score` | Se `07-…` §6 |
| **`POST /rate`** | `sireRoute.ts:6598-6628` | **ADAPT** | `rating/engine.ts` + Local Lab "Rate tekst" | Samme input `{text,title,sourceType,skipSummary}`; klient-leveret `systemPrompt` (`:6599-6605`) **DROP** |
| **`POST /summary`** | `sireRoute.ts:6630-6661` | **ADAPT** | `assist/summary.ts` | |
| `GET /search` (web-søgning via **scraping af DuckDuckGo-HTML**, ikke AI; 10 min cache) | `sireRoute.ts:6663-6757` | **REPLACE** | Local Research (`assist/research.ts`, Exa) | Scraping af tredjeparts-HTML droppes; funktionen "find kilder til emne" dækkes af Exa (valgfri nøgle) |
| Rating-historik, versionering | (findes ikke) | **NY** | `RatingRun`, `RatingProfile(+Version)` | |

## 5. Prompts og prompt-bibliotek

| Y-funktion | Y fil:linje | Klasse | Destination | Noter |
|---|---|---|---|---|
| Overrides via Firestore + `custom_prompt*.txt` (`resolvePromptForType`) | `sireRoute.ts:4326-4381`, `:7040-7077` | **REPLACE** | `lib/prompts/` + `PromptTemplate(+Version)` | |
| Tilbageskrivning til Markdown-filer (`updateMarkdownDocPrompt`, `updateCitationSpecPrompt`) | `sireRoute.ts:4251-4325` | **DROP** | – | Skrivning til kildefiler fra offentlig route |
| `GET/POST /prompt`, `POST /prompt/reset`, `POST /prompt-playground` | `sireRoute.ts:4383-4450`, `:4425`, `:4452-4527` | **ADAPT** | `/redaktion/prompter` (versionering, diff, rollback, playground) | |
| Sprog-base, rubrikstandard | `prompts/sprogstil-base.ts:22-150`; `prompts/y-rubrikker.ts`; `sireRoute.ts:26-41` | **ADAPT** | `base.sprog`, `base.rubrik` | Kilde: skillet `y-sprog`; fuld portering i `07-…` §6 |
| Aftenbrief-prompts | `prompts/aftenbrief.ts:23-68` | **ADAPT** | Local Business `lb:aftenbrief` | |

## 6. Artikelgenerator (**Local Business**), Citation, Syntese, Arbejdsrum og orkestrering

| Y-funktion | Y fil:linje | Klasse | Destination | Noter |
|---|---|---|---|---|
| 10 artikeltyper med struktur/kildekrav/tone/længde/regel | `businessArticleTypes.ts:25-35`, `:92-304` | **ADAPT** | `GenerationProfile` `lb:*` (data) | Seedes deaktiveret pr. instans; `klumme` ADAPT-gated (se nedenfor) |
| Klummegenrer, pillar-meta, funktions-meta | `businessArticleTypes.ts:324-366`, `:378-444`, `:457-649` | **ADAPT** | profildata | |
| Systemprompt-pipeline (`buildBusinessArticleSystemPrompt`) | `sireRoute.ts:7097-7227` | **ADAPT** | `generate/pipeline.ts` | Fragmenter bliver versionerede `PromptTemplate`; SYSTEM/BRUGER/HENTET adskilles (`06-…`) |
| Brugerindhold (`buildBusinessArticleUserContent`) | `sireRoute.ts:7229-7253` | **ADAPT** | `generate/pipeline.ts` | råmateriale flyttes til HENTET INDHOLD |
| Datakilde `reel` (A/B/C-dokumentationsniveau) | `sireRoute.ts:7087-7095` | **REUSE** | prompt `generate.reel` + `GenerationProfile.config.verification` | |
| Datakilde `fiktiv` + **`/business-fictive-case`** (fiktive cases, safety-net, organisationserstatninger) | `sireRoute.ts:7083-7085`, `:7258-7690` (route `:7606`) | **ADAPT – gated** ("Local Demo-case") | `generate/demo-case.ts` | Kun i Local Lab/sandbox og undervisning; **mærket SYNTETISK**; **hand-over til CMS-kladde spærret** (spec §28 provenance). Ejerbeslutning D21 |
| Output-JSON-kontrakt | `sireRoute.ts:7160-7208`; typer `businessArticleTypes.ts:650-850` | **ADAPT** | `generate/schema.ts` (zod) | `yRating`→`localRating`; øvrige felter bevaret (`produktionskort`, `materialekontrol`, `formatLeverance`, `hvadSkerDer`, `pullQuote`, `blindSpot`, `betyderDetForDig`, `faktaboks`, `kildeoversigt`, `kvalitetsvurdering`, `versionering`, `syntetiskMaerkning`, `heroImageBrief`) |
| Kildesegmenter grøn/gul/rød/grå | `businessArticleTypes.ts:690-700`; `sireRoute.ts:7913-7961` | **REUSE** | `generate/schema.ts` + `segmentMap` | `kildeReference` → K-id'er |
| Prosa-rensning, korte afsnit, attribution, format-håndhævelse, sanering | `sireRoute.ts:7814-8281` | **REUSE/ADAPT** | `generate/guardrails.ts` | + 4 testfiler |
| JSON-reparation | `jsonRepair.ts:1-80` | **REUSE** | `lib/ai/json-repair.ts` | |
| Genopretning ved ugyldigt svar | `sireRoute.ts:8297-8315` | **REUSE** | `generate/pipeline.ts` | |
| **`POST /business-article`** (+ NDJSON-stream) | `sireRoute.ts:8317-8453` | **ADAPT** | `generate/pipeline.ts` + NDJSON-events | Job + stream afkoblet |
| **`POST /citation`** – Citathistorie (kort 180-260 ord og **lang**, `extraSources`, `editorialBrief` m. "BYG IND/MERGE", tagget output `<overskrift><manchet><artikel><kilde><mangler>`, deeplink-regel, `stripDuplicateLeadFromArtikel`, anglicisme-rens) | `sireRoute.ts:4643-4690` (prompts), `:4694-4717`, `:4719-4860` (route); `sanitizeAnglicisms :4529` | **ADAPT** | **Local Citation**: `generate/citation.ts`, profiler `local-citation` + `local-citation-lang`; UI i Local Lab/Arbejdsrum | Samme input (`title,text,sourceUrl,sourceName,publishedDate,sourceLanguage,editorialBrief,extraSources,format`) og samme tagget output; kildeteksten er HENTET INDHOLD; rights-gate; output bliver kladde via hand-over (aldrig direkte) |
| **`POST /synthesize`** – baggrundsartikel (syntese) af ≥ 2 kilder (`<source_n>`, 400-600 ord, tagget output) | `sireRoute.ts:6722-6845` | **ADAPT** | **Local Syntese**: `generate/synthese.ts`, profil `local-syntese` | ≥ 2 kilder påkrævet; hver kilde med rights-niveau |
| **`POST /compare`** (2-8 artikler, `analysis` + `articleSummaries` m. `actionableLift`/`keyInsight`) | `sireRoute.ts:4554-4640`, route `:4593-4692` | **ADAPT** | **Local Sammenligning**: `assist/compare.ts` (prompt `analysis`) | Input: `RatingRun`-resultater (Local Score) + uddrag |
| **Workspace** (`POST /workspace`, `GET /workspace/:id`, `POST /workspace/:id/chat`, `PUT …/draft`, `PUT …/format`, `GET /workspace-formats`): chat-arbejdsrum med `sourceContext`, `draft{headline,manchet,artikel,kilde}`, `targetFormat`, `messages`, `attachments`, `webSearch`, `versionHistory`, tags `<svar>`/`<udkast>`, CMS-blokke `:::bullets/:::factbox/:::chart` | `sireRoute.ts:4872-5271` (formater `:4872-4890`, prompt `:4878-~4930`, user-builder `:4940-5027`, chat `:5105-5230`) | **ADAPT** | **Local Arbejdsrum**: `workspace/*`, tabel `LocalWorkspace`, `/redaktion/produktion/arbejdsrum/<id>` | Ejerens krav (overstyrer plan-princip 3 delvist): arbejdsrum er et *skrive-/chat-værksted*, **ikke** en ny artikeleditor; endelig kladde sker via hand-over → `createIngestDraft` → åbn i CMS-editor. UI følger skillet `chat-module` (`04-…` §6). `:::`-blokke bevares som arbejdsrums-markup og oversættes til `factbox`/`paragraph` ved hand-over; `chart` kræver ejerbeslutning (ingen `chart`-blok i CMS) |
| **Faktatjek** (`POST /fact-check`, `/business-fact-check`) | `sireRoute.ts:8460-8711`, `:8713-8731`; typer `businessArticleTypes.ts:1157-1243` | **ADAPT** | **Local Faktatjek**: `generate/factcheck.ts` | Samme felter (`samletScore`, `verificeretAntal`, `hallucinationsRisiko`, `fund[]`, `kildeEksistens`, `kildeDatering`, `verificeringsForslag`) |
| **`POST /verify-claim`** (Exa) | `sireRoute.ts:8733-8846` | **ADAPT** | `assist/verify-claim.ts` | Kun med `EXA_API_KEY` |
| **Co-redaktør** (`POST /co-editor`, `/co-editor-research-queries`) | `sireRoute.ts:8848-8982`, `:9029-9105`, `:9107-9128`; typer `businessArticleTypes.ts:1244-1306` | **ADAPT** | **Local Co-Redaktør**: `assist/coeditor.ts` | Kategorier `vinkling/kildekritik/modstemme/konsekvens/struktur/sprog/blind_spot` bevares |
| **`POST /suggest-angle`** | `sireRoute.ts:9130-9215` | **ADAPT** | **Local Vinkel**: `assist/angle.ts` | |
| **`POST /bulletin`** | `sireRoute.ts:9365-9432`; `bulletsBlock.ts` (frontend) | **ADAPT** | **Local Bulletin**: `assist/bulletin.ts` | |
| `POST /suggest-dagens-tal` | `sireRoute.ts:9217-9293` | **ADAPT** | **Local Dagens tal**: `assist/dagens-tal.ts` | Data-kandidater med `kildeCitat` |
| `POST /deep-research-prompt` | `sireRoute.ts:9295-9363` | **ADAPT** | **Local Deep research**: `assist/deep-research.ts` | Genererer *brief* til eksternt værktøj; ingen kald til tredjepart |
| Aftenbrief-queries | `sireRoute.ts:8984-9027` | **ADAPT** | `assist/coeditor.ts` (aftenbrief-variant) | |
| **`POST /parse-file`** (tekst/PDF/Word/billede → udtrukket kildemateriale; tilstande `y-rating`/standard; billeder via Gemini Vision) | `sireRoute.ts:7667-7757` (prompts `:7667,:7669`); `callGeminiVision :302-317`; `pdf-parse` | **ADAPT** | `assist/parse-file.ts` | Filupload ≤ 20 MB, MIME-allowlist; billeder via gatewayens *vision*-evne (Anthropic som default); ingen server-side hentning; udtrukket tekst er ubetroet |
| **`POST /extract-sources`** | `sireRoute.ts:7774-7813` | **ADAPT** | `assist/extract-sources.ts` | |
| **`POST /business-hero-image`** (Gemini billedgenerering) | `sireRoute.ts:7758-7783`; `callGeminiImageGeneration :319-331` | **ADAPT – gated** | `assist/hero-image.ts` (Fase 4+, valgfri) | Kun `heroImageBrief` (tekstbrief) i v1; billedgenerering kun efter ejerbeslutning om AI-billeder (mærkning, rettigheder) – D22 |
| **Exa**: `POST /web-search`, `/exa-search`, `/exa-research` | `sireRoute.ts:3447-3630` (prompt `:3543`), `:3923-4076`, `:5483-5577` (prompt `:5529`) | **ADAPT** (valgfri) | **Local Research**: `assist/research.ts` | `EXA_API_KEY` valgfri; resultater = HENTET INDHOLD; ingen hardcodet fallback-nøgle |
| **`POST /semantic-search`** (AI-relevans over feed-items) | `sireRoute.ts:5578-5636` (prompt `:5598`) | **ADAPT** | `assist/semantic-search.ts` (Local Lab/inbox) | Kun items med rights ≥ `metadata_only` (headline); `art_n`-id-mapping bevares |
| **`POST /score-sources`** (hurtig brugbarheds-score pr. artikel 0-100) | `sireRoute.ts:5638-5691` (prompt `:5652`) | **ADAPT** | `assist/score-sources.ts` (Local Lab/feedbrowser: "hurtig score") | Billig triage-opgave |
| **`POST /optimize-query`** | `sireRoute.ts:6846-6900` (prompt `:6855`) | **ADAPT** | `assist/optimize-query.ts` | Søgeforespørgsel til Exa ud fra "mangel" |
| **Gemte artikler** (`/analysis-saved-articles`, `/business-saved-articles` + `/saved-articles` legacy; POST/GET/GET:id/DELETE) | `sireRoute.ts:9434-9670` | **ADAPT** | **Local Bibliotek**: `savedAt`/`label` på `RatingRun`/`GenerationRun`/`LocalWorkspace` + `/redaktion/produktion/bibliotek` | Rating- og generator-resultater gemmes allerede automatisk; "Gem" = bogmærke |
| **`POST /scrape-article`**, **`POST /fetch-url`** (hent artikeltekst fra URL(er), op til 10) | `sireRoute.ts:4078-4154`, `:5693-5755` | **ADAPT** | `assist/fetch-article.ts` ("Hent artikel fra URL" i Local Lab/Arbejdsrum) | Redaktør-handling; `safeFetch` (SSRF-regler), ærligt UA, robots, ingen paywall-omgåelse; uddrag af `<article>`/`og:*` som i Y; rights = redaktørens ansvar (`manual`-kilde, `metadata_only` indtil markeret) |
| **`POST /check-paywalls`** | `sireRoute.ts:4156-4248` | **ADAPT (lille)** / **DROP** (Googlebot-UA) | `assist/fetch-article.ts` (paywall-*markering* fra JSON-LD `isAccessibleForFree`/kendte markører) | UA-forklædning droppes |
| `GET /backlog`, `POST /backlog` (skriver til `BACKLOG.md` i kildekoden) | `sireRoute.ts:5755-5788` | **DROP** | – | Skrivning til repo-fil fra offentlig route |
| DST/Danmarks Statistik (`/dst-data`, `/dst-rss.xml`, `/dst/subjects|tables|tableinfo|data`, `/dst/ask` m. udvælgelses-/mapping-/syntese-prompts, `computeDeterministicMath`) | `sireRoute.ts:2340-3445` (prompts `:2866,:2885,:2966,:3147,:3174`) | **ADAPT** (senere, Fase 4b+) | **Local Data**: `connectors/dst.ts`, `assist/data-ask.ts` | Meget relevant lokalt (kommunetal); egen fase; deterministisk matematik bevares |
| `GET /oda-bills` | `sireRoute.ts:2277-2338` | **ADAPT** (senere) | `connectors/oda.ts` | |
| Hjælpefunktioner for artikler (`/saved-articles` m.fl.), `YTestLab.tsx`, `YBusinessArticleGenerator.tsx`, `StoryWorkspace.tsx` | `SN-DeepDive/y-test-lab/*.tsx` (uverificeret i detaljer) | **REPLACE** | Next.js-sider under `/redaktion/produktion/*` | Samme funktioner (feltliste fra routes ovenfor); ikke Y's React/Vite-kode |

## 7. Workflow/status, logs, historik, UI, API, DB, AI

| Område | Y-funktion | Y fil:linje | Klasse | Destination | Noter |
|---|---|---|---|---|---|
| Workflow/status | ingen persisteret state | `types/content-intelligence.ts:71-117` | **REPLACE** | CMS workflow + `StoryCandidate.status` | |
| Logs | `logIngestion` | `externalArticleService.ts:67-73` | **ADAPT** | `IngestionLog` | |
| Historiske ratings | ingen (localStorage) | – | **NY** | `RatingRun` | |
| UI | Y Test Lab / Business-generator / Story Workspace | `SN-DeepDive/y-test-lab/*.tsx` | **REPLACE** | `/redaktion/produktion/{lab,feeds,kandidater,arbejdsrum,bibliotek}` | Funktionsparitet via §6/§9 |
| API | Express (≥ 70 ruter, ingen auth) | `sireRoute.ts` | **REPLACE** | Server actions + route handlers (auth, same-origin, rate limit, zod) | |
| DB | Firestore-collections | se §1/§3/§6 | **REPLACE** | Prisma | |
| AI-provider | DeepSeek→Gemini; 3 kopier + `aiService.ts` | `sireRoute.ts:100-300`; `aiService.ts:1-49` | **REPLACE** | `lib/ai/` | |
| Gemini Vision/billeder | `callGeminiVision`, `callGeminiImageGeneration` | `sireRoute.ts:302-331` | **ADAPT** (vision) / gated (billeder) | gatewayens vision-evne; se `parse-file`/`hero-image` | |
| Secrets | `defineSecret` + hardcodede fallback-værdier | `index.ts:13-77` | **DROP** | – | §Sikkerhed |
| Analytics (GA4-endpoints) | `/api/ga4/*` | `index.ts:~90-160` | **DROP** | – | Y-/sn.dk-specifikt; CMS har egen metrik |
| Mirror-filer | `y-test-lab/{sireRoute,businessArticleTypes,taxonomy,jsonRepair}.ts` identiske med `functions/src/…` | – | **DROP** (kopi) | – | Port fra én kopi |

## 8. Tests (49) → porteringsplan

| Y-testfil (i `SN-DeepDive/y-test-lab/`) | Linjer / tests | Dækker | Destination (`cms/tests/`) |
|---|---|---|---|
| `jsonRepair.test.ts` | 40 / 5 | `parseJsonObject` | `ai-json-repair.test.ts` |
| `taxonomy.test.ts` | 72 / 5 | taksonomi | `localrating-taxonomy.test.ts` |
| `citationDiscipline.test.ts` | 210 / 12 | medienavne, prosa, attribution | `localrating-guardrails-citation.test.ts` |
| `businessFormatGuardrails.test.ts` | 117 / 6 | formathåndhævelse | `localrating-guardrails-format.test.ts` |
| `businessArticleTypes.test.ts` | 156 / 9 | artikeltype-invarianter | `localrating-generation-profiles.test.ts` |
| `factChecker.test.ts` | 467 / 10 | faktatjek-rapportform | `localrating-factcheck.test.ts` |
| `fictiveCaseGuardrails.test.ts` | 36 / 2 | fiktiv-case | `localrating-demo-case.test.ts` (nu **portes**: Local Demo-case er ADAPT-gated) |
| *(nye)* | – | rating, feeds, dedupe, SSRF, rights, kladde-kontrakt, tenant, determinisme, workspace, citation/syntese-kontrakter, operator-værktøjer | `11-…` §4 |

Alle 7 testfiler importerer `./sireRoute`; funktionerne udtrækkes først i rene moduler (Fase 2/4).

## 9. Komplet route-katalog (Y `router.*` + Express-niveau) → Local

Hver Y-route har præcis én række. Linjer = `router.*`-linjen i `sireRoute.ts` hvis intet andet angives.

| # | Y-route | Linje | Klasse | Local-navn / destination |
|---|---|---|---|---|
| 1 | `GET /feeds` | 2100 | REPLACE | Local Feeds (`SourceDefinition`-liste) |
| 2 | `POST /custom-feeds` | 2121 | REPLACE | opret `SourceDefinition` (+ SSRF-test) |
| 3 | `DELETE /custom-feeds/:id` | 2158 | REPLACE | arkivér/deaktivér `SourceDefinition` |
| 4 | `POST /find-feed` | 2171 | ADAPT | feed-discovery |
| 5 | `GET /oda-bills` | 2277 | ADAPT (senere) | `connectors/oda.ts` |
| 6 | `GET /dst-data`, `GET /dst-rss.xml`, `GET /dst/subjects`, `GET /dst/tables`, `GET /dst/tableinfo/:tableId`, `POST /dst/data`, `POST /dst/ask` | 2340, 2415, 2467, 2495, 2529, 2549, 3397 | ADAPT (senere) | Local Data (`connectors/dst.ts`) |
| 7 | `POST /web-search` | 3561 | ADAPT | Local Research (Exa) |
| 8 | `POST /exa-search` | 4026 | ADAPT | Local Research (Exa) |
| 9 | `POST /scrape-article` | 4078 | ADAPT | Hent artikel fra URL |
| 10 | `POST /check-paywalls` | 4231 | ADAPT (markering) / DROP (UA) | paywall-markering |
| 11 | `GET /prompt`, `POST /prompt`, `POST /prompt/reset`, `POST /prompt-playground` | 4383, 4406, 4425, 4473 | ADAPT | Local Prompt-bibliotek |
| 12 | `POST /compare` | 4593 | ADAPT | Local Sammenligning |
| 13 | `POST /citation` | 4719 | ADAPT | **Local Citation** (kort + lang) |
| 14 | `POST /workspace`, `GET /workspace/:id`, `POST /workspace/:id/chat`, `PUT /workspace/:id/draft`, `PUT /workspace/:id/format`, `GET /workspace-formats` | 5064, 5090, 5105, 5232, 5249, 5266 | ADAPT | **Local Arbejdsrum** |
| 15 | `GET /reuters-feed`, `POST /reuters-feed`, `POST /reuters-item` | 5445, 5457, 5468 | ADAPT (valgfri, slået fra) | `connectors/reuters.ts` (licensed) |
| 16 | `POST /exa-research` | 5483 | ADAPT | Local Research |
| 17 | `POST /semantic-search` | 5578 | ADAPT | semantisk søgning i feed-items |
| 18 | `POST /score-sources` | 5638 | ADAPT | hurtig score (triage) |
| 19 | `POST /fetch-url` | 5693 | ADAPT | Hent artikel fra URL (batch ≤ 10) |
| 20 | `GET /backlog`, `POST /backlog` | 5755, 5766 | DROP | – |
| 21 | `POST /rss-items` | 5790 | ADAPT | feed-items-browser/-job |
| 22 | `POST /rate` | 6598 | ADAPT | Local Score / Local Lab "Rate" |
| 23 | `POST /summary` | 6630 | ADAPT | resumé-assistent |
| 24 | `GET /search` | 6663 | REPLACE (DDG-scraping droppes) | Local Research (Exa) |
| 25 | `POST /synthesize` | 6759 | ADAPT | **Local Syntese** |
| 26 | `POST /optimize-query` | 6846 | ADAPT | søgeforespørgsels-optimering |
| 27 | `POST /business-fictive-case` | 7606 | ADAPT – gated | Local Demo-case (kun sandbox) |
| 28 | `POST /parse-file` | 7690 | ADAPT | parse-file |
| 29 | `POST /business-hero-image` | 7758 | ADAPT – gated | hero-billedbrief/-billede |
| 30 | `POST /extract-sources` | 7785 | ADAPT | udtræk kilder |
| 31 | `POST /business-article` | 8317 | ADAPT | **Local Business**-generator |
| 32 | `POST /fact-check`, `POST /business-fact-check` | 8713, 8723 | ADAPT | Local Faktatjek |
| 33 | `POST /verify-claim` | 8835 | ADAPT | Local Verify-claim |
| 34 | `POST /co-editor`, `POST /co-editor-research-queries` | 9107, 9117 | ADAPT | Local Co-Redaktør |
| 35 | `POST /suggest-angle` | 9204 | ADAPT | Local Vinkel |
| 36 | `POST /suggest-dagens-tal` | 9281 | ADAPT | Local Dagens tal |
| 37 | `POST /deep-research-prompt` | 9351 | ADAPT | Local Deep research |
| 38 | `POST /bulletin` | 9413 | ADAPT | Local Bulletin |
| 39 | `/analysis-saved-articles` (POST/GET/GET:id/DELETE) | 9640-9643 | ADAPT | Local Bibliotek (rating) |
| 40 | `/business-saved-articles` (POST/GET/GET:id/DELETE) | 9646-9649 | ADAPT | Local Bibliotek (generator) |
| 41 | `/saved-articles` (legacy POST/GET/GET:id/DELETE) | 9652-9667 | REPLACE | samme Bibliotek (legacy-alias droppes) |
| 42 | Express: `/api/ga4/*` | `index.ts:~90-160` | DROP | – |
| 43 | Express: `POST /api/search` (chattymakker) | `index.ts:~195-205` | DROP | – |
| 44 | Express: `/api/sources`, `/api/external-articles`, `/api/citation-briefs`, `/api/topic-feeds`, `/api/story-clusters` | `server/routes/*` | ADAPT | Local Kilder/Feed-items/Citation-briefs/Topic-feeds/Kandidat-klynger |

## Sikkerhed – hvad der må omtales og hvad der skal gøres (ingen værdier gengives)

- Y's kildekode indeholder **hardcodede fallback-nøgler** for Reuters (klient-id og -secret: `Y: index.ts:56-65`, `sireRoute.ts:5279-5280`) og for Exa (`sireRoute.ts:5489`, `:8748`). Værdierne er i git-historikken og **skal roteres af ejeren** hos udbyderne – uanset om LocalRating bygges. De må aldrig kopieres til CMS'et; `scripts/check-secrets.ts` udvides (`09-…` §8).
- Y har **ingen auth** på nogen route (`index.ts:24-44,77`); alle `fetch`-ruter er åbne SSRF-flader (`sireRoute.ts:2128-2131`, `:2171`, `:4078`, `:5693`; `sourceService.ts:64`; `scraperService.ts:11`).
- Y bruger Googlebot-UA (`sireRoute.ts:4092,4165`; `scraperService.ts:14`); LocalRating bruger altid ærligt UA og ingen paywall-omgåelse.

## Samlet overblik (efter paritetsændringen)

| Klasse | Omtrent antal rækker | Eksempler |
|---|---|---|
| REUSE | 14 | Local Score-matematik, bånd, funktioner, pillars, JSON-repair, attribution, kildesegmenter, reel-regler |
| ADAPT | ~75 | alle Y-routes med redaktionel funktion: Citation, Syntese, Arbejdsrum, Business, faktatjek, co-editor/vinkel/bulletin, parse-file, Exa, semantic-search, score-sources, compare, gemte artikler, feed-browser, DST/ODA (senere) |
| REPLACE | ~18 | Firestore, scheduler, auth-løse ruter, URL-normalisering, HTML-strip, AI-wrappers, React/Vite-UI |
| DROP | ~14 | scraping-hacks, `vm.runInContext`, Googlebot-UA, sn.dk-chattymakker, backlog-fil-skrivning, GA4, Notion, DDG-søgning, hardcodede nøgler, spejlede filer |
