# FIX – statisk nyhedssite (T1 P0–P3 + T4 §8)

Ændret: kun `build_nyhedssite.py` (kilden) og den regenererede `nyhedssite.html`. Intet under `cms/` er rørt, ingen commit. T3 (design-review) fandtes ikke, da arbejdet blev udført, og er derfor ikke behandlet.

Arkitektur efter fixet: al indhold ligger som data i scriptet (7 byer, 67 historier). Kort, sektioner, artikler, wire, hero, ticker, nabolag og søgeindeks genereres ud fra samme data, så overskrift, kicker og link ikke kan divergere. Slagelse-markup og `switchCity('slagelse')` er bevist identiske (DOM-sammenligning i browser). Alt indhold er markeret som eksempelindhold.

## Byggetrin (T1 P1-1 anbefaling 2)
`python3 build_nyhedssite.py` fejler (exit 1, skriver ikke filen) ved: døde interne ankre (for alle 7 byer), dublerede id'er, ukendt `data-city`/`switchCity`-nøgle, ukendt `data-tipmode`/`data-support`, data (hero/ticker/wire/søg/områder) der peger på manglende id, historie uden artikel, sektion uden kort, og søgechips med 0 resultater. Negativ test udført (bevidst ødelagt anker gav exit 1).

## Finding -> ændring

| Id | Ændring |
|---|---|
| P0-1 | `submitTipMode` bruger nu `CITIES_DATA[currentCityKey]`. Alle 5 formularer viser inline bekræftelse (`role=status`, `aria-live`) i stedet for `alert()`, nulstiller felterne og indsætter brugerdata via `textContent`. Testet: alle 5 submit-kald uden fejl. |
| P1-1 | `#art-kultur` og `#art-foreningsliv` er rigtige (korte, eksempelmærkede) artikler. `id="nabolag"` på Dit nabolag-kortet. Bundbarens "Mit område" virker. Buildtjek mod døde ankre. |
| P1-2 | Alle wire-/hero-/ticker-links peger på artikler i byens egen artikelbeholder (`art-{by}-{slug}`). 0 links til Slagelse-indhold fra andre byer (verificeret i browser for alle 7). |
| P1-3 | `CITIES_DATA` udvidet med `hero_href`, `hero_img` (anvendes nu på `.site-hero-bg-layer` + aria-label), `hero_author`, `ticker{text,href}`, `wire[{time,title,href}]`, `stories`, `topics`, `ph`, `chips`, `title`, `desc`. Hero, byline, ticker, wire, sektionskort (mellem, 4-grid, 6 sektioner), artikler, `price-section-desc`, støtte-/banner-tekster, formular-placeholders, citat-emner, profilområde og søgeindeks skifter pr. by. `wire-kommune-name` findes nu (skjult tekst i "Seneste nyt"). |
| P1-4 | Slagelse-data = statisk markup (5 wire-punkter, samme hero/kicker/byline). `DOMContentLoaded` kalder kun `switchCity` hvis byen afviger fra standard. |
| P1-5 | Ét kort = én artikel med samme overskrift. 12 nye korte eksempelartikler til de kort, der før pegede på forkerte artikler. Debat-kort er mærket "(eksempel)". |
| P2-1 | Byline-id rettet (`hero-meta-byline`) og forfatter bevares: `{hero_author} · {hero_meta}`. |
| P2-2 | `wire-kommune-name` oprettet. |
| P2-3 | Dobbelt præfiks fjernet (`omraader: [{navn, tekst, stories}]`). Køge: teksten hører nu til Køge Nord. Områdepiller viser områdets historier som links, eller "Tip os om {område}" hvis der ingen er. |
| P2-4 | Scroll-spy sætter `is-active` + `aria-current` på desktop-nav, subnav-piller, bundbar (Hjem/Mit område) og skuffelinks; åben artikel markerer sin sektion. Pillen "Nyheder" peger nu på `#nyheder`; Foreningsliv og Debat tilføjet til pillerne. |
| P2-5 | Søgning indekserer titel, kicker, `tags`, sektionsnavn, sektioner, priser/støt og områder. "Byråd" giver resultater. Tomt resultat har link til "Tip redaktionen". Header-søgeikonet fokuserer feltet (`#soeg`). Chips er by-specifikke. |
| P2-6 | "Støt med valgfrit beløb" (banner, footer) åbner fanen Valgfrit beløb (`data-support`). Partner-CTA -> `#priser`. Prisknapperne bærer produkt + pris med til formularen (chip, skjult felt, med i bekræftelsen). Ny fane "Debatindlæg"; "Skriv et debatindlæg" åbner den. Kultur/Foreningsliv/Sport har "Indsend et arrangement" -> Arrangement-fanen, Erhverv -> `#priser`. |
| P2-7 | Tomt/ugyldigt beløb: knap deaktiveret + fejltekst (mindst 10 kr.). `plan-state` ("✓ Valgt"/"Populært valg"/"Ekstra støtte") følger valget. Beløbsgrupper rører ikke hyppighedsknapper. Betaling er tydeligt markeret som prototype. |
| P2-8 | Tilbage-link vender tilbage til det sted (sektion + scrollposition) man kom fra; label viser stedet ("Tilbage til Sport/Forsiden/Søgning"); uden kontekst: tilbage til artiklens sektion. Kicker og top-label er links til sektionen. |
| P2-9 | `?by=naestved` (og `#naestved`/`#by=naestved`) understøttes ved load; byen skrives til URL med `history.replaceState` (fejlsikkert); `<title>`, description, og:*, twitter:*, theme-color, favicon, JSON-LD, canonical og `<h1>` skifter pr. by. |
| P3-1 | By-skift er rigtige `<a href="?by=..">` (net-bar, dropdown, footer, skuffe); støttefaner er `<button role=tab>`; pakker er `role=radio` med tastatur; `aria-expanded` på dropdown og skuffeknapper (hamburger, "Mere"); Escape lukker; fokusfælde i skuffen; piletaster i faner. Verificeret: 0 klikbare elementer uden tastaturadgang. |
| P3-2 | Én `<h1>` (skjult sidetitel, opdateres pr. by); hero og artikler er `<h2>`. |
| P3-3 | `setCustomAmt(amt, el)` bruger ikke længere globalt `event`. |
| P3-4 | Skuffens overlay lukker via delegeret klik (ingen `stopPropagation`); skuffens by-knapper får `is-active`. |
| P3-5 | `javascript:void(0)` erstattet af `<button>` ("Mere"). |
| P3-6 | Ny sektion `#om` med `#om-os`, `#kontakt`, `#privatliv`. Footer har Priser, Min profil, Om os, Kontakt, Privatliv; `redaktion@lokalmedie.dk` er `mailto:`. |
| P3-7 | Se P2-4 (pille-label = mål, Foreningsliv/Debat tilføjet). |
| P3-8 | `esc()` på al data i `innerHTML`; nabolag-piller bruger `data-area` (ingen apostrof-problem); sektionsfragmenter er HTML-escapet ved bygning; formularbrugerdata via `textContent`. |
| P3-9 | Delvist: by-skift, tabs, planer, CTA'er m.fl. bruger delegerede handlers; enkelte inline `onclick` på knapper/form-submit er bevaret (se nedenfor). |
| Natural clicks (T1 §4) | Relaterede artikler (3) + forrige/næste på alle artikler; "Støt {by}" og sektions-CTA på alle artikler; "Se alle" udvider Nyheder (alle historier, "Vis alle N historier"/"Vis færre"); sektions-CTA-rækker; kicker -> sektion; nabolag -> områdets historier. |
| A11y (T1 §6) | Skip-link, `:focus-visible`, `prefers-reduced-motion`, labels på alle felter (for/aria-label), `role=img` + `aria-label` på alle CSS-billeder, dekorative ikoner `aria-hidden`, landmarks (`nav` med aria-label), `role=dialog` på skuffen. |
| T4 §8 | `canonical`/`og:url` (se begrænsning), og:type/locale/site_name/title/description, twitter:card/title/description, JSON-LD `NewsMediaOrganization` + `WebSite` (uden logo/sameAs), favicon (inline SVG i byens farve), `theme-color`, `lang=da`. |
| Opdigtede citater | Alle pullquotes fjernet; debatoverskrifter uden anførselstegn; opdigtede personer i debat erstattet med "Debattør (eksempel)"; alle artikler har badge "Eksempelindhold". |
| Partnere | "Harboe Bryggeri" m.fl. -> "Eksempel Partner A–E". Opdigtet firmanavn i placeholder -> "Eksempel Byg & Energi A/S". |

## Verifikation
- `python3 build_nyhedssite.py`: ok, 7 byer, 67 artikler, 0 døde ankre, 0 dublerede id'er.
- Egen browserfane mod lokal http-server (stoppet bagefter, fanen lukket): 0 konsolfejl ved load og ved skift gennem alle 7 byer (via rigtige klik på net-bar/dropdown/footer); 0 døde ankre pr. by; hero/ticker/wire peger kun på egen bys artikler; alle 5 formularer og støtteflowet virker; `?by=koege` deep link; Slagelse idempotent; Escape lukker dropdown og skuffe; ingen vandret overflow på 375 px.

## Ikke fikset / begrænsninger
1. **Canonical/og:url**: kræver et kendt domæne. Uden `SITE_URL` sættes de i browseren (kun ved http/https). Kør `SITE_URL=https://… python3 build_nyhedssite.py` for statiske tags. Intet domæne er opfundet.
2. **og:image / twitter:image mangler**: billederne er base64 i CSS og kan ikke bruges som delingsbillede (T4 P0-1 hører til CMS).
3. **Google Fonts** (tredjepart) er bevaret; kræver selvhostede fontfiler, som ikke findes i repoet.
4. **P3-9 (CSP)**: ikke fuldt løst; stadig inline `onclick`/`oninput`/`onsubmit` på nogle knapper og formularer. Kræver at al inline JS flyttes, hvilket hører til CMS-migreringen.
5. **Scroll-spy ved rigtig scroll** kunne ikke måles automatisk (browserfanen er skjult, så scroll/rAF kører ikke); logikken er verificeret ved at kalde `spy()` på alle sektioner og ved hashnavigation til artikler.
6. **Ingen rigtig persistens/betaling**: profil gemmes ikke, formularer og betaling er demo (tydeligt markeret).
7. **"Min By Media"-sammenligningen** i prissektionen og "Redaktionel adgang: /redaktion" (ren tekst) er uændret. Ansvarshavende redaktør er ikke opfundet (står som "angives før udgivelse").
8. **T3** (design) fandtes ikke og er ikke behandlet.
