# Komponentkontrakter — offentlig frontend

Alle ligger i `cms/components/site/`. Styling via tokens i `cms/styles/site.css` (DESIGN.md §2, §10). Server components, medmindre andet står.

## ArticleCard (K-05)

```ts
type ArticleCardProps = {
  variant: "hoved" | "standard" | "kompakt" | "tekst";
  article: {
    titel: string; manchet?: string; href: string;
    sektion: string; undersektion?: string; omraade?: string;
    cover?: { url: string; alt: string };
    forfatter?: { navn: string; portraetUrl?: string };
    publiceret: Date;
    indholdstype: "Uafhængig" | "Partner" | "Sponsoreret" | "Brugerindsendt" | "AI-assisteret" | "PR";
    sponsor?: string; afsender?: string;
    debatLabel?: "Leder" | "Kommentar" | "Læserbrev";
    breaking?: boolean;
  };
  headingLevel?: 2 | 3;        // korrekt dokumentoutline
  priority?: boolean;          // next/image priority kun for tophistorien
};
```
- Billedformat: 3:2 (hoved/standard), 1:1 (kompakt), intet (tekst).
- Label-linje: `SEKTION · UNDERSEKTION · OMRÅDE` (hoved/standard), `UNDERSEKTION · OMRÅDE` (kompakt), tid (tekst).
- Mærkning via `ContentLabel` — altid, når `indholdstype !== "Uafhængig"`. Sponsoreret får rav-rammen på hele kortet.
- Hele kortet er klikbart via `::after` på titel-linket; kun titlen er i tab-rækkefølgen.
- `breaking`: badge "BREAKING" i `--site-accent` før titlen (ingen ekstra signalfarve).
- Relativ tid: "12 min.", "3 t.", "I går 14.05", derefter dato. `<time dateTime>` altid.

## ContentLabel og MarkingBox (K-06)

- `ContentLabel` (kort): badge med ikon + tekst. Farver fra DESIGN.md §2.2. `aria-label` med fuld tekst ("Annonce fra Byens Bank").
- `MarkingBox` (artikel): fuld tekst fra governance.md §1 + link "Læs vores redaktionelle principper". `role="note"`.
- Ingen andre komponenter må rendere mærkning.

## SiteHeader (K-01)

- Mobil: logo (ordmærke) venstre, søg + menu højre, 56 px. Sektionsbar under: vandret scroll, fade i højre kant, aktiv sektion med 3 px accent-underlinje.
- Desktop: logo, sektioner, søg, "Indsend", "Bliv støtte". Sticky, 64 px → 56 px ved scroll (ingen JS-tung animation).
- Ingen megamenu (DESIGN.md §6a.2).
- "Spring til indhold" som første element.

## BottomNav (K-02) — client

- Kun < 1024 px. Fem faner: Forside · Sektioner · Kalender · Søg · Profil (Profil er deaktiveret/skjult indtil X-04; brug "Om" midlertidigt).
- "Sektioner" åbner `SectionSheet`. Aktiv fane: accentfarve + `aria-current`.
- `padding-bottom: env(safe-area-inset-bottom)`. Sidens indhold får tilsvarende bundmargin.

## SectionSheet (K-03) — client

- Bottom sheet, fokusfælde, Escape lukker, fokus tilbage til udløser.
- Indhold: sektioner med undersektioner foldet ud, derefter områder, derefter Om mediet / Indsend / Bliv støtte.

## SectionHeader (K-07)

- H1 = sektion (eller undersektion med sektion i `Breadcrumbs` over).
- Undersektionspiller: "Alle" + undersektioner i `sortering`-orden; `aria-current` på aktiv. Vandret scroll på mobil.
- Områdefilter: `<select>` eller liste, opdaterer `?omraade=` (client component, `router.replace`, `scroll: false`).

## LatestTicker (K-08) og ShortNewsList (K-09)

- Ticker: én linje, prik (animeret kun uden `prefers-reduced-motion`), "Seneste nyt", tid, titel.
- Kort nyt: 6-8 tekstkort med tid og mærkning (typisk AI-assisteret), tæt linjeafstand, skillestreger.

## Byline (K-10)

- Portræt 40 px (rundt), navn som link til forfatterside, "Publiceret [dato kl.]", "Opdateret [dato kl.]" hvis forskelligt.

## DateDivider + LoadMore (K-11)

- Skillelinjer: "I dag", "I går", "Mandag 28. september".
- "Vis flere" henter næste 20 via server action eller `?side=`; fokus flyttes til første nye kort.

## NewsletterSignup (K-12) — client

- E-mail + samtykke-checkbox (ikke forudvalgt) + knap. Server action. Fejl og kvittering med `aria-live="polite"`.

## Øvrige

- `EventCard` + `DateBadge` (K-13): datobadge nederst til venstre på billedet: måned i accent, dag på hvid.
- `PartnerStrip` (K-14): logoer i gråtoner, fuld farve ved hover; overskrift "Lokale fællesskaber — de støtter lokal journalistik"; link til `/bliv-stoette`.
- `Breadcrumbs` (K-15): `nav aria-label="Brødkrumme"` + `BreadcrumbList`-schema.
- Artikelblokke (K-16): site-renderer til de 8 eksisterende bloktyper; genbrug `lib/blocks/schema.ts`, lav en ny renderer i `components/site/blocks/` frem for at ændre admin-rendereren. Brødtekst i Literata 18/19 px, maks. 68 tegn pr. linje.
