# Slagelse Source Registry — artikelmotor

## Slagelse, Korsør og Skælskør

Dette er et praktisk source catalog til Production Engine. Det skal ikke behandles som en statisk bogmærkeliste: kernesources kombineres med seed-kilder, der løbende opdager foreninger, virksomheder, skoler og andre lokale aktører.

**Prioritet**
- P0: breaking/drift, typisk push eller poll 1–5 min.
- P1: primære story-generators, typisk 15–60 min eller efter releaseplan.
- P2: lokal discovery/krydstjek, typisk 1–12 timer.

**Geo-kerne:** Slagelse, Korsør/Korsoer, Skælskør/Skaelskoer, Slagelse Kommune, kommunekode 330. Knowledge OS bør derudover mappe lokale aliaser som Antvorskov, Halsskov og Stigsnæs.

| Pri | Kilde | Område | Adgang | Brug |
|---|---|---|---|---|
| P0 | Politi Update – Sydsjællands og Lolland-Falsters Politi | Politi | RSS; medie-API kan søges | Akutte hændelser, trafik, efterlysninger |
| P0 | Politiets døgnrapporter og nyheder | Politi | Web/feed-monitor | Kriminalitet, kontroller, opfølgning |
| P0 | Slagelse Brand & Redning | Beredskab | Web-monitor | Brande, redning, øvelser |
| P0 | DMI Open Data | Vejr | API | Varsler, vind, lyn, hav/vandstand |
| P0 | Storebælt / Sund & Bælt trafikstatus | Trafik | Status-side, mail/SMS, monitor | Vindrestriktioner, lukninger, kø |
| P0 | Vejdirektoratet Trafikinfo | Trafik | Web/open-data hvor tilbudt | Uheld, kø, vejarbejde |
| P0 | DSB trafikinformation | Jernbane | Web-monitor | Forsinkelser og aflysninger |
| P0 | Banedanmark | Jernbane | Web/nyheder/projekter | Sporarbejde og projekter |
| P0 | Rejseplanen Labs / GTFS / SIRI | Kollektiv trafik | API/GTFS; licensvilkår | Realtid, ruter, aflysninger |
| P0 | Cerius driftsinfo | El | Web-monitor | Strømafbrydelser |
| P0 | Envafors | Forsyning | Web/nyheder/driftsinfo | Vand, varme og driftsforstyrrelser |
| P0 | AffaldPlus | Affald | Web/nyheder/SMS | Affaldsdrift og genbrugspladser |
| P0 | Agersø-Omø Færgerne / Stigsnæs | Færger | Web-monitor | Aflysninger og drift |
| P0 | Region Sjælland / Slagelse Sygehus | Sundhed | Web/nyheder | Drift, projekter og sundhedsnyheder |
| P1 | Slagelse Kommune – nyheder og presse | Kommune | Web/change monitor | Kommunale nyheder og projekter |
| P1 | Slagelse Kommune – dagsordener/referater | Kommunalpolitik | Mail + web-monitor | Sager før og efter beslutning |
| P1 | Slagelse Kommune – høringer | Plan/politik | Web-monitor | Høringer, frister og indsigelser |
| P1 | Slagelse Kommune – lokalplaner/kommuneplan | Plan | Web + Plandata | Byudvikling og byggeri |
| P1 | Plandata.dk | Plan/open data | REST/WFS/WMS | Lokalplaner og kommuneplanrammer |
| P1 | Slagelse Kommune – udbud/markedsdialog | Udbud | Web-monitor | Kommende indkøb og kontrakter |
| P1 | udbud.dk | Udbud | Search/monitor | Udbud, kontrakter, værdier |
| P1 | TED | EU-udbud | EU-data/feed | Store udbud og tildelinger |
| P1 | Slagelse Kommune – budget/regnskab | Økonomi | Web/PDF-monitor | Budgetter, merforbrug, besparelser |
| P1 | Slagelse Kommune – indkøbs-/leverandørdata | Økonomi | Web/download | Største leverandører og indkøb |
| P1 | Slagelse Kommune – jobs | Arbejde | Web/jobfeed | Rekruttering og ledelsesændringer |
| P1 | Folketingets åbne data | National politik | OData JSON/ATOM | Spørgsmål, bilag, udvalg, debatter |
| P1 | Retsinformation | Lovgivning | REST + ELI Atom/sitemap | Nye og ændrede regler |
| P1 | Statstidende | Jura/virksomhed | OpenAPI | Konkurser, tvangsauktioner, proklama |
| P1 | Retten i Næstved – retslister | Domstole | Web/PDF-monitor | Lokale straffe-, civil- og auktionssager |
| P1 | Ankestyrelsen | Tilsyn/klager | Afgørelsesmonitor | Kommunale tilsynssager |
| P1 | Planklagenævnet | Klage/plan | Afgørelsesdatabase | Plan- og byggesager |
| P1 | Miljø- og Fødevareklagenævnet | Klage/miljø | Afgørelsesdatabase | Miljø- og natursager |
| P1 | Folketingets Ombudsmand | Tilsyn | Afgørelser/nyheder | Principielle myndighedssager |
| P1 | Datatilsynet | Tilsyn | Afgørelser/nyheder | GDPR, brud og lokale myndigheder |
| P1 | Erhvervsstyrelsen / CVR | Virksomheder | Officiel API | Nye virksomheder, status og ledelse |
| P1 | Danmarks Statistik / StatBank | Statistik | API | Befolkning, bolig, erhverv, demografi |
| P1 | Jobindsats API v3 | Arbejdsmarked | API JSON/CSV | Ledighed og beskæftigelse |
| P1 | Dataforsyningen / Grunddata | Geodata | API | Adresser, steder, matrikler, områder |
| P1 | GEUS Jupiter | Miljø/vand | WFS/WMS/download/webservices | Grundvand, drikkevand og boringer |
| P1 | Danmarks Miljøportal / DMA | Miljø | Web/data services | Miljøgodkendelser og tilsyn |
| P1 | Kystdirektoratet | Kyst/klima | Web/data | Diger, højvand og kystbeskyttelse |
| P1 | Forsvaret / Gardehusarregimentet | Forsvar | Web/nyheder | Kaserne, øvelser, værnepligt |
| P1 | Korsør Havn | Havn/erhverv | Web/nyheder | Gods, investeringer og havnedrift |
| P1 | Skælskør Havn | Havn | Web-monitor | Havnedrift og aktiviteter |
| P1 | Storebælt / Sund & Bælt – nyheder/trafiktal | Infrastruktur | Web/download | Broprojekter, vedligehold og trafik |
| P1 | Slagelse Erhverv | Erhverv | Nyheder/nyhedsbrev | Lokale virksomheder og investeringer |
| P1 | DI Vestsjælland | Erhverv | Nyheder/Via Ritzau | Erhvervspolitik og lokale virksomheder |
| P1 | Via Ritzau | Pressemeddelelser | Public newsroom/search/RSS hvor muligt | Myndigheder, virksomheder og fonde |
| P1 | Ritzau nyhedstjeneste | Newswire | Licenseret feed/API | Bred nyhedsstrøm; kræver aftale |
| P2 | TV2 ØST | Regionalt medie | Web/RSS hvis tilbudt | Discovery og krydstjek |
| P2 | Sjællandske Nyheder / sn.dk | Lokalt medie | Web/RSS hvis tilbudt | Lokale historier og konkurrentovervågning |
| P2 | DR P4 Sjælland | Regionalt medie | Web/app/feed hvor lovligt | Discovery og breaking |
| P2 | DK Nyt | Kommunalmedie | Web/nyhedsbrev | Kommunale historier |
| P2 | 112news.dk | Lokalt nichemedie | Web-monitor | Politi, brand og ulykker |
| P2 | Slagelse.info / Slagelse.News / Korsor.News / Skaelskor.News | Lokalt medie | Web-monitor | Lokale historier og events |
| P2 | SlagelseJournalen | Lokalt medie | Web-monitor | Lokalt discovery |
| P2 | VORES-lokalsider | Aggregator | Web-monitor | Events, bolig og lokale signaler |
| P2 | SlagelsePortal | Lokal portal | Seed/monitor | Lokale links og discovery |
| P2 | Slagelse Bibliotekerne – arrangementer | Kultur/events | Struktureret web-monitor | Arrangementer i alle tre byer |
| P2 | Slagelse Kommune – foreningsoversigt (Winkas) | Foreninger | Seed directory | Opdag 300+ foreninger og deres websites |
| P2 | Slagelse Kommune – lokalrådsoversigt | Lokalsamfund | Seed directory | Lokale initiativer og møder |
| P2 | Kommunale folkeskoler | Skole | Seed + website-monitor | Skoleevents, ledelse, projekter |
| P2 | Privat- og friskoler | Skole | Seed + website-monitor | Lokale skolehistorier |
| P2 | Dagtilbud/private dagtilbud | Dagtilbud | Seed + selective monitor | Kapacitet, åbning/lukning, events |
| P2 | Professionshøjskolen Absalon – Campus Slagelse | Uddannelse | Web/nyheder/events | Uddannelse og studieliv |
| P2 | ZBC Slagelse | Uddannelse | Web/nyheder/events | Erhvervsuddannelse og arbejdsmarked |
| P2 | Slagelse Gymnasium | Uddannelse | Web/nyheder/events | Ungdom og uddannelse |
| P2 | Lokale kirker/sogne | Lokalsamfund | sogn.dk + officielle sider | Events, udnævnelser og fællesskab |
| P2 | Lokale idrætsforeninger | Sport | Winkas seed + klubwebsites | Kampe, resultater og faciliteter |
| P2 | Lokale kulturinstitutioner/spillesteder/teatre/biografer | Kultur | Seed + event-monitor | Program, events og bevillinger |
| P2 | Museum Vestsjælland / Trelleborg m.fl. | Kultur/historie | Web/nyheder/events | Arkæologi, kulturarv og events |
| P2 | Lokale virksomheders egne newsrooms | Virksomheder | CVR seed + website-monitor | Investeringer, fyringer, udvidelser |
| P2 | Officielle lokale sociale konti | Social signal | Officiel API/alerts/manual | Tidlige signaler; altid verificér |
| P2 | Mynewsdesk og andre PR-platforme | PR | Search/feed hvor tilladt | Lokale pressemeddelelser |


---

## Anbefalet source-arkitektur

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
- enabled
- lastSuccessAt
- lastFailureAt
```

`accessMode` bør mindst kunne være:

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

## Seed → discovery

Foreninger, skoler og virksomheder bør ikke oprettes manuelt én for én.

**Foreninger:** Slagelse Kommunes Winkas-oversigt bruges som seed. For hvert officielt website opdages RSS/Atom, sitemap, nyheds- og event-sider, som derefter bliver child sources.

**Lokalråd:** Kommunens officielle lokalrådsoversigt fungerer på samme måde.

**Skoler/institutioner:** Kommunens skole- og privatskoleoversigter bruges som seeds, hvorefter officielle nyheds- og kalendersider registreres.

**Virksomheder:** CVR bruges til at opbygge en lokal virksomhedspopulation. Prioritér større arbejdspladser, risikovirksomheder, havn/forsyning/infrastruktur, virksomheder med kommunale kontrakter og virksomheder med tydelig lokal betydning. Officielle newsrooms registreres som child sources.

## StoryCandidate-flow

```text
SourceItem
→ geo/entity match
→ dedupe
→ entity resolution
→ Knowledge OS lookup
→ authority assessment
→ StoryCandidate
→ Editorial Rating
```

Et nationalt dokument behøver ikke indeholde ordet “Slagelse” for at være lokalt. Hvis et CVR, en matrikel, en institution eller person er mappet til Slagelse i Knowledge OS, kan motoren stadig fange relevansen.

## Minimum gemt pr. source-hit

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
reuse/licence rule
```

## Jura og rettigheder

Åbne myndighedsdata hentes efter de konkrete API-/datavilkår og med provenance.

Medier som TV2 ØST, sn.dk og DR bør som udgangspunkt bruges til discovery, alerts, headline/link metadata og krydstjek. Systematisk kopiering eller genudgivelse af fulde artikler kræver rettigheder.

Skeln mellem **Via Ritzau** (offentlige pressemeddelelser/meddelelser) og **Ritzau nyhedstjeneste** (licenseret redaktionelt produkt).

Sociale platforme bør anvendes via officielle API'er, embeds, alerts eller manuel observation – ikke uautoriseret scraping.

## Første implementeringsprioritet

Start med Politi Update, politiets døgnrapporter, Slagelse Kommune, dagsordener, høringer/Plandata, udbud, Via Ritzau, Statstidende, Folketinget, Retsinformation, CVR, DST, Jobindsats, DMI, Storebælt, transport/forsyning, Region Sjælland og kommune-foreningsregisteret.

Målet er, at motoren ikke kun opdager en historie efter lokale medier. Den skal kunne skabe et StoryCandidate direkte fra primærdata, fx:

```text
kommunalt bilag
+ lokal CVR-entity
+ ny lokalplan/høring
+ tidligere Story i Knowledge OS
= potentielt lokalt scoop
```
