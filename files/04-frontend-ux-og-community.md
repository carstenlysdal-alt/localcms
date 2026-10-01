# Del 4: Frontend, UX og community
### Ny lokal medieplatform for Slagelse Kommune

---

## 1. Frontend og brugeroplevelse — principper

- **Mobil-først:** Antagelsen er, at 65-75 % af trafikken vil komme fra mobil (i tråd med generelle danske nyhedsmedievaner) — layoutet designes til mobil og skaleres op, ikke omvendt.
- **Hurtighed:** Målsætning om Largest Contentful Paint under 2,5 sekunder på mobil 4G — afgørende både for læseroplevelse og SEO (Core Web Vitals, se del 5).
- **Tilgængelighed:** WCAG 2.1 AA som minimumsstandard — kontrast, tastaturnavigation, skærmlæservenlig struktur.
- **Tydelig mærkning:** Journalistisk vs. kommercielt indhold skal kunne skelnes visuelt uden at læse teksten (farve, badge, typografi) — jf. del 1, afsnit 9.3.
- **Personalisering uden filterboble:** Brugere kan følge emner/lokationer/foreninger/journalister, men forsiden viser altid en fælles, redaktionelt kurateret hovedstrøm — det personaliserede lag er et supplement (fx en "Til dig"-modul), ikke en erstatning for den fælles forside.

---

## 2. Sitemap (forslag)

```
/ (forside)
├── /nyheder
├── /erhverv
├── /sport
├── /kultur
├── /foreningsliv
├── /debat
├── /guide
├── /kalender
│   ├── /kalender/[event-slug]
│   └── /kalender/indsend
├── /video
├── /lyd (podcast)
├── /omraade/[slagelse|korsoer|skaelskoer|...]
├── /emne/[tag-slug]
├── /forening/[navn-slug]
├── /virksomhed/[navn-slug]         (også landingsside for støtter)
├── /forfatter/[navn-slug]
├── /artikel/[kategori]/[slug]
├── /soeg
├── /indsend-historie
├── /bliv-stoette
├── /om-mediet
│   ├── /om-mediet/redaktionelle-principper
│   ├── /om-mediet/rettelser
│   └── /om-mediet/kontakt
├── /profil (brugerdashboard, kræver login)
├── /partner (supporterdashboard, kræver login)
└── /redaktion (internt CMS, separat subdomæne/adgang)
```

## 3. Centrale sidetyper

| Sidetype | Kernefunktion |
|---|---|
| Forside | Redaktionelt kurateret + let personaliseret modul, jf. afsnit 4 |
| Artikelside | Fuld visning af artikel inkl. mærkning, relaterede historier, deleknapper |
| Kategori-/emneside | Kronologisk/vægtet liste, filtrerbar |
| Geografisk områdeside | Alt indhold tagget til et delområde, inkl. lille kort |
| Foreningsside | Profil + alle artikler om/med foreningen, "følg"-knap |
| Virksomheds-/støtteside | Profil, evt. "Fyrtårnspartner"-badge, alle relaterede historier |
| Personside/forfatterside | Bio, alle artikler af/om personen |
| Kalenderside/eventside | Liste- og kortvisning, filtrering på kategori/dato/område |
| Søgeresultater | Fritekstsøgning på tværs af alt indhold |
| Indsend historie/event | Formular, kobler til CMS-07 (del 3) |
| Bliv støtte | Pakkeoversigt (jf. del 1, afsnit 8), kontaktformular |
| Om mediet / redaktionelle principper / rettelser / kontakt | Transparensside — obligatorisk for troværdighed |
| Profildashboard (læser) | Fulgte emner, gemte artikler, nyhedsbrevsindstillinger |
| Partnerdashboard (støtte) | Se afsnit 6 |

---

## 4. Forside- og sektionsstyring

### 4.1 Model: manuel styring + automatiske regler

Forsiden opbygges af konfigurerbare **zoner** (hovedhistorie, topnyheder, seneste nyt, temasektion, geografisk sektion, sport, erhverv, kultur, kalender, video, lyd, partnersektion). Hver zone har en **standardregel** (fx "seneste 6 artikler i kategori Sport, nyeste først") som redaktionen kan **overstyre manuelt** ved at trække en specifik historie ind i zonen.

- Manuel placering "vinder" altid over automatisk regel, men har en indbygget udløbstid (fx 48 timer), hvorefter zonen falder tilbage til automatisk regel — for at undgå, at en gammel manuel prioritering utilsigtet "fryser" forsiden.
- Redaktionen kan planlægge forsideændringer frem i tid (fx en temasektion, der aktiveres kl. 06:00 dagen for et stort lokalt event).
- Preview på mobil, tablet og desktop, før ændringer går live.
- Kvoteloftet for støttefinansieret indhold (del 1, afsnit 8.3) håndhæves som en regel på tværs af zoner — systemet advarer, hvis en manuel placering ville bringe andelen over loftet.

---

## 5. Community-funktioner

### 5.1 Funktioner

Indsendelse af historier og arrangementer · tips til redaktionen (kan afgives anonymt) · kommentarer · reaktioner (let, fx "nyttigt"/"vigtigt" frem for generiske likes) · deling · følg emne/lokalområde/forening/journalist · gem artikel · lokale nyhedsbreve (generelt + evt. emnespecifikke) · brugerprofiler · afstemninger · crowdsourcing af viden (fx "kender du historien bag...").

### 5.2 Moderation uden at drukne redaktionen

- **Forhåndsmoderation** af kommentarer på følsomme historier (fx kriminalstof, politisk debat); **efterfølgende moderation** (med rapporteringsknap) på øvrigt indhold.
- Automatisk (regelbaseret, ikke AI-tung i MVP) filtrering af bandeord/spam, suppleret af brugerrapportering.
- Klare, offentligt tilgængelige debatregler på "Om mediet"-siden, og en synlig konsekvenstrappe (advarsel → midlertidig udelukkelse → permanent).
- Community manager-rollen (del 2) har ansvar for daglig moderation; ansvarshavende redaktør er presseetisk ansvarlig for kommentarsporet som helhed, jf. medieansvarsloven.

**Antagelse:** Fuldt bemandet, døgndækkende moderation er ikke realistisk i MVP-fasen.
**Konsekvens:** Kommentarfunktion lanceres først på et afgrænset udvalg af artikler (fx ikke på kriminal- eller stærkt polariserende politisk stof) og udvides gradvist i takt med moderationskapacitet — indarbejdes i MVP-afgrænsningen (del 6).

---

## 6. Kalender og arrangementer

### 6.1 Funktionalitet

Brugere og arrangører indsender arrangementer via formular (kobler til CMS-07); redaktionel godkendelse er standard. Understøtter: gentagne arrangementer (ugentlig/månedlig), lokation med kortvisning, tidspunkt, billetlink, pris, arrangørprofil (kobler til organisationsmodul), billeder, kategori, målgruppe, fremhævede/sponsorerede arrangementer, deling, download som .ics-kalenderfil, påmindelser (opt-in e-mail/push), og automatisk kobling til relaterede artikler (fx dækning af sidste års udgave af samme event).

### 6.2 Sponsorerede arrangementer

Fremhævede/sponsorerede placeringer i kalenderen mærkes på samme måde som andet kommercielt indhold (badge), og indgår i støttepakkernes kickback-værdi, hvor relevant (jf. del 1, afsnit 8).

---

## 7. Sociale medier og distribution

### 7.1 Genereret materiale pr. artikel

Ved publicering kan redaktionen (AI-assisteret, jf. del 3, niveau 2) generere: kort og langt opslag, flere overskriftsvarianter, platformstilpasset tekst (Facebook, LinkedIn, Instagram), video-/lyduddrag, delingsbillede (Open Graph), UTM-mærkede kampagnelinks, og forslag til optimalt publiceringstidspunkt baseret på historiske engagementsdata.

### 7.2 Støtters brug af materiale

- Godkendt materiale (artikler, billeder, video, sociale opslagstekster) stilles til rådighed for støtten via partnerdashboardet (afsnit 6 nedenfor) i færdige, downloadbare formater.
- **Brugsrettigheder:** Støtten må dele og genbruge materialet i egne kanaler med kreditering til mediet; må **ikke** redigere i den journalistiske tekst eller klippe citater ud af kontekst — denne begrænsning fremgår eksplicit af partnerkontrakten og gentages i dashboardets download-flow.
- **Forhindring af journalistiske ændringer:** materiale udleveres som færdige, ikke-redigerbare filer (PDF/billede/video) frem for redigerbare kildefiler, netop for at forhindre utilsigtede eller tilsigtede ændringer.
- **Kreditering:** alle udleverede formater bærer synlig kildeangivelse og logo.
- **Effektmåling:** trafik fra støttens egne kanaler til mediet spores via UTM-parametre og vises tilbage til støtten i dashboardet (visninger, klik, delinger) — se afsnit 6.

---

## 8. Supporter- og partnerdashboard

### 8.1 Funktioner (læseadgang, ingen redaktionel kontrol)

Aftale og støtteniveau · betalingsstatus · resterende kickback-/produktionskvote (artikler, video, sociale opslag) · status på igangværende historier (hvilken workflow-fase, jf. del 2) · godkendte, downloadbare materialer · statistik (visninger, læsetid, delinger, klik, trafik videre til støttens egne sider) · kommende planlagte leverancer · mulighed for at indsende nye historieidéer · direkte kontakt til partnerskabsansvarlig · synlig gengivelse af de redaktionelle principper for uafhængighed (samme tekst som på "Om mediet").

### 8.2 Eksplicitte begrænsninger (skal være synlige i dashboardet, ikke kun i kontrakten)

Dashboardet kan **ikke**: godkende eller redigere artikeltekst før publicering, fjerne eller påvirke kritisk omtale af støtten, se andre støtters aftaler eller performance, eller se fortrolige kildeoplysninger. En fast tekstboks i dashboardet gengiver kort disse begrænsninger, så de er tydelige for støtten ved hvert login — det er en tillidsskabende funktion, ikke kun en juridisk formalitet.

---

## 9. Visuel identitet

### 9.1 Ønsket oplevelse

Lokal, moderne, troværdig, varm, professionel, tilgængelig, uafhængig, community-orienteret, journalistisk seriøs uden at være gammeldags.

### 9.2 Designprincipper

- **Typografi:** en solid, læsevenlig serif eller humanistisk sans-serif til brødtekst (høj x-højde, god skærmlæsbarhed); en distinkt, varm display-skrift til overskrifter, der signalerer redaktionel identitet uden at kopiere de etablerede titlers klassiske avis-look.
- **Farveretning:** en varm, jordnær primærfarve (frem for det kolde blå, mange nyhedsmedier bruger) kombineret med neutral gråskala til brødtekst-omgivelser — farven bruges konsekvent og genkendeligt, ikke som tilfældig accent.
- **Billedstil:** autentiske, lokalt producerede fotos frem for stockbilleder; konsekvent billedbeskæring (fx 3:2 til artikelforsider, 1:1 til sociale kort).
- **Ikonstil:** enkel, linjebaseret ikonografi, konsekvent stregvægt.
- **Layoutprincipper:** tydeligt visuelt hierarki mellem hovedhistorie, topnyheder og øvrigt indhold; rigelig luft; ingen visuel støj fra bannerannoncer, der konkurrerer med redaktionelt indhold.
- **Kortdesign:** ensartet artikelkort-skabelon på tværs af lister (billede, kategori-tag, overskrift, kort manchet, forfatter/dato) — med en tydeligt **afvigende** kortstil (farvet ramme + badge) for sponsoreret/partnerindhold, så mærkningen kan ses i selve listevisningen, ikke først når man klikker ind.
- **Mobilnavigation:** bundmenu med de vigtigste indgange (Forside, Kategorier, Kalender, Søg, Profil) frem for skjult burger-menu alene, for at reducere klik til kernefunktioner.

### 9.3 Markering af indholdstyper (visuel opsummering)

| Indholdstype | Visuel markør |
|---|---|
| Uafhængig journalistik | Standard kortdesign, ingen badge |
| Partner-/støttefinansieret journalistik | Neutral informationsbadge ("Finansieret af [Støtte] — redaktionelt uafhængig") |
| Sponsoreret indhold | Tydelig farvet ramme + badge "Annonce"/"Sponsoreret indhold" |
| Brugerindsendt | Byline "Indsendt af..." |
| Pressemeddelelse | Byline "Pressemeddelelse fra..." |

**Antagelse:** Der er ikke angivet et endeligt medienavn eller logo i opdraget (jf. del 1, afsnit 2.2).
**Konsekvens:** Den visuelle identitet bør konkretiseres i et selvstændigt brandingforløb (typisk 2-4 uger med et designbureau eller en dygtig freelance grafiker), parallelt med den tekniske MVP-udvikling — indarbejdet i implementeringsplanen (del 6).
