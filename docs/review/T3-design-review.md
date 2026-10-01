<!-- T3 designreview. Baseline: git HEAD fc7c5d7. Skrevet 2026-10-01. Ingen kildefiler er ændret. -->
# T3 – Designreview: Næstved Lokalt (og søsterbyerne) + statisk prototype

**Metode.** Kørende CMS på `http://naestvedlokalt.localhost:3000` (+ slagelse-, holbaek-, koege-, roskildelokalt) målt og screenshot'et ved 1440, 768 og 375 px (Chrome/CDP, fuld sideskærm) og kontrolleret i Browser-panelet (DOM-målinger, overflow-scan, klik i bundmenuen). Prototypen `nyhedssite.html` er renderet fra `git show HEAD:nyhedssite.html`. Skills anvendt som linse: `web-design-guidelines`, `impeccable` (critique/audit), `ui-ux-pro-max`, `design-taste-frontend`, `refactoring-ui`. Mod spec: `files/DESIGN.md` og `KORT_KONCEPT.md` (rodmappen; findes ikke i `files/`).

**VIGTIGT om tilstand (koordinatorens bemærkning).** Under reviewet begyndte andre agenter at rette i `cms/` (ændrede filer pr. 13:31: `SiteHeader.tsx`, `BottomNav.tsx`, `SectionSheet.tsx`, `SiteFooter.tsx`, `layout.tsx`, `lib/site.ts`, `lib/network-sites.ts`, `styles/site.css`, `api/site/switch/route.ts`).
- **HEAD-baseline (fc7c5d7)** = alle `naestved-*-{1440,768,375}.png` (tydelig markør: netværksbaren hedder "[BY]LOKALT NETVÆRKET:", header uden "Det sker"/"Områder") samt alle `proto-*.png`.
- **Midt i fix-arbejdet** = `naestved-forside-1440-dark.png`, `naestved-nyheder-375-dark.png` og de fire bysider `slagelselokalt|holbaeklokalt|koegelokalt|roskildelokalt-forside-*.png` (netværksbaren hedder "SØSTERMEDIER:"). Farve-/layoutfund fra disse er stadig gyldige, men header/footer/netværksbar er ikke HEAD.
- Fund markeret **[HEAD]** er målt på HEAD-tilstanden; **[MIDT-I-FIX]** er set i den delvist rettede tilstand.

Screenshots ligger i `docs/review/screenshots/`. Navnemønster: `<by>-<side>-<bredde>.png`. Sider: forside, nyheder (sektion), artikel, priser, annoncer (identisk med priser), sponsor, kalender, soeg, stoet (=/bliv-stoette), indsend, tip-os, om-mediet, 404, bliv-journalistik, nyhedsbrev, opslagstavle, profil, gemte, omraade (404), velkommen.

---

## 1. Samlet vurdering

Næstved Lokalt er allerede et genkendeligt, roligt og for det meste velafbalanceret nyhedsdesign: tydelig logo, god typografisk kontrast mellem serif-overskrifter (Newsreader) og sans UI (Inter), ét byaccent der bruges konsekvent (Næstved = Fjord `#1F5663`, præcis fra DESIGN.md-paletten), og et mærkningssystem (AI-assisteret, Finansieret af, Indsendt af, BREAKING, Debat-label) som er synligt uden at larme. Største designgæld er ikke æstetik, men **robusthed og konsistens**: to reelle layoutbrud (artikelsiden på mobil, forsiden på tablet), et kortsystem hvor kompakt-kortet falder fra hinanden i smalle spalter, hardcoded Slagelse-indhold på alle byers forside, og et navigationslag (header/bundmenu) der ikke giver de naturlige næste klik – særligt til **Støt**, **Indsend** og **Kalender**.

Refactoring UI-score (0-10, vægtet på hierarki/spacing/typografi/farve/billeder/layout): **Forside desktop 7,5 · Forside mobil 6 · Sektionsside 5,5 · Artikel desktop 7 · Artikel mobil 3 · Priser 6,5 · Kalender 7 · Søg 5.**

---

## 2. Fund efter alvorlighed

### P0 – Layoutbrud i kerneflow

**P0-1. Artikelsiden er ødelagt på mobil (375 px) [HEAD].**
Layout-viewportet bliver 506 px; H1, manchet og brødtekst klippes i højre side, og en horisontal scrollbar opstår. Bevis: `naestved-artikel-375.png` (sw=506 målt), reproduceret i Browser-panelet; `.site-article-layout` (grid) får et 490 px bredt spor fordi sidespalten `aside.site-section-aside` (nyhedsbrevsformular med input + knap, "Læs også"-partnerkort med vandret layout) har større min-content end 343 px. Rodårsag: `1fr` i stedet for `minmax(0,1fr)` + manglende `min-width:0` på grid-børn (`cms/styles/site.css`, artikel-grid + aside). Ramt: alle artikler på alle byer på telefon. Anbefaling: `grid-template-columns: minmax(0,1fr)` under 1024 px, `min-width:0` på `.site-article-main/.site-section-aside`, lad "Læs også"-kortet stable lodret under 640 px.

### P1 – Alvorlige designfejl

**P1-1. Forsiden har vandret overflow på tablet (768 px) [HEAD].** `.site-middle-3cards-grid` skifter til `repeat(3,1fr)` fra 768 px (`styles/site.css:6386`), men hvert `.site-middle-card` er `flex` med 115 px thumbnail + 44 px padding, så kortet bliver ~269 px og rækken ender på 874 px (`sw=874`). Bevis: `naestved-forside-768.png`. Fix: skift til 3 kolonner først ved ≥1024 px (2 kolonner / lodret stak før), eller thumb under tekst.

**P1-2. Kompakt-kortet kollapser i undersektionsblokke [HEAD].** På sektionssider (`/nyheder`) vises blokkene "Politik", "Trafik", "Skole og børn" med et kort på ~170 px bredde: billedet skæres til en lodret stribe, AI-badge skubber teksten, byline brydes ("Morten / Kaas · 9 / t."), titlen klippes ("Byråd tilføre"). Bevis: `naestved-nyheder-1440.png` (y≈900-1600), `naestved-nyheder-375.png` (blok "Politik"/"Trafik"). Samme kort bruges som "Relaterede historier" på artikelsiden (`naestved-artikel-1440.png`, ~130 px bredt). DESIGN.md §4 forudsætter kompakte kort i 4/12-3/12 lister med 1:1-billede; her er kortet låst til én smal kolonne i stedet for fuld bredde/rækker. Fix: undersektionsblokke = 3 kompakte kort i `grid auto-fit minmax(240px,1fr)`, kompakt-kort som vandret række (lille 1:1 billede venstre, tekst højre) og aldrig under 240 px.

**P1-3. Hardcoded Slagelse-indhold på alle byers forside [HEAD].** `cms/app/(site)/page.tsx` (zone "MELLEMSTE RÆKKE", ~l. 286-340) har tre hardcodede kort ("POLITIK · SLAGELSE BY", "Flere sommerhuse… Skælskør Næs", "Ny butikskæde åbner i Slagelse"), links til `/politik/...` og `/bolig/...` og billeder `slagelse_bymidte.jpg`. Desuden viser opslagstavle-blokken og kalenderen Slagelse/Korsør-poster. Måling: ordene Slagelse/Korsør/Skælskør forekommer 36 (Næstved), 38 (Roskilde), 40 (Holbæk, Køge) gange på forsiderne. Det bryder multi-tenant-løftet i KORT_KONCEPT §4.2 og er det mest synlige tillidsbrud for en Næstved-læser. Også "Seneste nyt" i Næstved viser "Ny butikskæde åbner i Slagelse".

**P1-4. Hero-CTA "LIVE Se trafiksituationen" fører til 404 [HEAD].** Knappen sidder på heroen i alle byer (`/trafik/live` → 404, bekræftet med curl). En primær CTA på forsidens vigtigste flade må aldrig være død; vis den kun når en live-side findes.

### P2 – Betydelige hierarki-/konsistensproblemer

**P2-1. Navigation: Støt, Indsend og Kalender er svære at nå [HEAD].**
- Desktop-header har to ens fyldte knapper ("Indsend historie", "Støt", begge `site-header-btn-solid`) = ingen primær/sekundær. Anbefaling: Støt = fyldt accent, Indsend = outline/sekundær (DESIGN §1 "én primær CTA pr. skærm").
- På mobil og tablet findes ingen af de to i headeren (`site-desktop-only`); de ligger kun i bundmenu-arket under "Mere", nederst i en lang liste. Første mobilskærm har dermed ingen støt-/indsend-vej.
- **Kalender** er hverken i hovednavigationen eller bundmenu-arket (SectionSheet har /qa, /interview, /sponsor, /indsend, /tip-os, /bliv-stoette, /om-mediet, /redaktion men ikke /kalender); kun footer ("Det sker (Kalender)"). DESIGN §8 kræver Kalender i bundmenu. [MIDT-I-FIX: "Det sker" og "Områder" er tilføjet i desktop-headeren, men "Det sker" brydes over to linjer ved 1440 px, se `naestved-forside-1440-dark.png`.]
- Søg findes som ikon i header (desktop og mobil), men ikke som fane i bundmenuen.

**P2-2. Bundmenuen afviger fra spec og er forvirrende [HEAD].** `BottomNav.tsx`: Hjem · Seneste · Emner · Gemte · Mere. "Emner" og "Mere" åbner **det samme ark** (begge `setSheetOpen(true)`). "Seneste" = `/nyheder`, så den lyser også, når man læser sektionen Nyheder. Spec (§8): Forside · Sektioner · Kalender · Søg · Profil, fast 56 px stribe. Implementeringen er en flydende glaspille (rund, blur) som lægger sig over indhold, også ved 768 px (`naestved-forside-768.png`) – DESIGN §1.4 "ingen flydende overlays". Anbefaling: 5 faste faner Forside/Sektioner/Kalender/Søg/Støt (profil og gemte i header/ark), fuld bredde-stribe, 56 px, aktiv fane med accent + label.

**P2-3. Forsiden på mobil er for lang og har forkert rækkefølge [HEAD].** 13 575 px (≈17 skærme) mod 6 379 px desktop. Efter heroen kommer wetter-kort, kort ("Dit nabolag"), nyhedsbrev (~1 000 px nytteflade) før mere nyhedsindhold, og den 900 px høje "Bliv en del af journalistikken"-boks sidder midt mellem nyhedsblokkene (`naestved-forside-375.png`, y≈2300-3600 og 4600-5500). DESIGN §6a.4 siger: Seneste nyt → Tophistorie → Kort nyt → Fra dit område → sektionsblokke → … nyhedsbrev; kalender/guide nederst. Fix: flyt vejr/kort/nyhedsbrev under sektionsblokkene på mobil, gør "Bliv en del af"-blokken kompakt (2 CTA'er, én linje pr. tile) eller til horisontal scroll-snap.

**P2-4. Fire stablede kromlag på mobil [HEAD].** Netværksbar (40 px) + header (66) + sektionsbar (48) + ticker "Seneste nyt" (50) ≈ 205-220 px af 812 før heroen (`naestved-forside-375.png`). Anbefaling: netværksbar skjules på mobil (flyt byskift til arket/footer), ticker + dato-linje slås sammen.

**P2-5. Sektionsblokke på forsiden efterlader tomme huller på desktop [HEAD].** Hver blok (Nyheder/Sport/Erhverv/Kultur/Foreningsliv/Debat) bruger 3/12-kort i et 12-kolonne-grid; Nyheder fylder 3 af 4 slots, Sport/Kultur/Debat kun 1 – to tredjedele af rækken er tom (`naestved-forside-1440.png`, y≈2100-4500). Resultat: lang, uroligt hullet side i stedet for "luft". DESIGN §5: 4 standardkort pr. blok. Fix: blokke med <3 artikler skjules eller samles i "Mere fra Kultur & Sport"; bloktemplate = 1 stort + 2 kompakte i række.

**P2-6. Sektionsside mangler spec-elementer [HEAD].** DESIGN §6a.3 kræver: undersektionspiller (ok, findes), områdefilter (ok), top 1+2 (ok), undersektionsblokke (brudt, P1-2), **kronologisk liste med dato-skillelinjer + "Vis flere" (mangler)** og sidespalte "Mest læst" + nyhedsbrev (findes). Samme artikel optræder 3 gange på siden (top, "Trafik"-blok, "Skole og børn"-blok): den samme `Trafikvarsel…` ses både i top og i Trafik-blokken.

**P2-7. Artikelsiden er en blindgyde [HEAD].** Efter brødteksten: tags, ét relateret kort (en partner-artikel om røgeri, uden emnemæssigt slægtskab) og nyhedsbrevsboks. Ingen "Støt", "Indsend tip", "Mere i Trafik/Karrebæksminde", "Næste artikel" eller del/følg-område i bunden (DESIGN §6 punkt 9-12). Desktop-sidespalten gentager nyhedsbrevet (to nyhedsbreve + "Læs også" = samme partner-artikel som "Relaterede historier"). På mobil er nyhedsbrevet også duplikeret (aside + inline, `naestved-artikel-375.png`). Der er ingen fotokredit i billedtekst, kun "Trafiksikkerheden opgraderes i flere kryds."
Links der *er* på siden (curl): forfatter, område (`/omraade/karrebaeksminde`), `/nyheder/trafik`, rettelser, principper, privatliv (404, se T2), kalender i footer.

**P2-8. Brødkrummer er visuelt ødelagte på alle undersider [HEAD].** "Forside" og efterfølgende led står på forskellig grundlinje, separatorer er usynlige, og på artikel/priser/sponsor vises sidens titel som sidste led i accentfarve uden separator (`naestved-artikel-1440.png` øverst, `naestved-priser-1440.png`, `naestved-sponsor-1440.png`). På sponsor/priser er stien også logisk uens: "Forside / Bliv en del af journalistikken / Priser & Annoncering" vs. URL `/priser`. Komponenten: `components/site/Breadcrumbs.tsx`.

**P2-9. Typografiske minimumsstørrelser brydes [HEAD].** Måling på forsiden: 37 tekstnoder er 11 px, 23 er 12 px, 82 er 13 px (kategori-labels, badges, bylines, dato, mærkning). DESIGN §2.4: metadata 14 px, "tertiær tekst aldrig under 14 px", badge 12 px. Hero-kicker er 11,5 px fersken (`rgb(243,194,178)`) oven på fotografisk gradient (lav, ikke målbar kontrast, svinger med billedet). Input-placeholder er ink ved 50 % alpha (≈3:1). `--ink-3` (#756D64) mod paper giver 4,7:1 – kun OK ved ≥14 px. Fix: kategori- og byline-tokens ≥ 13 px/14 px, badges 12 px, hero-kicker på mørk plade eller hvid 14 px.

**P2-10. Billedbrug er ujævn og ser "placeholder" ud [HEAD].** Kun 4 fotografier (fodbold, å, læserbrev, butik) + prototypens gengivelser; resten er flade SVG-illustrationer (vej, hus, bolde, bygninger, taleboble) i store 3:2-felter som fylder ~45 % af kortet og ikke bærer information. De samme illustrationer gentages (samme hus ved to artikler, samme bygninger ved to). Et "Debat"-kort viste blankt billedfelt i desktop-capture (`naestved-forside-1440.png`, nederst) – sandsynligt lazy-load, men feltet har ingen skeleton/fallback. Hero i Holbæk/Køge/Roskilde har illustrationens streger (fodboldbane, cirkel) liggende bag overskriften (`holbaeklokalt-forside-375.png`, `koegelokalt-forside-375.png`, `roskildelokalt-forside-375.png`). Anbefaling: redaktionelle fotos (eller tydelig stock-ramme), illustrationer kun som fallback i lille størrelse (1:1 kompakt), og scrim bag hero-tekst.

**P2-11. /priser, /annoncer, /sponsor [HEAD].**
- `/annoncer` er pixel-identisk med `/priser` (samme højde 3575/4663/7221 px) – to URL'er, én side.
- Prisen brydes: "125 / kr.", "4.995 / kr.", "4.495 / kr." står på to linjer i prisfeltet (`naestved-priser-1440.png`), fordi beløb og enhed er i samme flex-række uden `white-space:nowrap`.
- Siden nævner en navngiven konkurrent ("Min By Media") med gennemstregede "markedspriser" og ">75 % rabat"/"25 %"-påstande – brand-/markedsføringsmæssig risiko og ikke i tone med "roligt".
- Gentagen em-dash i brødtekst ("…for alle — fra den lokale forening…").
- Syv-felts brief-formular + partnerkode-boks før man har set et eksempel; /sponsor gentager samme prisoversigt og samme formular. Ingen eksempel på hvordan et *Sponsoreret*-kort ser ud (hvilket er selve salgsargumentet).
- Positivt: tre produktkort + tre partnerkort er rene, hierarkiet "Mest populære/Anbefalet" er tydeligt, accent bruges konsekvent.

**P2-12. Kalender [HEAD].** Pæn, rolig liste (`naestved-kalender-1440.png`), men: (a) begivenhedskortene er ikke links (ingen eventside, ingen "Læg i kalender") og har hverken billede, datobadge-placering eller "Billet"-knap som DESIGN §4/§7.1; (b) mangler områdefilter (spec kræver område); (c) viser Korsør/Slagelse/Skælskør/Trelleborg-arrangementer under Næstved; (d) første kort viser "30. SEP · I dag" mens sidens dato er 1. oktober (forældede seed-data), så relativ tid kan ikke stoles på; (e) månedsbadgen er ink, ikke site-accent.

**P2-13. "Seneste nyt"-rækkefølgen er ikke kronologisk [HEAD].** Forsidens liste viser 07.39, 09.39, 08.39, 22:11, 21:05 – både stigende og faldende klokkeslæt uden dato. Kombineret med "Opdateret 08.39" og "4 t." i tickeren undergraver det tidsløftet "seneste".

### P3 – Mindre / opfølgning

- **P3-1. Spec-drift.** DESIGN.md siger kortradius 8 px, Bricolage Grotesque + Literata og `--site-accent` tegl for alle byer; implementeringen bruger `--radius-card: 18px` (i tråd med projektets egen beslutning), Newsreader + Inter og per-by accent via inline `--site-accent` på `.site-wrapper`. Opdater DESIGN.md til virkeligheden (18 px, fonte, tokens). Radius-skalaen har 10 forskellige værdier (4, 6, 8, 10, 12, 14, 16, 18, 24 px + 50 % + pille); reducér til 4 / 10 / 18 / pille.
- **P3-2. Søg uden fund / tom side.** `/soeg` uden forespørgsel viser kun én gråtekst; "Ingen resultater" mangler forslag (populære emner, sektioner, "Indsend tip"). 404-siden er derimod god (CTA'er + populære sektioner, `naestved-404-1440.png`) – brug samme mønster.
- **P3-3. `/bliv-stoette` er rent og fokuseret** men er en "kort-i-side" med egen mini-header ("Tilbage / NæstvedLokalt / hjerte") inden i en 520 px boks inde i siden – dobbelt chrome. Fjern intern header på desktop.
- **P3-4. Info-tæthed i hero.** Hero har kicker, 5-linjers overskrift (36 px), manchet, primær CTA, forfatter og en ekstra "LIVE"-knap; på 375 px bliver overskriften 6 linjer og manchetten skubbes under bundmenuen. Kort overskriften til maks 3 linjer (CMS-grænse ~90 tegn) eller skaler 28/32 px på mobil.
- **P3-5. Berøringsmål.** 33 links/knapper <44 px i de første 3000 px på mobil (kategorilabels, bylines, bogmærke-ikon, tabs "Mest læst"/"Analyse"). Tabs under "Mere fra Næstved" er tæt og "Udvalgt til dig" brydes over to linjer ved 375 px.
- **P3-6. Mørk tilstand.** Bevidst ingen mørk tilstand (`color-scheme: light`, site.css:56; DESIGN §13 "ingen mørk tilstand"). Verificeret med `prefers-color-scheme: dark`: siden er pixel-identisk (`naestved-forside-1440-dark.png`). Ingen handling, men dokumentér i footeren/README så det ikke "rettes".
- **P3-7. Konsol.** Ingen applikationsfejl. Kun udviklingsadvarsler: Next "LCP image … add loading=eager" (hero-SVG'er som `/media/byraad.svg`, `/media/debat.svg`, `/media/natur.svg`; heroen mangler `priority`) og dev-only "Failed to execute 'measure'… negative time stamp" på 404/omraade. `/omraade/korsoer` er korrekt 404 på Næstved.
- **P3-8. Fyrtårnspartnere** vises som tekstchips med reelle danske virksomhedsnavne (T6 vurderer regler); designmæssigt bør partnerlogoer/ordmærker få fast højde, "Støtter"-mærkning og ikke samme chip-stil som navigationspiller.

---

## 3. Det der virker godt

- **Mærkningssystemet er synligt og konsistent**: AI-assisteret (stiplet ramme + "godkendt af Morten Kaas"), Finansieret af (blå flade + ramme + badge), Indsendt af (grøn stiplet), BREAKING-chip og "Kommentarer:"-label på Debat. Mærkningen bæres af tekst + ramme + form, ikke kun farve (DESIGN §1.5). Forside og artikel: `naestved-forside-1440.png`, `naestved-artikel-1440.png`.
- **Per-by accentfarve håndteres rent via CSS-variabler** (`--site-accent`, `-strong`, `-soft`, `--site-on-accent` på `.site-wrapper`). Næstved = Fjord, Slagelse = tegl, Holbæk = mos, Køge = skov, Roskilde = lyng – ticker-badge, logo "Lokalt", CTA, pille, hero-plade, byprik i netværksbaren skifter samtidigt (se `m_c375`-sammenligning i bysider). Rav er korrekt holdt fri til annonce.
- **Typografi**: Newsreader på overskrifter (letgenkendelig avis-tone) + Inter UI; artiklens brødtekst 19 px/1.6, 640 px spalte; god H1→manchet-skala.
- **Kortsystemet** (18 px radius, tynd streg, ingen tung skygge) er enhedligt på forside og sektion; "Mere fra"-kortene (4-kolonne foto-kort, `naestved-forside-1440.png` y≈1100-1550) er det bedste eksempel på kortet som det bør se ud.
- **Mobilarket "Udforsk NæstvedLokalt"** følger DESIGN §6a.2 godt: sektioner med undersektioner foldet ud, 2 kolonner, tydelig luk.
- **Rolig tone**: ingen bannere, ingen sporing, tydelig footer-forpligtelse ("Forpligtet på de presseetiske regler…").
- **404 og /bliv-stoette** er klare, fokuserede og har logiske næste klik.
- **Ingen mørke mønstre** i priser; afkrydsning/afmelding i nyhedsbrevsformularen er tydelig.

---

## 4. By-skift og accentfarver (5 byer set)

| By | Accent | Hero | Bemærkning |
|---|---|---|---|
| Slagelse | tegl `#a83818` (token-default) | brun/grå gradient | `slagelselokalt-forside-375.png`; på mobil sw=385 (10 px overflow, skal undersøges) |
| Næstved | fjord `#1F5663` | grå/brun gradient | baseline i alle `naestved-*` |
| Holbæk | mos/oliven | mørkegrøn plade + fodboldbane-illustration | grøn og Køge-grøn ligner hinanden |
| Køge | skov (mørkegrøn) | mørkegrøn plade | **næsten ikke til at skelne fra Holbæk** i header/CTA; vælg Okker eller Tegl-variant til den ene (DESIGN: "brug hver farve ét sted") |
| Roskilde | lyng/blommefarve | blomme-plade + cirkelillustration | tydelig; stærkest identitet |

Problemer: (1) hero-baggrund er enten fotografisk (Slagelse/Næstved) eller flad farvet illustration (Holbæk/Køge/Roskilde) – tre forskellige hero-sprog på samme template; (2) netværksbaren i CMS har 6 byer (Slagelse, Næstved, Holbæk, Ringsted, Køge, Roskilde) mod 7 i prototypen (inkl. Kalundborg); Ringsted har ingen kørende host i dev-opsætningen her; (3) `body` er `rgb(248,249,253)` (køligt) mens `--paper` er varm `#f8f6f1`: siden skifter synligt fra varm til kold baggrund midt på siden (`naestved-nyheder-1440.png` y≈640 og `naestved-artikel-1440.png` y≈590), fordi paper-gradienten kun dækker første viewport.

---

## 5. Statisk prototype vs. kørende CMS (look & feel)

Prototypen (`proto-slagelse-1440.png`, `proto-naestved-1440.png`, `proto-*-375.png`, renderet fra HEAD) og CMS'et er **to forskellige designsprog**:

| Dimension | Prototype `nyhedssite.html` | CMS-site |
|---|---|---|
| Netværksbar | mørk navy, 7 byer inkl. Kalundborg, "LIVE:"-ticker til højre | sort, 5-6 byer, ingen live |
| Header | stor logo med tagline, byvælger-pille, 7 links, **"Støt Næstved"**-knap (rød hjerte-emoji) | logo + 6 links + to ens knapper, 56 px |
| Hero | stor fotografi (Storebælt/solnedgang) med hvid CTA | grå/farvet plade + SVG-illustration, accent-CTA |
| Billeder | rigtige fotografier overalt (men samme 8 gengives i alle byer) | 4 fotos + mange flade SVG-illustrationer |
| Støtte-CTA | fuld bredde grøn "Vær med til at præge NæstvedLokalt"-bånd (Indsend/Støt) | Ingen tilsvarende; kun header-knap + opslagstavle/"Bliv en del af"-blok |
| Farve | én grøn (fælles `#0d5c46`-agtig) uanset by, kun byprik ændrer | accent skifter pr. by overalt |
| Kort | 3 store fotokort + 4 "Mere"-kort | fem korttyper, mærkede varianter |
| Mærkning | ingen mærkningsbadges | AI/Partner/Indsendt synlige |

By-skiftet i prototypen er kun delvist: hero-fotoet (Storebælt), kortbillederne og tre fremhævede kort forbliver identiske på tværs af byer; "Dit nabolag" viser "Roskilde By: Roskilde By:"/"Næstved By: Næstved By:" (dobbelt præfiks) og kortbilledet er altid "West Haven Municipality". På 375 px er headeren i prototypen reelt tom (hvid stribe, intet logo; `proto-slagelse-375.png` y≈40-100) før pillenavigationen. Konklusion: **prototypen vinder på fotografi, hero og støtte-CTA; CMS'et vinder på mærkning, tillid, byaccent og sektionsstruktur.** Anbefaling: behold CMS'ets tokens/mærkning, hent fra prototypen (a) fotohero med scrim, (b) "Vær med"-båndet som fast, rolig støtte-modul under sektionsblokkene, (c) "Støt {by}"-knap-ordlyden.

---

## 6. Klikstier – logisk næste klik pr. side

| Side | Næste logiske klik i dag | Mangler |
|---|---|---|
| Forside | hero → artikel; "Se alle i Sport" osv.; Opslagstavle; Bliv en del af | Kalender-modul (zone 6) og Guide (zone 9) findes ikke; Støt kun via header (desktop) |
| Sektion (`/nyheder`) | underemner (piller), Mest læst, område | "Vis flere"/kronologisk liste, link til kalender/tip |
| Artikel | forfatter, område, `/nyheder/trafik`, relateret, nyhedsbrev | Støt, Indsend tip, "Mere fra", del/gem i bund, næste artikel |
| /priser, /sponsor | formular, partnerkode, produktknapper | "Se et eksempel" (levende sponsoreret kort), link til /om-mediet/redaktionelle-principper fra mærkningsboksen |
| /kalender | "Indsend arrangement" ×2 | eventside, "Læg i kalender", områdefilter, link til relaterede artikler |
| /soeg | – | forslag, populære emner |
| 404 | forside, søg, sektioner | – (god) |
| Footer | alle sektioner + om mediet + netværk | Støt/nyhedsbrev-CTA, sociale kanaler (DESIGN §8) |

---

## 7. Konkrete designanbefalinger (prioriteret)

1. **Fix grid/overflow (P0-1, P1-1)**: `minmax(0,1fr)` + `min-width:0` på artikel- og forsidegrid; 3-kolonners "midterrække" først ved ≥1024 px; kør en overflow-test (`scrollWidth ≤ innerWidth`) på 375/768/1440 for alle sider som visuel regressionstest.
2. **Ét kompakt-kort**: vandret (1:1 thumb 88 px + tekst), `min-width: 240px`, brugt i undersektionsblokke, "Relaterede", "Læs også" og søgeresultater. Badge-rækken (AI, Partner) lægges som tekstlinje over titlen, ikke som overlagt kasse.
3. **Fjern/parametrisér alle hardcodede forside-kort** (`page.tsx` midterrække) – hent fra tophistorie 2-4; skjul tomme zoner (DESIGN §5 zone 11-regel gælder alle).
4. **Navigationsmodel**: header = Logo · sektioner · Søg · Støt (primær) · Indsend (sekundær) · by-vælger i footer/ark; bundmenu = Forside · Sektioner · Kalender · Søg · Støt; Kalender og Områder i header. Fjern dobbelt-ark ("Emner" = "Mere").
5. **Artikel-bund-modul (logisk næste klik)**: "Mere fra {område}" (3 kompakte) → "Støt lokaljournalistik" (én rolig boks, ikke to nyhedsbreve) → "Har du et tip?". Fjern duplikeret nyhedsbrev og samme partnerkort i både "Læs også" og "Relaterede".
6. **Brødkrummer**: genopbyg som `nav[aria-label=Brødkrumme] ol` med "›" separatorer, 14 px, sidste led ikke-link i ink; ret stien på /sponsor og /priser til Forside › Priser.
7. **Typografiskala**: metadata ≥13/14 px, badges 12 px, hero-kicker 14 px på scrim; placeholder ≥4,5:1. Definér 4 radius-tokens.
8. **Billedstrategi**: fotos til hero og toppen af sektionerne, illustrationer kun som 1:1 fallback; hero-scrim (`linear-gradient(to top, rgba(0,0,0,.65), transparent 60%)`) også til illustrerede heroer; fast aspect-ratio + skeleton for at undgå blanke felter og CLS.
9. **Forsidens rytme**: vis sektionsblokke kun med ≥3 artikler (ellers fold til "Mere fra Sport & Kultur"); desktop-forsiden bør falde fra ~6 400 px til ~4 500 px. Mobil: flyt vejr/kort/nyhedsbrev til efter sektionerne.
10. **Prissiderne**: slå `/annoncer` sammen med `/priser` (301 + canonical), tilføj `white-space:nowrap` på pris/enhed, fjern navngivet konkurrent og gennemstregede markedspriser eller læg dem i juridisk gennemgang, vis et eksempel-kort pr. mærkningstype (Partner/Sponsoreret/Indsendt) – det bedste tillids- og salgsargument, og det der mangler.
11. **Tillidssignaler**: tilføj "Sådan arbejder vi"-link i mærkningsboksen og under H1 på partnerartikler; vis "Rettet [dato]" når relevant; "Uafhængig journalistik" står i KORT_KONCEPT som eksplicit mærkat, men er "ingen mærkning" i DESIGN – afklar og skriv det i begge dokumenter.
12. **Kalender**: eventkort = link til eventside med datobadge i site-accent, område-filter, "Læg i kalender (.ics)", og skjul/arkivér forældede dage; tilføj kalender til forside (zone 6) som 3-4 kort.
13. **Tom-/fejltilstande**: Søg (forslag), tom sektion ("Ingen historier i Sport endnu – indsend en"), manglende billede (skeleton + neutral fallback), formularfejl (inline under felt) – brug 404-sidens mønster som skabelon.
14. **Byfarver**: ændr Køge til Okker eller Fjord-variant for adskillelse fra Holbæk; ensret hero-sprog (foto + scrim) på tværs af byer; ret `--paper` vs `body` baggrund til én værdi.
15. **Prototypen**: erklær den "fastfrosset reference" – al ny design i CMS'et; hvis den fortsat skal bruges: hent byvariablerne (hero/billeder/kort) fra byens data, ret "By: By:"-præfiks og tom 375-header.

---

## 8. Regressionsnotat for andre agenter (midt-i-fix)

- "Det sker" (ny header-link) brydes til "Det / sker" ved 1440 px i `naestved-forside-1440-dark.png`; tilføj `white-space:nowrap` og evt. flyt Søg-ikonet. Header skal rumme 8 links + 2 CTA + ikoner ved 1024-1280 px – test.
- `slagelselokalt-forside-375.png` viser `sw=385` (10 px overflow) – ny netværks-/footer-ændring eller eksisterende; kontrollér efter fix.
- Netværksbarens label er ændret fra "[By]Lokalt netværket:" til "Søstermedier:" – DESIGN §8 kalder footer-sektionen "Netværket"; vælg ét navn.

## 9. Bilag: målinger

- Forside-højde: 1440 → 6 379 px; 768 → 9 193 px; 375 → 13 575 px.
- Overflow: forside@768 sw=874; artikel@375 sw=506; øvrige sider ok.
- Fonte: Newsreader (47 noder), Inter (152). Tokens: `--radius-card 18px`, `--radius-md 10px`, `--radius-lg 16px`, `--radius-img 14px`, `--radius-badge 6px`.
- Tekststørrelser (forside, løvnoder): 11 px×37, 12 px×23, 13 px×82, 14 px×104, 15 px×17, 17-22 px×27, 36 px×1.
- Sider med 404: `/trafik/live`, `/om-mediet/privatliv`, `/omraade/korsoer` (korrekt for Næstved).
- 307: `/stoet` → `/bliv-stoette`; `/tip-os` → `/indsend?kategori=tip`; `/partner` → login.
