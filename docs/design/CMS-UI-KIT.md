# CMS UI-kit og redaktions-shell

Autoritativ stil: `docs/design/CMS-DESIGNBRIEF.md`. Denne fil beskriver, hvad der er bygget, hvordan det bruges, og hvordan man tilføjer en side.

Filer:

| Hvad | Hvor |
| --- | --- |
| Tokens (`--cms-*`), ældre aliaser, basis, ældre klasser | `cms/styles/modernist.css` |
| Skal (sidebar, topbar, drawer, bundnav) og kit-klasser `.ui-*`, `.shell-*` | `cms/styles/cms-shell.css` |
| Sidespecifikke ældre klasser (editor, medier, opgaver, chat) | `cms/app/globals.css` |
| Kit | `cms/components/ui/*` |
| Diagrammer (ren SVG) | `cms/components/charts/*` |
| Skal-komponenter og navigationsmodel | `cms/components/admin/` (`nav-model.ts`, `nav-links.tsx`, `shell-frame.tsx`, `topbar.tsx`, `user-menu.tsx`, `global-search.tsx`, `bottom-nav.tsx`) |
| Layout | `cms/app/redaktion/layout.tsx` |

Kittet bruger hverken `style={{}}` eller hex-farver (testet i `tests/ui-kit.test.ts`). Dynamiske værdier i diagrammer sættes som SVG-attributter eller via klasser (`ui-chart-s1..6`, `ui-heat-0..5`).

## Tokens

Alle nye komponenter bruger kun `--cms-*`:

- Flader/tekst: `--cms-bg`, `--cms-surface`, `--cms-surface-sunken`, `--cms-border`, `--cms-border-strong`, `--cms-control-border` (kant på felter, 3:1), `--cms-text`, `--cms-text-muted` (AA), `--cms-text-faint` (kun dekor/ikoner/≥18 px).
- Primær og AI: `--cms-primary`, `--cms-primary-hover`, `--cms-primary-tint`; `--cms-ai` (flade/ikon på mørkt), `--cms-ai-ink` (tekst på lyst), `--cms-ai-tint`.
- Sidebar: `--cms-sidebar-bg`, `-text`, `-text-strong`, `-muted`, `-border`, `-hover`, `-active`.
- Status (flade · `-bg` · `-ink` til tekst, alle ≥ 4,5:1): `success`, `planned`, `draft`, `review`, `danger`, `info`.
- By-prikker: `--cms-city-<slug>` (slagelse, naestved, roskilde, koege, ringsted, holbaek, default). Tilføj en by ved at tilføje en variabel og en `[data-city]`-regel for `.ui-citydot` i `cms-shell.css`.
- Diagram: `--cms-chart-1..6` (alle ≥ 3:1 mod hvid), `--cms-chart-seq-0..5` (heatmap), `--cms-chart-grid`.
- Form: `--cms-radius-sm/md/lg/pill`, `--cms-shadow-sm/md/lg`, `--cms-space-1..8` (4/8/12/16/20/24/32/48), `--cms-sidebar-w` (264px), `--cms-topbar-h` (64px), `--cms-bottomnav-h`, `--cms-touch` (44px), `--cms-focus` (fokusring).
- Typografi: `--cms-font-display` (Plus Jakarta Sans), `--cms-font-body` (Inter), `--cms-font-mono` (JetBrains Mono); skala `--cms-text-xs/sm/md/lg/xl/2xl` = 12/14/16/20/24/32 px. Ingen tekst under 12 px (testet).
- z-lag: `--cms-z-topbar` 30 · `--cms-z-bottomnav` 40 · `--cms-z-scrim` 45 · `--cms-z-sidebar` 50 · `--cms-z-operator` 60 (panel 70) · mobil-drawer `--cms-z-drawer-scrim` 74 / `--cms-z-drawer` 75. `<dialog>` ligger i browserens top layer over alt. Flydende elementer bruger `--cms-float-bottom`/`--cms-float-right` (på mobil løftes de over bundnavigationen).

Ældre `--color-*`, `--space-*`, `--font-*`, `--radius-*`, `--shadow-*` er aliaser til tokens, så login, forside-preview (`site.css`) og `.fpe-*` virker uændret. `--font-heading` er bevidst stadig serif globalt (offentlige sider arver den); `.cms-root` sætter display-fonten for redaktionen. Elementregler for `h1–h6` er derfor scopet til `.cms-root`.

Fonte indlæses i `app/layout.tsx` via `next/font/google` (self-hosted): Inter, Plus Jakarta Sans (variabel, `--font-display-var`), JetBrains Mono, Newsreader (kun til offentlig preview, `preload: false`).

## Komponenter (`@/components/ui/<Navn>`)

**Page / PageHeader** (`Page.tsx`)
`<Page width="default|narrow|wide|full">` erstatter `<main className="admin-main">`. `<PageHeader title subtitle? eyebrow? icon? badge? actions? />` giver sidens `h1`. Én pr. side.

**Card** (`Card.tsx`) — `title? description? actions? footer? icon? padding="md|sm|none" tone="default|ai|warn|danger|muted" headingLevel={1..4} as id`. Med `id` og `title` får kortet `aria-labelledby`.

**StatCard** (`StatCard.tsx`) — `label value? delta? hint? icon? chart? unavailable? empty? loading?`.
`delta={{ value: 12.5, label: "mod forrige 28 dage", invert? }}` viser pil + fortegn + tekst (aldrig kun farve). `unavailable="forklaring"` viser "Kobles til når sporing er slået til" og ingen tal. `empty="tekst"` = datakilde findes, men ingen data.

**Badge / StatusChip** (`Badge.tsx`) — `tone="neutral|primary|ai|success|planned|draft|review|danger|info" dot? icon? variant="soft|solid|outline"`. `statusInfo(status)` mapper artikel- og indbakke-statusser til tone + dansk label (Udkast → "Kladde", Godkendelse → "Til redigering" …); `<StatusChip status="Planlagt" />`.

**Tabs** (`Tabs.tsx`, client) — ARIA tabs med roving tabindex: `items=[{id,label,count?,children}] label defaultTab? value? onChange?`. Pil venstre/højre, Home, End.
**LinkTabs** (`LinkTabs.tsx`) — faner som links (`<nav>` + `aria-current="page"`): `items=[{href,label,count?,active?,lead?}] label`.
**SegmentedLinks** (`SegmentedLinks.tsx`) — segmenteret valg som links (periodevælger).

**DataTable** (`DataTable.tsx`, client) — data-baseret, så serverkomponenter kan fodre den: `caption columns=[{key,header,sortable?,align?,hideOnMobile?,srOnlyHeader?}] rows=[{id,cells:{key:ReactNode},sort?:{key:value}}] state="ready|loading|error" emptyTitle? emptyDescription? emptyAction? errorMessage? defaultSort?`. Sorteringsknap i headeren med `aria-sort`; da-DK-sortering; tabellen ruller vandret i eget område (`role=region`, fokuserbar).

**Dialog / Sheet / ConfirmSubmit** (`Dialog.tsx`, client) — native `<dialog>` + `showModal()`: fokus fanges, Esc lukker, fokus returneres. `<Dialog open onClose title description? footer? size="sm|md|lg" dismissible?>`; `<Sheet>` = sidepanel (fuld skærm på mobil). `<ConfirmSubmit title message confirmLabel? tone?>` erstatter `window.confirm`: en knap, der åbner en bekræftelse og derefter kalder `form.requestSubmit()`, så server actions bevares:

```tsx
<form action={deleteAction.bind(null, id)}>
  <ConfirmSubmit className="btn btn-secondary btn-sm" title="Slet?" message="Kan ikke fortrydes." aria-label="Slet X"><Trash2 size={14} /></ConfirmSubmit>
</form>
```

**Accordion** (`Accordion.tsx`, client) — se afsnittet nedenfor.

**SaveIndicator** (`SaveIndicator.tsx`) — `status="idle|dirty|saving|saved|error" savedAt? error?`. `aria-live="polite"` (fejl: `assertive`); tekst: "Gemmer…", "Sidst gemt 14:32", "Ikke gemt", "Kunne ikke gemme: …". `saveLabel()` er eksporteret til tests.

**EmptyState, Skeleton/SkeletonGroup/SkeletonRows, Notice, Field, Grid, Row, Stack, Split** (`EmptyState.tsx`, `Skeleton.tsx`, `Layout.tsx`).
`Notice tone="info|success|warn|danger"` (`role=alert` for warn/danger). `Field label htmlFor hint? error? required?` — kontrollen skal selv have `id={htmlFor}`; hjælpetekst får id `${htmlFor}-hint`, fejl `${htmlFor}-error`.

**Toolbar / FilterBar / FilterSelect / FilterChips / SearchField** (`FilterBar.tsx`, `SearchField.tsx`) — `FilterBar` er en GET-formular (`role=search`), så filtre ligger i URL'en og virker uden JS.

**Avatar, CityDot/CityLabel** (`Avatar.tsx`, `CityDot.tsx`) — initialer med stabil farve; by-prik slås op via `data-city` (se tokens).

### Accordion

WAI-ARIA accordion: hver sektion er en overskrift (`h2`–`h4`) med en knap (`aria-expanded`, `aria-controls`), og panelet er en `role="region"` med `aria-labelledby`. Lukkede paneler forbliver i DOM'en (attributten `hidden`), så felter i dem bevares og sendes med ved formularindsendelse. Tastatur: Enter/Space åbner/lukker; pil op/ned, Home, End flytter mellem knapperne.

```tsx
<Accordion headingLevel={3} items={[
  { id: "seo", title: "SEO & metadata", meta: "3 af 5 udfyldt", defaultOpen: true, children: <SeoFields /> },
  { id: "plan", title: "Planlægning", icon: <CalendarClock size={16} />, children: <PlanFields /> },
]} />
```

`allowMultiple` (default true), `headingLevel` (2|3|4, default 3), `openIds`/`onOpenChange` (kontrolleret), `className`.

## Diagrammer (`@/components/charts`)

Ren SVG, ingen afhængigheder. Alle har titel (overskrift), `description`, tabel-fallback ("Vis data som tabel"), `role="group"` + `aria-label` med resumé, tastaturstyring (pile/Home/End, Esc), tooltip tegnet i SVG, live-region til skærmlæsere, tom tilstand uden diagram og `prefers-reduced-motion` (ingen animation). Farver kun fra `--cms-chart-*`. Bredden måles med `ResizeObserver`, så tekst altid er 12 px.

- `<LineArea title categories series=[{id,label,values:(number|null)[]}] area? valueKind="number|percent|compact" />`
- `<Bars title categories series mode="grouped|stacked" orientation="vertical|horizontal" />`
- `<Donut title slices=[{id,label,value}] centerLabel? />`
- `<Heatmap title rows cols values unit? />` (6 farvetrin)
- `<Sparkline values label tone? />` (til StatCard `chart`)

## Skallen

- **Sidebar 264 px**, mørk navy, grupperet: Indhold · Indbakke · Vækst · Struktur · System · Byer. Aktivt punkt = fyldt indigo-pille + `aria-current="page"`. Tæller-badge på Indbakke (nye henvendelser, `components/admin/nav-counts.ts`).
- **Rettighedsfiltrering** sker på serveren i `buildNav(user, counts)` (`nav-model.ts`) efter samme regler som siderne (`PAGE_PERMISSIONS`/`can`). Skjulte links giver ikke ekstra beskyttelse: siderne viser stadig `NoAccess`, og server actions tjekker igen. Tilføj en side: tilføj et punkt i `NAV_GROUPS` (med `allowed`) og et ikon i `nav-icons.tsx` (ét ikon pr. punkt, testet).
- **Byer**: fra `getNetworkLinks()`; aktuel by markeret "Du er her", øvrige er eksterne links til byens `/redaktion`.
- **Brugerblok** nederst med menu (Min konto, Brugere og Operator kun med rettighed, Log ud).
- **Topbar**: global søgning (`/` åbner; sider klient-side + artikeltitler via server action `app/redaktion/search-actions.ts`, kun i egen instans), AI-operatør-knap, hamburger på mobil. Notifikationer er bevidst udeladt: der findes ingen notifikationsdata.
- **Mobil (≤ 900 px)**: sidebar bliver drawer (resten af siden gøres `inert`, Esc lukker, fokus returneres); bundnavigation med fire hovedpunkter (de første fire man må se af Artikler, Indbakke, Forside, Analytics, Medier) + "Mere".
- Skip-link ("Spring til indhold") → `#main-content`; `<nav aria-label>`-landemærker.
- Forside-preview i iframe (`Sec-Fetch-Dest: iframe`) får ingen skal. Layoutet kalder `headers()` defensivt (virker også uden request, fx i tests).

### AI-operatør og skallen

Operatør-panelet (`components/operator`) monteres som ét `<OperatorPanel user />` nederst i layoutet og ejer Cmd/Ctrl+K. Topbarens knap sender den annullerbare `window`-hændelse `cms:operator-open`; panelet kalder `preventDefault()` for at melde "jeg tog den", ellers åbner knappen `/redaktion/chat`. Flydende elementer bruger `--cms-z-operator`, `--cms-float-bottom` og `--cms-float-right`. Skallens søgning bruger `/`, aldrig Cmd/Ctrl+K.

## Sådan tilføjer du en side

1. Opret `app/redaktion/<side>/page.tsx` som serverkomponent. Slå rettighed op med `getAuthorizedUser([...PAGE_PERMISSIONS.<side>])` og returnér `<NoAccess area="…" />` ved nej (tests forventer netop det element).
2. Byg med `<Page>` → `<PageHeader title subtitle actions />` → evt. `<LinkTabs>` → `<FilterBar>` → `<Card>`/`<DataTable>`/`<EmptyState>`. Brug `Field` og `.input`/`.btn` til formularer. Destruktive handlinger: `ConfirmSubmit` eller `Dialog`.
3. Tilføj siden i `NAV_GROUPS` (rettighedsregel + ikon). Tilføj evt. i `PAGE_PERMISSIONS`.
4. Ingen `style={{}}`, ingen hex. Nye farver er tokens. Nye klasser i `cms-shell.css`.
5. Test render med `renderToStaticMarkup` (se `tests/ui-kit.test.ts`).

Klient-komponenter, der skal ligge i en `findElement`-kæde i tests, skal være i `children` (ikke i andre props) på sidens rod.

## Analytics (`/redaktion/metrikker`)

Kun rigtige data. Periode 7/28/90 dage (`?dage=`) filtrerer faktisk: artikler publiceret i perioden (og deres summerede visninger/læsninger/læsetid, fordi `ArticleMetric` kun har totaler pr. artikel), forside-eksponeringer/klik pr. dag (`FrontpageSlotMetric`), nye abonnenter (`createdAt`). Delta sammenligner med de foregående N dage. Det der ikke måles (unikke læsere, konverteringer, nyhedsbrev-CTR, trafikkilder, enhedstype, aktive timer) vises som "Kobles til når sporing er slået til" med forklaring. By-faner: data er pr. instans; nuværende by er aktiv, andre byer er links til deres egen `/redaktion/metrikker`. Rene hjælpere ligger i `app/redaktion/metrikker/_lib/aggregate.ts` (testet).
