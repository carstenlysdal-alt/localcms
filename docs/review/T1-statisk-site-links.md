<!-- Baseline: localcms HEAD fc7c5d7 (2026-10-01). Fil: nyhedssite.html (3177 linjer), genereret af build_nyhedssite.py. -->
# T1 – Link- og klik-audit af det statiske nyhedssite

**Omfang:** `/Volumes/SSD Data/Gits/localcms/nyhedssite.html` ved HEAD `fc7c5d7` (arbejdsmappen er identisk, `cmp` bekræftet). Ingen kildefiler er ændret.
**Metode:** (1) Python-udtræk af alle `href`, `onclick`/`on*`, `switchCity(...)`, `id` og `getElementById`-kald; (2) parsing af `CITIES_DATA`-JSON for alle 7 byer; (3) manuel kortlægning af klik-flow og kort-til-mål; (4) trace af alle JS-handlers efter `click-path-audit`-skillet; (5) runtime-bekræftelse i egen browser-fane (serveret fra en kopi i scratchpad, `http://127.0.0.1:8765/`, da `file://` blev afvist af browser-panet). Scripts ligger i scratchpad (`extract.py`, `cards.py`, `cities.py`), ikke i repoet.
**Linjenumre:** HTML-linjer angivet som `L####`. I `build_nyhedssite.py` ligger JS ca. **HTML-linje + 180** (fx `submitTipMode`: HTML L3093 = script L3273; `hero-meta`: HTML L2915 = script L3095). Planens "script l. 2956" er fra arbejdsmappen før `4578f5c` og passer ikke længere. Ret derfor altid i `build_nyhedssite.py`, aldrig i HTML-filen.

## 0. Nøgletal

| Mål | Værdi |
|---|---|
| Unikke ids i body | 116 (ingen duplikater) |
| `href`-forekomster | 104 (21x `#forside`, 9x `#stoet`, 7x `#indsend` m.fl.); 0 eksterne links; 1x `javascript:void(0)` |
| Døde ankre i statisk HTML | **4 forekomster / 3 unikke** (`#art-kultur` 1, `#art-foreningsliv` 2, `#nabolag` 1) |
| Døde ankre i `CITIES_DATA.wire` | **5** (`#art-kultur` i Næstved, Holbæk, Ringsted, Køge, Roskilde) |
| Døde ankre ved runtime, uanset valgt by | altid 3 unikke (`art-kultur`, `art-foreningsliv`, `nabolag`) |
| Artikler der findes | **7** (`art-storebaelt`, `-byraad`, `-sommerhuse`, `-butik`, `-sport`, `-tudeaa`, `-debat`) |
| Kort-/wire-links i HTML | 31 (hero 1, wire 5, mellemkort 3, 4-grid 4, 6 sektioner x3 = 18) |
| Heraf: mål passer til kortets emne | 18 · delvist 3 · **forkert 7** · **dødt 3** (+1 dødt anker i bundbaren) |
| Wire-links i 6 ikke-Slagelse-byer | 30 – **0** peger på en artikel om byens egen sag (alle er Slagelse-historier, 5 er døde) |
| Runtime-fejl i konsol | 1 (P0, `currentCity`), men den rammer alle 4 formularer |

Siden er **én lang scroll-side**: 12 sektioner og 7 artikler ligger stablet og er altid synlige (`article-full-page` har `display:block`), og "navigation" er hash-ankre med `scroll-margin-top:80px` (header er 74 px sticky, så mål ligger korrekt under headeren). Der er ingen routing, ingen `:target`-styling, ingen `hashchange`/IntersectionObserver. Det forklarer mange af fundene nedenfor: tilbage-links, aktiv-state og by-skift er ikke koblet til nogen tilstand.

---

## 1. Fund rangeret efter alvor

### P0 – kritisk

**P0-1 · `submitTipMode` bruger udeklareret `currentCity` – alle 4 formularer er døde**
- Evidens: HTML L3093 (`const c = currentCity || CITIES_DATA['slagelse'];`, script L3273). Der findes ingen global `currentCity`; de andre funktioner deklarerer en lokal `const currentCity` (L2976, L3056, L3067), men `submitTipMode` gør ikke. Det globale state-navn er `currentCityKey` (L2851).
- Runtime bekræftet: `form.requestSubmit()` på `#form-tip-tip` giver `Uncaught ReferenceError: currentCity is not defined at submitTipMode`. Konsollen viser fejlen; der kommer ingen `alert`, ingen bekræftelse, formularen nulstilles ikke. Det samme gælder `event`, `sponsor` og `citat` (samme linje kører først). Det er hele "Tip os / Arrangement / Sponsoreret artikel / Giv et citat"-flowet, og Priser-sektionens 7 knapper ender i netop dette flow.
- Mønster (click-path-audit): *Missing State Transition* – knappen "Indsend ..." lover indsendelse, men handleren kaster før den gør noget.
- Fix i `build_nyhedssite.py` (linje 3273): `const c = CITIES_DATA[currentCityKey] || CITIES_DATA['slagelse'];`. Tilføj samtidig efter `alert`: `form.reset()` og en synlig bekræftelse i DOM frem for `alert()`. Tilføj en test, der kalder alle fire `submitTipMode(...)` uden fejl.

### P1 – høj (brudte klik og forkert indhold, som brugeren oplever som fejl)

**P1-1 · Tre døde artikel-/områdeankre**
| Anker | Forekomster (HTML-linje) | Hvad brugeren ser |
|---|---|---|
| `#art-kultur` | L1890 (kort "Kulturhuset afslører stærkt forårsprogram"); wire-data i Næstved, Holbæk, Ringsted, Køge, Roskilde | Klik ændrer kun URL-hash, siden bevæger sig ikke |
| `#art-foreningsliv` | L1722 (4-grid "120 frivillige hædret"), L1933 (Foreningsliv-sektionen, samme historie) | Samme |
| `#nabolag` | L2779 (mobil bundbar "Mit område", `id="mbar-area"`) | Samme, på mobilens primære tab-bar; aside'n `site-nabolag-card` har intet id |

Fix: opret artiklerne `art-kultur` og `art-foreningsliv` (eller peg kortene på eksisterende artikler hvis de kun er demo), og giv `<aside class="site-nabolag-card">` `id="nabolag"` (+ `scroll-margin-top`). Tilføj et build-trin/test, der fejler hvis et `href="#x"` (også fra `CITIES_DATA.wire`) ikke findes som id.

**P1-2 · By-switcheren skifter overskrifter, men alle wire-links fører til Slagelse-artikler**
- Evidens: `CITIES_DATA.wire` (3. element pr. række) bruger kun de 7 Slagelse-ankre. Eksempler (alle bekræftet i `cities.py`):
  - Næstved "Lokale fiskere i Karrebæksminde fejrer forårssæsonen" → `#art-butik` (artiklen er "Ny butikskæde åbner i centrum").
  - Næstved "Susåen sikres med nyt vådområde ved Herlufsholm" → `#art-tudeaa` (Tude Å, Slagelse).
  - Holbæk "Isefjordens fuglereservater …" → `#art-tudeaa`; Køge "Køge Å-stien renoveres" → `#art-tudeaa`.
  - Køge har to wire-punkter (06:30 Herfølge springhal, 22:10 HB Køge) der begge peger på `#art-sport`.
  - Kalundborg: to punkter peger på `#art-butik`; "Novo Nordisk"-hero og "Krydstogtsæson" ender i Slagelse-historier.
- Konsekvens: 0 af 30 wire-links i 6 byer fører til en historie om byens egen sag; 5 er døde. For en bruger i Næstved lover forsiden Næstved, men klik giver Slagelse (artikeltekster nævner Korsør, Nytorv, Harboe Arena).
- Fix: kort sigt – giv hver by egne artikler (eller generér stubs pr. wire-punkt, `art-{by}-{n}`), så links altid har et mål. Mellemsigt – flyt artikler og kort til `CITIES_DATA[by].articles` og render sektionerne fra data (se P1-3). Indtil da: fjern link/gør punkterne ikke-klikbare ("kommer snart") hellere end at sende til forkert by.

**P1-3 · Hero, ticker, sektionskort, artikler og søgning forbliver Slagelse ved by-skift (kun overflade skiftes)**
- Runtime-dump pr. by (alle 7): `heroHref` er `#art-storebaelt` i alle byer; `heroBgClass` forbliver `img-storebaelt` (`hero_img` i data bruges aldrig, se L2910-2920); ticker ("LIVE: Storebæltsbroen …", `#net-ticker-text`, L1389) opdateres aldrig; første kort i Nyheder er altid "Kødannelse på Storebæltsbroen"; `document.title` og `price-section-desc` ("På SlagelseLokalt …", L2094) forbliver Slagelse; `stories`-søgeindekset (L3114) er Slagelse-artikler.
- Næstved-hero siger "Ny havne- og klimapromenade … Karrebæksminde" men klik åbner Storebælt-artiklen, og billedet er Storebælt. Det er det mest iøjnefaldende klik-brud, fordi det er den største klikflade på forsiden.
- Fix: udvid data pr. by med `hero_href`, `hero_img` (anvend den: sæt `className` på `.site-hero-bg-layer`), `ticker_text`/`ticker_href`, og et by-specifikt `stories`-array. Opdatér `document.title` og `price-section-desc`. Se også T3 for designdelen.

**P1-4 · Slagelse er ikke idempotent: at vælge Slagelse ændrer forsiden**
- Statisk HTML har 5 wire-punkter og hero "…efter trafikuheld" med kicker "BÆLTET · STOREBÆLT" og byline "Jonas Vestergaard · 2 t. siden". `CITIES_DATA.slagelse.wire` har kun **3** punkter med andre overskrifter/tider ("Dagens overblik: Det besluttede Slagelse Byråd" → `#art-byraad`), kicker "TRAFIK · STOREBÆLT".
- Runtime: `switchCity('slagelse')` giver `wire` = `[#art-byraad, #art-byraad, #art-sommerhuse]` (2 punkter peger nu på samme artikel). Fordi `DOMContentLoaded` kalder `switchCity(saved)` for en gemt by (L3169-3173, `localStorage.valgt_by`), ser Slagelse-læsere forsiden ændre sig ved genindlæsning/klik på "Slagelse".
- Fix: gør Slagelse-dataene identiske med den statiske markup (eller render altid forsiden fra data ved load, også for Slagelse), og kald kun `switchCity` hvis den gemte by afviger fra standard.

**P1-5 · 7 kort peger på urelaterede artikler (emne ≠ mål)**
Se linkmatrixen i afsnit 2. Kort: Erhverv "Erhvervspark ved motorvejen" og Sport "Svømmeklubben" → `#art-byraad`; Erhverv "Kystturismen" og Kultur "Historiske herreborge" → `#art-sommerhuse`; Sport "Løbeklub/forårsløb" → `#art-tudeaa`; Kultur "Gratis kreative workshops" og Foreningsliv "Lektiehjælpere" → `#art-debat`. Plus 3 delvist forkerte (Naturvennerne→Tude Å, Debat-replik→Byråd-nyhed i stedet for replik, Pendlerdebat→Storebælt-nyhed). Samme historie har desuden 3–4 forskellige overskrifter (fx sommerhuse: "ved Skælskør Næs" i wire/søgning, "ved kysten" på kort, "langs kysten" i artikel).
Fix: ét kort = én artikel med samme overskrift; flere kort end artikler er kun legalt hvis kortene er markeret som demo/ikke klikbare. Generér kort fra den samme artikeldatakilde, så overskrift, kicker og link ikke kan divergere.

### P2 – medium

**P2-1 · Hero-byline: forkert id og tabt forfatter.** JS bruger `getElementById('hero-meta')` (HTML L2915) men elementet hedder `hero-meta-byline` (L1555). Runtime bekræftet: byline står som "Jonas Vestergaard · 2 t. siden" i alle 7 byer. Rettes id'et alene, erstattes hele bylinen med `hero_meta` = "2 t. siden", så forfatteren forsvinder (data har ingen forfatter). Fix: tilføj `hero_author` i data og sæt `` `${data.hero_author} · ${data.hero_meta}` `` på `#hero-meta-byline`.

**P2-2 · `wire-kommune-name` findes ikke** (HTML L2923). Intet element har id'et; sektionsoverskriften "Seneste nyt" (L1575) viser ikke kommunen. Fix: fjern kaldet, eller sæt `id="wire-kommune-name"` på et span ("Seneste nyt i {kommune}").

**P2-3 · "Dit nabolag": dobbelt præfiks og forkert første område.** `switchCity` renderer `<strong>${omraader[0]}:</strong> ${nabolag_text}`, men `nabolag_text` indeholder allerede "Område: ...". Runtime: "Næstved By: Næstved By: Omfattende renovering …" (samme i Slagelse, Holbæk, Ringsted, Roskilde, Kalundborg). Køge: "Køge By: Køge Nord: Nye grønne …" (teksten hører til område nr. 2). Fix: fjern præfikset fra `nabolag_text` i data, og knyt tekst til område (`omraader: [{navn, tekst}]`).

**P2-3b · Områdepiller er blindgyder.** `setNabolagArea` (L2972) skriver kun en generisk fylde-sætning ("Aktuelle projekter, byggeplaner og lokale aktiviteter i X (…)") og linker ingen steder hen. Dit nabolag har ingen vej til områdets historier, og de fleste byers områder (Korsør, Skælskør, Karrebæksminde, Orø m.fl.) har ingen artikler. Se afsnit 4.

**P2-4 · `is-active` opdateres aldrig for navigation.** Kun by-skift (`net-btn-*`, `drop-item-*`), støtte-/tip-faner, nabolag-piller og beløbsknapper har opdateret state. Statisk `is-active` hænger for evigt på: desktop-nav "Forside" (L1449), mobil-pill "Nyheder" (L1489, som i øvrigt peger på `#forside`, ikke `#nyheder`) og bundbar "Hjem" (`mbar-home`, L2775). Ingen scroll-spy og ingen `hashchange`. Fix: `IntersectionObserver` på `main > section`, der sætter `is-active` på nav-link, pill og bundbar-item med matchende `href`.

**P2-5 · Hurtigsøgnings-chip "Byråd" giver 0 resultater.** `setSearchTerm('Byråd')` → `runLiveSearch('Byråd')` matcher kun `title`/`cat`; ingen titel indeholder "byråd" (kategori er "Politik"), og placeholderen opfordrer til "byråd". Runtime: Storebælt 1, **Byråd 0**, Erhverv 1, Sport 1. Søgeindekset omfatter kun de 7 artikler; "kultur", "foreningsliv", "Korsør", "Næstved" giver 0 selv om sektionerne findes. Fix: tilføj søgeord/`tags` pr. historie, og indeksér sektioner og områder; by-afhængigt indeks.

**P2-6 · CTA'er der lover én tilstand men lander i en anden (state ikke opdateret).**
- "Støt med valgfrit beløb" (fællesskabsbanner L1683 og footer "Støt med valgfrit beløb") → `#stoet`, men `supportMode` er `'fast'`; fanen "Valgfrit beløb" skiftes ikke. Fix: `href="#stoet" onclick="setSupportMode('valgfri')"` eller `#stoet?mode=valgfri` + hash-parser.
- Partner-boksen "Vil din virksomhed også støtte? Bliv partner her →" (L1738) → `#stoet` (læser-medlemskab) – burde pege på `#priser` (erhvervs-/sponsorpakker) eller `selectPriceProduct('sponsor')`.
- Priser: alle 7 "Vælg …"-knapper (L2130-2275; "Event" → event, resten → sponsor) kalder `selectPriceProduct`, som kun skifter fane. Valget af pakke (Naboskab/Fællesskab/Fyrtårn, Profil i Lokalguiden, Ugens Sponsorat) bæres ikke videre; sponsor-formularen har ingen produktfelt og `submitTipMode('sponsor')` læser det ikke (og kaster desuden P0-1). Fix: skriv produktet ind i et skjult felt/`sponsor-message` og vis det i formularens overskrift.
- Artikel "Debatindlæg" → "Skriv et debatindlæg" (L2767) → `#indsend`, men Indsend har ingen debat-fane (tip/event/sponsor/citat); nærmeste er "Giv et citat". Fix: tilføj fanen "Debatindlæg" eller peg på citat-fanen via `switchTipMode('citat')`.
- Det samme mønster mangler hvor det er oplagt: Foreningsliv/Kultur → "Arrangement"-fanen (`switchTipMode('event')`).

**P2-7 · Stale/ikke-opdateret formular- og støttestate.**
- `customInputChanged('')` ignorerer tomt/ugyldigt input; `customAmount` bevares, så knappen viser fortsat "100 kr." mens feltet er tomt (runtime bekræftet).
- Pakkekort: statisk label "✓ Valgt" (Støtte) og "Populært valg"/"Ekstra støtte" ændres ikke af `selectPlan`; efter valg af Plus står "✓ Valgt" stadig på Støtte (runtime: `labels = [✓ Valgt, Populært valg, Ekstra støtte]` mens `is-selected` ligger på kort 2). Fix: render label ud fra `is-selected` med CSS (`.is-selected .plan-state::after`).
- `submitSupport()` er kun `alert()` og tager ikke højde for at `planPrice` kun gælder pr. md; ingen betalingsflow (forventet i demo, men markér som demo).
- Alle fire `submitTipMode`-grene bruger `alert()` og rydder ikke felterne (efter P0-1 fix).

**P2-8 · Tilbage-links og kontekst.** Alle 7 artikler har "← Tilbage til Forsiden" (top og bund) → `#forside` (sidetop), også selv om brugeren kom fra `#sport`, `#kultur` eller søgning. Brugeren mister sin placering. Fix: gem `document.referrer`/seneste scroll-position eller brug `history.back()` når hash-historik findes; titellinjen "Trafik & Beredskab" (L2584) er ren tekst, ikke link til sektionen.

**P2-9 · Ingen deep link/URL-state pr. by.** `valgt_by` ligger kun i `localStorage` (L2968), URL'en bærer ikke byen (ingen `?by=naestved`/`#naestved`). Delte links viser altid Slagelse for modtageren, og "Næstved Lokalt" kan ikke linkes. Fix: læs `?by=` ved load, skriv med `history.replaceState`, opdatér `<title>`/`og:*`.

### P3 – lav

- **P3-1 Tastatur:** 21 `[onclick]`-elementer er ikke `a`/`button` med `href`: 7 `div.city-dropdown-item`, 2 `div.support-toggle-btn`, 3 `div.support-plan-card`, 7 footer-`<a onclick>` uden `href` (L2823-2829, ikke fokuserbare). Skift til `<button>`/`<a href="?by=…">`; tilføj `aria-pressed`/`aria-expanded` på dropdown og drawer (kun 3 aria-/role-attributter i hele filen). Detaljer i T4.
- **P3-2** 8 `h1` (hero + 7 artikler), alle altid i DOM. Gør hero til `h2` eller artiklerne til `h2`.
- **P3-3** `setCustomAmt` (L3037) bruger globalt `event.target` – virker i browsere, men fejler hvis funktionen kaldes programmatisk eller fra et indre ikon. Giv `el`-argument som `selectPlan` (`onclick="setCustomAmt(100, this)"`).
- **P3-4** Drawerens `div.mobile-drawer-content` har `onclick="event.stopPropagation()"`, så dokumentets "luk dropdown ved klik udenfor" (L2858) ikke kører for klik i skuffen. Drawerens by-knapper har klassen `site-network-btn`, nulstilles af `switchCity`, men får aldrig `is-active` (kun topbarens `net-btn-*`).
- **P3-5** `href="javascript:void(0)"` på mobil-pillen "Mere" (L1496); brug `<button>`.
- **P3-6** Footer mangler links til Priser og Profil (der er kun Sektioner/Netværk/Deltag), og der er ingen Om os/Kontakt/Privatliv/Ansvarshavende redaktør. `redaktion@lokalmedie.dk` (L2805) og "Redaktionel adgang: /redaktion" (L2571) er ren tekst, ikke `mailto:`/link.
- **P3-7** Mobil-pill-rækken (L1488-1497) har "Nyheder → `#forside`" (label og mål er ikke ens), mangler Foreningsliv og Debat (kun i skuffen), og "Priser & Annoncer" er markeret med accentfarve som ikke følger aktiv-state.
- **P3-8** `innerHTML` bruges med data uden escaping i wire (L2927) og nabolag-piller (`onclick="setNabolagArea('${area}', this)"` ville knække ved apostrof i områdenavn, fx "Sct. Jørgens'"). Ufarligt med nuværende statiske data, men kritisk når data kommer fra CMS/agenter (jf. T7). Brug `textContent`/`data-attributter` og `addEventListener`.
- **P3-9** Alle `onclick` er inline, og Content-Security-Policy kan ikke bruges. Ved migrering til CMS-sitet bør handlers flyttes til komponenter (T2/T5).

---

## 2. Linkmatrix

### 2a. Statisk navigation (header, drawer, subnav, bundbar, footer)

| Kilde | Mål-ids | OK? |
|---|---|---|
| Logo, "Forside", pill "Nyheder", bundbar "Hjem" | `#forside` | OK (men pill-label ≠ mål, se P3-7) |
| Header/drawer/footer "Nyheder, Erhverv, Sport, Kultur, Foreningsliv, Debat" | `#nyheder #erhverv #sport #kultur #foreningsliv #debat` | OK (alle 6 sektioner findes) |
| Header "Priser", pill "Priser & Annoncer", drawer "Priser & Annoncering" | `#priser` | OK (ikke i footer) |
| Søgeikon, drawer "Søg", footer "Søg i arkivet" | `#soeg` | OK (scroller langt ned; fokuserer ikke inputfeltet) |
| Profil-ikon, drawer "Min brugerprofil" | `#profil` | OK |
| "Støt Slagelse/…" (header, drawer, banner, partnerboks, footer x2, artikel, profil, pill) | `#stoet` (9 forekomster) | OK, men åbner altid fanen "Fast støttepakke" |
| "Tip os", banner, footer, artikler | `#indsend` (7) | OK, åbner altid fanen "Giv et tip" |
| Bundbar "Mit område" | `#nabolag` | **DØDT** |
| Ticker (L1387) | `#art-storebaelt` | OK, men uændret for alle byer |
| By-switch (topbar 7, dropdown 7, drawer 7, footer 7) | `switchCity('<7 nøgler>')` | OK, alle 7 nøgler findes i `CITIES_DATA`; ingen `href`-fallback |

### 2b. Kort og wire (HTML, Slagelse-variant)

Forklaring: OK = mål matcher emne; DEL = delvist; FORKERT = urelateret artikel; DØDT = anker findes ikke.

| Sektion | Linje | Kort (kicker · overskrift) | Mål | Verdikt |
|---|---|---|---|---|
| forside hero | 1551 | BÆLTET · STOREBÆLT · Kødannelse … Storebælt | `art-storebaelt` | OK (kun Slagelse) |
| forside wire | 1579 | 08:12 Nyt flertal … 45 mio. | `art-byraad` | OK |
| forside wire | 1583 | 07:48 Sommerhuse ved Skælskør Næs | `art-sommerhuse` | OK |
| forside wire | 1587 | 06:32 Ny butikskæde Schweizerpladsen | `art-butik` | OK |
| forside wire | 1591 | 22:15 Slagelse B&I … Harboe Arena | `art-sport` | OK |
| forside wire | 1595 | 21:05 Naturprojekt Tude Å | `art-tudeaa` | OK |
| forside mellem | 1626 | BYUDVIKLING & POLITIK · Nyt flertal … | `art-byraad` | OK |
| forside mellem | 1641 | KRIMI & TRYGHED · Flere sommerhuse … ved kysten | `art-sommerhuse` | OK (overskrift afviger) |
| forside mellem | 1656 | ERHVERV & HANDEL · Ny butikskæde åbner | `art-butik` | OK |
| forside 4-grid | 1689 | LOKALSPORT · Dramatisk overtidssejr | `art-sport` | OK |
| forside 4-grid | 1700 | NATUR & MILJØ · Nyt vådområde | `art-tudeaa` | OK |
| forside 4-grid | 1711 | DEBATINDLÆG · "Bevar byens grønne oaser" | `art-debat` | OK |
| forside 4-grid | 1722 | FORENINGSLIV · 120 frivillige hædret | `art-foreningsliv` | **DØDT** |
| nyheder | 1761 | TRAFIK · Kødannelse … | `art-storebaelt` | OK |
| nyheder | 1771 | POLITIK · 45 mio. | `art-byraad` | OK |
| nyheder | 1781 | KRIMI · Sommerhusindbrud | `art-sommerhuse` | OK |
| erhverv | 1804 | DETAILHANDEL · Ny butikskæde | `art-butik` | OK |
| erhverv | 1814 | LOGISTIK · Erhvervspark ved motorvejen | `art-byraad` | **FORKERT** |
| erhverv | 1824 | TURISME · Kystturismen rekord | `art-sommerhuse` | **FORKERT** |
| sport | 1847 | FODBOLD · Dramatisk overtidssejr | `art-sport` | OK |
| sport | 1857 | MOTION · Løbeklub / forårsløb | `art-tudeaa` | **FORKERT** |
| sport | 1867 | SVØMNING · fire nye klubrekorder | `art-byraad` | **FORKERT** |
| kultur | 1890 | MUSIK & TEATER · Kulturhuset forårsprogram | `art-kultur` | **DØDT** |
| kultur | 1900 | HISTORIE · Herreborge åbner | `art-sommerhuse` | **FORKERT** |
| kultur | 1910 | BØRN & FAMILIE · Gratis workshops | `art-debat` | **FORKERT** |
| foreningsliv | 1933 | FRIVILLIGHED · 120 frivillige hædret | `art-foreningsliv` | **DØDT** |
| foreningsliv | 1943 | BORGERINITIATIV · Naturvennerne samler affald | `art-tudeaa` | DEL |
| foreningsliv | 1953 | HJÆLP HINANDEN · Frivilligcentret lektiehjælpere | `art-debat` | **FORKERT** |
| debat | 1976 | BORGERINDLÆG · Bevar åndehuller | `art-debat` | OK |
| debat | 1986 | POLITISK REPLIK · Investeringen er nødvendig | `art-byraad` | DEL (nyhed, ikke replik) |
| debat | 1996 | PENDLERDEBAT · Pendlerne overses | `art-storebaelt` | DEL (nyhed, ikke indlæg) |

Resultat: 18 OK · 3 DEL · 7 FORKERT · 3 DØDT (2 unikke ankre; det fjerde døde anker, `#nabolag`, ligger i bundbaren). De seks sektioner (erhverv, sport, kultur, foreningsliv, debat, nyheder) har tilsammen 18 kort men peger på kun 6 forskellige artikler; sektionerne er altså reelt "skin" uden selvstændigt indhold.

### 2c. Wire pr. by (`CITIES_DATA`) – kun kolonnen "Mål" og verdikt

| By | Wire-punkter og mål | Døde | Forkert by/emne |
|---|---|---|---|
| Slagelse (3, ikke 5) | byraad, byraad, sommerhuse | 0 | 1 punkt peger på samme som nr. 1 |
| Næstved | **kultur**, byraad, butik (fiskere), sport (Næstved Boldklub), tudeaa (Susåen) | 1 | 4 |
| Holbæk | byraad (havneby), butik (lærlinge), tudeaa (fuglereservater), sport, **kultur** | 1 | 4 |
| Ringsted | **kultur**, byraad (cykelsti), butik, sport (TMS), tudeaa (Haraldsted Sø) | 1 | 4 |
| Køge | byraad (station), **kultur**, sport (springhal), sport (HB Køge), tudeaa (Å-sti) | 1 | 4 |
| Roskilde | **kultur** (Festival), byraad (RUC), butik (madmarked), sport, tudeaa (Jyllinge) | 1 | 4 |
| Kalundborg | byraad (krydstogt), butik (sundhedshus), butik (iværksætter), sport, tudeaa (Havnsø) | 0 | 5 |

I alle 6 byer peger hero på `art-storebaelt`. Intet punkt linker til en by-specifik artikel.

---

## 3. Dødt-link-liste

| # | Anker | Hvor | Linje / datakilde | Alvor |
|---|---|---|---|---|
| 1 | `#art-foreningsliv` | 4-grid "120 frivillige hædret" | HTML L1722 | P1 |
| 2 | `#art-foreningsliv` | Foreningsliv-sektion "FRIVILLIGHED" | HTML L1933 | P1 |
| 3 | `#art-kultur` | Kultur-sektion "MUSIK & TEATER" | HTML L1890 | P1 |
| 4 | `#nabolag` | Bundbar "Mit område" (mobil) | HTML L2779 | P1 |
| 5-9 | `#art-kultur` | Wire i Næstved, Holbæk, Ringsted, Køge, Roskilde | `CITIES_DATA.wire` (build-script, `cities`-dict) | P1 |
| 10 | `getElementById('hero-meta')` | Hero-byline | HTML L2915 (id er `hero-meta-byline`) | P2 |
| 11 | `getElementById('wire-kommune-name')` | Wire-titel | HTML L2923 (intet element) | P2 |

Bemærk: de døde ankre er ikke kun kosmetiske – `href="#x"` uden mål ændrer URL'en (browser-historik fyldes) uden at scrolle, så "tilbage"-knappen virker som om den ikke gør noget.

---

## 4. Klik-flow og manglende naturlige klik

Flow-diagram (nuværende):

```
topbar (7 by-knapper) ──switchCity──▶ (kun tekst/farver, ikke indhold)
header-nav ──▶ #sektion (samme side) ──kort──▶ #art-* (længere nede på samme side)
                                              └─▶ "← Tilbage til Forsiden" (#forside, sidetop)
                                              └─▶ 1 CTA: #stoet | #debat | #indsend | #erhverv | #sport | #forside
forside ──▶ #stoet ──▶ submitSupport() ──▶ alert()            (ingen betaling, ingen state)
forside/artikel ──▶ #indsend ──▶ submitTipMode() ──▶ ReferenceError (P0-1)
priser ──selectPriceProduct()──▶ #indsend (produktvalg tabes)
```

**Pr. artikel – afslutnings-CTA (L2603 ff.)**

| Artikel | Øverste højre label | Bund-CTA | Kommentar |
|---|---|---|---|
| storebaelt | "Trafik & Beredskab" (tekst) | Støt den lokale dækning → `#stoet` | eneste artikel der linker til støtte-flow |
| byraad | "Politik & Byudvikling" | Deltag i debatten → `#debat` | peger på sektion, ikke relateret indlæg |
| sommerhuse | "Krimi & Tryghed" | Tip redaktionen → `#indsend` | fint match |
| butik | "Erhverv & Handel" | Se mere erhverv → `#erhverv` | fint match |
| sport | "Lokalsport" | Flere sportsnyheder → `#sport` | fint match |
| tudeaa | "Natur & Miljø" | **Gå til Forsiden** → `#forside` | duplikerer tilbage-linket; intet tilbud |
| debat | "Debat & Holdninger" | Skriv et debatindlæg → `#indsend` | ingen debat-fane (P2-6) |

**Manglende naturlige klik (prioriteret)**
1. **Artikel → relaterede artikler / næste–forrige:** findes ikke (ingen sektion "Mere om …", ingen "Læs også"). Eksempler på oplagte relationer: byraad ⇄ debat-replik, storebaelt ⇄ pendlerdebat, sommerhuse ⇄ tip-flow.
2. **Artikel → sin sektion:** top-labelen ("Politik & Byudvikling") er ren tekst; kicker (`section-kicker`) er ikke link. Kort-kicker ("TRAFIK", "KRIMI", "NATUR & MILJØ") linker heller ikke til emne/sektion. Det findes ikke emne-sider overhovedet (modsat CMS'et, som har `/emne/*`).
3. **Artikel → forfatter, kilde, dato:** forfatter er `<strong>` uden link; ingen "Kilde:"-links.
4. **Artikel → støt/tip/del:** kun 1 af 7 artikler har "Støt"; ingen har del-knap, ingen "Ret en fejl/tip os om denne sag".
5. **Sektion → delområde/by:** ingen sektion kan filtreres på by-/bydel (Korsør, Skælskør, Karrebæksminde …). "Seneste nyt → Se alle →" fører til `#nyheder`, som kun har 3 kort (aldrig "alle").
6. **Dit nabolag → område:** pillerne skifter en tekstboks, ingen link til områdets historier, kort eller arrangementer; kortet (`img-kort`) er et billede uden klik. Bundbaren "Mit område" er dødt (P1-1).
7. **Sektion → handling:** Foreningsliv/Kultur → "Arrangement"-fanen; Debat → "Debatindlæg"; Erhverv → `#priser` (annoncering); Sport → klubsponsorat. Ingen af sektionerne har sådanne CTA'er.
8. **Søg:** ingen vej fra et tomt resultat til "Tip os / foreslå emne"; header-søgeikonet scroller bare ned til `#soeg` uden at fokusere feltet; ingen by-afgrænsning; resultater linker kun til de 7 artikler.
9. **Footer:** mangler `#priser`, `#profil`, Om os, Kontakt, Privatliv/cookies, Ansvarshavende redaktør, mærknings-/etikregler, RSS, nyhedsbrev, Facebook (priser lover "fuld distribution på vores Facebook-side" uden at linke dertil).
10. **By-skift:** ingen "du ser Slagelse – vil du skifte til din by?" ved første besøg, ingen `?by=`, og ingen link fra et lokalt punkt (Karrebæksminde, Orø) til byens egen sektion.
11. **Mobil:** bundbaren har 4 tabs (Hjem, Mit område [dødt], Tip os, Mere); "Støt" og "Søg" kræver skuffen. Aktiv-state hænger på "Hjem".
12. **Tilbage:** se P2-8.

---

## 5. Trace af JS-handlers (click-path-audit, trin 1–2)

**Tilstandsstores (global state i scriptet)**
```
currentCityKey (L2851)   sat af switchCity; læst af setNabolagArea, updateSubmitText, submitSupport
supportMode/planName/planPrice/customAmount/customFreq (L3005-3009)   sat af setSupportMode/selectPlan/setCustomFreq/setCustomAmt/customInputChanged; læst af updateSubmitText, submitSupport
localStorage 'valgt_by'  skrevet i switchCity; læst i DOMContentLoaded
DOM-state (klasser): is-active (by-knapper, dropdown, nabolag-piller, tip-faner, støttefaner, frekvens, beløb), is-selected (pakker), is-open (dropdown/drawer)
```
Ingen handler nulstiller state den ikke ejer (ingen "Sequential Undo"). Der er derfor ingen klassisk undo-bug; fejlene er *manglende* state-opdateringer.

| Handler | Trace (kort) | Verdikt |
|---|---|---|
| `switchCity(key)` (L2874) | sætter `currentCityKey`, CSS-variabler, 12+ tekstnoder, wire, pille, nabolag, `updateSubmitText()`, `localStorage`. Opdaterer **ikke**: `<title>`, meta, hero-href, hero-img, ticker, hero-byline (forkert id), `wire-kommune-name` (mangler), alle sektionskort/artikler, `price-section-*`, `community-banner-desc`, placeholders (Korsør, Slagelse Musikforening, Slagelse El & Energi), profilens område, partnerlogoer ("Harboe Bryggeri", "Sparekassen Sjælland-Fyn" vises for alle byer). | PARTIEL (P1-2/3/4, P2-1/2/3) |
| `toggleCityDropdown` (L2853) + document-click | toggler `is-open`; lukker ved klik udenfor. Drawerens `stopPropagation` blokerer lukning i skuffen. | OK / P3-4 |
| `setNabolagArea(area, btn)` (L2972) | fjerner/sætter `is-active`, skriver generisk tekst. Ingen link. | PARTIEL (P2-3b) |
| `toggleMobileMenu` | toggler `is-open`; kaldes sammen med `switchCity` fra drawerens knapper og fra alle drawer-links (hash-navigation sker sideløbende). Ingen scroll-lås, ingen `aria-expanded`, ESC lukker ikke. | OK / P3-1 |
| `setSupportMode(m)` | skifter faner/paner + `updateSubmitText()`. Kaldes aldrig udefra (CTA'er i P2-6). | OK, men uden indgang udefra |
| `selectPlan(name, price, el)` | opdaterer variabler + `is-selected`; label "✓ Valgt" er statisk. | PARTIEL (P2-7) |
| `setCustomFreq`, `setCustomAmt`, `customInputChanged` | opdaterer variabler + knapper; bruger global `event`; tomt input efterlader stale beløb. | PARTIEL (P2-7, P3-3) |
| `submitSupport` | læser state, `alert()`. Ingen betaling. | OK som demo |
| `selectPriceProduct(mode)` → `switchTipMode` + `scrollIntoView` | skifter fane, scroller; produktvalg tabes. | PARTIEL (P2-6) |
| `switchTipMode(mode)` | skifter `is-active` + `display:flex/none` for 4 formularer; alle id'er findes. | OK |
| **`submitTipMode(mode)`** (L3092) | `ReferenceError` på første linje. | **BUG P0-1** |
| `runLiveSearch(q)` / `setSearchTerm(t)` | filtrerer 7 statiske `stories`; tom liste→"Ingen resultater" (ingen CTA). Kaldes ved DOMContentLoaded. | PARTIEL (P2-5) |
| `toggleProfileEdit` / `saveProfile` | togler boks, skriver to tekster, `alert`. Persisterer ikke (ingen `localStorage`), nulstilles ved genindlæsning; område kobles ikke til by-valg. | OK som demo / P3 |
| `DOMContentLoaded` | `runLiveSearch('')`, gendanner by fra `localStorage` via `switchCity`. | PARTIEL (P1-4, P2-9) |

**Id-afstemning JS ↔ HTML:** alle `getElementById`-ids findes bortset fra `hero-meta` og `wire-kommune-name`. Ingen ids oprettes af JS. Alle 5 `onsubmit`-handlers og 21+7 `switchCity`-kald refererer til eksisterende funktioner/nøgler.

---

## 6. Anbefalet rækkefølge for rettelser (alle i `build_nyhedssite.py`)

1. **P0-1** `currentCity` → `CITIES_DATA[currentCityKey]` (1 linje) + test der kalder alle fire formular-submits.
2. **P1-1** opret/ret de 3 ankre + `id="nabolag"`; tilføj anker-valideringstest i buildet (se også T2's crawl for CMS-versionen).
3. **P1-4** gør Slagelse-data = statisk markup (eller render fra data ved load).
4. **P1-3 + P2-1/2/3** udvid `CITIES_DATA` med `hero_href`, `hero_img`, `hero_author`, `ticker_*`, `wire[].href`; ret `hero-meta`-id, fjern `wire-kommune-name`, fjern dobbelt præfiks i nabolag.
5. **P1-2/P1-5** by-egne artikler (eller deaktivér links) og ét datakilde for kort/wire/søg.
6. **P2-4** scroll-spy for `is-active`; **P2-6** CTA'er der sætter korrekt fane/produkt; **P2-8** kontekstbevarende tilbage-link.
7. P3-punkter samlet i T4 (a11y) og ved migrering til CMS-komponenter.

Afhængighed til andre tasks: P1-2/P1-3 og P2-9 er også designspørgsmål (T3); P3-1/P3-2 hører under T4; P3-8 og dataflowet for ægte by-indhold hører under T7 (agent→CMS).
