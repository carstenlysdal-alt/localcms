# Del 1: Koncept og forretningsmodel
### Ny lokal medieplatform for Slagelse Kommune

---

## Læsevejledning til de seks dokumenter

Leverancen er delt i ni selvstændige dokumenter, så koncept, forretning, organisation, teknik og implementering kan læses og bruges hver for sig:

| Del | Indhold |
|---|---|
| **1. Koncept og forretningsmodel** (dette dokument) | Mediekoncept, positionering, målgrupper, støttepakker, kickback-model, redaktionel uafhængighed |
| **2. Organisation og redaktionelt workflow** | Redaktionsorganisation, freelance- og honorarmodel, workflow-faser, roller og rettigheder |
| **3. Lysdals CMS — CMS- og AI-kravspecifikation** | Generisk kravspec til udvikleren: CMS-funktioner, AI-lag, artikel-editor, datamodeller, kildehåndtering, konfigurerbar til ethvert lokalmedie — Slagelse er én instans, ikke en indbygget begrænsning |
| **4. Frontend, UX og community** | Sitemap, sidetyper, community-funktioner, kalender, distribution, supporterdashboard, visuel identitet |
| **5. Teknisk arkitektur og sikkerhed** | Systemarkitektur, tre teknologistakke, SEO/performance, integrationer, GDPR og governance |
| **6. MVP, implementering, risici og backlog** | MVP-afgrænsning, faseplan, budget, risikovurdering, kritisk gennemgang, produkt-backlog, næste 10 handlinger |
| **7. Finansieringsmodel — egen løn og 2 årsværk** | Tillæg: hvad det koster at drive egen løn på 75.000 kr/md og 2 årsværk freelancejournalistik, kapitalbehov, og en kritisk vurdering af, hvad der er nødvendigt vs. realistisk i Slagelse Kommune alene |
| **8. Netværksmodel — kommunespecifikke sites på Sjælland** | Tillæg: udvidelse fra Slagelse til de 17 kommuner i Region Sjælland som netværk af egne lokale medier, med økonomi, kapitalbehov, udrulning i bølger med gates og kritisk vurdering |
| **9. Produktionsmodel — borgerjournalistik og AI** | Tillæg: 4-5 historier om dagen pr. site, primært fra borgerjournalistik, meddelere og AI-understøttede nyheder, regler for AI-citater og revideret bemanding og økonomi |

Hvor centrale forudsætninger mangler i det oprindelige koncept, er det markeret eksplicit som **Antagelse** med en tilhørende **Konsekvens**, så beslutningstageren kan se, hvor grundlaget er skønnet snarere end givet.

---

## 1. Executive summary

Slagelse Kommune har 80.959 indbyggere primo 2026 og ventes at runde 81.000 i løbet af året, med en svagt stigende befolkning drevet af tilflytning af børnefamilier. Den nuværende lokale nyhedsdækning er i praksis domineret af én aktør: **Sjællandske Medier A/S**, der via sn.dk, Ugeavisen Slagelse–Korsør–Skælskør, Radio SLR og VDonline.dk dækker hele Vestsjælland fra en fælles, regional redaktionsmodel med afdelinger i 24-28 byer. Sjællandske Medier er fondsejet og aktuelt i forhandlinger om salg af ejerandele til et andet mediehus – et signal om en branche under konsolideringspres, hvor lokal, redaktionel dybde i den enkelte kommune let bliver et sekundært hensyn i en regional bundlinje. Dertil kommer TV2 Øst på regionalt tv og en håndfuld mindre, ofte enkeltmandsdrevne netmedier (bl.a. Slagelse Netavis og Slagelse.info), som viser, at der er et udækket behov for lokal dybde, men som mangler skala, forretningsmodel og teknisk fundament til at blive et reelt alternativ.

Det giver en klar åbning for et nyt medie, der ikke konkurrerer på klik og regional rækkevidde, men på **relationel dybde i én kommune**: et medie der kender foreningslivet, erhvervslivet og ildsjælene i Slagelse, Korsør og Skælskør bedre end en regional koncern nogensinde vil prioritere at gøre, og som finansierer sig via lokale relationer frem for alene programmatisk annoncesalg – en indtægtskilde, der under alle omstændigheder er svag i et marked af denne størrelse.

Konceptet, som det er beskrevet i det oprindelige opdrag, er grundlæggende sundt: en støttemodel med gennemsigtigt defineret kickback, en klar adskillelse mellem journalistik og kommercielt indhold, og et fleksibelt freelancekorps frem for en tung fast redaktion. De største uafklarede risici er (1) at kickback-modellen i praksis glider over i betalt omtale, hvis den ikke er strukturelt adskilt fra redaktionen, (2) at ambitionsniveauet for CMS og AI er sat væsentligt højere end det, en lokal opstart realistisk kan finansiere i år ét, og (3) at forretningsmodellen læner sig for tungt på støttekroner fra et forholdsvis lille lokalt erhvervsliv, uden en robust plan B, hvis konverteringen bliver lavere end forventet. Alle tre adresseres konkret i det følgende og i del 6.

**Anbefalingen** er at lancere med en skarpt afgrænset MVP finansieret af 25-30 grundlæggerstøtter, et minimalt men solidt CMS baseret på et headless open source-fundament (del 5), og en redaktion bestående af en fast ansvarshavende redaktør plus et honorarbaseret freelancekorps svarende til 2 årsværk, fordelt på et bredere korps af 4-6 deltidstilknyttede journalister for at sikre geografisk dækning og reducere sårbarhed over for enkeltpersoners fravær. Det kræver et kapitalbehov på ca. 2-2,5 mio. kr. og giver en realistisk vej til break even i løbet af år 2, forudsat at støttesalget når op på ca. 70 aftaler — se det fulde regnestykke i del 7.

---

## 2. Skærpet beskrivelse af mediekonceptet

### 2.1 Kernen i konceptet

Mediet er en **digital, lokal netavis for hele Slagelse Kommune**, der adskiller sig fra det etablerede medielandskab på tre punkter:

1. **Relation frem for rækkevidde.** Mediets forretningsmodel er bygget op omkring vedvarende relationer til lokale aktører – virksomheder, foreninger, institutioner – frem for på transaktionelt annoncesalg og programmatiske visninger.
2. **Kommunalt fokus, ikke regionalt.** Hvor Sjællandske Medier dækker hele Vestsjælland fra én fælles redaktion, er dette medie udelukkende forpligtet på Slagelse Kommune – Slagelse by, Korsør, Skælskør, Dalmose, Boeslunde, Vemmelev, øerne Agersø og Omø samt de øvrige lokalsamfund.
3. **Konstruktiv, men ikke konfliktsky journalistik.** Mediet prioriterer den gode lokale historie og det konstruktive perspektiv, men skal bevare evnen og viljen til kritisk og undersøgende journalistik – herunder om de samme aktører, der støtter mediet økonomisk. Denne spænding er konceptets vigtigste governance-udfordring og behandles i afsnit 9.

### 2.2 Navneretning

**Antagelse:** Der er ikke angivet et medienavn i opdraget.
**Konsekvens:** Navnevalget påvirker domæne, SEO-strategi og visuel identitet (del 4), og bør besluttes tidligt i konceptfasen, da det optræder i teknisk opsætning fra dag ét.

Forslag til navneretninger, der signalerer lokalt ejerskab uden at kopiere de etablerede titlers "avis"-sprog:

- **Geografisk-neutrale platformnavne:** "Slagelse81000" (reference til indbyggertallet), "HerBorHer.dk", "VoresSlagelse.dk"
- **Institutionelle/troværdige navne:** "Slagelse Kompas", "Vestsjælland Nu"
- **Community-orienterede navne:** "Naboskabet Slagelse", "Byens Puls"

Uanset retning bør navnet undgå ordet "avis" (signalerer print-arv) og "netavis" (allerede optaget af en eksisterende, lille aktør i markedet), for at undgå forveksling og for at signalere et nyt, digitalt-født produkt.

### 2.3 Hvad mediet ikke er

Scope-afgrænsning:

- Det er **ikke** en presseudgiver af pressemeddelelser uden redaktionel bearbejdning – alt indsendt materiale vurderes og kan afvises, redigeres eller omskrives (se del 2, workflow).
- Det er **ikke** en betalt annonceplatform, hvor støttebeløb kan konverteres direkte til positiv redaktionel omtale. Denne grænse er absolut og skal være teknisk og organisatorisk håndhævet, ikke kun politisk erklæret.
- Det er **ikke** i udgangspunktet en trykt avis. MVP'en er digital-først; print kan overvejes som et senere, sekundært format til særlige lejligheder (fx et årligt magasin til støtter), men er ikke en del af kernefundamentet.
- Det er **ikke** landsdækkende eller regionalt – al prioritering, SEO og distribution er optimeret til Slagelse Kommune specifikt.

---

## 3. Positionering og værdiløfte

### 3.1 Konkurrencelandskab

| Aktør | Type | Styrke | Svaghed set fra dette koncepts vinkel |
|---|---|---|---|
| **sn.dk / Sjællandske Medier** | Regional nyhedsportal, dagblad, fondsejet koncern | Skala, SEO-autoritet, presseadgang, salgsorganisation | Redaktionel opmærksomhed spredt over 24+ byer; lokalt community-arbejde og relationsdrevet støttemodel er ikke kerneforretning; koncernen er aktuelt i forhandling om salg af ejerandele, hvilket skaber usikkerhed om lokal prioritering |
| **Ugeavisen Slagelse–Korsør–Skælskør** | Gratis distriktsblad (print), del af Sjællandske Medier | Høj husstandsdækning, lokalt kendt | Print-først, svag digital brugerrejse, samme ejerkreds som sn.dk |
| **VDonline.dk** | Lokalt netmedie for Slagelse/Korsør/Skælskør, del af Sjællandske Medier | Kommunalt fokus | Samme koncern og forretningslogik som sn.dk – ikke et reelt alternativ, men en del af samme udbud |
| **Radio SLR** | Lokalradio, del af Sjællandske Medier | Lyd/audio-tilstedeværelse | Samme ejerkreds; ikke et selvstændigt alternativ |
| **TV2 Øst** | Regional public service-tv | Troværdighed, video-produktion | Regionalt fokus (hele Østsjælland), lav frekvens af rent Slagelse-specifikt stof |
| **Mindre uafhængige netmedier** (fx enkeltmandsdrevne sites) | Digital, lokal | Autentisk lokalkendskab | Mangler skala, forretningsmodel, teknisk fundament og redaktionel kapacitet til at dække hele kommunen konsekvent |
| **Facebook-grupper og lokale fora** | Uformel deling | Høj brugeraktivitet, lav barriere | Ingen redaktionel kvalitetssikring, ingen kildekritik, algoritmestyret rækkevidde uden for mediets kontrol |

**Antagelse:** Ovenstående er baseret på offentligt tilgængelig information om de kendte aktører i markedet pr. medio 2026. Der kan findes yderligere små, lokale initiativer, som ikke er identificeret her.
**Konsekvens:** En egentlig konkurrentanalyse med trafiktal (fx via Similarweb) bør gennemføres, før den endelige forretningsplan låses – se prioriteret handlingsliste i del 6.

### 3.2 Værdiløfte pr. interessent

- **For borgeren:** "Et medie, der faktisk kender din opgang, din forening og din lokale fodboldklub – og som fortæller de historier, en regional koncern ikke har tid til."
- **For den lokale virksomhed:** "Adgang til professionel historiefortælling og synlighed i lokalsamfundet – uden at skulle vælge mellem at være annoncør og blive taget seriøst som lokal aktør."
- **For foreningen/institutionen:** "Hjælp til at nå ud med jeres historie, uden at skulle have en kommunikationsafdeling."
- **For den kritiske læser og for kommunens embedsværk/politikere:** "Et medie, der også tør stille de svære spørgsmål – uafhængigt af, hvem der støtter det."

Det sidste punkt er afgørende for mediets langsigtede troværdighed og skal være synligt i praksis, ikke kun i markedsføringstekst – jf. afsnit 9.

---

## 4. Målgrupper og interessenter

| Interessentgruppe | Primært behov | Rolle i forretningsmodellen |
|---|---|---|
| Borgere (bred, hele kommunen) | Lokal information, tilhørsforhold, service | Læsere, evt. betalende medlemmer, kildepersoner |
| Børnefamilier i tilflytning | Praktisk information om skole, fritid, foreningsliv | Vækstsegment i tråd med kommunens demografiske prognose |
| Lokale virksomheder (SMV) | Synlighed, employer branding, lokal goodwill | Støtter, jobannoncører |
| Ejendomsaktører og udviklere | Formidling af byudviklingsprojekter | Støtter (større pakker), nyhedskilder til erhvervsstof |
| Bankfilialer og finansielle aktører | Lokal synlighed, CSR-fortælling | Støtter, sponsorer af events/temasektioner |
| Foreninger (sport, kultur, frivillighed) | Medlemsrekruttering, synlighed om events | Gratis historieindsendelse, evt. foreningsmedlemskab |
| Kulturinstitutioner og arrangører | Publikumsopbygning til events | Kalenderintegration, sponsorerede eventopslag |
| Kommunen og lokalpolitikere | Formidling af beslutninger, borgerinddragelse | Nyhedskilde, genstand for kritisk journalistik (aldrig støtte) |
| Freelancejournalister, fotografer, lokale talenter | Honorarindtægt, portefølje | Indholdsproducenter |
| Fonde (lokale og nationale mediefonde) | Understøttelse af lokaljournalistik | Projektfinansiering, ikke driftsfinansiering |

**Vigtigt principielt skel:** Kommunen som myndighed og lokalpolitikere kan aldrig være "støtter" i kickback-forstand – det ville underminere mediets uafhængighed fundamentalt og skal være en skreven, ufravigelig regel i de redaktionelle principper (se afsnit 9).

---

## 5. Redaktionel profil

### 5.1 Redaktionelle værdier

1. **Lokal relevans før nyhedsværdi i klassisk forstand.** En historie om en lille boldklub, der får nyt klubhus, kan fylde mere end en landspolitisk sag, hvis den betyder mere for læserne.
2. **Konstruktiv vinkling som standard, ikke som fritagelse for kritik.** Historier skal så vidt muligt pege fremad og vise handlemuligheder – men aldrig på bekostning af at afdække problemer, magtmisbrug eller svigt.
3. **Gennemsigtighed om alt indholds status.** Enhver artikel skal ved første øjekast kunne identificeres som uafhængig journalistik, partnerindhold, sponsoreret indhold, brugerindsendt materiale eller pressemeddelelse (se mærkningssystem, afsnit 9.3).
4. **Kildepluralisme.** Særligt i erhvervs- og foreningsstof skal redaktionen aktivt undgå, at de samme (evt. støttende) aktører dominerer historieudvalget – håndteres via redaktionel kvoteovervågning, se del 2.

### 5.2 Redaktionelle principper for støtte-relaterede historier

For at undgå, at støttemodellen glider over i skjult reklame, gælder følgende ufravigelige principper:

- En støttes bidrag finansierer **produktionskapacitet** (adgang til at få historier lavet), ikke en garanteret vinkel eller et garanteret positivt udfald.
- Alle artikler, der udspringer af en støtteaftale, gennemgår samme redaktionelle kvalitetssikring som uafhængige historier: faktatjek, kildekritik og redaktørgodkendelse.
- Redaktionen kan afvise eller omarbejde en historieidé fra en støtte, hvis den ikke lever op til journalistiske kvalitetskrav – uden at det påvirker støtteaftalens gyldighed.
- Kritisk eller undersøgende journalistik om en støtte skal kunne publiceres uden konsultation af salgs- eller partnerskabsfunktionen, og uden at det udløser sanktioner mod aftalen fra redaktionens side.
- Support-relateret indhold mærkes tydeligt (se afsnit 9.3) – uanset om det er en artikel, et interview eller et socialt medieopslag.

---

## 6. Indholdstyper og kategorier

### 6.1 Journalistiske formater

Lokale nyheder · konstruktiv journalistik · kritisk/undersøgende journalistik · erhvervshistorier · foreningshistorier · sportsstof · kulturstof · begivenhedsdækning · personportrætter · interviews · debat/holdning · lokale guider · servicestof · billedserier · lydreportager/podcasts · video.

### 6.2 Kommercielle og bruger-drevne formater

Partner- og støtteindhold (mærket) · sponsoreret indhold (mærket) · brugerindsendte historier (redaktionelt kvalitetssikrede) · pressemeddelelser (kun efter redaktionel bearbejdning eller tydelig mærkning som "PR").

### 6.3 Kategoristruktur (forslag til taksonomi)

**Primære kategorier (topniveau i navigation):** Nyheder · Erhverv · Sport · Kultur · Foreningsliv · Debat · Guide/Service · Kalender.

**Geografiske tags (delområder):** Slagelse By · Korsør · Skælskør · Dalmose/Sorø-grænsen · Vemmelev · Boeslunde · Øerne (Agersø/Omø) · "Hele kommunen."

**Emnetags (fritekst, redaktionelt styret taksonomi):** genbruges på tværs af kategorier for at understøtte "følg emne"-funktionalitet (se del 4).

Denne to-dimensionelle struktur (kategori × geografi) er central for både navigation, SEO og den automatiske forsidelogik beskrevet i del 4.

---

## 7. Støtte- og forretningsmodel

### 7.1 Principper for indtægtsmikset

Traditionel displayannoncering fravælges som primær indtægtskilde af to grunde: (1) i et marked af denne størrelse er programmatisk annonceindtægt pr. besøgende lav og ustabil, og (2) den skaber ikke den relationelle binding, som er konceptets kerne. I stedet bygges en portefølje af indtægtskilder, hvor støtteaftaler er rygraden:

| Indtægtskilde | Karakter | Forventet andel af omsætning ved modenhed (år 3) |
|---|---|---|
| Årlige og månedlige støtteaftaler (kernepakker) | Tilbagevendende | 55-65 % |
| Virksomheds- og foreningsmedlemskaber (lettere niveau end støttepakker) | Tilbagevendende | 8-12 % |
| Jobannoncer | Transaktionel | 5-8 % |
| Eventannoncer og kalenderfremhævelser | Transaktionel | 4-6 % |
| Nyhedsbrevs-, podcast- og videosponsorater | Tilbagevendende/projektbaseret | 5-8 % |
| Native advertising og temasektioner | Projektbaseret | 4-6 % |
| Projektfinansieret journalistik og fondsstøtte | Projektbaseret, ikke-driftssikker | 3-6 % |
| Frivillige læserbidrag/betalte medlemsfordele | Tilbagevendende, lav volumen i lokalmedier af denne størrelse | 1-3 % |
| Ejendoms- og displayannoncer (residual) | Transaktionel | 2-4 % |

**Antagelse:** Fordelingen er et modelleret skøn baseret på sammenlignelige danske lokalmediecases og kan ikke verificeres uden faktiske salgsdata.
**Konsekvens:** De første 12 måneders reelle konverteringsrater bør bruges til at rekalibrere modellen kvartalsvist – indbygges som fast punkt i implementeringsplanen (del 6).

### 7.2 Hvorfor "støtte" frem for "annoncør" er den rigtige ramme – med et forbehold

Sprogbrugen "støtte" understøtter den ønskede relation, men skaber samtidig en juridisk og etisk forpligtelse: al støttefinansieret indhold, der ligner journalistik, skal mærkes efter samme regler som betalt indhold i øvrigt (jf. Forbrugerombudsmandens vejledning om skjult reklame og markedsføringslovens § 4 om identifikation af kommerciel kommunikation). "Støtte" er en kommerciel betegnelse i markedsføringsretlig forstand, uanset det venligere sprogbrug – og skal behandles som sådan i mærkningssystemet.

---

## 8. Konkrete støttepakker og kickback-model

### 8.1 De tre kernepakker

**Antagelse:** Der er ikke oplyst konkrete prisniveauer i opdraget. Nedenstående priser er skønnet ud fra sammenlignelige danske lokalmedie- og content-marketing-cases i kommuner af tilsvarende størrelse (80.000 indbyggere), og skal betragtes som et forhandlingsudgangspunkt, ikke en facitliste.
**Konsekvens:** Priserne bør valideres mod 5-10 indledende salgssamtaler med lokale nøglevirksomheder, før de kommunikeres offentligt (se handlingsliste, del 6).

#### Pakke 1 — "Naboskab" (indgangsniveau)

| Parameter | Værdi |
|---|---|
| Pris | 12.000 kr./år (ex. moms) — evt. 1.100 kr./md. ved månedlig betaling |
| Målgruppe | Mindre lokale virksomheder, foreninger, enkeltmandsvirksomheder |
| Andel til journalistisk produktion | ca. 65 % |
| Kickback-værdi til støtten | 2 producerede artikler/portrætter årligt + 4 sociale medieopslag |
| Video/lyd | Ikke inkluderet (kan tilkøbes) |
| Fremhævelse på platformen | Logo i "Støtter os"-sektion på footer og relevant kategoriside |
| Nyhedsbrev | Nævnt i kvartalsvis "Lokalt erhverv"-sektion |
| Social distribution | Delt via mediets kanaler ved publicering |
| Rådgivning | Ingen dedikeret kontaktperson |
| Brugsret til materiale | Må dele artiklen/linket og de tilhørende sociale opslag i egne kanaler |

#### Pakke 2 — "Fællesskab" (kernepakke)

| Parameter | Værdi |
|---|---|
| Pris | 30.000 kr./år (ex. moms) — evt. 2.750 kr./md. |
| Målgruppe | Mellemstore virksomheder, banker, ejendomsaktører, større foreninger |
| Andel til journalistisk produktion | ca. 60 % |
| Kickback-værdi til støtten | 4 artikler/interviews + 1 kort videoproduktion (1-2 min.) + 8 sociale opslag |
| Video/lyd | 1 videoproduktion årligt inkluderet |
| Fremhævelse på platformen | Fast placering i "Lokale fællesskaber"-modul på forsiden (roterende) |
| Nyhedsbrev | Fast nævnt 1 gang/kvartal + mulighed for eget indslag |
| Social distribution | Prioriteret distribution, inkl. Instagram/LinkedIn-tilpassede formater |
| Rådgivning | Kvartalsvist statusmøde med partnerskabsansvarlig |
| Brugsret til materiale | Fuld brugsret til alt produceret materiale i egne kanaler, med kreditering |

#### Pakke 3 — "Fyrtårn" (topniveau)

| Parameter | Værdi |
|---|---|
| Pris | 75.000 kr./år (ex. moms) — evt. 6.500 kr./md. |
| Målgruppe | Større virksomheder, ejendomsudviklere, banker med flere filialer, kommunale selskaber |
| Andel til journalistisk produktion | ca. 55 % |
| Kickback-værdi til støtten | 8 artikler/interviews/reportager + 2 videoproduktioner + podcast-medvirken 1 gang + løbende social distribution |
| Video/lyd | 2 videoproduktioner + adgang til podcast-format |
| Fremhævelse på platformen | Fast logo på forsiden ("Fyrtårnspartner") + dedikeret partnerside |
| Nyhedsbrev | Fast tilstedeværelse hver måned |
| Social distribution | Fuld pakke inkl. betalt boost af udvalgte opslag (finansieret af aftalen) |
| Rådgivning | Fast kontaktperson, månedligt statusmøde, indflydelse på temasektioner |
| Brugsret til materiale | Fuld brugsret + prioriteret adgang til at foreslå historier |

### 8.2 Fælles, ufravigelige forbehold for alle pakker

- Ingen pakke giver ret til at godkende, redigere eller forhåndsgennemse redaktionelt indhold om andre end støtten selv.
- Ingen pakke giver ret til at forhindre eller påvirke kritisk journalistik om støtten.
- Alt støttefinansieret indhold mærkes iht. mærkningssystemet i afsnit 9.3.
- Leverancekapacitet er kvartalsvis, ikke garanteret til bestemte datoer – redaktionel prioritering (fx breaking news) kan forskyde leverancer med op til 4 uger.
- Opsigelse: 3 måneders varsel til udgangen af en betalingsperiode; allerede leverede ydelser refunderes ikke.

### 8.3 Kickback-modellens designprincipper

For at kickback-modellen forbliver bæredygtig og ikke udvikler sig til skjult betaling for positiv omtale:

1. **Fast produktionsværdi, ikke fast redaktionel plads.** Støtten køber adgang til produktionskapacitet (X artikler, Y video), ikke en garanteret forsideplacering eller et bestemt narrativ.
2. **Prissætning baseret på reel produktionsomkostning + margin**, ikke på oplevet "reklameværdi" — det holder modellen økonomisk gennemsigtig og forsvarlig, hvis den skulle blive udfordret markedsføringsretligt.
3. **Organisatorisk adskillelse:** Partnerskabsansvarlig (salg) og ansvarshavende redaktør er to forskellige roller med hver sin reference til direktionen/bestyrelsen; redaktøren kan aldrig beordres af salgsfunktionen.
4. **Kvoteloft:** Maksimalt en fastsat andel (fx 25-30 %) af forsidens redaktionelle plads i en given uge må optages af støttefinansieret indhold — håndhæves teknisk via forsidesystemet (del 4).
5. **Ekstern revision:** Mediets redaktionelle principper og mærkningspraksis bør årligt gennemgås af en ekstern part (fx et presseetisk råd, en journalistuddannelse eller en brancheforening), og resultatet offentliggøres.

---

## 9. Redaktionel uafhængighed og mærkning

### 9.1 Den grundlæggende regel

Ingen økonomisk transaktion – uanset størrelse – kan købe et bestemt redaktionelt udfald, en bestemt vinkel eller fravær af kritik. Denne regel skal stå skrevet i mediets vedtægter/redaktionelle principper, være synlig på "Om mediet"-siden, og være en del af hver eneste partnerskabskontrakt.

### 9.2 Adskillelse af indholdstyper (governance-model)

| Indholdstype | Beslutter vinkel/indhold | Betaler | Redaktionel kontrol |
|---|---|---|---|
| Uafhængig journalistik | Redaktionen alene | Mediet (drift) | Fuld |
| Partner-/støttefinansieret journalistik | Redaktionen alene (støtten foreslår emne) | Støtten (finansierer produktion) | Fuld — støtten kan afvises eller omredigeres |
| Sponsoreret indhold ("native advertising") | Støtten/annoncøren, i samarbejde med redaktionen om format | Annoncøren | Redaktionen godkender ikke faktuelt indhold, men sikrer mærkning og fravær af vildledning |
| Brugerindsendt indhold | Redaktionen kvalitetssikrer og kan afvise | Gratis | Fuld redaktionel gatekeeping før publicering |
| Pressemeddelelser | Redaktionen vælger at bringe/ikke bringe, evt. omskrive | Gratis (afsenderfinansieret) | Mærkes som PR, medmindre omskrevet til selvstændig journalistik |

### 9.3 Visuelt mærkningssystem

- **Uafhængig journalistik:** ingen mærkning (standard).
- **Partner-/støttefinansieret journalistik:** synligt badge "Historien er finansieret af [Støttens navn] som en del af en støtteaftale. Redaktionen har haft fuld redaktionel kontrol." — placeret øverst i artiklen, ikke kun i bunden.
- **Sponsoreret indhold:** badge "Annonce" eller "Sponsoreret indhold", farvekodet forskelligt fra journalistisk indhold, samt afvigende artikeldesign (jf. visuel identitet, del 4), så forskellen kan ses uden at læse teksten.
- **Brugerindsendt indhold:** byline "Indsendt af [navn/organisation], redigeret af redaktionen."
- **Pressemeddelelse (ubearbejdet):** byline "Pressemeddelelse fra [afsender]."

Dette mærkningssystem implementeres teknisk som obligatoriske metadata-felter i CMS'et (se del 3) — det skal være umuligt at publicere støtte- eller sponsorindhold uden korrekt mærkning.
