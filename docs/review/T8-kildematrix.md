# T8 - Kilde- og dækningsmatrix (by x kildetype), geo-mapping og scheduler-plan

Dato: 2. oktober 2026. Status: research, kun læst (ingen kildefiler ændret). Skrevet til ejeren af Lokalt-netværket.

Verifikationsregel i dette dokument: **"verificeret"** betyder, at jeg selv har hentet URL'en den 1.-2. oktober 2026 (HTTP-status/indhold set). **"ikke verificeret"** betyder, at URL/feed/licens er en hypotese eller kommer fra et sekundært sted. **Ingen kilde er vurderet som "frit genbrugelig".** Hver kilde skal have en skriftlig licens-/ToS-vurdering, før tekst gengives; indtil da gælder "link + egen kort faktaoverskrift", aldrig kopi af tredjepartstekst.

---

## 0. Vigtigste fund (læs først)

1. **DAWA er lukket (HTTP 410 Gone)** på `api.dataforsyningen.dk` og `dawa.aws.dk` (testet: `/postnumre/4200`, `/kommuner`, `/postnumre/reverse`, `/kommuner/0370`). aI-library bruger netop disse endpoints (functions/index.ts:1127, 1217, 2110, 2189, 2289; src/data/sourceDirectory.ts:487, 559). Alle postnummer-baserede overvågningssøgninger, kommunetaksonomien, vejr/luft og plan-reverse-geocoding er derfor ramt. Se T9. Denne matrix bruger derfor en **statisk postnummertabel** (afsnit 3), som skal erstattes af en versioneret JSON i repoet.
2. **Politikreds-mappingen i aI-library er forkert for Slagelse og Sorø.** Slagelse (0330) og Sorø (0340) ligger under *Sydsjællands og Lolland-Falsters Politi* (Ritzau publisherId 90594), ikke Midt- og Vestsjællands (functions/index.ts:1635-1638 mapper dem til `midt_vestsjaelland`). Bekræftet to veje: (a) Wikipedia-artiklerne om de to politikredse (sekundær kilde, bør tjekkes mod politi.dk), (b) feed 90594 indeholder faktisk meldinger om Slagelse og Korsør, feed 13562881 gør ikke.
3. **Politi-RSS fra politi.dk findes ikke længere på den dokumenterede URL** (`politi.dk/aktuelt/faa-politi-update-som-rssfeed` -> 404; `politi.dk/rss` -> 404). Den fungerende vej er **Via Ritzau short-messages** pr. politikreds (verificeret, 200 text/xml, 25 meldinger).
4. **Ritzau-bug bekræftet**: `.../latest&publisherId=...` giver 404 (HTML), `.../latest?publisherId=...` giver 200 RSS (begge testet). Detaljer i T9.
5. **Lokale medier blokerer AI-brug**: sn.dk's robots.txt forbyder GPTBot, ChatGPT-User, CCBot og anthropic-ai; tv2east.dk's robots.txt forbyder GPTBot, ChatGPT-User, ClaudeBot og Claude-Web. TV2 Øst har et fungerende RSS (verificeret, 20 elementer), men feedet må **kun bruges som link/overskrift-signal efter licensafklaring**, ikke som tekstgrundlag for AI.
6. **Fra politiet-modulet på forsiden viser signaler uden redaktionel godkendelse**, og `omraadeSlug` i modulets config bruges ikke i forespørgslen (cms/components/site/frontpage/data.ts:46-52). Se T7.
7. **Nationalt TV2-feed i aI-library er dødt**: `https://nyheder.tv2.dk/rss` -> 404 (src/services/syndicatedFeeds.ts:96).

---

## 1. Byer, kommunekoder og politikredse

| By / instans | Kommune (kode) | Dagsorden-portal i aI-library (agendaSources.ts) | Politikreds (Ritzau politi / anklager) | Instans i CMS-seed |
|---|---|---|---|---|
| Næstved | Næstved (0370) | `dagsordener.naestved.dk` | Sydsjællands og Lolland-Falsters Politi (90594 / 13563090) | ja (network-seed-data.ts) |
| Slagelse (+ Korsør, Skælskør, Agersø, Omø) | Slagelse (0330) | `dagsordener.slagelse.dk` | **Sydsjællands og Lolland-Falsters Politi (90594 / 13563090)** - ikke Midt- og Vestsjælland | ja (seed.ts) |
| Holbæk | Holbæk (0316) | `dagsordener.holbaek.dk` | Midt- og Vestsjællands Politi (13562881 / 13563089) | ja |
| Køge | Køge (0259) | `dagsordener.koege.dk` | Midt- og Vestsjællands Politi (13562881 / 13563089) | ja |
| Roskilde | Roskilde (0265) | `dagsordener.roskilde.dk` | Midt- og Vestsjællands Politi (13562881 / 13563089) | ja |
| Ringsted | Ringsted (0329) | `dagsordener.ringsted.dk` | Midt- og Vestsjællands Politi (13562881 / 13563089) | ja |
| Kalundborg | Kalundborg (0326) | `dagsordener.kalundborg.dk` | Midt- og Vestsjællands Politi (13562881 / 13563089) | **nej** (kun statisk prototype) |

Kilde for politikredse: Wikipedia (fetchet 2. okt. 2026): Midt- og Vestsjælland = Greve, Holbæk, Kalundborg, Køge, Lejre, Odsherred, Ringsted, Roskilde, Solrød, Stevns; Sydsjælland og Lolland-Falster = Slagelse, Sorø, Næstved, Faxe, Vordingborg, Guldborgsund, Lolland. **Skal bekræftes mod politi.dk**, før mapping hardkodes. Dagsorden-URL'erne står i src/config/agendaSources.ts (alle syv byer er med); `dagsordener.*` svarer 302 (session-redirect) ved direkte kald, så reel dækning kræver FirstAgenda-sessionen i functions/index.ts.

Politifeeds er pr. kreds, ikke pr. by: Ritzau-feedet har ingen geo-felter. Geo skal udledes af tekst (bynavn, vejnavn, postnummer) og dokumenteres som `geographyPrecision: 'mention'`.

---

## 2. Kildetype-matrix

Forkortelser: **AIL** = findes i aI-library (ja/delvist/nej + filreference). **Pri** = P1 (pilot Næstved), P2 (udrulning til alle byer), P3 (senere).

### 2.1 Overblik pr. kildetype

| # | Kildetype | AIL | Kandidatkilde (URL / type) | Verifikation | Licens / robots / ToS (skal afklares) | Opdateringsfrekvens | Pri |
|---|---|---|---|---|---|---|---|
| 1 | Kommune dagsorden/referat | **delvist**: `municipalitySearch/Meeting` (functions/index.ts:933-1139), `agenda_mentions` (:1371), portalliste src/config/agendaSources.ts + dublet functions/index.ts:429. Kun on-demand, ingen persistens | FirstAgenda-portal pr. kommune (`dagsordener.<kommune>.dk`), JSON bag session (scrape/API-lignende) | portal-URL'er står i kode; direkte kald giver 302; **JSON-flow ikke gen-testet af mig** | Offentligt myndighedsmateriale; dagsordener indeholder ofte persondata (navne, CPR-lignende sagsoplysninger, lukkede punkter). Skal verificeres: portalens vilkår, rate-grænser, om bilag er personhenførbare. Undgå at citere bilag med navne uden redaktionel vurdering | Møder: typisk 1-2 gange/md pr. udvalg. Dagsorden ca. 3-7 dage før mødet, referat/beslutning dage-uger efter | **P1** |
| 2 | Kommune pressemeddelelser/nyheder (RSS) | **nej** (kun Ritzau-pressemeddelelser generelt: `ritzau_releases`, :1727) | Roskilde: `https://www.roskilde.dk/da-dk/nyheder/rss/` (RSS 2.0). Øvrige: ingen auto-discovery-link på forsider; `/rss`, `/nyheder/rss`, `/nyheder.rss` giver 404 (Næstved, Slagelse, Holbæk, Kalundborg, Ringsted, Sorø); Køge giver 403 for min klient | **Roskilde verificeret** (200, 30 elementer, robots tillader alt). Resten **ikke verificeret / fundet** | Roskilde robots: `Allow: /`. Genbrugsret til tekst **ikke afklaret** (kommunens vilkår/ophavsret). Brug overskrift + link; kort resumé kun efter aftale | 1-5 nye/dag pr. kommune | **P1** (Næstved: find kilde; Roskilde: RSS klar) |
| 3 | Politi | **delvist**: `politiUpdateSearch` (:2441), `police` i `localMonitoringSearch` (:1571), Ritzau-kredsliste (:2400-2440), `src/services/ritzau.ts`, `politiUpdate.ts` | Via Ritzau short-messages: `https://via.ritzau.dk/rss/short-messages/latest?publisherId=<id>` (RSS 2.0). Næstved/Slagelse: 90594; Holbæk/Køge/Roskilde/Ringsted/Kalundborg: 13562881. Anklager: 13563090 / 13563089 | **Verificeret** (begge 200 text/xml, 25 meldinger). politi.dk/rss og politi.dk/aktuelt/faa-politi-update-som-rssfeed -> 404 | Via Ritzau robots: `Crawl-delay: 1`, `Disallow: /data/attachments/`. Meldingerne er politiets egne; videre brug/ophavsret **skal afklares** med Ritzau/politiet. Indeholder undertiden persondata ("navn fjernet" ses i efterlysninger). Se T7 om GDPR/injurie | Døgnet rundt; ca. 5-15 meldinger/dag/kreds. Feedet indeholder **dubletter** (samme titel to gange, set i begge feeds) | **P1** |
| 4 | 112 / beredskab / brandvæsen | **nej** (kun via politi-feed) | Brand-/redningsmeldinger optræder i politi-feedet ("Brand i Mern", "Gårdbrand i Roskilde" set 2. okt.). Selvstændig beredskabskilde: ikke fundet | Delvis dækning via politi verificeret. Eget beredskabsfeed **ikke verificeret** (kommunale brandvæsner/beredskabsfællesskaber har sjældent RSS; kræver kortlægning) | Ukendt. 112-hændelser har høj injurie-/privatlivsrisiko | Realtid | **P2** (kun via politi-feed i pilot) |
| 5 | Vejdirektoratet / trafik | **nej** | Vejdirektoratets Dataudveksler (DATEX II 3.2; portal `du-portal-ui.dataudveksler.app.vd.dk`) og trafikinfo. Statsveje/motorveje kun | Portalen svarer 200. Adgang kræver ifølge sekundær kilde (agentaccess.dk) abonnement/credentials; **ikke verificeret** direkte. Politi-feedet melder også vejspærringer ("Spor spærret på Holbækmotorvejen", 28. sep.) | Åbne data, men vilkår/nøgle **ikke verificeret**. Kommunale veje dækkes ikke | Minutter | **P1** (pilot, kræver registrering) |
| 6 | DMI varsler / vejr | **delvist**: vejr og luft via Open-Meteo (functions/index.ts:2102, 2181) - **ikke DMI** | DMI Open Data (metObs, climate, lightning, radar, forecast; verificeret på dmi.dk/friedata/dokumentation/apis) - **ingen dokumenteret varsel-API fundet**. MeteoAlarm Atom-feed for DK: `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-denmark` | MeteoAlarm-feed verificeret (200 Atom/CAP, lille svar = ingen aktive varsler på testtidspunktet). DMI-varsler direkte **ikke verificeret**. Open-Meteo gratis API er i princippet til ikke-kommerciel brug - **skal verificeres** før produktion | MeteoAlarm: attribution og vilkår **ikke verificeret**. DMI frie data: licens/nøgle **ikke verificeret** | Varsler: 10-15 min | **P2** |
| 7 | Retslister | **ja**: `retslisterSearch` (functions/index.ts:3301), `src/services/retslister.ts`, domstol-origin :3094 | domstol.dk retslister (via Umbraco-origin i koden); anklagemyndigheden.dk RSS-side findes (200) | `domstol.dk/retslister` giver **403 Cloudflare-challenge** ved almindeligt kald. **Må ikke omgås** (bot-beskyttelse). Anklagemyndighedens RSS-liste svarer 200, men feed-URL'er ikke udtrukket/verificeret | Offentlige retslister indeholder personnavne; GDPR + retsplejeloven (omtale af sigtede). Redaktør skal vurdere. ToS **ikke verificeret** | Retslister udkommer ca. ugentligt, dagligt opdateret | **P2** |
| 8 | Planer og høringer | **ja**: `plans` (WFS, :1231), `hearings` (:1536) | Høringsportalen Atom: `https://hoeringsportalen.dk/syndication/HearingsFeed`; Plandata WFS: `https://geoserver.plandata.dk/geoserver/wfs` | **Begge verificeret** (Atom 200 38 KB; WFS GetCapabilities 200 227 KB). Hørings-robots.txt: 404 | Offentlige data; vilkår for Plandata/Høringsportalen **ikke verificeret**. Persondata i høringssvar (borgere) - brug kun myndighedens oplysninger | Høringer: dagligt; planer: ugentligt | **P1** |
| 9 | Foreninger / klubber | **nej** (indsendte kalenderopslag via Indsend-værktøjet findes, ikke gennemlæst) | DBU (dbu.dk, 200), DGI (dgi.dk, 200), klubbernes egne sites og kommunale foreningsportaler. Ingen feeds verificeret | Kun forsiderne er set. Feeds/API **ikke verificeret**; kampprogram-data hos DBU kræver sandsynligvis aftale | Klubdata/resultater har typisk vilkår; ingen antagelse om genbrug. Brug hellere **foreningens egen indsendelse** (Indsend/Meddeler) | Kampe: ugentligt; opslag: ad hoc | **P3** |
| 10 | Lokale medier | **delvist**: TV2-regioner i `regional_news` (:1948, `tv2east.dk/rss`), `syndicatedFeeds.ts:154-160` | TV2 Øst RSS `https://www.tv2east.dk/rss`; Sjællandske Medier (sn.dk, Dagbladet mfl.): intet RSS fundet (`/rss` returnerer HTML); vdonline.dk ikke nået (timeout fra min klient); ugeaviser: ikke undersøgt | TV2 Øst **verificeret**. sn.dk/sjaellandske.dk **intet feed**. Andre **ikke verificeret** | **sn.dk og tv2east.dk forbyder AI-crawlere i robots.txt.** Brug aldrig fuldtekst som AI-input. Kun link + egen overskrift efter afklaring; ellers pressekontakt/licens | TV2 Øst: løbende | **P2** (headline-only) |
| 11 | Kultur / arrangementer | **delvist** (Indsend-kalender, ikke gennemlæst) | Kommunale kalendere og Visit-sites: visitholbaek.dk og visitkoege.dk svarer 200; visitnaestved.dk/visitslagelse.dk/visitroskilde.dk ikke nået. Ingen feeds verificeret | Kun forsider. **Ikke verificeret** | Ukendt; mange kalendere er leverandør-API'er med egne vilkår | Dagligt | **P3** |
| 12 | Erhverv (CVR) | **delvist**: `cvr` (functions/index.ts:1841) via `cvrapi.dk` | cvrapi.dk (uofficiel proxy) - **403 `QUOTA_EXCEEDED`** ved anonymt kald (testet). Officiel vej: Erhvervsstyrelsens CVR-adgang (virk.dk) | cvrapi: verificeret begrænsning. Officiel adgang **ikke verificeret** | Virksomhedsdata er offentlige, men ejer-/ledelsesdata er persondata; reklamebeskyttelse. cvrapi.dk kræver identificerende User-Agent og har kvoter | Nyregistreringer: dagligt | **P2** |
| 13 | Nationale feeds (kontekst) | ja (Ritzau, DR, Folketinget) | Ritzau releases `...releases/latest?publisherId=`, Folketinget ODA (`oda.ft.dk/api`, verificeret 200) | Verificeret | Vilkår pr. kilde | - | P3 |

### 2.2 By x kildetype - dækningsmatrix (nuværende -> mål)

Tegn: **J** = kilde findes og er verificeret for byen; **D** = delvist (kreds-feed, portal i kode, kræver geo-filtrering); **?** = ikke verificeret; **-** = ikke relevant / ikke oprettet.

| Kildetype | Næstved | Slagelse (+Korsør, Skælskør, øer) | Holbæk | Køge | Roskilde | Ringsted | Kalundborg |
|---|---|---|---|---|---|---|---|
| Dagsorden/referat | D (portal i kode) | D | D | D | D | D | D |
| Kommune nyheder RSS | ? (ingen fundet) | ? | ? | ? (403) | **J** (`/da-dk/nyheder/rss/`) | ? | ? |
| Politi (Ritzau-kreds) | D (90594) | D (**90594**, ikke 13562881) | D (13562881) | D (13562881) | D (13562881) | D (13562881) | D (13562881) |
| 112/beredskab | D (via politi) | D | D | D | D | D | D |
| Vejdirektoratet | ? (kræver konto) | ? | ? | ? | ? | ? | ? |
| DMI/MeteoAlarm | D (landsdækkende Atom) | D | D | D | D | D | D |
| Retslister | D (retskreds ikke kortlagt) | D | D | D | D | D | D |
| Planer/høringer | J (Plandata + Høringsportalen, kommunefilter) | J | J | J | J | J | J |
| Foreninger/klubber | ? | ? | ? | ? | ? | ? | ? |
| Lokale medier | D (TV2 Øst; sn.dk intet feed) | D | D | D | D | D | D |
| Kultur/arrangementer | ? | ? | J? visitholbaek.dk nået | J? visitkoege.dk nået | ? | ? | ? |
| Erhverv/CVR | D (cvrapi, kvoteramt) | D | D | D | D | D | D |

Retskredse (Retten i Næstved, Holbæk, Roskilde, Køge, Kalundborg ...) er **ikke kortlagt** og skal slås op, før retslister geo-tagges.

---

## 3. Småbyer -> GeoTag-slug og postnummer

Kilde for postnumre: da.wikipedia.org "Postnumre i Danmark" (fetchet 2. okt. 2026, **ikke verificeret mod officielt register**, fordi DAWA er nede). Kommunetilhørsforhold for enkelte småbyer er angivet efter bedste viden og **skal bekræftes**, før de bruges til automatisk routing. Eksisterende GeoTags er fra cms/prisma/seed.ts:10-19 (Slagelse) og cms/prisma/network-seed-data.ts (de øvrige).

**Vigtig teknisk konsekvens (cms/lib/ingest/signals.ts `resolveGeo`):** matching sker på `slug` eller `navn`; postnummer-fallback tjekker kun om slug er lig postnummeret, eller om navnet *indeholder* postnummeret. Ingen GeoTag-navne indeholder postnumre, så **postnummer-matching virker i praksis aldrig**. Og `geo.by = "Næstved"` rammer ikke "Næstved By" (slug `naestved-by`). Adapteren i aI-library skal derfor sende **den præcise GeoTag-slug** i `geo.omraade`, eller CMS'et skal have et felt for postnumre/aliaser pr. GeoTag (forslag i T7).

### 3.1 Næstved (instans naestvedlokalt.dk)

| Område | GeoTag-slug | Postnr | Status |
|---|---|---|---|
| Næstved By | `naestved-by` | 4700 | findes |
| Karrebæksminde | `karrebaeksminde` | 4736 | findes |
| Fuglebjerg | `fuglebjerg` | 4250 | findes |
| Glumsø | `glumsoe` | 4171 | findes |
| Fensmark | `fensmark` | 4685 | findes |
| Holme-Olstrup | `holme-olstrup` | 4684 (Holmegaard) | findes |
| Mogenstrup | `mogenstrup` | 4742 | findes |
| Tappernøje | `tappernoeje` | 4733 | findes |
| **Mangler (kandidater)** | `herlufmagle` 4160, `sandved` 4262, `hyllinge` 4263, `lov` 4741, `sneslev` 4172, `holmegaard` 4684, `rislev`/`aastrup` (postnr ikke slået op), `naesby` (ligger i 4700) | | tilføj efter bekræftelse |

### 3.2 Slagelse (instans slagelselokalt.dk)

| Område | GeoTag-slug | Postnr | Status |
|---|---|---|---|
| Slagelse By | `slagelse-by` | 4200 (4201, 4202 Slagelse Syd) | findes |
| Korsør | `korsoer` | 4220 (4221, 4222) | findes |
| Skælskør | `skaelskoer` | 4230 (4231) | findes |
| Dalmose | `dalmose` | 4261 | findes |
| Vemmelev | `vemmelev` | 4241 | findes |
| Boeslunde | `boeslunde` | 4242 | findes |
| Agersø | `agersoe` | 4244 | findes |
| Omø | `omoe` | 4245 | findes |
| **Mangler** | `sorbymagle` 4216, `kirke-stillinge` 4215, `rude` 4243, `antvorskov` (refereres i seed.ts:1261, men findes ikke i `areas`-listen - **rettelse nødvendig**), `slagelse-syd` 4202, evt. `flakkebjerg`, `hemmeshoej` (postnr ikke slået op) | | tilføj |

### 3.3 Holbæk (instans holbaeklokalt.dk)

Findes: `holbaek-by` 4300, `jyderup` 4450, `toelloese` 4340, `svinninge` 4520, `vipperoed` 4390, `regstrup` 4420, `moerkoev` 4440, `oroe` 4305.
Mangler (kandidater): `tuse` 4306, `ugerloese` 4350, `undloese` 4341, `store-merloese` 4370, `knabstrup` 4430, `kirke-eskilstrup` 4360, `gislinge` 4532, `holbaek-oest` 4301, `skarridsoe` (nævnt i artikel-seed, ikke GeoTag).

### 3.4 Køge (instans koegelokalt.dk)

Findes: `koege-by` 4600, `koege-nord`, `herfoelge` 4681/4686, `borup` 4140/4141, `ejby`, `bjaeverskov` 4632/4633, `vemmedrup`, `algestrup`.
Mangler (kandidater): `lille-skensved` 4623/4624, `oelby-lyng` 4607, `lellinge` 4631, `oerslev` 4634 (kommune ikke bekræftet). Bemærk `ejby` findes både som 4050 (Skibby) og som landsby ved Køge; postnummeret skal afgøres.

### 3.5 Roskilde (instans roskildelokalt.dk)

Findes: `roskilde-by` 4000, `trekroner`, `jyllinge` 4040/4041, `viby-sjaelland` 4130/4131, `svogerslev` 4015, `vindinge` 4025, `gundsoemagle`, `gadstrup` 4621.
Mangler (kandidater): `tune` 4030, `hyrdehoej` 4012, `osted` (postnr ikke bekræftet), `roskilde-oest` 4014. Lejre-området (Lejre 4320, Hvalsø 4330, Kirke Hyllinge 4070) hører til Lejre Kommune og er ikke dækket af nogen instans.

### 3.6 Ringsted (instans ringstedlokalt.dk)

Findes: `ringsted-by` 4100, `benloese` 4102, `jystrup` 4174, `vetterslev`, `kvaerkeby` 4150, `hoem`, `sigersted`, `vigersted`.
Mangler (kandidater): `fjenneslev` 4173, `oerslev` 4116, `haraldsted`, `allindemagle`, `nordrup` (postnumre ikke slået op).

### 3.7 Kalundborg (ingen instans)

Hele instansen og alle GeoTags mangler. Kandidater: `kalundborg` 4400/4401/4403, `gorlev` 4281, `hoeng` 4270/4271, `svebolle` 4470, `ruds-vedby` 4291, `store-fuglede` 4480, `raklev` 4402, `ulstrup` 4407, `roerby` 4405, `reersoe` 4285, `sejeroe` 4592, `skellebjerg` 4292, `jerslev-sjaelland` 4490. Kommunetilhør skal bekræftes pr. by.

### 3.8 Foreslået tabel til repoet

Opret en versioneret fil (fx `shared/geo/sjaelland.json`) med `{ postnr, navn, kommuneKode, instans, geoTagSlug, lat, lng }`, genereret af et script fra et officielt register og gennemgået manuelt. Både aI-library-adapteren (T7) og CMS-seed bruger den som eneste sandhed.

---

## 4. Prioritering

- **P1 (pilot Næstved):** kommune dagsorden/referat (Næstved), politi (Ritzau 90594, geo-filtreret på Næstved-kommunens byer), Vejdirektoratet (kræver adgang), høringer + planer (filter på 0370), Roskilde-RSS som referenceimplementering for kommune-feed.
- **P2 (alle syv byer):** kommune-nyheder (find kilde pr. by; Køge kræver bot-afklaring), 112/beredskab, MeteoAlarm/DMI, retslister (efter ToS-afklaring), CVR (officiel adgang), lokale medier headline-only (efter licens).
- **P3:** foreninger/klubber, kultur/arrangementer, nationale feeds.

---

## 5. Scheduler-plan (Railway Cron eller Cloud Scheduler)

### 5.1 Anbefaling

**Primær: Firebase Functions v2 `onSchedule` (Cloud Scheduler)** i aI-library, fordi hentekoden, FirstAgenda-sessionen, Ritzau-parsing og secrets allerede bor i `functions/`, og fordi det eksisterende `localMonitoringSearch` er en `onCall` bag `requireAccess` (functions/access.ts) og derfor **ikke kan kaldes af en cron** uden bruger. Hentelogikken skal trækkes ud af callable'en til rene funktioner (`fetchPoliceItems` mv. tager i dag `params` og kan genbruges), som både callable og scheduler kalder.
**Alternativ: Railway Cron-service** i Knowledge-projektet, der kører et Node-script til ende og afslutter. Fordel: tæt på Postgres (Knowledge), kan dele dedupe-tabel. Ulempe: hentekoden skal duplikeres eller flyttes, og Railway Cron har (efter Railways dokumentation, ikke gen-verificeret) minimum 5 minutters interval og springer en kørsel over, hvis den forrige stadig kører.
Valg: Cloud Scheduler til hentning, Knowledge via HTTP (ingest). Dedupe-lageret i Firestore (aI-librarys eget), så Knowledge ikke bliver kritisk sti.

### 5.2 Kadence pr. kildeklasse

| Klasse | Kadence | Bemærkning |
|---|---|---|
| Politi (Ritzau short-messages, 2 feeds i pilot) | hver 5. min kl. 06-23, hver 10. min natten | Betinget GET (`If-None-Match`/`If-Modified-Since`), hvis feedet understøtter det (**ikke verificeret**); `Crawl-delay: 1` overholdes; 1 forespørgsel ad gangen pr. host |
| Trafik (Vejdirektoratet) | hver 2-5 min | Foretræk push/AMQP via Dataudveksleren, hvis tilbudt; ellers poll |
| MeteoAlarm/DMI-varsler | hver 15 min | Skift kun ved nyt/ændret varsel-id |
| Kommune-nyheder RSS | hver 30 min dagtimer, hver time om natten | Roskilde først |
| Dagsorden: opdagelse | dagligt kl. 06:00 og 12:00 | Lister kommende møder (7 dage frem) og nylige (14 dage tilbage) |
| Dagsorden: overvågning | hver time for møder inden for -14/+3 dage; hver 6. time ellers | Skifter til timevis polling efter mødedato for at fange referat |
| Høringsportalen / Plandata | 2 gange dagligt / dagligt | |
| Lokale medier (headline-only) | hver 15 min | Kun efter licens-OK |
| Retslister | dagligt + fredag formiddag | Ingen omgåelse af bot-beskyttelse |
| CVR nyregistreringer | dagligt kl. 05:00 | Officiel adgang |
| Foreninger/kultur | dagligt | |

### 5.3 Fejlhåndtering og backoff

- Pr. kilde en post i `monitorSources/{sourceKey}`: `etag`, `lastModified`, `lastSuccessAt`, `consecutiveFailures`, `nextRunAt`, `state` (ok / degraded / down).
- Backoff: `delay = min(base * 2^failures, 6 timer) + jitter(0-20 %)`; respektér `Retry-After`; 404 på et feed, der tidligere virkede, = *struktureret fejl* (ikke "0 resultater"), så Ritzau-`&`-fejlen og døde feeds ikke tolkes som "intet nyt".
- Circuit breaker: 5 fejl i træk -> `down`, alarm til redaktionen/ejeren, genprøv hver 6. time.
- Valider altid svaret (RSS: indeholder `<rss`/`<feed`, content-type; HTML-respons = fejl).
- Identificerende User-Agent med kontaktadresse (ikke "Mozilla"-forklædning), `robots.txt` cachet 24 t og håndhævet; ingen omgåelse af Cloudflare/bot-beskyttelse.
- Idempotent kørsel: hver kørsel har `runId`; en kørsel, der fejler midtvejs, kan gentages uden dubletter (dedupe + CMS-idempotens).

### 5.4 Persistent dedupe-lager

Firestore (eller Postgres) `monitorItems/{sha1(sourceKey + '|' + stableId)}`:

```
{ sourceKey, stableId, contentHash, firstSeenAt, lastSeenAt, phase,        // 'dagsorden' | 'referat' | null
  incidentClusterId, instances: { naestved: { cmsId, externalId, version, postedAt, status } },
  knowledge: { sourceId, ingestedAt } }
```

- TTL 90 dage for nyheder/politi; ingen TTL for dagsordenpunkter (tidsserie).
- Dedupe-nøgle pr. kilde: Ritzau = `guid` (URL med numerisk id); dagsorden = `kommunekode:mødeId:punktId`; RSS = `guid` eller normaliseret link; Høring = Atom `id`.
- Rene dubletter i selve feedet (set i Ritzau: samme titel to gange) fjernes på `normalize(title) + pubDate-minut`.

### 5.5 Ændringssporing dagsorden -> referat

- Identitet er **punktet**, ikke dokumentet: `agenda:<kommunekode>:<mødeId>:<punktId>`. Samme `externalId` bruges for dagsorden og referat, så CMS'et opdaterer signalet (version + 1) frem for at oprette et nyt.
- `contentHash = sha1(titel + sagsnr + beslutning + sorteret bilagsliste)`; ændret hash + `phase`-skift (beslutning udfyldt) -> post som opdatering med tekst "Referat foreligger: ...".
- Kendte huller: CMS nulstiller ikke `laest` ved opdatering, så redaktionen ser ikke, at et læst signal er ændret (forslag i T7).

### 5.6 Dedupe af samme hændelse på tværs af kilder

Samme uheld kan optræde i politi-feed, Vejdirektoratet, TV2 Øst og kommunens side. Lag:
1. **Kilde-intern dedupe** (afsnit 5.4).
2. **Hændelsesklynge** i aI-library før CMS-kald: `incidentKey = hash(kategori, geoCelle (postnr eller vejnavn+km), tidsbøtte på 60 min)`; ordnet efter kildens autoritet (politi/beredskab > Vejdirektoratet > kommune > medie). Primær kilde bliver signalet; øvrige kilder tilføjes som linjer i `braedtekst` ("Også omtalt: ..."), fordi CMS-kontrakten kun har ét `kildeUrl`.
3. **CMS' egen dedupe** på `(instans, externalId)` og normaliseret `kildeUrl` er sidste sikkerhedsnet, ikke klyngelogik.
4. Klynger gennemgås med sampling (menneske) de første to uger for at finjustere tidsbøtte og geo-celle.

### 5.7 Overvågning af selve schedulerne

Dashboard `monitorSources` (sidst OK, fejlrate, nye elementer 24 t, kø-dybde for CMS-outbox); alarm hvis en P1-kilde ikke har haft succes i 3 x kadencen; ugentlig dækningsrapport pr. by ("kilder der svarede / kilder der ikke gjorde") i tråd med aI-librarys princip "ingen falsk fuldstændighed".

---

## 6. Åbne punkter, der kræver et menneske

1. Skriftlig licens-/ToS-afklaring pr. kildeklasse (kommuner, Ritzau/politi, TV2 Øst, Sjællandske Medier, domstol.dk, Vejdirektoratet, DMI/MeteoAlarm, CVR).
2. Bekræft politikredsmapping mod politi.dk, især Slagelse/Sorø.
3. Find (eller bed om) RSS/feeds fra Næstved, Slagelse, Holbæk, Køge, Ringsted og Kalundborg kommuner.
4. Registrer til Vejdirektoratets Dataudveksler og Erhvervsstyrelsens CVR-adgang.
5. Udskift DAWA med en statisk, versioneret postnummertabel (afsnit 3.8).
6. Opret Kalundborg-instans og manglende GeoTags (afsnit 3).
