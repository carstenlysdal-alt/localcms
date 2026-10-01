# DESIGN.md — Designsystem til netværk af lokale medier
### Skabelon for den offentlige frontend. Slagelse er første instans. Bygger på del 4 §9, del 8 §3 og del 10.

> **Status:** Forslag til godkendelse. Navnemønstret er "[By]Lokalt" (del 8 §1), men selve logoet mangler. Intet her er hentet fra migogaalborg.dk: hverken farver, skrifttyper, tekster, logo eller billeder. Fra referencen er kun *principperne* taget med (faste kortstørrelser, fælles skabelon med lokal variation).

---

## 1. Principper

1. **Ét fælles system, få lokale variable.** Alle sites bruger samme komponenter. Kun `--site-*`-variablerne i afsnit 9 skifter pr. kommune.
2. **Farve betyder indholdstype, ikke kategori.** Kategorier markeres med tekst. Farve, ramme og badge er forbeholdt mærkning (partner, annonce, indsendt, AI) og accent. Læseren skal kunne se forskel på journalistik og betalt indhold uden at læse teksten (del 4 §1, del 1 §9.3).
3. **Mobil først.** Designes til 375 px og skaleres op. Første skærm viser logo, "Seneste nyt" og tophistorien, aldrig en annonce (del 4 §1).
4. **Roligt.** Ingen bannerannoncer, wallpaper eller flydende overlays. Luft frem for tæthed (del 4 §9.2).
5. **Tilgængeligt.** WCAG 2.1 AA som minimum. Mærkning må aldrig kun bæres af farve.
6. **Let.** Mål: under 60 forespørgsler og 1,5 MB på forsiden, LCP under 2,5 sek. på mobil 4G (del 4 §1, del 5).

---

## 2. Tokens

### 2.1 Fælles farver (neutrale)

| Token | Værdi | Brug |
|---|---|---|
| `--paper` | `#F7F3EC` | Sidebaggrund (varm, ikke kold grå) |
| `--surface` | `#FFFFFF` | Kort, artikelspalte, formularer |
| `--ink` | `#1E1A16` | Overskrifter og brødtekst |
| `--ink-2` | `#4A433C` | Manchet, metadata, sekundær tekst |
| `--ink-3` | `#6B6258` | Tertiær tekst (datoer, billedtekster). Aldrig under 14 px. |
| `--line` | `#DDD5C8` | Streger, kortkanter |
| `--focus` | `#1E1A16` | Fokusring (2 px, offset 2 px) |

### 2.2 Mærkningsfarver (fælles for alle sites, skifter ikke)

| Indholdstype | Baggrund | Tekst | Ramme | Andre kendetegn |
|---|---|---|---|---|
| Partner-/støttefinansieret | `#E3ECF2` | `#1F3A4D` | 1 px `#1F3A4D` | Badge "Finansieret af [støtte]" + ikon (håndtryk) |
| Sponsoreret / annonce | `#FCE8A6` | `#4D3900` | 2 px `#B8860B` + rav-kant øverst | Badge "Annonce" i versaler. Eget artikellayout. |
| Indsendt (spor A) | `#E7EBDD` | `#3F4A2A` | 1 px stiplet `#3F4A2A` | Byline "Indsendt af …" + ikon (talebobler) |
| AI-assisteret (spor B) | `#FFFFFF` | `#4A433C` | 1 px stiplet `--ink-2` | Badge "AI-assisteret" + "godkendt af [navn]" |
| Pressemeddelelse | `#FFFFFF` | `#4A433C` | Ingen | Byline "Pressemeddelelse fra …" |
| Uafhængig journalistik | – | – | – | **Ingen mærkning** (standard) |

Regel: hver mærkning har tekst, ikon og form, ikke kun farve. Rav må aldrig bruges som site-accent.

### 2.3 Kontrast (målt, WCAG 2.1)

| Par | Ratio | Krav | Status |
|---|---|---|---|
| `--ink` på `--paper` | 15,6 | 4,5 | OK |
| `--ink-2` på `--paper` | 8,8 | 4,5 | OK |
| `--ink-3` på `--paper` | 5,4 | 4,5 | OK |
| `--ink-3` på `--surface` | 6,0 | 4,5 | OK |
| Partner: `#1F3A4D` på `#E3ECF2` | 9,9 | 4,5 | OK |
| Annonce: `#4D3900` på `#FCE8A6` | 9,1 | 4,5 | OK |
| Annonce-ramme `#B8860B` mod hvid | 3,3 | 3,0 (ikke-tekst) | OK |
| Indsendt: `#3F4A2A` på `#E7EBDD` | 7,8 | 4,5 | OK |
| AI: `#4A433C` på hvid | 9,7 | 4,5 | OK |

### 2.4 Typografi

| Rolle | Skrift (forslag) | Vægt | Kilde |
|---|---|---|---|
| Overskrifter, display | Bricolage Grotesque | 600-800 | Google Fonts, selv-hostes |
| Brødtekst, manchet | Literata | 400 / 600 | Google Fonts, selv-hostes |
| Metadata, badges, datoer | Bricolage Grotesque | 500, versaler ved badges | – |

Begge skrifttyper er under åben licens (SIL OFL). De skal selv-hostes som WOFF2 med `font-display: swap` og kun de nødvendige tegnsæt (latin + æøå). Skrifttyperne er et forslag og bør afprøves på mobil, før de låses. Alternativer: Fraunces + Source Serif 4.

**Skala (mobil → desktop, linjehøjde i parentes):**

| Niveau | Mobil | Desktop |
|---|---|---|
| Display (tophistorie, artikel-H1) | 30 px (1,1) | 44 px (1,08) |
| H2 (sektionsrubrik) | 22 px (1,2) | 28 px (1,2) |
| Korttitel stor | 22 px (1,2) | 28 px (1,15) |
| Korttitel lille | 17 px (1,25) | 18 px (1,25) |
| Manchet | 19 px (1,45) | 21 px (1,45) |
| Brødtekst | 18 px (1,6) | 19 px (1,65) |
| Metadata | 14 px (1,4) | 14 px (1,4) |
| Badge | 12 px, versaler, +0,04 em | 12 px |

Brødtekstens linjelængde: 60-72 tegn (ca. 640 px).

### 2.5 Mellemrum, form og skygge

- **Grundenhed:** 4 px. Skala: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96.
- **Sidemargin:** 16 px på mobil, 24 px på tablet, auto på desktop.
- **Radius:** kort 8 px, badges 4 px, knapper 999 px (piller), billeder 8 px.
- **Skygge:** kun ved hover/løft: `0 2px 8px rgba(30,26,22,.12)`. Ingen tunge skygger.
- **Streger frem for skygger** til at adskille sektioner (`1px --line`).

---

## 3. Layout og grid

| Bredde | Kolonner | Maks. indhold |
|---|---|---|
| < 640 px | 4, gutter 16 | fuld bredde |
| 640-1023 px | 8, gutter 24 | fuld bredde |
| ≥ 1024 px | 12, gutter 24 | **1.200 px** |

- **Artikelspalte:** 640 px tekst, evt. med en smal sidespalte (280 px) til "Top 3 i dag" og partnermodul på desktop.
- **Ingen sidebannere.** Overskydende bredde er tom luft.
- **Kortstørrelser** (fra 12-kolonne-grid): 12/12 (hovedhistorie), 8/12, 6/12, 4/12, 3/12 (kompakte lister). Kun disse fem mål bruges.

---

## 4. Kortsystem

Fem korttyper, som alle findes i en standardvariant og i de mærkede varianter fra 2.2.

| Korttype | Indhold | Bruges til |
|---|---|---|
| **Hoved** | Stort billede (3:2), kategori, korttitel stor, manchet, forfatter/dato | Tophistorie |
| **Standard** | Billede (3:2), kategori, korttitel, forfatter/dato | Forsidens artikelblokke |
| **Kompakt** | Lille billede (1:1), kategori, korttitel, tid | Lister, "Top 3 i dag", relaterede |
| **Tekst** | Kun kategori, korttitel og tid | "Kort nyt" (spor B), "Seneste nyt" |
| **Event** | Billede med datobadge, titel, relativ tid, sted, pris/billet | Kalender og forside |

**Kortanatomi (standard):**

1. Billede, 3:2, radius 8 px, `alt`-tekst påkrævet.
2. Kategorilabel i 12 px versaler, farve `--ink-2`, med område bagefter ("NYHEDER · KORSØR").
3. Titel i Bricolage Grotesque 600.
4. Metadata: forfatter · relativ tid.
5. Hele kortet er ét link (kun titlen er tabbable, resten er klikbart via `::after`).

**Mærkede varianter:**

- **Partner:** blå baggrund, badge "Finansieret af [støtte]" øverst på kortet.
- **Annonce:** rav-ramme (2 px), rav-kant øverst, badge "ANNONCE" i øverste venstre hjørne af billedet. Kortet må aldrig ligne et standardkort med lille tekst.
- **Indsendt:** stiplet ramme, byline "Indsendt af …".
- **AI-assisteret:** stiplet ramme, tekstkort uden billede, med "AI-assisteret" som badge.

**Hover og fokus:** kortet løftes 2 px og får skygge. Fokusringen er altid synlig. `prefers-reduced-motion` fjerner løft og animation.

---

## 5. Forsidens zoner

Zonerne er konfigurerbare og bygger på automatiske regler med manuel overstyring (udløb 48 timer, del 4 §4.1). Numrene er ID'er, ikke rækkefølge. Rækkefølgen på forsiden står i 6a.4.

| # | Zone | Kort | Regel |
|---|---|---|---|
| 1 | **Seneste nyt** | Tekst, én linje med pulserende prik (kun hvis `prefers-reduced-motion` ikke er sat) | Seneste publicerede |
| 2 | **Tophistorie** | Hoved + 2 standard | Manuel, fallback: mest læst seneste 12 timer |
| 3 | **Fra dit område** | 3 standard | Regel: senest publicerede med områdetag. Områdevælger øverst. |
| 4 | **Kort nyt** | Tekst-liste, 6-8 punkter | Spor B (AI-assisteret), dato og kilde |
| 5 | **Fra borgerne** | 3 kompakte | Spor A, "Indsendt af" |
| 6 | **Kalender** | 4 event-kort + "Se hele kalenderen" | Næste 7 dage, kun godkendte |
| 7 | **Sektionsblokke** | 4 standard pr. sektion (Erhverv, Sport, Kultur, Foreningsliv) | Nyeste pr. kategori |
| 8 | **Lokale fællesskaber** | Partnerlogoer i rotation, mærket "Støtter" | Fællesskab- og Fyrtårn-partnere (del 1 §8.1) |
| 9 | **Guide** | 3 guidekort | Sæsonguide eller udvalgt guide |
| 10 | **Nyhedsbrev** | Fast modul med formular | Efter zone 4, ikke flydende |
| 11 | **Video** | Rail med korte videoer | **Kun** når ≥ 4 aktuelle videoer |

- **Kvoteloft:** systemet advarer, hvis partner- og annonceindhold overstiger den fastsatte andel af forsidezonerne (del 1 §8.3, punkt 4).
- **"Vis flere"-knap** i stedet for uendelig liste. Footer skal kunne nås.
- **Zone 11** vises ikke, når betingelsen ikke er opfyldt. Ingen tomme moduler.

---

## 6. Artikelsiden

Rækkefølge, oppefra:

1. Brødkrumme: sektion › område
2. **Mærkningsboks** (kun hvis artiklen ikke er uafhængig journalistik) med fuld tekst, jf. del 1 §9.3 og del 10 §4.3
3. H1 (display, 700), maks. tre linjer på mobil
4. Manchet (påkrævet felt i CMS'et)
5. Byline: forfatterfoto, navn (link til forfatterside), publiceret- og opdateret-tidspunkt
6. Billede (16:9 eller 3:2) med billedtekst og fotokredit
7. Brødtekst med mellemrubrikker (H2), citatblokke og faktabokse
8. Rettelser (hvis relevant) som markeret boks øverst med dato, jf. `/om-mediet/rettelser`
9. Del, gem og følg emne/område
10. Tags (område og emner)
11. "Top 3 i dag" og "Mere fra [område]"
12. Nyhedsbrevsmodul

**Citater:** `blockquote` med tydelig kildelinje. AI-understøttede citater viser kilde og tidsstempel (del 9 §2).

**Strukturerede data:** `NewsArticle` med `isAccessibleForFree`, `publisher.publishingPrinciples`, `correction`, `author` (Person) og `about`/`contentLocation` (område).

---

## 6a. Sektioner og undersektioner (nyhedsstrukturen)

Sitet er **primært et nyhedssite**. Navigation, forside og URL'er bygges op om sektioner med undersektioner. Kalender og guide er serviceindgange ved siden af, ikke kernen.

### 6a.1 Sektionstræ for Slagelse (standard, redigerbart pr. site via CMS-11)

| Sektion | Undersektioner | Slug |
|---|---|---|
| **Nyheder** | Politik · Krimi og retsvæsen · Trafik · Skole og børn · Sundhed · Bolig og byudvikling · Natur og klima | `/nyheder`, `/nyheder/politik` … |
| **Erhverv** | Handel · Job og arbejdsmarked · Iværksættere · Landbrug · Byggeri og ejendomme | `/erhverv/…` |
| **Sport** | Fodbold · Håndbold · Motion og løb · Anden sport | `/sport/…` |
| **Kultur** | Musik · Scene og film · Kunst og museer · Mad og drikke | `/kultur/…` |
| **Foreningsliv** | Frivillige · Idrætsforeninger · Kulturforeninger · Lokalråd | `/foreningsliv/…` |
| **Debat** | Leder · Kommentarer · Læserbreve | `/debat/…` |

Regler:
- **To niveauer, aldrig tre.** En artikel har én sektion og højst én undersektion. Emnetags dækker resten.
- **Område går på tværs.** Korsør, Skælskør osv. er ikke sektioner. De er områdetags med egne sider (`/omraade/korsoer`), og de kan filtreres på alle sektionssider.
- **Kategorilabel på kort:** `SPORT · HÅNDBOLD · KORSØR` (sektion · undersektion · område). På små kort vises kun det mest specifikke niveau + område (`HÅNDBOLD · KORSØR`).
- **URL for artikler:** `/[sektion]/[slug]`. Undersektionen hører til i brødkrummen, ikke i URL'en, så en artikel kan flyttes mellem undersektioner uden at få nyt link.

### 6a.2 Navigation med undersektioner

- **Desktop:** Sektionsbar med de seks sektioner under logoet. Hover/fokus på en sektion åbner **ikke** en megamenu. Sektionssiden har i stedet sin egen undersektionsbar (se 6a.3). Det holder topbaren rolig og hurtig.
- **Mobil:** Vandret scrollbar sektionsbar under topbaren. "Sektioner" i bundmenuen åbner et bottom sheet med alle sektioner, undersektioner under hver (foldet ud) og områder nederst.
- **Aktiv sektion** markeres med en 3 px underlinje i `--site-accent` og `aria-current="page"`.

### 6a.3 Sektionsside (`/[sektion]` og `/[sektion]/[undersektion]`)

Oppefra:

1. **Sektionshoved:** sektionsnavn i display-skrift (H1), kort beskrivelse (én linje, valgfri) og **undersektionsbar** med piller: "Alle", Politik, Krimi og retsvæsen, … Den aktive pille er udfyldt med accentfarve. På mobil scroller pillerne vandret.
2. **Områdefilter:** en diskret dropdown "Hele kommunen ▾" til højre for pillerne (mobil: under). Filteret ændrer URL'en (`?omraade=korsoer`), så det kan deles.
3. **Top:** 1 hovedkort + 2 standardkort (samme mønster som forsiden, zone 2). Redaktionen kan fastgøre en historie pr. sektion. Ellers vises den nyeste.
4. **Undersektionsblokke** (kun på sektionens hovedside, ikke på undersektionssider): én blok pr. undersektion med rubrik + "Se alle →" og 3 kompakte kort. Blokke uden artikler de seneste 30 dage skjules.
5. **Kronologisk liste:** alle øvrige artikler i sektionen som kompakte kort med dato-skillelinjer ("I dag", "I går", "Mandag 28. september"). "Vis flere"-knap, 20 ad gangen.
6. **Sidespalte (kun desktop ≥ 1024 px):** "Mest læst i [sektion]" (5 tekstkort nummereret 1-5) og sektionens nyhedsbrev.

På **undersektionssiden** springes punkt 4 over, og H1 bliver undersektionens navn med sektionen som brødkrumme over.

**Debat** afviger: kortene viser forfatterens portræt og navn i stedet for billede, og en label ("Leder", "Kommentar", "Læserbrev") står før titlen, så holdningsstof aldrig forveksles med nyheder.

### 6a.4 Forsiden som nyhedsforside

Forsidens zoner (afsnit 5) prioriteres sådan for et nyhedssite: 1 Seneste nyt → 2 Tophistorie → 4 Kort nyt → 3 Fra dit område → **7 Sektionsblokke (Nyheder, Sport, Erhverv, Kultur, Foreningsliv, Debat i den rækkefølge)** → 5 Fra borgerne → 10 Nyhedsbrev → 8 Lokale fællesskaber → 6 Kalender → 9 Guide. Kalender og guide ligger nederst.

---

## 7. Kalender og guide

### 7.1 Kalender

- Filterbar: dato, "Denne weekend / Denne uge / Denne måned", **område**, kategori og fritekstsøgning.
- Eventkort: datobadge (måned i site-accent, dag på hvid) placeret på billedets nederste venstre hjørne. Titel, relativ tid ("I morgen · 19:30"), sted, pris, "Billet"-knap.
- Sponsorerede events: rav-ramme og "ANNONCE"-badge, kun ét pr. visning i toppen.
- Eventside: `Event`-schema, kort, "Læg i kalender" (`.ics`), "Del", relaterede artikler.
- "Indsend arrangement" som fast knap (CMS-07).

### 7.2 Guide og profil

- Hub: introduktion + kategorigrid (billede + titel). Kategorierne konfigureres pr. site (fx Spis og drik, Foreninger, Oplevelser, Børnefamilier).
- **Profilside = virksomheds-/foreningsside** (del 10 §6.2). To zoner: (a) **Profil** (betalt/medlem, mærket "Profil"), med adresse, telefon, åbningstider, kort og links. (b) **Artikler om [navn]** (redaktionel, automatisk). Zonerne adskilles af en tydelig streg og overskrift.
- `LocalBusiness`/`Restaurant`-schema med åbningstider.

---

## 8. Navigation

**Mobil:**
- Topbar: logo (venstre) + søg og menu (højre).
- **Bundmenu** (fast, 56 px): Forside · Sektioner · Kalender · Søg · Profil (del 4 §9.2). Aktiv fane har accentfarve + tekstlabel.
- Sektionsbar: vandret scrollbar række under topbaren med tydelig fade i kanten.
- Menu åbner som "bottom sheet" med sektioner, områder, guide, "Bliv støtte", "Om mediet".

**Desktop:**
- Topbar med logo, sektioner, søg, "Indsend" og "Bliv støtte". Sticky ved scroll, 56 px.
- Områdevælger i topbar eller under logo.
- Footer: sektioner, om mediet (principper, rettelser, kontakt), "Støtter os", **Netværket** (links til søstersites), sociale kanaler, nyhedsbrev.

**Fokus og tastatur:** "Spring til indhold" som første tabbable element. Alle interaktive elementer har synlig fokusring.

---

## 9. Netværksvariabler (lokal identitet pr. site)

Kun disse skifter pr. kommune. Alt andet er fælles.

| Variabel | Slagelse (instans 1) | Beskrivelse |
|---|---|---|
| `--site-name` | SlagelseLokalt | Medienavn efter mønstret "[By]Lokalt" (del 8 §1). Domæne: `slagelselokalt.dk` |
| `--site-accent` | `#9E3D1B` (tegl) | Accentfarve: links, knapper, aktive faner, datobadge |
| `--site-accent-strong` | `#7F2F13` | Hover, tekst på lys baggrund |
| `--site-accent-soft` | `#F6E3D8` | Baggrund til accentområder |
| `--site-on-accent` | `#FFFFFF` | Tekst på accentfarve |
| `--site-logo` | ordmærke (SVG) | Logo, mindst 24 px højt |
| `--site-areas` | Slagelse By, Korsør, Skælskør, Dalmose, Vemmelev, Boeslunde, Agersø, Omø | Delområder (del 1 §6.3) |
| `--site-sections` | Nyheder, Erhverv, Sport, Kultur, Foreningsliv, Debat (med undersektioner, se 6a.1) | Sektionstræ (kan udvides lokalt) |

**Accentpalette til øvrige sites** (alle testet med hvid tekst):

| Farve | Hex | Kontrast med hvid |
|---|---|---|
| Tegl | `#9E3D1B` | 6,7 |
| Mos | `#4F5B1E` | 7,4 |
| Fjord | `#1F5663` | 8,2 |
| Lyng | `#6A3553` | 9,4 |
| Skov | `#24533A` | 8,9 |
| Okker | `#8A5A00` | 5,9 |

Regler for valg af accentfarve: mindst 4,5:1 mod hvid, ikke blå-lilla tæt på partner-blå (`#1F3A4D`) og ikke gul/rav (reserveret til annonce). Brug hver farve ét sted i netværket.

---

## 10. CSS-tokens (udkast)

```css
:root {
  /* Neutrale */
  --paper: #F7F3EC;
  --surface: #FFFFFF;
  --ink: #1E1A16;
  --ink-2: #4A433C;
  --ink-3: #6B6258;
  --line: #DDD5C8;

  /* Site (Slagelse) */
  --site-accent: #9E3D1B;
  --site-accent-strong: #7F2F13;
  --site-accent-soft: #F6E3D8;
  --site-on-accent: #FFFFFF;

  /* Mærkning */
  --label-partner-bg: #E3ECF2;  --label-partner-ink: #1F3A4D;
  --label-ad-bg: #FCE8A6;       --label-ad-ink: #4D3900;  --label-ad-line: #B8860B;
  --label-user-bg: #E7EBDD;     --label-user-ink: #3F4A2A;
  --label-ai-bg: #FFFFFF;       --label-ai-ink: #4A433C;

  /* Typografi */
  --font-display: "Bricolage Grotesque", system-ui, sans-serif;
  --font-body: "Literata", Georgia, serif;

  /* Form */
  --radius-card: 8px;
  --radius-badge: 4px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px;
}

:root { color-scheme: light; }
```

Kun lys tilstand. Siden erklærer `color-scheme: light`, så browserens automatiske mørke tilstand ikke ændrer farverne og bryder mærkningen.

---

## 11. Komponentliste til første prototype

1. Topbar og bundmenu
2. Kort (fem typer × mærkede varianter)
3. Forside (zone 1-6, 10)
4. Artikelside med mærkningsboks og rettelser
5. Kalender med filter og eventside
6. Guide-hub og profilside
7. Områdeside (`/omraade/[slug]`)
8. Partnerdashboard (læseadgang, del 4 §8)

## 12. Ikke med i denne omgang

Illustrationsstil, ikonbibliotek (forslag: enkel linjeikonografi, 1,5 px streg), motion-retningslinjer ud over `prefers-reduced-motion`, logo og ordmærke (navnemønster besluttet, selve designet mangler) og partnerdashboardets detaljerede design.

## 13. Åbne beslutninger

1. ~~Medienavn og domænemønster~~ Besluttet: "[By]Lokalt" (del 8 §1). Åbent: registrering af domæner og varemærketjek
2. Godkendelse af skrifttyper (Bricolage Grotesque + Literata) efter test på mobil
3. Slagelse-accent: tegl `#9E3D1B` eller en anden fra paletten
4. Om guide og profil samles i én sidetype (anbefaling: ja)

*Besluttet: ingen mørk tilstand.*
