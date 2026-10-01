<!-- FIX-design: rettelser af T3-designfund. Ingen commits. Skrevet 2026-10-01. -->
# FIX-design: rettelser af T3-designreviewet

Ejerskab: `cms/styles/site.css`, `cms/components/site/**`, artikelsidens krop (`app/(site)/[sektion]/[slug]/page.tsx`, ikke metadata/JSON-LD), `app/(site)/priser/page.tsx`. `app/(site)/page.tsx` er ikke omstruktureret (kun CSS-klasser/ordning). Byfarver: `lib/network-sites.ts`, `prisma/network-seed-data.ts`, `tests/network-sites.test.ts` og dev-databasen.

Alle CSS-rettelser ligger enten som in-place ændringer (token, skriftstørrelser, farver) eller som ét samlet lag nederst i `styles/site.css` med overskriften "DESIGN-REVIEW-RETTELSER (T3)". Lagets regler har sidste ord over de ældre lag.

## 1. Fund -> ændring

### P0
| Fund | Ændring |
|---|---|
| P0-1 Artikel sprænger layout på 375 px (sw 506) | `.site-article-layout` og `.site-section-layout` bruger `minmax(0,1fr)` (og `minmax(0,8fr) minmax(0,4fr)` fra 1024); `min-width:0` på alle grid-børn; `overflow-wrap:anywhere` + `hyphens:auto` på H1, manchet, brødtekst, korttitler; `max-width:100%` på medier, `overflow-x:auto` på tabeller/pre. Sidespalten indeholder nu kun ét nyhedsbrev, så den ikke længere har større min-content end hovedspalten. |

### P1
| Fund | Ændring |
|---|---|
| P1-1 Forside overflow 768 px (sw 874) | `.site-middle-3cards-grid`: 1 spor under 768, 2 spor 768-1023 (ulige sidste kort spænder bredden), 3 spor først fra 1024. 1024-1279: kortet stables (billede over tekst, 140 px), vandret layout først fra 1280. |
| P1-2 Kompakt-kort kollapser | Kompakt-kortet er altid en vandret række: fast 104 px (88 px under 380 px) 1:1-billedkolonne (absolut udfyldt, `object-fit:cover`), tekst `flex:1; min-width:0`, titel 17 px med 3 linjers clamp, kategori på én linje med ellipsis, byline med `flex-wrap` og `nowrap` på forfatter/tid. Kort uden cover skjuler tom billedkolonne. Mærkningsbadge får egen række (`flex: 0 0 100%`). Undersektionsblokke: 1 spor under 720 px, 2 spor derover (ulige sidste kort spænder bredden). "Relaterede historier": `auto-fill minmax(220px,1fr)`, enkeltkort maks 360 px. |
| P1-3 Hardcoded Slagelse-indhold | Ikke min fil: forsidens midterrække hentes nu fra data (`omraadeArtikler`) i `page.tsx`. Intet at gøre i CSS. |
| P1-4 Hero-CTA til 404 | Allerede rettet i `page.tsx` (pillen peger nu på en eksisterende trafikartikel). Pillen fik 44 px tap-mål. |

### P2
| Fund | Ændring |
|---|---|
| P2-1 Støt/Indsend/Kalender svære at nå | Header: **Støt** (fyldt accent, hjerte) vises på alle skærme; **Indsend** (outline, sekundær) fra 640 px; Søg som 44 px ikon (label fra 1280). På mobil/tablet ligger begge desuden øverst i sektionsarket (`site-sheet-cta-row`). Kalender er i desktop-nav, i mobilens sektionsbar, i bundmenuen og i arket. Slogan-blokken i headeren er fjernet (passede ikke ved 1024-1280). |
| P2-2 Bundmenu | Ny `BottomNav` efter DESIGN.md §8: Forside · Sektioner · Kalender · Søg · Profil. Kun ét ark (Sektioner); "Emner"/"Mere"-dubletterne er væk. Aktiv fane: Sektioner lyser for alle sektioner/underside/artikler (`categories.map(slug)` mod første stisegment), øvrige faner for egen sti; accent + label + 3 px topindikator. Stribe er forankret (fuld bredde, 56 px + safe-area, ingen blur/pille/skygge). Arket har nu `role="dialog"`, `aria-labelledby`, fokusfælde, 44 px mål. |
| P2-3 Forside for lang på mobil | Kun CSS: under 1024 bliver `.site-container` en flex-kolonne og `.site-top-3col-grid` `display:contents`, så rækkefølgen er hero, Seneste nyt, område, "Mere fra", sektionsblokke, **derefter** vejr/nabolag/nyhedsbrev og resten. Mobil: sektionsblokkenes og "Mere fra"-blokkens kort efter det første vises som vandrette rækker (104 px thumb). |
| P2-4 Fire kromlag på mobil | Netværksbaren skjules under 1024 (byskift ligger i arket og footer); topbar 6 px padding; ticker uden dato og 44 px høj; mobil-sektionsbar 44 px med fade til højre. |
| P2-5 Sektionsblokke med tomme huller | `:has()`-regler pr. antal kort: 1 kort = vandret bredt kort, 2 kort = 2 spor, 3 kort = 3 spor (fra 640), 4+ = 4 spor fra 1024. |
| P2-6 Sektionsside | Kronologisk liste og "Vis flere" som rigtig `<a>` (Link) fandtes allerede via `LoadMore`; knappen er nu 48 px høj, forrige/næste som `rel=prev/next`. Hovedkortets titel i den smalle spalte reduceret til 30/34 px (var 44 px = 6 linjer). |
| P2-7 Artikel som blindgyde | Ny `ArticleEndCta` (Støt = primær, "Send et tip" = sekundær) efter tags, derefter "Mere fra {område}", derefter forrige/næste historie (egen DB-forespørgsel i samme sektion, kronologisk). Dublet-nyhedsbrev og "Læs også"-spejling af relaterede er fjernet: sidespalten har ét nyhedsbrev. |
| P2-8 Brødkrumme | Genopbygget visuelt: `ol` med 14 px chevron-separatorer (14 px, `--ink-3`), ens grundlinje (`inline-flex`), sidste led i ink uden link og med ellipsis, aldrig linjeskift (vandret scroll på mobil). Vises nu på alle skærmbredder på artikler. Sti på /priser er `Forside > Priser og annoncering`. |
| P2-9 Typografi | Alle `font-size` under 14 px er gennemgået programmatisk: uppercase labels/badges min. 12 px, alt andet min. 14 px (155 deklarationer ændret). Filter-/tag-/tid-piller 14 px. Hero-kicker 14 px hvid på stærkere scrim. `--ink-3` mørknet til `#665E54` (5,9:1 mod paper). Placeholder = `--ink-3`, opacity 1. |
| P2-10 Billeder | Alle billedflader har ens tonet accent-gradient som placeholder (også når et billede ikke er hentet endnu), 1 px indvendig ramme, fast aspect-ratio (3:2 standard/hoved, 1:1 kompakt, 16:9 artikel) og `object-fit:cover`. Der er ikke opfundet billeder. |
| P2-11 /priser | Side omskrevet med klasser i stedet for inline-styles: pris og enhed på hver sin linje (`white-space:nowrap`), ingen gennemstregede priser, ingen navngiven konkurrent, ingen "75 %"/"25 %"-påstande og ingen "tusindvis"-påstande. Tydeligt hierarki: H1, lede, tre fordele (inkl. link til redaktionelle principper), enkeltformater, partnerskaber, formular. Em-dashes er fjernet i brødteksten. Priser uændrede og stadig i sync med `lib/seo/priser.ts`. |
| P2-12 Kalender | CSS: filtre/knapper 44 px mål. Eventsider, .ics, områdefilter og seed-data er ikke CSS (se "Ikke rettet"). |
| P2-13 Seneste nyt ikke kronologisk | Data-/forespørgselsproblem, ikke rettet her. |

### P3
| Fund | Ændring |
|---|---|
| P3-1 Spec-drift | Ikke rettet i DESIGN.md (ikke min fil). Radius/tokens uændrede. |
| P3-5 Berøringsmål | 44 px på mobil/tablet for header, bundmenu, sektionsbar, ark, piller, filter, tags, footer-links, bookmark/del, "Vis flere". Footer-links står i to spalter på mobil, så siden ikke vokser voldsomt. |
| P3-6 Mørk tilstand | Uændret (`color-scheme: light`); `body:has(.site-wrapper)` får nu samme `--paper`, så kold/varm skift forsvinder. |
| P3-7 hero uden `priority` | Ikke min fil (`page.tsx`). |
| Bevægelse | `prefers-reduced-motion`: ingen hover-løft, ingen puls-animationer (ud over den eksisterende globale regel). |
| Fokus | Synlig dobbelt fokusring (2 px ink + hvid halo) på links, knapper, felter, summary og tabindex; `scroll-margin-top:96px` så sticky header ikke skjuler fokus. |
| Side-stripe-ban | Nyhedsbrevsboksens 6 px venstre-kant er skiftet til 3 px toplinje. |

### Byfarver (Holbæk/Køge)
Holbæk (Mos `#4F5B1E`) og Køge (Skov `#24533A`) var næsten ens. **Køge er nu Okker `#8A5A00`** (hvid kontrast 5,9:1, med strong `#664200`, soft `#F5ECCF`), og **Ringsted tager Skov `#24533A`** (Ringsted havde Okker). Ændret i `lib/network-sites.ts`, `prisma/network-seed-data.ts`, `tests/network-sites.test.ts` (forventede farver), `HANDOFF.md` og i dev-databasen (`Instance.farver` for `koege-site` og `ringsted-site`). Hårdkodede teglfarvede `rgba(...)` i CSS er erstattet af `color-mix(in srgb, var(--site-accent) …)`, så alle byer får deres egen accent overalt. Rest: Ringsted (ingen kørende host) er nu grøn ved siden af Holbæks olivengrønne i netværksbaren; vælg en syvende farve, når Ringsted lanceres.

## 2. Verifikation

Måling med Chrome/CDP (`scrollWidth <= bredde`, mobil-emulering under 500 px) mod `*.localhost:3000`; siden ventes til stylesheet er indlæst. Screenshots ligger i `docs/review/screenshots/` som `fix-before-*` (T3-baseline fra HEAD) og `fix-after-*`.

| Side | 375 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Næstved forside | ok | ok (var 874) | ok | ok |
| Næstved sektion /nyheder | ok | ok | ok | ok |
| Næstved artikel | ok (var 506) | ok | ok | ok |
| Næstved /priser | ok | ok | ok | ok |
| Næstved /kalender | ok | ok | ok | ok |
| Næstved /søg | ok | ok | ok | ok |
| Slagelse, Holbæk, Køge artikel | ok | ok | | |

(Alle sider inkl. footer: `scrollWidth == viewportbredde`. Se "Måleresultater" nedenfor.)

- Skriftstørrelser, forside: noder under 12 px: 66 -> 0 (375) og 37 -> 0 (desktop). Noder 12-13,9 px er nu uppercase labels/badges (DESIGN.md: 12 px) og få inline-styles i komponenter udenfor mit ejerskab.
- Berøringsmål under 44 px, forside 375: 33 -> 1 (ekstern skip-link, skjult til fokus).
- Konsol: ingen applikationsfejl. Én gang `ChunkLoadError` fra Turbopack-dev under en samtidig kompilering (forsvandt ved gentagelse); ellers ingen fejl.
- `npx tsc --noEmit`: ren. `npm test`: 193/193 grønne. `eslint` på mine filer: 0 fejl (kun gamle advarsler om ubrugte imports i `ThreeStepSubmissionWizard.tsx` og `tagline` i `SiteHeader.tsx`).
- Browser-panelet er sat tilbage til desktop-viewport.
- Fuldsides-screenshots `fix-after-*` er taget ved 375 px for Næstved (forside, sektion, artikel, priser, kalender), Slagelse- og Holbæk-artikel samt Holbæk-forside; resten af matrixen (768/1440-screenshots og Køge-forside) blev afbrudt, fordi dev-serveren var meget langsom og ejeren ville committe. Måleværdierne (`scrollWidth`) for 768/1024/1440 blev dog målt før afbrydelsen og er i tabellen. Visuel kontrol ved 768 og 1440 er udført med udsnit af forside, sektion, artikel og priser (ikke gemt som filer ud over `fix-after-*`).

## 3. Ikke rettet (med årsag)

- P1-3/P2-13 (data i forsiden, rækkefølge i "Seneste nyt"): ligger i `page.tsx`/data-laget, som en anden agent ejer.
- Hero-`priority` (P3-7) og forsidens egentlige modul-omstrukturering (zone-rækkefølge i markup): ejes af den senere forside-agent. Mobilforsidens længde er kun reduceret via CSS (13 575 -> ca. 12 900 px ved 375; resten kræver færre/andre moduler).
- Kalender: eventsider, "Læg i kalender", områdefilter, billeder og forældede seed-datoer (P2-12) kræver data/markup uden for mit ejerskab.
- `/annoncer` = `/priser` (301/canonical): routing, ikke design.
- DESIGN.md-opdatering (18 px radius, fonte, tokens): dokumentfil, ikke rørt.
- Bundmenuens 5. fane er Profil (DESIGN.md §8), ikke Støt (T3-anbefalingen); Støt ligger i stedet synligt i headeren på alle skærmbredder og øverst i arket.
- Prisernes tekst (fx "Opstartspriser", at distribution sker på Facebook og i nyhedsbrev) er redaktionelt/forretningsmæssigt og bør godkendes af ejeren.
- Citat-blokkens 4 px venstre-streg og MarkingBox' venstre-kanter er bevaret (mærkningssystem, DESIGN.md §2.2).
- Mørk tilstand: bevidst fravalgt, uændret.
