# Del 3: Lysdals CMS — generisk CMS- og AI-kravspecifikation
### En genanvendelig, AI-understøttet redaktionel platform — ikke kun til Slagelse Kommune

---

## 0. Produktramme — hvorfor "generisk"

Dette dokument specificerer **Lysdals CMS** som et selvstændigt, genanvendeligt produkt — ikke et system bygget udelukkende til Slagelse-mediet. Slagelse Kommune-eksemplerne, der optræder i denne og de øvrige fem dele af leverancen (kommunale dagsordener, politikreds, delområder, kategori-taksonomi m.v.), skal fra og med denne version læses som **én konfigureret instans** af Lysdals CMS — ikke som hardkodede krav til selve systemet. Alt, hvad der er specifikt for én kommune eller ét medie, flyttes til et konfigurationslag (afsnit 2.11), så det samme kodegrundlag kan sættes op til et hvilket som helst lokalmedie, uden at ændre i kernen.

**Antagelse:** Navnet "Lysdals CMS" og ambitionen om et generisk produkt er ikke defineret i det oprindelige opdrag, men introduceret undervejs i denne dialog.
**Konsekvens — en strategisk sondring, der bør besluttes eksplicit:** At gøre CMS'et generisk og navngivet som et selvstændigt produkt åbner reelt **to forskellige forretninger**, ikke én:

1. **Medievirksomheden** — driften af selve lokalmediet i Slagelse Kommune (del 1, 2, 6), som er en journalistisk/kommerciel forretning med støttepakker som primær indtægt.
2. **Softwareproduktet Lysdals CMS** — en licens-/SaaS-forretning, hvor systemet (evt. inkl. AI-lagene) sælges eller stilles til rådighed for *andre* lokalmedier.

De to forretninger har delvist modstridende incitamenter: et generisk CMS bør være neutralt og let at konfigurere for enhver kunde, mens Slagelse-mediet har en interesse i, at dets egne redaktionelle principper og kickback-model er indbygget som standard. Der er desuden en oplagt interessekonflikt, hvis Lysdals CMS på et tidspunkt sælges til et medie, der konkurrerer med Slagelse-mediet selv. Denne kravspecifikation løser det teknisk (generisk kerne + konfigurerbart lag pr. instans, jf. afsnit 2.11), men **den forretningsmæssige beslutning** — om Lysdals CMS skal udvikles og sælges som et selvstændigt produkt, kun bruges internt, eller først vurderes efter Slagelse-mediet har bevist sig selv — bør tages eksplicit og er tilføjet til beslutningslisten i del 6.

---

## 1. Formål og scope

**Formål:** Et AI-understøttet, men ikke AI-styret, redaktionelt CMS, der understøtter hele produktionskæden fra idé til distribueret, målt indhold for **et vilkårligt lokalmedie** — og som teknisk håndhæver de redaktionelle principper, en given instans konfigureres med (mærkning, godkendelseskæde, adskillelse af salg/redaktion, jf. del 1 og del 2 for Slagelse-instansens konkrete udgave af disse principper).

**Hvad systemet ikke er:** Det er ikke et fuldautomatisk publiceringssystem — enhver publicering kræver menneskelig godkendelse. Det er ikke et selvstændigt CRM eller regnskabssystem. Det er heller ikke, i denne version, en multi-tenant-SaaS til eksterne kunder — men det understøtter flere sites inden for én organisation (netværksmodellen i del 8, se afsnit 2.12).

**Målgruppe:** Blandet og pr. instans konfigurerbar — redaktionelle brugere (ikke-tekniske), teknisk driftsansvarlig (teknisk), og eksterne støtter via et begrænset dashboard (se del 4). For Slagelse-instansen specifikt gælder desuden rollemodellen i del 2, afsnit 6.

**Modenhed:** MVP'en er en produktionsklar, men bevidst funktionsbegrænset version (se del 6) — ikke en prototype.

**Drift:** Online, cloud-hostet, flerbruger fra dag ét, pr. instans. Redaktionel adgang kræver login; offentlig frontend er åben uden login (med valgfri brugerprofil for community-funktioner, del 4).

**Gennemgående designprincip — manuel/AI-hybrid:** Enhver funktion i CMS'et skal kunne udføres fuldt ud manuelt, uden AI, af en journalist der ønsker det. AI-lagene (afsnit 3) er additive og valgfrie ved hvert skridt i processen — aldrig en forudsætning for at søge, skrive, redigere eller publicere. Omvendt skal AI-funktionerne (kildesøgning i realtid, udkast, transskribering m.fl.) være dybt integreret i den samme skriveflade, ikke gemt væk i et separat, isoleret værktøj — journalisten skal frit kunne veksle mellem at skrive manuelt og trække på AI-assistance i samme session, uden at skifte kontekst. Dette princip er bindende for både artikel-editoren (afsnit 4) og de øvrige moduler ovenfor.

**Gennemgående designprincip — generisk kerne, konfigureret instans:** Intet i kernefunktionaliteten (afsnit 2), AI-laget (afsnit 3) eller editoren (afsnit 4) må hardkode en bestemt kommunes navn, geografi, taksonomi, prisniveau eller redaktionelle tekst. Alt det Slagelse-specifikke ligger i konfigurationslaget (afsnit 2.11) som data, ikke i kode.

---

## 2. CMS-kernefunktionalitet

Funktionerne er grupperet i moduler. Hvert modul har et unikt ID (bruges i backloggen i del 6).

### 2.1 Artikelmodul (CMS-01)

- Oprette, gemme som kladde, redigere, publicere, afpublicere og planlægge (fremtidig) publicering af artikler.
- Prioritere historier og placere/fremhæve dem på forsiden og i sektioner (se forsidestyring, del 4).
- Oprette "breaking news"-flag, der udløser særlig visning i frontend og valgfri push-notifikation.
- Oprette artikelserier og temauniverser (samler flere artikler under en fælles forside-/navigationsindgang).
- Versionshistorik: enhver redigering efter publicering logges med tidsstempel, bruger og diff; væsentlige rettelser (faktuelle) skal markeres med en synlig "Rettet"-note i artiklen (presseetisk standard).
- Faktabokse, citatblokke, relaterede links, infobokse, call-to-action-elementer og embeds håndteres som strukturerede komponenter, ikke fri HTML (se artikel-editor, afsnit 4).

#### Publiceringsoversigt (samlet artikelliste)

Den daglige, primære arbejdsflade for redaktionen er en fanebladsopdelt liste over alt indhold — et supplement til Kanban-boardet (del 2, afsnit 5), som bruges til at styre workflow-faser, mens denne oversigt viser den samlede, publicerede/planlagte portefølje:

- **Faneblade:** Publiceret, Planlagt, Debat/holdning, Liveblog, Telegrammer (eksterne signaler viderebragt som selvstændig indholdstype, jf. afsnit 2.9), samt et fast servicefane (fx "Dagens overblik" — tilpasset til lokal relevans: vejr, arrangementer i dag, evt. togforsinkelser — en let genkendelig, tilbagevendende skabelon frem for en fri artikel).
- **Søgning og filtre:** fritekstsøgning på titel, filtrering på indholdstype, status, sortering (nyeste/ældste), datointerval, samt hurtigfiltre "Breaking", "Sponsoreret" og "Fastgjort" (pinned).
- **Grupperede sektioner øverst i listen:** "BREAKING", dernæst "FASTGJORT" (artikler manuelt fastgjort til forsiden, jf. forsidestyring del 4), og til sidst "ALLE HISTORIER" i kronologisk rækkefølge.
- **Tabelkolonner:** miniaturebillede + titel, status (farvet prik + tekst: Kladde/Planlagt/Publiceret/Afpubliceret), indholdstype-badge (Artikel/Video/Liveblog/Telegram — en visuel udvidelse af `artikel.indholdstype`, jf. afsnit 5.2), medieikon (billede/video/lyd), forfatter (profilbillede + navn), publiceringstidspunkt, senest opdateret (relativt tidsstempel), og en handlingskolonne (fastgør til forside, markér/afmarkér som breaking, samt en "…"-menu med redigér, afpublicér og arkivér).
- Denne visning giver redaktøren et hurtigt, samlet overblik over hele porteføljen — herunder hvor meget der reelt er "breaking" eller "fastgjort" på et givet tidspunkt — som et løbende sundhedstjek på, at forsiden ikke skævvrides (jf. kvoteloft for støttefinansieret indhold, afsnit 2.4).

### 2.2 Taksonomi- og relationsmodul (CMS-02)

- Kategorier (topniveau, redaktionelt styret liste, jf. del 1 afsnit 6.3).
- Emnetags (fritekst med autocomplete mod eksisterende tags for at undgå duplikering).
- Geografiske lokationstags (delområder i kommunen), inkl. kobling til koordinater for kortvisning.
- Forfattere (interne og freelance), med tilknyttet forfatterside (se del 4).
- Organisationer og virksomheder som selvstændige entiteter (genbruges på tværs af artikler, støtteaftaler og virksomhedssider).
- Relaterede artikler: manuel kobling + AI-assisteret forslag (se AI-niveau 2, afsnit 3.2).
- Kalenderbegivenheder som selvstændig entitet, koblet til artikler (se kalendermodul, del 4).

### 2.3 Mediemodul (CMS-03)

- Upload, organisering og genbrug af billeder, video, lyd og dokumenter i et centralt mediebibliotek.
- Obligatorisk billedtekst- og alt-tekstfelt pr. billede (kan AI-udkastes, kræver menneskelig godkendelse — se AI-niveau 1).
- Automatisk billedoptimering (komprimering, responsive størrelser) ved upload.
- Rettighedsfelt pr. medie: fotograf/ophavsret, licenstype, udløbsdato for brugsret (relevant for eksternt/pressemateriale).

### 2.4 Kommercielt indholdsmodul (CMS-04)

- Oprettelse og administration af sponsoreret indhold og partner-/støttefinansieret indhold som særskilte indholdstyper med obligatoriske mærkningsfelter (jf. del 1, afsnit 9.3) — **systemet skal teknisk forhindre publicering af denne indholdstype uden udfyldt mærkningsfelt.**
- Kobling mellem en artikel og en konkret støtteaftale, så leverancen automatisk trækkes fra støttens årlige kvote (se supporterdashboard, del 4).
- Kvoteloft-advarsel: systemet advarer redaktøren, hvis ugens/månedens andel af støttefinansieret indhold på forsiden nærmer sig det fastsatte loft (jf. del 1, afsnit 8.3, punkt 4).

### 2.5 Brugerroller og godkendelsesmodul (CMS-05)

- Rollebaseret adgangsstyring, jf. tabellen i del 2, afsnit 6 — implementeres som konfigurerbare roller, ikke hardkodede rettigheder, så nye roller kan tilføjes uden kodeændring.
- Redaktionel godkendelseskæde: kun redaktør-rollen (eller stedfortræder) kan flytte en artikel fra "Godkendelse" til "Publiceret".
- Interne kommentarer/feedback på artikeludkast (synlige kun for redaktionelle roller, ikke offentligt).

### 2.6 Opgave- og honorarmodul (CMS-06)

- Oprettelse, tildeling (direkte eller via opgavepulje) og deadlinestyring af journalistiske opgaver, jf. del 2, afsnit 2.2.
- Automatisk honorarberegning ved godkendt publicering, baseret på konfigurerbar prisliste (jf. del 2, afsnit 2.1).
- Eksport af honorardata til bogføring/løn (se integrationer, del 5).

### 2.7 Indsendt materiale-modul (CMS-07)

- Offentlig formular til indsendelse af historieforslag, arrangementer, billeder, pressemeddelelser og kontaktoplysninger — ingen automatisk publicering.
- Indsendt materiale lander i workflow-fasen "Indsendt forslag" (jf. del 2, afsnit 3) til redaktionel vurdering.
- Spamfiltrering og basal validering (obligatoriske felter, filtypekontrol på uploads).
- **Integration med eksisterende meddeler-værktøj:** indsendt materiale fra meddeler-værktøjet skal kunne modtages via API, med afsender, rettigheds- og samtykkeerklæring bevaret, og indgå i workflow-fasen "Indsendt forslag" (jf. del 9).

### 2.8 Samtykke- og rettighedsmodul (CMS-08)

- Log over brugsrettigheder for alt medie- og tekstmateriale (fotograf, kilde, ekstern afsender).
- Samtykkefelt for kilder, der optræder med navn, billede eller citat — kobles til kildemodulet (jf. del 2, afsnit 4).

### 2.9 Signals-modul (CMS-09) — live kildeovervågning

En rå, ufiltreret strøm af alt, hvad mediets overvågning fanger, friskeste øverst, på tværs af alle overvågede kilder — det redaktionelle "råstof", før det bliver til en historieidé. Selve **listen af overvågede kilder er konfigurerbar pr. instans** (afsnit 2.11) — nedenstående er de kildetyper, systemet skal understøtte teknisk, illustreret med Slagelse-instansens konkrete opsætning:

- **Understøttede kildetyper (generisk):**
  - Kommunale/offentlige dagsordener og referater — for enhver kommune, der stiller dem til rådighed som RSS/åbne data (Slagelse-instans: Slagelse Kommunes byråds- og udvalgsdagsordener).
  - Politiets pressemeddelelser (politi.dk, RSS pr. politikreds — konfigureres til den politikreds, der dækker instansens geografi).
  - Konkurrerende mediers offentlige RSS-feeds (Slagelse-instans: sn.dk, VDonline.dk, TV2 Øst) — bruges udelukkende til at se, hvad andre dækker og til at opdage kildehenvisninger, **aldrig** til at genbruge eller omskrive deres tekst (jf. copyright- og kildeetik).
  - Lokale foreningers, virksomheders og arrangørers offentlige opslag, hvor det er teknisk og aftalemæssigt muligt.
  - Indsendt materiale fra borgere (kobler direkte til CMS-07).
  - Telegrambureau (fx Ritzau) — **valgfrit, abonnementsbaseret tilkøb**, jf. antagelse nedenfor.
- **Visning:** hvert signal vises med kildebadge/logo, et statustag (fx "Bemærkelsesværdigt"/"Breaking"/ren kategori), et relativt tidsstempel ("nu", "3 min"), en overskrift/uddrag, en underkategori, og en handling for at gemme signalet til en mappe eller sende det videre til Topics-modulet (afsnit 2.10).
- **Filtrering:** "Alle", pr. kilde, "Markér alle som læst", samt "Administrér kilder" (afsnit 2.11) til at slå overvågede kilder til/fra pr. instans.

**Antagelse:** Et fuldt Ritzau/Reuters-niveau af telegrambureau-dækning, som det ses i referenceproduktet, er dimensioneret til et landsdækkende/internationalt nyhedshus og er hverken nødvendigt eller økonomisk forsvarligt for et lokalt medie i Slagelse-instansens skala — men kan give mening for en anden, større instans af Lysdals CMS.
**Konsekvens:** MVP'ens Signals-konfiguration for Slagelse-instansen afgrænses til de gratis eller lavomkostnings-kilder, der er reelt relevante der (kommunale dagsordener, politi, indsendt materiale, konkurrenters RSS) — et evt. Ritzau-abonnement er en "kan vente"-post pr. instans, konfigureret uafhængigt af selve systemets kernefunktionalitet (se MVP-afgrænsning, del 6).

### 2.10 Topics-modul (CMS-10) — AI-klyngede historieidéer

AI-laget klynger relaterede signaler til "Topics" — potentielle historier med en foreslået vinkel — så redaktionen ser færdigtolkede idéer frem for en uendelig, rå strøm.

- Hvert topic-kort viser: et billede (hvor relevant), et farvekodet statustag (fx kategori eller "Bemærkelsesværdigt"), "Opdateret for X siden", en overskrift, en kort beskrivelse af vinklen, antallet af understøttende signaler/kilder, og feedback-handlinger (gem til mappe, tommelfinger op/ned).
- **Tommelfinger op/ned er ikke kun engangsfeedback** — det bruges til løbende at justere, hvilke emneområder og kildetyper AI'en prioriterer at klynge til fremtidige topics for netop denne instans/redaktion.
- Filtrerbart via kategori-"chips" med løbende optalte antal (fx "Erhverv 12", "Sport 8", "Foreningsliv 5") og fritekstsøgning — kategorierne er den taksonomi, instansen selv har konfigureret (afsnit 2.11).
- **Administrér emner:** redaktionen konfigurerer eksplicit, hvilke emneområder og hvilket geografisk dækningsområde AI'en aktivt overvåger og genererer topics for, så redaktionen ikke drukner i stof, der falder uden for netop **denne instans'** kerneopgave (i Slagelse-instansens tilfælde: afgrænset til Slagelse Kommune, jf. del 1, afsnit 2.3, "Hvad mediet ikke er").
- Et topic er **ikke** en artikel — det er en kladde-idé, der lander i workflow-fasen "Idé" eller "Indsendt forslag" (jf. del 2, afsnit 3), og som en journalist aktivt skal vælge at forfølge og få tildelt som opgave (CMS-06), før produktionen starter.

### 2.11 Konfigurations- og instansmodul (CMS-11)

Dette modul er selve forskellen på et system bygget "kun til Slagelse" og et generisk produkt. Det samler alt det, der gør én instans forskellig fra en anden, i data og indstillinger — ikke i kode:

- **Identitet og branding:** mediets navn, domæne, logo, farvepalet, typografivalg (jf. visuel identitet, del 4, afsnit 9) — redigerbart uden udviklerinvolvering.
- **Geografisk dækningsområde:** en konfigurerbar liste af delområder/lokationstags (Slagelse-instans: Slagelse By, Korsør, Skælskør, Dalmose, Boeslunde, Vemmelev, Agersø, Omø) — en ny instans indtaster blot sin egen kommunes eller regions delområder.
- **Kategori-taksonomi:** en redigerbar liste af topkategorier og standard-emnetags (Slagelse-instansens forslag findes i del 1, afsnit 6.3), som den enkelte instans kan omdøbe, udvide eller indskrænke.
- **Signals-kildeliste:** hvilke eksterne kilder (kommunesystem, politikreds-RSS, konkurrenters feeds m.v.) der overvåges for netop denne instans (jf. afsnit 2.9).
- **Støttepakke-skabeloner:** navne, priser, kickback-indhold og kvoter for instansens støttepakker (Slagelse-instansens konkrete pakker er specificeret i del 1, afsnit 8) — redigerbare uden kodeændring.
- **Honorarsatser:** instansens prisliste for freelanceopgaver (jf. del 2, afsnit 2.1).
- **Sprog og lokalisering:** grænsefladesprog og evt. flersprogethed i frontend (dansk som standard, men feltet er ikke hardkodet).
- **Redaktionelle principper og mærkningstekster:** den konkrete ordlyd, der vises i mærkningsbadges og på "Om mediet"-siden (jf. del 1, afsnit 9), redigerbar pr. instans, men med de **ufravigelige** governance-regler (adskillelse salg/redaktion, obligatorisk mærkningsfelt før publicering) hardkodet i systemets logik, uanset instans.

**Arkitekturvalg (opdateret, jf. del 5 og del 8):** Med netværksmodellen i del 8 (kommunespecifikke sites på tværs af Sjælland) er den tidligere antagelse om adskilte enkelt-tenant-installationer erstattet af **multi-site inden for én organisation**: ét kodegrundlag, én driftsplatform og én redaktionel kerne, der betjener flere sites — hver med eget domæne, egen branding og egen konfiguration (dette modul). Det er ikke en multi-tenant-SaaS til eksterne kunder; adgangsisolering mellem uafhængige kunder, prissætning og supportforpligtelser er stadig fravalgt. Licensering af Lysdals CMS til andre lokalmedier forbliver en separat, senere beslutning (afsnit 0). Netværksfunktionerne er specificeret i afsnit 2.12.


### 2.12 Netværks- og multi-site-modul (CMS-12)

Gør det muligt at drive et netværk af kommunespecifikke sites (del 8) fra ét CMS:

- **Flere sites under ét netværk:** hvert site har eget domæne, eget navn, egen branding, eget delområdesystem, egen taksonomi og egen Signals-kildeliste (jf. CMS-11), men deler kodegrundlag, login og rollemodel.
- **Fælles freelancepulje:** en freelancer kan være tilknyttet flere sites; honorarer og opgaver tilskrives det enkelte site, så omkostningen pr. kommune kan opgøres.
- **Regionale artikler:** en artikel kan publiceres på flere sites fra én kilde, med canonical-styring, så søgemaskiner ikke straffer duplikeret indhold. Lokale tilpasninger (fx lokal indledning) er tilladt.
- **Netværkspakker:** støtteaftaler kan omfatte flere sites (jf. del 8, afsnit 4.4), med kvote og kickback fordelt pr. site — og med kvoteloftet for støttefinansieret indhold håndhævet **pr. site**, så en netværkspakke aldrig kan omgå det.
- **Netværksdashboard:** samlet overblik over trafik, omsætning, støtteaftaler, freelance-omkostning og redaktionel kvalitet pr. site — samt måling af omsætning pr. indbygger, som er netværksmodellens kritiske nøgletal og bruges til at vurdere udrulningens gates.
- **Selskabsmæssig adskillelse:** omsætning, omkostninger, servicegebyr, kapitalkald og udbytte kan opgøres pr. site-selskab, så aktionærer og medejere kan få rapportering på deres eget site (jf. del 8, afsnit 6).
- **Ufravigelige netværksregler:** de redaktionelle principper, mærkningskravene og adskillelsen mellem salg og redaktion er fælles for hele netværket og kan ikke overskrives pr. site.

**Acceptkriterium (AC-11):** Et nyt site kan oprettes i netværket alene ved konfiguration (domæne, geografi, taksonomi, kilder), uden kodeændring, og en regional artikel kan udgives på to sites fra én kilde med korrekt canonical-tag.
---

## 3. AI-funktioner

AI'en er en **redaktionel assistent**, aldrig en autonom beslutningstager. Alle niveauer nedenfor kræver menneskelig godkendelse før noget resultat publiceres. Funktionerne er inddelt efter, hvor meget selvstændig fortolkning AI'en foretager — jf. principperne i app-dokumentationsskillet.

### 3.1 Niveau 1 — Regelbaseret AI (deterministisk)

Ingen sproglig "fortolkning" — faste regler og tærskler:

- **Mærkningskontrol:** valideringsregel, der blokerer publicering af sponsoreret/støttefinansieret indhold uden udfyldt mærkningsfelt (jf. CMS-04).
- **Kvoteloft-advarsel:** tærskelbaseret advarsel når andelen af støttefinansieret forsideindhold nærmer sig det fastsatte loft.
- **Automatisk alt-tekst-generering:** genereres som udkast ved billedupload, skal godkendes/redigeres af journalisten før publicering — aldrig auto-publiceret.
- **Deadline-advarsler:** automatiske notifikationer 48/12 timer før opgavedeadline.
- **SEO-tekniske tjek:** faste regler for manglende metabeskrivelse, for lang titel, manglende alt-tekst — vises som en tjekliste, ikke en blokering.

### 3.2 Niveau 2 — Kontekstuel AI (dynamisk fortolkning)

Genererer forslag baseret på artiklens indhold, som journalisten kan acceptere, redigere eller afvise.

**Flagskibsfunktion — samtalebaseret skriveassistent ("Spørg" / "Auto"):**

Journalisten beskriver en historie, en vinkel eller et spørgsmål i fritekst ("Beskriv en historie, en vinkel eller et spørgsmål...") i stedet for at starte fra et blankt dokument. Assistenten finder relevante kilder fra Signals-/Topics-grundlaget (afsnit 2.9-2.10) og arbejder sammen med journalisten om historien, i to eksplicitte, bevidst valgte tilstande:

- **"Spørg" (Ask):** research-tilstand. Assistenten svarer på spørgsmål og opsummerer/lænker til kilder, men skriver **ikke** et publiceringsklart udkast. Velegnet til hurtigt faktatjek eller baggrundsafklaring.
- **"Auto":** agent-tilstand, hvor assistenten arbejder mere selvstændigt — samler kilder, strukturerer og skriver et udkast ud fra et valgt topic eller en fritekstbeskrivelse. Udkastet lander **altid** i workflow-fasen "Første udkast" (jf. del 2, afsnit 3), aldrig i "Godkendelse" eller "Publiceret" — "Auto" er en hurtigere start på et udkast, ikke en genvej uden om redaktionel kontrol.
- Foreslåede genveje vises som klikbare startpunkter afledt af aktuelle Topics (fx "Skriv en historie om: [topic]", "Grav i: [topic]", "Undersøg: [topic]") — journalisten kan altid skrive frit i stedet for at vælge et forslag.
- Enhver faktapåstand, assistenten bidrager med — i begge tilstande — skal kunne spores til et konkret signal eller en dokumenteret kilde (jf. AI-governance, afsnit 3.5). Assistenten må aldrig præsentere en påstand uden kildehenvisning, og må aldrig selv opsøge eller "gætte" kilder, den ikke kan dokumentere.

**Øvrige niveau 2-funktioner:**

- **Idéudvikling og researchplaner:** forslag til vinkler og research-spørgsmål ud fra et kort emne-input.
- **Interviewspørgsmål:** genereret ud fra emne og kildeprofil.
- **Omskrivning og sproglig korrektur:** dansk grammatik, retskrivning, tegnsætning og flow — med **synlig sammenligning mellem original og AI-redigeret tekst** (diff-visning), så journalisten ser præcis, hvad der er ændret.
- **Tone- og stiltilpasning:** fx tilpasning til en kortere social medie-tone uden at ændre fakta.
- **Overskrifter, underrubrikker, manchetter, mellemrubrikker:** 3-5 alternative forslag pr. felt.
- **Resuméer og faktabokse:** genereret ud fra artiklens brødtekst.
- **SEO-titler og metabeskrivelser:** forslag baseret på artiklens indhold og målte søgetermer.
- **Tags og kategorier:** forslag baseret på indhold, matchet mod eksisterende taksonomi (for at undgå tag-duplikering).
- **Forslag til relaterede/opfølgende historier:** baseret på semantisk lighed med tidligere artikler.
- **Transskribering af lyd/video** og **identifikation af citat-kandidater** i transskriptionen.
- **Oversættelse** (relevant for fx nytilflyttede eller sæsonturister — sekundær prioritet).
- **Billedtekst-udkast.**
- **Advarsler ved potentielt injurierende, diskriminerende eller udokumenterede formuleringer:** AI markerer sætninger, der kan udgøre en presseetisk eller juridisk risiko (fx udokumenterede beskyldninger), til redaktørens opmærksomhed — **blokerer ikke**, men kræver eksplicit "set og accepteret"-kvittering fra redaktøren før publicering.
- **Kontrol af kommerciel mærkning:** AI-baseret sekundært tjek (udover den regelbaserede validering i niveau 1) af, om sponsoreret/støttet indhold sprogligt ligner uafhængig journalistik uden tilstrækkelig afstandtagen.
- **Genformatering til kanaler:** omformning af en artikel til Facebook-, LinkedIn-, Instagram- og nyhedsbrevsformat (se distribution, del 4).

### 3.3 Niveau 3 — Prædiktiv AI (fremskrivning og modellering)

**Antagelse:** Det oprindelige koncept specificerer ikke konkrete prædiktive modeller (i modsætning til fx en abonnements- eller SaaS-app med kohorte-/LTV-modellering). For et redaktionelt medie er den mest relevante prædiktive anvendelse performance- og konverteringsfremskrivning, ikke finansiel modellering af en bruger-livstidsværdi.
**Konsekvens:** Nedenstående er skitseret som roadmap-funktioner, der kræver et vist datagrundlag (minimum 6-12 måneders trafik- og konverteringsdata) og derfor ikke er en del af MVP'en.

- **Trafik- og engagementsfremskrivning** pr. artikeltype/kategori, til at understøtte redaktionel prioritering.
- **Støttekonverteringsmodel:** forudsigelse af, hvilke virksomhedsprofiler i lokalområdet der har højest sandsynlighed for at konvertere til støtte, baseret på branche, størrelse og tidligere kontaktmønstre (kræver kobling til CRM-data, jf. integrationer del 5).
- **Churn-risiko for støtteaftaler:** tidlig advarsel ved faldende engagement fra en støtte (fx manglende brug af kickback-kvote), så partnerskabsansvarlig kan reagere før en opsigelse.

### 3.4 Fremtidige AI-lag (roadmap, ikke MVP)

- LLM-baseret automatisk førsteudkast af kortere nyheder ud fra strukturerede kilder (fx sportsresultater, kommunale dagsordener) — **kun** med tydelig "AI-udkast, redigeret af [journalist]"-mærkning, aldrig upubliceret uden menneskelig godkendelse.
- ML-baseret automatisk kategorisering af indsendt materiale (spam- vs. relevans-scoring) for at aflaste redaktionel triagering.
- Automatisk generering af strukturerede data (schema.org) direkte fra artikelindhold (se SEO, del 5).

### 3.5 AI-governance — ufravigelige regler

1. AI må aldrig opfinde citater, kilder eller fakta — al AI-genereret tekst, der indeholder faktapåstande, skal kunne spores til dokumenteret kildemateriale.
2. Enhver væsentlig AI-redigering skal være synlig for journalisten via diff-visning, før den accepteres.
3. Brug af AI i en given artikel registreres i et obligatorisk metadatafelt ("AI-brug: ingen / sproglig korrektur / omskrivning / transskribering / udkast"), som er en del af artiklens versionshistorik.
4. Ingen artikel kan publiceres udelukkende på baggrund af AI-output uden en navngiven, ansvarlig redaktionel godkender.
5. AI-forslag til overskrifter, resuméer mv. er altid forslag — aldrig auto-anvendt uden aktivt klik fra en bruger.
6. **Citater:** AI må aldrig generere citater. Et citat kan kun indsættes, hvis det er ordret udtrukket fra en verificerbar kilde med kildelink og tidsstempel eller side, og systemet skal teknisk forhindre indsættelse uden kildehenvisning. Et menneske godkender hvert citat før publicering (jf. del 9, afsnit 2).

---

## 4. Artikel-editor og komponenter

### 4.1 Editor-princip

En blokbaseret editor (i stil med Gutenberg/Notion-logik), hvor journalisten sammensætter artiklen af diskrete, gengivelige komponenter frem for fri tekst. Dette sikrer konsistent visning på tværs af enheder og gør det muligt at style journalistisk vs. kommercielt indhold forskelligt (jf. del 1, afsnit 9.3) uden manuel formatering pr. artikel.

### 4.2 Tilgængelige komponenter

Brødtekst · overskrift (H2/H3) · mellemrubrik · manchet · citat (pull quote) · faktaboks · infoboks · billede (enkelt) · billedgalleri · video (uploadet eller embed) · lydafspiller · podcast-embed · kort (lokation) · tidslinje · eventboks (koblet til kalendermodul) · personprofil (koblet til kildemodul) · virksomhedsprofil (koblet til organisationsmodul) · relaterede artikler (manuel/AI-forslag) · dokument/download · call-to-action · nyhedsbrevstilmelding · støtteboks (mærkning, jf. 2.4) · sponsormarkering · annoncefelt · socialt opslag (embed) · generisk embed (fx YouTube, kort) · afstemning · formular · kommentarspor · kontaktboks.

### 4.3 Formatspecifikke attributter

Uanset om indholdet skrives fra bunden manuelt eller påbegyndes med AI-assistance (afsnit 3.2), skal editoren stille det fulde, relevante attributsæt til rådighed for det valgte format — der findes ingen "let" version af felterne, bare fordi AI har bidraget til et udkast. Nedenstående er den bindende feltliste pr. indholdsformat.

**Artikel (tekst):** titel · manchet/underrubrik · brødtekst (blokkomponenter, jf. 4.2) · coverbillede + alt-tekst/billedtekst · kategori · emnetags · geotags · forfatter(e) · kildeliste (kobling til kildemodulet, del 2 afsnit 4) · relaterede artikler · SEO-titel/metabeskrivelse · indholdstype/mærkning · AI-brugsfelt · sprog · estimeret læsetid (automatisk beregnet ud fra ordantal, ikke redigerbar).

**Video:** titel · beskrivelse/manchet · videofil (upload) eller ekstern embed-kilde · varighed (automatisk udtrukket ved upload) · thumbnail/coverbillede · undertekster (SRT/VTT, dansk som minimum — tilgængelighedskrav, jf. del 4 afsnit 1) · transskription (AI-udkast, kræver menneskelig godkendelse) · kapitler/tidsstempler (kobler dele af videoen til konkrete emner) · format/aspect ratio (liggende 16:9 til artikelside; stående 9:16 kan uploades separat til sociale formater) · fotograf/videojournalist · rettighedsstatus (kobler til CMS-08) · kildeliste · kategori/emnetags · geotags · mærkning (hvis sponsoreret/partner) · kobling til relateret artikel · publiceringstidspunkt.

**Lyd/podcast:** titel · episodenummer/sæson (ved serie) · beskrivelse/shownotes · lydfil · varighed (automatisk udtrukket) · coverbillede (podcast-artwork, fast kvadratisk format iht. podcastplatform-standard) · transskription (AI-udkast, kræver godkendelse) · kapitler/tidsstempler · medvirkende/gæster (kobler til kildemodul/personprofil) · vært(er) · kategori/emnetags · geotags · RSS-metadata til podcast-distribution (se integrationer, del 5) · mærkning (hvis sponsoreret) · kobling til relateret artikel · publiceringstidspunkt.

Alle tre formater deler de samme kerneattributter — kategori, emnetags, geotags, indholdstype/mærkning og AI-brugsfelt — så forsidestyring, kvoteloft for støttefinansieret indhold og SEO fungerer ens på tværs af format (jf. del 1 og del 4).

### 4.4 Kildepanel og realtidssøgning i editoren

Et sidepanel i selve editoren giver journalisten adgang til at søge og indarbejde kilder, mens der skrives — adskilt fra skriveassistenten (afsnit 3.2), og uden at kræve, at "Spørg"/"Auto"-tilstanden aktiveres.

- **Tre søgekilder i samme panel:**
  1. **Mediets eget kildearkiv:** tidligere anvendte kilder og kontakter, jf. kildemodulet (del 2, afsnit 4).
  2. **Signals-/Topics-grundlaget** (afsnit 2.9-2.10): allerede indsamlede signaler relevante for det aktuelle emne.
  3. **AI-drevet realtids-websøgning:** finder baggrundsfakta, tidligere dækning og offentligt tilgængelige oplysninger, med resultater der opdateres løbende, mens journalisten justerer søgeordene — uden at forlade editoren.
- **Indsættelse:** en fundet kilde kan trækkes eller indsættes direkte ved markørens position i teksten som en kildehenvisning, koblet til den konkrete faktapåstand, den understøtter. Indsættelsen logges automatisk i kildemodulet (del 2, afsnit 4) som en sporbar kildehenvisning — ikke som en løs, usporbar fodnote.
- **Ufravigeligt princip:** AI'en må finde og foreslå kilder i realtid, men kan aldrig selv indsætte en kilde eller en faktapåstand i brødteksten uden et aktivt, bevidst klik fra journalisten. Søgning og indsættelse er to adskilte handlinger, uanset hvor "smart" søgningen er.
- **Sporbarhed:** enhver AI-fremfundet kilde viser tydeligt sin oprindelse (hvilken søgetjeneste/database og hvornår resultatet blev hentet), så journalisten kan vurdere troværdigheden, før kilden bruges — i tråd med AI-governance-reglerne i afsnit 3.5.
- **Fuld funktion uden AI:** hvis den AI-drevne del af søgningen er slået fra eller utilgængelig, skal panelet fortsat give adgang til kildearkivet og Signals-/Topics-grundlaget — realtids-AI-søgning er et lag oven på en i forvejen funktionsdygtig, manuel kildesøgning, ikke en forudsætning for den.

### 4.5 Preview

Journalisten skal kunne se en realistisk, enhedsspecifik preview (mobil/tablet/desktop) af artiklen, som den vil se ud i frontend, før publicering — inklusive korrekt visning af evt. mærkningsbadge og forsidekort-udseende (så journalisten kan vurdere, hvordan historien "sælger sig selv" i et forsidemodul).

---

## 5. Datastruktur og centrale indholdsmodeller

### 5.1 Kerneentiteter

| Entitet | Nøglefelter | Relationer |
|---|---|---|
| **Netværk** | netværksnavn, navnemønster, fælles redaktionelle principper, fælles freelancepulje, netværkspakker, fælles brugere/roller | Instanser (1-mange), Støtteaftale (netværkspakker), Forfatter (fælles pulje) |
| **Instans** | mediets navn, domæne, branding (logo/farver/typografi), geografisk dækningsområde (delområdeliste), kategori-taksonomi, Signals-kildeliste, sprog, redaktionelle principper/mærkningstekster | Alle øvrige entiteter tilhører én instans (flere instanser kan høre under ét netværk, jf. afsnit 2.12) |
| **Artikel** | titel, manchet, brødtekst (komponentliste), status/fase, kategori, emnetags, geotags, forfatter(e), publiceringstidspunkt, indholdstype (uafhængig/partner/sponsoreret/brugerindsendt/PR), AI-brugsfelt, mærkningsdata, pinned (boolsk), breaking (boolsk) | Instans, Forfatter, Organisation, Støtteaftale, Kilde, Event, Medie, Topic (oprindelse) |
| **Forfatter** | navn, rolle (fast/freelance), bio, profilbillede, kontaktoplysninger | Artikler |
| **Organisation/virksomhed** | navn, branche, adresse, kontaktperson, kobling til støtteaftale | Artikler, Støtteaftale, Event |
| **Kilde** | navn, kildetype, kontaktoplysninger, fortrolighedsniveau, samtykkestatus | Artikel (via kildemodul), Organisation |
| **Støtteaftale** | pakke-niveau, startdato/slutdato, årlig kvote (artikler/video/social), forbrugt kvote, kontaktperson, pris | Organisation, Artikler, Fakturaer (eksternt) |
| **Opgave** | tilknyttet artikel, tildelt journalist, deadline, honorartype, status | Forfatter, Artikel |
| **Medie** | filtype (billede/video/lyd/dokument), rettighedsstatus, ophavsperson, alt-tekst, billedtekst, varighed (video/lyd), undertekster/transskription, kapitler/tidsstempler, aspect ratio/format, coverbillede/artwork | Artikel |
| **Kildehenvisning** | tilknyttet artikel, tekstposition/blok-id, tilknyttet kilde eller signal, kilde til opslag (arkiv/Signals/realtidssøgning), indsat af (bruger), tidsstempel | Artikel, Kilde, Signal |
| **Event** | titel, tidspunkt, lokation, arrangør, billet-link, pris, kategori | Artikel, Organisation, Kalendermodul |
| **Signal** | kilde (system/kildetype), kildenavn, tag (kategori/"Bemærkelsesværdigt"/"Breaking"), overskrift/uddrag, tidsstempel, læst-status | Topic (kan indgå i én eller flere klynger) |
| **Topic** | titel, kort vinkelbeskrivelse, kategori, antal understøttende signaler, status (ny/gemt/forkastet/i produktion), feedback-score (op/ned-historik) | Signal (mange), Opgave/Artikel (når forfulgt) |
| **Bruger (læser)** | profil, fulgte emner/lokationer/foreninger/journalister, nyhedsbrevstilmeldinger | Kommentarer, Gemte artikler |

### 5.2 Eksempel på variabeldefinition (uddrag)

| Felt-ID | Datatype | Tilladte værdier | Default | Rolle |
|---|---|---|---|---|
| `artikel.status` | enum | Idé, Indsendt, Vurdering, Godkendt, Tildelt, Research, Udkast, Redigering, Faktatjek, Juridisk kontrol, SEO, Medievalg, Godkendelse, Planlagt, Publiceret, Distribueret, Opdateret, Arkiveret, Afvist | Idé | Primært input (workflow-drevet) |
| `artikel.indholdstype` | enum | Uafhængig, Partner, Sponsoreret, Brugerindsendt, PR | Uafhængig | Primært input — styrer mærkning |
| `artikel.ai_brug` | enum (multi-select) | Ingen, Sproglig korrektur, Omskrivning, Transskribering, Udkast | Ingen | Primært input, obligatorisk ved publicering |
| `støtteaftale.forbrugt_kvote` | integer | 0 – aftalt loft | 0 | Afledt (opdateres automatisk ved publicering af koblet artikel) |
| `artikel.pinned` | boolean | true/false | false | Primært input — manuel fastgørelse til forside/publiceringsoversigt |
| `artikel.breaking` | boolean | true/false | false | Primært input — udløser særlig visning og evt. notifikation |
| `topic.status` | enum | Ny, Gemt, Forkastet, I produktion | Ny | Afledt/redaktionelt input — styrer om et topic stadig vises i den aktive liste |
| `kildehenvisning.oprindelse` | enum | Kildearkiv, Signals/Topics, AI-realtidssøgning | Kildearkiv | Primært input — logges automatisk ved indsættelse, bruges til sporbarhed |
| `instans.geografisk_dækning` | liste (fritekst, konfigurerbar) | Enhver liste af delområder | Tom — udfyldes ved opsætning | Primært input, redigeres via CMS-11, ikke hardkodet i systemet |
| `instans.kategori_taksonomi` | liste (fritekst, konfigurerbar) | Enhver liste af topkategorier | Standardskabelon (jf. del 1, afsnit 6.3), kan overskrives | Primært input, redigeres via CMS-11 |

---

## 6. Fejlhåndtering og edge cases

- **Manglende mærkningsfelt ved publicering af kommercielt indhold:** publicering blokeres med tydelig fejlmelding — ikke en advarsel, der kan klikkes væk.
- **Overskredet støttekvote:** systemet tillader stadig publicering (redaktionel frihed bevares), men flager tydeligt til partnerskabsansvarlig, at leverancen ligger ud over aftalt kvote, til fakturering af tillægsydelse.
- **Samtidig redigering:** ved to brugere, der redigerer samme artikel, vises en advarsel og et "seneste version vinder med mulighed for at gendanne"-flow — ingen stilfærdig overskrivning.
- **AI-tjeneste utilgængelig:** alle AI-funktioner er additive; hvis AI-tjenesten fejler eller er nede, skal artikel-editoren fortsat fungere fuldt ud uden AI-forslag.
- **Ugyldigt indsendt materiale (formular):** tydelig fejlmelding ved manglende obligatoriske felter; ingen stille fejl.
- **Fejlagtig topic-klynge:** hvis AI'en fejlagtigt sammenkæder to urelaterede signaler i ét topic, skal journalisten kunne adskille dem eller afvise topic'et (tommelfinger ned), uden at det sletter de underliggende signaler — signalerne forbliver tilgængelige til manuel brug.
- **"Auto"-udkast uden tilstrækkelig kildedækning:** hvis skriveassistenten ikke kan finde nok dokumenterede kilder til at understøtte et udkast, skal den markere de udokumenterede afsnit tydeligt frem for at udfylde dem selv — aldrig levere et "komplet" udkast, der skjuler mangelfuld kildedækning.
- **Realtidssøgning uden relevante resultater:** kildepanelet viser tydeligt "ingen relevante resultater fundet" frem for at vise løst relaterede eller lavkvalitets-kilder for enhver pris — journalisten skal aldrig præsenteres for opfundne eller uverificerbare kilder blot for at fylde panelet.
- **Video/lyd publiceret uden undertekster eller transskription:** systemet blokerer ikke publicering, men viser en tydelig tilgængeligheds-advarsel, så det er et bevidst redaktionelt valg at udgive uden, ikke en overset mangel.

---

## 7. Acceptkriterier (udvalgte eksempler)

| AC-ID | Input | Forventet output | Verificering |
|---|---|---|---|
| AC-01 | Redaktør forsøger at publicere en sponsoreret artikel uden udfyldt mærkningsfelt | Publicering blokeres, fejlmelding vises | Manuel test |
| AC-02 | Freelancejournalist afleverer artikel til fase "Første udkast" | Artiklen er ikke synlig i offentlig frontend | Manuel test |
| AC-03 | AI genererer alt-tekst ved billedupload | Feltet er redigerbart og markeret som "AI-udkast" indtil journalisten gemmer/godkender | Manuel test |
| AC-04 | En støtteaftale når 100 % af årlig artikelkvote | Ny leverance kan stadig oprettes, men partnerskabsansvarlig modtager notifikation | Automatisk test |
| AC-05 | To brugere åbner samme artikel til redigering samtidigt | Bruger nr. 2 informeres om aktiv redigering ved bruger nr. 1 | Manuel test |
| AC-06 | Journalist beder skriveassistenten ("Auto") om et udkast til et emne uden tilstrækkelige dokumenterede kilder | Udkastet markerer tydeligt de udokumenterede afsnit i stedet for at udfylde dem | Manuel test |
| AC-07 | Journalist giver et Topic tommelfinger ned | Topic'et forsvinder fra den aktive liste, men de underliggende signaler forbliver tilgængelige | Manuel test |
| AC-08 | Journalist indsætter en AI-fremfundet kilde fra realtidssøgningen direkte i brødteksten | Kildehenvisningen logges automatisk i kildemodulet med oprindelse og tidsstempel | Automatisk test |
| AC-09 | Journalist publicerer en video uden undertekster/transskription | Publicering gennemføres, men en tilgængeligheds-advarsel vises | Manuel test |
| AC-10 | En ny instans oprettes med et andet geografisk dækningsområde og en anden kategori-taksonomi end Slagelse-instansen, uden kodeændring | Signals, Topics, forside og navigation reflekterer den nye instans' konfiguration korrekt | Manuel test ved opsætning af testinstans |
