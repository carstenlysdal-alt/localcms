# Næstved Source Registry — artikelmotor
## Næstved Kommune og lokale bysamfund

**Formål:** Et bredt, maskinelt kilderegister til Production Engine. Det er ikke en statisk linkliste, men et katalog af sources med prioritet, adgangstype, geo-filter og journalistisk formål.

> Et fuldstændigt lokalt register kan ikke vedligeholdes manuelt. Løsningen er et fast kerneregister kombineret med seed-kilder, der løbende opdager nye foreninger, virksomheder, skoler, institutioner og lokale websites.

## Lokal geografi

Kernematch:
- Næstved / Naestved
- Karrebæksminde / Karrebaeksminde
- Fuglebjerg
- Glumsø / Glumsoe
- Fensmark
- Herlufmagle
- Holme-Olstrup
- Mogenstrup
- Tappernøje / Tappernoeje
- Sandved
- Toksværd / Toksvaerd
- Enø / Enoe
- Suså / Susaa
- Næstved Kommune
- kommunekode **370**

Knowledge OS skal udvide listen med officielle stednavne, postnumre, adresser, matrikler, institutioner og lokalrådsområder.

## Prioriteter

- **P0 — breaking/drift:** poll/push typisk 1–5 min.
- **P1 — primære story-generators:** typisk 15–60 min eller efter kendt releaseplan.
- **P2 — discovery/lokal puls:** typisk 1–12 timer; leads, events og krydstjek.

## Kilderegister

| Pri | Kilde | Område | Adgang | Lokal filtrering | Typiske historier |
|---|---|---|---|---|---|
| P0 | Politi Update – Sydsjællands og Lolland-Falsters Politi | Politi | RSS; medie-API kan søges | Næstved + kommunens stedaliaser | Akutte hændelser, trafik, efterlysninger |
| P0 | Sydsjællands og Lolland-Falsters Politi – døgnrapporter/nyheder | Politi | Web/feed-monitor | Næstved, Glumsø, Herlufmagle m.fl. | Kriminalitet, kontroller, hændelser, opfølgning |
| P0 | Midt- og Sydsjællands Brand & Redning | Beredskab | Web + officielle sociale signaler/change monitor | Næstved Kommune | Brande, redning, beredskab, stationer, øvelser |
| P0 | DMI Open Data | Vejr/beredskab | API | Koordinater/bounding box | Varsler, storm, skybrud, vind, vandstand, lyn |
| P0 | Vejdirektoratet Trafikinfo | Trafik | Web/open data hvor tilbudt | E47/E55/Rute 54/kommunens vejnet | Uheld, kø, vejarbejde, planlagte hændelser |
| P0 | Vejdirektoratet – Næstved-Rønnede motorvejsprojekt | Infrastruktur | Projekt-/nyhedssider | Næstved–Rønnede korridoren | Anlægslov, ekspropriation, tidsplan, entrepriser |
| P0 | DSB trafikinformation | Jernbane | Web/change monitor | Næstved station + lokale stationer | Forsinkelser, aflysninger, sporarbejde |
| P0 | Banedanmark | Jernbane | Web/nyheder/projekter | Næstved og banekorridorer | Sporarbejde, elektrificering, projekter |
| P0 | Movia | Bus | Trafikinfo/API hvor tilbudt | Buslinjer i Næstved Kommune | Driftsændringer, omlægninger, aflysninger |
| P0 | Rejseplanen Labs / GTFS / SIRI | Kollektiv trafik | API/GTFS; gældende vilkår | Stop/stationer i kommunen | Realtid, aflysninger, ruter, køreplaner |
| P0 | NK-Forsyning / NK-Vand / NK-Spildevand | Forsyning | Web/driftsinfo/change monitor | Næstved Kommune | Vand, spildevand, driftsforstyrrelser, anlæg |
| P0 | Envafors – overgangsrelevante Næstved-sider | Forsyning | Web/driftsinfo | Næstved/NK-Forsyning under udtræden | Overgang, drift, kundemeddelelser |
| P0 | Næstved Fjernvarme | Fjernvarme | Web/driftsstatus/change monitor | Næstved by | Varmeudfald, udbygning, priser, projekter |
| P0 | Fensmark Fjernvarme | Fjernvarme | Web/change monitor | Fensmark | Drift, takster, udbygning |
| P0 | Fuglebjerg Fjernvarme | Fjernvarme | Web/change monitor | Fuglebjerg | Drift, takster, udbygning |
| P0 | Sandved-Tornemark Kraftvarmeværker | Fjernvarme | Web/change monitor | Sandved/Tornemark | Drift, takster, lokale energisager |
| P0 | AffaldPlus | Affald | Web/nyheder/SMS/driftsinfo | Næstved, Fuglebjerg, Herlufmagle, Holme-Olstrup, Mogenstrup | Genbrugspladser, affaldsdrift, anlæg |
| P0 | Region Sjælland – Næstved Sygehus | Sundhed | Web/nyheder/driftsinfo | Næstved | Sygehusdrift, projekter, kapacitet, sundhedsnyheder |
| P1 | Næstved Kommune – nyheder og pressemeddelelser | Kommune | Web/change monitor/abonnement | Kommune 370 | Kommunale beslutninger, service, projekter |
| P1 | Næstved Kommune – dagsordener og referater | Kommunalpolitik | Dagsordensportal/search/PDF-monitor | Alle udvalg/byråd | Sager før og efter politiske beslutninger |
| P1 | Næstved Kommune – høringer og borgermøder | Plan/politik | Struktureret web/change monitor | Adresse/sted/topic | Nye høringer, landzone, veje, miljø, planer |
| P1 | Næstved Kommune – lokalplanportal | Plan | Struktureret portal/map/search | Adresse/matrikel/sted | Gældende planer, nye forslag, planer i høring |
| P1 | Plandata.dk | Plan/open data | REST/WFS/WMS | Kommunekode 370 + geometri | Lokalplaner, kommuneplanrammer, statusændringer |
| P1 | Næstved Kommune – kommuneplan/strategi | Plan/politik | Web/PDF monitor | Kommune 370 | Langsigtet byudvikling, arealer, erhverv, natur |
| P1 | Næstved Kommune – udbud og indkøb | Udbud | Web/change monitor | Næstved Kommune | Aktuelle udbud, leverandører, kontrakter |
| P1 | Næstved Kommune – udbudsplan | Udbud | Web/PDF monitor | Næstved Kommune | Kommende indkøb før udbuddet rammer markedet |
| P1 | FUS – Fællesudbud Sjælland | Udbud | Web/udbudsmonitor | Næstved som deltager/ordregiver | Fælleskommunale indkøb og tildelinger |
| P1 | udbud.dk | Udbud | Search/monitor | Ordregiver=Næstved Kommune/lokale aktører | Udbud, kontrakter, værdier, frister |
| P1 | TED – Tenders Electronic Daily | EU-udbud | EU-data/feed/API | Næstved/lokale ordregivere | Store EU-udbud og tildelinger |
| P1 | Næstved Kommune – budget, regnskab og økonomi | Økonomi | Web/PDF monitor | Kommune 370 | Budgetter, besparelser, merforbrug, regnskab |
| P1 | Næstved Kommune – projekter | Byudvikling | Projektpages/change monitor | Havnebydel, bymidte, større projekter | Projektmilepæle, beslutninger, events, anlæg |
| P1 | Næstved Kommune – jobs | Arbejde | Jobsite/feed/monitor | Næstved Kommune | Ledelsesændringer, rekruttering, kapacitet |
| P1 | Folketingets åbne data | National politik | OData API JSON/ATOM | Næstved + entities + lokale projekter | Spørgsmål, udvalg, lovforslag, bilag, debatter |
| P1 | Retsinformation | Lovgivning | REST harvest API + ELI Atom/sitemap | Geo/entity/kommune-filter | Nye/ændrede regler med lokal konsekvens |
| P1 | Statstidende | Jura/virksomheder | OpenAPI | Postnr./CVR/adresse/navn | Konkurser, tvangsauktioner, proklama, juridiske meddelelser |
| P1 | Retten i Næstved – retslister | Domstole | HTML/PDF monitor | Næstved Kommune + lokale personer/virksomheder | Straffe-, civil-, skifte- og auktionssager |
| P1 | Ankestyrelsen | Tilsyn/klager | Web/afgørelser/search | Næstved Kommune/entity | Kommunale tilsyns- og klagesager |
| P1 | Planklagenævnet | Klage/plan | Afgørelsesdatabase/search | Næstved Kommune/steder | Plan- og byggesager |
| P1 | Miljø- og Fødevareklagenævnet | Klage/miljø | Afgørelsesdatabase/search | Næstved Kommune/steder | Miljø, natur, landbrug, virksomheder |
| P1 | Folketingets Ombudsmand | Tilsyn | Web/afgørelser | Næstved Kommune/institutioner | Principielle myndighedssager |
| P1 | Datatilsynet | Tilsyn | Web/afgørelser/nyheder | Næstved Kommune/lokale aktører | Datasikkerhed, GDPR, brud |
| P1 | Arbejdstilsynet | Arbejdsmiljø | Tilsyn/nyheder/open data hvor tilbudt | Lokale arbejdspladser/CVR | Arbejdsulykker, påbud, arbejdsmiljø |
| P1 | Fødevarestyrelsen / Find Smiley | Fødevarer | Offentlig database/search | Adresse/CVR/postnr. | Restaurantkontrol, sanktioner, fødevaresikkerhed |
| P1 | Styrelsen for Patientsikkerhed | Sundhedstilsyn | Tilsynsrapporter/nyheder | Lokale klinikker/pleje/institutioner | Tilsyn, påbud, patientsikkerhed |
| P1 | Erhvervsstyrelsen / CVR | Virksomheder | Officiel CVR-adgang/API | Kommune 370/adresse/postnr./CVR | Nye virksomheder, ledelsesændringer, status, branche |
| P1 | Danmarks Statistik / StatBank | Statistik | API | Kommune 370 | Befolkning, bolig, erhverv, kriminalitet, demografi |
| P1 | Jobindsats API v3 | Arbejdsmarked | API JSON/CSV | Kommune=Næstved | Ledighed, ydelser, beskæftigelse |
| P1 | Dataforsyningen / Grunddata / DAWA | Geodata | API | Kommune 370/geometri/adresser | Adresser, stednavne, administrative områder |
| P1 | BBR / Boligejer / offentlige ejendomsdata | Ejendom | Officielle data/search | Adresse/matrikel | Bygninger, ejendomme, lokale udviklinger |
| P1 | GEUS Jupiter | Miljø/vand | WFS/WMS/download/webservices | Kommune=Næstved | Grundvand, drikkevand, boringer, vandværker |
| P1 | Danmarks Miljøportal / Digital MiljøAdministration | Miljø | Web/data services | Kommune=Næstved + virksomheder | Miljøgodkendelser, tilsyn, risikovirksomheder |
| P1 | Miljøstyrelsen | Miljø | Web/data/nyheder | Lokale anlæg, natur, jord, virksomheder | Miljøsager, tilladelser, nationale afgørelser med lokal effekt |
| P1 | Kystdirektoratet | Kyst/klima | Web/data/nyheder | Karrebæksminde, Enø, fjord/kyst | Højvand, diger, kystbeskyttelse, erosion |
| P1 | Slots- og Kulturstyrelsen / Fund og Fortidsminder | Kulturarv | Offentlige databaser | Næstved Kommune/geometri | Fredninger, arkæologi, kulturarv |
| P1 | Valg.dk / officielle valgdata | Demokrati | Officielle data/results | Næstved Kommune/afstemningsområder | Valgresultater, kandidater, stemmetal |
| P1 | Næstved Havn | Havn/erhverv | Officiel web/nyheder + kommuneprojekt | Næstved Havn/kanalen | Gods, investeringer, flytning, havnebydel, drift |
| P1 | Næstved Erhverv | Erhverv | Nyheder/arrangementer/nyhedsbrev | Næstved Kommune | Virksomheder, investeringer, arbejdspladser, iværksætteri |
| P1 | Næstved Erhvervshus / Ressource City | Erhverv/grøn omstilling | Web/nyheder/events | Næstved | Erhvervsudvikling, cirkulær økonomi, events |
| P1 | Næstved City | Bymidte/detail | Web/nyheder/events | Næstved bymidte | Butiksliv, events, detail, byudvikling |
| P1 | Via Ritzau | Pressemeddelelser | Offentlige pressemeddelelser/search/RSS hvor muligt | Steds-/entity-filter | Myndigheder, virksomheder, fonde, organisationer |
| P1 | Ritzau nyhedstjeneste | Newswire | Licenseret feed/API | Geo/entity-filter | Bred nyhedsstrøm; kræver aftale/licens |
| P2 | TV2 ØST | Regionalt medie | Web/RSS hvis tilgængeligt; metadata monitor | Næstved + lokalområder | Discovery og krydstjek |
| P2 | Sjællandske Nyheder / sn.dk – Næstved | Lokalt medie | Web/RSS hvis tilgængeligt; metadata monitor | Næstved Kommune | Discovery, konkurrentovervågning, krydstjek |
| P2 | DR P4 Sjælland / DR regionalt | Regionalt medie | Web/app/feed hvor lovligt | Steds-/entity-filter | Discovery, breaking, regional kontekst |
| P2 | DK Nyt | Kommunalmedie | Web/nyhedsbrev | Næstved Kommune | Kommunale og regionale historier |
| P2 | Næstved Nyt | Lokalt medie | Web/Blogger feed/monitor | Næstved + lokalområder | Lokale nyheder, 112, politik, kultur, foto |
| P2 | Næstved Netavis | Lokalt medie | Web/monitor | Næstved Kommune | Lokale historier, debat, erhverv, kalender |
| P2 | Dit Næstved | Lokalt medie | Web/nyhedsbrev/monitor | Næstved Kommune | Events, foreninger, kommunale historier, kultur |
| P2 | VORES Næstved / lokale VORES-sider | Aggregator | Web monitor | By/postnr. | Events, bolig, politi-aggregater, lokal discovery |
| P2 | Mynewsdesk og andre PR-platforme | Pressemeddelelser | Search/feed hvor tilladt | Næstved + entity | Lokale pressemeddelelser |
| P2 | Næstved Bibliotek og Borgerservice – arrangementer | Kultur/events | Struktureret eventside/monitor | Næstved, Fuglebjerg, Glumsø, Korskilde | Arrangementer, debat, foredrag, kultur |
| P2 | Næstved Kommune – Foreningsportalen | Foreninger | Seed directory + crawler | Hele kommunen/aktivitet | Automatisk discovery af lokale foreninger |
| P2 | Næstved Kommune – lokalråd og bylaug | Lokalsamfund | Seed directory + udgående links | Lokalsamfund i hele kommunen | Borgerinitiativer, møder, lokal udvikling |
| P2 | Kommunale folkeskoler | Skole | Kommune-seed + skolewebsites | 18 afdelinger/kommunen | Skoleevents, bestyrelser, ledelse, projekter |
| P2 | Privat- og friskoler | Skole | Kommune-seed + officielle websites | Næstved Kommune | Lokale skolehistorier, elevtal, arrangementer |
| P2 | Dagtilbud/private dagtilbud | Dagtilbud | Seed registry + selective monitor | Næstved Kommune | Åbning/lukning, kapacitet, events |
| P2 | Næstved Gymnasium og HF | Uddannelse | Web/nyheder/events | Næstved | Ungdom, uddannelse, events |
| P2 | ZBC Næstved | Uddannelse | Web/nyheder/events | Næstved | Erhvervsuddannelse, events, arbejdsmarked |
| P2 | EUC Sjælland Næstved | Uddannelse | Web/nyheder/events | Næstved | Erhvervsuddannelse, teknik, arbejdsmarked |
| P2 | Professionshøjskolen Absalon – Næstved | Uddannelse | Web/nyheder/events | Næstved | Videregående uddannelse, forskning, studieliv |
| P2 | VUC Storstrøm / Næstved | Uddannelse | Web/nyheder/events | Næstved | Voksenuddannelse og lokale uddannelseshistorier |
| P2 | Herlufsholm Skole og Gods | Uddannelse/institution | Web/nyheder | Næstved | Skole, institution, events, lokal arbejdsplads |
| P2 | Grønnegades Kaserne Kulturcenter | Kultur | Event/nyhedssider | Næstved | Kultur, teater, koncerter, events |
| P2 | Rønnebæksholm | Kunst/kultur | Web/udstillinger/events | Næstved | Kunst, udstillinger, bevillinger, events |
| P2 | Museum Sydøstdanmark / Næstved Museum | Kultur/historie | Web/nyheder/events | Næstved Kommune | Arkæologi, kulturarv, udstillinger |
| P2 | Næstved Arena / lokale sportsfaciliteter | Sport/events | Web/kalender/nyheder | Næstved | Sport, events, faciliteter |
| P2 | Næstved Boldklub | Sport | Officiel web/nyheder | Næstved | Kampe, klub, økonomi, spillere |
| P2 | Team FOG Næstved | Sport | Officiel web/nyheder | Næstved | Basket, kampe, klub, sponsorer |
| P2 | Lokale idrætsforeninger | Sport | Foreningsportal seed + klubwebsites | Hele kommunen | Kampe, resultater, faciliteter, frivillighed |
| P2 | Lokale kirker/sogne | Lokalsamfund | sogn.dk + officielle sider | Næstved Kommune | Arrangementer, udnævnelser, lokale fællesskaber |
| P2 | Lokale kulturforeninger og spillesteder | Kultur | Foreningsportal seed + websites | Hele kommunen | Programmer, events, bevillinger, frivillighed |
| P2 | Lokale virksomheders egne newsrooms | Virksomheder | CVR-seed + website-monitor | Adresse i kommunen/høj lokal betydning | Investeringer, fyringer, udvidelser, ledelse |
| P2 | Officielle lokale Facebook/Instagram/LinkedIn-konti | Social signal | Officielle API'er/alerts/manual | Geografi + verified account | Tidlige signaler og tips; altid verificér |


---

# Anbefalet source-arkitektur

Kilderegisteret bør ligge som data i Production Engine, ikke som hardcoded kode.

```text
SourceDefinition
- id
- name
- sourceClass
- authorityLevel
- priority
- accessMode
- urlOrEndpoint
- licenseType
- instanceScope
- geoFilter
- entityFilters[]
- keywordFilters[]
- pollInterval
- parserType
- robotsTermsCheckedAt
- enabled
- lastSuccessAt
- lastFailureAt
```

`accessMode`:

```text
API
RSS
ATOM
EMAIL
WEBHOOK
HTML_MONITOR
SITEMAP
LICENSED_FEED
MANUAL
SEED_DIRECTORY
```

`authorityLevel`:

```text
PRIMARY_OFFICIAL
PRIMARY_ORGANIZATION
LICENSED_NEWSWIRE
SECONDARY_MEDIA
AGGREGATOR
SOCIAL_SIGNAL
```

---

# Native integrationer til første Næstved-MVP

Start med disse:

1. Politi Update + politiets døgnrapporter.
2. Midt- og Sydsjællands Brand & Redning.
3. Næstved Kommune nyheder/presse.
4. Dagsordener og referater.
5. Høringer/borgermøder.
6. Lokalplanportal + Plandata.
7. Udbud, udbudsplan, udbud.dk og TED.
8. Folketingets åbne data.
9. Retsinformation.
10. Statstidende.
11. Retten i Næstved – retslister.
12. CVR.
13. DST StatBank.
14. Jobindsats API v3.
15. DMI.
16. Vejdirektoratet, DSB, Banedanmark, Movia/Rejseplanen.
17. NK-Forsyning/Envafors transition.
18. Næstved Fjernvarme og øvrige lokale fjernvarmeværker.
19. AffaldPlus.
20. Region Sjælland/Næstved Sygehus.
21. Næstved Havn.
22. Næstved Erhverv.
23. Foreningsportalen og lokalråd/bylaug som seed directories.
24. Lokale medier som discovery/krydstjek.

---

# Seed → discovery

## Foreninger

Næstved Kommunes Foreningsportal bruges som seed:

```text
Foreningsportal
→ association record
→ officielt website
→ discover RSS/Atom
→ discover sitemap
→ discover news/events
→ create child Source records
```

Foreninger bør ikke vedligeholdes manuelt én for én.

## Lokalråd og bylaug

Kommunens oversigt over lokalområder, lokalråd og bylaug fungerer som seed directory. Følg kun officielle links og registrér relevante nyheds-, kalender- og mødesider som child sources.

## Skoler

Kommunens skoleoversigt fungerer som seed:

```text
kommune school registry
→ school entity
→ official website
→ news/calendar/board pages
```

Samme princip bruges for privat-/friskoler og øvrige uddannelsesinstitutioner.

## Virksomheder

CVR bruges til at skabe en lokal virksomhedspopulation.

Prioritér:
- større arbejdspladser
- nye virksomheder
- virksomheder med store status-/ledelsesændringer
- havn/forsyning/infrastruktur
- miljørisiko-/tilsynsvirksomheder
- virksomheder med kommunale kontrakter
- virksomheder i større byudviklingsprojekter

Officielle newsrooms bliver child sources.

---

# Næstved-specifik Story Intelligence

## Havn og havneby

```text
Næstved Havn
+ dagsordener
+ ny havnebydel
+ lokalplaner
+ udbud
+ lokale virksomheder
= story cluster
```

## Kyst og Karrebæksminde/Enø

```text
DMI
+ Kystdirektoratet
+ høringer
+ lokalplaner
+ lokalråd
+ tidligere højvands-story
= lokal kyst-/klimahistorie
```

## Forsyning

```text
NK-Forsyning
+ Envafors transition
+ GEUS Jupiter
+ DMA
+ kommunale vand-/spildevandsplaner
= forsynings-/miljøhistorie
```

## Næstved–Rønnede

```text
Vejdirektoratet
+ Folketinget
+ kommunale planer
+ udbud
+ ekspropriation/Statstidende
+ berørte adresser/CVR
= infrastruktur-story
```

---

# StoryCandidate-flow

```text
SourceItem
→ local relevance
→ deduplication
→ entity resolution
→ Knowledge OS lookup
→ source authority
→ StoryCandidate
→ Editorial Rating
```

Lokal relevans må ikke være et simpelt `contains("Næstved")`.

Den skal kombinere:

```text
explicit place
address/postcode
kommuneId
geometry
matrikel
CVR/P-number
institution
person/entity relation
existing Story locality
```

Et nationalt dokument kan dermed være lokalt relevant uden direkte at nævne Næstved.

---

# Minimum metadata fra hvert source-hit

```text
sourceId
sourceItemId
canonicalUrl
title
publishedAt
retrievedAt
rawPayloadHash
sourceAuthority
detectedPlaces[]
detectedEntities[]
detectedClaims[]
storyMatches[]
localityScore
duplicateScore
reuseLicenceRule
```

Bevar altid original provenance.

---

# Rettigheder

**Primære offentlige kilder:** Brug API/feed efter gældende vilkår og gem provenance.

**Sekundære medier:** TV2 ØST, sn.dk, DR, Næstved Nyt, Næstved Netavis, Dit Næstved osv. bruges primært til discovery, alerts, metadata og krydstjek. Systematisk kopiering eller genudgivelse af hele artikler kræver relevante rettigheder.

**Ritzau:** Skeln mellem Via Ritzau/offentlige pressemeddelelser og licenseret Ritzau-nyhedstjeneste.

**Sociale medier:** Brug officielle API'er, embeds, alerts eller manuel observation. Undgå uautoriseret scraping.

**Persondata:** CVR, retslister, borgertips og sociale signaler skal behandles efter konkrete adgangs-, privatlivs- og redaktionelle regler.

---

# Source discovery-job

Kør fx ugentligt:

```text
discoverSources(instance=naestved)
```

Jobbet bør:

1. hente Foreningsportalen
2. hente lokalråd/bylaug
3. hente skoler/institutioner
4. opdatere lokal CVR-population
5. finde officielle websites
6. opdage RSS/Atom/sitemaps/news/events
7. sammenligne med Source Registry
8. foreslå nye child sources til approval
9. markere døde/flyttede sources
10. lære nye stedaliaser til Knowledge OS

AI må klassificere kildetype og relevans, men ikke automatisk ophøje ukendte sites til verificerede primærkilder.

---

# Success-kriterium

Næstved-motoren er stærk, når den kan opdage en historie direkte fra primærdata, fx:

```text
nyt byrådsbilag
+ Næstved Havn
+ lokalplan
+ lokal CVR-virksomhed
+ tidligere Story i Knowledge OS
= StoryCandidate før sekundære medier
```

eller:

```text
høring i Karrebæksminde
+ Kystdirektorat/DMI
+ lokalråd
+ tidligere stormflods-Story
= potentiel lokal historie
```

Det er source-lagets vigtigste funktion.
