# Produktkatalog — alt, der skal bygges

Status: ✅ findes · 🟡 delvist · ⬜ mangler. Prioritet efter `files/06` §1.2: **MVP** (nødvendigt til lancering), **Kort efter** (0-6 mdr.), **Senere**.
Opdatér status, når et punkt er bygget og verificeret.

## 0. Faserækkefølge

Nyhedskernen først. Hver fase slutter med grøn build, tests, browser-QA, HANDOFF-log og commit.

| Fase | Indhold | Katalog-ID'er |
|---|---|---|
| **1. Fundament til frontend** | Flyt admin til `/redaktion`, site-opslag, tema-tokens, skrifttyper, sektionstræ i datamodellen, udvidet indholdstype, seed med realistisk nyhedsindhold | F-01…F-08 |
| **2. Nyhedskernen (design)** | Layout (topbar, sektionsbar, bundmenu, footer), kortsystem, forside, sektions- og undersektionssider, artikelside med mærkning, områdeside, emneside, forfatterside, søg, 404 | P-01…P-10, K-01…K-12 |
| **3. Transparens og SEO** | Om mediet, redaktionelle principper, rettelser, kontakt; metadata, sitemap, robots, NewsArticle-schema, OG-billeder, RSS | P-11…P-14, S-01…S-06 |
| **4. Redaktionel styring** | Sektionsadministration, forsidestyring (zoner, fastgør, udløb, preview), rettelser i editoren, AI-assisteret mærkning i editoren, kvoteloft-advarsel | A-01…A-06 |
| **5. Indsendelse og nyhedsbrev** | Indsend historie (CMS-07) + redaktionel indbakke, nyhedsbrevstilmelding, "Fra borgerne"-zone | A-07…A-09, P-15, P-16 |
| **6. Støtte og kommercielt** | Støtteaftaler (UI, kvote, kobling), "Bliv støtte"-side, partnerlogoer/-modul, virksomheds-/foreningssider, supporterdashboard basis | C-01…C-07 |
| **7. Kalender og guide** | Event-model, indsend arrangement, kalender, eventside, .ics, guide-hub og profil | P-17…P-20, A-10 |
| **8. Netværk** | Site-konfiguration i UI (CMS-11), andet site via konfiguration, regionale artikler med canonical (CMS-12), netværkslinks | N-01…N-05 |
| **9. Kort efter MVP** | Video/lyd, automatiske forsideregler, "Top 3 i dag"/mest læst, følg/profiler, kommentarer, AI niveau 2 | X-01…X-08 |

---

## 1. Fundament (fase 1)

| ID | Punkt | Status | Acceptkriterium |
|---|---|---|---|
| F-01 | Flyt administrationen fra roden til `/redaktion/*` | ✅ | Alle admin-sider virker under `/redaktion/…`; `proxy.ts` beskytter kun `/redaktion/:path*`; `/login` redirecter til `/redaktion/artikler`; alle `href`, `redirect()` og `revalidatePath()` er opdateret; eksisterende tests grønne |
| F-02 | Site-opslag via host | ✅ | `getCurrentSite()` finder `Instance` ud fra `Host`-header (`domaene`), med fallback til `DEFAULT_SITE_DOMAIN` i dev; `localhost:3000` viser Slagelse |
| F-03 | Tema fra site-konfiguration | ✅ | Offentligt layout sætter `--site-*` CSS-variabler fra `Instance.farver`; alle øvrige tokens fra DESIGN.md §2 og §10 ligger i `cms/styles/site.css` |
| F-04 | Skrifttyper | ✅ | Bricolage Grotesque + Literata via `next/font/google`, kun i det offentlige layout; admin uændret |
| F-05 | Sektionstræ | ✅ | `Category` får `parentId`, `sortering`, `beskrivelse`, `iNavigation`; maks. to niveauer valideres; seed har DESIGN.md §6a.1 |
| F-06 | Områder med slug | ✅ | `GeoTag` får `slug` (+ evt. `lat/lng`); seed har Slagelses 8 områder |
| F-07 | Indholdstype "AI-assisteret" + mærkningsfelter | ✅ | `CONTENT_TYPES` udvidet; `validateMarking` kræver `godkendtAf` + `kilder[]` for AI-assisteret og `afsender` for Brugerindsendt/PR; tests |
| F-08 | Realistisk seed | ✅ | Mindst 40 publicerede artikler fordelt på alle sektioner/undersektioner og områder, alle fem mærkningstyper repræsenteret, 4 forfattere med portræt, placeholder-billeder med alt-tekst (lokale filer eller neutrale placeholders — **ingen** billeder fra andre medier) |

## 2. Offentlige sider

| ID | Side | Route | Prio | Status | Acceptkriterium |
|---|---|---|---|---|---|
| P-01 | Forside | `/` | MVP | ✅ | Zoner i rækkefølgen fra DESIGN.md §6a.4; manuel fastgørelse virker; mærkede kort ses i listen; første skærm på mobil = logo + Seneste nyt + tophistorie |
| P-02 | Sektionsside | `/[sektion]` | MVP | ✅ | DESIGN.md §6a.3 punkt 1-6; undersektionsblokke skjules uden artikler de seneste 30 dage; "Vis flere" (20 ad gangen) |
| P-03 | Undersektionsside | `/[sektion]/[undersektion]` | MVP | ✅ | Som P-02 uden undersektionsblokke; brødkrumme; aktiv pille |
| P-04 | Artikelside | `/[sektion]/[slug]` | MVP | ✅ | DESIGN.md §6 (rækkefølge 1-12); mærkningsboks øverst for alle ikke-uafhængige typer; blokke renderes via `lib/blocks/renderer.tsx` i site-stil; "Rettet"-note vises |
| P-05 | Områdeside | `/omraade/[slug]` | MVP | ✅ | Alle artikler med områdetag, filtrerbar på sektion; lille kort er valgfrit |
| P-06 | Emneside | `/emne/[slug]` | MVP | ✅ | Kronologisk liste; tag-navn som H1 |
| P-07 | Forfatterside | `/forfatter/[slug]` | MVP | ✅ | Portræt, bio, fast/freelance, artikelliste |
| P-08 | Søgning | `/soeg?q=` | MVP | ✅ | Fritekst i titel/manchet; filtrér på sektion og område; tomt resultat har hjælpetekst |
| P-09 | 404 og fejlside | – | MVP | ✅ | I site-design, med søgefelt og links til sektioner |
| P-10 | Debat-visning | `/debat/*` | MVP | ✅ | Kort med forfatterportræt og label (Leder/Kommentar/Læserbrev), jf. §6a.3 |
| P-11 | Om mediet | `/om-mediet` | MVP | ✅ | Tekster fra `Instance.markingTekster`/site-konfiguration; ejerskab, redaktør, finansiering |
| P-12 | Redaktionelle principper | `/om-mediet/redaktionelle-principper` | MVP | ✅ | Del 1 §9 som redigerbar tekst; linkes fra alle mærkningsbokse |
| P-13 | Rettelser | `/om-mediet/rettelser` | MVP | ✅ | Liste over alle rettelser med dato og link |
| P-14 | Kontakt og tip | `/om-mediet/kontakt` | MVP | ✅ | Kontaktinfo; tip-formular kan vente til P-15 |
| P-15 | Indsend historie/tip | `/indsend` | MVP | ✅ | Formular (CMS-07): navn, kontakt, tekst, billeder, rettighedserklæring, samtykke; spamværn (honeypot + rate limit); lander som "Indsendt" i redaktionen; **ingen auto-publicering** |
| P-16 | Nyhedsbrev-tilmelding | modul + `/nyhedsbrev` | MVP | ✅ | E-mail + samtykke gemmes i DB (double opt-in kan vente); ingen tredjepart |
| P-17 | Kalender | `/kalender` | MVP | ⬜ | DESIGN.md §7.1; filtre: dato, weekend/uge/måned, område, kategori |
| P-18 | Eventside | `/kalender/[slug]` | MVP | ⬜ | `Event`-schema, `.ics`-download, relaterede artikler |
| P-19 | Indsend arrangement | `/kalender/indsend` | MVP | ⬜ | Lander i redaktionel godkendelse |
| P-20 | Guide og profil | `/guide`, `/guide/[kategori]`, `/virksomhed/[slug]`, `/forening/[slug]` | Kort efter | ⬜ | DESIGN.md §7.2: profilzone (mærket) og redaktionel artikelzone adskilt |
| P-21 | Bliv støtte | `/bliv-stoette` | MVP | ⬜ | Pakkerne fra `SupportPackage`-skabeloner; uafhængighedsløftet synligt; kontaktformular |
| P-22 | Supporterdashboard | `/partner` | MVP | ⬜ | Login for støtte; aftale, kvote brugt/tilbage, leverancer, materialer; fast boks med begrænsninger (del 4 §8.2); kun egen aftale |

## 3. Komponenter (offentlig frontend, `cms/components/site/`)

Kontrakter i `references/komponenter.md`.

| ID | Komponent | Status |
|---|---|---|
| K-01 | `SiteHeader` (topbar + sektionsbar) | ✅ |
| K-02 | `BottomNav` (mobil) | ✅ |
| K-03 | `SectionSheet` (bottom sheet med sektioner, undersektioner, områder) | ✅ |
| K-04 | `SiteFooter` (sektioner, om mediet, støtter, netværk) | ✅ |
| K-05 | `ArticleCard` (hoved/standard/kompakt/tekst × mærkningsvarianter) | ✅ |
| K-06 | `ContentLabel` / `MarkingBox` (badge på kort + boks i artikel) | ✅ |
| K-07 | `SectionHeader` (H1, beskrivelse, undersektionspiller, områdefilter) | ✅ |
| K-08 | `LatestTicker` ("Seneste nyt") | ✅ |
| K-09 | `ShortNewsList` ("Kort nyt") | ✅ |
| K-10 | `Byline` (portræt, navn, tider) | ✅ |
| K-11 | `DateDivider` + `LoadMore` | ✅ |
| K-12 | `NewsletterSignup` | ✅ |
| K-13 | `EventCard` + `DateBadge` | ⬜ |
| K-14 | `PartnerStrip` ("Lokale fællesskaber") | ⬜ |
| K-15 | `Breadcrumbs` | ✅ |
| K-16 | Site-varianter af artikelblokkene (paragraph, heading, subheading, manchet, quote, factbox, image, infobox) | ✅ |

## 4. Redaktionen (admin, `/redaktion`)

| ID | Punkt | Modul | Prio | Status | Acceptkriterium |
|---|---|---|---|---|---|
| — | Artikler, editor, workflow, AC-01 | CMS-01/04/05 | MVP | ✅ | Findes |
| — | Mediebibliotek | CMS-03 | MVP | ✅ | Findes |
| — | Opgaver og honorar | CMS-06 | MVP | ✅ | Findes |
| — | Chat, Emner, Signaler | CMS-09/10 | Senere | 🟡 | Findes som v1; ikke en del af denne plan |
| A-01 | Sektionsadministration | CMS-02/11 | MVP | ✅ | Opret/omdøb/sortér sektioner og undersektioner; valider to niveauer; editoren vælger sektion + undersektion |
| A-02 | Områdeadministration | CMS-02/11 | MVP | ✅ | Opret/omdøb områder med slug |
| A-03 | Forsidestyring | Del 4 §4 | MVP | ✅ | Fastgør artikel til zone med udløb (standard 48 t); forhåndsvisning mobil/desktop; zoner falder tilbage til regel |
| A-04 | Kvoteloft-advarsel | CMS-04 | MVP | ✅ | Advarsel i forsidestyring og publiceringsoversigt, når støttefinansieret andel ≥ loftet |
| A-05 | Rettelser i editoren | CMS-01 | MVP | ✅ | "Tilføj rettelse" (tekst + dato) på publiceret artikel; vises i artiklen og på P-13 |
| A-06 | AI-assisteret mærkning | Del 9 | MVP | ✅ | Felter: godkendt af, kilder; citatblok kræver kilde, når artiklen er AI-assisteret |
| A-07 | Indbakke for indsendt materiale | CMS-07 | MVP | ✅ | Samlet liste; "Opret artikel fra indsendelse" bevarer afsender, rettigheder og samtykke |
| A-08 | Nyhedsbrevsabonnenter | – | MVP | ✅ | Liste + CSV-eksport; afmelding |
| A-09 | Spor A-markering | Del 9 | MVP | ✅ | Indsendt-artikler vises i "Fra borgerne"-zonen |
| A-10 | Kalenderadministration | Del 4 §6 | MVP | ⬜ | Godkend/afvis/redigér events; gentagelser; fremhæv (sponsoreret) med mærkning |

## 5. Kommercielt (fase 6)

| ID | Produkt | Kilde | Prio | Status | Acceptkriterium |
|---|---|---|---|---|---|
| C-01 | Støttepakke-skabeloner (Naboskab 12.000, Fællesskab 30.000, Fyrtårn 75.000 kr./år) | Del 1 §8.1, CMS-11 | MVP | ⬜ | `SupportPackage` pr. site: navn, pris, kvoter (artikler, video, SoMe), fremhævelse; redigerbar uden kode |
| C-02 | Støtteaftaler i UI | CMS-04 | MVP | 🟡 | Model findes; mangler admin-UI: opret, pakke, periode, organisation, kvote; forbrug opdateres ved publicering |
| C-03 | Partnermodul på forsiden | Del 1 §8.1 | MVP | ⬜ | "Lokale fællesskaber" (Fællesskab, roterende) + "Fyrtårnspartnere" (logoer); mærket "Støtter" |
| C-04 | Organisationsprofil | CMS-02 | MVP | ⬜ | `Organization` udvidet: slug, type (virksomhed/forening), logo, beskrivelse, adresse, web; side P-20 |
| C-05 | Kalenderfremhævning | Del 1 §7.1 | Kort efter | ⬜ | Sponsoreret event med mærkning; manuel fakturering |
| C-06 | Profil i guiden (medlemskab) | Del 10 §6 | Kort efter | ⬜ | Profilzone mærket "Profil"; påvirker aldrig redaktionel omtale |
| C-07 | Nyhedsbrevssponsorat | Del 1 §7.1 | Senere | ⬜ | Mærket blok i nyhedsbrevet |

Betaling på sitet er **ikke** en del af MVP. Alt faktureres manuelt.

## 6. SEO og distribution (fase 3)

| ID | Punkt | Status | Acceptkriterium |
|---|---|---|---|
| S-01 | Metadata pr. side | ✅ | `generateMetadata` med titel, beskrivelse (seoTitel/seoBeskrivelse → fallback manchet), canonical |
| S-02 | `sitemap.xml` + `robots.txt` pr. site | ✅ | Kun publicerede artikler; host-afhængig |
| S-03 | `NewsArticle`-schema | ✅ | Inkl. `publisher.publishingPrinciples`, `correction`, `contentLocation` |
| S-04 | OG-billeder | ⬜ | Cover i 1200×630; fallback-kort med site-navn i DESIGN.md-stil |
| S-05 | RSS pr. sektion | ✅ | `/[sektion]/rss.xml` |
| S-06 | Performancebudget | ⬜ | Lighthouse mobil: Performance ≥ 90, Accessibility ≥ 95 på forside, sektion og artikel |

## 7. Netværk (fase 8)

| ID | Punkt | Modul | Status | Acceptkriterium |
|---|---|---|---|---|
| N-01 | Site-konfiguration i UI | CMS-11 | ⬜ | Navn, domæne, accentfarver, sektioner, områder, tekster redigeres uden kode |
| N-02 | Andet site via konfiguration | CMS-12 | ✅ | Seedet alle 5 søstersites (NæstvedLokalt, HolbækLokalt, RingstedLokalt, KøgeLokalt, RoskildeLokalt) med unikke accenter, områder og artikler; host/cookie lookup (**AC-11**) |
| N-03 | Regionale artikler | CMS-12 | ⬜ | Én artikel på flere sites med canonical til hovedsitet |
| N-04 | Netværkslinks i footer | Del 8 §3.3 | ✅ | Links til søstersites i footer og top utility bar med lynhurtig site-switching |
| N-05 | Kvoteloft pr. site for netværkspakker | Del 8 §3.4 | ⬜ | Test beviser, at en netværksaftale ikke omgår loftet på et enkelt site |

## 8. Kort efter MVP (fase 9)

| ID | Punkt | Kilde |
|---|---|---|
| X-01 | Video- og lydafspilning + "Korte videoer"-rail (vises kun ved ≥ 4 videoer) | Del 6 §1.2 |
| X-02 | Automatiske forsideregler | Del 4 §4.1 |
| X-03 | Mest læst / "Top 3 i dag" (privatlivsvenlig tælling i egen DB) | Del 10 §4 |
| X-04 | Læserprofil, følg emne/område, gem artikel | Del 4 §5 |
| X-05 | Kommentarer på udvalgte kategorier med moderation | Del 4 §5.2 |
| X-06 | AI niveau 2 (SEO-forslag, overskriftsvarianter, sociale opslag) | Del 3 §3.2 |
| X-07 | Signals: kommunale dagsordener, politi.dk | Del 3 §2.9 |
| X-08 | Liveblog og "Dagens overblik" | Del 3 §2.1 |
