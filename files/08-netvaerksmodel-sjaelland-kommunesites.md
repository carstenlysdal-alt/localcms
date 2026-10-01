# Del 8: Netværksmodel — kommunespecifikke sites på Sjælland
### Tillæg til del 1, 3, 6 og 7 — fra ét kommunemedie til et netværk af lokale medier

---

## 0. Hovedkonklusion

Idéen er strukturelt stærk: **ét fælles fundament (Lysdals CMS, fælles redaktionel kerne, fælles salg), men et selvstændigt, lokalt forankret medie i hver kommune**. Det er præcis den model, Min By Media har bygget i de største byer. På Sjælland er der ingen tilsvarende aktør i de mellemstore kommuner.

Men økonomien ændrer karakter. Beregningerne nedenfor viser, at et netværk **først bliver rentabelt ved 8+ sites**, at det har et **kapitalbehov på ca. 6-8,5 mio. kr.** (mod ca. 2-2,7 mio. kr. for Slagelse alene), og at det er **markant mere følsomt** over for én antagelse: at hver kommune kan generere ca. 33 kr. i årlig omsætning pr. indbygger. Den antagelse er kalibreret ud fra, hvad Slagelse *skal* levere (del 7), ikke ud fra dokumenteret evidens. Falder tallet 20 %, stiger kapitalbehovet til ca. 15-18 mio. kr., og netværket når ikke break even inden for de første 8-9 år.

**Ejerskab:** Hvert site drives som et selvstændigt selskab med lokale medejere (afsnit 6). Det sænker holdingens kapitalbehov med ca. 10-20 %, men koster ca. 40 % af det modne overskud, og det finansierer kun sites, ikke det centrale lag. (Rettelse: en tidligere version af dette dokument angav ca. 30 %; det skyldtes en inkonsistent bufferberegning mellem de to modeller.)

**Bemanding:** Tallene i afsnit 4 og 6 bygger på den oprindelige bemandingsantagelse (ca. 2 freelance-årsværk i en Slagelse-stor kommune, ca. 23 i hele netværket). Med den revurderede produktionsmodel i del 9 (4-5 historier om dagen, primært borgerjournalistik og AI-understøttede nyheder) falder kapitalbehovet til ca. 5-7 mio. kr. ved fuldt netværk.

**Anbefaling:** Udrul i bølger med faste "gates" (afsnit 5), så hver ny kommune først åbnes, når de foregående har bevist omsætningen pr. indbygger. Slagelse er dermed ikke bare første site, men netværkets forsøg på at dokumentere det tal, hele modellen hviler på.

---

## 1. Referencen: Min By Media — og hvorfor "Mig og …" ikke kan bruges

Min By Media A/S driver MigogAalborg, MigogAarhus, MigogOdense, MigogKbh og MigogEsbjerg og beskriver sig selv som de førende lokale bymedier i landets fem største byer. Tre pointer er relevante for dig:

1. **Hvid plet på Sjælland.** Min By Media satser på de største byer. Roskilde, Næstved, Holbæk, Køge og de øvrige sjællandske kommuner er ikke dækket i dette format.
2. **Lokal medejerskabsmodel.** MigogEsbjerg er et selvstændigt udgiverselskab, ejet 50/50 af Min By Media og Esbjerg Ugeavis Fond. Det er en færdig skabelon for, hvordan lokal legitimitet og lokal kapital kan kobles på et netværk (se afsnit 6).
3. **Brandkonflikt.** "Mig og [by]" er Min By Medias navnekoncept. Du kan ikke bruge det mønster, hverken juridisk eller strategisk. Det ville sende læsere og støtter direkte hen til en konkurrent, som samtidig kan vælge at gå ind i Sjælland.

**Beslutning (29. september 2026):** Navnemønstret er **"[By]Lokalt"** (fx SlagelseLokalt, NæstvedLokalt) med domæner efter mønstret `[by]lokalt.dk` (ASCII: æ→ae, ø→oe, å→aa, fx `slagelselokalt.dk`, `naestvedlokalt.dk`, `soroelokalt.dk`).

**Baggrund:** Domænetjek af 13 mønstre for de 17 kommuner (se del 10 §11). `[By]Lokalt` var ledigt i alle 17 kommuner, bekræftet i .dk-registret. De mønstre, der først blev foreslået, holdt ikke: `Vores[By]` var kun ledigt i 7 af 17, `[By]Nu` i 7 af 17 og `[By]Nyt` i 6 af 17 (`slagelsenyt.dk` og `naestvednyt.dk` er begge optaget).

**Åbent, før der investeres i design:**
- Domænerne er **ikke registreret endnu.** Slagelse og Næstved bør registreres først, og de øvrige efter bølgeplanen eller samlet, hvis prisen er lav.
- **Varemærke** for "[By]Lokalt" skal søges hos Patent- og Varemærkestyrelsen.
- Andre endelser (`.nu`, `.com`) er ikke tjekket.

Mønstret er det samme på tværs af alle kommuner, så netværket bygger ét genkendeligt brand.

---

## 2. Scope: de 17 kommuner

**Antagelse:** "Hele Sjælland" er afgrænset til de 17 kommuner i Region Sjælland (ca. 858.700 indbyggere, Danmarks Statistik, maj 2026). Region Hovedstadens del af øen (København m.fl.) er et helt andet marked med hård konkurrence og andre økonomiske forhold, og er holdt uden for modellen.
**Konsekvens:** Udvides scopet til hele øen, skal økonomien og konkurrencebilledet regnes om.

Nedenstående tal er beregnet med **32,7 kr. i modenhedsomsætning pr. indbygger** (Slagelse-behovet fra del 7: 2,65 mio. kr. ÷ 80.959) og en faktor på 0,8 for udkantskommuner med svagere erhvervsgrundlag. Indbyggertal for Slagelse (80.959), Roskilde (92.697), Næstved (85.163) og Solrød (25.040) er verificeret; de øvrige er afrundede skøn og skal kontrolleres mod Danmarks Statistik.

| Bølge | Kommune | Indbyggere (ca.) | Faktor | Modenhedsomsætning | Freelance-årsværk (min. 1,0) |
|---|---|---|---|---|---|
| 1 | Slagelse | 80.959 | 1,0 | 2,65 mio. | 2,0 |
| 2 | Næstved | 85.163 | 1,0 | 2,79 mio. | 2,1 |
| 2 | Ringsted | 35.000 | 1,0 | 1,15 mio. | 1,0 |
| 2 | Sorø | 30.000 | 1,0 | 0,98 mio. | 1,0 |
| 3 | Roskilde | 92.697 | 1,0 | 3,03 mio. | 2,3 |
| 3 | Holbæk | 75.500 | 1,0 | 2,47 mio. | 1,9 |
| 3 | Kalundborg | 48.500 | 1,0 | 1,59 mio. | 1,2 |
| 4 | Køge | 63.500 | 1,0 | 2,08 mio. | 1,6 |
| 4 | Vordingborg | 46.000 | 0,8 | 1,20 mio. | 1,1 |
| 4 | Faxe | 37.000 | 1,0 | 1,21 mio. | 1,0 |
| 4 | Lejre | 28.500 | 1,0 | 0,93 mio. | 1,0 |
| 5 | Greve | 51.000 | 1,0 | 1,67 mio. | 1,3 |
| 5 | Odsherred | 33.000 | 0,8 | 0,86 mio. | 1,0 |
| 5 | Solrød | 25.040 | 1,0 | 0,82 mio. | 1,0 |
| 5 | Stevns | 23.000 | 1,0 | 0,75 mio. | 1,0 |
| 6 | Guldborgsund | 60.000 | 0,8 | 1,57 mio. | 1,5 |
| 6 | Lolland | 40.000 | 0,8 | 1,05 mio. | 1,0 |

**Rækkefølgens logik:** Bølge 1-2 er geografisk sammenhængende omkring Slagelse (fælles freelancepulje og pendling), bølge 3 tager de store og kommercielt stærke kommuner, og de svageste udkantskommuner kommer sidst, hvor netværkets fælles infrastruktur allerede er betalt.

**Kritisk observation:** Otte af de 17 kommuner har under 40.000 indbyggere og en modenhedsomsætning under ca. 1,2 mio. kr. Et helt freelance-årsværk (ca. 480.000 kr.) æder dér 40-60 % af omsætningen, før central drift er dækket. De små kommuner bærer sig ikke selv; de er kun rentable som en del af netværket, eller hvis de dækkes med en lettere model (se afsnit 7).

---

## 3. Arkitektur: hvad er fælles, og hvad er lokalt

### 3.1 Fordelingen

| Fælles (netværkskernen) | Lokalt (pr. kommune) |
|---|---|
| Lysdals CMS, drift, AI-lag, sikkerhed | Eget domæne, navn og visuel identitet inden for netværksmønstret |
| Fælles redaktionel kerne: netværksredaktør, deskredaktører, regionale historier | Eget freelancekorps (minimum ét årsværk pr. kommune) med lokal forankring |
| Fælles salg, kontrakter og netværkspakker | Lokale støtter, foreninger og arrangører |
| Fælles redaktionelle principper, mærkning og etik | Eget geografisk delområde-system, egen kalender, egne lokale kilder (Signals) |
| Regnskab, administration, jura, HR | Lokal støtteside og lokale historier |

### 3.2 Krav til Lysdals CMS

Netværket kræver, at CMS'et kan mere end at køre én instans (se opdateringen i del 3, afsnit 2.12): flere sites under ét login og ét kodegrundlag, fælles freelancepulje med omkostningsfordeling pr. site, deling af regionale artikler mellem sites uden duplikeret indhold i søgemaskinerne (canonical-styring), og et netværksdashboard på tværs af sites. Det er *multi-site inden for én organisation*, ikke en multi-tenant-SaaS til eksterne kunder. Det er en væsentlig lettere opgave.

### 3.3 Domæner og SEO

Eget domæne pr. kommune er det rigtige valg for lokal identitet og lokalt salg ("vi støtter SlagelseLokalt"), og det gør det muligt at sælge eller partnerdrive enkelte sites senere. Prisen er, at hvert domæne skal opbygge sin egen søgemaskineautoritet fra bunden. Regionale historier deles med canonical-tag til det site, der har størst relevans.

### 3.4 Redaktionel uafhængighed i et netværk

Netværk skaber en ny risiko, som ét medie ikke har: at en regional støtte (fx en bank eller en ejendomskæde) er støtte i ti kommuner samtidig og dermed får uforholdsmæssig indflydelse. Reglerne fra del 1 og 2 skal gælde uændret og på tværs: adskillelse mellem salg og redaktion, kvoteloft for støttefinansieret indhold pr. site, og ét fælles sæt redaktionelle principper, som ingen lokal aftale kan tilsidesætte.

---

## 4. Økonomi

### 4.1 Beregningsforudsætninger

- **Omsætning:** 32,7 kr. pr. indbygger ved modenhed (udkant × 0,8). Ramp-up: Slagelse 34 % i år 1 og 100 % fra år 2 (jf. del 7). Efterfølgende sites er mere konservative: 30 % / 70 % / 100 %.
- **Freelance:** max(1,0; indbyggere ÷ 40.000) årsværk pr. site à 480.000 kr., 50 % i det første år.
- **Central drift** skalerer trinvist: netværksredaktør (600.000 kr.) fra 3 sites, salgschef (550.000 kr.) fra 4, fuldtids tech/produkt (650.000 kr.) fra 5, økonomi/HR (450.000 kr.) fra 8, ekstra deskredaktør (500.000 kr.) fra 9 og 14. Salg og provision: 7 % af omsætningen. Lokal drift (tech, community, marketing, administration): ca. 100.000 kr. pr. site.
- **Engangsudgifter:** 400.000 kr. (Slagelse-MVP, jf. del 6), 350.000 kr. til multi-site-udvidelse af CMS'et i år 2, og 100.000 kr. pr. ny kommune (design, jura, rekruttering, lancering).
- **Din løn:** uændret 75.000 kr./md. (950.000 kr./år). Ved modenhed skaber netværket et overskud ud over din løn; det er ikke indregnet som løn.
- **Kalibrering:** For Slagelse alene giver modellen ca. 2,67 mio. kr. i årlig drift ved modenhed mod 2,65 mio. kr. i del 7.

### 4.2 Tre udrulningsscenarier (basisantagelser, oprindelig bemandingsmodel)

| Scenarie | Sites | Omsætning ved modenhed | Drift ved modenhed | Årligt resultat ved modenhed | Break even (kumuleret) | Kapitalbehov (inkl. 3 md. buffer) |
|---|---|---|---|---|---|---|
| **A: Klynge** (Slagelse, Sorø, Ringsted, Næstved) | 4 | 7,6 mio. | 6,8 mio. | +0,8 mio. | Ca. år 9 | **ca. 5,8 mio.** |
| **B: Vestsjælland** (8 sites) | 8 | 13,4 mio. | 11,5 mio. | +1,9 mio. | Ca. år 7 | **ca. 7,7 mio.** |
| **C: Hele Sjælland** (17 sites) | 17 | 26,8 mio. | 20,8 mio. | +6,0 mio. | Ca. år 6 | **ca. 8,5 mio.** |

**Scenarie C i detaljer (basis, mio. kr.):**

| År | Sites | Omsætning | Drift | Engang | Resultat | Kumuleret |
|---|---|---|---|---|---|---|
| 1 | 1 | 0,90 | 2,05 | 0,40 | -1,55 | -1,55 |
| 2 | 4 | 4,12 | 5,47 | 0,65 | -2,00 | -3,55 |
| 3 | 7 | 8,22 | 9,30 | 0,30 | -1,38 | -4,93 |
| 4 | 11 | 14,16 | 13,86 | 0,40 | -0,10 | -5,03 |
| 5 | 15 | 19,69 | 17,61 | 0,40 | +1,68 | -3,34 |
| 6 | 17 | 23,75 | 19,90 | 0,20 | +3,65 | +0,31 |
| 7 | 17 | 26,02 | 20,72 | — | +5,31 | +5,61 |

### 4.3 Følsomhed: det er her, risikoen ligger

| Scenarie C under… | Største kumulerede underskud | Kapitalbehov inkl. buffer | Break even |
|---|---|---|---|
| Basisantagelser | 5,0 mio. | ca. 8,5 mio. | År 6 |
| Omsætning pr. indbygger 20 % lavere | 12,8 mio. | **ca. 17,7 mio.** | Ikke inden for 9 år |
| Langsommere ramp-up (20 / 45 / 75 / 100 %) | 12,1 mio. | **ca. 16,5 mio.** | År 9 |
| Netværksomsætning fra regionale partnere (+5 % ved 5+ sites, +10 % ved 10+) | 4,5 mio. | ca. 6,8 mio. | År 5 |

**Konklusion:** Netværket er en asymmetrisk satsning. Hvis 33 kr. pr. indbygger holder, er det en god forretning. Hvis det reelle tal er 26 kr., er det en forretning, der æder 13-18 mio. kr. før den vender. Derfor må udrulningen være gated, og Slagelse skal bruges til at måle tallet, ikke bare antage det.

### 4.4 Netværkspakker — mulig ekstra indtægt (ikke i basisscenariet)

Et netværk giver en salgsfordel, ét medie ikke har: regionale aktører (banker, ejendomsmæglerkæder, byggemarkeder, uddannelsesinstitutioner, rekrutterere) kan købe **én aftale på tværs af flere kommuner**.

**Antagelse:** En "Sjælland-partner"-pakke til fx 120.000 kr./år for op til fem kommuner, og en fuld netværkspakke til fx 250.000 kr./år. Priserne er et forhandlingsudgangspunkt og skal valideres i salgssamtaler.
**Konsekvens:** Det giver en effektiv pris pr. kommune på ca. 24.000-15.000 kr., i niveau med Fællesskabspakken (30.000 kr.), men med markant lavere salgsomkostning pr. krone. Til gengæld skal kickback-kapaciteten (artikler, video) fordeles på tværs af sites, og kvoteloftet pr. site (del 1, afsnit 8.3) må aldrig omgås via netværkspakker.

---

## 5. Udrulning med gates

Hver ny bølge åbnes kun, når de foregående har nået et fastlagt niveau. Tallene er forslag og skal sættes endeligt i første kvartal af år 1:

| Gate | Betingelse for at gå videre |
|---|---|
| **Gate 0 → Bølge 1 (Slagelse)** | Mindst 8-10 skriftlige hensigtserklæringer (del 6, fase 1) |
| **Gate 1 → Bølge 2** | Slagelse har efter 12 måneder mindst ca. 30 betalende støtter og en omsætning på mindst 30 % af modenhedsniveau (ca. 0,9 mio. kr./år i løbende rate). Omsætningen pr. indbygger måles og sammenlignes med de 32,7 kr. |
| **Gate 2 → Bølge 3** | De tre bølge 2-sites når hver mindst 60 % af deres modenhedsomsætning inden for 18 måneder, og netværkets samlede resultat er på vej mod nul. |
| **Gate 3 → Bølge 4-5** | Mindst ét site er i overskud, og den målte omsætning pr. indbygger ligger på mindst 85 % af antagelsen. |
| **Gate 4 → Bølge 6 (udkant)** | Netværket er samlet i overskud. Udkantskommunerne tages først derefter, evt. i en let model (afsnit 7). |

**Stopregel:** Hvis omsætningen pr. indbygger efter 18 måneder ligger under ca. 25 kr. i de første sites, stoppes udrulningen, og modellen genberegnes, før der åbnes flere sites.

---

## 6. Ejerskab og finansiering: lokale medejere pr. kommune

**Valgt retning:** Hvert site drives som et selvstændigt selskab med lokale medejere, hvor det er muligt — efter MigogEsbjerg-modellen (50/50 mellem Min By Media og Esbjerg Ugeavis Fond). Nedenstående er en konkret udformning og dens økonomi.

### 6.1 Struktur

- **Holdingselskab (dig):** ejer brand, navnemønster og Lysdals CMS, leverer de fælles ydelser (platform, redaktionel kerne, salg, administration) og er majoritetsejer af hvert site.
- **Ét site-selskab (ApS) pr. kommune:** ejer den lokale udgivelse, ansætter/honorerer de lokale journalister og har lokale medejere.
- **Slagelse ejes 100 % af holdingselskabet** som pilot. Lokale medejere kommer først med fra bølge 2, når Slagelse kan vise dokumenteret omsætning pr. indbygger. Det gør det langt lettere at overbevise medejere, og det undgår at forhandle ejerskab om et koncept, der endnu ikke er bevist.
- **Ejerandele (forslag):** 51 % holding / 49 % lokale medejere. Det sikrer kontrol over brand, platform og fælles principper, og lader de lokale have reel indflydelse. Esbjerg bruger 50/50; 51/49 undgår dødvande.
- **Servicegebyr:** hvert site betaler holdingselskabet 20 % af omsætningen for platform, redaktionel kerne, salg, jura og administration. Gebyret er antaget som forhandlingsudgangspunkt.

### 6.2 Økonomi: hvad medejerne ændrer

Begge kolonner er beregnet med samme model og samme bufferdefinition (3 måneders drift for de omkostninger, den pågældende part bærer).

| | 100 % eget netværk | Medejermodel (Slagelse 100 %, øvrige 51/49) |
|---|---|---|
| Holdingens kapitalbehov, A: 4 sites | ca. 5,8 mio. | ca. 5,2 mio. |
| Holdingens kapitalbehov, B: 8 sites | ca. 7,7 mio. | ca. 6,9 mio. |
| Holdingens kapitalbehov, C: 17 sites | ca. 8,5 mio. | **ca. 7,2 mio.** |
| C under 20 % lavere omsætning pr. indbygger | ca. 17,7 mio. | **ca. 14,1 mio.** |
| Største kumulerede underskud, C (før buffer) | ca. 5,0 mio. | ca. 4,8 mio. |
| Lokale medejeres samlede kapital, C | 0 | ca. 2,6 mio. |
| Holdingens årlige resultat ved modenhed, C | ca. +6,0 mio. | ca. +3,7 mio. |
| Break even for holdingen (kumuleret), C | ca. år 6 | ca. år 7 |

**Rettelse:** En tidligere version af dette afsnit angav, at medejerne sænker kapitalbehovet med ca. 30 % (5,9 mod 8,3 mio. kr.). Det var forkert: de to kolonner var beregnet med forskellige bufferdefinitioner, og den store forskel kom næsten udelukkende derfra. Med ens definitioner er besparelsen ca. 10-20 %, og det største underskud før buffer er stort set uændret.

**Hvad tallene siger:**

1. **Medejerne sænker kapitalbehovet med ca. 10-20 %** (1,3-3,6 mio. kr.). I visse nedadgående scenarier er der næsten ingen besparelse (Scenarie B ved 20 % lavere omsætning: ca. 15,5 mod 15,1 mio. kr.), fordi det tunge centrale lag betales af holdingen uanset.
2. **Prisen er ca. 40 % af det modne overskud.** Du giver ca. 2,3 mio. kr. om året op ved modenhed for at spare 1-4 mio. kr. i kapital. Medejere er en dyr finansieringskilde, hvis afkastet ses over 5+ år.
3. **Medejerne finansierer sites, ikke centrallaget.** Holdingens tunge omkostninger (din løn, netværksredaktør, salgschef, tech og økonomi, samlet ca. 4,9 mio. kr./år ved fuld skala) betales af holdingen, indtil servicegebyrerne dækker dem, hvilket først sker ved 5-8 sites.
4. **Medejerne giver noget, der ikke kan købes:** lokal legitimitet, lokale netværk til støttesalg og lokale rekrutteringskanaler, samt en reel deling af tabet på de enkelte sites, hvis omsætningen svigter. Det er de egentlige argumenter for modellen, ikke kapitalen.

### 6.3 Hvem må og må ikke være medejer

| Kan være medejer | Kan ikke være medejer |
|---|---|
| Lokale fonde, tidligere lokale ugeavis-/mediefonde | Kommunen, regionen eller andre myndigheder |
| Lokale erhvervsnetværk og private investorer uden interesse i dækningen | Politiske partier og interesseorganisationer |
| Op til tre medejere pr. site, hver med loft (fx 20 %), så ingen enkeltaktør dominerer | Konkurrerende medier |
| | Site'ets store støtter (loft: en medejer må ikke udgøre mere end fx 10 % af sitets omsætning som støtte) |

Reglen følger MigogEsbjergs egen linje om uafhængighed af faglige organisationer, politiske partier, offentlige myndigheder og interesseorganisationer, og den beskytter mediets troværdighed i praksis.

### 6.4 Aktionæroverenskomst (skabelon til alle sites)

- **Redaktionel uafhængighed:** ejere kan ikke instruere i enkeltsager. Den ansvarshavende redaktør ansættes efter høring af lokale medejere, men afskediges kun efter fælles procedure.
- **Fælles principper:** redaktionelle principper, mærkning og adskillelse af salg og redaktion (del 1 og 2) er bindende for alle sites og kan ikke ændres lokalt.
- **IP og licens:** holdingen ejer brand og Lysdals CMS og licenserer dem til site-selskabet (gebyret dækker licensen).
- **Kapitalkald:** pro rata, med udvanding ved manglende deltagelse.
- **Exit:** forkøbsret, call-option for holdingen, put-option for medejeren efter fx 5 år, med en fast værdiansættelsesformel.
- **Dødvande, konkurrenceklausul og rapportering.**

**Juridisk forbehold:** Skabelonen skal udarbejdes af en advokat med medie- og selskabsretlig erfaring, herunder krav til ansvarshavende redaktør og registrering af hvert site som selvstændigt medie. Det er ikke afklaret her.

### 6.5 Risici ved medejermodellen

- **Rekruttering af medejere tager tid** og kan forsinke bølgerne. Hvis en kommune ikke har en egnet medejer, kan siten enten udskydes (gaten) eller åbnes som 100 % eget site med højere kapitalbehov.
- **Governance-omkostning:** op til 16 selskaber med hver deres bestyrelse og aktionærkreds. Standardskabelon og fælles bestyrelsesrapportering er nødvendig.
- **Uenighed om redaktionel linje**, især i kritiske sager om lokale magthavere, som medejerne kender personligt.
- **Små kommuner** bærer sig ikke selv, og medejerne skal være indstillet på, at en lokal ApS kan være i underskud i årevis.

### 6.6 Øvrig finansiering

1. **Tranchevis kapitalrejsning til holdingen:** ca. 2-2,5 mio. kr. til Slagelse (år 1) og en opfølgende runde, først når Gate 1 er bestået.
2. **Offentlige og private medie- og innovationsmidler**, som skal undersøges konkret og ikke kan antages.

---

## 7. Kritisk vurdering

| Risiko / svaghed | Vurdering | Afværgeforanstaltning |
|---|---|---|
| **Omsætning pr. indbygger er ikke dokumenteret** | Den vigtigste enkeltantagelse. Kalibreret ud fra behov, ikke evidens. | Gated udrulning; Slagelse som målepunkt; hent Min By Medias regnskaber fra Virk som benchmark (obs.: de dækker store byer, ikke tilsvarende kommuner). |
| **Små kommuner bærer sig ikke selv** | Otte kommuner under 40.000 indbyggere. Et fuldt freelance-årsværk er for dyrt. | Lettere model: halvt freelance-årsværk, delt dækning mellem to naboer, eller "sektion" på et nabo-site frem for et selvstændigt medie. Stevns/Faxe og Sorø/Ringsted er oplagte par. |
| **Kvalitetserosion** | Skalering mod 17 sites kan glide mod en indholdsfabrik, som er det modsatte af konceptet (lokal dybde). | Minimum ét lokalt årsværk pr. site; ikke-forhandlelig kvalitetsgrænse i de redaktionelle principper; netværksredaktørens nøgletal er kvalitet, ikke volumen. |
| **Din rolle ændrer sig** | Fra journalist/chefredaktør til leder af en organisation på 20+ personer. | Tidlig ansættelse af netværksredaktør (fra 3 sites); afklar, hvad du selv vil lave. |
| **Konkurrence** | Sjællandske Medier dækker hele Sjælland i forvejen, og Min By Media kan gå ind i regionen. | Differentiering på lokal dybde og støttemodel; monitorér Min By Medias vækst; sikr brand og domæner tidligt. |
| **Regionale støtter og uafhængighed** | Én regional støtte i mange kommuner kan få for stor vægt. | Fælles principper og kvoteloft pr. site (afsnit 3.4). |
| **Brand og jura** | "Mig og …" kan ikke bruges. | Eget navnemønster; varemærke- og domænesøgning (afsnit 1). |
| **Kapitaltab ved forkert start** | Ved 20 % lavere omsætning: ca. 12 mio. kr. (med medejere) til ca. 17 mio. kr. (100 % eget). | Gates og stopregel (afsnit 5); medejere som risikodeling (afsnit 6). |
| **Uenighed med medejere** | Redaktionelle konflikter og governance på tværs af mange selskaber. | Aktionæroverenskomst med redaktionel uafhængighed, medejer-kriterier og standardskabelon (afsnit 6.3-6.4). |

---

## 8. Beslutninger og næste skridt

**Beslutninger til dig:**
1. Netværksnavn og navnemønster (efter domæne- og varemærkesøgning).
2. Ejerskabsmodel: retningen er lokale medejere pr. kommune (afsnit 6). Åbne punkter er ejerandel (51/49 foreslået), servicegebyr (20 % foreslået) og hvilke typer medejere, der accepteres.
3. Om de små kommuner skal have selvstændige sites eller en lettere model.
4. Om Lysdals CMS udelukkende er netværkets egen platform i de første år (anbefalet), eller om licensering til andre lokalmedier også skal forfølges — jf. del 3, afsnit 0.

**Næste skridt (rækkefølge):**
1. Færdiggør Slagelse-pilotens validering (del 6, fase 1) med omsætning pr. indbygger som eksplicit målepunkt.
2. Bekræft indbyggertal for de 13 kommuner, der her er afrundede skøn.
3. Hent regnskabsdata for Min By Media og MigogEsbjerg (Virk) som benchmark.
4. Søg navn, domæner og varemærke for det valgte mønster i alle 17 kommuner.
5. Byg multi-site-kravene ind i Lysdals CMS' MVP, så den arkitektoniske beslutning ikke skal tages om senere (del 3, afsnit 2.12).
