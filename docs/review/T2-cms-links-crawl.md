<!-- T2: Link- og klik-audit, CMS kørende. Baseline: localcms HEAD fc7c5d7 (arbejdsmappen ren på nær untracked .claude/launch.json og docs/). Dev-server http://localhost:3000, by vælges via host (*.localhost:3000). Tidspunkt: 2026-10-01. -->
# T2 – Link- og klik-audit af det kørende CMS (Næstved først, derefter 5 søsterbyer)

## 1. Metode og dækning

- Eget Python-crawler-script (squirrelscan-CLI er ikke installeret; intet er installeret). HTTP-forespørgsler direkte mod `127.0.0.1:3000` med `Host: <by>lokalt.localhost:3000`. Redirects følges manuelt, så hver kæde registreres. Der er kun brugt HTTP, ingen browser.
- **Crawl A (kun links):** start på `/`, følger `a[href]`, `form[action]` og `link[rel=alternate]`, dybde op til 6 (reelt mættet efter ~4). Giver "linked-from" og orphan-analyse. Kørt for alle 6 byer.
- **Crawl B (probe):** Næstved med alle sitemap-URL'er plus alle kendte ruter og mistænkte døde links som seeds (146 URL'er). Giver statuskoder for sider, der ikke er linket.
- Ekstra: lækage-scan (tekst uden scripts og uden by-switcher) af alle 6 byers HTML (ca. 680 sider), feed-tjek, `src`-tjek af billeder/scripts (18 og 21 unikke, alle 200), samt sitemap sammenlignet med linkgrafen.
- **Begrænsninger.** Klient-renderet UI (`SectionSheet`, dvs. mobilens "Emner"/"Mere"-ark) ligger ikke i SSR-HTML. Det er læst i kode (`components/site/SectionSheet.tsx`), ikke klikket. Eksterne links er ikke hentet (kun listet). Dev-server: Next dev leverer 404-siden anderledes end prod (se F11).
- Redirect-kæder: ingen kæder over 1 hop. Alle redirects er enkelte 307/308 (`/tip-os`, `/stoet`, `/priser/`, `/redaktion`, `/partner/*`).

Crawl-størrelse pr. by (link-crawl): Næstved 112 URL'er (99 x 200, 11 x 404), Slagelse 152, Holbæk 112, Køge 111, Roskilde 112, Ringsted 113. Hver by har 8 hardcodede døde forsidelinks plus `/om-mediet/privatliv`, `/trafik/live` og `/api/newsletter/subscribe`.

## 2. Fund, rangeret (P0 = ret før noget andet)

### P0

**F1. `/om-mediet/privatliv` giver 404 og linkes fra hver eneste side**
- Evidens: `GET http://naestvedlokalt.localhost:3000/om-mediet/privatliv` giver 404. Linket findes i footeren (`components/site/SiteFooter.tsx:96`) og på `/nyhedsbrev` (`app/(site)/nyhedsbrev/page.tsx:127`). Crawlet: 98 af 99 sider i Næstved linker dertil (112 inkl. varianter), tilsvarende i alle 5 andre byer. Der er ingen route `app/(site)/om-mediet/privatliv`.
- Konsekvens: Ingen privatlivspolitik, men nyhedsbrev-tilmelding, profil og indsend indsamler persondata. Et dødt link i footeren på alle sider.
- Fix: opret siden (cookies, nyhedsbrev, indsendelser, tip, CMS-login), eller fjern linket indtil den findes. Tilføj siden til sitemap.

**F2. By-switcheren virker ikke (alle netværkslinks, alle sider, alle byer)**
- Evidens: Linket er `/api/site/switch?site=<domæne>&redirect=<path>` (`SiteHeader.tsx:89`, `SiteFooter.tsx:115`, `SectionSheet.tsx:150`, `TopicFilterBar.tsx:75`). Tests:
  - `curl -L http://naestvedlokalt.localhost:3000/api/site/switch?site=holbaeklokalt.dk&redirect=/` ender på `http://localhost:3000/` og viser **SlagelseLokalt** (standardinstansen), ikke Holbæk. Samme resultat for Køge og Ringsted, og fra Slagelse-host. Cookien `site=...` sættes på den gamle host (`naestvedlokalt.localhost`), men redirecten går til `localhost:3000` (host-baseret `request.url`), som ikke får cookien.
  - Selv hvis cookien nåede frem, ignorerer `lib/site.ts` (`getCurrentSite`) den, når host er et rigtigt domæne. Test: `Host: naestvedlokalt.dk` + `Cookie: site=holbaeklokalt.dk` giver stadig NæstvedLokalt. I produktion med rigtige domæner er switcheren altså et no-op: man bliver på samme by.
  - Switcheren virker kun på bar `localhost:3000` (cookie-baseret).
  - Antal links: 340 til 540 switch-links pr. crawlet by (5 pr. side).
- Header-switcheren sender desuden aktuel sti med (`redirect=%2Fnyheder%2F<slug>`). Selv hvis redirect virkede, giver det 404 på målbyen, fordi slugs er by-specifikke. Eksempel: `slagelselokalt.localhost:3000/nyheder/karrebaeksminde-klaer-paa-...` giver 404, ligesom `/omraade/karrebaeksminde` og `/forfatter/rasmus-krogh`. Kun fælles sektioner (`/nyheder/politik`, `/kultur/musik`) findes på tværs.
- Fix: gør switcheren til almindelige absolutte links til målbyens domæne (`https://${s.domaene}/`, i dev `http://${sub}.localhost:3000/`), altid til forsiden eller en fælles sektion. Fjern cookie/redirect-mekanismen, eller begræns den til dev. Se også F6 (åben redirect).

**F3. Forsiden hardcoder Slagelse-demoindhold med 8 døde links i alle 6 byer**
- Evidens: `app/(site)/page.tsx` indeholder faste links og tekster (linjerne ca. 292-487 og fallback `wireListItems`). Alle 8 giver 404 i **alle** byer (også Slagelse, hvor slugs ikke findes):
  - `/politik/nyt-flertal-byraadet-investerer-45-millioner-bymidten`
  - `/bolig/flere-sommerhuse-udsat-for-indbrud-skaelskoer-naes`
  - `/erhverv/ny-butikskaede-aabner-slagelse-foraar` (findes to steder på siden)
  - `/sport/det-sker-i-slagelse-5-oplevelser-weekenden`
  - `/natur/kommunen-vil-genskabe-vaadomraader-langs-tude-aa`
  - `/debat/laeserbrev-slagelse-har-brug-for-ny-plan`
  - `/erhverv/nyt-samarbejde-lokale-virksomheder-og-erhvervsskole`
  - `/kultur/unge-stifter-groen-genbrugside-slagelse`
  Sektionerne `/politik`, `/bolig` og `/natur` findes slet ikke (de har ingen kategori).
- Samtidig vises Slagelse-teksterne på forsiden i Næstved, Holbæk, Køge, Roskilde og Ringsted ("Ny butikskæde åbner i Slagelse til foråret" i Seneste nyt, "Korsør Bylaug", "Skælskør Næs", "Tude Å" m.fl.). Hero-fallback har `/trafik/koedannelse-storebaeltsbroen-fyn` og byline "Jonas Vestergaard" (Slagelse-forfatter), som bliver synlige, hvis `tophistorie` mangler.
- Fix: fjern de faste blokke, eller drive dem fra databasen pr. instans. Skjul en blok, når der ikke er data, i stedet for at falde tilbage til demo. Se også F5.

### P1

**F4. `/trafik/live` 404 (LIVE-pillen i hero)**
- Evidens: `app/(site)/page.tsx:175` (`<Link href="/trafik/live" className="site-hero-live-pill">`). Hentet: 404. Vises på forsiden i alle byer.
- Fix: byg siden, eller fjern pillen, eller peg på `/nyheder/trafik` (findes, 200).

**F5. Hardcodet Slagelse-indhold på `/kalender`, `/opslagstavle` og `/om-mediet` i alle byer**
- Evidens: `app/(site)/kalender/page.tsx` og `opslagstavle/page.tsx` har indlejrede arrays (Korsør Havneplads, Slagelse Musikhus, "Lokaldysten Slagelse B&I vs. Ringsted IF" m.fl.). Det vises uændret i Næstved, Holbæk, Køge, Roskilde og Ringsted (9 til 12 sider pr. by inkl. filtervarianter). `om-mediet/page.tsx:68` hardcoder "Slagelse, Korsør, Skælskør og omegn" som dækningsområde: Næstved viser "Dækningsområde Næstved Kommune Slagelse, Korsør, Skælskør og omegn", og Holbæk viser det samme.
- Også i indhold: Næstved-artiklen `/nyheder/overblik-det-besluttede-naestved-byraad-om-skolebudgettet` indeholder teksten "Slagelse Byråd i samling på rådhuset." (billedtekst).
- Fix: hent fra DB pr. instans (events/opslag/`Instance.kommune`), vis tom-tilstand med CTA "Indsend arrangement" i stedet for demo.

**F6. `/api/site/switch` er en åben redirect**
- Evidens: `curl -si "…/api/site/switch?site=holbaeklokalt.dk&redirect=https://evil.com"` giver `location: https://evil.com/`. Sætter desuden cookie ved gyldigt `site`. (Overlap med T5; her kun evidens.)

**F7. Nyhedsbrev-formularen på forsiden poster til `/api/newsletter/subscribe`, som ikke findes**
- Evidens: `app/(site)/page.tsx:263` (form `action="/api/newsletter/subscribe" method="POST"`). `POST` giver 404 (`app/api/` har kun ads, articles, auth, chat, honorar, metrics, nyhedsbrev/export, site). Tilmelding fra forsiden mister signups (og viser 404). `/nyhedsbrev` har en egen formular (200).
- Fix: peg formularen på den eksisterende server action/side, eller opret endpointet.

**F8. `/partner/{token}` omdirigeres til login af `proxy.ts`**
- Evidens: `proxy.ts` matcher `["/redaktion/:path*", "/partner/:path*"]`. `GET /partner/test` og `/partner/abc123` giver 307 til `/login?callbackUrl=%2Fpartner%2F…`. Anonyme sponsorer med token-link kan ikke åbne deres side (`app/(site)/partner/[token]/page.tsx` er token-baseret). Sammenlign: `/qa/test`, `/interview/test` og `/meddeler/test` er korrekt offentlige (200).
- Fix: fjern `/partner/:path*` fra matcheren.

**F9. Slagelse-artikel med ikke-ASCII-slug giver 404, men står i sitemap, feeds og 36 sidelinks**
- Evidens: `/nyheder/døgnrapport-overblik-over-nattens-haendelser-i-sydvestsjaelland` (seed: `prisma/seed.ts:865`, rå "ø"). Hentet både rå og URL-kodet (`d%C3%B8gnrapport…`) giver 404. Linket findes på 36 Slagelse-sider (bl.a. forsiden), i `/sitemap.xml`, `/feed.xml`, `/rss.xml` og `/nyheder/rss.xml`. Sandsynlig årsag: dynamiske route-params leveres URL-kodet og slås op uden decode. Alle andre slugs er ASCII-translittereret (`oe`, `ae`, `aa`).
- Fix: slugify i seed og i CMS (ø til oe osv.), og decode `params.slug` ved opslag. Tilføj test.

**F10. `/api/articles` lækker artikler på tværs af byer**
- Evidens: `GET /api/articles` på `naestvedlokalt.localhost` og `slagelselokalt.localhost` returnerer **den samme liste** på 20 artikler fra Roskilde, Ringsted, Holbæk, Køge og Næstved m.fl. (`roskilde-festival-donerer-15-millioner…`, `herfoelge-boldklub…`). Den enkelte slug-endpoint er korrekt isoleret (404 på fremmed slug). Hentes uden login. (Overlap med T5.)

### P2

**F11. 404-siden: SSR-HTML er tom, og dybe stier får standard-404**
- Evidens: `/findes-ikke`, `/nyheder/findes-ikke`, `/omraade/test`, `/forfatter/test` og `/emne/test` giver status 404, men det server-renderede `<body>` indeholder kun et tomt `<div hidden>` og en `<template data-next-error-…>`. Den designede side (`app/(site)/not-found.tsx`: "Siden blev desværre ikke fundet" med sektionsknapper) findes kun i RSC-payloaden. Uden JS, og for crawlere/preview, er det en blank side uden links (dead end). Det kan være dev-adfærd, så **verificér i `next build && next start`**. `/a/b/c` (3 segmenter) giver Next-standard "404: This page could not be found. Lysdals CMS" uden navigation.
- Fix: tilføj `app/not-found.tsx` (root) med brandet 404 og links, og test i produktions-build.

**F12. Filter-links der ikke gør noget (duplikeret indhold)**
- Evidens: 11 links fra forsiden/TopicFilterBar (`/nyheder?emne=nabolag|sundhed|skole|trafik|krimi|bolig|natur|politik`) og BottomTabs (`/nyheder?filter=mest-laest|lige-nu|analyse`) giver 200, men **identisk indhold** som `/nyheder` (samme HTML-hash; `[sektion]/page.tsx` læser kun `omraade` og `side`). Det samme gælder `?filter=trafik`, `?omraade=` på sektioner og `?side=2`. Forsidens områdevælger (`<form action="/" method="GET">` med `<select name="omraade">`, ingen submit-knap) ændrer ikke siden (`/?omraade=fensmark` er identisk med `/`).
- Fix: implementér filtrene (eller mapp til `/nyheder/<undersektion>` og `/omraade/<slug>`), og tilføj `canonical` til parametersider eller fjern linkene.

**F13. `/annoncer` og `/priser` er identiske sider**
- Evidens: `app/(site)/annoncer/page.tsx` er `export { default, generateMetadata } from "../priser/page"`. Begge giver 200 med identisk tekst (ratio 1,0), samme `<title>`, ingen canonical. Kun `/priser` linkes (footer, 98 sider). `/annoncer` har 0 indgående links, og ingen af dem er i sitemap.
- Fix: gør `/annoncer` til 308 til `/priser` (eller omvendt) og tilføj canonical og sitemap-post.

**F14. Forældreløse sider (kun nåbare via seed, mobilark eller direkte URL)**
  | Side | Indgående links (SSR) | Bemærkning |
  |---|---|---|
  | `/sponsor` | 0 | Kun i `SectionSheet` (mobil "Mere"), ingen desktop-vej. Ikke i sitemap |
  | `/qa`, `/interview` | 0 | Samme (kun i `SectionSheet`) |
  | `/annoncer` | 0 | Se F13 |
  | `/velkommen` | 0 | Onboarding, aldrig linket |
  | `/emne/*` | 0 | Ingen emnesider linkes: de 10 artikler har ingen tags i seed. `[slug]/page.tsx:629` kan generere `/emne/<slug>`. Ingen `/emne`-indeks. Ikke i sitemap |
  | `/omraade/*` | 1 til 4 pr. område | Kun via artiklens tag-pille. Næstved: `holme-olstrup` og `mogenstrup` har 0 (og 0 artikler: "Der er endnu ingen artikler…"). Pr. by 2 til 3 områder uden links: Holbæk `moerkoev`, `regstrup`, `svinninge`; Køge `algestrup`, `ejby`; Roskilde `gadstrup`, `gundsoemagle`, `vindinge`; Ringsted `sigersted`, `vetterslev`, `vigersted` |
  | `/om-mediet/kontakt` | 2 til 3 | Ikke i footer |
  | Sektionsfeeds | 0 | `/nyheder/rss.xml`, `/sport/feed.xml` m.fl.; ingen `<link rel="alternate">` på nogen side |
  | `/meddeler` | 1 (fra `/profil`) | |
  Der er ingen `/omraade`-indeks (404), og breadcrumb "Områder" på områdesider er ren tekst, ikke link. Områder står ikke i header eller footer på desktop; de findes kun i mobilarket.

**F15. Sitemap er ufuldstændigt og indeholder tynde sider**
- Mangler (200, men ikke i `app/sitemap.ts`): `/kalender`, `/opslagstavle`, `/priser`, `/annoncer`, `/nyhedsbrev`, `/indsend`, `/bliv-en-del-af-journalistikken`, `/sponsor`, `/qa`, `/interview`, `/feed.xml`.
- Indeholder: 17 tomme undersektioner pr. by ("Ingen artikler i denne undersektion endnu", 17 i Næstved/Holbæk/Køge/Ringsted, 18 i Roskilde; Slagelse 0), tomme områder (`holme-olstrup`, `mogenstrup`, m.fl.) og den døde ø-artikel i Slagelse (F9). Alle sitemap-URL'er bruger prod-domænet (`https://<by>lokalt.dk/…`); det er forventet, og locs er sammenlignet med host-stier.
- Fix: udvid sitemap, udelad tomme (noindex) undersektioner/områder.

**F16. Døde absolutte links i byråd-artikler**
- Evidens: Hver by-"overblik"-artikel linker til `https://<by>lokalt.dk/presse` (fx `naestvedlokalt.dk/presse`). Route `/presse` findes ikke (404 lokalt) og ligger ikke i sitemap. Det er et produktionsdomæne-link (forlader host i dev) til en side, der ikke findes.
- Fix: fjern, eller oprettes som pressekontakt-side (`/om-mediet/kontakt`).

### P3

- **F17. `/redaktion` i den offentlige footer og mobilarket** (på 98 sider) fører en læser til CMS-login. `/login` er en dead end (ingen link tilbage til sitet) og viser "Demooplysninger og lokal opsætning findes i README". Fix: fjern fra offentlig navigation, og tilføj "Tilbage til forsiden" og skjul demotekst.
- **F18. Midlertidige redirects i primær navigation**: `/tip-os` til `/indsend?kategori=tip` (307) og `/stoet` til `/bliv-stoette` (307) linkes direkte fra forsiden (og `/stoet` fra `/bliv-stoette`-konteksten). Brug destinationen direkte. `/indsend?kategori=…` giver samme HTML som `/indsend` (ingen forudvalg uden JS).
- **F19. Ingen RSS-autodiscovery** (`<link rel="alternate" type="application/rss+xml">` mangler på alle sider). Feeds er ellers gyldige (30/10/3 items, locs er domæne-absolutte, alle 200, undtagen ø-artiklen). Kun footerlinket `/feed.xml`.
- **F20. Søgning folder ikke diakritik**: `/soeg?q=byraad` giver "Ingen resultater", mens `?q=byråd` giver 2. Fix: normalisér `æ/ø/å` og `ae/oe/aa`.
- **F21. Canonical mangler på alle ikke-artikel-sider** (kun artikler har canonical, og de peger på prod-domænet, som forventet). Parametervarianter (`?emne`, `?filter`, `?kategori`, `?spor`, `?side`) har ingen canonical.
- **F22. Eksterne links (ikke hentet)**: Slagelse-forsiden linker til `https://harboe.com/fond` (rigtigt brandnavn, jf. T6), og artikler linker til kommunernes dagsorden-sider (`naestved.dk/…/2026-09-29`, `slagelse.dk/…`, `holbaek.dk/…`, `koege.dk/…`, `roskilde.dk/…`, `ringsted.dk/…`) samt `udbud.dk` og `dmi.dk`. Deep-links er opdigtede dato-stier i demoindhold og skal valideres før lancering.

## 3. Dead links (alle med side hvor de findes)

Næstved (samme mønster i alle byer; Slagelse har desuden F9):

| Død URL (status) | Fundet på | Antal sider |
|---|---|---|
| `/om-mediet/privatliv` (404) | alle sider (footer), `/nyhedsbrev` | 98 til 112 |
| `/trafik/live` (404) | `/` (hero) | 1 |
| `/api/newsletter/subscribe` (POST 404) | `/` (formular) | 1 |
| `/politik/nyt-flertal-byraadet-investerer-45-millioner-bymidten` (404) | `/` | 1 |
| `/bolig/flere-sommerhuse-udsat-for-indbrud-skaelskoer-naes` (404) | `/` | 1 |
| `/erhverv/ny-butikskaede-aabner-slagelse-foraar` (404) | `/` (to steder) | 1 |
| `/erhverv/nyt-samarbejde-lokale-virksomheder-og-erhvervsskole` (404) | `/` | 1 |
| `/sport/det-sker-i-slagelse-5-oplevelser-weekenden` (404) | `/` | 1 |
| `/natur/kommunen-vil-genskabe-vaadomraader-langs-tude-aa` (404) | `/` | 1 |
| `/debat/laeserbrev-slagelse-har-brug-for-ny-plan` (404) | `/` | 1 |
| `/kultur/unge-stifter-groen-genbrugside-slagelse` (404) | `/` | 1 |
| `https://naestvedlokalt.dk/presse` (404, prod-domæne) | `/nyheder/overblik-det-besluttede-naestved-byraad-om-skolebudgettet` | 1 |
| `/api/site/switch?…` (redirect til `localhost:3000`, forkert by) | alle sider | 5 pr. side |
| `/partner/{token}` (307 til `/login`) | direkte URL, ingen intern link | – |
| `/emne/{slug}` (404 for alle testede, ingen tags i seed) | ingen | – |

Ikke fundet i mine crawl, men mistænkt i kode: `/artikel/${slug}` (`MeddelerDashboardClient.tsx:795`) bag login, og `/redaktion/emner/administrer`. Disse ligger bag `/redaktion` (login-krav) og er ikke crawlet; markér som "ikke verificeret".

Slagelse-specifikt: `/nyheder/døgnrapport-overblik-over-nattens-haendelser-i-sydvestsjaelland` (404; 36 sider, sitemap, 4 feeds).

## 4. Ruter (Næstved), status og indgående links

"Linked-from" = antal distinkte sider i link-crawlet, der peger på ruten (SSR-HTML, `a[href]`). Klient-renderede mobilark er ikke talt med.

| Route | Status | Linked-from |
|---|---|---|
| `/` | 200 | 98 |
| `/nyheder`, `/erhverv`, `/sport`, `/kultur`, `/foreningsliv`, `/debat` | 200 | 98 hver |
| `/<sektion>/<undersektion>` (17 stk.; 5 til 7 under hver sektion, 19 til 20 for `nyheder/*`) | 200 (alle tomme på nær 3 "mest læst"-links) | 4 til 20 |
| Artikler `/<sektion>/<slug>` (10 stk.) | 200 | 7 til 25 |
| `/omraade/{naestved-by, karrebaeksminde, fensmark, fuglebjerg, glumsoe, tappernoeje}` | 200 | 1 til 4 |
| `/omraade/{holme-olstrup, mogenstrup}` | 200 (ingen artikler) | 0 |
| `/omraade` (indeks) | 404 | 0 |
| `/forfatter/{camilla-schroeder, morten-kaas, rasmus-krogh}` | 200 | 4 til 5 |
| `/forfatter` (indeks) | 404 | 0 |
| `/emne/*`, `/emne` | 404 | 0 |
| `/soeg` | 200 | 98 |
| `/kalender` | 200 (hardcodet Slagelse) | 98 |
| `/opslagstavle` | 200 (hardcodet Slagelse) | 7 |
| `/priser` | 200 | 98 |
| `/annoncer` | 200 (dublet af `/priser`) | 0 |
| `/sponsor` | 200 | 0 |
| `/bliv-stoette` | 200 | 98 |
| `/bliv-en-del-af-journalistikken` | 200 | 98 |
| `/indsend` | 200 | 98 |
| `/nyhedsbrev` | 200 | 98 |
| `/gemte`, `/profil` | 200 | 98 |
| `/qa`, `/interview` | 200 | 0 |
| `/qa/{token}`, `/interview/{token}`, `/meddeler/{token}` (ugyldigt token) | 200 med "ikke fundet"-tekst og `noindex` (soft-404, bevidst) | 0 |
| `/meddeler` | 200 | 1 |
| `/partner/{token}` | 307 til `/login` (F8) | 0 |
| `/velkommen` | 200 | 0 |
| `/om-mediet`, `/om-mediet/redaktionelle-principper`, `/om-mediet/rettelser` | 200 | 98 hver |
| `/om-mediet/kontakt` | 200 | 2 til 3 |
| `/om-mediet/privatliv` | 404 | 98 |
| `/stoet` | 307 til `/bliv-stoette` | 1 |
| `/tip-os` | 307 til `/indsend?kategori=tip` | 1 |
| `/priser/` | 308 til `/priser` | 0 |
| `/redaktion` | 307 til `/login?callbackUrl=%2Fredaktion` | 98 |
| `/login` | 200 | 1 |
| `/feed.xml` | 200 (RSS 2.0, 10 items) | 98 |
| `/rss.xml` | 200 | 0 |
| `/<sektion>/rss.xml` og `/<sektion>/feed.xml` | 200 | 0 |
| `/<sektion>/<undersektion>/rss.xml` | 404 | 0 |
| `/sitemap.xml`, `/robots.txt` | 200 | 0 |
| `/api/articles` | 200 JSON (lækker alle byer) | 0 |
| `/api/newsletter/subscribe` | 404 | 1 |
| `/api/site/switch?...` | 307 (F2, F6) | 5 pr. side |
| `/trafik/live` | 404 | 1 |
| `/artikel/{slug}` | 404 | 0 |

## 5. Klik-stier: hvad virker og hvad mangler (Næstved)

Virker i SSR-HTML (verificeret):
- Forside til sektioner via header, footer og sektionsblokke; sektion til underkategorier (pillerne); sektion til artikler.
- Artikel til: brødkrumme (Forside, sektion, undersektion), undersektion, **forfatter** (`/forfatter/<slug>`), **område** (`/omraade/<slug>` som tag-pille), **relaterede** ("Læs også", "Relaterede historier"; 1 til 2 sidelinks) og nyhedsbrev/støt/indsend.
- Forfatterside til forfatterens artikler. Områdeside til områdets artikler.

Mangler eller er brudt:
1. **Forside til område**: ingen. Områdevælgeren (select) er virkningsløs (F12). Alle 8 områder kan kun nås via en artikels tag eller mobilarket.
2. **Artikel til emne**: ingen emnelinks (ingen tags i seed), `/emne/*` er forældreløse. De 8 "Emner"-filtre og de 3 forside-tabs fører til samme side (F12).
3. **Artikel til sektion** findes kun via brødkrumme/header; forfattersiden har kun "Redaktionen" (til `/om-mediet`) som brødkrumme og ingen links til forfatterens sektioner.
4. **Dead ends** (ingen vej videre ud over standard header/footer): 404-siden i SSR (F11), `/login`, de 17 tomme undersektioner pr. by (kun "mest læst"), de tomme områder, `/velkommen` ("Gå til forsiden" findes).
5. **Duplikater**: `/annoncer` = `/priser` (F13), 11 filter-URL'er = `/nyheder` (F12).
6. **Desktop-orphans**: `/sponsor`, `/qa`, `/interview`, områder: kun via mobilens "Mere"/"Emner"-ark. Der er intet tilsvarende i desktop-header/footer.
7. **Forsiden til /priser/sponsor**: priser findes i footer; `/sponsor` linkes fra intet på desktop.

## 6. By-lækage og by-switcher på de øvrige 5 byer

Datalaget er isoleret pr. by (host til `Instance`): ingen Slagelse-artikler, -områder eller -forfattere i Næstved, Holbæk, Køge, Roskilde eller Ringsted, og fremmede slugs giver 404. Søgning på "Slagelse" giver 0 hits i Næstved. Men:

| By | Sider med fremmed-by-tekst (uden switcher) | Kilder |
|---|---|---|
| Næstved | 11 (forside, `/kalender` (+4 filtre), `/opslagstavle` (+4 filtre), `/om-mediet`, 1 artikel) | F3, F5, "Slagelse Byråd"-billedtekst |
| Holbæk | 11 | F3, F5 |
| Køge | 11 (+ 1 artikel) | F3, F5 |
| Roskilde | 12 | F3, F5 |
| Ringsted | 12 | F3, F5 |
| Slagelse | 4 ("Ringsted IF" i kalenderen, legitimt) | – |

Ord, der lækker: Slagelse, Korsør, Skælskør, Tude Å, Ringsted (i kalender). `/api/articles` lækker data (F10).

By-switcher (alle 6 hosts): se F2 (fungerer ikke).

Indholdsmængde: Slagelse 46 artikler og 0 tomme undersektioner; de 5 øvrige har kun 10 artikler hver og 17 til 18 tomme undersektioner, så sektionssiderne er tynde.

## 7. Bliver besøgende på den aktuelle by-host?

- Alle interne links er relative (verificeret på ca. 680 HTML-sider), og alle redirects (`/tip-os`, `/stoet`, `/priser/`, `/redaktion`) bliver på samme host. 
- **Undtagelser**: (1) by-switcheren (F2), som sender besøgende til `localhost:3000` (forkert host/by) i dev og er et no-op i produktion; (2) `https://<by>lokalt.dk/presse` i byråds-overblik-artikler (produktionsdomæne, F16); (3) planlagte eksterne links (kommuner, DMI, udbud.dk, `harboe.com`).
- Canonical, OG, JSON-LD og sitemap bruger bevidst prod-domænet (`https://<by>lokalt.dk`), hvilket er korrekt, men bemærk at `localhost`-crawl derfor aldrig "validerer" sitemap-URL'er direkte; jeg har sammenlignet stier.

## 8. Anbefalet rækkefølge

1. F1, F3, F4, F7, F8 (rene fejlrettelser, hver 15 til 60 min).
2. F2 + F6 (switcher som almindelige domænelinks; fjern åben redirect).
3. F5, F9, F10 (by-isolering og slugs).
4. F11 til F16 (navigation, sitemap, tynde sider, dubletter).
5. F17 til F22 (hygiejne).

## 9. Opsummering

Antal fund: 3 P0, 7 P1, 6 P2 og 6 P3. Næstved-crawlet fandt 99 sider med 200, 11 med 404 og 3 redirects. De alvorligste fejl er et dødt privatlivslink på alle sider, en by-switcher uden effekt og en forside med Slagelse-demoindhold og 8 døde links i alle 6 byer. Plus: 404-sidens SSR-HTML er tom (verificér i prod-build), og `/api/articles` lækker på tværs af byer. Strukturelt er sitet godt forbundet (brødkrumme, forfatter, område, relateret virker), men emner, områder, `/sponsor`, `/qa` og `/interview` er isolerede øer.
