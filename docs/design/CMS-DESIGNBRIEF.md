# Designbrief: Lysdals Redaktion (CMS-redesign)

Referencer: ejerens to skærmbilleder (Analytics-dashboard og Artikler med sidepanel-editor). Skill: ui-ux-design-intelligence → frontend-design/impeccable/design-taste-frontend/refactoring-ui/dataviz.

```
KATEGORI:        Redaktionelt CMS / back-office (SaaS, dashboard-first) til lokal nyhedsplatform
MÅLGRUPPE:       Redaktører, journalister, lokale ejere (forretningsbrugere, daglig produktion)
PRIMÆR HANDLING: Arbejde: skrive, planlægge, kvalitetssikre, publicere (+ følge performance)

STIL:            Dashboard-first, Minimalism/Swiss med Bento-kort (som referencerne)
Begrundelse:     Høj datadensitet og daglig brug kræver rolig struktur, tydeligt hierarki og lette flader;
                 den mørke navy-sidebar med lyse kort er allerede ejerens valgte retning.

FARVER (tokens, præfiks --cms-, må ikke kollidere med site.css):
  Sidebar/mørk:  #14123A (Midnat)          Sidebar-aktiv: #5B47E8 (Indigo, fyldt pille)
  Primær:        #4F3FDB (Indigo)          Primær-hover: #4333C4   Primær-tint: #EEEBFF
  AI-accent:     #0EA5C6 (Cyan)            AI-tint: #E3F6FB   (AI skal kunne ses som AI, adskilt fra primær)
  Baggrund:      #F6F7FB   Flade/kort: #FFFFFF   Kant: #E6E8F0   Kant-stærk: #CBD0E1
  Tekst:         #151633   Dæmpet tekst: #5B5E80 (≥ 4.5:1 på hvid)   Svag tekst/ikoner: #8A8DAA (kun dekor/≥18px)
  Status:        Publiceret #1F9D63 / bg #E4F6EC · Planlagt #2563EB / bg #E6EEFD · Kladde #6B5BD6 / bg #EEEBFF
                 Til redigering #B7791F / bg #FDF3DC · Afvist/fejl #D14343 / bg #FCE8E8 · Info #0EA5C6 / bg #E3F6FB
  By-prikker:    Slagelse #7C5CFF · Næstved #2F80ED · Roskilde #F2994A · Køge #EB5757 · Ringsted #27AE60
                 (data-farver; ændres i netværkskonfigurationen, ikke hardcodet i komponenter)
  Diagram:       kategorisk palette på 6 værdier (indigo, blå, orange, rød, grøn, cyan) + sekventiel indigo-skala (heatmap)

TYPOGRAFI (self-hosted via next/font):
  Display/UI:    Plus Jakarta Sans (600/700) – overskrifter, tal i KPI-kort
  Body:          Inter (400/500) – brødtekst/formularer (tilladt til SaaS-body)
  Mono:          JetBrains Mono – slug, kode, nøgler. Offentlige siders serif (Newsreader) bruges KUN til artikelpreview.
  Skala:         12 / 14 / 16 / 20 / 24 / 32 px; metadata aldrig under 12; brødtekst 14–16; ingen 9–11px labels i versaler.

LAYOUT:          Fast venstre sidebar 264 px (grupperet nav) · topbar med global søgning, datofilter og bruger/AI-menu ·
                 faner pr. by/status · KPI-række · bento-grid. Artikler = master-detail (liste til venstre, redigeringspanel til højre).
                 Mobil: sidebar → drawer + bundnavigation med 5 hovedpunkter; paneler bliver fuldskærmsark.

EFFEKTER:        Subtile: 150–200 ms transitions, blød skygge (0 1px 2px / 0 4px 16px, lav opacitet), 12–16 px radius,
                 skeleton-loading, tydelig fokusring (2px indigo + 2px offset). prefers-reduced-motion fjerner al bevægelse.

ANTI-PATTERNS:
  ✗ Ugrupperet nav med 17 ligestillede links (forvirrer; grupper efter arbejdsgang)
  ✗ 9–11px mono-versaler og lysegrå labels (fejler WCAG AA, kan ikke læses i redaktionelt lys)
  ✗ Hardcodede hex-farver og inline style={{}} i komponenter (hindrer ensartet tema; brug --cms-* tokens/klasser)
  ✗ Lilla gradienter, glitter-ikoner og "AI-sparkle"-pynt overalt (signalerer legetøj; AI markeres sparsomt med cyan)
  ✗ Emoji som ikoner; modaler til alt (brug paneler/ark/inline); window.confirm til destruktive handlinger
```

## Designtokens (implementeres i `styles/modernist.css`; alle nye komponenter bruger kun disse)
`--cms-bg, --cms-surface, --cms-border, --cms-border-strong, --cms-text, --cms-text-muted, --cms-primary, --cms-primary-hover, --cms-primary-tint, --cms-ai, --cms-ai-tint, --cms-sidebar-bg, --cms-sidebar-text, --cms-sidebar-active, --cms-success/-bg, --cms-planned/-bg, --cms-draft/-bg, --cms-review/-bg, --cms-danger/-bg, --cms-info/-bg, --cms-chart-1..6, --cms-radius-sm(8)/md(12)/lg(16), --cms-shadow-sm/md, --cms-space-1..8 (4/8/12/16/20/24/32/48), --cms-sidebar-w (264px), --cms-topbar-h (64px), --cms-font-display, --cms-font-body, --cms-font-mono`.
Eksisterende `--color-*`/`--space-*` bevares som aliaser, så det offentlige site og `.fpe-*`/forside-preview ikke går i stykker.

## Sidemønstre (alle sider skal ligne et rigtigt CMS)
1. **Skal (alle sider):** grupperet sidebar (Indhold: Artikler, Opret artikel, Planlægning, Medier · Indbakke: Idéer/Indbakke, Kilde-Q&A, Signaler, Meddelere, Interview · Produktion (LocalRating): Feeds & kilder, Skriv med AI, Simulator, Prompter · Vækst: Analytics, Nyhedsbrev, Annoncer, Sponsor · Struktur: Sektioner, Områder, Emner, Forside · Byer: de seks byer (status-prik + skift) · System: Brugere, Indstillinger) – filtreret efter brugerens rettigheder (skjul links uden adgang). Topbar: søgning, AI-operatør-knap (Cmd/Ctrl+K), notifikationer, brugermenu.
2. **Analytics (`/redaktion/metrikker`):** KPI-række (sidevisninger, unikke læsere, læsetid, konverteringer, nyhedsbrev-CTR, engagement) med delta mod forrige periode; trafikudvikling (linje/areal), artikler pr. by (søjler), trafikkilder (stablet), enhedstype (donut), aktive timer (heatmap), mest læste (tabel). Kun tiles med rigtige data vises som tal; manglende datakilder markeres ærligt ("Kobles til når sporing er slået til") – ingen opdigtede tal.
3. **Artikler:** faner (Alle · by · Planlagt · Publiceret · Kladder), filterlinje (status, forfatter, sortering, liste/gitter), liste med billede, by-prik, titel, uddrag, forfatter/tid, statuschip og kommentarantal; højre side: redigeringspanel (titel med tegntæller, underrubrik, brødtekst-editor, featurebillede, sektion, tags) + **accordions** "SEO & metadata", "Sociale medier", "Planlægning", "AI" · autosave-indikator ("Sidst gemt …") · Vis preview · Opdater/Publicér.
4. **Feeds & kilder (LocalRating):** top-KPI (nye items i dag, kandidater, gns. rating, kladder genereret, feed-sundhed); venstre filtre (kildegruppe, geografi, rettigheder, status, rating-model); midte: strøm af kort med score-ring, kilde, tidspunkt, dublet/relateret-chips og handlingerne "Opret kandidat" / "Skriv med AI"; højre skuffe med originalindhold, delscorer (y vs. local side om side), Knowledge-kontekst, rettighedsadvarsel og genereringsprofil. Under fanen "Kilder": tabel med helbred (sparkline), seneste hentning, fejl, interval, test-knap.
5. **Skriv med AI (LocalRating):** stepper Kilder → Vinkel → Rating → Udkast → Faktatjek → Til redaktør; venstre kandidat og kilder; midte strømmende udkast med kildefarvede segmenter (grøn/gul/rød) og faktatjek-panel; højre styring (profil, promptversion, tone, længde, pris-estimat, forbrugsloft). "Åbn i editor" overleverer kladden til den almindelige artikel-editor.
6. **Planlægning:** kalender/tidslinje med træk-og-slip af kladder og planposter; AI-udgivelsesplan som forslag (se simulatoren).
7. **Alle øvrige sider:** samme kort-/tabel-/tab-/badge-system (`components/ui`: PageHeader, Card, StatCard, Badge, Tabs, DataTable, Dialog/Sheet, Accordion, SaveIndicator, EmptyState, Skeleton).

## Krav på tværs
- **AI overalt hvor artikler skrives, planlægges, klargøres og forbedres:** feltniveau-AI i editoren ("Foreslå" på titel, underrubrik, slug, SEO-titel, meta-beskrivelse, tags, geo, alt-tekst, sociale tekster, resumé, SEO-score), AI-operatøren (tale/skrift) globalt, og LocalRating (feeds, rating, generering) som lag ovenpå. AI foreslår; mennesket godkender; AI-brug mærkes efter `lib/marking.ts`.
- **Alle metadata kan skrives i CMS'et** (se `docs/design/METADATA-OG-SOME.md` fra metadata-sporet): SEO-titel, meta-beskrivelse, canonical, robots, keywords/news_keywords, slug (med omdirigeringshistorik), OG-titel/-beskrivelse/-billede, Twitter-kort, **opslagstekst pr. platform** (Facebook, Instagram, LinkedIn, X, Bluesky) + hashtags/UTM, Google News/Discover-felter, schema-type, læsetid, sprog, udløbs-/begivenhedstid, medforfattere/fotograf, kildeliste, planlagt udgivelse – med live-forhåndsvisning (Google, Facebook, X, LinkedIn).
- WCAG AA, tastatur, aria-live til autosave/AI, 44 px touch-mål, 375/768/1024/1440 px, prefers-reduced-motion.
- Ingen funktionel regression: eksisterende tests (`npm test` 429+), `e2e`, `.fpe-*` forsideeditoren og forside-preview må ikke gå i stykker.
