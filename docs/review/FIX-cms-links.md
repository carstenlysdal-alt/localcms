<!-- FIX-cms-links: rettelser af T2-fund (link/klik/by). Branch review-fixes, ingen commits. -->
# FIX: CMS links, klikstier og by-isolering (T2)

Alt nedenfor er rettet i `cms/` på branchen `review-fixes` (ikke committet). Verifikation: `npx tsc --noEmit` (rent), `npm test` (81/81 inkl. andre ejeres tests), samt Python-crawl mod `naestvedlokalt.localhost:3000` og `holbaeklokalt.localhost:3000` (se afsnit 3).

## 1. Fund -> ændring

| Fund | Ændring |
|---|---|
| **F1** `/om-mediet/privatliv` 404 | Ny side `app/(site)/om-mediet/privatliv/page.tsx`: dataansvarlig, nyhedsbrev, indsend/tips, annoncer, anonym måling, serverlogs, cookies/localStorage, modtagere, rettigheder, klage til Datatilsynet. **Tydeligt mærket "Udkast"** til gennemgang af ejer/jurist. Ingen opdigtede firmadata: `[CVR…]`, `[leverandører…]`, `[opbevaringsperiode…]`, `[dato…]` er pladsholdere; kontaktmail udledes af sitets domæne. |
| **F2** by-switcher virker ikke | Header, footer, mobilark (`SectionSheet`) og `TopicFilterBar` bruger nu **almindelige links til målbyens domæne** (`https://{domæne}` i produktion, `http://{by}lokalt.localhost:PORT` lokalt). Ny `getNetworkLinks()` i `lib/site.ts` + `siteOrigin/resolveSwitchPath/networkHref` i `lib/network-sites.ts`. Stien bevares kun hvis den findes hos målbyen (fælles statiske sider, sektioner og undersektioner), ellers `/`. Footeren viser kun *andre* byer (ikke sig selv). Pladsholdertekst "[By]Lokalt netværket" erstattet af "Søstermedier". |
| **F2b** `getCurrentSite()` serverede stille Slagelse | Ny ren funktion `resolveSiteDomain()` (testet). Ukendt vært: **produktion = 404** (eller `FALLBACK_SITE_DOMAIN` hvis sat); `*.localhost` med ukendt by = 404; udvikling falder kun tilbage for ikke-lokale ukendte værter. `site`-cookien og `x-site`-headeren bruges **kun uden for produktion** (og cookien kun på bar localhost). Bar `localhost` i produktion bruger kun `DEFAULT_SITE_DOMAIN`. |
| **F6** åben redirect i `/api/site/switch` | Ruten sætter ikke længere cookie og redirecter kun til en by fra hvidlisten (`ALL_NETWORK_SITES`) med en relativ, same-site sti (`/…`, aldrig `//`, `\`, `http…`). Verificeret: `redirect=https://evil.com` giver `/` på målbyen; ukendt `site` giver `/`. Beholdt kun for gamle links/bogmærker. Login-siden afviser nu også `callbackUrl` der starter med `//`. |
| **F3** forsiden hardcodede Slagelse-demo + 8 døde links | `app/(site)/page.tsx` omskrevet: alle blokke kommer fra databasen pr. by (`getFrontpageData` + ny `lib/site-frontpage.ts`). Fjernet: de tre hardcodede mellemkort, de fire hardcodede "Mere fra"-kort, hero-fallback (Storebælt/"Jonas Vestergaard"), fiktivt vejrkort ("12°"), det engelske "West Haven Municipality"-kortbillede og fallback-listen i "Seneste nyt". Tom tilstand: hero med "Velkommen til {site}" + CTA til `/indsend`; blokke uden data skjules. Ingen links til ikke-eksisterende slugs. |
| **F3b** `BeaconPartners`/`CommunityBoardBlock` hardcodede partnere/opslag | Partnere hentes fra aktive `SupportAgreement` for byen (ingen = kun støt-CTA til `/bliv-stoette`). Opslagstavle-blokken viser borgerindsendte artikler (`Brugerindsendt`) for byen, ellers ærlig tom-tilstand. |
| **F4** `/trafik/live` 404 | LIVE-pillen er fjernet. I stedet vises en "TRAFIK · Seneste trafikmelding"-pille **kun** hvis byen har en publiceret artikel i undersektionen `trafik` fra de seneste 3 dage, og den linker til artiklen. Ingen "live"-påstand uden live-data. |
| **F7** nyhedsbrev-form postede til 404 | Se punkt 2 (nyhedsbrev). |
| **F8** `/partner/*` sendt til login | `proxy.ts`: kun `/redaktion` og `/redaktion/**` kræver session. `/partner/{token}` er offentlig (verificeret: 200). |
| **F5** `/kalender`, `/opslagstavle`, `/om-mediet` hardcodet Slagelse | `kalender` og `opslagstavle` er omskrevet til pr.-by-data (se nedenfor). `om-mediet` bruger `Instance.geografiskDækning` til dækningsområde og `sideTekster.omMediet` til introtekst. Frie "F.eks. Slagelse …"-placeholdere i formularer (indsend-wizard, meddeler, qa, sponsor/priser) og "Storebælt" i profilen gjort neutrale. Seed/DB: delte medie-rækker havde "Slagelse Rådhus", "Korsør Havn", "Slagelse Stadion", "Skælskør" i alt-tekst/billedtekst på alle byers artikler -> neutral tekst i `seed.ts` og i `dev.db`. |
| **F9** ø-slug 404 | Se punkt 4 (slug). |
| **F11** 404/fejl | Nyt: `app/not-found.tsx` (rod, server-renderet indhold + links), `app/(site)/error.tsx`, `app/error.tsx`, `app/global-error.tsx`; `loading.tsx` kun på ruter uden `notFound()` (`soeg`, `kalender`, `opslagstavle`, `nyhedsbrev`). **Bevidst ikke** på `[sektion]`/`[slug]`/`omraade/[slug]`/`emne/[slug]`: en `loading.tsx` flusher shell'en før `notFound()`, så 404 ville blive en soft-404 med status 200 (SEO-regression). 404-sidens SSR-indhold i dev skal verificeres i `next build && next start` (se "Ikke rettet"). |
| **F12** filter-links uden effekt | `TopicFilterBar` linker nu til rigtige undersektioner (`/nyheder/sundhed`, `/nyheder/trafik` osv.) og "Mit nabolag" til `/omraade`; aktiv-markering ud fra stien. `/nyheder?emne=x` 308-omdirigeres til den tilsvarende undersektion/`/omraade`. `?filter=mest-laest` er implementeret (sortering efter `ArticleMetric.visninger`, `noindex`); forsidens falske "Lokalt lige nu"/"Analyse"-faner er fjernet. `?omraade=` på sektioner virkede allerede; filtrerede visninger er `noindex,follow`. Forsidens områdevælger (`AreaPicker`) navigerer til `/omraade/{slug}`; uden JS sender GET-formularen til `/omraade?valg=slug`, som redirecter. |
| **F13** `/annoncer` = `/priser` | `/annoncer` giver nu 308 til `/priser`. |
| **F14** forældreløse sider | Header (desktop+mobil): Områder, Kalender. Footer: Områder, Emner, Kalender, Opslagstavlen, Bliv en del af journalistikken, Priser, Sponsor & partner, Kilde-Q&A, Kildeinterview, Kontakt, Privatliv, Velkommen. Mobilark: alle ovenstående + "Alle områder". `/omraade` (indeks, med antal artikler pr. område) og `/emne` (indeks: nyhedsundersektioner + stikord med artikler) oprettet. Sektionssider har ny sidebar "Områder i {by}" med links til `/omraade/*` (så tomme/ulinkede områder nu er nåbare). Om-mediet har en "Find rundt"-sektion med links til alle sider. |
| **F15** sitemap | Ikke min fil: se "Anmodninger". |
| **F16** `…lokalt.dk/presse` | Seed-tekst og de 5 eksisterende rækker i `dev.db` peger nu på `/om-mediet/kontakt`. |
| **F17** `/redaktion` i footer/mobilark; login dead end | Fjernet fra footer og mobilark. Findes nu kun som diskret "Redaktion"-link nederst på `/om-mediet`. Login: demo-hint fjernet, "Tilbage til forsiden" tilføjet. |
| **F18** midlertidige redirects i navigation | Alle interne links bruger destinationen (`/indsend?kategori=tip`, `/bliv-stoette`). De to redirect-sider findes stadig for gamle links. |
| **F20** søgning folder ikke diakritik | `searchSiteArticles` splitter i ord; hvert ord matches i varianter (`byraad`, `byråd`, `skaelskoer`, `Skælskør` + stort begyndelsesbogstav pga. SQLite LIKE). `/soeg?q=byraad` og `?q=byråd` giver nu begge 2 resultater. |

## 2. Nyhedsbrev (punkt 4)
- `lib/newsletter.ts`: zod-skema (e-mail trimmet/lowercase, max-længder, slug-regex, samtykke krævet, honeypot-felt `website`), `rateLimit` pr. IP (genbruger `lib/ratelimit`: 5 pr. 10 min), dedupe pr. `(instansId, email)` inkl. genaktivering og P2002-race, `instansId` fra `getCurrentSite()` (aldrig fra klienten).
- `app/(site)/nyhedsbrev/actions.ts` (server action) bruger kernen; bruges af `/nyhedsbrev`, sektionsboksen og den nye `NewsletterMiniForm` på forsiden (med samtykke-checkbox og honeypot).
- `app/api/newsletter/subscribe/route.ts`: POST for formular (303 til `/nyhedsbrev?tilmelding=ok|fejl`, relativ Location) og JSON. Verificeret: ny tilmelding gemmes i Næstved-instansen, dublet giver ok uden ny række, honeypot gemmer intet, ugyldig e-mail giver fejl.
- `/nyhedsbrev` viser statusbesked fra `?tilmelding=`.

## 3. Verifikation (crawl)
Script: Python, `Host`-header mod `127.0.0.1:3000`, følger alle interne `a[href]` til fuld mætning.
- **Næstved**: 90 interne URL'er, 89 x 200 og 1 x 307 (`/redaktion` -> `/login`, forventet). **Nul interne 404.** Lækage-scan (uden søster-by-links og scripts) efter rettelser: "Korsør", "Skælskør", "Storebælt", "Tude Å" = 0 sider; "Slagelse" fandtes kun i delte medie-alt-tekster/placeholdere, som er rettet (se resultatfil i afsnit nedenfor).
- **Holbæk**: samme resultat (se nedenfor).
- Øvrige tests: `/partner/abc123` = 200; `/redaktion` = 307 til login; `/nyheder/d%C3%B8gnrapport-x` = 301 til `/nyheder/doegnrapport-x`; ukendt vært (`kalundborglokalt.localhost`) = 404; switch-ruten: ekstern redirect afvist.

Slutresultat efter alle rettelser:
- `naestvedlokalt.localhost:3000`: 90 sider, 89 x 200 + 1 x 307 (`/redaktion`), **0 interne 404**, lækage-scan (Slagelse, Korsør, Skælskør, Storebælt, Tude Å): **0 sider**.
- `holbaeklokalt.localhost:3000`: 90 sider, 89 x 200 + 1 x 307, **0 interne 404**, lækage-scan (Slagelse, Næstved, Korsør, Skælskør, Storebælt): **0 sider**.
- Eneste ikke-søster eksterne links: kommunale dagsordener (seed-indhold), `datatilsynet.dk` og kontaktlink på byens eget prod-domæne.

## 4. Slug (punkt 7)
- `lib/slug.ts`: `slugify`, `transliterateDa` (æ->ae, ø->oe, å->aa), `isAsciiSlug`, `legacyPathToAscii`, `foldSearchText`, `searchVariants`.
- `prisma/seed.ts`: Slagelse-artiklen hedder nu `doegnrapport-overblik-over-nattens-haendelser-i-sydvestsjaelland`; tag-slugs bruger `slugify`.
- `scripts/fix-ascii-slugs.ts` (idempotent, `--dry` understøttet) rettede den eksisterende række i `dev.db`; en anden kørsel melder "Ingen ikke-ASCII slugs fundet".
- `proxy.ts`: enhver sti med rå/percent-kodet æ/ø/å 301-omdirigeres til translittereret sti (legacy `/nyheder/døgnrapport-…` -> ny slug). Matcheren dækker nu alle sider (ekskl. `_next`, `api`, statiske mapper).
- Tests: `tests/links-and-slugs.test.ts` (slug, legacy-redirect, søgevarianter, by-origin, switch-sti, `resolveSiteDomain`, nyhedsbrevsskema).

## 5. Ikke rettet / begrænsninger
- **Kalender og opslagstavle har ingen egen datamodel** (ingen `Event`/`Post` i Prisma). De viser publicerede artikler mærket med tags `arrangement`/`kalender`/`det-sker` hhv. `opslagstavle`/`opslag` for byen, ellers en ærlig tom-tilstand med CTA til `/indsend`. De hardcodede filterpiller er fjernet (de virkede kun på demo-data). Rigtig kalender kræver en `Event`-model (dato, sted, arrangør) og Event-schema; det er et produktbeslut, ikke en link-rettelse. Seed har ingen artikler med disse tags, så siderne viser tom-tilstand i dev.
- **Fiktivt vejr** er fjernet i stedet for at blive erstattet; der er ingen vejrdatakilde.
- **F11 i produktion** (SSR-indhold i 404) er ikke verificeret i `next build && next start` her.
- `LoadMore` er stadig en `<button>` (ikke crawlbart `?side=N`-link) – påvirker SEO, ligger i en fælles komponent; foreslås rettet sammen med paginerings-canonical.
- `components/site/WeekendCalendar.tsx` er ubrugt død kode med hardcodede events; ikke slettet (ingen importer, men ikke mit at fjerne).
- Fyrtårnspartnere vises ud fra aktive støtteaftaler: forudsætter at aftalen må omtales offentligt (T6).
- Eksterne links i seed-artikler (kommunale dagsordener, `harboe.com`) er ikke valideret (F22).
- `/api/articles` krydsby-lækage (F10) er ikke min ownership.

## 6. Anmodninger til andre ejere
- **SEO/artikelsider (`[sektion]/[slug]/page.tsx`)**: (a) tag-pille/emnelink til `/emne/<slug>` på artikler (`/emne/*` har stadig ingen indgående links fra artikler; tags findes først når redaktionen sætter dem); (b) "Flere fra {område}" og "Mere i {sektion}" som links; (c) `getArticleBySlug` ignorerer `sektion` -> canonical/redirect; (d) dekod `params.slug` (ikke længere nødvendigt efter ASCII-slugs, men nyttigt); (e) afmeldt: JSON-LD/OG for de nye sider.
- **sitemap.ts**: tilføj `/kalender`, `/opslagstavle`, `/priser`, `/nyhedsbrev`, `/omraade`, `/emne`, `/om-mediet/privatliv`, `/om-mediet/kontakt`, `/sponsor`, `/qa`, `/interview`; undlad `/annoncer` (redirect) og tomme undersektioner/områder.
- **(site)/layout.tsx**: jeg har ændret de ikke-metadata-dele (henter `getNetworkLinks()`, sender `networkSites/currentDomaene/sectionPaths` til header og bundnav). `generateMetadata` er urørt. Tilføj evt. `<link rel="alternate" type="application/rss+xml">` til `/feed.xml`.
- **redaktion/**: `app/redaktion/indbakke/actions.ts` og `omraader/actions.ts` har egne kopier af slugify -> brug `@/lib/slug`. `lib/taxonomy.ts` `RESERVED_SLUGS` bør indeholde `privatliv` hvis en sektion kunne hedde det (kun nødvendigt hvis `[sektion]` kan kollidere; i dag ligger privatliv under `/om-mediet/`).
- **Sikkerhed**: `lib/validation/index.ts` refererer til `./public`, som ikke findes (jeg bruger ikke den fil; mit eget zod-skema ligger i `lib/newsletter.ts`). Rate limit-storen er proces-lokal; sæt en delt store i produktion (`setRateLimitStore`).
- **Drift/env**: sæt `DEFAULT_SITE_DOMAIN` kun hvis bar `localhost` skal virke i produktion; sæt `FALLBACK_SITE_DOMAIN` kun hvis ukendte værter bevidst skal vise en by (ellers 404).
- **Prisma**: skemaet er ændret af en anden ejer (ApiKey/externalId); `npx prisma generate` skal køres ved deploy.
