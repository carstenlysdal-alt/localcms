<!-- Baseline: localcms HEAD fc7c5d7 (2026-10-01), aI-library 88d89b8, Knowledge bafbc99. Arbejdsmappen var ren ved start. -->
# Plan: Gennemgående review af Lokalt-platformen (nyhedssite, CMS, AI-agenter)

## Context
Brugeren går nu i finjusterings-/rettefasen og vil have ét omfattende, brugbart review af: (1) det statiske nyhedssite `nyhedssite.html`, (2) Next.js-CMS'et i `cms/`, (3) designet af Næstved Lokalt (og søsterbyerne), inkl. om links virker og om der er naturlige klik mellem sektioner, og (4) koblingen mellem AI-Library/Knowledge OS-agenterne og CMS'et, så lokale feeds/overvågning (politi, 112, trafik, kommuner, foreninger, klubber, byer og småbyer) kan levere indhold ind på sitet.
Leverance (valgt): **review-rapport + opdelt task-liste** i repoet. Review-mål: statisk fil + CMS-kode + kørende site i browser. Eksterne skills må installeres.

Vigtigt fund undervejs: den *levende* aI-library ligger i `/Volumes/SSD Data/Gits/aI-library` (sidst ændret 30. sep). `/Users/lysdal/aI-library` er et gammelt snapshot (18. jun) med åben Firestore-regel + hardcodet admin-kodeord — reviewes ikke, men bør slettes/arkiveres. Knowledge OS MCP (`knowledge-os`) fejlede at forbinde i denne session og skal repareres før agent-review.

## Baseline: seneste committede version (brugerens krav)
Reviewet kører mod **HEAD (`fc7c5d7`, "Ret profil-ikon…"; siden planlægningen er `priser`/`annoncer` m.fl. committet i `4578f5c`)**, ikke arbejdsmappen. Arbejdsmappen har ucommittede ændringer (`build_nyhedssite.py`, `nyhedssite.html`, `cms/app/(site)/sponsor`, `bliv-en-del-af-journalistikken`, `SiteFooter.tsx`) og utrackede `annoncer/` og `priser/`.
- T0 opretter en ren checkout: `git worktree add <scratchpad>/review-head HEAD` (read-only brug; rører ikke arbejdsmappen eller de ucommittede filer). Dev-server, crawl, screenshots og al kodelæsning kører i den.
- Tilsvarende for `/Volumes/SSD Data/Gits/aI-library` og `/Volumes/SSD Data/Gits/Knowledge`: brug seneste commit (`git log -1`), og notér hvis arbejdsmappen afviger.
- **Fund fra første udforskning er læst i arbejdsmappen og skal genverificeres mod HEAD** før de kommer i rapporten. Særligt: alle linjenumre i `build_nyhedssite.py`/`nyhedssite.html`, `/priser`+`/annoncer`-duplikatet, `/priser`-linket i `SiteFooter.tsx`, sponsor-sidens "Se hele prislisten" og sitemap-hullet for disse sider (findes muligvis slet ikke i HEAD). Fund der kun findes i ucommittet kode markeres separat som "work in progress", ikke som fejl.
- Rapporten angiver commit-hash for hver kodebase.

## Skills
**Allerede installeret og bruges direkte:** `click-path-audit`, `web-design-guidelines`, `impeccable`, `ui-ux-pro-max`, `design-taste-frontend`, `accessibility`, `core-web-vitals`, `web-quality-audit`, `seo-audit` + `searchfit-seo:broken-links` / `internal-linking` / `technical-seo` / `schema-markup`, `code-reviewer`, `security-review`, `app-review`, `react-app-qa`, `webapp-testing`, `knowledge`, `lokalt-medieplatform` (i `.agents/skills/`), `y-sprog`, `to-issues`/`to-prd` (backlog).
**Eksterne, installeres ved godkendelse (`-g -y`):**
- `squirrelscan/skills@audit-website` (72K installs) – crawler-baseret site-audit: døde links, SEO, performance.
- `anthropics/skills@mcp-builder` (121K, officiel) – til at designe/bygge MCP-/API-laget mellem agenter og CMS.
Ingen kvalitetsskills fundet til "lokal journalistik"/RSS-ingest; det dækkes af egne skills + opgave T7.

## Allerede kendte fund (input til rapporten)
**Nyhedssite (`build_nyhedssite.py` → `nyhedssite.html`)**
- P0 runtime-bug: `submitTipMode` bruger udeklareret `currentCity` (script l. 2956) → alle 4 formularer kaster ReferenceError.
- Døde ankre: `#art-kultur` (bl.a. wire i 5 byer), `#art-foreningsliv`, `#nabolag` (bundbar). Mange kort linker til urelaterede artikler (Sport→byraad/tudeaa m.fl.).
- By-switcher er overfladisk: hero-billede, ticker, sektionskort, 7 artikler og søgeindeks forbliver Slagelse; hero-byline bruger forkert id (`hero-meta` vs `hero-meta-byline`); `wire-kommune-name` findes ikke. Sitet har 7 byer (inkl. Ringsted, Kalundborg), ikke 5.
- Ingen routing/aktiv-state/scroll-spy; 8×`h1`; tastatur-utilgængelige `div onclick`; ingen alt/aria på CSS-billeder; ingen OG/canonical/schema; `<title>` hardcodet Slagelse; 3,5 MB fil med base64-billeder; build-scriptet kan ikke regenerere billeder (læser sin egen output).
- Konflikt med egne regler: opdigtede citater, rigtige brandnavne som støttepartnere, ingen mærknings-badges, Google Fonts (3.-parts).
**CMS (`cms/`)**
- Døde links: `/om-mediet/privatliv` (SiteFooter.tsx:96, nyhedsbrev/page.tsx:127), `/artikel/${slug}` (MeddelerDashboardClient.tsx:795), `/trafik/live` (page.tsx:175), `/redaktion/emner/administrer`; hardcodede demo-slugs på forsiden; `/annoncer` duplikerer `/priser` uden canonical; nye sider mangler i sitemap.
- Bug: `proxy.ts` matcher `/partner/*` → anonyme partnere sendt til login (bryder sponsor-flowet).
- Sikkerhed: åben redirect i `api/site/switch`; uautentificerede `ads/track`/`metrics/track` (kan pumpe annoncetal); `/api/articles` på tværs af byer; ingen validering/rate limit på token-actions (`app/actions/sponsor.ts`, `qa.ts`, `interview.ts`, `meddeler.ts`); manglende `can()` i nyhedsbrev/omraader/annoncer/signaler; `dangerouslySetInnerHTML` uden sanitering (`SiteBlockRenderer.tsx`, `[slug]/page.tsx`); RSS CDATA/JSON-LD escaping; ingen `error.tsx`/`loading.tsx`; demo-password i seed; `/api/chat` uden limits.
- **Ingen indtagsendpoint for agenter** og ingen API-nøgle-mekanisme. `Signal`/`Topic`-modeller findes, men kun manuel formular.
**AI-Library / Knowledge OS (`/Volumes/SSD Data/Gits/aI-library`)**
- 3 agenter (Sparring, Graver/Research, Redaktion med 6 trin) + ~14 værktøjer; ~88 FirstAgenda-dagsordensportaler (Næstved/Slagelse/Holbæk/Køge/Roskilde dækket), 328 feeds, politi (12 kredse), retslister, Plandata, Høringsportalen, TV2 Øst. Alt er pull-on-demand: **ingen schedulers**, ingen persistent dedupe.
- Mangler helt: 112/beredskab, Vejdirektoratet/trafik, kommune-pressemeddelelser, foreninger/klubber, lokale medier (sn.dk, VDonline, ugeaviser), DMI-varsler, **alt under kommuneniveau** (Korsør, Skælskør, Karrebæksminde, Mogenstrup osv.).
- Risici: gammel Knowledge-API-nøgle i git-historik (commits 553b2a8, 1ab0bd1) → rotér; Knowledge-API kører uden auth hvis `API_KEY` ikke er sat; URL-uenighed (`biblio.up.railway.app` vs skill'ens `knowledge-os-production-e5df…`); `&`-i-stedet-for-`?` bug i Ritzau-URL'er (`functions/index.ts`); `agentflow-review` P0/P1 (falsk-grøn faktatjek m.fl.); autonomous mode vs. krav om menneskelig godkendelse.

## Task-opdeling (hver task = egen afgrænset session, egen output-fil)
Output samles i `docs/review/` i localcms-repoet: `00-oversigt.md`, én fil pr. task, og `backlog.md` (P0–P3).

| # | Task | Skills / metode | Output |
|---|---|---|---|
| T0 | **Setup**: `git worktree` af HEAD (se Baseline); installér 2 eksterne skills; repair `knowledge-os` MCP; start CMS dev-server fra worktree (`cms/`, seed, `*.localhost` pr. by) | `npx skills add … -g -y`, `preview_start` | Kørende miljø, status |
| T1 | **Link- & klik-audit, statisk site**: udtræk alle `href`/`onclick`/`switchCity`, resolve mod ids, kortlæg sektion→sektion-flow (forside→sektion→artikel→støt/indsend) pr. by | `click-path-audit`, script over `nyhedssite.html` | Linkmatrix + dødt-link-liste + manglende naturlige klik |
| T2 | **Link- & klik-audit, CMS kørende**: crawl alle routes pr. by (Næstved først), tjek 404/redirect, header/footer/BottomNav/breadcrumbs/emne/område/forfatter, forsiden→artikel→relateret | `audit-website`, `broken-links`, `internal-linking`, browser-værktøj | Crawl-rapport, forældreløse sider, manglende interne links |
| T3 | **Designreview (Næstved Lokalt → de øvrige byer)**: hierarki, typografi, farver pr. by, kort/18px-radius, mobil/tablet/desktop-screenshots, konsistens vs. `files/DESIGN.md`, kvalitet af by-skift | `web-design-guidelines`, `impeccable`, `ui-ux-pro-max`, `design-taste-frontend`, `refactoring-ui` | Screenshot-annoteret designrapport + forslag |
| T4 | **A11y, performance, SEO**: tastatur/skærmlæser/kontrast, Core Web Vitals (3,5 MB-fil vs. `next/image`), OG/canonical/schema/sitemap/RSS | `accessibility`, `core-web-vitals`, `web-quality-audit`, `seo-audit`, `technical-seo`, `schema-markup` | Scorecard + fixliste |
| T5 | **CMS kode- og sikkerhedsreview**: auth/permissions, åben redirect, XSS, tenant-isolation, token-actions, upload, tests | `code-reviewer`, `security-review`, `app-review` | Fund med fil:linje + severity |
| T6 | **Redaktionel governance & indhold**: mærkningsregler (5 typer), `aiBrug`, kilde/dato på citater, opdigtede citater i demo, støttepartner-regler, sprog | `lokalt-medieplatform`, `y-sprog`, `y-koncept` | Compliance-tjekliste |
| T7 | **Agent→CMS-integration (arkitektur)**: `POST /api/ingest/*` med hashet API-nøgle pr. `Instance`, tvunget kladde + `aiBrug`, zod mod blokskema, dedupe på `kildeUrl`/`externalId`, `Signal`→kladde-flow, RSS-widget "Fra kommunen/politiet", "Administrér kilder"-schema, fælles provenance-objekt | `mcp-builder`, `knowledge`, `to-prd` | Teknisk spec + dataflow-diagram |
| T8 | **Kilde- og dækningsmatrix**: by × kildetype (dagsorden, politi, 112, Vejdirektorat, kommune-PR, foreninger/klubber, lokale medier, DMI) for Næstved, Slagelse (Korsør, Skælskør), Holbæk, Køge, Roskilde (+Ringsted, Kalundborg) og småbyer (Karrebæksminde, Mogenstrup m.fl.); koble til `GeoTag`-områder; scheduler-design (Cloud Scheduler) | `Explore`-agenter, `knowledge` | Matrix + prioriteret kildeliste |
| T9 | **AI-Library/Knowledge OS-review**: `agentflow-review` P0/P1, nøglerotation, auth på Knowledge-API, URL-uenighed, Ritzau-URL-bug, persistent dedupe, human-in-the-loop, gammelt snapshot | `app-review`, `security-review` | Stabiliseringsliste |
| T10 | **Samling**: dedupliker fund, severity-rangér, lav `backlog.md` og issues | `to-issues` | `00-oversigt.md` + `backlog.md` |

Rækkefølge: T0 → (T1, T2, T3 parallelt) → (T4, T5, T6 parallelt) → (T7, T8, T9 parallelt) → T10. Hurtige gevinster (P0): T1-bugs (`currentCity`, døde ankre), `/partner`-proxy, åben redirect, `/om-mediet/privatliv`.

## Verifikation
- `git status` i arbejdsmappen før og efter: uændret (reviewet må ikke røre ucommittet arbejde); `git -C <worktree> rev-parse HEAD` = `fc7c5d7`.
- Hvert fund skal have bevis: fil:linje eller screenshot/URL + byvariant; links verificeres ved faktisk request/klik, ikke kun statisk læsning.
- `cd cms && npm test` (13 logiktests) + `npm run build` som baseline før/efter evt. rettelser.
- Statisk site: åbn `nyhedssite.html` i browser-pane, skift alle 7 byer, klik hver nav-/kort-/footer-link, tjek konsol for fejl, mobil-viewport (375px).
- Rapporten gennemgås med brugeren; først derefter rettes P0/P1 (ingen kodeændringer i review-faserne).

---
## T11 – Modulær forside med AI-ranking (tilføjet efter ønske)
**Mål:** Forsiden bygges af moduler/slots. En AI i baggrunden scorer og prioriterer artikler løbende og fylder slottene; en artikel vises forskelligt afhængigt af slot, indholdstype (attribution) og prioritet. **Fallback = seneste nyt** hvis ranking mangler, er forældet eller fejler.

**Det der allerede findes (genbruges):**
- `lib/distribution-engine.ts`: score = redaktionel base + tidshenfald (breaking/sektion) + velocity + daypart + geo-bonus.
- `ArticleMetric` (visninger, læsninger, læsetid, `score`, `hourlyViews`) og `FrontpagePlacement` (zoner `top-hoved`, `top-sekundaer`, `omraade`, `sektion`, position, udløb 48 t).
- `lib/frontpage-governance.ts` (kvoteloft for støttefinansieret indhold), `lib/marking.ts` (5 indholdstyper), `Article.pinned/breaking/aiBrug`.
- Redaktionens forside-handlinger i `app/redaktion/forside/actions.ts`.

**Foreslået design:**
1. **Modulregister** (`lib/frontpage/modules.ts`): hvert modul har id, slots, tilladte indholdstyper, min/max antal, layout-varianter og visningsregler. Fx `hero` (1 stor), `top-grid` (3), `breaking-bar`, `seneste-nyt` (liste), `dit-omraade`, `sektion-rail` (pr. sektion), `partner-boks`, `kalender-strip`, `debat`, `opslagstavle`, `signaler/Fra kommunen/politiet`.
2. **Slot-varianter pr. artikel:** samme artikel kan rendres som `hero`, `kort`, `kompakt`, `liste` eller `tekstlinje`. Mærkning (Uafhængig/Partner/Sponsoreret/Brugerindsendt/AI) vises altid synligt i alle varianter.
3. **Ranker i to lag:** (a) deterministisk score (eksisterende engine, rene funktioner, testbare); (b) AI-lag (Claude via `@anthropic-ai/sdk`) der kun *re-rangerer en kandidatliste* og returnerer struktureret JSON: `articleId, prioritet 1–5, forslagModul, begrundelse (kort), konfidens`. Kører som planlagt job (Cron/route + `FrontpageSnapshot`-tabel), aldrig i request-stien.
4. **Redaktionelle rækværk (hårde regler, AI kan ikke tilsidesætte):** redaktørens pins og `breaking` vinder; kvoteloft for Partner/Sponsoreret/PR; AI-assisteret ikke i `hero` uden menneskelig godkendelse og aldrig i Krimi/Sundhed; kun `Publiceret`; max 1 artikel pr. emne i top-grid (diversitet); frisk-grænse; tenant-isolation pr. by.
5. **Fallback-kæde:** AI-snapshot (<N min gammelt) -> deterministisk score -> **Seneste nyt** (publiceretTid desc). Fejl i AI/timeout logges, forsiden går aldrig ned.
6. **Redaktionel kontrol:** `/redaktion/forside` viser aktuel placering, score, AI-begrundelse, og lader redaktøren pinne/blokere/overstyre; "AI-forslag"-tilstand vs. "auto"-tilstand pr. modul. Alle AI-valg logges (`FrontpageDecision`) for gennemsigtighed.
7. **Måling:** CTR/impression pr. slot via `/api/metrics/track` (tenant-sikret) til at forbedre scoren.

**Skills:** ingen god færdig skill findes. Eneste relevante kandidat: `affaan-m/ecc@recsys-pipeline-architect` (5,2K installs, lav tillid, ikke installeret). Brug i stedet `claude-api` (AI-lag, struktureret output, prompt caching), `lokalt-medieplatform` (governance), `impeccable` + `ui-ux-pro-max` + `design-taste-frontend` (modul-/slotdesign), `tdd` (ranker som rene funktioner), `to-prd` (spec), `site-architecture`.

**Rækkefølge:** kører efter wave 1 (forside `page.tsx` redigeres nu af links-agenten): spec (PRD) -> modulregister + snapshot-model -> deterministisk ranker + tests -> AI-lag + fallback -> redaktionsvisning -> modulær `page.tsx` -> måling.

**Beslutning (ejer):** AI'en **foreslår** forsiden. Standard pr. modul = *forslag-tilstand*: AI-snapshot ligger som kladde, og en redaktør godkender/justerer før det går live. *Auto-tilstand* kan slås til pr. modul senere. Indtil et forslag er godkendt, vises den sidst godkendte forside; findes ingen, bruges deterministisk score og til sidst **Seneste nyt**.

---
## T12 – Modulbibliotek, skabeloner og drag-and-drop-forsideeditor (AI-understøttet)
**Mål:** Ejeren vil have et bibliotek af moduler/skabeloner (fx en top der brydes af en annonce, sponsoreret indhold eller andet), som kan kobles ind, og en editor i CMS'et hvor man åbner forsiden og flytter rundt på modulerne. Alt skal være AI-understøttet.

**Bygger på T11** (modulregister, snapshot, forslag-tilstand). Genbrug: blokmodellen i `cms/lib/blocks/{schema,registry,renderer}.tsx`, `FrontpagePlacement`, `AdCampaign` (formater NATIVE_PREMIUM, IN_FEED_BANNER m.fl.), `app/redaktion/forside/{page,actions}`, tiptap.

1. **Skabelonbibliotek** (`lib/frontpage/templates.ts`): færdige top-/sektionsskabeloner, fx `top-3-grid`, `top-hero + sidebar`, `top-med-annonce-break` (annonce/sponsoreret/partner indsættes efter slot N), `breaking-banner`, `dit-omraade-rail`, `kalender-strip`, `fra-kommunen/politiet`. Hver skabelon = rækkefølge af moduler + slots + regler for hvilke indholdstyper/annoncer der må ind.
2. **Break-moduler:** `ad-break`, `sponsoreret-break`, `partner-break`, `egen-promo` (støt/nyhedsbrev/indsend) med frekvens, kvoteloft (`kvoteloftProcent`) og tydelig mærkning; en skabelon kan have flere break-punkter.
3. **Layout-model:** `FrontpageLayout` (instansId, status kladde/live, version, `modules[]` som JSON: id, type, config, rækkefølge, slot-regler). Versionering + rul tilbage. Pr. by og evt. pr. tidspunkt/dagsdel.
4. **Editor** (`/redaktion/forside/editor`): åbn forsiden, drag-and-drop af moduler og slots (anbefalet bibliotek: `@dnd-kit/core` + `@dnd-kit/sortable`, tastaturstyring og a11y), tilføj modul fra bibliotek, skift skabelon, live preview pr. breakpoint (375/768/1440), gem som kladde, publicér, fortryd/gentag, rettighedstjek (`can()`), konfliktløsning ved samtidig redigering.
5. **AI-understøttelse i editoren:** (a) "Foreslå layout" ud fra dagens artikler; (b) "Fyld slots" med T11-rankeren (kun forslag, redaktør godkender); (c) AI-forklaring pr. placering; (d) foreslå overskrift/manchet-varianter pr. slot, altid mærket; (e) advarsler (kvoteloft, diversitet, mærkning mangler, tomme slots); (f) naturligt sprog: "Sæt den vigtigste politiske sag i toppen og læg en sponsoreret boks efter tredje historie". Alle AI-handlinger logges.
6. **Rækværk:** AI kan ikke fjerne mærkning, omgå kvoteloft, publicere uden redaktørgodkendelse eller placere AI-assisteret indhold i hero/Krimi/Sundhed.

**Skills:** ingen færdig skill til page-builder/drag-and-drop fundet (søgt på page builder, visual editor, dnd-kit, layout templates, native ad placement). Brug `frontend-design`, `impeccable`, `ui-ux-pro-max`, `design-taste-frontend`, `emil-design-eng` (interaktion/feel) til editorens UI; `claude-api` til AI-funktionerne; `tdd` til layout-model og regler; `react-app-qa`/`webapp-testing` til test af editoren; `ad-creative`/`cro` kun til annoncepladsernes indhold. Valg af bibliotek (dnd-kit) er teknologi, ikke skill.

**Rækkefølge:** T11-spec -> T12-datamodel + skabeloner -> modulært forside-render -> editor (drag-and-drop) -> AI-funktioner -> test + a11y.

---
## T13 – Robusthed: bots, DDoS, kodehygiejne og stabilitet (tilføjet efter ønske)
**Realistisk afgrænsning:** Volumetriske DDoS-angreb stoppes ikke i applikationskoden, men i kanten (CDN/WAF) før trafikken når serveren. Appen kan gøre sig *billig at besøge* (cache), *dyr at misbruge* (rate limits, validering) og *svær at vælte* (timeouts, fallbacks, health). T13 leverer begge lag: kode i repoet + en driftsrunbook for kanten, som ejeren selv skal sætte op (konti/DNS kan ikke gøres af Claude).

**Skills:** ingen færdig DDoS-skill findes (søgt: ddos/rate limiting, bot/WAF, security hardening, owasp, csp-headers, resilience, dependency audit). Relevante kandidater (ikke installeret, afventer ejerens valg af hosting): `upstash/skills@upstash-ratelimit-js` (14,8K installs; kun hvis Redis/Upstash vælges som delt rate-limit-store), `better-auth/skills@better-auth-security-best-practices` (39K; kun delvist relevant — CMS bruger next-auth), `cloudflare/skills@web-perf` (87K). Brug i øvrigt allerede installerede: `security-review`, `code-reviewer`, `best-practices`, `performance`, `core-web-vitals`, `app-review`, `webapp-testing`, `tdd`, `diagnose`.

**Lag 1 – Kant (runbook `docs/ops/EDGE-HARDENING.md`, ejer udfører):** Cloudflare (eller tilsvarende) foran alle by-domæner: proxy + TLS strict, managed WAF-regler, Bot Fight/Super Bot Fight, rate-limit-regler (login, /api/*, /soeg, /og/*, formularer), Turnstile på offentlige formularer, Under-Attack-playbook, IP-allowlist for /redaktion (eller Access), cache-regler for anonym HTML/feeds/sitemaps/OG-billeder, origin låst så kun kantens IP'er kan nå serveren, alarmer.
**Lag 2 – Applikation (kode):**
1. Sikkerhedsheadere: CSP (nonce/strict-dynamic), HSTS, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, Permissions-Policy, COOP; `nosniff` + sandbox på /uploads.
2. Klient-IP og tillid: ét sted der udleder IP fra `CF-Connecting-IP`/`X-Forwarded-For` kun fra betroede proxyer; alle rate limits bruger det.
3. Delt rate-limit-/dedupe-/lockout-store (`setRateLimitStore()` findes): adapter til Redis/Upstash eller Postgres; fail-open/closed pr. endpoint; globale og pr.-endpoint-grænser; slow-request/body-size/timeout-grænser; reducér server-action-body fra 12 MB hvor muligt.
4. Dyre endpoints beskyttes: `/og/*` (billedgenerering), `/soeg`, feeds/sitemaps, `/api/chat`, AI-ranker — cache (`s-maxage`, ETag), samtidighedsbegrænsning, billed-dimensionsallowlist, kø/coalescing.
5. Cache og ISR for anonym trafik (åbent punkt fra SEO-sporet): tenant uden `headers()` i render-stien, `revalidateTag` i redaktionelle actions, `stale-while-revalidate` — det er det vigtigste DDoS-værn i appen.
6. Bot-politik: robots + AI-botregler (findes), UA-/adfærdsfiltrering for skrabere, honeypot-felter i alle formularer (mangler i UI), Turnstile-integration (valgfri via env), login-lockout (findes) + MFA-forberedelse for redaktion.
7. Stabilitet: `/api/health` (liveness) + `/api/ready` (DB), timeouts og retry/circuit breaker om Anthropic og eksterne kald, graceful degradation (forsiden uden AI/ranker), DB-forbindelsespool og indekser, **SQLite -> Postgres** til produktion, backup/restore-test, miljøvalidering ved start (zod: manglende hemmeligheder stopper opstart), struktureret logging + fejlovervågning (Sentry-kompatibelt), request-id.
8. Kodehygiejne: ryd 83 ESLint-advarsler og døde filer (fx `WeekendCalendar.tsx`), saml dublerede `slugify`, `strict` TypeScript-tjek, pre-commit (lint-staged + secretlint/gitleaks), `npm audit` + Dependabot, lockfile-disciplin, ingen hemmeligheder i git (rotér gamle nøgler), CI i GitHub Actions: `tsc`, `eslint`, `npm test`, `next build`, `npm audit --omit=dev`, gitleaks, CodeQL; Playwright-smoketests (forside pr. by, artikel, formularer, 404, /redaktion kræver login); belastningstest (k6/autocannon) med tærskler for forside, artikel, søg, feed.
**Verifikation:** headertest (securityheaders-lignende script), rate-limit-tests, belastningstest før/efter cache (RPS, p95, fejlrate), crawl- og JSON-LD-regression, `next build && next start` smoke, CI grøn.
**Rækkefølge:** efter commit+push og designfix; kan køre parallelt med T11/T12-UI, hvis filejerskab holdes adskilt (T13 ejer `next.config.ts`, `proxy.ts`, `lib/site.ts`, `lib/ratelimit`, `lib/env`, `.github/`, `docs/ops/`, tests/e2e; UI-sporet ejer `app/(site)/page.tsx`, `components/site/**`, `app/redaktion/forside/**`).

**Beslutning (ejer): hosting = Railway.** Konsekvenser for T13:
- **Database:** Railway PostgreSQL (Prisma `provider = "postgresql"`, `prisma migrate deploy` ved deploy; SQLite kun lokalt). Egen database/schema til CMS — ikke Knowledge OS' (`knowledge`-schemaet) eller Newzy-databasen. Forbindelsespool (PgBouncer/`connection_limit`), indekser, automatiske backups + gendannelsestest.
- **Rate-limit/dedupe/lockout-store:** Railway Redis-plugin via `ioredis` (adapter til `setRateLimitStore()`); `upstash-ratelimit-js`-skill er derfor **ikke** nødvendig. Fail-mode pr. endpoint.
- **Kant:** Railway har ingen indbygget WAF/DDoS-filtrering for brugerdomæner → Cloudflare foran alle by-domæner (DNS proxied, SSL Full strict), origin låses (Cloudflare Authenticated Origin Pulls / hemmelig header-check i `proxy.ts`); klient-IP fra `CF-Connecting-IP` kun når headeren stammer fra Cloudflare.
- **Runtime:** `next start` (`output: "standalone"` til lille image), `railway.json`/Nixpacks med healthcheck på `/api/ready`, `restartPolicyType: ON_FAILURE`, flere replicas bag Railway-proxy kræver Redis-delt state (rate limits, cache-tags). Persistente uploads: Railway Volume eller S3-kompatibel bucket (ikke lokalt filsystem — `public/uploads` forsvinder ved redeploy).
- **Miljøer/hemmeligheder:** Railway-variabler pr. miljø (production/staging); `AUTH_SECRET`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `REDIS_URL`; miljøvalidering stopper opstart ved mangler. Cron: Railway Cron service kalder `/api/cron/frontpage-rank` med `CRON_SECRET`.
- **Domæner:** ét Railway-service-domæne pr. by-site (*.lokalt.dk) via `getCurrentSite()` host-opslag; ukendt host = 404 (findes).
- **Observabilitet:** Railway-logs + struktureret JSON-logging, Sentry-kompatibel fejlrapportering, uptime-monitor (fx BetterStack) på `/api/ready` pr. by.
