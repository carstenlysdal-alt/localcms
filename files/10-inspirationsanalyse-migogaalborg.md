# Del 10: Inspirationsanalyse — MigogAalborg og Min By Media
### Tillæg til del 1, 4, 7, 8 og 9: hvad netværket kan lære af Danmarks største lokale bymedie

---

## 0. Hovedkonklusion

MigogAalborg er den reference, del 8 bygger netværksmodellen på. Gennemgangen bekræfter, at Min By Media driver præcis den model, del 8 beskriver: **ét fælles tema og kodegrundlag, én fælles prisliste og lokal variation i navn, accentfarve og enkelte sektioner.** De fem sites (Aalborg, Aarhus, Odense, Esbjerg, København) kører samme WordPress-tema, de samme to skrifttyper og de samme forsidemoduler. Kun logo, accentfarve og nogle få lokale menupunkter skifter.

Tre ting er værd at tage med:

1. **Service som trafikmotor.** Kalender, spiseguide og sæsonguider er ikke pynt. De er det indhold, folk kommer tilbage til, og de rummer billige, selvbetjente annonceprodukter (fra 499 kr. pr. event).
2. **Salg pr. by og for alle byer.** Hvert produkt har én pris pr. by og én pris for hele netværket. Det er skabelonen for netværkspakkerne i del 8, afsnit 3.1.
3. **Et fast, genkendeligt kortsystem** med få varianter, der kan fylde en forside automatisk.

Tre ting skal fravælges:

1. **Annoncetrykket.** På mobil er hele første skærm en annonce, og den første artikel starter ca. 1.070 pixel nede. Forsiden henter 184 filer og ca. 5,5 MB. Det strider mod del 4, afsnit 1 (LCP under 2,5 sek.) og afsnit 9.2 ("ingen visuel støj fra bannerannoncer").
2. **Den svage mærkning.** Kategorilabels står i stærke farver, mens labelen "Annonce" er en lys grå boks, som er det mindst synlige element på kortet. Del 1, afsnit 9.3 kræver det modsatte.
3. **Brandet.** "Mig og [by]", logoopbygningen og farverne må ikke kopieres (del 8, afsnit 1).

---

## 1. Metode

Gennemgangen er lavet 29. september 2026 i en browser på desktop (1440 px) og mobil (375 px). Cookiesamtykke blev afvist. Designdata (skrifttyper, farver, størrelser, gridmål) er aflæst direkte fra sidernes beregnede CSS, ikke skønnet ud fra skærmbilleder.

Gennemgåede sider: forside (Aalborg), artikelside, annoncørbetalt artikel, kalender, spiseguide og et spisestedsprofil, Min By Medias prisliste (native, display, kalender, guider, nyhedsbrev, profilguider, pakker) samt MigogEsbjergs forside til sammenligning.

Skærmbilleder til internt brug ligger i `files/inspiration/migogaalborg/` (01-08).

**Ikke gennemgået:** Aalborg Awards, MyAalborg, Hype (gethype.dk), Events-subdomænet og Spot Byen-shoppen, da de ligger på separate platforme. Nyhedsbrevet er kun set som formular. Der er ikke tilmeldt noget.

Markering i tabellerne: **Tag med** (brug mønstret som det er), **Tilpas** (brug idéen, men lav den om efter konceptet) og **Fravælg**.

---

## 2. Netværksmønstret: hvad er fælles, og hvad er lokalt

| Element | Aalborg | Esbjerg | Vurdering | Kobling |
|---|---|---|---|---|
| Platform/tema | WordPress 7, samme tema | Samme | Fælles kodegrundlag bekræftet | Del 8 §3.2 |
| Skrifttyper | Mundial (overskrifter) + Source Sans Pro (brødtekst) | Samme | Fælles typografi på tværs af sites | DESIGN.md |
| Accentfarve | Kardinalrød `#B22920` | Blåviolet `#21009B` | **Tag med:** én farvevariabel pr. site | Del 8 §3.1 |
| Logo | "migog" + bynavn i fed, "ALT OM BYEN" | Samme opbygning | **Tag med** som princip: fast navnemønster + bynavn. Mønstret skal være eget (VoresSlagelse/SlagelseNu) | Del 8 §1 |
| Topnavigation | Kalender · Spiseguide · MyAalborg | Spiseguide · Kalender · Guider | Service-indgange står øverst, før nyhedssektionerne | Del 4 §2 |
| Sektionsbar | Nyheder · Det sker · Mad i byen · Hype · Events | Nyheder · Det sker · Sport · Shopping · Mad i Byen · Musik & Kultur | Fælles kerne + lokale sektioner (fx "EsbjergLiv") | Del 1 §6.3 |
| Forsidemoduler | Seneste nyt · Nyeste · Korte videoer · Udvalgte · Nyhedsbrev | Samme + "Læs i kategorien" | Modulært forsidesystem på tværs af sites | Del 4 §4 |
| Footer | "Byer": links til søstersites | Samme | **Tag med:** netværket skal være synligt, men diskret | Del 8 §3.3 |
| Prisliste | Fælles domæne (minbymedia.dk) | Samme | **Tag med:** én kommerciel side for hele netværket | Del 8 §3.1 |

**Pointe for Lysdals CMS:** Del 8 kræver multi-site. Min By bekræfter, at det rækker at have ét tema med få lokale variable: navn, accentfarve, logo, sektionsliste, delområder og footer-links. Resten er fælles. DESIGN.md er derfor bygget som en skabelon med netop de variable.

---

## 3. Forside

### 3.1 Hvad de gør

- **Maksimal indholdsbredde 1.000 px** i en hvid spalte på grå baggrund (`#EEE`), med annoncer i "wallpaper" på begge sider.
- **Gridsystem med faste kortstørrelser:** 1/1, 2/3, 1/2 og 1/3. På forsiden findes syv korttyper: link-kort (kun overskrift), billedkort, "nøgent" billedkort, kort uden billede, live-kort og billedkort i to størrelser.
- **Topzone:** Et "Seneste nyt"-kort med pulserende prik, derefter en stor historie (2/3) ved siden af to stablede historier (1/3), hvor den ene er et billedkort og den anden et farvet tekstkort.
- **Kategorifarver:** Hver kategori har sin egen kortfarve (Nyheder: orange `#BF6415`, Mad i byen: rød `#B22920`, Det sker: grå `#4A4A4A`, Musik og kultur: mørkegrøn `#00453A`).
- **Moduler i rækkefølge:** Seneste nyt → Nyeste artikler → Korte videoer (grå baggrund) → artikelblokke → Udvalgte artikler → flere blokke → Nyhedsbrev. Siden er ca. 10.400 px høj på desktop.
- **Overskrifter:** 28 px/600 på store kort og 16 px/500 på små. Kategorilabels er 11 px med versaler.

### 3.2 Vurdering

| Mønster | Vurdering | Begrundelse og kobling |
|---|---|---|
| Faste kortstørrelser (1/1, 2/3, 1/2, 1/3) | **Tag med** | Gør det muligt at bygge forsiden af zoner med automatiske regler (del 4 §4.1). Færre korttyper giver mindre designgæld. |
| "Seneste nyt"-kort i toppen | **Tag med** | Passer til 4-5 historier om dagen (del 9 §1). Viser, at mediet lever. |
| Korte videoer som vandret rail | **Tilpas** | God idé, men kun hvis der produceres video løbende. Støttepakkerne leverer ca. 32 videoer om året (del 9 §0). Railen vises først, når der er mindst 4 aktuelle videoer. |
| Farvede kort pr. kategori | **Tilpas** | Del 4 §9.2 kræver, at farve bruges konsekvent. Kategorier markeres med tekst og område, ikke farveflader. Farve og rammer reserveres til **indholdstyper** (partner, annonce, indsendt), så mærkningen står stærkest. |
| Uendelig liste nederst | **Fravælg** | Gør det svært at nå footer, transparenssider og støttemodulet (del 1 §9). Brug en "Vis flere"-knap. |
| Wallpaper, topscroll og sidebannere | **Fravælg** | Del 1 §7.1 fravælger display som primær indtægt. Del 4 §9.2 kræver ingen annoncestøj. |
| 1.000 px maksimal bredde | **Tilpas** | Brug ca. 1.200 px uden sidebannere. Den ekstra plads bruges på luft og et tydeligere hierarki, ikke på flere kort. |

### 3.3 Det, konceptet skal have, som Aalborg mangler på forsiden

- **Områdezone** ("Korsør", "Skælskør" …) med automatisk regel. Del 4 §4 og del 1 §6.3 bygger på kategori × geografi. Aalborg har ingen geografisk inddeling.
- **"Fra borgerne"-zone** til spor A (del 9). 40 % af produktionen skal være synlig som et fællesskab, ikke gemmes væk.
- **"Kort nyt"-liste** til spor B, de AI-understøttede korte nyheder. En tæt, datostemplet liste uden billeder, så de ikke konkurrerer med egenproduktionen.
- **"Lokale fællesskaber"-modulet og Fyrtårnspartner-logoer** (del 1 §8.1, Fællesskab- og Fyrtårn-pakkerne) med tydelig mærkning.
- **Kvoteloft** for støttefinansieret indhold i forside-zonerne (del 1 §8.3, punkt 4). Det findes ikke hos Min By.

---

## 4. Artikelside

### 4.1 Hvad de gør

- Overskrift (H1) i Mundial **36 px med tynd vægt (300)** i grå `#4A4A4A`.
- Ingen manchet. Brødteksten starter direkte efter billedet.
- Billede i fuld spaltebredde med kort fotokredit ("Foto: …").
- Byline med forfatterfoto, "Skrevet den [dato] Kl. [tid]" og "Af [navn]".
- Brødtekst i Source Sans Pro **18 px / 27 px linjehøjde**. Mellemrubrikker som H2.
- Efter artiklen: Del artikel → Korte videoer → **Top 3 i dag** → relaterede artikler → Udvalgte artikler → uendelig liste.
- Strukturerede data: `NewsArticle`, `Person`, `Organization`, `WebSite`.
- **Annoncørbetalt artikel:** Labelen "Annonce" på kortet og en boks med "Annoncørbetalt indhold" på selve siden.

### 4.2 Vurdering

| Mønster | Vurdering | Begrundelse og kobling |
|---|---|---|
| Byline med foto, dato og klokkeslæt | **Tag med** | Skaber genkendelse af lokale journalister. Tilføj "Opdateret"-tidsstempel og link til forfatterside (del 4 §2). |
| "Top 3 i dag" | **Tag med** | Billig og effektiv. Kræver kun læsetal pr. dag. |
| Tynd, grå H1 | **Fravælg** | Svag hierarki og lav kontrast. Brug en kraftig display-skrift i næsten sort (DESIGN.md). |
| Ingen manchet | **Fravælg** | En manchet gør det lettere at skimme og giver bedre delingstekster (del 4 §7.1). |
| "Annoncørbetalt indhold"-boks | **Tilpas** | Rigtig idé, men den skal stå **øverst**, før brødteksten, og have sin egen farve og ramme (del 1 §9.3). Konceptet har fem indholdstyper, ikke to. |
| `NewsArticle`-schema | **Tag med** | Udvid med `isAccessibleForFree`, `publisher.publishingPrinciples` (link til redaktionelle principper) og `backstory`/`correction` ved rettelser. |
| Uendelig liste efter artiklen | **Fravælg** | Samme begrundelse som på forsiden. |

### 4.3 Mærkning øverst i artiklen (konceptets krav, som Aalborg ikke opfylder)

| Indholdstype | Hvad læseren ser øverst | Kilde |
|---|---|---|
| Uafhængig journalistik | Intet | Del 1 §9.3 |
| Partner-/støttefinansieret | Blå infoboks: "Historien er finansieret af [støtte] som en del af en støtteaftale. Redaktionen har haft fuld redaktionel kontrol." | Del 1 §9.3 |
| Sponsoreret indhold | Rav-farvet ramme om hele artiklen + "Annonce" + afsender | Del 1 §9.3, del 4 §9.3 |
| Borger/meddeler (spor A) | "Indsendt af [navn/organisation], redigeret af redaktionen" | Del 1 §9.3, del 9 §3 |
| AI-understøttet (spor B) | "AI-assisteret, redigeret og godkendt af [navn]" + kildeliste | Del 9 §2 |
| Pressemeddelelse | "Pressemeddelelse fra [afsender]" | Del 1 §9.3 |

---

## 5. Kalender

### 5.1 Hvad de gør

- Datovælger og hurtigfiltre: **Denne weekend · Denne uge · Denne måned · Nulstil**.
- Fritekstsøgning ("Søg efter kunstner, lokation, type …").
- Kategorichips: Anbefalet · Events · Koncerter · Musik · Kultur · Mad i byen.
- Eventkort i tre kolonner med billede, **datobadge oven på billedet** (måned i accentfarve, dag på hvid), titel, relativ tid ("I morgen · kl. 19:30"), sted, "Billet" og "Læs mere".
- Betalte events står i samme liste med en lille "Annonce"-label.
- Kommercielt: **Event Post 499 kr. pr. by** (2.295 kr. for alle byer) og **Premium Post 3.995 kr.** (topplacering). Fast displayformat i toppen af kalenderen: 4.995 kr./uge.

### 5.2 Vurdering

| Mønster | Vurdering | Kobling |
|---|---|---|
| Hurtigfiltre (weekend/uge/måned) | **Tag med** | Del 4 §6.1 |
| Datobadge på billedet | **Tag med** | Et genkendeligt element, men i eget design |
| Relativ tid ("I morgen") | **Tag med** | |
| Selvbetjent Event Post til lav pris | **Tag med** | Del 1 §7.1: event- og kalenderannoncer er 4-6 % af omsætningen. Det skal være selvbetjent via indsendelsesformularen (CMS-07), så det ikke belaster redaktionen. |
| "Annonce" som lille label | **Tilpas** | Sponsorerede events får rav-rammen fra kortsystemet (del 4 §6.2). |
| **Mangler:** områdefilter, `.ics`-download, "Indsend arrangement", gentagne events | Tilføj | Del 4 §6.1, del 1 §6.3 |

---

## 6. Spiseguide og profilguider

### 6.1 Hvad de gør

- `/spiseguide/` er en SEO-hubside med introtekst og 11 kategorier (Restauranter, Smørrebrød, Tapas, Buffet, Take away, Caféer, Burgere, Brunch, Vegetar, Vinbar, Cocktails), hver med billede.
- Hver kategori har en liste, og hvert sted har en profilside med adresse, mail, telefon, website, sociale links og Google-kort.
- **Ingen strukturerede data** på profilsiden: ingen `Restaurant`/`LocalBusiness`-schema, ingen åbningstider og ingen kobling til artikler om stedet.
- Kommercielt: **profilside 995 kr./md. pr. by** med tekst, billeder, kontakt, menu, booking og kort.

### 6.2 Vurdering

| Mønster | Vurdering | Kobling |
|---|---|---|
| Serviceguide som SEO-hub (kategori → liste → profil) | **Tag med** | Del 1 §6.1 nævner "lokale guider" og "servicestof". Guides skaffer søgetrafik, som et nyt domæne mangler (del 8 §3.3). |
| Betalt profilside pr. måned | **Tilpas** | Placeres som **medlemskab** (del 1 §7.1: 8-12 %), ikke som støtte. En profil er katalog, ikke journalistik. Den skal mærkes som "Profil", og den må aldrig påvirke, om stedet omtales redaktionelt. |
| Kun mad | **Tilpas** | Slagelse har et bredere behov: Spis & drik, Foreninger, Oplevelser, Overnatning, Børnefamilier (del 1 §4: børnefamilier i tilflytning). Guiden bygges af samme komponent med forskellige kategorier. |
| **Mangler:** schema, åbningstider, "Artikler om stedet", område-tag | Tilføj | Del 4 §3: virksomhedsside med "alle relaterede historier" |

Del 4 §2 har allerede `/virksomhed/[slug]` og `/forening/[slug]`. **Anbefaling:** Guideprofilen og virksomheds-/foreningssiden bliver **én side**. Profildelen er betalt og mærket, mens artikellisten er redaktionel og automatisk. Det sparer en sidetype og giver begge dele mere værdi.

---

## 7. Kommercielle formater: Min By over for støttepakkerne

Min By's prisliste (ekskl. moms, pr. by eller for hele netværket):

| Produkt | Pr. by (Aalborg) | Alle byer | Svarer i konceptet til |
|---|---|---|---|
| Native Premium (forside + sektion + Facebook) | – | 33.995 kr. | Sponsoreret indhold (del 1 §9.2) |
| Native Sektion | – | 25.995 kr. | Sponsoreret indhold |
| Native i nyhedsbrev | – | 11.995 kr. | Nyhedsbrevssponsorat (del 1 §7.1) |
| Display Plus (fast format i artikler) | 8.995 kr./uge | 30.995 kr./uge | **Fravælges** |
| Event Post / Premium Post | 499 / 3.995 kr. | 2.295 / 14.995 kr. | Kalenderannonce |
| Guide-annonce / Guide-sponsorat (sæsonguider) | 4.995 / 19.995 kr. | 22.995 / 94.995 kr. | Temasektion (del 1 §7.1) |
| Nyhedsbrev: annonce / take-over | 4.995 kr. / 7.995 kr./uge | 17.995 / 34.995 kr. | Nyhedsbrevssponsorat |
| Profilside i spiseguide | 995 kr./md. | 1.995 kr./md. | Medlemskab |
| Intro-pakker (bronze/sølv/guld) | 8.995-20.995 kr. | – | Naboskab (12.000 kr./år) |
| Flex-pakker (5/10/15 "kampagneklip") | 27.995-69.995 kr. | 27.995-69.995 kr. | Fællesskab (30.000) / Fyrtårn (75.000) |

**Observationer:**

1. **Prisniveauet bekræfter støttepakkerne.** Naboskab, Fællesskab og Fyrtårn ligger i samme leje som Min By's Intro- og Flex-pakker, i en kommune, der er knap tre gange større (Aalborg Kommune har ca. 220.000 indbyggere mod Slagelses 81.000; tallet skal kontrolleres mod Danmarks Statistik). Priserne i del 1 §8.1 er altså ikke for høje, men Slagelse-markedet er mindre. Det understøtter antagelsen om ca. 70 aftaler (del 7 §2.2) som ambitiøs.
2. **"Klip" over for leverancer.** Min By sælger kampagneklip, som kunden selv vælger formater for. Konceptet sælger produktionskapacitet med fuld redaktionel kontrol (del 1 §8.3). Forskellen er konceptets troværdighedsløfte og skal stå tydeligt på "Bliv støtte"-siden.
3. **Pris pr. by og for alle byer** er skabelonen for netværkspakker (del 8 §3.1). Regionale støtter (banker, ejendomskæder) kan købe "hele netværket", men kvoteloftet skal gælde pr. site (del 8 §3.4).
4. **Sæsonguider med sponsor** (efterårsferie, jul, påske) er en oplagt og ufarlig temasektion. Guiden er service, ikke journalistik om sponsoren.
5. **Linkbuilding** står på Min By's prisliste. **Fravælges.** Betalte links strider mod søgemaskinernes retningslinjer og mod del 1 §2.3.

---

## 8. Mobil

| Fund | Vurdering |
|---|---|
| Hele første skærm er en annonce. Logoet står ca. 650 px nede og første artikel ca. 1.070 px nede. | **Fravælg.** Første skærm skal vise logo, "Seneste nyt" og tophistorien (del 4 §1). |
| Sektionsbar som vandret scrollbar række under logoet | **Tag med** som supplement |
| Runde knapper til søg og menu i accentfarve. Menuen åbner som "bottom sheet". | **Tag med**, men kombineret med del 4 §9.2's **bundmenu** (Forside · Sektioner · Kalender · Søg · Profil). Aalborg har ingen bundmenu. |
| Flydende nyhedsbrevsknap (konvolut) nederst til højre | **Tilpas.** Kolliderer med en bundmenu. Nyhedsbrev lægges i stedet som fast modul efter tophistorierne og i artiklens bund. |
| 184 forespørgsler / ca. 5,5 MB overført på forsiden | **Fravælg.** Mål: under 60 forespørgsler og 1,5 MB (del 5). |

---

## 9. Gab i begge retninger

### 9.1 Min By har, konceptet mangler

| Element | Anbefaling | Placering |
|---|---|---|
| Spise-/serviceguide med profilsider | Tag ind i MVP som enkel guide (del 6) | Del 4 §2: `/guide` |
| Sæsonguider (ferie, jul) | Tag ind som temasektioner | Del 1 §7.1 |
| "Korte videoer"-rail | Fase 2, når videoproduktionen er stabil | Del 4 §4 |
| "Top 3 i dag" | Tag ind i MVP | Artikelside |
| "Seneste nyt"-kort | Tag ind i MVP | Forside |
| Lokal pris/awards (Aalborg Awards) | Fase 2-3: fx "Årets ildsjæl i Slagelse" som community- og sponsorbegivenhed | Del 4 §5 |
| Selvbetjent eventannonce | Tag ind (CMS-07 + betaling) | Del 3 |
| Engelsk version | Fravælg i MVP | – |
| Shop/vouchers (Spot Byen) | Fravælg | – |

### 9.2 Konceptet har, Min By mangler (konkurrencefordele, der skal kunne ses)

- Områdesider og område-tags (kategori × geografi)
- Forenings- og virksomhedssider med alle relaterede historier
- Fem mærkede indholdstyper i stedet for to
- Transparens: redaktionelle principper, rettelser og "Om mediet"
- Manchet, "følg emne", gem artikel og læserprofil
- Indsendelse af historier og arrangementer
- Strukturerede data for steder, events og rettelser
- En hurtig side uden annoncestøj

---

## 10. Næste skridt

1. Godkend retningen i `files/DESIGN.md` (netværksskabelon + Slagelse som første instans).
2. ~~Beslut netværksnavnet~~ Besluttet: "[By]Lokalt" (del 8 §1, se §11). Åbent: registrér domæner, søg varemærke og design logo/ordmærke.
3. Tilføj `/guide` og den samlede virksomheds-/forenings-/profilside til sitemap i del 4 §2.
4. Tilføj "medlemskab: profil i guiden" og "kalenderannonce: selvbetjent" som konkrete produkter i del 1 §7.1 / del 7 §2.
5. Byg en klikbar prototype af forside, artikel og kalender på baggrund af DESIGN.md.

---

## 11. Domænetjek: navnemønster for 17 kommuner

Tjekket 29. september 2026 for de 17 kommuner i del 8 §2. Metode: DNS-opslag (navneserver, A- og MX-record) på alle 13 mønstre, og derefter opslag i .dk-registret (whois hos Punktum dk) for de fire mest lovende mønstre. ASCII-stavemåde (æ→ae, ø→oe, å→aa).

| Mønster | Ledige | Optaget | Bekræftet i registret |
|---|---|---|---|
| **[By]Lokalt** | **17/17** | ingen | Ja |
| [By]Kompas | 17/17 | ingen | Ja |
| [By]Direkte | 17/17 | ingen | Ja |
| [By]Posten | 16/17 | Faxe | Ja |
| [By]Nyheder | 15/17 | Slagelse, Roskilde | Kun DNS |
| [By]Live | 15/17 | Roskilde, Lejre | Kun DNS |
| [By]Puls | 15/17 | Slagelse, Roskilde | Kun DNS |
| [By]Bladet | 12/17 | Slagelse, Næstved, Roskilde, Køge, Stevns | Kun DNS |
| [By]iDag | 11/17 | Slagelse, Næstved, Roskilde, Holbæk, Køge, Faxe | Kun DNS |
| Nyt[By] | 11/17 | Roskilde, Kalundborg, Odsherred, Stevns, Guldborgsund, Lolland | Kun DNS |
| Vores[By] | 7/17 | 10 kommuner, bl.a. Roskilde, Holbæk, Køge | Delvist |
| [By]Nu | 7/17 | 10 kommuner, bl.a. Slagelse og Næstved | Delvist |
| [By]Nyt | 6/17 | 11 kommuner, bl.a. Slagelse og Næstved | Ja |

**Valgt: [By]Lokalt** (del 8 §1). De 17 domæner: slagelselokalt.dk, naestvedlokalt.dk, ringstedlokalt.dk, soroelokalt.dk, roskildelokalt.dk, holbaeklokalt.dk, kalundborglokalt.dk, koegelokalt.dk, vordingborglokalt.dk, faxelokalt.dk, lejrelokalt.dk, grevelokalt.dk, odsherredlokalt.dk, solroedlokalt.dk, stevnslokalt.dk, guldborgsundlokalt.dk, lollandlokalt.dk.

**Forbehold:** En ledig status i registret er et øjebliksbillede, og andre kan registrere domænerne, inden du gør det. Andre endelser (`.nu`, `.com`) og varemærkeforhold er ikke undersøgt. Ingen domæner er registreret.

