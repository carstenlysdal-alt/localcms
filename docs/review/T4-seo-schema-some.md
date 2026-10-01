<!-- Baseline: localcms HEAD fc7c5d7 (arbejdsmappen ren, kun docs/ og .claude/launch.json utrackede). Review udført 2026-10-01 mod kørende dev-server (naestvedlokalt.localhost:3000 m.fl.) + kodelæsning. Ingen kildefiler ændret. -->
# T4 – SEO, schema.org, social deling, Google-synlighed og AI-søgning

Skills anvendt: `seo`/`seo-audit`, `schema` + `searchfit-seo:schema-markup`, `searchfit-seo:technical-seo`, `searchfit-seo:on-page-seo`, `ai-seo`, `social`, `core-web-vitals`.

## 0. Metode og begrænsninger

- Alle sider er hentet med `curl`/Python med både almindelig browser-UA, `Googlebot`-UA og `facebookexternalhit`-UA. `<head>`-metadata ligger i `<head>` for alle tre (ingen streamet metadata i `<body>`), og JSON-LD er server-renderet, så det er synligt for crawlere uden JS.
- JSON-LD er udtrukket med script og tjekket mod schema.org + Googles krav til rich results (Article, BreadcrumbList, Organization). Rich Results Test/validator.schema.org er ikke kørt (intet netværk) – tjek derfor de endelige shapes i §7 manuelt i Rich Results Test før lancering.
- Dev-serveren mapper `*.localhost` til `*.dk` (`lib/site.ts:71-74`), så alle canonical/sitemap/OG-URL'er viser produktionsdomænerne (fx `https://naestvedlokalt.dk/...`), som endnu ikke resolver. Det er bevidst og ikke et fund.
- Dev-server: Core Web Vitals er ikke målt (dev-bundle, ingen CDN). §6 er statisk risikovurdering, ikke labdata. Browser-panelet er ikke brugt.
- Crawl: 88 URL'er for Næstved (alle 61 URL'er i `sitemap.xml` + 27 ekstra), ~100 for Slagelse, samt robots/sitemap/feeds for alle 6 byer. Rå data: `scratchpad/crawl_naestvedlokalt.json`, `crawl_slagelselokalt.json`.
- Det statiske prototype-site `nyhedssite.html` er kun gennemgået kort (§8) – det er en enkeltside med hash-navigation og kan i sagens natur ikke SEO-optimeres per URL.

## 1. Scorecard pr. sidetype

Skala 0–10 (10 = klar til Google News/Discover, korrekt delingskort, AI-citérbar). "Google" = indeksering, titler, canonical, schema, eligibility for Top Stories/Discover. "SoMe" = Facebook/Instagram/LinkedIn/X/WhatsApp-preview. "AI" = AI Overviews, ChatGPT, Perplexity, Claude.

| Sidetype | Eksempel-URL | Google | SoMe | AI | Hovedårsag |
|---|---|:-:|:-:|:-:|---|
| Forside | `/` | 3 | 1 | 3 | Ingen canonical, ingen OG/Twitter, ingen Organization/WebSite-schema; hårdkodede Slagelse-blokke med 404-links på alle byer |
| Sektion | `/nyheder` | 3 | 1 | 2 | Ingen canonical/OG/schema; `?side=`/`?omraade=` uden canonical; "Vis flere" er en `<button>` (ikke crawlbart link) |
| Undersektion | `/nyheder/politik` | 3 | 1 | 2 | Generiske beskrivelser ("Nyheder om leder i Næstved"), BreadcrumbList med relative URL'er |
| Artikel | `/nyheder/<slug>` | 5 | 3 | 5 | NewsArticle + OG + canonical findes, men billede er SVG/relativt, publisher uden logo, canonical følger URL-stien, titler for lange |
| Område | `/omraade/fensmark` | 3 | 1 | 2 | Intet Place/CollectionPage-schema trods lat/lng i databasen; ingen canonical/OG |
| Emne | `/emne/baeredygtighed` | 2 | 1 | 1 | Ikke i sitemap, ikke linket fra forside; titel "Emne: #X"; ingen canonical/OG |
| Forfatter | `/forfatter/morten-kaas` | 3 | 1 | 3 | Ingen ProfilePage/Person-schema; E-E-A-T-data (bio, rolle) findes men er ikke maskinlæsbar |
| Om mediet (+principper, rettelser, kontakt) | `/om-mediet` | 4 | 1 | 4 | Gode tillids-sider findes, men ingen Organization-schema; kontaktdata uden adresse/CVR/telefon; "Slagelse, Korsør…" står på Næstved-siden |
| Priser | `/priser` | 2 | 1 | 4 | Dublet `/annoncer` uden canonical, ikke i sitemap, ingen Offer/pricing-markup; prisdata er dog klar tekst |
| Kalender | `/kalender` | 1 | 1 | 1 | Hårdkodede demo-events fra Slagelse/Korsør på alle byer, "I dag" som tekst-dato, intet Event-schema, ikke i sitemap |
| Opslagstavle | `/opslagstavle` | 1 | 1 | 1 | Hårdkodet demoindhold (Korsør m.fl.), ikke i sitemap |
| Søg | `/soeg?q=…` | 2 | – | – | Indekserbar intern søgning uden `noindex`, står i sitemap |

Samlet: **Google 3/10, SoMe 1–2/10, AI 3/10.** Fundamentet er bedre end mange nyhedssites (server-renderet, `lang="da"`, én H1 pr. side, NewsArticle+BreadcrumbList, RSS, tillids-sider, 404-status korrekt), men *entiteten* (Organization/logo/sameAs), billederne og canonical-arkitekturen mangler, og det er netop dem Google News, Discover og Facebook-distribution hviler på.

## 2. Fund rangeret P0–P3

### P0 – skal rettes før offentlig lancering / Facebook-distribution sælges

**P0-1. Alle delings- og schema-billeder er SVG og (i JSON-LD) relative URL'er – ingen billede-preview på Facebook/LinkedIn/X, ingen billede i Top Stories/Discover**
- Evidens (live): `og:image = https://naestvedlokalt.dk/media/byraad.svg`, `twitter:image` identisk; JSON-LD `"image":["/media/byraad.svg"]`. 10/10 Næstved-artikler og 46/46 Slagelse-artikler peger på `.svg` (`/media/{byraad,havn,sport,…}.svg`); alle 10 `Media`-rækker i `dev.db` er `.svg`, uden `mimeType`/`bredde`/`hoejde`.
- Kode: `app/(site)/[sektion]/[slug]/page.tsx:65` (`images: [{ url: article.coverMedia.url }]` – ingen absolut URL, ingen dimensioner, ingen alt), `:365` (`image: [article.coverMedia.url]`).
- Facebook, LinkedIn, X og WhatsApp understøtter ikke SVG som delingsbillede; Google understøtter ikke SVG til Article-image. Pricing-siden lover "fuld distribution på Facebook" (`priser/page.tsx:87,113`) – uden billede får hvert delt opslag en tom linkboks og markant lavere klikrate. Google Discover kræver et billede ≥1200 px bredt.
- Der findes intet 1200×630-derivat, intet by-fallbackbillede og ingen forside/sektion-OG (`optimizeImage` i `lib/media-storage.ts` laver kun én WebP ≤2400 px).
- Fix: se §7.1/§7.6 (sharp-derivat 1200×630 ved upload, absolutte URL'er, by-fallback `/og/<by>.jpg`, `og:image:width/height/alt`).

**P0-2. `</script>`-breakout i al JSON-LD (stored XSS + ødelagt schema)**
- `JSON.stringify(...)` sættes direkte i `<script type="application/ld+json">` uden escaping af `<`: `page.tsx:383` (NewsArticle) og `components/site/Breadcrumbs.tsx:32` (BreadcrumbList – kører på 68 sider og indeholder artikeltitel). Bevist: `JSON.stringify({headline:"x </script><script>alert(1)</script>"})` giver rå `</script>` i output.
- Titler/forfatternavne/områdenavne kommer fra redaktører og (planlagt, T7) fra agent-indtag; én titel med `</script>` ødelægger siden og kan eksekvere JS for alle læsere.
- Fix: fælles `<JsonLd data={…}/>` der gør `.replace(/</g,"\\u003c")` (og U+2028/2029). Se §7.2. (Overlapper T5; markeret her fordi det også gør schema ugyldigt.)

**P0-3. Canonical-arkitekturen er ødelagt: artikler har "selv-canonical" på vilkårlig sti, og alle andre sidetyper har slet ingen canonical**
- `getArticleBySlug(site.id, sektion, slug)` ignorerer `sektion` (`lib/site-queries.ts:545-562`) og canonical bygges af URL-parametrene (`page.tsx:68`). Live-test: `/sport/<slug>`, `/foo/<slug>`, `/NYHEDER/<slug>` returnerer alle **200** med `canonical = https://…/foo/<slug>` – uendeligt mange indekserbare dubletter, hver med "korrekt" selv-canonical. Kun `?utm=…`/`?omraade=` håndteres rigtigt (canonical uden query).
- 68 af 88 sider (forside, alle sektioner/undersektioner, område, emne, forfatter, alle statiske sider) har **ingen** `<link rel="canonical">` og ingen `alternates` (kun artikler har). `?omraade=fensmark` på forsiden og `?side=2` på sektioner giver samme titel/beskrivelse uden canonical.
- `www.naestvedlokalt.dk` returnerer 200 (ingen redirect; kun `lib/site.ts:62` fjerner `www.` internt). Ukendt host (fx `kalundborglokalt.localhost`, `evil.example`) leverer **Slagelse-indhold** (`lib/site.ts:80-85` fallback), og `x-site`-headeren fra klienten vælger tenant (`lib/site.ts:48`) – kan forgifte CDN-cache med forkert by.
- Fix: (a) redirect 308 til korrekt `/{sektion}/{slug}` hvis sti ≠ artiklens egen sti, 404 ved ukendt sektion; (b) `alternates.canonical` på alle sider via fælles helper (inkl. `?side=N` → selv-canonical pr. side, øvrige filter-params strippet); (c) 301 `www`→apex i edge/Next-config; (d) ukendt host → 404, og ignorér `x-site` i produktion.

### P1 – skal på plads for Google News/Top Stories/Discover og pæne delinger

**P1-1. Forsiden har hverken schema, canonical eller OG/Twitter; ingen Organization/NewsMediaOrganization eller WebSite**
- Evidens: `/` returnerer `ld=[]`, `og=0`, `tw=0`, `canon=-`. Publisher findes kun indlejret i hver artikel (`page.tsx:349-355`) uden `logo`, `sameAs`, `@id`, `correctionsPolicy`, `ethicsPolicy`, `masthead`, `ownershipFundingInfo`. `Instance.logoUrl` findes i schema men er tom for alle 6 byer og bruges ingen steder. Der er ingen links til Facebook/Instagram/LinkedIn nogen steder i UI'et (grep) – dermed intet at lægge i `sameAs`.
- Konsekvens: ingen entitet til Googles knowledge graph/site name, ingen logo i Top Stories-kort, svagt grundlag for Publisher Center-ansøgning.

**P1-2. NewsArticle-JSON-LD mangler Googles anbefalede felter og afbilder ikke mærkningstyper**
- Findes: `headline` (≤92 tegn, OK), `datePublished/dateModified` (ISO), `author` Person med `url`, `isAccessibleForFree`, `publishingPrinciples`, `correction` (CorrectionComment – korrekt brugt), `contentLocation`.
- Mangler (alle 10/10 artikler): `image` som absolut JPG/PNG/WebP i flere formater, `publisher.logo`, `publisher.@id/sameAs`, `mainEntityOfPage`, `articleSection`, `inLanguage` (feltet `Article.sprog` findes), `keywords` (tags findes), `author.@type` for Brugerindsendt/PR (nu "Organization: <site.navn>" hvis ingen forfatter), `description` fjernes af HTML (manchet kan indeholde HTML – se `normalizeHtml`).
- Mærkning: `indholdstype` (Partner/Sponsoreret/Brugerindsendt/AI-assisteret/PR) og `aiBrug` påvirker slet ikke JSON-LD, meta, sitemap eller feed. Se mapping §7.3. Næstved har 8 mærkede artikler (1 Partner, 1 AI-assisteret, 1 Brugerindsendt) som i dag ser identiske ud for Google som uafhængig journalistik.
- Én ting er korrekt og skal bevares: `correction`-listen på rettede artikler.

**P1-3. BreadcrumbList har relative URL'er (68 sider)**
- `Breadcrumbs.tsx:24` bruger `item: item.href` direkte; alle kaldere sender `"/"`, `"/nyheder"` … Eksempel: `{"position":1,"name":"Forside","item":"/"}`. Google kræver absolut URL i `item` – brødkrumme-rich-resultat bortfalder. Sidste led uden `item` er fint.
- Fix: gør hrefs absolutte med `metadataBase`/`site.domaene` i komponenten (§7.2).
- Bemærk: artikel-breadcrumb ligger i `.site-desktop-only` (`page.tsx:~430`), så mobil har ingen synlig brødkrumme, men schemaet findes alligevel (kosmetisk afvigelse).

**P1-4. OG/Twitter-tags er ufuldstændige selv på artikler**
- Findes: `og:title, og:description, og:image, og:type=article, article:published_time, article:modified_time, twitter:card=summary_large_image, twitter:title/description/image`.
- Mangler: `og:url`, `og:site_name`, `og:locale` (=`da_DK`), `og:image:width/height/alt`, `article:author` (profil-URL), `article:section`, `article:tag`, `twitter:site`/`twitter:creator`, `max-image-preview:large` (Discover-krav), `fb:app_id`/`facebook-domain-verification` (domæneverifikation til Business Manager – relevant når mediet sælger Facebook-distribution). Root `app/layout.tsx:27-30` har stadig `title: "Lysdals CMS"` som fallback.
- Forside, sektioner, område, emne, forfatter og alle statiske sider har **ingen** OG/Twitter (0 af 68 ikke-artikelsider) – et delt link til forsiden/sektion får et tilfældigt eller intet billede.

**P1-5. Del-knapperne er døde**
- `page.tsx:426` og `:520`: `<button aria-label="Del artikel">` uden handler (og "Flere handlinger" ligeså). Ingen `navigator.share`, ingen Facebook/X/LinkedIn/WhatsApp/mail/kopiér-link-intents i hele `app/` og `components/` (kun redaktions-"kopiér link"). Social distribution afhænger derfor af redaktionens manuelle delinger.

**P1-6. Sitemap: forkerte/manglende/falske data og ingen news-sitemap**
- Der findes **ingen** news-sitemap, ingen `/news-sitemap.xml` (404), ingen sitemap-index; alle ruter i én fil (`app/sitemap.ts`), `take: 1000` på artikler (`:109`) afskærer ældre artikler stille.
- `lastModified: new Date()` på alle ikke-artikelruter (`sitemap.ts:13-90`) → lastmod = "nu" ved hvert request; Google lærer at ignorere feltet for hele sitet. `changefreq`/`priority` ignoreres af Google (harmløst).
- **404-URL i sitemap (live, Slagelse):** artikel med slug `døgnrapport-overblik-over-nattens-haendelser-i-sydvestsjaelland` står i sitemap og feed med rå `ø`, men `GET /nyheder/d%C3%B8gnrapport-…` giver **404** (opslag med percent-kodet param; `slug` genereres altså med ikke-ASCII, mens routeren sandsynligvis ikke decoder). 1 af 53 Slagelse-slugs er ikke ren `[a-z0-9-]`. Fix: slugify til ASCII (æ→ae, ø→oe, å→aa) + `decodeURIComponent` i opslag + redirect.
- Mangler i sitemap: `/kalender`, `/opslagstavle`, `/priser`, `/nyhedsbrev`, `/indsend`, `/sponsor`, `/bliv-en-del-af-journalistikken`, alle `/emne/*`. Står i sitemap men bør ikke: `/soeg` (intern søgning).
- Per-by korrekthed er OK: hver by udleverer eget sitemap med egen host (6/6, Slagelse 99 URL'er, øvrige 60–61) og robots.txt peger på egen sitemap. Valideret XML.

**P1-7. Hårdkodet Slagelse-demoindhold og døde interne links på alle byer**
- `app/(site)/page.tsx:63-80,307-362,396-407,460-478`: forsiden indeholder hårdkodede Slagelse-blokke ("Slagelse bymidte gågade", "Skælskør Næs", `slagelse_*.jpg`) og 7 hårdkodede `href`'er, der giver **404** på Næstved (`/bolig/flere-sommerhuse-…`, `/politik/nyt-flertal-…`, `/erhverv/ny-butikskaede-aabner-slagelse-foraar`, `/sport/det-sker-i-slagelse-5-oplevelser-weekenden` m.fl.). Footer linker til `/om-mediet/privatliv` (404, `SiteFooter.tsx:96`) og forsiden til `/trafik/live` (404).
- `kalender/page.tsx:34-120` og `opslagstavle/page.tsx:35-…`: statiske arrays med events/opslag fra Korsør/Slagelse, datoer som tekst ("I dag", "30. SEP"), ingen DB. Vises uændret på alle 6 byer (Næstved-kalenderen viser "Korsør Havneplads"). Forkert by-indhold + døde links + gentagne sider på 6 domæner er et kvalitetssignal Google straffer sitewide, og kalenderen kan ikke give gyldigt Event-schema.
- Anbefaling indtil rigtig data: `noindex` på `/kalender` og `/opslagstavle`, og fjern hårdkodede forside-blokke.
- `om-mediet/page.tsx:68`: "Slagelse, Korsør, Skælskør og omegn" som dækningsområde på Næstved-siden. Artikel-cover-alt i Næstved: "Slagelse Byråd i samling på rådhuset" (seed). Redaktionelt, men det er også SEO/AI-troværdighed.

**P1-8. Pagination/filtre er ikke crawlbare og uden canonical**
- `components/site/LoadMore.tsx:24-28`: "Vis flere artikler" er `<button onClick=router.push("?side=N")>` – ingen `<a href>`, ingen `rel=next/prev`. Googlebot klikker ikke, så artikler ud over første side pr. sektion/område/forfatter/emne findes kun via sitemap (kun 1000 stk).
- `?side=2`, `?omraade=…`, `?filter=…`, `?kategori=…` giver samme `<title>` og ingen canonical.
- Fix: gør paginering til rigtige links (`<Link href="?side=2">`), selv-canonical pr. side, `?omraade=` canonical til basen.

**P1-9. Private/ikke-søgbare sider er indekserbare**
- Ingen `robots`-meta på `/soeg`, `/gemte`, `/profil`, `/velkommen`, `/indsend`, `/nyhedsbrev`, `/qa`, `/interview`, `/meddeler`. Kun token-siderne (`/qa/[token]`, `/interview/[token]`, `/meddeler/[token]`, `/partner/[token]`) har `noindex` (korrekt). `/soeg?q=…` (intern søgning) bør være `noindex,follow` og ud af sitemap.
- `/gemte` har ingen H1 (0).

**P1-10. Søsterby-links går via `/api/site/switch` (cookie) – virker ikke på produktion og er blokeret for crawlere**
- `SiteHeader.tsx:89`, `SiteFooter.tsx:115`. Routen sætter kun en `site`-cookie; `getCurrentSite` læser kun cookien når host er `localhost`/`127.0.0.1` (`lib/site.ts:65-67`). På rigtige domæner redirecter linket til samme domæne uden effekt. `robots.txt` disallower desuden `/api/`. Resultat: ingen interne links mellem de 6 domæner (ingen link equity, ingen brugerrute). Brug absolutte `https://<domæne>/` links (evt. `rel="noopener"`; ikke `nofollow`).

**P1-11. RSS-feeds: ingen autodiscovery, ugyldigt `<author>`, CDATA-breakout**
- Der findes feeds (`/feed.xml`, `/rss.xml`, `/<sektion>/feed.xml`; valideret well-formed for alle 6 byer), men ingen `<link rel="alternate" type="application/rss+xml">` i `<head>` på nogen side (kun et "RSS"-link i footer). Undersektioner (`/nyheder/politik/feed.xml`) giver 404.
- `<author>` skal være en e-mail (RSS 2.0); der skrives et navn (`feed.xml/route.ts:30`, `[sektion]/feed.xml/route.ts:48`) → fejl i feed-validatorer. Brug `dc:creator`.
- Titel/beskrivelse lægges i `<![CDATA[${…}]]>` uden at håndtere `]]>` → kan bryde XML. `manchet` (kan være HTML) sendes rå i `<description>`.
- Mangler `<lastBuildDate>`, `<category>`, `<enclosure>`/`media:content` (billede), og mærkning (sponsoreret artikel er umærket i feedet).

**P1-12. Title/description-kvalitet**
- Brand-dublering i 12 titler: template `%s · NæstvedLokalt` (`(site)/layout.tsx:30-31`) + sidens egen titel indeholder allerede brandet → `Priser & Annoncering — NæstvedLokalt · NæstvedLokalt`, `Kalender … | NæstvedLokalt · NæstvedLokalt` (priser, kalender, opslagstavle, nyhedsbrev, indsend, qa, interview, sponsor, bliv-en-del, om-mediet/*, gemte, profil, velkommen, soeg).
- Artikeltitler: 10/10 (Næstved) og 46/46 (Slagelse) er **>60 tegn** inkl. suffix (maks 108/97) og trunkeres i SERP; `seoTitel` er null på alle artikler. `og:title` bruger `titel`, `<title>` bruger `seoTitel||titel` – ikke fejl, men inkonsistent.
- Undersektionsbeskrivelser er skabelon: "Nyheder om leder i Næstved." / "Nyheder om kommentarer i Næstved." (`[slug]/page.tsx:46`), 25–45 tegn. Sektioner har 20–28 tegn ("Lokalsport og motion") – under 70, ingen værdi i SERP.
- Duplikerede titler/beskrivelser: `/priser` = `/annoncer`; `/bliv-en-del-af-journalistikken` = `/meddeler` (begge re-eksporterer samme side uden canonical); forsiden `/` = `/?omraade=…`.
- Slug/titel-mismatch i seed: `karrebaeksminde-klaer-paa-til-aarets-stoerste-fiskefestival` har titel "Trafikvarsel ved Karrebæksminde: Græshoppebroen…" (slug opdateres ikke ved titelændring; ved ændring bør gamle URL'er 308 videre).

### P2

- **P2-1. Ingen `llms.txt`, ingen eksplicitte AI-bot-regler.** `robots.txt` (`app/robots.ts`) har kun `User-agent: *` Allow/Disallow – GPTBot/ClaudeBot/PerplexityBot/Google-Extended er dermed *tilladt* (godt for citation), men uden dokumenteret politik. Intet `llms.txt` (404), ingen `pricing.md`.
- **P2-2. Alle sider er dynamisk renderet** (`getCurrentSite()` kalder `headers()`/`cookies()`, `lib/site.ts:47,55`), så HTML får `Cache-Control: no-cache, must-revalidate` (dev) og i produktion normalt `private/no-store` → hver crawl rammer DB; ingen CDN-cache, ingen ETag/Last-Modified-genbrug; TTFB og crawl-budget lider ved Discover-/Facebook-spikes. Fjern cookie-opslag i produktion og brug host-baseret tenant med ISR (`revalidate` + `revalidateTag` ved publicering).
- **P2-3. Favicon/ikoner/manifest:** kun `favicon.ico` (256 px) ens for alle byer; ingen `apple-touch-icon`, `manifest.webmanifest`, `theme-color`. Ingen logo overhovedet (`Instance.logoUrl` tom). Google Search kræver favicon på et multiplum af 48 px (ico OK), men by-specifikt site-navn/ikon mangler.
- **P2-4. Redirects:** `/stoet` og `/tip-os` bruger `redirect()` = **307** (midlertidig, `stoet/page.tsx`, `tip-os/page.tsx`) – brug `permanentRedirect` (308). `/priser/` → `/priser` 308 er korrekt (trailing slash-politik ok).
- **P2-5. Semantik:** `/bliv-stoette` har indlejret `<main>` i layoutets `<main>` (`bliv-stoette/page.tsx:17`); `/gemte` uden H1; artikel-byline uden `<time datetime>` (`Byline.tsx`, kun tekst "Publiceret 1. oktober 2026 kl. 03.39"); kun `ArticleCard` bruger `<time>`.
- **P2-6. Billedtekst/kredit:** `Arkivfoto: {ophavsperson}` er hårdkodet label (`[slug]/page.tsx:570`) – forkert for nye fotos og skal være `Foto: …` for krediteringen i `ImageObject.creditText`/`copyrightNotice`.
- **P2-7. Pladsholdertekst i UI:** footer viser bogstaveligt "En del af [By]Lokalt-netværket:" (`SiteFooter.tsx:110`); `Byline.tsx:48` falder tilbage til initialerne "SL" (Slagelse) når forfatter mangler.
- **P2-8. Tillids-/NAP-data for Organization:** `/om-mediet/kontakt` har e-mail og ansvarshavende redaktør (Carsten Lysdal), men ingen postadresse, CVR, telefon eller udgiver-entitet ("NæstvedLokalt Udgiverselskab, Næstved, Danmark"). `/om-mediet/redaktionelle-principper` hævder tilmelding til Pressenævnet (verificér, T6) – påstanden bør linke til pressenaevnet.dk og skal stemme med `memberOf`/`publishingPrinciples`.
- **P2-9. Statisk prototype (`nyhedssite.html`, 3,5 MB):** se §8.

### P3

- `sitemap.xml` `changefreq`/`priority` er ignoreret af Google (kan fjernes).
- Hreflang er **ikke nødvendig** (6 danske domæner, ét sprog, ingen oversættelser; `<html lang="da">` er korrekt og konsistent). Kun hvis der senere oprettes engelske sider.
- `app/layout.tsx` indlæser JetBrains Mono (+Inter/Newsreader med andre vægte) globalt, mens `(site)/layout.tsx` indlæser Inter/Newsreader igen: 7 `woff2`-preloads på forsiden; `--font-mono-var` bruges ikke i `site.css`/`globals.css` (0 hits). Fjern ubrugt font + dublet.
- Mange inline styles (62 på forsiden), 134 KB `site.css` + `globals.css` (Tailwind + admin-`modernist.css` importeres også på den offentlige side via root layout) – se §6.

## 3. Hvad der allerede er godt (bevar)

- `<html lang="da">` på alle sider; `metadataBase` sat i site-layout; én H1 pr. side (undtagen `/gemte`); korrekt HTTP-status (404 på ukendte URL'er, 308 for trailing slash); 404-siden har `noindex`.
- Self-hosted fonts via `next/font` (ingen Google Fonts-request, i modsætning til prototypen); `next/image` med `sizes`, hero har `priority`; alt-tekster er sat på alle `<img>` (0 uden `alt`).
- Per-by sitemap/robots/feed, `lastmod` for artikler = `opdateretTid`, token-sider har `noindex`.
- Tillidssider: Om mediet, Redaktionelle principper, Rettelser (med `CorrectionComment` i schema), Kontakt – præcis hvad Google News' transparens-krav og E-E-A-T beder om.
- Byline med forfatterlink + `/forfatter/<slug>` med bio; synlig mærkning (`MarkingBox`) på kommercielt/AI-indhold.
- Ingen tredjeparts-tracking/-scripts (gunstigt for CWV og privatliv); mærknings-/AI-disclosure i brødtekst er synlig.

## 4. Google News / Top Stories / Discover – eligibility-tjekliste

| Krav | Status | Handling |
|---|---|---|
| Publisher Center-ansøgning, domæne verificeret i Search Console | Ikke gjort / ikke verificerbart i kode | Tilføj `google-site-verification` via `metadata.verification`; ansøg pr. by-domæne (6 publikationer) |
| Gennemsigtighed: datoer, bylines, forfatter-info, kontakt, "om os", redaktionelle principper | Delvist OK (mangler adresse/CVR/telefon, `<time>`) | P2-8, P2-5 |
| Tydelig mærkning af sponsoreret/AI-indhold; sponsoreret indhold ikke i News | Synlig mærkning ja; maskinlæsbart nej | §7.3 + udeluk fra news-sitemap |
| Indhold i åbent HTML (ingen paywall) | OK (`isAccessibleForFree:true`) | – |
| Ren artikel-markup (NewsArticle) | Findes, men billede/publisher mangler | P0-1, P1-2 |
| News-sitemap (valgfri, men hurtigere indeksering) | Mangler | §7.7 |
| Discover: billede ≥1200 px, `max-image-preview:large`, ikke clickbait | Mangler (SVG, ingen robots-meta) | P0-1, P1-4 |
| Unikke URL'er pr. artikel, stabile | Brudt (`/foo/slug`) | P0-3 |
| Ingen demo/duplikatindhold | Brudt (kalender, forside) | P1-7 |
| Hurtig side (CWV) | Ikke målt; dynamisk rendering | P2-2, §6 |

## 5. Interne links, struktur og duplikatindhold

- Klikdybde: artikler ligger 2 klik fra forsiden via sektion, men efter første 15 pr. sektion kun via sitemap (P1-8). `/omraade/*`, `/emne/*`, `/forfatter/*` har **0 links fra forsiden** (raw HTML) og nås kun via artikel-tags/byline; `/emne/*` er ikke i sitemap → reelt forældreløse.
- `/priser`, `/annoncer` (uden canonical), `/sponsor`, `/bliv-en-del-af-journalistikken`, `/meddeler` og `/bliv-stoette` har overlappende hensigt ("sponsorér/støt/annoncér"); `/annoncer` og `/meddeler` er rene dubletter (re-eksport) – 301 til `/priser` hhv. `/bliv-en-del-af-journalistikken`.
- Trailing slash: `/x/` → 308 til `/x` (korrekt). Store bogstaver i sti accepteres som 200 (`/NYHEDER/...`) – skal 308 til lowercase (P0-3).
- Cross-city: skabelonsider (`/priser`, `/bliv-stoette`, principper, kontakt) er næsten identiske på 6 domæner med kun bynavn udskiftet; det er acceptabelt, men giv hver by unik intro-tekst for at undgå "duplicate – Google chose different canonical". Forside-demoblokkene (P1-7) er egentlig tværbys-dublet.
- Ingen hreflang nødvendig (se P3). Ingen canonical peger på anden by – godt – men ukendt host/`x-site` kan servere forkert by (P0-3).

## 6. Core Web Vitals – statiske risici (ikke målt)

- **LCP:** forsidens hero har `priority` + preload-link, men billedet er SVG/CSS-baggrund; rigtige uploads konverteres til WebP ≤2400 px (`optimizeImage`) – det er godt, men `next/image` genererer `src`-fallback `w=3840` (default `deviceSizes`); sæt `images.deviceSizes/imageSizes` og `formats: ['image/avif','image/webp']` i `next.config.ts` (nu tom). Hero-billeder bør have eksplicit `fetchPriority="high"`.
- **TTFB/LCP:** fuld dynamisk rendering pr. request (P2-2) er den største risiko for 75. percentil i felt-data.
- **CLS:** `next/image fill` med faste kasser (OK); web-fonts `display:swap` uden `adjustFontFallback` er default i `next/font` (OK). 62 inline `style`-attributter på forsiden og 7 font-preloads (P3) er ikke CLS-kilder, men JS/CSS-vægt.
- **INP:** 17 af 33 `components/site/*` er `"use client"`; `SiteHeader`, `BottomNav`, `SectionSheet`, `TopicFilterBar`, `SectionHeader` kører på alle sider; `MetricTracker` poster til `/api/metrics/track` pr. artikelvisning (bør ske via `sendBeacon` efter idle – findes delvist). Mål med Lighthouse/CrUX efter produktions-build.
- **CSS:** `styles/site.css` 134 KB + `app/globals.css` (Tailwind + admin `modernist.css`) leveres begge til offentlige sider (root layout importerer `globals.css`) – flyt admin-CSS til `app/redaktion/layout.tsx`.
- Anbefalet måling: `next build && next start` + `npx lighthouse https://… --preset=desktop/mobile` og web-vitals-rapportering til analytics efter lancering; Search Console CWV-rapport.

## 7. Målspecifikation (klar til implementering)

Konventioner: `BASE = https://<site.domaene>` (apex, https, uden trailing slash undtagen forside). Alle URL'er absolutte. `@id`-mønster: `BASE/#organization`, `BASE/#website`, `BASE/<sti>#article`. Tidsstempler ISO 8601 med offset (`2026-10-01T05:39:33+02:00`).

### 7.1 Fælles `<head>` (site-layout `generateMetadata`)

```ts
// app/(site)/layout.tsx  (skitse)
export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  const base = `https://${site.domaene}`;
  return {
    metadataBase: new URL(base),
    title: { default: `${site.navn} – lokale nyheder fra ${site.kommune}`, template: `%s | ${site.navn}` },
    description: site.tagline,                    // 120–155 tegn, unik pr. by
    applicationName: site.navn,
    alternates: {
      canonical: "/",                             // overskrives pr. side
      types: { "application/rss+xml": [{ url: "/feed.xml", title: `${site.navn} – alle nyheder` }] },
    },
    robots: {
      index: true, follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
    openGraph: {
      type: "website", siteName: site.navn, locale: "da_DK", url: "/",
      images: [{ url: `/og/${site.domaene.split(".")[0]}.jpg`, width: 1200, height: 630, alt: site.navn }],
    },
    twitter: { card: "summary_large_image", site: "@naestvedlokalt" /* hvis konto findes */ },
    verification: { google: process.env.GSC_TOKEN, other: { "facebook-domain-verification": [process.env.FB_DOMAIN_TOKEN!] } },
    icons: { icon: [{ url: "/favicon.ico" }, { url: "/icon-192.png", sizes: "192x192" }], apple: "/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
    other: { "theme-color": site.colors.accent },
  };
}
```

Regler: **ét brand-suffix** (fjern ` — NæstvedLokalt` fra individuelle titler; template tilføjer ` | NæstvedLokalt`). Titel 30–60 tegn **før** suffix hvis muligt (SERP ~600 px). Beskrivelse 120–155 tegn, unik, ingen HTML.

### 7.2 Hjælpere

```tsx
// components/site/JsonLd.tsx
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c").replace(/ /g, "\\u2028").replace(/ /g, "\\u2029");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
// Breadcrumbs: item: new URL(item.href, `https://${site.domaene}`).toString()
// stripHtml(manchet) + truncate(155) til description i meta/JSON-LD/RSS.
```

### 7.3 Mapping: indholdstype / aiBrug → schema, meta, sitemap, feed

| `indholdstype` | JSON-LD `@type` | Ekstra felter | `author` | news-sitemap | Synlig + maskinlæsbar mærkning |
|---|---|---|---|---|---|
| Uafhængig | `NewsArticle` (debat/leder: `OpinionNewsArticle`) | – | Person (redaktionel forfatter) | ja | – |
| Partner | `NewsArticle` | `sponsor`: Organization (`marking.sponsor`), `funder` ved flerårig aftale | Person | **nej** | `labelTekst` i `<h1>`-nær boks + `og:description` uændret; i feed `<category>Partner</category>` |
| Sponsoreret | `Article` (ikke News) – evt. `AdvertiserContentArticle` | `sponsor`; alle udgående links i brødtekst `rel="sponsored noopener"` | Organization (sponsor) eller redaktion | **nej** | Samme som Partner |
| Brugerindsendt | `Article` | `author`: Person/Organization = `marking.afsender`; `contributor` Organization (redaktionen) | afsender, ikke journalist | nej | "Fra borgerne" |
| PR | `Article` | `author`/`provider`: Organization = `marking.afsender` | afsender | nej | "Pressemeddelelse fra X" |
| AI-assisteret | `NewsArticle` | `editor`: Person (`marking.godkendtAf`); `isBasedOn` / `citation`: kilde-URL'er (`marking.kilder`); `creditText`/`backstory`: "Udarbejdet med AI-assistance og godkendt af …" | Person (godkender) | ja | AI-boks (findes) + `aiBrug` i `<meta name="ai-use">` er ikke standard – undlad meta, brug kun synlig tekst + `backstory` |

Bemærk: schema.org har intet officielt "AI-genereret"-flag; Google News kræver åbenhed, ikke markup. Hold altid synlig tekst og JSON-LD konsistente.

### 7.4 Meta-matrix pr. sidetype

| Sidetype | `<title>` (før suffix) | Description | Canonical | Robots | OG `type` / Twitter |
|---|---|---|---|---|---|
| Forside | `Næstved Lokalt – lokale nyheder fra Næstved og omegn` | Tagline udvidet, 140–155 tegn | `BASE/` | index | `website`, by-fallback 1200×630 |
| Sektion `/nyheder` | `Nyheder fra Næstved – seneste lokale historier` | `Redaktionens egen beskrivelse (Category.beskrivelse), ellers skabelon m. top-3 overskrifter` | `BASE/nyheder` (side N: `?side=N`, selv-canonical) | index | `website` |
| Undersektion | `Politik i Næstved – byråd, valg og beslutninger` | Unik pr. kategori (feltet `beskrivelse`), min. 70 tegn | `BASE/nyheder/politik` | index | `website` |
| Artikel | `seoTitel` (≤60) ellers `titel` afkortet ved ord; headline i JSON-LD = fuld `titel` ≤110 | `seoBeskrivelse` ellers `stripHtml(manchet)` ≤155 | `BASE/<egen-sektion>/<slug>` (redirect hvis anden sti) | index (`noindex` kun på Idé/Kladde, som ikke vises) | `article` + `article:published_time`, `modified_time`, `author` (profil-URL), `section`, `tag` |
| Område | `Nyheder fra Fensmark – lokale historier og begivenheder` | Antal artikler + seneste emne | `BASE/omraade/fensmark` | index hvis ≥3 artikler, ellers `noindex,follow` | `website` |
| Emne | `<Emne> – baggrund og artikler` (uden `Emne: #`) | Unik; ellers `noindex` | `BASE/emne/<slug>` | index hvis ≥3 artikler | `website` |
| Forfatter | `Morten Kaas – journalist, NæstvedLokalt` | `bio` ≤155 | `BASE/forfatter/<slug>` | index | `profile` (`profile:first_name/last_name`) |
| Om mediet | `Om NæstvedLokalt – redaktion, ejerskab og finansiering` | – | `BASE/om-mediet` | index | `website` |
| Principper/Rettelser/Kontakt | `Redaktionelle principper og etik`, `Rettelser og præciseringer`, `Kontakt redaktionen` | – | selv | index | `website` |
| Priser | `Priser og annoncering i Næstved` | Opstartspriser fra X kr. | `BASE/priser` (+ 301 fra `/annoncer`) | index | `website` |
| Kalender | `Det sker i Næstved – kalender` | – | `BASE/kalender` | `noindex` til rigtig data; derefter index | `website` |
| Opslagstavle | – | – | selv | `noindex` til rigtig data | `website` |
| Søg | `Søg i NæstvedLokalt` | – | `BASE/soeg` | `noindex,follow` | – |
| Gemte/Profil/Velkommen/Indsend/token-sider | – | – | selv | `noindex` | – |

### 7.5 JSON-LD pr. sidetype (Næstved-eksempler)

**Forside og alle sider (`@graph`, ligger i site-layout, rendres kun på `/` med WebSite; Organization kan være på alle):**

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "NewsMediaOrganization",
      "@id": "https://naestvedlokalt.dk/#organization",
      "name": "NæstvedLokalt",
      "alternateName": "Næstved Lokalt",
      "url": "https://naestvedlokalt.dk/",
      "logo": {
        "@type": "ImageObject",
        "url": "https://naestvedlokalt.dk/logo/naestvedlokalt-512.png",
        "width": 512, "height": 512
      },
      "image": "https://naestvedlokalt.dk/og/naestvedlokalt.jpg",
      "slogan": "Din lokale stemme i Næstved, Karrebæksminde og omegn",
      "description": "Uafhængigt digitalt lokalmedie for Næstved Kommune.",
      "foundingDate": "2026",
      "inLanguage": "da-DK",
      "areaServed": { "@type": "AdministrativeArea", "name": "Næstved Kommune" },
      "address": { "@type": "PostalAddress", "streetAddress": "<gade nr>", "postalCode": "4700", "addressLocality": "Næstved", "addressCountry": "DK" },
      "vatID": "DK<CVR>",
      "email": "redaktion@naestvedlokalt.dk",
      "contactPoint": [{ "@type": "ContactPoint", "contactType": "editorial", "email": "redaktion@naestvedlokalt.dk", "availableLanguage": "da", "url": "https://naestvedlokalt.dk/om-mediet/kontakt" }],
      "sameAs": ["https://www.facebook.com/<side>", "https://www.instagram.com/<konto>", "https://www.linkedin.com/company/<side>"],
      "publishingPrinciples": "https://naestvedlokalt.dk/om-mediet/redaktionelle-principper",
      "ethicsPolicy": "https://naestvedlokalt.dk/om-mediet/redaktionelle-principper",
      "correctionsPolicy": "https://naestvedlokalt.dk/om-mediet/rettelser",
      "actionableFeedbackPolicy": "https://naestvedlokalt.dk/om-mediet/kontakt",
      "masthead": "https://naestvedlokalt.dk/om-mediet",
      "ownershipFundingInfo": "https://naestvedlokalt.dk/om-mediet#finansiering",
      "diversityPolicy": "https://naestvedlokalt.dk/om-mediet/redaktionelle-principper#mangfoldighed",
      "memberOf": { "@type": "Organization", "name": "Pressenævnet", "url": "https://www.pressenaevnet.dk/" }
    },
    {
      "@type": "WebSite",
      "@id": "https://naestvedlokalt.dk/#website",
      "url": "https://naestvedlokalt.dk/",
      "name": "NæstvedLokalt",
      "alternateName": "Næstved Lokalt",
      "inLanguage": "da-DK",
      "publisher": { "@id": "https://naestvedlokalt.dk/#organization" },
      "potentialAction": {
        "@type": "SearchAction",
        "target": { "@type": "EntryPoint", "urlTemplate": "https://naestvedlokalt.dk/soeg?q={search_term_string}" },
        "query-input": "required name=search_term_string"
      }
    }
  ]
}
```

Noter: `ownershipFundingInfo`, `diversityPolicy`, `memberOf` kun hvis sandt og dokumenteret på siden (T6: Pressenævnet-påstand). Googles sitelinks-søgefelt er udfaset (2024), men `WebSite.name/alternateName` styrer site-navn i SERP. `sameAs` kræver at mediets sociale profiler faktisk eksisterer og linkes fra footer (P1-1). `logo` min. 112×112, kvadratisk eller maks 600×60, PNG/SVG-konverteret.

**Artikel (NewsArticle) – Næstved, AI-assisteret byrådsartikel:**

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "NewsArticle",
      "@id": "https://naestvedlokalt.dk/nyheder/overblik-det-besluttede-naestved-byraad-om-skolebudgettet#article",
      "mainEntityOfPage": { "@type": "WebPage", "@id": "https://naestvedlokalt.dk/nyheder/overblik-det-besluttede-naestved-byraad-om-skolebudgettet" },
      "url": "https://naestvedlokalt.dk/nyheder/overblik-det-besluttede-naestved-byraad-om-skolebudgettet",
      "headline": "Dagens overblik: Næstved Byråd tilfører 14 millioner ekstra til folkeskolen",
      "description": "Gennemgang af de væsentligste forligspunkter fra tirsdagens ordinære byrådsmøde på Rådhuset.",
      "image": [
        "https://naestvedlokalt.dk/media/2026/10/byraad-1x1.jpg",
        "https://naestvedlokalt.dk/media/2026/10/byraad-4x3.jpg",
        "https://naestvedlokalt.dk/media/2026/10/byraad-16x9.jpg"
      ],
      "datePublished": "2026-10-01T03:39:33+02:00",
      "dateModified": "2026-10-01T09:39:33+02:00",
      "inLanguage": "da-DK",
      "isAccessibleForFree": true,
      "articleSection": "Nyheder",
      "keywords": ["Næstved Byråd", "folkeskolen", "skolebudget"],
      "author": { "@type": "Person", "name": "Morten Kaas", "url": "https://naestvedlokalt.dk/forfatter/morten-kaas" },
      "editor": { "@type": "Person", "name": "Morten Kaas", "url": "https://naestvedlokalt.dk/forfatter/morten-kaas" },
      "publisher": { "@id": "https://naestvedlokalt.dk/#organization" },
      "isBasedOn": ["https://naestved.dk/politik/dagsordener/byraad/2026-09-29"],
      "backstory": "Udarbejdet med bistand fra sprogmodeller på baggrund af verificerede kilder og godkendt af Morten Kaas.",
      "contentLocation": { "@type": "Place", "name": "Næstved By" },
      "publishingPrinciples": "https://naestvedlokalt.dk/om-mediet/redaktionelle-principper",
      "correction": []
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Forside", "item": "https://naestvedlokalt.dk/" },
        { "@type": "ListItem", "position": 2, "name": "Nyheder", "item": "https://naestvedlokalt.dk/nyheder" },
        { "@type": "ListItem", "position": 3, "name": "Politik", "item": "https://naestvedlokalt.dk/nyheder/politik" },
        { "@type": "ListItem", "position": 4, "name": "Dagens overblik: Næstved Byråd tilfører 14 millioner ekstra til folkeskolen" }
      ]
    }
  ]
}
```

(`isBasedOn` i eksemplet bruger kilden fra seed-data; ret til faktisk URL. `correction` udelades når tom; ellers array af `CorrectionComment` som i dag. `image`: 3 formater ≥1200 px bred – Google anbefaler 16:9, 4:3, 1:1. Alle `.jpg/.webp`, ikke `.svg`.)

**Sektion/undersektion:** `CollectionPage` + `ItemList` (maks 15, kun URL + position) + `BreadcrumbList`:

```json
{ "@context":"https://schema.org","@type":"CollectionPage",
  "@id":"https://naestvedlokalt.dk/nyheder#page","url":"https://naestvedlokalt.dk/nyheder",
  "name":"Nyheder fra Næstved","inLanguage":"da-DK","isPartOf":{"@id":"https://naestvedlokalt.dk/#website"},
  "publisher":{"@id":"https://naestvedlokalt.dk/#organization"},
  "mainEntity":{"@type":"ItemList","itemListOrder":"https://schema.org/ItemListOrderDescending","numberOfItems":15,
    "itemListElement":[{"@type":"ListItem","position":1,"url":"https://naestvedlokalt.dk/nyheder/<slug>"}]}}
```

**Område (`/omraade/fensmark`)** – ikke LocalBusiness (et område er ikke en virksomhed), men `CollectionPage` med `about: Place` + GeoCoordinates (lat/lng findes i `GeoTag`):

```json
{ "@context":"https://schema.org","@type":"CollectionPage","url":"https://naestvedlokalt.dk/omraade/fensmark",
  "name":"Nyheder fra Fensmark","inLanguage":"da-DK",
  "about":{"@type":"Place","name":"Fensmark","geo":{"@type":"GeoCoordinates","latitude":55.2803,"longitude":11.8089},
           "containedInPlace":{"@type":"AdministrativeArea","name":"Næstved Kommune"}},
  "mainEntity":{"@type":"ItemList","itemListElement":[{"@type":"ListItem","position":1,"url":"…"}]}}
```

**Emne (`/emne/<slug>`)**: `CollectionPage` med `about: {"@type":"Thing","name":"Bæredygtighed"}`.

**Forfatter** – `ProfilePage` + `Person` (E-E-A-T):

```json
{ "@context":"https://schema.org","@type":"ProfilePage","url":"https://naestvedlokalt.dk/forfatter/morten-kaas",
  "dateModified":"2026-10-01T09:00:00+02:00",
  "mainEntity":{"@type":"Person","@id":"https://naestvedlokalt.dk/forfatter/morten-kaas#person",
    "name":"Morten Kaas","jobTitle":"Ansvarshavende lokalredaktør","description":"Ansvarshavende lokalredaktør på NæstvedLokalt med fokus på byråd og havn.",
    "image":"https://naestvedlokalt.dk/avatars/morten-kaas.jpg","worksFor":{"@id":"https://naestvedlokalt.dk/#organization"},
    "knowsAbout":["Næstved Byråd","Næstved Havn"],"sameAs":["https://www.linkedin.com/in/<profil>"]}}
```
Brug samme `Person.@id` i artiklens `author`.

**Om mediet:** `AboutPage` med `mainEntity: {"@id": "…#organization"}`; **Kontakt:** `ContactPage`; **Rettelser/Principper:** `WebPage` med `isPartOf` WebSite.

**Kalender (kræver ny `Event`-model og detaljesider `/kalender/<slug>`):** pr. event-side:

```json
{ "@context":"https://schema.org","@type":"Event","name":"Fiskefestival i Karrebæksminde",
  "startDate":"2026-10-03T10:00:00+02:00","endDate":"2026-10-03T16:00:00+02:00",
  "eventStatus":"https://schema.org/EventScheduled","eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode",
  "location":{"@type":"Place","name":"Karrebæksminde Havn","address":{"@type":"PostalAddress","streetAddress":"Havnevej 1","postalCode":"4736","addressLocality":"Karrebæksminde","addressCountry":"DK"}},
  "image":["https://naestvedlokalt.dk/media/…-16x9.jpg"],"description":"…",
  "organizer":{"@type":"Organization","name":"Karrebæksminde Erhvervsforening","url":"…"},
  "offers":{"@type":"Offer","price":"0","priceCurrency":"DKK","availability":"https://schema.org/InStock","url":"https://naestvedlokalt.dk/kalender/<slug>"},
  "url":"https://naestvedlokalt.dk/kalender/<slug>" }
```
På listesiden `/kalender` kun `CollectionPage`+`ItemList` med links (Google kræver Event-markup på detaljesiden). Datoer skal være ISO-felter i databasen, ikke "I dag".

**Priser:** Ingen Google-rich-result (tjenesten er B2B-annoncering), men `WebPage` + `OfferCatalog` giver AI-systemer maskinlæsbar prisinfo:

```json
{ "@context":"https://schema.org","@type":"OfferCatalog","name":"Annoncering og sponsoreret indhold – NæstvedLokalt",
  "provider":{"@id":"https://naestvedlokalt.dk/#organization"},
  "itemListElement":[
    {"@type":"Offer","name":"Event i kalenderen","price":"125","priceCurrency":"DKK","itemOffered":{"@type":"Service","name":"Kalenderannonce"}},
    {"@type":"Offer","name":"Sponsoreret artikel inkl. Facebook-distribution","price":"4995","priceCurrency":"DKK"},
    {"@type":"Offer","name":"Profil i erhvervsguiden","price":"249","priceCurrency":"DKK","priceSpecification":{"@type":"UnitPriceSpecification","price":"249","priceCurrency":"DKK","unitText":"MON"}}
  ]}
```
(Priserne er hentet fra `priser/page.tsx:194,244,292`.) `FAQPage` kan tilføjes for AI men giver ikke længere SERP-rich-result for almindelige sites (kun myndigheder/sundhed siden 2023).

### 7.6 OG/Twitter – komplet `<head>` for Næstved-artiklen (Facebook, LinkedIn, X, WhatsApp, Messenger)

```html
<title>Næstved Byråd tilfører 14 mio. ekstra til folkeskolen | NæstvedLokalt</title>
<meta name="description" content="Gennemgang af de væsentligste forligspunkter fra tirsdagens byrådsmøde på Rådhuset i Næstved.">
<link rel="canonical" href="https://naestvedlokalt.dk/nyheder/overblik-det-besluttede-naestved-byraad-om-skolebudgettet">
<link rel="alternate" type="application/rss+xml" title="NæstvedLokalt – alle nyheder" href="https://naestvedlokalt.dk/feed.xml">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<meta property="og:site_name" content="NæstvedLokalt">
<meta property="og:locale" content="da_DK">
<meta property="og:type" content="article">
<meta property="og:url" content="https://naestvedlokalt.dk/nyheder/overblik-det-besluttede-naestved-byraad-om-skolebudgettet">
<meta property="og:title" content="Dagens overblik: Næstved Byråd tilfører 14 millioner ekstra til folkeskolen">
<meta property="og:description" content="Gennemgang af de væsentligste forligspunkter fra tirsdagens byrådsmøde.">
<meta property="og:image" content="https://naestvedlokalt.dk/og/artikel/overblik-det-besluttede-naestved-byraad-om-skolebudgettet.jpg">
<meta property="og:image:secure_url" content="https://naestvedlokalt.dk/og/artikel/overblik-det-besluttede-naestved-byraad-om-skolebudgettet.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Næstved Byråd i møde på Rådhuset">
<meta property="article:published_time" content="2026-10-01T03:39:33+02:00">
<meta property="article:modified_time" content="2026-10-01T09:39:33+02:00">
<meta property="article:author" content="https://naestvedlokalt.dk/forfatter/morten-kaas">
<meta property="article:section" content="Nyheder">
<meta property="article:tag" content="Næstved Byråd">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@<konto>">
<meta name="twitter:title" content="Dagens overblik: Næstved Byråd tilfører 14 millioner ekstra til folkeskolen">
<meta name="twitter:description" content="Gennemgang af de væsentligste forligspunkter fra tirsdagens byrådsmøde.">
<meta name="twitter:image" content="https://naestvedlokalt.dk/og/artikel/overblik-det-besluttede-naestved-byraad-om-skolebudgettet.jpg">
<meta name="twitter:image:alt" content="Næstved Byråd i møde på Rådhuset">
```

Delingsbillede-specifikation: **JPEG/PNG/WebP, 1200×630 (1,91:1), <1 MB (maks 5 MB X / 8 MB Facebook), sikker zone: vigtigt indhold inden for midterste 80 %** (WhatsApp og Facebook-mobil beskærer til ~1:1 og 1,91:1). Fald-tilbage-kæde: artikelcover → by-kort `/og/<by>.jpg` (logo + bynavn) → ALDRIG SVG. Implementering: tilføj i `optimizeImage` (`lib/media-storage.ts`) et ekstra `sharp(...).resize(1200,630,{fit:'cover',position:'attention'}).jpeg({quality:82})` og gem `ogUrl` på `Media`, eller brug `app/(site)/[sektion]/[slug]/opengraph-image.tsx` (`ImageResponse`) med artikelens overskrift over cover.

Platform-noter: **Facebook** cacher OG – brug Sharing Debugger ("Scrape Again") efter ændring af billede; `fb:app_id`/domæneverifikation kræves for at redigere link-preview og for Business Manager. **Instagram** viser ingen link-previews i feed – brug link-sticker i Stories/bio og UTM (`?utm_source=instagram&utm_medium=social&utm_campaign=<slug>`); canonical sørger for at UTM ikke danner dubletter (kræver P0-3). **LinkedIn** læser OG (1200×627 ok) + `article:author`. **X** kræver `twitter:card` + billede ≥300×157 (anbefalet 1200×628), ingen SVG. **WhatsApp/Messenger** bruger OG og kræver billede <600 KB for pålidelig preview – servér en let 1200×630 JPEG (kvalitet ~75–80).

Del-knapper (erstat de døde `<button>`): native `navigator.share({title,url})` på mobil med fallback-links `https://www.facebook.com/sharer/sharer.php?u=<canonical>`, `https://x.com/intent/post?url=<canonical>&text=<titel>`, `https://www.linkedin.com/sharing/share-offsite/?url=<canonical>`, `https://wa.me/?text=<titel>%20<canonical>`, `mailto:?subject=…&body=…` og "Kopiér link". Delings-URL = canonical + `?utm_source=<platform>&utm_medium=share`.

### 7.7 Sitemaps, robots, feeds

**Sitemap-struktur (pr. by, host-baseret):** `/sitemap.xml` som **sitemap-index** → `/sitemap-sider.xml` (statiske sider med fast `lastmod` = filens/DB-opdateringstid, ikke `new Date()`), `/sitemap-sektioner.xml`, `/sitemap-omraader.xml`, `/sitemap-forfattere.xml`, `/sitemap-emner.xml`, `/sitemap-artikler-<år>-<måned>.xml` (billed-extension `<image:image>` med absolut JPG), og **`/news-sitemap.xml`**. Fjern `/soeg`, medtag `/priser`, `/kalender` (når Event-data), `/emne/*`. Næsten alle `lastmod` skal være ægte (`MAX(opdateretTid)` for sektionssider).

**News-sitemap (`app/(site)/news-sitemap.xml/route.ts`):** kun `Publiceret`, `indholdstype IN ('Uafhængig','AI-assisteret','Brugerindsendt'?)` (anbefalet: kun Uafhængig + AI-assisteret + Partner udeladt), `publiceretTid` inden for **48 timer**, maks 1000 URL'er:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://naestvedlokalt.dk/nyheder/overblik-det-besluttede-naestved-byraad-om-skolebudgettet</loc>
    <news:news>
      <news:publication><news:name>NæstvedLokalt</news:name><news:language>da</news:language></news:publication>
      <news:publication_date>2026-10-01T03:39:33+02:00</news:publication_date>
      <news:title>Dagens overblik: Næstved Byråd tilfører 14 millioner ekstra til folkeskolen</news:title>
    </news:news>
  </url>
</urlset>
```

**robots.txt (pr. host):**

```
User-agent: *
Allow: /
Disallow: /redaktion
Disallow: /api/
Disallow: /login
Disallow: /soeg
Disallow: /*?*omraade=
Disallow: /gemte
Disallow: /profil
Disallow: /meddeler/
Disallow: /qa/
Disallow: /interview/
Disallow: /partner/

# AI-søgning (tilladt – kilde-citering ønskes)
User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Google-Extended
Allow: /
# Kun træningscrawler blokeres hvis redaktionen ønsker det:
User-agent: CCBot
Disallow: /

Sitemap: https://naestvedlokalt.dk/sitemap.xml
Sitemap: https://naestvedlokalt.dk/news-sitemap.xml
```
(NB: `Disallow` forhindrer ikke indeksering – brug `noindex` meta, og lad Googlebot *kunne crawle* siden for at se `noindex`; blokér derfor kun rene API/privatsider i robots, ikke sider der skal `noindex`'es.)

**RSS 2.0 (forbedret):** `<language>da</language>`, `<lastBuildDate>`, `<atom:link rel="self">`, pr. item: `<title>` (XML-escaped, ikke CDATA), `<link>`, `<guid isPermaLink="true">`, `<pubDate>`, `<dc:creator>Morten Kaas</dc:creator>` (erstat ugyldigt `<author>`), `<category>Nyheder</category>`, `<description>` = `stripHtml(manchet)`, `<media:content url="…jpg" medium="image" width="1200" height="630"/>`, og for Partner/Sponsoreret et `<category>Sponsoreret</category>` + label i titlen. Escape `]]>` → `]]]]><![CDATA[>`. Ret slug-URL'er til ASCII. Autodiscovery i `<head>` (se §7.1) og pr. sektion: `alternates.types` på sektionssider. Tilføj feed for undersektion (`/nyheder/politik/feed.xml`).

### 7.8 AI-søgning (ChatGPT, Perplexity, Claude, Google AI Overviews)

Google: ingen særlig markup kræves; AI Overviews følger almindelig rangering + E-E-A-T → fix P0/P1 først. Øvrige AI-motorer belønner udtrækbar struktur og tilgængelig maskin-info.

- `robots.txt`: eksplicit tilladelse som i §7.7 (ingen blokering af søge-/citér-bots).
- **`/llms.txt`** (pr. by, ~1 KB):

```
# NæstvedLokalt
> Uafhængigt digitalt lokalmedie for Næstved Kommune (Næstved, Karrebæksminde, Fensmark, Glumsø, Fuglebjerg m.fl.). Gratis, ingen betalingsmur. Ansvarshavende redaktør: Carsten Lysdal.

## Redaktion og tillid
- [Redaktionelle principper](https://naestvedlokalt.dk/om-mediet/redaktionelle-principper): uafhængighed, mærkning af sponsoreret/AI-indhold
- [Rettelser](https://naestvedlokalt.dk/om-mediet/rettelser)
- [Om mediet og finansiering](https://naestvedlokalt.dk/om-mediet)
- [Kontakt](https://naestvedlokalt.dk/om-mediet/kontakt)

## Sektioner
- [Nyheder](https://naestvedlokalt.dk/nyheder) · [Erhverv](https://naestvedlokalt.dk/erhverv) · [Sport](https://naestvedlokalt.dk/sport) · [Kultur](https://naestvedlokalt.dk/kultur) · [Foreningsliv](https://naestvedlokalt.dk/foreningsliv) · [Debat](https://naestvedlokalt.dk/debat)

## Feeds og sitemaps
- [RSS](https://naestvedlokalt.dk/feed.xml) · [Sitemap](https://naestvedlokalt.dk/sitemap.xml) · [News-sitemap](https://naestvedlokalt.dk/news-sitemap.xml)

## Priser
- [Priser og annoncering](https://naestvedlokalt.dk/priser)
```
- **Svarklar artikelstruktur:** 40–60 ords "Kort fortalt"-blok øverst (findes som manchet – hold den selvstændig og faktuel), dato + sted i første afsnit ("NÆSTVED: …"), navngivne kilder med titel og dato, tal med kilde, `<time datetime>` for udgivelse/opdatering, tydeligt "Opdateret"-felt, tags/område som links. Undgå at skrive særskilt indhold "til AI" (Googles spam-politik).
- **Entitetsklarhed:** ensartet navn/NAP overalt (`NæstvedLokalt`), `sameAs` på alle sociale profiler, Wikipedia/Wikidata-post hvis opfyldt, forfatterprofil med `knowsAbout`. Tredjepartsomtale (Facebook-side, LinkedIn, lokale foreninger) vejer tungt i AI-citation – distribution på Facebook er derfor også AI-synlighed.
- **`/priser` som tekst + `OfferCatalog`** (evt. `/pricing.md`) – AI-agenter udelukker leverandører med ulæselige priser; sørg også for at "Spar 75 % ift. Min By Media" er dokumenterbart (T6/jura).

### 7.9 Kode-ændringer pr. fil (oversigt)

| Fil | Ændring |
|---|---|
| `app/(site)/layout.tsx` | §7.1 metadata, `<JsonLd>` med Organization+WebSite på forside |
| `components/site/Breadcrumbs.tsx:24,32` | Absolutte URL'er + sikker JSON-LD |
| `app/(site)/[sektion]/[slug]/page.tsx:28-74,329-384` | Metadata (§7.4/7.6), JSON-LD (§7.5), 308 til korrekt sti, `notFound` ved ukendt sektion, `<time>` |
| `lib/site-queries.ts:545` | `getArticleBySlug` skal validere sektion/udlede canonical sti |
| `lib/media-storage.ts` | 1200×630 JPEG-derivat + 16:9/4:3/1:1 til JSON-LD; gem `bredde/hoejde/mimeType` |
| `app/sitemap.ts` | Opdel i index; ægte `lastmod`; ud med `/soeg`; ind med `/priser`, emner m.fl. |
| `app/(site)/news-sitemap.xml/route.ts` | Ny (§7.7) |
| `app/robots.ts` | §7.7 |
| `app/(site)/feed.xml/route.ts`, `[sektion]/feed.xml/route.ts` | `dc:creator`, CDATA-sikring, `lastBuildDate`, billede, mærkning; `<link rel=alternate>` i layout |
| `components/site/LoadMore.tsx` | Rigtige `<a>`-sidelinks + selv-canonical pr. side |
| `components/site/SiteHeader.tsx:89`, `SiteFooter.tsx:115,110` | Absolutte søsterby-links; ret `[By]Lokalt`-placeholder |
| `app/(site)/{priser,annoncer,meddeler,kalender,opslagstavle,soeg,gemte,profil,velkommen}/page.tsx` | Canonical/`noindex` som §7.4; fjern brand-dublering |
| `lib/site.ts:48,80-85` | Ignorér `x-site` i prod; ukendt host → 404; `www`→apex |
| `public/` | `llms.txt` (pr. by via route), `og/<by>.jpg`, `logo/*`, `apple-touch-icon.png`, `manifest.webmanifest` |

## 8. Det statiske prototype-site `nyhedssite.html`

Én 3,5 MB HTML-fil (base64-billeder), `lang="da"`, `<title>` hardcodet til Slagelse, ingen canonical/OG/schema, 8 H1, 105 hash-ankre og 0 egne URL'er pr. sektion/artikel, Google Fonts via tredjepart (preconnect `fonts.googleapis.com`). Intet af ovenstående kan SEO-optimeres meningsfuldt uden routing; filen bør **ikke** deployes som offentligt site – CMS-sitet (`cms/`) er det SEO-relevante output.

## 9. Anbefalet rækkefølge (hurtige gevinster først)

1. **Dag 1 (P0):** `<JsonLd>`-escaping; canonical-helper + redirect af forkerte artikelstier; `noindex` på private sider og kalender/opslagstavle; absolutte breadcrumb-URL'er.
2. **Uge 1 (P0/P1):** 1200×630 JPEG-pipeline + by-fallback OG; fuldt OG/Twitter-sæt; Organization/WebSite/NewsArticle-udvidelse; rigtige del-knapper; ASCII-slugs + 404-sitemapfix; feed-autodiscovery og `dc:creator`.
3. **Uge 2 (P1):** sitemap-index + news-sitemap med ægte `lastmod`; crawlbar paginering; fjern forsidens hårdkodede Slagelse-blokke og døde links; absolutte søsterby-links; titel-/beskrivelses-oprydning (`seoTitel` ≤60).
4. **Derefter (P2/P3):** Event-model + Event-sider; ProfilePage/CollectionPage; `llms.txt` + bot-regler; ISR/CDN-cache; logo/favicons/manifest; Publisher Center + Search Console + Facebook-domæneverifikation; CWV-måling i produktion.

## 10. Opsummering (10 linjer)

1. Baseline fc7c5d7; 88 Næstved-URL'er + Slagelse crawlet, JSON-LD udtrukket og scriptvalideret; ingen kildefiler rørt.
2. Samlet score: Google 3/10, SoMe 1–2/10, AI 3/10 – artikelsiden er bedst (5/3/5), kalender/opslagstavle dårligst (1/1/1).
3. P0: alle OG-/schema-billeder er SVG (relative i JSON-LD) → ingen Facebook/LinkedIn/X-preview og ingen Discover/Top Stories-billede, trods "Facebook-distribution" på /priser.
4. P0: al JSON-LD (artikel + breadcrumbs på 68 sider) er ikke `<`-escapet → `</script>`-breakout/XSS og ødelagt schema.
5. P0: canonical er ødelagt – `/<hvad-som-helst>/<slug>` giver 200 med selv-canonical, 68/88 sider mangler canonical, `www`/ukendt host/`x-site` serverer forkert eller dubleret indhold.
6. P1: ingen Organization/NewsMediaOrganization/WebSite/logo/sameAs; NewsArticle mangler publisher.logo, mainEntityOfPage, articleSection, inLanguage; mærkning (Partner/Sponsoreret/AI) når ikke JSON-LD, sitemap eller feed.
7. P1: ingen news-sitemap; sitemap har `lastmod=now`, en 404-artikel (ø-slug), mangler /priser, /kalender, /emne; paginering er `<button>` (ikke crawlbar).
8. P1: forsiden har hårdkodede Slagelse-blokke med 7 døde links og kalender/opslagstavle er statisk demo på alle byer; del-knapper er døde; søsterby-links via cookie-API virker ikke i produktion.
9. Feeds er velformede men uden autodiscovery, med ugyldigt `<author>` og CDATA-risiko; ingen llms.txt/AI-botregler; alle sider dynamisk renderet (TTFB/CDN-risiko); CWV ikke målt (dev).
10. Målspecifikation (meta-matrix, @graph for Organization/WebSite, NewsArticle m. mærkningsmapping, ProfilePage, CollectionPage, Event, OfferCatalog, news-sitemap, robots, llms.txt, OG-head for Næstved-artikel) står i §7 – rapport: `/Volumes/SSD Data/Gits/localcms/docs/review/T4-seo-schema-some.md`.
