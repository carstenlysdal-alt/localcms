# FIX: Designsystem, redaktions-shell og redesign af øvrige sider

Opgave D. Komponent-API'er, tokens og "sådan tilføjer du en side" står i `docs/design/CMS-UI-KIT.md`.

## Hvad er bygget

**Tokens og fonte.** `cms/styles/modernist.css` er omskrevet til `--cms-*` tokens fra briefet (farver, status med `-ink` til tekst, by-prikker, diagramfarver, radius, skygge, afstand, `--cms-sidebar-w` 264 px, `--cms-topbar-h`, typografiskala 12–32 px). Ældre `--color-*`, `--space-*`, `--font-*`, `--radius-*`, `--shadow-*` er aliaser, så login, forside-preview (`site.css`) og `.fpe-*` virker uændret. `--color-neutral-400/500` (brugt til tekst) peger nu på AA-farven. Elementregler for overskrifter er scopet til `.cms-root`, så offentlige sider ikke ændres. Fonte via `next/font/google` i `app/layout.tsx`: Plus Jakarta Sans (variabel), Inter, JetBrains Mono; Newsreader beholdes kun til offentlig preview og er sat til `preload: false`. `.editor-main` bruger `--cms-sidebar-w` i stedet for 224px. Ingen 9–11 px-tekst i redaktionens stilark (testet). `styles/frontpage-editor.css`: kun token-remap af variabler og hex-farver (ingen klasseomdøbning).

**UI-kit** (`cms/components/ui/`): Page, PageHeader, Card, StatCard (normal/delta/tom/loading/"ikke tilsluttet"), Badge/StatusChip, Tabs (client), LinkTabs, SegmentedLinks, DataTable (sortering, tom/loading/fejl), Dialog/Sheet/ConfirmSubmit (native `<dialog>`), Accordion (først leveret og dokumenteret til editor-sporet), SaveIndicator, EmptyState, Skeleton, Notice, Field, Grid/Row/Stack/Split, Toolbar/FilterBar/FilterSelect/FilterChips, SearchField, Avatar, CityDot. Ingen `style={{}}` og ingen hex (testet).

**Diagrammer** (`cms/components/charts/`, ren SVG, ingen ny afhængighed): LineArea, Bars (grupperet/stablet, lodret/vandret), Donut, Heatmap, Sparkline. Tabel-fallback, `aria`-resumé, tastatur (pile/Home/End/Esc), tooltip i SVG, live-region, ingen animation (reduced-motion), farver kun fra `--cms-chart-*`.

**Shell** (`app/redaktion/layout.tsx` + `components/admin/*`): grupperet sidebar 264 px (Indhold · Indbakke · Vækst · Struktur · System · Byer), indigo aktiv-pille, Indbakke-tæller, **rettighedsfiltrering på serveren** (`buildNav`, samme regler som siderne; siderne viser stadig `NoAccess`), by-liste fra `getNetworkLinks()` (aktuel by "Du er her", øvrige eksterne links til byens `/redaktion`), brugerblok med menu (Min konto, Brugere, Operator kun med rettighed, Log ud), topbar med global søgning (`/`: sider klient-side + artikeltitler via ny server action `app/redaktion/search-actions.ts`, kun egen instans), AI-operatør-knap (sender `cms:operator-open`; fallback til `/redaktion/chat`), skip-link og `nav`-landemærker. Mobil ≤ 900 px: drawer (resten `inert`, Esc, fokus returneres) + bundnavigation med fire hovedpunkter + "Mere". Forside-preview i iframe får ingen skal (`Sec-Fetch-Dest`). Operatør-agentens `<OperatorPanel user />` er bevaret; dens flydende knap løftes over bundnavigationen på mobil (`--cms-float-bottom`) og drawer ligger over den.

**Sider** (alle bygget med PageHeader + faner/filterlinje + kort/tabeller + tomme tilstande; inline styles og hex fjernet; samme actions/data/rettigheder):
sektioner (to-niveau-træ, redigér/opret i Sheet, sletning i Dialog i stedet for `window.confirm`, knap "Opret standardsektioner"), områder, emner (+ny; død `emner/administrer`-knap fjernet), signaler (godkendelses-chips, død "Administrér"-knap fjernet), indbakke, kilde-Q&A (+ opret-dialog), interview, meddelere, sponsor (fælles `IntakeCard`), nyhedsbrev, annoncer (generator med forhåndsvisning via tokens), medier (+ny, detalje; faner pr. type), opgaver (+ny, detalje; statusfaner), honorar, brugere, konto, NoAccess, forside-editor (kun tokens), login/kodeskift (tokens). `window.confirm`/`alert` er erstattet af Dialog/Notice i alle mine sider.

**Analytics** (`/redaktion/metrikker`) — kun rigtige data. KPI-kort (sidevisninger, gns. læsetid, engagement, artikler, forside-CTR, nye abonnenter, annoncer) med delta mod forrige periode; udvikling pr. dag (forside-eksponeringer og klikrate fra `FrontpageSlotMetric`), artikler pr. sektion (stablet pr. indholdstype), status-donut, publiceringstidspunkter (varmekort ugedag × time), forside-moduler, mest læste (tabel). Periodevælger 7/28/90 dage (`?dage=`) filtrerer faktisk. By-faner: data er pr. instans, så nuværende by er aktiv og de andre er links til deres egen side; netværkstotalen "Alle" er bevidst ikke bygget (tenant-isolation). Den eksisterende algoritmiske placering og fordelingsscore er bevaret (uændret logik). Rene beregninger i `app/redaktion/metrikker/_lib/aggregate.ts`.

## Ikke bygget / afvigelser

- **Sektioner: "Opret standardsektioner"** er slået fra og forklaret, fordi `lib/default-sections.ts` ikke findes endnu. UI'et er klart: `CategoryManager` tager `defaultSections` (`[{navn, slug, sortering?, children?}]`); send dem fra `sektioner/page.tsx`, så opretter knappen manglende topsektioner via `saveCategory` og undersektioner ved næste klik (undersektioner kræver forælderens id). Indtil da henviser teksten til AI-operatøren.
- **Planlægning, Produktion (LocalRating: feeds/skriv med AI/simulator/prompter) og Indstillinger** står i briefets sidebar, men har ingen sider endnu og er derfor ikke i menuen (ingen døde links). Tilføj dem i `NAV_GROUPS`, når siderne findes.
- **Notifikationer** i topbaren er udeladt: der er ingen rigtige data.
- **Sektioner**: ingen træk-rækkefølge (der findes ingen reorder-action), kun feltet "Sorteringsorden".
- **/redaktion/chat og artikler/**: ejes af andre agenter; jeg har kun sørget for tokens, skal-højde (`.chat-page` regnes ud fra topbaren) og placering. Artikel-editoren bruger stadig ældre klasser, som er restylet til tokens (ingen klasser fjernet).
- Annoncegeneratorens "AI: Generér 3 vinkler" var en skabelon-simulering uden model. Knappen hedder nu "Foreslå 3 vinkler" med en tekst om, at der ikke kaldes nogen AI-model (ærlighed, ingen funktionel ændring).
- Visninger/læsninger/læsetid er totaler på artikler publiceret i perioden (der findes kun totaler pr. artikel, ikke pr. dag). Det står på siden.

## Kvalitet og verifikation

- `npx tsc --noEmit`: ingen fejl i mine filer (resterende fejl kommer fra andre agenters igangværende arbejde, fx `lib/article-meta`). `npx eslint . --quiet`: ren. `npm run secrets`: ingen fund. `npm test`: 502 af 502 grønne, inkl. offentligt site, forside-editor, forside-UI og `redaktion-access`. `npm run build` kører leadet.
- Nye tests: `tests/ui-kit.test.ts` (roller, aria, tab-rækkefølge, varianter, diagrammer, ingen inline style/hex), `tests/cms-shell.test.ts` (kontrast AA for alle tekstpar og 3:1 for diagramfarver og feltkanter, tokens findes, ingen 9–11 px, navigationsfiltrering pr. standardrolle, ingen dublet-ikoner, analytics-beregninger). Layout-testen "tvungen kodeskift viser KUN kodeskiftet" er grøn (layoutet kalder `headers()` defensivt).
- **Set i browser** (indlogget session i Browser-panelet; jeg har hverken oprettet konti eller gættet adgangskoder): alle sider ovenfor på 375 px uden vandret overflow (`scrollWidth == innerWidth`; to fund rettet: skjult tekst i tabelcelle, `position: relative` på scroll-containere), analytics og sektioner på desktop, drawer + Esc + fokus-retur, søgepalet, brugermenu, forside-editor med remappede tokens.
- **Ikke set/ikke verificeret**: 768 px og 1440 px er kun kigget på for analytics (1440) og indbakke/annoncer (1024); øvrige sider kun gennem CSS-gennemgang. Selve login-siden og tvunget kodeskift er kun testet via render-test (ikke visuelt efter omskrivningen). Pil-tastatur i diagrammerne og skærmlæser-oplevelsen er ikke testet i en rigtig skærmlæser. Dialog-fokusfælde er den native `<dialog>`s og er ikke afprøvet manuelt i alle browsere. Chat/operator-panel er ikke visuelt gennemgået (ejes af andre).

## Risici

- `.cms-root` er nødvendig for CMS-typografien. Nye layouts uden for `app/redaktion/layout.tsx` (fx tvunget kodeskift, `/login`) skal selv sætte klassen; `.login-page` har egne regler.
- Globale element-regler (`h1–h6`, `body`) er uændrede i betydning for de offentlige sider, men alias-værdierne (`--color-accent` osv.) er nu indigo. Offentlige sider bruger dem ikke (kun login gør); forside-preview er uændret.
- Newsreader er `preload: false` i rod-layoutet. Det offentlige site og preview indlæser deres egen kopi; kun hvis en redaktionsside begynder at bruge serif, hentes den sent.
- AI-operatørens flydende knap og topbarens AI-knap er to indgange til samme panel. Overvej at skjule den flydende knap, når topbaren er der.
- Navigationens tæller og by-liste hentes i layoutet (fem tællinger + ét instansopslag pr. fuld sidehentning); layoutet re-renderes ikke ved klient-navigation, så tælleren opdateres først ved næste fulde indlæsning.

## Backend-huller, der blokerer analytics-tiles

Alle kræver ny sporing og/eller en aggregeringstabel (i dag findes kun `ArticleMetric` med totaler pr. artikel og `FrontpageSlotMetric` pr. dag/modul):

| Tile | Mangler |
| --- | --- |
| Unikke læsere | Cookiefri besøgsidentifikation (fx dagligt roterende hash) + daglig aggregering |
| Konverteringer | Attribution fra tilmelding/støtte/indsendelse til artikel eller kilde |
| Nyhedsbrev-CTR | Afsendelse fra systemet + klikregistrering på links (der findes ingen afsendelses- eller klikdata) |
| Trafikkilder | Henvisningskilde gemt pr. visning (søgning, sociale medier, direkte, nyhedsbrev) |
| Enhedstype | Enhedsklasse gemt pr. visning |
| Aktive timer (læsere) | Visninger pr. time/ugedag i en aggregeringstabel (i dag kun summer pr. artikel; `hourlyViews` er ikke dokumenteret) |
| Daglig udvikling af visninger/læsetid | `ArticleMetric` pr. dag (i dag kun kumulativt), så periodefilteret kan gælde målingerne direkte og ikke kun artiklernes publiceringsdato |
| Annoncer pr. dag | `AdCampaign` har kun kumulative visninger/klik |
| By-faner "Alle" | En samlet netværksrolle og aggregering på tværs af instanser |
