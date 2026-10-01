# Del 9: Produktionsmodel — 4-5 historier om dagen med borgerjournalistik, meddelere og AI
### Tillæg til del 2, 3, 7 og 8 — færre journalister, mere flow

---

## 0. Hovedkonklusion

Modellen er realistisk, men **den sparer mindre, end man umiddelbart tror**, og den har en juridisk og redaktionel rød linje, som skal være på plads fra dag ét.

- **Færre journalister er muligt:** En Slagelse-stor kommune kan gå fra ca. 2,0 til **ca. 1,1-1,5 redaktionelle årsværk**. For hele netværket (17 sites) falder kapaciteten fra ca. 23 til **ca. 15-20 årsværk**.
- **Gevinsten er moderat for ét site og større i netværket.** Slagelse alene forbedres med ca. 0,25-0,4 mio. kr. om året, fordi din løn, salg og central drift er faste. Ved 17 sites stiger det årlige resultat ved modenhed fra ca. 6,0 til **ca. 7,0-9,3 mio. kr.**, og kapitalbehovet falder fra ca. 8,5 til **ca. 5,3-6,9 mio. kr.** (100 % eget).
- **Der er et gulv, ca. 1,0 årsværk pr. Slagelse-stor kommune.** Det skyldes, at støttepakkernes leverancer (i Slagelse ca. 218 artikler og 32 videoer om året) skal produceres af fagfolk, og at 4-5 historier om dagen kræver ca. én times verifikation pr. site pr. dag. Går man under, må man enten sænke leverancerne til støtterne eller acceptere øget juridisk og troværdighedsmæssig risiko.
- **"AI-citater" må aldrig være genererede citater.** Se afsnit 2. Det er den vigtigste enkeltregel i modellen.

---

## 1. Volumen og indholdsmix

4-5 historier om dagen er **ca. 1.640 historier om året pr. site** (ca. 28.000 om året på tværs af 17 sites, ca. 77 om dagen).

**Antagelse:** Mixet pr. site pr. dag (4,5 i gennemsnit) er:

| Spor | Andel | Pr. dag | Pr. år | Indhold |
|---|---|---|---|---|
| **A. Borgerjournalistik og meddelere** | 40 % | 1,8 | ca. 660 | Indsendt af borgere, foreninger, arrangører via jeres eksisterende meddeler-værktøj; redigeret og verificeret |
| **B. AI-understøttede korte nyheder fra åbne kilder** | 35 % | 1,6 | ca. 580 | Kommunale dagsordener/referater, politi, sportsresultater, kalender (Signals, del 3, CMS-09); udkast af AI, verificeret af menneske |
| **C. Egenproduktion** | 25 % | 1,1 | ca. 410 | Støtteleverancer, portrætter, reportager, kritisk journalistik, video, produceret af journalister |

I en lille kommune reduceres spor C (fx til 0,7 om dagen), da støtteleverancerne er færre.

**Krav til meddeler-basen:** Spor A kræver ca. 660 accepterede indlæg om året pr. site. Hvis en aktiv meddeler i gennemsnit leverer 2-4 accepterede indlæg om året, skal der være **ca. 160-330 aktive meddelere pr. Slagelse-stor kommune** (0,2-0,4 % af indbyggerne). Det er ambitiøst og skal være et eksplicit nøgletal fra dag ét. Falder volumen, må spor B fylde mere, med lavere værdi pr. historie.

---

## 2. AI og citater: hvad der må, og hvad der aldrig må

| Kategori | Vurdering | Regel |
|---|---|---|
| **Genererede citater** (AI formulerer noget, en person "har sagt") | **Forbudt, ingen undtagelser** | Fabrikerede citater er kildefalsk, og mediet hæfter juridisk (injurier, urigtige oplysninger). Systemet skal teknisk forhindre, at et citat kan indsættes uden kildehenvisning. |
| **Ordrette citater udtrukket fra verificerbare primærkilder** (kommunale referater, pressemeddelelser, transskriberede offentlige møder eller optagelser, offentlige opslag fra den citerede) | **Tilladt** | Kildelink, side eller tidsstempel, dato og navn er obligatorisk. Et menneske godkender, at citatet er korrekt og ikke taget ud af kontekst, før publicering. |
| **Citater fra andre mediers artikler** | **Begrænset** | Ophavsretlig citatret gælder kun korte citater i overensstemmelse med god skik, og det er ikke en forretningsmodel. Det skal ikke være et systematisk AI-spor og kan skabe konflikt med Sjællandske Medier. |

**Yderligere krav:**

- **Mærkning:** AI-understøttede historier mærkes ("AI-assisteret, redigeret og godkendt af [navn]"). Den ansvarshavende redaktør hæfter for alt indhold, også borger- og AI-stof (medieansvarsloven).
- **AI-forordningen:** EU's regler har gennemsigtighedskrav for AI-genereret tekst om samfundsforhold, med en undtagelse ved menneskelig redaktionel kontrol. Det skal afklares juridisk, og jeg har ikke verificeret detaljerne her.
- **Risikoklasser** styrer, hvor meget AI må gøre:

| Klasse | Eksempler | Regel |
|---|---|---|
| **Grøn** | Kalender, sportsresultater, service, vejr | Let review før publicering |
| **Gul** | Kommunal politik, erhverv, foreningsnyt | Fuld verifikation af kilder og citater |
| **Rød** | Kriminalitet, navngivne privatpersoner, børn, sundhed, kritik af magthavere | Kun journalist eller redaktør; ingen AI-udkast uden journalistisk gennemskrivning |

---

## 3. Produktionsflow

1. **Spor A (borger/meddeler):** Indsendelse via meddeler-værktøjet, automatisk screening (spam, injurier, persondata, børn, ophavsret), redigering (ca. 15 min.), verifikation af kilde (kendte meddelere på et "trusted"-niveau går hurtigere), publicering med byline "Indsendt af …" (jf. del 1, afsnit 9).
2. **Spor B (AI fra åbne kilder):** Signal (CMS-09) → AI-udkast med kildelinkede citater → deskredaktør verificerer kilde og citat (ca. 12 min.) → publicering som "AI-assisteret".
3. **Spor C (egenproduktion):** Opgave i CMS-06, produktion af journalist (typisk 3 timer pr. historie, ca. 8 timer pr. video), redigering og godkendelse efter workflow i del 2.
4. **Rettighedserklæring:** Meddeler-værktøjet skal indhente overdragelse af brugsret til tekst og billeder og samtykke til persondata ved indsendelse.

Verifikationen af spor A og B kan placeres lokalt eller i en fælles netværksdesk. Netværksdesken er mere ensartet og udnytter AI-værktøjerne bedre, og den er regnet som timebaseret omkostning.

---

## 4. Bemanding og omkostning

**Beregningsforudsætninger:** Redigering/verifikation: 20 min. pr. borgerhistorie og 12 min. pr. AI-historie. Egenproduktion: 3 timer pr. historie. Video til støtter: 8 timer pr. stk. Timepris ca. 300 kr. (svarende til 40.000 kr./md.) plus 30 % overhead. Borgerbidrag og AI/værktøjer: ca. 45.000 kr. pr. site om året. Omsætning: uændret 32,7 kr. pr. indbygger (del 8).

Tre scenarier for egenproduktionen:

| | Tidligere antagelse | **Balanceret** | **Lean** |
|---|---|---|---|
| Egenproduktion pr. dag, Slagelse-stor kommune | (2 fulde årsværk) | 1,1 | 0,7 |
| Redaktionelle årsværk, Slagelse | 2,0 | **1,5** | **1,1** |
| Redaktionelle årsværk, alle 17 sites | ca. 23 | **ca. 20** | **ca. 15** |

**Gulvet:** Selv hvis al anden egenproduktion udelades, kræver Slagelse ca. 336 timer om året til verifikation af spor A og B og ca. 910 timer til støtteleverancer (218 artikler à 3 timer og 32 videoer à 8 timer). Det er ca. 1,0 årsværk inklusive overhead. Vil du længere ned, skal antallet af leverancer i støttepakkerne sænkes, eller AI skal producere flere af dem (med journalistgodkendelse).

---

## 5. Økonomi

Alle tal er beregnet med samme model som del 8 (ens bufferdefinition, 3 måneders drift), i mio. kr.

### 5.1 Slagelse alene (erstatter de bemandingsrelaterede tal i del 7)

| | Tidligere (2,0 årsværk) | Balanceret (1,5) | Lean (1,1) |
|---|---|---|---|
| Redaktionel omkostning ved modenhed | 0,97 | 0,70 | 0,53 |
| Årlig drift ved modenhed | 2,71 | 2,46 | 2,28 |
| Årligt resultat ved modenhed | ca. -0,06 | **+0,19** | **+0,37** |
| Kapitalbehov (inkl. buffer) | ca. 2,7 | ca. 2,1 | ca. 2,0 |
| Break even (kumuleret) | Ikke inden for 9 år | Ikke inden for 9 år | År 5 |
| Kapitalbehov ved 20 % lavere omsætning pr. indbygger | ca. 6,8 | ca. 4,7 | ca. 3,1 |

Bemærk: Modellen viser ca. 2,7 mio. kr. i drift for den tidligere antagelse, mod 2,65 mio. kr. i del 7. Forskellen skyldes en mere detaljeret omkostningsopdeling.

### 5.2 Hele netværket (17 sites)

| | Tidligere | Balanceret | Lean |
|---|---|---|---|
| Drift ved modenhed | 20,8 | 19,9 | 17,5 |
| Årligt resultat ved modenhed, 100 % eget | +6,0 | +7,0 | +9,3 |
| Kapitalbehov, 100 % eget | 8,5 | 6,9 | 5,3 |
| Årligt resultat ved modenhed, medejermodel | +3,7 | +4,3 | +5,6 |
| Kapitalbehov, medejermodel | 7,2 | 6,4 | 4,6 |
| Kapitalbehov ved 20 % lavere omsætning (eget / medejer) | 17,7 / 14,1 | 14,9 / 12,3 | 9,4 / 8,8 |
| Break even (eget) | År 6 | År 6 | År 5 |

**Hvad det viser:**

1. **Omsætning pr. indbygger er stadig den afgørende antagelse.** Selv i lean-scenariet stiger kapitalbehovet til ca. 9 mio. kr. ved 20 % lavere omsætning.
2. **Færre journalister sænker risikoen mere i downside-scenariet end i basis:** Kapitalbehovet ved 20 % lavere omsætning halveres næsten fra 17,7 til 9,4 mio. kr. (lean, eget).
3. **Omsætningsforudsætningen kan blive svagere med lavere redaktionel kvalitet.** Støtternes betalingsvilje afhænger af mediets troværdighed og læsertal. Derfor bør modellen testes i Slagelse, før den udrulles.

---

## 6. Risici og kritisk vurdering

| Risiko | Vurdering | Afværgeforanstaltning |
|---|---|---|
| **Opfundne eller fejlagtige citater** | Den alvorligste risiko for troværdighed og jura | Teknisk forbud mod citater uden kildehenvisning (afsnit 2); menneskelig godkendelse; rød klasse uden AI |
| **Injurier og persondata i borgerindlæg** | Ansvarshavende redaktør hæfter | Screening i meddeler-værktøjet, redigering før publicering, klare vilkår |
| **Ophavsret til borgeres tekst og billeder** | Uafklaret uden rettighedserklæring | Overdragelse af brugsret ved indsendelse (afsnit 3) |
| **Volumenpres presser kvaliteten** | 4-5 om dagen kan drive mod fyld frem for værdi | Kvalitetsnøgletal (læsetid, deling, rettelser) vægter højere end antal; fast kvalitetsgrænse |
| **Meddeler-basen er for lille** | 160-330 aktive pr. site er ambitiøst | Rekruttering før lancering (del 6, fase 8); nøgletal; fallback på spor B |
| **Søgemaskiner og masseproduceret indhold** | Google har spam-regler mod indhold produceret i stor skala uden værdi; jeg har ikke verificeret den aktuelle formulering | Lokal merværdi, unikke kilder, ingen ren gengivelse; løbende overvågning |
| **Støtteleverancer kan ikke løftes** | Under ca. 1,0 årsværk pr. Slagelse-stor kommune | Gulvet i afsnit 4; sænk leverancer eller brug AI-udkast med journalistgodkendelse |
| **Kritisk journalistik marginaliseres** | Modellen fylder feedet med let stof | Fast kvote af egenproduktion til kritiske historier pr. site |
| **Afhængighed af meddeler-værktøjet** | Ejerskab, drift og skalering er ikke kendt | Afklar (åbent spørgsmål nedenfor) |

---

## 7. Konsekvenser for de øvrige dokumenter

- **Del 2 (honorarmodel):** Nye poster: redigering/verifikation af borger- og AI-stof (timebaseret, ca. 250-350 kr./time) og symbolsk anerkendelse til borgerbidrag (0-100 kr.).
- **Del 3 (CMS):** CMS-07 skal integreres med det eksisterende meddeler-værktøj, og reglerne for AI-citater (afsnit 2) er tilføjet til AI-governance.
- **Del 7 og 8:** Bemandingsantagelsen er revideret her; tallene i afsnit 5 erstatter de bemandingsrelaterede tal i de to dokumenter.

---

## 8. Åbent spørgsmål

Hvad kan dit meddeler-værktøj i dag: modtager det tekst, foto og video, screener det indhold, indhenter det samtykke og rettigheder, og skal det integreres i Lysdals CMS eller erstatte CMS-07?
