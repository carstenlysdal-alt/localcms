# FIX-ailibrary - rettelser i aI-library efter T9 (+ T7 §4 CMS-adapter)

Dato: 2. oktober 2026. Repo: `/Volumes/SSD Data/Gits/aI-library`, ny branch `review-fixes` (oprettet fra `main`, working tree var rent). **Intet er committet, pushet eller deployet.** Hverken `/Volumes/SSD Data/Gits/localcms`, `Knowledge` eller `/Users/lysdal/aI-library` er ændret. Ingen `.env*`-filer er læst (kun eksistensen af `.env.example` er set via en tekstsøgning), ingen hemmelige værdier er udskrevet.

## 1. Resultat af kørsler (ærligt)

| Kørsel | Resultat |
|---|---|
| `npm run lint` (`tsc --noEmit` + `eslint src`) | Grøn |
| `npm test` (Vitest) | **620 tests i 58 filer grønne** (baseline før arbejdet: 430 i 46) |
| `cd functions && npx tsc --noEmit` | Grøn (kompilerer nu også `shared/` og `cms/`, uden tests) |
| `npx tsc` til midlertidig outDir | Grøn; `lib/index.js` + `lib/shared/*` + `lib/cms/*` genereres som forventet |
| `vite build` til midlertidig outDir | Grøn (bekræfter at appen kan importere `functions/shared/*`) |
| Typecheck af nye testfiler (engangs-tsconfig) | Ren på nær kendte miljøfejl (`?raw`-importer, uden for min ændring) og én ubrugt variabel, som jeg rettede |

**Kunne ikke / blev ikke kørt:** ingen Firebase-emulator eller deploy; intet browserforsøg i UI'et (der er ingen UI-ændringer); intet reelt kald til CMS'et eller til Ritzau/DAWA fra koden (kun et manuelt `curl` af Ritzau-URL'erne: `?publisherId=` giver 200 RSS, `&publisherId=` giver 404 HTML, DAWA giver 410); `eslint` dækker kun `src/` (ikke `functions/`); `functions/lib/` (committet byggeoutput) er **ikke** genbygget - se §4.

## 2. Fund -> ændring -> test

### 1. DAWA lukket (T9 #2, P0)
- **Ændring:** `functions/shared/postalCodes.ts` + genereret data `postalCodes.data.ts` (1.154 geografiske postnumre, 98 kommuner) fra **GeoNames postal codes DK** (CC-BY 4.0, hentet 2. okt. 2026). Generator: `scripts/generate-postal-codes.mjs` (fejler højlydt ved ukendt kommunekode, dublet eller region-uoverensstemmelse; udelader 0xxx-kunde-/udlandskoder med forkerte koordinater). Tabellen giver `{by, kommune, kommunekode, region, lat, lon}`.
- Alle 5 DAWA-kald i `functions/index.ts` er erstattet: kommunetaksonomi (statisk, 98 kommuner), `localMonitoringSearch` (postnummer -> kommune; ukendt postnummer giver tydelig `HttpsError('not-found', ...)` med forklaring), vejr og luftkvalitet (`monitoringCoordinates`: postnummerpunkt -> kommunecentrum -> standard; ukendt postnummer **kaster** og rapporteres som kildefejl), plan-reverse-geocode (EPSG:25832 -> WGS84 via Krüger-række, nærmeste postnummerpunkt inden for 25 km og planens kommune; markeres `geographyPrecision: 'mention'` + "(omtrentligt)"). Testlisten i `src/data/sourceDirectory.ts` peger ikke længere på DAWA.
- **Adapter-søm:** `PostalCodeResolver` + `configurePostalCodeResolvers()` (kæde; fejlende resolver giver `lookup_failed`, ikke "ukendt").
- **Dækning (ærlig):** hele landet (GeoNames-listen), målbyerne (Næstved, Slagelse, Holbæk, Køge, Roskilde, Ringsted, Kalundborg + Sorø) er krydstjekket mod håndskrevne forventninger i `postalCodes.test.ts`. **Begrænsninger:** ét primært kommunetilhørsforhold pr. postnummer (DAWA gav en liste, og distrikter kan krydse kommunegrænser); ét repræsentativt punkt pr. postnummer (ikke polygon); kilden er ikke Danmarks officielle register og kan mangle nyoprettede postnumre. Flere af T8's "mangler"-postnumre (fx 4685, 4742, 4263, 4015, 4141) findes **ikke** i GeoNames-listen og kan være forkerte i T8/CMS-seed - bør afklares af en person.
- **Test:** `functions/shared/postalCodes.test.ts` (35 tests, bl.a. 19 målby-forventninger, ukendt/ugyldigt postnummer, resolver-kæde, UTM-rundtur), `src/security/dead-sources.test.ts` (forbyder DAWA-URL'er i koden).

### 2. Ritzau-URL (T9 #5, P1)
- **Ændring:** `functions/shared/ritzauUrls.ts`: `buildRitzauFeedUrl()` med `URL`/`searchParams`, `publisherId` valideres (kun cifre; fjerner også parameter-injektion fra klientens `publisherId`), `assertFeedBody()` afviser HTML-fejlsider. Alle 7 URL-steder i `functions/index.ts` bruger builderen (de to fejl ved ~2518/~2596 er rettet; de øvrige var korrekte). `fetchXml` afviser nu non-feed-svar. Politi-hentning registrerer fejl pr. feed og kaster, hvis **alle** feeds fejler (før: tomt resultat).
- **Test:** `ritzauUrls.test.ts` (URL for alle tre feedtyper med/uden publisherId, aldrig `latest&`, injektion afvist, HTML-fejlside afvist) + regressionsvagt i `dead-sources.test.ts`.

### 3. Politikredse (T9 #4, P1)
- **Ændring:** `functions/shared/policeDistricts.ts`, én kilde for kommune -> kreds -> Ritzau-id (politi + anklager). **Slagelse (0330) og Sorø (0340) er flyttet til Sydsjællands og Lolland-Falsters Politi (90594).** Ved gennemgang af *alle 98 kommuner* mod politi.dk/politikredse (hentet via WebFetch, samt Wikipedia for de to sjællandske kredse) fandt jeg yderligere en fejl: **Morsø (0773) og Thisted (0787) hører til Midt- og Vestjylland**, ikke Nordjylland - rettet. Alle øvrige var korrekte. Intet er markeret "uverificeret", men bemærk at politi.dk-teksten er læst via en WebFetch-opsummering. `POLITI_DISTRICTS` i `index.ts` genererer nu de 24 kreds-/anklagerposter fra samme modul.
- **Test:** `policeDistricts.test.ts`: hver kreds' kommuneliste låst til politi.dk's ordlyd, alle 98 kommuner dækket præcis én gang, målbyerne, publisher-id'er matcher klientens `RITZAU_AUTHORITIES`.

### 4. Døde feeds (T9 #3b, P1)
- `tv2_nyheder` (`nyheder.tv2.dk/rss`, 404) fjernet fra `src/services/syndicatedFeeds.ts` med kommentar; `scripts/sync-feeds-from-y-rating.mjs` har `DEAD_FEED_URLS`, så synk-scriptet ikke genindfører den. politi.dk-RSS (404) er fjernet som anbefalet kilde i `docs/overvaagning-og-datakilder-strategi.md` (henviser til Via Ritzau). Regressionsvagt i `dead-sources.test.ts`. (`business.tv2.dk/rss` svarer 301 - ikke vurderet, ikke rørt.)

### 5. Knowledge-URL og browser-nøgle (T9 #10/#11, P2)
- Kommentar i `knowledgeOSClient.ts` rettet til `https://biblio.up.railway.app`; `functions/knowledge.ts` har den levende URL som standard (overstyres af `KNOWLEDGE_OS_API_URL`), med forklaring. Repoet indeholdt ingen README/docs, der lærer `VITE_KNOWLEDGE_API_KEY`.
- **Bekræftet at browseren ikke holder nøglen:** `knowledgeOS.ts` bruger kun `transport` via callable `knowledgeProxy`; ingen `VITE_*KEY/SECRET/TOKEN` i `src/`. Nyt test (`no-client-secrets.test.ts`) scanner hele `src/` og forbyder det.
- Bonus (T9 #16, P3, lille): proxyen tillader ikke længere `DELETE` (serveren har ingen DELETE-route); metode/rute-allowlist er flyttet til testbar `functions/shared/knowledgeAllowlist.ts` (GET kun læseruter, POST kun `ingest`/`save`, ingen `..`). Klientens ubrugte `deleteSource` er fjernet. `IngestPayload` har fået `publishedAt`/`extractorVersion` (serveren understøtter dem; T9 afsnit 4).
- **Uden for repoet (ikke rørt):** `~/.claude/skills/knowledge/SKILL.md` linje 96-97 (`VITE_KNOWLEDGE_API_URL`/`VITE_KNOWLEDGE_API_KEY` i browserkode) og linje 175-177 (død URL `knowledge-os-production-e5df...` og anvisning om `VITE_KNOWLEDGE_API_KEY`). Skal rettes af ejeren (eller i en separat session).

### 6. Redaktionel godkendelse (T9 #7, P1)
- **Standard er nu `editor`:** `createEmptyProjectState` (`src/editorial/types.ts`) og `normalizeProjectState` (`workflow-state.ts`). (Fundet lå i `src/editorial/types.ts`, ikke `src/types.ts`.) Eksplicitte brugerhandlinger ("Kør opgave", "Start produktion") sætter stadig bevidst `autonomous` for en kæde frem til en *kladde*.
- **Håndhævelse:** `functions/shared/approvalGuard.ts` (menneskelig `HumanApproval`: navngiven person, ikke `system/agent/...`, højst 24 t gammel, `explicit_user_action`, bundet til SHA-256 af det præcise indhold - ændres artiklen bortfalder godkendelsen) og `src/editorial/sendGuard.ts` (`pendingApprovalGates` bruger `WORKFLOW_REGISTRY[...].requiresApproval`; `evaluateSendReadiness`, `createSendApproval`, `assertMaySendToCms`: kræver gennemført vinkelgodkendelse, udkast, faktatjek uden `unverified`, kilder med URL+dato). CMS-klienten kalder vagten **igen** server-side før noget sendes.
- **Test:** `approvalGuard.test.ts` (8), `sendGuard.test.ts` (10; inkl. at autonom tilstand ikke kan sende uden godkendelse, og at redigering efter godkendelse afvises).

### 7. agentflow F03/F07 (P2)
- **F03 (delvist lukket):** `FactCheckResult` har fået `articleHash` og `coverage {sourceChars, usedChars, truncated}`; `verifyArticleAgainstSource` udfylder dem; `isFactCheckCurrent()` opdager ændret artikel. Test i `factCheck.test.ts`.
- **F07: ikke rettet** (se §3).

### 8. Dublerede kildekonfigurationer (T9 #9, P2)
- **Agenda-kilder: én kilde til sandhed** `functions/shared/agendaSources.ts` (liggende i `functions/`, fordi functions-tsconfig kun kan kompilere dér; Vite kan importere herfra). `src/config/agendaSources.ts` re-eksporterer; `functions/index.ts` bygger sit opslag af den; håndkopien er slettet. `agendaSources.test.ts` er omskrevet (grøn): kræver import i backend, ingen egen kopi, identisk klientliste, alle kommunekoder findes i kommuneregistret, målbyerne har portal.
- **Politikredse:** samlet i `policeDistricts.ts` (§3). Rest: `RITZAU_AUTHORITIES` i `src/services/ritzau.ts` (klient) og TV2-regionsfeeds er stadig separate kopier; `policeDistricts.test.ts` låser id'erne til klientlisten, men det er ikke én fysisk kilde.

### 9. CLAUDE.md (T9 #12, P2)
- `CLAUDE.md` i repo-roden (dansk): projekt, kør/test, deploy, hemmeligheder, redaktionelle regler, ekstern hentning, kendte fælder, Knowledge OS (inkl. at skill'et er forældet), CMS-adapteren, arbejdsgang.

### 10. CMS-adapter (T7 §4) - `functions/cms/`
Typed, **deaktiveret** uden nøgler, ingen scheduler, **ikke eksporteret fra `functions/index.ts`** (ingen nye Cloud Functions deployes).
- `types.ts`/`validate.ts`: spejler `cms/lib/ingest/schema.ts` (strict; lokal forhåndsvalidering, så ét dårligt signal ikke giver 400 på hele batchen).
- `adapter.ts`: `LocalMonitoringItem` -> signal: `mapSourceType` (T7-tabellen), `buildExternalId` (`<sourceType>:<source>:<stabilt id>`, max 200 tegn; index-/tilfældige id'er (`hearing-3`, `plan-0.xx`, `<pub>-<index>`, `air-/weather-`) erstattes af URL-hash eller datobøtte), dataminimering (politi/112 maks ~300 tegn, maskering af CPR/nummerplade/telefon/e-mail, afvisning ved navngiven sigtet+alder, lokale medier kun overskrift+link). Afvisningsårsager: `no_url|no_title|no_city|instance_missing|unstable_id|sensitive`.
- `geo.ts`/`routing.ts`: præcis GeoTag-slug i `geo.omraade` (udvalg af CMS' egen postnummertabel, kun postnumre der findes i vores tabel og ligger i byens kommune - test låser det); kommunekode -> by (Kalundborg markeret `instanceExists:false`). Uden postnummer sendes kun kommune.
- `client.ts`: `postSignals` (batch <=100, idempotent), `postArticleDraft`, `health`; HTTP-håndtering efter T7 §3 (401 standser/`auth_failed`; 400 halveres for at finde synderen, derefter dead; 403/422 dead; 413 deles; 429 med `Retry-After`; 5xx/netværk inline-retry og derefter `retry`; batch-`Intern fejl` = retry); `computeBackoffMs` (30 s -> 6 t, +0-20 % jitter, maks 8 forsøg); ~60 kald/min; https-krav, `redirect:'error'`, nøgle kun i `Authorization` og fjernes fra fejltekster. Nøgle kun fra env-/secret-**navne** (`CMS_INGEST_KEY_<BY>`, `CMS_DRAFT_KEY_<BY>`, valgfri `CMS_BASE_URL_<BY>`); `createCmsClientFromEnv` returnerer `null` hvis ikke konfigureret.
- `articleAdapter.ts`: kladde bygges **kun** af godkendt indhold; markdown -> blokke (citater bevidst som afsnit, da `quote` kræver kildeUrl+dato), afviser krimi/sundhed, manglende kilde/dato; `postArticleDraft` afviser uden gyldig `HumanApproval` **før netværk**.
- `outbox.ts`/`pipeline.ts`: `OutboxStore` (+ in-memory og Firestore-implementering `cmsOutbox`), `enqueueSignal` (idempotent; ændret payload, fx dagsorden -> referat, sættes i kø igen), `flushOutbox` (backoff, dead letter efter 8 forsøg, 401 standser uden at tælle forsøg), `queueMonitoringItems`.
- Små ændringer i `functions/index.ts` til adapteren: `LocalMonitoringItem.stableId` (term-uafhængigt `<kommune>:<møde>:<punkt>` for dagsordensomtaler) og `municipalityCodes/Names` udfyldes nu for dagsordensomtaler (var tomme, så de ikke kunne rutes; klienten bruger ikke felterne).
- **Test (injiceret fetch):** `adapter.test.ts`, `geo.test.ts`, `client.test.ts` (26), `articleAdapter.test.ts`, `outbox.test.ts` - 97 tests.

### Øvrigt (P2, kildeetik #15)
Alle "Mozilla/5.0 (compatible; ...)"-User-Agents i `functions/index.ts` er erstattet af én identificerende `IDENTIFYING_USER_AGENT` (samme kontakt som koden allerede brugte).

## 3. Ikke rettet - og hvorfor

| Punkt | Hvorfor |
|---|---|
| **Scheduler (`onSchedule`) og persistent dedupe** (T9 #6) | Eksplicit udenfor opgaven. Adapteren/outboxen er klar til at blive kaldt; hentelogikken i `index.ts` er endnu ikke trukket ud i rene funktioner. |
| **F07** (kørsler/handoffs bundet til monteret side, `pendingHandoffs` er `useState`) | Kræver server-runner/persistens (WP09) - ikke lille og sikkert. |
| **"Send til redaktion"-knap/UI** | Ikke bygget; guarden og adapteren er klar. NB: Redaktionsagentens UI sætter i dag aldrig `state.factCheck` (`setFactCheck` kaldes ikke fra UI), så `evaluateSendReadiness` blokerer indtil faktatjek er koblet på. Det er tilsigtet, men skal løses før knappen virker. |
| Graver-agentens (`investigation`) standard `autonomous` | Forskning, forlader ikke appen; ikke i T9's fund. Ikke ændret. |
| `testFeedSource`'s Windows-browser-User-Agent (`index.ts` ~linje 2510) | Diagnoselab for kilder; ændring kan ændre testresultater. Bør vurderes af ejeren. |
| robots.txt-respekt, ToS-afklaring, Cloudflare/domstol.dk, Open-Meteo-licens, CVR-kvote | Kræver menneskelig/skriftlig afklaring (T8 §6). |
| Knowledge-serverens fail-closed/scopes/`agent-run`/dedupe/batch (T9 #3, afsnit 3-4) | I Knowledge-repoet - må ikke røres her. |
| Nøglerotation (T9 #1) | Kun ejeren kan gøre det (se §5). |
| Firebase web-API-nøgle-restriktion, `FIREBASE_TOKEN`/Node 20 i CI (T9 #18/#19) | Konsol-/CI-konfiguration; ikke kode i denne runde. |
| Delt adgangskode uden brugeridentitet/audit (T9 #17) | Kræver personlige konti; `HumanApproval.approvedBy` er en tekstværdi, ikke en verificeret identitet, indtil der er login. |
| T8-postnumre (4685, 4742 m.fl.) og manglende GeoTags | Afklaring i CMS-seed/GeoTag-tabellen (CMS-ejeren). |

## 4. Bemærkninger / risici ved ændringerne

- **`functions/lib/` er committet byggeoutput og er forældet i forhold til kilden.** CI bygger det (`npm run build` i `functions/`), så det er ikke et deploy-problem, men en ren diff i `lib/` vil være støj; overvej at fjerne `lib/` fra git.
- `functions/tsconfig.json` kompilerer nu også `shared/**` og `cms/**` (ekskl. tests og `cms/testing.ts`). Nye mapper under `functions/` skal tilføjes dér.
- Postnummertabellen er GeoNames, ikke et officielt register; CC-BY 4.0 kræver kreditering (står i den genererede fil og i `CLAUDE.md`/koden - tilføj evt. til en synlig kreditering).
- `localMonitoringSearch` returnerer nu én kommune pr. postnummer (før: DAWA's liste). Postnumre på kommunegrænser kan derfor få færre kommune-tekstmatch.
- Plan-filtrering på postnummer er nu et geografisk gæt (nærmeste postnummerpunkt), markeret som sådan.
- Firestore-outboxens `listDue` kræver et sammensat indeks (`cityKey`, `status`, `nextAttemptAt`); repoet har ingen `firestore.indexes.json` - tilføj før produktion.
- Sikkerhedsgennemgang (skill `security-review`): skillet fik et diff-uddrag fra et andet repo (localcms), så jeg gennemgik i stedet selv aI-library-ændringerne. Ingen fund med høj sikkerhed: URL-parametre valideres, nøgler kun i header og fjernes fra fejl, `redirect:'error'`, allowlisten strammet, ingen nye hemmeligheder i koden. Det er ikke en uafhængig gennemgang.

## 5. Ejer-handlinger

1. **Rotér den gamle Knowledge-nøgle** (commits `553b2a8`, `1ab0bd1` i aI-library-historikken): ny nøgle i password manager; sæt `API_KEY` på Knowledge-serveren (Railway) og redeploy; `firebase functions:secrets:set KNOWLEDGE_OS_API_KEY`; verificér at den gamle giver 401 på `/knowledge/health`. Overvej `git filter-repo` kun hvis repoet har eksterne klon/forks. Notér dato/ejer i `CLAUDE.md`.
2. **Sæt `API_KEY` på Knowledge-serveren**, hvis den ikke allerede er sat (produktion svarer 401, men den kørende version er ikke repoets HEAD).
3. **Ret skill'et** `~/.claude/skills/knowledge/SKILL.md` (linje 96-97, 175-177, se §2.5) og Knowledge-README til proxy-mønstret; gennemgå SN-DeepDive, PodCarsten, SEO-app for `VITE_KNOWLEDGE_API_KEY`.
4. **Slet/arkivér den forældede kopi `/Users/lysdal/aI-library`** (seneste commit `a75aa79`, 137 filer afviger, indeholder den gamle åbne `firestore.rules` og `firebase.json`/`.firebase` - en deploy derfra ville genindføre åbne regler). Anbefaling: pak til tar.gz uden for projektet, slet mappen, og fjern den fra session-arbejdsmapperne. **Jeg har ikke rørt den.**
5. **Review og deploy** (kun efter din godkendelse): gennemse `git diff` på `review-fixes`, commit, lad GitHub Actions deploye via `main` (kører lint + test + build), eller manuelt `firebase deploy --only functions` (+ hosting for frontend). Ingen nye secrets kræves for denne branch (adapteren er deaktiveret). Verificér bagefter: `localMonitoringSearch` med postnummer 4700/4200, en Ritzau-politi-kilde for Slagelse (skal nu give 90594-feeds), `municipalityTaxonomy` (98 kommuner).
6. **Til adapteren senere:** opret nøgler pr. by i CMS (`npm run ingest:key`), sæt `CMS_INGEST_KEY_<BY>` og `CMS_DRAFT_KEY_<BY>` som Firebase-secrets, deklarér dem med `defineSecret` i den funktion, der bruger adapteren, tilføj Firestore-indeks til `cmsOutbox`.
7. **Næste skridt (ikke bygget):** `onSchedule`-jobs + udtræk af hentelogik; `monitorSources`-sundhed; "Send til redaktion"-UI (kalder `createSendApproval` -> `postArticleDraft`, kobl faktatjek på Redaktionsagenten); Knowledge `agent-run`; CMS-ændringer fra T7 §5/§8.

## 6. Git diff-stat (aI-library, branch `review-fixes`, ikke committet)

Sporede filer (`git diff --stat`): 17 filer, 325 indsættelser, 547 sletninger

```
 docs/overvaagning-og-datakilder-strategi.md |   4 +-
 functions/index.ts                          | 473 +++++++++-------------------
 functions/knowledge.ts                      |  11 +-
 functions/tsconfig.json                     |  12 +-
 scripts/sync-feeds-from-y-rating.mjs        |  10 +
 src/config/agendaSources.test.ts            |  74 +++--
 src/config/agendaSources.ts                 | 167 +---------
 src/data/sourceDirectory.ts                 |   7 +-
 src/editorial/types.ts                      |   6 +-
 src/editorial/workflow-state.ts             |   2 +-
 src/security/no-client-secrets.test.ts      |  27 +-
 src/services/factCheck.test.ts              |  28 +-
 src/services/factCheck.ts                   |  23 ++
 src/services/knowledgeOS.ts                 |   4 +-
 src/services/knowledgeOSClient.ts           |  17 +-
 src/services/syndicatedFeeds.ts             |   3 +-
 src/types.ts                                |   4 +
```

Nye (usporede) filer, 5.107 linjer i alt (heraf 1.178 genereret postnummerdata):
`CLAUDE.md`, `functions/cms/*` (17 filer), `functions/shared/*` (12 filer), `scripts/generate-postal-codes.mjs`, `src/editorial/sendGuard.ts` (+ test), `src/security/dead-sources.test.ts`.
