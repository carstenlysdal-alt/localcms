# T9 - Review af aI-library og Knowledge OS: stabiliseringsliste

Dato: 2. oktober 2026. Status: kun læst (ingen kildefiler ændret, ingen git-handlinger). Ingen `.env`-filer er læst, og ingen hemmelige værdier er udskrevet; hvor en nøgle omtales, er kun *eksistens* og placering noteret.

Repos: aI-library = `/Volumes/SSD Data/Gits/aI-library` (HEAD `166786f`, 2026-10-01, rent working tree), Knowledge = `/Volumes/SSD Data/Gits/Knowledge` (HEAD `bafbc99`). Evidens: kodelæsning + enkelte read-only HTTP-opslag (statuskoder). Jeg har **ikke** kørt testsuiter, ikke kaldt Knowledge-MCP (forbindelsen fejlede i sessionen) og ikke deployet noget.

Prioritetsskala: **P0** = ret før næste produktionsbrug/integration; **P1** = ret før agenterne kobles på CMS'et; **P2** = nødvendig konsistens; **P3** = hygiejne.

---

## 1. Rangeret fundliste

| # | Pri | Fund | Placering | Fix |
|---|---|---|---|---|
| 1 | **P0** | **Gammel Knowledge-API-nøgle i git-historik** (commits `553b2a8` og `1ab0bd1`; fjernet fra nuværende kode, men aldrig roteret ifølge agentflow-reviewet "drift åben") | git-historik for `src/services/knowledgeOS.ts` | Rotér nu (afsnit 2). Ændring af kode alene hjælper ikke |
| 2 | **P0** | **DAWA er lukket (HTTP 410 Gone)**. Alle postnummer->kommune-opslag fejler: `localMonitoringSearch` kaster "Postnummeret blev ikke fundet" (index.ts:2289-2291); taksonomi (:1127) falder tilbage til tom liste; vejr/luft (:2110, :2189) returnerer `[]`; plan-reverse-geocode (:1217) fejler; testlister i `src/data/sourceDirectory.ts:487, 559`. Testet 2. okt. på `/postnumre/4200`, `/kommuner`, `/postnumre/reverse`, `/kommuner/0370`, også `dawa.aws.dk` | `functions/index.ts` | Erstat med en statisk, versioneret postnummer->kommune-tabel (genereret fra et officielt register; se T8 afsnit 3.8) og/eller Dataforsyningens nye adresse-API (**ikke undersøgt/verificeret af mig**; kræver sandsynligvis token). Slå fejlen op som *struktureret* kildefejl, ikke som "ingen resultater" |
| 3 | **P0** | **Knowledge-API'et er åbent, hvis `API_KEY` ikke er sat**: autentificering registreres kun `if (apiKey)`; ellers kun en `warn` (server.ts:26-37). README siger direkte, at adgang "bevidst er åben i v1". Desuden `cors origin: true` (:19), ingen rate limit, almindelig streng-sammenligning af Bearer-token (`header !== \`Bearer ${apiKey}\`` :31), én fælles nøgle til alt (browser-apps, Claude, CMS) | `Knowledge/src/api/server.ts` | Se afsnit 3. **Nuværende produktion:** `https://biblio.up.railway.app/knowledge/health` giver **401** uden nøgle og med forkert nøgle, så auth er slået til dér. Men fejlteksten ("Ugyldig eller manglende adgang") er ikke den, som repo-koden sender ("Ugyldig eller manglende API-nøgle"), så **den kørende version er ikke repoets HEAD** - ikke verificeret hvilken commit der kører |
| 4 | **P1** | **Politikreds-mapping forkert for Slagelse (0330) og Sorø (0340)**: mappet til `midt_vestsjaelland`; de hører til Sydsjællands og Lolland-Falsters Politi. Feed 90594 indeholder Slagelse/Korsør-meldinger, feed 13562881 gør ikke (verificeret). En by-overvågning af Slagelse misser derfor politi-nyt | `functions/index.ts:1635-1638` (tabellen starter :1625) | Flyt `'0330'` og `'0340'` til `sydsjaelland_lolland_falster`; bekræft hele tabellen mod politi.dk; erstat tabellen med den delte kilde (fund 9) |
| 5 | **P1** | **Ritzau-URL bygges med `&` i stedet for `?`**: `https://via.ritzau.dk/rss/short-messages/latest&publisherId=...` og `.../releases/latest&publisherId=...` giver **404 (HTML)**; med `?` giver de 200 RSS (begge testet). HTML-svaret parses som "0 items" og ser ud som "intet nyt" | **`functions/index.ts:2518`** (`fetchRitzauShortMessagesFeed`) og **`:2596`** (`fetchRitzauReleasesFeed`, RSS-fallback). Linje :2491 er korrekt (basen har allerede `?lang=da`). `politiUpdateSearch` (:2452) og `src/services/ritzau.ts` (:35 base har `?lang=da`; :323, :398, :407) er korrekte | Byg URL'er med `new URL()` + `searchParams.set('publisherId', id)`; kast fejl hvis svaret ikke indeholder `<rss`/`<feed` eller har content-type `text/html`; test-case der kalder alle tre med og uden `publisherId` |
| 3b | **P1** | **Døde/forkerte feed-URL'er i kataloger**: `https://nyheder.tv2.dk/rss` -> 404 (`src/services/syndicatedFeeds.ts:96`); `politi.dk/aktuelt/faa-politi-update-som-rssfeed` -> 404 (nævnt i docs/overvaagning-og-datakilder-strategi.md) | | Fjern/ret; kør `testFeedSource`-lignende smoke-test dagligt og vis status i kildekataloget |
| 6 | **P1** | **Ingen scheduler og ingen persistent dedupe**: `functions/index.ts` har kun `onCall`-funktioner (ingen `onSchedule`); `localMonitoringSearch` kræver `requireAccess` (bruger-claim) og kan derfor ikke køres af en cron; ingen "set før"-lager. Overvågningen er pull-on-demand | `functions/index.ts:2239` m.fl. | Se T8 afsnit 5 og T7: træk hentelogik ud i rene funktioner; `onSchedule`; `monitorItems`/`monitorSources` i Firestore |
| 7 | **P1** | **Autonom tilstand er standard, og "kræver godkendelse" er kun metadata**: `mode: state.mode \|\| 'autonomous'` (src/editorial/workflow-state.ts:430) og initialtilstand `mode: 'autonomous'` (src/editorial/types.ts:494). `requiresApproval` (types.ts:34) og `requiresApprovalAt` (validation.ts:231) findes som felter, men `buildAutonomousChain` (EditorialWorkflowPage.test.ts:47-100 beskriver adfærden) kører hele kæden. Dokumentet lokalredaktoeren-koncept.md lover "Mennesket har sidste ord" | `src/editorial/*`, `src/pages/EditorialWorkflowPage.tsx` | Skift standard til `editor`, eller definér "autonom" som *autonom udarbejdelse til kladde*, aldrig autonom afsendelse. Til CMS-integration: send kun via en eksplicit handling ("Send til redaktion") og håndhæv human-in-the-loop i CMS'et (som allerede sker: kun kladde, `godkendtAf` tom). Se T7 |
| 8 | **P1** | **Knowledge-connectoren er ikke koblet til agenternes output**: ingest-on-save findes kun i `knowledgeService.add` for Firestore-collectionen `knowledge` som `type:'note'` (src/services/firestore.ts:132-148). Overvågningsfund, Graver-/Redaktionsagent-output og CMS-artikler ingesteres ikke. Se afsnit 4 | `src/services/firestore.ts`, `src/ai/tools.ts` (kun *søgning* i Knowledge, :781) | Afsnit 4 |
| 9 | **P2** | **Duplikerede kildekonfigurationer**: agenda-kilder både i `src/config/agendaSources.ts` og `functions/index.ts:429` (synkroniseret af test `src/config/agendaSources.test.ts`); politikredse tre steder: `POLITI_DISTRICTS` (index.ts ~:2400), `policeFeedMeta` + `policeDistrictByMunicipalityCode` (:1571-1660), `RITZAU_AUTHORITIES` (src/services/ritzau.ts:41+); regionale TV2-feeds både i :1953 og syndicatedFeeds.ts:154-160 | | Én JSON-kilde (`shared/sources.json`) + byggescript, der genererer begge builds; behold testen som sikkerhedsnet |
| 10 | **P2** | **URL-uenighed om Knowledge-basen** (3 varianter): `https://biblio.up.railway.app` (functions/knowledge.ts:6, functions/lib/knowledge.js:8, KnowledgeExplorerRedirect.tsx:9) **er den levende** (`/health` -> 200); `knowledge-os-production.up.railway.app` (kommentar i src/services/knowledgeOSClient.ts:17) -> 404; `knowledge-os-production-e5df.up.railway.app` (knowledge-skill'et ~/.claude/skills/knowledge/SKILL.md:175) -> 404 "Application not found" | | Ret skill og kommentar til den levende URL; fjern hardkodet fallback og kræv `KNOWLEDGE_OS_API_URL` som konfiguration (functions/knowledge.ts:26 understøtter allerede override); smoke-test i CI |
| 11 | **P2** | **Knowledge-skill'et lærer stadig det usikre mønster**: skill'et anviser `apiKey: import.meta.env.VITE_KNOWLEDGE_API_KEY` i *browser*-kode (SKILL.md:97, 175-177). README i Knowledge anviser samme "VITE_KNOWLEDGE_API_KEY i hver connectet app". Andre apps (SN-DeepDive, PodCarsten, SEO-app jf. README) kan derfor stadig have nøglen i klient-bundles | | Opdatér skill + README til serverproxy-mønstret (som aI-library nu bruger via `knowledgeProxy`); gennemgå de andre repos for `VITE_KNOWLEDGE_API_KEY` |
| 12 | **P2** | **Manglende `CLAUDE.md` i aI-library**: der er ingen projektinstruktioner, så agenter ved ikke, at `functions/` bygger separat, at to kopier af kildekonfig skal holdes i sync, at hemmeligheder kun må ligge i Functions-secrets, og at der findes en forældet kopi andetsteds | repo-rod | Se afsnit 6 for forslag til indhold |
| 13 | **P2** | **Forældet kopi `/Users/lysdal/aI-library`**: seneste commit `a75aa79` (2026-06-18), **137 filer afviger** fra live-repoet i `src/`, `firestore.rules` indeholder den gamle åbne regel (`allow read, write: if true`; 1 forekomst), og mappen har både `firebase.json` og `.firebase/` deploy-tilstand - en `firebase deploy` derfra ville genindføre åbne regler. Mappen er desuden tilføjet som ekstra arbejdsmappe i denne session, hvilket giver risiko for at rette i den forkerte kopi | `/Users/lysdal/aI-library` | Anbefaling: **arkivér som tar.gz uden for projektet og slet** (eller i det mindste fjern `firebase.json`/`.firebase`) - jeg har ikke rørt den. Fjern den fra session-arbejdsmapperne |
| 14 | **P2** | **agentflow F03 delvist åben**: faktatjek er ikke bundet til artiklens indholdshash/dækningsrapport (ingen hash/coverage-logik fundet i `src/services/factCheck.ts`) | `src/services/factCheck.ts` | Se afsnit 5 |
| 15 | **P2** | **Overvågningens kilde-etik/ToS**: `domstol.dk/retslister` er bag Cloudflare-challenge (403 ved almindeligt kald) og koden bruger en Umbraco-origin direkte (index.ts:3094, :3254). Flere kald bruger `Mozilla/5.0 (compatible; ...)`-User-Agent (:1736, :2455, :2492), og testFeedSource udgiver sig for en Windows-browser (:2692). cvrapi.dk giver 403 `QUOTA_EXCEEDED` ved anonymt kald. Open-Meteo gratis API er til ikke-kommerciel brug (**skal verificeres**) | | Identificerende UA med kontakt (som :1869 allerede gør), robots-respekt, ingen omgåelse af beskyttelse, skriftlig ToS-afklaring (T8) |
| 16 | **P3** | **Knowledge-proxyen tillader `DELETE`** (functions/knowledge.ts:7), selvom serveren ingen DELETE-route har; `save`/`ingest` er åbne for enhver bruger med `access`-claim (datapollution-risiko) | functions/knowledge.ts | Fjern DELETE; begræns skrivning til tjenestekonti/roller |
| 17 | **P3** | **Delt adgangskode uden brugeridentitet**: ACCESS_CODE giver anonym bruger med claim `access: true` (functions/access.ts). Reglerne er ellers solide (63 linjer, alt kræver claim; wildcard også). Men uden personlig identitet er der ingen audit trail for, *hvem* der sendte noget til CMS'et | functions/access.ts, firestore.rules | Når CMS-afsendelse indføres: log `sentBy` (som minimum session/anonym id + tidspunkt), på sigt personlige konti |
| 18 | **P3** | **Firebase web-API-nøgler i kode** (offentlige identifikatorer, forventet): `src/lib/firebase.ts:6` og som fallback i `scripts/firestore-audit-and-migrate.mjs:17`. Ingen andre nøglelignende strenge fundet ved mønsterscan af `src/`, `functions/`, `scripts/` (kun filnavne tjekket). `.env` og `.env.production.local` findes, er git-ignorerede og **ikke læst**; `.env.example` er ren | | Begræns web-API-nøglen (referrer-restriktion) i Google Cloud; fjern fallbacken i scriptet |
| 19 | **P3** | **CI/deploy-hygiejne**: workflow bruger `FIREBASE_TOKEN` (`.github/workflows/deploy.yml`, langlivet CI-token) og Node 20, mens `functions/package.json` kræver Node 22 | deploy.yml | Skift til service account/Workload Identity; sæt Node 22 |
| 20 | **P3** | **Knowledge-MCP forbandt ikke** (`CONNECTION_CLOSED`) i denne session. Årsag ikke undersøgt (kræver `.env` med `DATABASE_URL`, som jeg ikke må læse) | `npm run mcp` (stdio) | Kør MCP'en manuelt i et terminalvindue og se stderr; tjek at MCP-konfigurationen peger på den rigtige sti og at `DATABASE_URL` er sat |

---

## 2. Nøglerotation - trin for trin

Forudsætning: du har adgang til Railway (Knowledge-service), Firebase/Google Cloud (aI-library) og de apps, der bruger nøglen. Jeg har ikke set nøgleværdierne og kender ikke, om den gamle nøgle stadig er gyldig.

1. **Generér ny nøgle** lokalt (fx 32 tilfældige bytes, base64url) i din password manager. Del den ikke i chat.
2. **Knowledge/Railway:** sæt `API_KEY` = ny værdi på Knowledge-servicen (variabel, ikke i repo) og redeploy. Midlertidigt kan serveren acceptere to nøgler (forslag i afsnit 3), så der ikke er nedetid.
3. **aI-library:** `firebase functions:secrets:set KNOWLEDGE_OS_API_KEY` (værdi fra password manager) og deploy functions, så `knowledgeProxy` (functions/knowledge.ts) bruger den nye.
4. **Andre forbrugere:** Knowledge-skill'et/MCP lokalt, SN-DeepDive, PodCarsten, SEO-app mfl. (søg efter `VITE_KNOWLEDGE_API_KEY` og `Bearer`). Flyt dem til server-side proxy; en nøgle i et Vite-bundle er offentlig.
5. **Bekræft at den gamle nøgle er død:** kald `GET /knowledge/health` med den gamle nøgle og forvent 401.
6. **Efter rotation:** overvej at omskrive git-historik (`git filter-repo`) og force-push - men kun hvis repoet har eksterne klon/forks; rotation er den afgørende beskyttelse, historikomskrivning er sekundær. Tjek også, om repoet er (eller har været) offentligt.
7. **Fremtidigt:** én nøgle pr. forbruger (aI-library-proxy, CMS-ingest, Claude-MCP, scheduler), så en lækage kan tilbagekaldes enkeltvis. Indfør secret scanning (gitleaks) i CI.
8. Notér rotationsdato og ejer i CLAUDE.md/runbook.

---

## 3. Knowledge API: auth-huller og konkrete rettelser (`Knowledge/src/api/server.ts`)

1. **Fail closed:** hvis `NODE_ENV=production` (eller Railway-miljø) og `API_KEY` mangler, skal processen afslutte med fejl i stedet for at starte uden auth (:26-37).
2. **Konstant-tids sammenligning** (`crypto.timingSafeEqual` på sha256 af begge sider), som aI-librarys `functions/access.ts` allerede gør.
3. **Flere nøgler med scopes** (`API_KEYS` som liste med navn + scope: `read`, `write:ingest`, `write:save`), så CMS-/scheduler-nøglen ikke kan læse hele grafen.
4. **CORS:** `origin: true` (:19) er unødvendigt nu, hvor browsere går via Firebase-proxyen; sæt `origin: false` eller en eksplicit liste.
5. **Rate limit og body-limit** (`@fastify/rate-limit`, `bodyLimit`), samt validering af input med schema (i dag `req.body as any` på `/knowledge/save`, `/ingest`, `/connect`).
6. **Auditlog** pr. nøgle (hvem ingesterede hvad).
7. **Manglende endpoints til agentbrug** (se afsnit 4): `POST /knowledge/agent-run`.

---

## 4. Hvad skal ændres, for at Knowledge kan modtage fra CMS'et eller agenterne

Nuværende tilstand (verificeret i kode):
- `ingest()` (Knowledge/src/core/ingest.ts) deduper på **global `content_hash`** (:33-50). Samme tekst fra to byer/kilder giver ét dokument, og den anden kildes URL/metadata går tabt.
- Klientens `IngestPayload` (src/services/knowledgeOSClient.ts:27-34) har **ikke** `publishedAt` og `extractorVersion`, selvom serveren understøtter dem (IngestInput). Dermed kan nyhedsdatoer ikke gemmes.
- `ingest` udtrækker **ikke** entiteter/claims. Det gør kun `save()` (kræver separat kald med `entities`).
- **Der er ingen HTTP-route til at oprette en `agent_run`**, selvom `save` kan tage `derivedByAgentRunId` og `list.ts` læser `knowledge.agent_run`. Provenance for agentoutput kan altså ikke oprettes via API'et i dag.
- Ingest-on-save er kun koblet til Firestore-`knowledge` (src/services/firestore.ts:132-148; non-blocking, korrekt mønster). Overvågningsfund, agentoutput og CMS-artikler ingesteres aldrig.
- Retning: Knowledge har "intet der trækker data den anden vej" (README). CMS'et skal derfor *skubbe* (webhook/outbox), ikke vente på at blive hentet.

Nødvendige ændringer (forslag, intet udført):

| Hvor | Ændring |
|---|---|
| Knowledge API | `POST /knowledge/agent-run` (start: `agentName`, `agentVersion`, `model`, `input`; slut: `status`, `output`), returnerer `agentRunId`; `ingest`/`save` accepterer `agentRunId` og skriver `knowledge.provenance` |
| Knowledge core | Dedupe på `(content_hash, url)` eller pr. kilde, så samme tekst fra to URL'er bevares som to kilder med ét dokument; `publishedAt`, `extractorVersion` og `metadata.externalId` gennem API'et |
| Knowledge API | `POST /knowledge/ingest-batch` (idempotent, maks 50) til scheduler-brug |
| aI-library | Udvid `IngestPayload` med `publishedAt`; ny server-side `functions/knowledgeIngest.ts` (kaldt fra scheduler og fra "send til CMS") i stedet for klientkald; kald `agent-run` før/efter hver pipeline-kørsel |
| aI-library | Ingest-on-save også ved: (a) nyt normaliseret signal (type `website`/`other`, `metadata.sourceType`, `kommuneKode`, `externalId`), (b) godkendt artikelkladde fra Redaktionsagent (type `agent_output`), (c) faktatjek-resultat som claims |
| CMS | Webhook/outbox ved publicering (artikel -> Knowledge `article`) og ved redaktørens vurdering ("signal -> brugt/afvist"), så Knowledge ved, hvad der faktisk blev publiceret. CMS har i dag intet webhook (AGENT-INGEST-API.md afsnit 8: "Ikke implementeret: webhook/kvittering") |
| Sikkerhed | Separat Knowledge-nøgle til CMS og scheduler (afsnit 3); ingen browser-nøgler |

---

## 5. agentflow-review: status for F01-F07 mod nuværende kode

Metode: kodelæsning af nuværende HEAD (`166786f`); testsuiten er **ikke** kørt. Status "rettet" betyder, at koden ikke længere indeholder det beskrevne mønster.

| Fund (oprindelig pri) | Status i kode | Evidens | Rest |
|---|---|---|---|
| F01 P0 Nøgle i klientkode | **Rettet i kode; drift åben** | `knowledgeOS.ts` bruger nu kun `knowledgeProxy` (Firebase callable); `functions/knowledge.ts` bruger secret `KNOWLEDGE_OS_API_KEY`; test `src/security/no-client-secrets.test.ts` forbyder `DEFAULT_API_KEY`/`VITE_KNOWLEDGE_API_KEY`/GoogleGenAI i klient | Rotation (fund 1); skill/README viser stadig VITE-mønstret (fund 11) |
| F02 P0 Faktatjek grønt på tomt | **Rettet** | factCheck.ts:45-50 afviser tomt/ukendt (`claims.length === 0` -> ugyldigt; kun kendte statusser); :63-65 beregner score uden 100-fallback | Live-evaluering mangler |
| F03 P0 Faktatjek dækker ikke artikel/kilder | **Delvist rettet** | `slice(0,12000)` er væk; `buildFactCheckSourceContext` (:73-84) rangerer relevante segmenter op til 80.000 tegn | Ingen artikel-hash/dækningsrapport; ikke bundet til artikelversion |
| F04 P1 Sparring->Graver taber filer | **Ser rettet ud** | `agentHandoff.ts` bygger `attachedFiles` + `suggestedQueries`; `InvestigationWorkflowPage.tsx:261` kalder `applyDocumentIngested` ved handoff | Handoff-kvittering er ikke server-persisteret (WP03-rest) |
| F05 P1 Nye segmenter når ikke granskningen | **Rettet** | `runChainFromCorpusMap(working, freshSegments, runId)` (:1017) og `runBroadDissectionCore(working, freshSegments, runId)` (:1052) | |
| F06 P1 Flerfilsupload overskriver indeks | **Ser rettet ud** | `handleAddFiles` (:438-448) akkumulerer i `working` med `applyDocumentIngested` pr. fil | Integrationstest ikke kørt |
| F07 P1 Kørsler bundet til monteret side | **Delvist** | `AgentWorkspace.tsx:40` holder `mountedAgents`, så faneskift ikke afmonterer; `pendingHandoffs` er stadig `useState` (:41); Sparring-session er lokal state | WP09 (server-runner, genoptagelse efter lukket browser) er "ikke gennemført" jf. dokumentets egen status |

Øvrige åbne WP'er fra dokumentets statustabel: WP08 (revisioner/konflikter), WP09, WP10 (budget/telemetri), WP11 (browser-E2E), WP12 (staging/rollback).

---

## 6. Forslag til `CLAUDE.md` for aI-library (indhold, ikke oprettet)

- Projekt: Vite/React frontend + Firebase Functions (`functions/`, Node 22, eget tsconfig) + Firestore. Deploy via GitHub Actions på `main`.
- Hemmeligheder: kun Functions-secrets (`GEMINI_API_KEY`, `KNOWLEDGE_OS_API_KEY`, `ACCESS_CODE`, `TOOL_ACCESS_CODE` ...), aldrig `VITE_*` for noget følsomt (test: src/security/no-client-secrets.test.ts). Læs/print aldrig `.env*`.
- To kopier af kildekonfig (agenda, politi, TV2) skal holdes i sync (`agendaSources.test.ts`) - eller brug den fælles JSON.
- Redaktionelle regler: kilden før modellen; mennesket har sidste ord; ingen automatisk publicering; krimi/112/sundhed kræver journalistisk gennemskrivning; kilde + dato på alle citater.
- Ekstern hentning: identificerende User-Agent, robots.txt, ingen omgåelse af bot-beskyttelse, 1 req/s pr. host.
- Kendte fælder: DAWA er lukket; Ritzau-URL'er skal bruge `?` og `searchParams`; Slagelse/Sorø ligger i Sydsjælland-Lolland-Falsters Politi.
- Den forældede kopi `/Users/lysdal/aI-library` må ikke bruges.

---

## 7. Anbefalet rækkefølge

1. Rotér Knowledge-nøgle (fund 1) og ret skill/README (11).
2. Erstat DAWA (2) og ret Ritzau-bug + Slagelse/Sorø-mapping (5, 4) - små, isolerede ændringer.
3. Gør Knowledge-API fail-closed med scopes (3) og tilføj `agent-run` + `publishedAt` (afsnit 4).
4. Træk hentelogik ud til scheduler + dedupe (6); indfør `monitorSources`-sundhed.
5. Afklar autonom tilstand (7), og kobl derefter CMS-adapteren på (T7).
6. Arkivér den forældede kopi (13), opret CLAUDE.md (12), ryd op i duplikerede konfigurationer (9).
