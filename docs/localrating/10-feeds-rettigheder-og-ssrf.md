# 10 – Feeds, parser-strategi, SSRF-forsvar og `rightsLevel`-håndhævelse

Dato: 2. oktober 2026 (opdateret 3. oktober 2026 med kilderegistrene for Næstved og Slagelse, **§11**). Status: Fase 0 (design). **Kilde-laget er nu et register som data:** `FeedSource`/`FeedItem` hedder `SourceDefinition`/`SourceItem` og styres af ejerens kilderegistre (`source-registries/`, se §11 og ADR-015); "feed" i dette dokument betyder en `SourceDefinition` med `accessMode` `RSS`/`ATOM`/`API`/…. Kilder: plan beslutning 5; `docs/review/T8-kildematrix.md` (§0 fund 5, §2, §3, §5); `docs/review/T7-agent-integration-design.md` §5; Y: `sireRoute.ts:951-1166,5693-5755,4078-4248`, `feedService.ts`, `types/content-intelligence.ts:1-31`; CMS: `lib/validation/text.ts:84-100`, `lib/ingest/schema.ts:13-28`.

## 1. Feed-typer og `accessMode`

> Kilderegistrene indfører `accessMode` (`API`, `RSS`, `ATOM`, `EMAIL`, `WEBHOOK`, `HTML_MONITOR`, `SITEMAP`, `LICENSED_FEED`, `MANUAL`, `SEED_DIRECTORY`) som erstatning for det tidligere `type`-felt. Tabellen herunder er stadig korrekt for de typer der allerede var med; **nye ift. forrige udkast:** `HTML_MONITOR` (ændringsdetektion/liste-udtræk fra en *konfigureret* URL med typet `parserConfig` – ikke generisk scraping; kræver HTML-parser, D9), `LICENSED_FEED` (Ritzau, `blocked` til licens), `SEED_DIRECTORY` (kataloger der producerer child sources, §11d). Mapping fra registrenes "Adgang"-tekst: §11a.

| Type | Status v1 | Beskrivelse |
|---|---|---|
| `RSS` | **Ja** | RSS 0.9x/1.0/2.0; auto-detekteres af parseren (typen er en kilde-egenskab til UI/validering) |
| `ATOM` | **Ja** | Atom 1.0 (fx Høringsportalen, MeteoAlarm) |
| `MANUAL` | **Ja** | Redaktøren indsætter en URL/tekst som enkelt `SourceItem` ("opret kandidat fra link"); ingen polling |
| `SITEMAP` | Senere (Fase 2b) | News-sitemap (`<news:news>`), kun hvis rights tillader; samme `safeFetch` |
| `API` | **Fase 2 (bølge B/C, §11g)** | Typede adaptere (`parserType`: `json-api`, `odata`, `wfs`, `gtfs`, `datex2`, `cvr`): Retsinformation, Folketinget (ODA), Statstidende, DST, DMI, Plandata, TED, Rejseplanen, Vejdirektoratet m.fl. (kræver typet adapter + vilkår/evt. nøgle); *ingen generisk "scrape HTML"* |
| `WEBHOOK` | Senere | Indgående push (signeret, `LOCALRATING_WEBHOOK_SECRET`); ikke polling. Hvilke kilder der tilbyder push er uverificeret (§11f) |
| `EMAIL` | Reserveret | Spec §8; kræver indgående e-mail (ny infrastruktur, D30). Registrenes "mail/SMS/nyhedsbrev" noteres i `parserConfig.altAccess` og bruges ikke i v1 |
| `HTML_MONITOR` | **Fase 2 (bølge A)** | Ændringsdetektion og overskrift-/link-udtræk fra en konfigureret URL (`html-change`, `html-list`, `pdf-monitor`); gemmer kun metadata/uddrag efter rights; kræver `cheerio` (D9) |
| `LICENSED_FEED` | Senere (A: licens) | Ritzau nyhedstjeneste; `rightsLevel=blocked` til licens (§11b) |
| `SEED_DIRECTORY` | Fase 2 (bølge E) | Foreningsportal/Winkas, lokalråd, skoler, CVR-seed: poller ikke selv, producerer child sources (§11d) |

`SourceDefinition.sourceType` (`SOURCE_TYPES`, `lib/ingest/schema.ts:13-24`) beskriver *hvad* kilden er (registrets `sourceClass` er en finere inddeling; `sourceType` afledes af den, §11a); `AI_RESTRICTED_SOURCE_TYPES` (`politi`, `beredskab_112`, `:28`) udløser AI-udkast-spærring i pipeline og i `createIngestDraft`.

## 2. Parser-strategi (ADAPT af Y, `sireRoute.ts:1110-1166`)

Parseren får **bytes fra `safeFetch`** (aldrig en URL – ingen `parseURL`), så al netværk går gennem SSRF-laget.

1. **Hærdning før parsing:** fjern `<!DOCTYPE …>` inkl. intern subset (XXE/entitetsudvidelse), afvis > 5 MB, cap ≤ 500 items, cap pr. felt (titel 500, beskrivelse 20.000, indhold 100.000 tegn).
2. **Lag 1 – `rss-parser`** (`parseString`) med `customFields` (`content:encoded`, `dc:description`; Y `:958-964`).
3. **Lag 2 – saneret XML:** ret løse `&` og `<` (Y's regex `:1155-1157`) og forsøg igen.
4. **Lag 3 – "loose" sax** (`strict:false`, tag-/attributnavne i små bogstaver; Y `:975-987`).
5. **JSON-feed** (`application/feed+json`, `application/json` med `items[]`) som lag 0 for `API`/JSON Feed.
6. Alle lag fejler ⇒ `ParseError` ⇒ `IngestionLog.outcome=parse_failed`, kilde `degraded`. Parser-valg logges (`parserUsed`).
7. **Droppet fra Y:** site-specifikke scrapere (JP, TBIJ, `:991-1092`), URL-omskrivninger (`:1037-1108`), "slowAES"/`vm.runInContext`-udfordringsløser (`:1127-1152`), cheerio-scraping af vilkårlige sider som kilde (`:6105-~6380`).
8. **Feed-discovery** (Fase 2): `GET <side>` via `safeFetch` (HTML ≤ 1 MB) → `link[rel=alternate][type=application/(rss|atom)+xml]` med `cheerio`. Fra en URL redaktøren indtaster **eller** (nyt) fra officielle websites i godkendte seed-kataloger i det ugentlige discovery-job (§11d, undtagelsen S16b); ingen web-søgning (Y brugte DuckDuckGo, `:2171-2275`). `cheerio` er en ny afhængighed *kun* til denne funktion – ejerbeslutning; uden den kan en minimal regex-baseret `<link>`-udtrækker bruges.
9. **Kvalitetsgate** `hasRealFeedContent` (Y `:1598-1649`) pr. kilde (`qualityGate: strict | lenient | headline_only`): tekniske mønstre afvises altid; `strict` kræver bl.a. `titel ≥ 8`, `url` http(s), og (hvis brødtekst er tilladt) `text ≥ 90`, `body ≥ 100`, `≥ 18 ord`, sætningstegn; `lenient` kun titel+URL; `headline_only` (default for `metadata_only`) kun titel+URL+dato. Domænespecifikke undtagelser (Y `:1599,:1623-1634`) droppes.

## 3. SSRF-forsvar: konkret regelsæt (`lib/localrating/fetch.ts`)

**Trusselsmodel:** (a) en redaktør (eller kompromitteret konto) opretter en feed-URL der peger mod interne mål; (b) en legitim feed svarer med redirect til internt mål; (c) DNS-rebinding; (d) store/langsomme/komprimerede svar; (e) feed-indhold med URL'er (`item.link`, `enclosure`) som *aldrig* hentes server-side i v1. Y har ingen forsvar: åbne, uautentificerede hentninger (`sireRoute.ts:2128-2131,2171,4078,5693`; `sourceService.ts:64`; `scraperService.ts:11`).

**Mål der skal beskyttes** (ikke udtømmende): `*.railway.internal` (CMS, Postgres, Redis, cron-service), `169.254.169.254` og andre metadata-endepunkter, loopback, private net.

### Regler (alle håndhæves i `safeFetch`, og for **hver** redirect-hop)

| # | Regel |
|---|---|
| S1 | **Kun `http:` og `https:`**. Afvis `file:`, `ftp:`, `gopher:`, `data:`, `javascript:` m.fl. |
| S2 | **Ingen userinfo** i URL (`http://evil@127.0.0.1/`). |
| S3 | **Port-allowlist:** 80 og 443 (konfigurerbar liste for undtagelser, fx 8080 – default tom). |
| S4 | **Værtsnavn normaliseres** (lowercase, punycode/IDNA, fjern afsluttende punktum). Afvis `localhost`, `*.localhost`, `*.local`, `*.internal`, `*.lan`, `*.railway.internal`, `metadata.google.internal` og kendte metadata-navne. |
| S5 | **IP-literaler** (også decimal/oktal/hex/blandet: `2130706433`, `0x7f.1`, `017700000001`, `[::ffff:127.0.0.1]`) parses til kanonisk adresse og valideres som i S6. |
| S6 | **DNS: slå alle A/AAAA op** (`dns.lookup(host, { all: true, verbatim: true })`). Afvis hvis **nogen** adresse er i et blokeret område: IPv4 `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10` (CGNAT), `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.88.99.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`, `255.255.255.255`; IPv6 `::/128`, `::1/128`, `::ffff:0:0/96` (tjek indlejret IPv4), `64:ff9b::/96` (NAT64; tjek indlejret IPv4), `100::/64`, `2001::/32` (Teredo), `2001:db8::/32`, `2002::/16` (6to4; tjek indlejret IPv4), `fc00::/7`, `fe80::/10`, `fec0::/10`, `ff00::/8`. |
| S7 | **Forbind til den validerede adresse (pinning):** brug `node:https`/`node:http` med custom `lookup` der returnerer den allerede validerede IP (ingen andet DNS-opslag mellem tjek og forbindelse ⇒ DNS-rebinding/TOCTOU lukket); send `Host` og TLS-SNI = oprindeligt værtsnavn (`servername`). Ingen ny afhængighed nødvendig (undici-`Agent` er ikke eksponeret via global `fetch`). |
| S8 | **Redirects manuelt:** `redirect: manual`; maks 5; hver `Location` resolves mod nuværende URL og **gennemgår S1-S7 igen**; afvis `https → http`-nedgradering; afvis skemaskift til andet end http(s). |
| S9 | **Størrelse:** `maxBytes` 5 MB (feed) / 1 MB (HTML-discovery); læs som strøm og afbryd ved loftet; `Content-Length` > loft ⇒ afvis før læsning. |
| S10 | **Komprimering:** accepter kun `gzip`/`deflate`; `maxDecompressedBytes` (`zlib` `maxOutputLength`) ⇒ gzip-bombe afvises. |
| S11 | **Tid:** forbindelses-timeout 5 s, samlet timeout 15 s (`AbortController` + hård race, som `withTimeout`, `lib/resilience.ts:141`); langsomme/hængende svar (slow-loris) afbrydes. |
| S12 | **Content-Type-allowlist** (feed: `application/(rss|atom)\+xml`, `application/xml`, `text/xml`, `application/(feed\+)?json`, `text/plain`; discovery: `text/html`). Andet ⇒ `content_type`-fejl uden at læse body. |
| S13 | **Ingen cookies, ingen credentials:** ingen cookie-jar, ingen `Authorization`/`Cookie`-headers videresendt; `Set-Cookie` ignoreres. |
| S14 | **Ærligt User-Agent** (§4); ingen forklædning. |
| S15 | **robots.txt** (§4) før første hentning pr. origin; `Crawl-delay` overholdes; ét samtidigt kald pr. host; globalt loft 6. |
| S16 | **Ingen server-side hentning af URL'er fra feed-indhold** (`item.link`, `enclosure`, billeder). `SourceItem.url` gemmes og vises som link; kun redaktøren åbner den. (Y henter `item.url` fra feed: `sireRoute.ts:6529-6550` – droppet.) **Eneste undtagelse S16b:** discovery-jobbet henter officielle websites fra *godkendte* seed-kataloger (§11d) under alle øvrige S-regler og med faste lofter. |
| S17 | **Valgfri streng tilstand:** `LOCALRATING_FEED_HOST_ALLOWLIST` (kommaseparerede domænesuffikser). Sat ⇒ kun disse værter tillades (efter S1-S8). Default usat. |
| S18 | **Auditér og begræns:** oprettelse/ændring af feed-URL kræver `production.manage` + rate limit (`guardAdminAction`); URL'en valideres med `safeFetch`-"test" før `enabled=true`; blokerede forsøg logges som `IngestionLog.outcome=blocked_ssrf` (uden at gengive intern IP/respons til brugeren – kun kode). |

**Fejlkoder** (`FetchErrorCode`, `04-…` §2.1): `scheme, userinfo, port, host_blocked, dns, ip_blocked, redirect_limit, redirect_blocked, too_large, timeout, content_type, http_error, tls, robots, network`.

**SSRF-testsuite** (`tests/localrating-fetch-ssrf.test.ts`, med scriptet `DnsResolver` og `fetchImpl`/lokal testserver – intet rigtigt netværk):
1. `file://`, `ftp://`, `gopher://`, `data:`; 2. `http://user@127.0.0.1`; 3. `http://127.0.0.1`, `http://localhost`, `http://[::1]`; 4. decimal/oktal/hex IP (`2130706433`, `0x7f000001`, `017700000001`, `127.1`); 5. `http://169.254.169.254/latest/meta-data/`; 6. `http://metadata.google.internal`; 7. `http://lysdalcms.railway.internal:3000`; 8. alle private IPv4/IPv6-områder i S6 (parametriseret); 9. IPv4-mapped IPv6 (`::ffff:10.0.0.1`), NAT64, 6to4, Teredo med indlejret privat adresse; 10. **DNS-rebinding:** resolver returnerer offentlig IP første gang og `127.0.0.1` anden gang ⇒ forbindelsen sker til den *validerede* første IP, ikke den anden; 11. DNS returnerer blandet [offentlig, privat] ⇒ afvist; 12. redirect (301/302/307/308) til `http://169.254.169.254` og til `http://localhost`; 13. redirect-kæde > 5; 14. redirect `https → http`; 15. redirect til `file:`; 16. ikke-standardport (22, 6379, 5432, 8080); 17. svar > `maxBytes` (Content-Length og uden); 18. gzip-bombe (lille komprimeret, enorm udpakket); 19. slow-loris/hængende forbindelse ⇒ timeout; 20. forkert Content-Type (`image/png`, `application/octet-stream`); 21. `Set-Cookie` ignoreres, ingen `Cookie`-header sendes; 22. XML med `<!DOCTYPE … <!ENTITY …>>` (XXE/billion laughs) ⇒ DOCTYPE fjernet/afvist; 23. feed hvis `item.link` peger på intern IP ⇒ gemmes som tekst, **aldrig hentet**; 24. værtsnavn med unicode/homoglyf/punycode; 25. tilladelsesliste-tilstand (S17); 26. **discovery (S16b):** `DISCOVER_HOST` henter kun URL'er fra godkendte seed-poster, aldrig fra ikke-godkendte seeds eller fra almindelige `SourceItem`-links; seed-post med `http://169.254.169.254`/`localhost` som "officielt website" afvises af S1-S8 og logges `blocked_ssrf`; loft 300 værter/kørsel og 5 sider/vært overholdes. **Alle** skal fejle lukket uden at gengive intern respons.

## 4. User-Agent og robots.txt

- **User-Agent** (ærligt, ingen Googlebot/browser-forklædning; plan beslutning 5): `LokaltCMS-LocalRating/1.0 (+https://<instansens domæne>/; kontakt: <LOCALRATING_CONTACT_EMAIL>)`. Uden `LOCALRATING_CONTACT_EMAIL` hentes der ikke (T8 §5.3 "identificerende User-Agent med kontaktadresse"). Y bruger `Mozilla/5.0 … Chrome/126` (`sireRoute.ts:951-957`) og `Googlebot/2.1` (`:4092,:4165`; `scraperService.ts:14`) – **forbudt** her.
- **robots.txt** (`robots.ts`): hentes via `safeFetch`, caches 24 t pr. origin, parses for tokenet `LokaltCMS-LocalRating` (ellers `*`). `Disallow` for feed-stien ⇒ `skipped_robots` (kilden markeres `degraded`, redaktøren ser årsag). `Crawl-delay` overholdes (Ritzau: 1 s, T8 §2.1 pkt. 3). Manglende robots.txt (404) = tilladt.
- **AI-fjendtlige kilder:** hvis robots.txt forbyder kendte AI-agenter (fx `anthropic-ai`, `ClaudeBot`, `GPTBot`, `CCBot`) sættes `SourceDefinition.aiHostile=true` (T8 §0 fund 5: sn.dk og tv2east.dk). Konsekvens: `rightsLevel` kan ikke hæves over `metadata_only` uden `production.rights.manage` + begrundelse i `rightsNote`; AI må højst se overskrift.

## 5. `rightsLevel`-håndhævelse

Niveauer (`types/content-intelligence.ts:1-6` i Y; **håndhævet** her): `metadata_only` (default) · `snippet_allowed` · `fulltext_allowed` · `licensed` · `blocked`.

| Niveau | Må lagres | Rå payload (`rawPayload`) | AI-input (`aiInput`) | Generering | Citater/ordret | Hent artikelside |
|---|---|---|---|---|---|---|
| `blocked` | **intet** (kilde auto-deaktiveret; ingen hentning) | – | – | – | – | nej |
| `metadata_only` | titel, URL, `publishedAt`, kildenavn | kun `{guid, link, pubDate}` – ingen tekstfelter | `headline` | Kan **ikke** være tekstgrundlag; kun `supporting` reference/link; kandidat kan oprettes | ingen | nej |
| `snippet_allowed` | + beskrivelse ≤ 500 tegn | uden `content:encoded`/lange felter | `snippet` | Må bruges som faktagrundlag med attribution (ikke eneste kilde til påstande om skyld/penge) | ordret ≤ 15 sammenhængende ord, kun med kilde | nej |
| `fulltext_allowed` | + feed-fuldtekst ≤ 8.000 tegn | fuld item (kappet 64 KB) | `fulltext` | Må omskrives med attribution; overlap-værn (`06-…` §5.1) | ordret ≤ 25 ord pr. citat, kun med kilde | kun hvis robots tillader og kilden har `fetchArticle=true` (opt-in, **ikke i v1**) |
| `licensed` | som `fulltext_allowed` | som `fulltext_allowed` | `fulltext` | + licensvilkår i `rightsNote` (påkrævet) styrer citatgrænser | pr. licens (`rightsNote`) | pr. licens |

**Håndhævelsespunkter** (alle testet, `11-…`):
1. **Indtag (`applyRights`):** felter ud over niveauet fjernes *før* lagring (data der ikke må opbevares, opbevares ikke).
2. **Rating-input:** `RatingInput` bygges af `aiInput`; AI ser aldrig mere end niveauet tillader (`05-…` I10).
3. **Generering:** kildepakkens `allowedUse` pr. kilde (`06-…` §4); `metadata_only`-kilder kan ikke være `groen/gul`-grundlag.
4. **Efter generering:** n-gram-overlap mod kilde (`overlapReport`) – blokerende ved overskridelse af niveauets grænse.
5. **UI:** badge pr. kilde og pr. kandidat ("Kun overskrift", "Uddrag", "Fuldtekst", "Licenseret"); inbox viser tydeligt når en kandidat *ikke* kan danne tekstgrundlag.
6. **Ændring af niveau:** hæve over `metadata_only` eller sætte `licensed` kræver `production.rights.manage` (+ `rightsNote`; `aiHostile` skærper) og auditeres (`localrating.feed.rights`). **Sænkning** er tilladt for `production.manage` og udløser retroaktiv minimering: `housekeeping` fjerner nu-ulovlige felter fra eksisterende `SourceItem`s.
7. **Default:** nye kilder = `metadata_only`, `enabled=false` — også kilder importeret fra kilderegistrene og kilder opdaget af discovery (`approvalStatus="foreslået"`); `rightsLevelSuggested` (afledt af `authorityLevel`+`licenseType`, §11b) er kun et forslag og hæves først til `rightsLevel` ved godkendelse med `production.rights.manage`. `SECONDARY_MEDIA`/`AGGREGATOR`/`SOCIAL_SIGNAL` kan kun hæves over `metadata_only` med licensaftale (`licensed`).

**Juridisk:** niveau-tabellens konkrete grænser (15/25 ord, 500 tegn) er *design-defaults*, ikke juridisk vurdering. T8 §0: "Ingen kilde er vurderet som frit genbrugelig"; skriftlig licens-/ToS-afklaring pr. kilde kræves før niveau hæves (plan, risici: "juridisk gennemgang").

## 6. Paywall-politik
- Ingen omgåelse: ingen cookies/headers/UA-tricks, ingen arkiv-/proxy-tjenester, ingen forespørgsler med login. Y's `check-paywalls`/`scrape-article` (`sireRoute.ts:4078-4248`) droppes.
- Afkortet feed (kun "læs mere"): behandles som `snippet`; kandidaten kan have `supporting` link men ikke fuldtekst.
- Kilder bag login/abonnement kan kun tilføjes som `API`-connector med licens (`licensed`), aldrig som scraping.

## 7. Seed af lokale kilder fra `T8-kildematrix.md`

> **Opdateret 3. oktober 2026:** seed-scriptet `scripts/localrating-seed-sources.ts` er **erstattet af `npm run sources:import`** (§11c), som læser ejerens kilderegistre. Tabellen herunder er stadig den *verificerede* viden fra T8 og bruges som **URL-overlay** (`urlOrEndpoint`) til de matchende registerrækker (§11a); den definerer ikke længere selv hvilke kilder der oprettes.

Tidligere design: seed-script (`--instans <domæne> [--apply]`; idempotent på `urlNorm`; dry-run som standard; **alle oprettes `enabled=false`, `metadata_only`**). Kun hvad T8 har *verificeret*; resten er markeret.

| Kilde | URL | Type / `sourceType` | By (GeoTag) | Rights (default) | T8-status | Seedes? |
|---|---|---|---|---|---|---|
| Roskilde Kommune – nyheder | `https://www.roskilde.dk/da-dk/nyheder/rss/` | RSS / `kommune_pressemeddelelse` | roskilde-by | `metadata_only` (genbrugsret ikke afklaret) | **Verificeret** (200, 30 elementer, robots tillader alt) | Ja (reference-feed, T8 §4) |
| Høringsportalen (national, filtrér pr. kommune i tekst/geo) | `https://hoeringsportalen.dk/syndication/HearingsFeed` | ATOM / `andet` | – (geo udledes) | `metadata_only` | **Verificeret** (Atom 200, 38 KB) | Ja, deaktiveret; kommune-filter kræver geo-match |
| MeteoAlarm Danmark | `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-denmark` | ATOM / `vejr` | – | `metadata_only` (vilkår ikke verificeret) | Verificeret (200, ingen aktive varsler på testtidspunkt); P2 | Ja, deaktiveret |
| TV2 Øst | `https://www.tv2east.dk/rss` | RSS / `lokalt_medie` | – | `metadata_only`, **`aiHostile`** (robots forbyder AI-crawlere) | **Verificeret** feed; "kun link/overskrift efter licensafklaring" | Ja, **deaktiveret** indtil licensafklaring |
| Via Ritzau myndighedsmeddelelser pr. politikreds (90594 / 13562881) | `https://via.ritzau.dk/rss/short-messages/latest?publisherId=<id>` | RSS / `politi` | pr. kreds | – | Verificeret (T8 §2.1 pkt. 3) | **Overlay til registerrækken "Politi Update"** med `ingestOwner=ailibrary` indtil D18 (én ingest-ejer pr. kilde, `04-…` §4a); AI-udkast fra politi er spærret af `createIngestDraft` |
| Kommune dagsorden/referat (FirstAgenda) | `dagsordener.<kommune>.dk` | – | – | – | Delvist; session/JSON | Registerrække "dagsordener og referater" med `ingestOwner=ailibrary` indtil D18 |
| Næstved Kommune nyheder | – | – | naestved-by | – | **Ikke fundet** (T8 §2.1 pkt. 2: `/rss`, `/nyheder/rss` giver 404) | Registerrække findes (P1, `HTML_MONITOR`); URL researches i bølge A (§11g) |
| Slagelse, Holbæk, Ringsted, Sorø, Køge | – | – | – | – | Ikke fundet / Køge 403 | Nej |
| sn.dk (Sjællandske Medier) | – | – | – | – | Intet feed; robots forbyder AI-crawlere | Nej |
| Vejdirektoratet DATEX II | `du-portal-ui.dataudveksler.app.vd.dk` | API / `trafik` | – | – | Kræver konto/vilkår (ikke verificeret) | Nej (Senere, `API`) |
| Plandata WFS | `geoserver.plandata.dk/geoserver/wfs` | API | – | – | Verificeret (GetCapabilities), men ikke et item-feed | Nej (Senere, `API`) |
| Foreninger/klubber/kultur | – | – | – | – | Ingen feeds verificeret | Nej – foreningens egen indsendelse (Meddeler/Indsend) foretrækkes |

**Pilot (besvaret via kilderegistrene, D6):** pilot = **Næstved og Slagelse** efter ejerens to registre; MVP-listerne (§11g) er Fase 2-køen. T8's verificerede feeds (Høringsportalen, MeteoAlarm, TV2 Øst, Plandata) er de første rene bølge A-kilder; Roskilde-RSS bruges kun som teknisk reference i en test-/staging-instans. T8 fandt *ingen* kommune-RSS for Næstved/Slagelse ⇒ kommunens egne nyheder overvåges som `HTML_MONITOR` (§11a). Politi/dagsorden/trafik/vejr leveres indtil D18 af aI-library som `Signal` (`ingestOwner=ailibrary`), men kilderegistret ejes af LocalRating.

Geo-default pr. kilde sættes via `GeoTag.slug` fra instansens egne GeoTags (T8 §3 tabeller; `lib/ingest/geo.ts:10-36` `POSTNR_TABLE` er kun postnummer-matching). **Ingen bynavne i kode.**

## 8. Import af Y's feedliste (filtreret engangsimport) — nu sekundær

> **Opdateret 3. oktober 2026:** de to kilderegistre er LocalRatings primære kildekatalog (§11). Y-importen er en **valgfri bekvemmelighed** der højst tilfører nogle nationale/ministerielle kontekstfeeds; den skriver `discoveredBy="y-import"`, `approvalStatus="foreslået"` og må aldrig overskrive registerrækker (`sourceKey` er forskellig; dubletter på `urlNorm` afvises til fordel for registerrækken). Ingen Y-filer røres.

`scripts/localrating-import-y-feeds.ts --file <y-export.json> --instans <domæne> [--groups …] [--apply]` (dry-run som standard; maks 50 pr. kørsel; kræver at kørslen er manuelt bekræftet). Y's liste udtrækkes read-only (ingen Y-kode importeres).

**Filtre (afviser):** `reuters://`, `oai://`, `openalex://`, `hal://`; URL'er der ikke er `https` (medmindre manuelt godkendt); site-scraper-"feeds" (fx `jyllands-posten.dk/seneste/`, `thebureauinvestigates.com`, `chattymakker`-/sn.dk-opkald); Via Ritzau `short-messages` (politi → aI-library); dubletter på `urlNorm`; kilder i `isForeign`-grupper (alt andet end "dansk" i gruppenavn; Y `:1559-1563`).
**Mapping:** Y `sourceType` (`news_media`, `government_source`, `interest_organization_press_release`, `think_tank`, `research_report`, `trade_media`, `financial_disclosure`) → `SOURCE_TYPES` (`lokalt_medie` / `kommune_pressemeddelelse` / `andet`); `language` fra gruppe; `importedFrom="y-feedlist:<dato>"`; **`enabled=false`, `rightsLevel=metadata_only`**.

| Y-gruppe (optalt ud fra `group:`-felter i `Y_TEST_FEEDS`, `sireRoute.ts:713-949`) | Antal | Anbefaling |
|---|---|---|
| Universiteter & forskning | 41 | **Drop** (OAI/OpenAlex/HAL; ikke lokalt) |
| Forskning & data | 28 | **Drop** |
| Ministerier | 17 | Valgfri import (national kontekst; lav lokal værdi) |
| Politi & sikkerhed | 15 | **Drop** (aI-library / AI-spærring) |
| Danske nyhedsmedier | 14 | Valgfri, kun headline-only; `aiHostile`-tjek |
| Styrelser | 12 | Valgfri |
| Danske fagmedier | 10 | Valgfri |
| Internationale/nordiske/erhverv/tænketanke/øvrige | resten (~280) | **Drop** |

Samlet: af Y's ~418 URL-literaler er højst ca. 50-60 relevante for et lokalt medie, og ingen er lokale for de syv byer. Importværktøjet er derfor en *bekvemmelighed*, ikke en forudsætning.

## 9. Feed-administration (`/redaktion/produktion/feeds`, spec §8)
**Kilder (udvidet):** siden `/redaktion/produktion/kilder` (alias `/feeds`) viser alle `SourceDefinition`-rækker pr. instans med filtre på `priority`, `authorityLevel`, `accessMode`, `approvalStatus`, `ingestOwner`, `status`; **godkendelseskø** for `foreslået`-rækker (importerede og opdagede) med rights-/PII-forslag, `aiClassification` (kun forslag), forælder og stikprøve-visning (D29); import-dry-run (`sources:import`) og discovery-kørsler/-historik; GeoTag-gap- og alias-forslag. Rettigheder: se nedenfor.

Redaktionen kan: oprette/deaktivere feeds, **teste** (viser type, parser-lag, antal items, første 5 efter rights-gate, ETag/Last-Modified-understøttelse, robots-status, `aiHostile`, SSRF-afvisning med kode), ændre interval (min. 15 min), se fejl/seneste hentning/antal items, se konvertering til kandidater (`itemsNew → candidates`), knytte Knowledge `Source` (`knowledgeSourceRef`), ændre `rightsLevel` (jf. §5), arkivere (aldrig slette). Rettigheder: `production.view` (se), `production.manage` (ændre), `production.rights.manage` (hæve rights).

## 10. Åbne spørgsmål
1. Pilot-kilder for Næstved (T8 har ingen verificeret kommune-RSS) – hvilke feeds skal oprettes først, og hvem afklarer licens (T8 §6.1)?
2. Må `metadata_only`-overskrifter sendes til en LLM til rating (juridisk)? (Design-default: ja, kun overskrift.)
3. `cheerio` som ny afhængighed til feed-discovery – ja/nej?
4. `LOCALRATING_FEED_HOST_ALLOWLIST` som default i produktion (strengt) eller kun ved behov? (Med kilderegistre og discovery bliver værtslisten stor og dynamisk; anbefaling: ingen allowlist som default, men for discovery-børn kun værter fra godkendte seeds.)
5. Skal `fetchArticle` (hent artikelside for `fulltext_allowed`/`licensed`) med i v1 eller udskydes (anbefalet: udskyd)?

## 11. Kilderegistre for Næstved og Slagelse

Dato: 3. oktober 2026. Status: Fase 0 (design, tilføjet efter ejerens kilderegistre). **Kilde-til-sandhed:** `docs/localrating/source-registries/Naestved_Source_Registry_Artikelmotor.md` (93 rækker: 18 P0 · 43 P1 · 32 P2) og `Slagelse_Source_Registry_Artikelmotor.md` (74 rækker: 14 P0 · 35 P1 · 25 P2) – ejerens egne filer, bevaret uændret. Artikelmotoren for **Næstved og Slagelse** tager udgangspunkt i disse registre: kilder overvåges med AI og artikler skrives ud fra feeds/API'er/monitorer. Registrene er et **kilderegister som data** (ikke kode): hver række bliver en `SourceDefinition` pr. instans (`03-…` §2/§2a, ADR-015). Afsnittet erstatter det tidligere seed-script (§7) og gør Y-importen (§8) sekundær.

> **Faktuel afgrænsning.** Registrene indeholder **ingen URL'er** og siger intet om nøgler/aftaler ud over "kræver aftale/licens" (Ritzau), "gældende vilkår" (Rejseplanen) og "officiel CVR-adgang". Alt herunder om URL'er, nøgler og tekniske adgangsveje ud over det T8 allerede har **verificeret** (§7: Høringsportalen-Atom, MeteoAlarm, TV2 Øst-RSS, Roskilde-RSS som reference, Plandata WFS-GetCapabilities, Via Ritzau politikreds-feeds, Næstved-RSS **ikke fundet**) er **uverificeret** og markeres sådan. Der er ikke foretaget netværkskald i dette arbejde.

### 11a. Mapping: registrenes kolonner → `SourceDefinition`

**Kolonner.** Næstved: `Pri | Kilde | Område | Adgang | Lokal filtrering | Typiske historier`. Slagelse: `Pri | Kilde | Område | Adgang | Brug`. Parseren genkender kolonnerne på overskriftsnavn (ikke position), så begge formater og senere varianter virker.

| Registerkolonne | → `SourceDefinition` | Regel |
|---|---|---|
| `Pri` (P0/P1/P2) | `priority` + `pollIntervalMinutes` | P0 → 5, P1 → 30, P2 → 360 som default (justeres af `accessMode`/`sourceClass`, se §11f) |
| `Kilde` | `name`, `sourceKey = "reg:" + slug(name)` | Rækker med samme navn i samme fil får suffiks `-2`. Kompositnavne som "Slagelse.info / Slagelse.News / Korsor.News / Skaelskor.News" **splittes ikke automatisk** (importeren markerer dem `needs_split`; redaktionen opretter én række pr. site, ellers tæller de som én) |
| `Område` | `sourceClass` (slug) **og** `sourceType` (CMS' `SOURCE_TYPES`) | Fast tabel: Politi → `politi`/`politi`; Beredskab → `beredskab`/`beredskab_112`; Vejr/beredskab, Vejr → `vejr`/`vejr`; Trafik, Jernbane, Bus, Kollektiv trafik, Færger, Infrastruktur → `trafik`/`trafik`; Kommunalpolitik → `kommunalpolitik`/`kommune_dagsorden`; Kommune → `kommune`/`kommune_pressemeddelelse`; Foreninger, Lokalsamfund → `forening`/`forening`; Sport (klubber) → `sport`/`klub`; Regionalt medie, Lokalt medie, Lokalt nichemedie, Kommunalmedie → `medie`/`lokalt_medie`; alt andet → slug af området/`andet` |
| `Adgang` | `accessMode` + `parserType` (+ `parserConfig`) | Regelrækkefølge nedenfor (første match vinder); uforståelig tekst → `MANUAL` + `needs_review` |
| `Lokal filtrering` (Næstved) / `Brug` (Slagelse) | `geoFilter`, `keywordFilters`, `entityFilters` | "Næstved + kommunens stedaliaser", "Kommune 370", "Næstved Kommune/entity", "Adresse/matrikel/sted", "Koordinater/bounding box", "Postnr./CVR/adresse/navn" → hvilke `geoFilter`-nøgler der slås til (`kommuneKoder`, `aliases`, `postnumre`, `bbox`, `matchMode`) og `entityFilters` (CVR/institution). Slagelse-"Brug" er *typiske historier* og lægges i `parserConfig.uses` (ingen filtrering udledes; `geoFilter` sættes fra geo-kernen) |
| `Typiske historier` / `Brug` | `parserConfig.uses` (tekst) | Kun til UI/AI-hint; aldrig beslutningsgrundlag |
| *(afledt)* `authorityLevel` | se §11b | Efter kolonne `Område` + navn + `Adgang` |
| *(afledt)* `licenseType` | se §11b | |
| *(afledt)* `instanceScope` | `instance` som default; `national` for Folketinget, Retsinformation, Statstidende, Ankestyrelsen, Planklagenævnet, Miljø- og Fødevareklagenævnet, Ombudsmanden, Datatilsynet, Arbejdstilsynet, Miljøstyrelsen, Slots- og Kulturstyrelsen, Valg.dk, TED, udbud.dk, DST, Jobindsats, Via Ritzau, Ritzau nyhedstjeneste; `region` for politi, Region Sjælland, Brand & Redning, Movia, Banedanmark, DSB, Vejdirektoratet, DMI, Kystdirektoratet, GEUS | Styrer minimumskrav til lokalitet før kandidat (§11e) |
| *(afledt)* `ingestOwner` | `localrating` / `ailibrary` | `ailibrary` som default for politi (Politi Update, døgnrapporter), dagsordener og referater, Vejdirektoratet Trafikinfo og DMI (T8 §5: agenter i aI-library) **indtil ejeren afgør D18**; alt andet `localrating` (se `04-…` §4a) |

**`Adgang` → `accessMode`/`parserType` (første match vinder; strengene sammenlignes case-insensitivt, efter fjernelse af "hvor tilbudt/tilladt/muligt/lovligt/hvis tilgængeligt"):**

| # | Mønster i "Adgang" | `accessMode` | `parserType` | Bemærkning |
|---|---|---|---|---|
| 1 | "Licenseret feed/API" | `LICENSED_FEED` | `licensed-ritzau` | `authorityLevel=LICENSED_NEWSWIRE`, `rightsLevel=blocked` til licens (§11b) |
| 2 | "Officielle API'er/alerts/manual", "Officiel API/alerts/manual" | `MANUAL` | `manual` | `SOCIAL_SIGNAL`; officiel API først efter D30 (aldrig scraping) |
| 3 | "Seed directory …", "Seed registry …", "Kommune-seed …", "… seed + …" (Foreningsportal/Winkas, lokalråd, skoler, dagtilbud, idrætsforeninger, kulturforeninger), "sogn.dk + …", "CVR-seed + website-monitor" | `SEED_DIRECTORY` | `seed-directory` (CVR-seed: `cvr-seed`; sogn.dk: `seed-directory`) | Poller ikke selv; **producerer child sources** via discovery (§11d) |
| 4 | "REST/WFS/WMS", "WFS/WMS/download/webservices" | `API` | `wfs` (Plandata: også `rest`) | Plandata, GEUS Jupiter |
| 5 | "OData …" | `API` | `odata` | Folketingets åbne data |
| 6 | "REST harvest API + ELI Atom/sitemap" | `API` | `json-api` (Atom/sitemap som `parserConfig.altFeeds`) | Retsinformation |
| 7 | "OpenAPI", "API JSON/CSV", "EU-data/feed/API", "Officiel CVR-adgang/API", "Officiel API" (CVR), plain "API" | `API` | `json-api`; CVR: `cvr`; DMI: `json-api`; DAWA/Dataforsyningen: `json-api`; Rejseplanen: `gtfs`; Vejdirektoratet "open data": `datex2` | Hver `parserType` er en **typet adapter** (ingen generisk "scrape HTML", §1) |
| 8 | "API/GTFS; …vilkår", "Trafikinfo/API" | `API` | `gtfs` (Rejseplanen) / `json-api` (Movia) | Fald tilbage til `HTML_MONITOR` hvis ingen API tilbydes |
| 9 | "RSS; medie-API kan søges", "Web/RSS …", "Search/feed …", "Jobsite/feed/monitor", "Offentlige pressemeddelelser/search/RSS", "Public newsroom/search/RSS", "Web/app/feed", "Web/jobfeed" | `RSS` hvis `feed-discovery` (eller T8/overlay) finder et feed, ellers `HTML_MONITOR` | `rss-parser` / `html-change` | Valget træffes ved `sources:check` (§11c) og gemmes; indtil da `HTML_MONITOR` |
| 10 | "Web/Blogger feed/monitor" | `ATOM` | `atom` | Næstved Nyt (Blogger) – uverificeret |
| 11 | "… PDF-monitor", "HTML/PDF monitor", "Dagsordensportal/search/PDF-monitor" | `HTML_MONITOR` | `pdf-monitor` | Opdager nye dokumenter/links og gemmer **kun** titel/URL/dato/hash; ingen PDF-fuldtekst i v1 (D9: PDF-parsing er en ny afhængighed) |
| 12 | "Struktureret eventside", "Event/nyhedssider", "event-monitor", "Web/kalender", "Web/udstillinger/events", "Nyheder/arrangementer" | `HTML_MONITOR` | `html-list` | Liste over elementer (`parserConfig.itemSelector`); events |
| 13 | "Afgørelsesdatabase/search", "Search/monitor", "Web/udbudsmonitor", "Offentlig(e) database(r)/search", "Tilsyn…", "Officielle data/search|results" | `HTML_MONITOR` | `html-list` | Søge-/databasesider overvåges som lister; **ingen** formular-POST/scraping bag login (§6); strukturerede åbne data hvor de findes tages som `API` ved `sources:check` |
| 14 | "Web/change monitor", "Web-monitor", "Web/feed-monitor", "Web/driftsinfo", "Web/driftsstatus", "Web/nyheder", "Web/nyheder/…", "Projekt-/nyhedssider", "Projektpages", "Struktureret web/change monitor", "Struktureret portal/map/search", "Officiel web/nyheder", "Web/data services", "Web/download", "Web monitor", "Status-side …", "Mail + web-monitor", "Web/nyhedsbrev …" | `HTML_MONITOR` | `html-change` (liste-sider: `html-list`; download-sider: `html-change` m. `parserConfig.downloadKind`) | Ændringsdetektion på en defineret sideregion; `EMAIL`/"mail/SMS"/"nyhedsbrev"-kanaler noteres i `parserConfig.altAccess` men bruges ikke i v1 (indgående e-mail kræver ny infrastruktur, D30) |
| 15 | alt andet | `MANUAL` | `manual` | `needs_review` i dry-run |

`HTML_MONITOR` er **ændringsdetektion og link-/overskriftsudtræk fra en konfigureret URL** – ikke indholds-scraping af vilkårlige sider. Det kræver en HTML-parser (`cheerio`): **D9 ændres fra "nej" til "ja" for Fase 2** hvis HTML_MONITOR skal med (alternativ: kun feed/API i Fase 2 og HTML_MONITOR i Fase 2b).

**Klassificering af alle distinkte kilder.** Forkortelser — *Adgang:* API · RSS · ATOM · HTML (`HTML_MONITOR`) · PDF (`HTML_MONITOR`/`pdf-monitor`) · SEED (`SEED_DIRECTORY`) · LIC (`LICENSED_FEED`) · MAN (`MANUAL`). *Autoritet:* PO `PRIMARY_OFFICIAL` · POR `PRIMARY_ORGANIZATION` · NW `LICENSED_NEWSWIRE` · SM `SECONDARY_MEDIA` · AGG `AGGREGATOR` · SOC `SOCIAL_SIGNAL`. *Rights (foreslået):* MD `metadata_only` · SN `snippet_allowed` · BL `blocked`. *PII:* – ingen · m mulig · l sandsynlig. *Ejer:* LR `localrating` · AIL `ailibrary` (D18). *Kræver:* **N** API-nøgle/konto/tilmelding · **A** aftale/licens · **U** teknisk adgangsvej uverificeret (alle rækker kræver desuden URL + robots/vilkårstjek før aktivering). *By:* N Næstved · S Slagelse.

| Kilde (N = Næstved-navn; S = Slagelse-navn hvis forskelligt) | By | Pri | Adgang / `parserType` | Aut. | Rights | PII | Ejer | Kræver |
|---|---|---|---|---|---|---|---|---|
| Politi Update – Sydsjællands og Lolland-Falsters Politi | N S | P0 | RSS / `rss-parser` | PO | SN | m | AIL | U (T8: Via Ritzau-feed pr. politikreds verificeret) |
| Politiets døgnrapporter og nyheder | N S | P0 | HTML / `html-change` | PO | SN | m | AIL | U |
| Midt- og Sydsjællands Brand & Redning (N) · Slagelse Brand & Redning (S) | N S | P0 | HTML / `html-change` (+ sociale signaler via MAN) | PO | SN | – | LR | U |
| DMI Open Data | N S | P0 | API / `json-api` | PO | SN* | – | AIL | N? (uverificeret: gratis nøgle) |
| Vejdirektoratet Trafikinfo | N S | P0 | API / `datex2` (fald tilbage HTML) | PO | SN | – | AIL | N (T8: konto/vilkår) |
| Vejdirektoratet – Næstved–Rønnede-projekt | N | P0 | HTML / `html-change` | PO | SN | – | LR | U |
| DSB trafikinformation | N S | P0 | HTML / `html-change` | PO | SN | – | LR | U |
| Banedanmark | N S | P0 | HTML / `html-change` | PO | SN | – | LR | U |
| Movia | N | P0 | API / `json-api` hvis tilbudt, ellers HTML | PO | SN | – | LR | N/A? U |
| Rejseplanen Labs / GTFS / SIRI | N S | P0 | API / `gtfs` | PO | SN* | – | LR | N+A (vilkår) |
| Storebælt / Sund & Bælt trafikstatus | S | P0 | HTML / `html-change` (mail/SMS i `altAccess`) | POR | SN | – | LR | U |
| Cerius driftsinfo (El) | S | P0 | HTML / `html-change` | POR | SN | – | LR | U |
| NK-Forsyning / NK-Vand / NK-Spildevand | N | P0 | HTML / `html-change` | POR | SN | – | LR | U |
| Envafors (N: overgangsrelevante sider) | N S | P0 | HTML / `html-change` | POR | SN | – | LR | U |
| Næstved Fjernvarme · Fensmark Fjernvarme · Fuglebjerg Fjernvarme · Sandved-Tornemark Kraftvarmeværker (4 rækker) | N | P0 | HTML / `html-change` | POR | SN | – | LR | U |
| AffaldPlus | N S | P0 | HTML / `html-change` (SMS ikke) | POR | SN | – | LR | U |
| Agersø-Omø Færgerne / Stigsnæs | S | P0 | HTML / `html-change` | POR | SN | – | LR | U |
| Region Sjælland – Næstved Sygehus (N) · Slagelse Sygehus (S) | N S | P0 | HTML / `html-change` | PO | SN | – | LR | U |
| Kommune – nyheder og pressemeddelelser | N S | P1 | HTML / `html-change` (RSS hvis fundet; T8: ingen kommune-RSS fundet for Næstved/Slagelse) | PO | SN | – | LR | U |
| Kommune – dagsordener og referater | N S | P1 | PDF / `pdf-monitor` (S: + mail i `altAccess`) | PO | SN | m | AIL | U (T8: FirstAgenda-sessionsløsning ikke verificeret) |
| Kommune – høringer (N: + borgermøder) | N S | P1 | HTML / `html-list` + Høringsportalen ATOM (T8-verificeret) | PO | SN | – | LR | – (feed) / U |
| Kommune – lokalplanportal (N) · lokalplaner/kommuneplan (S) | N S | P1 | HTML / `html-list` | PO | SN | – | LR | U |
| Plandata.dk | N S | P1 | API / `wfs`,`rest` | PO | SN* | – | LR | – (T8: GetCapabilities verificeret) |
| Kommune – kommuneplan/strategi | N | P1 | PDF / `pdf-monitor` | PO | SN | – | LR | U |
| Kommune – udbud og indkøb (N) · udbud/markedsdialog (S) · udbudsplan (N) | N S | P1 | HTML / `html-list`,`pdf-monitor` | PO | SN | – | LR | U |
| FUS – Fællesudbud Sjælland | N | P1 | HTML / `html-list` | PO | SN | – | LR | U |
| udbud.dk | N S | P1 | HTML / `html-list` (søg på ordregiver) | PO | MD | – | LR | U |
| TED – Tenders Electronic Daily | N S | P1 | API / `json-api` | PO | SN* | – | LR | U (N?) |
| Kommune – budget, regnskab og økonomi | N S | P1 | PDF / `pdf-monitor` | PO | SN | – | LR | U |
| Kommune – indkøbs-/leverandørdata | S | P1 | HTML / `html-change` (`downloadKind=csv/xls`) | PO | SN | m | LR | U |
| Kommune – projekter (havnebydel, bymidte …) | N | P1 | HTML / `html-change` | PO | SN | – | LR | U |
| Kommune – jobs | N S | P1 | RSS el. HTML / `rss-parser`/`html-list` | PO | MD | – | LR | U |
| Folketingets åbne data | N S | P1 | API / `odata` | PO | SN* | – | LR | – (uverificeret) |
| Retsinformation | N S | P1 | API / `json-api` (+ELI Atom) | PO | SN* | – | LR | – (uverificeret) |
| Statstidende | N S | P1 | API / `json-api` (OpenAPI) | PO | SN | m | LR | N? (U) |
| Retten i Næstved – retslister | N S | P1 | PDF / `pdf-monitor` | PO | **MD** | **l** | LR | U; **D31 før aktivering** |
| Ankestyrelsen · Planklagenævnet · Miljø- og Fødevareklagenævnet | N S | P1 | HTML / `html-list` | PO | SN | m | LR | U |
| Folketingets Ombudsmand · Datatilsynet | N S | P1 | HTML / `html-list` | PO | SN | m | LR | U |
| Arbejdstilsynet · Fødevarestyrelsen/Find Smiley · Styrelsen for Patientsikkerhed | N | P1 | HTML / `html-list` (åbne data som API hvis fundet) | PO | SN | m | LR | U |
| Erhvervsstyrelsen / CVR | N S | P1 | API / `cvr` | PO | SN | m | LR | **N+A** (CVR-adgang/vilkår; D30) |
| Danmarks Statistik / StatBank | N S | P1 | API / `json-api` | PO | SN* | – | LR | – (uverificeret) |
| Jobindsats API v3 | N S | P1 | API / `json-api` | PO | SN* | – | LR | N? (U) |
| Dataforsyningen / Grunddata / DAWA | N S | P1 | API / `json-api` | PO | SN* | – | LR | N? (U) |
| BBR / Boligejer / offentlige ejendomsdata | N | P1 | API / `json-api` hvis åben, ellers HTML | PO | MD | m | LR | **N+A?** (U; persondata) |
| GEUS Jupiter | N S | P1 | API / `wfs` | PO | SN* | – | LR | U |
| Danmarks Miljøportal / DMA | N S | P1 | HTML / `html-list` | PO | SN | m | LR | U |
| Miljøstyrelsen · Kystdirektoratet · Slots- og Kulturstyrelsen/Fund og Fortidsminder · Valg.dk · Forsvaret/Gardehusarregimentet (S) | N S | P1 | HTML / `html-change` (data som API hvis fundet) | PO | SN | – | LR | U |
| Næstved Havn (N) · Korsør Havn · Skælskør Havn (S) | N S | P1 | HTML / `html-change` | POR | SN | – | LR | U |
| Storebælt / Sund & Bælt – nyheder/trafiktal | S | P1 | HTML / `html-change` (`downloadKind`) | POR | SN | – | LR | U |
| Næstved Erhverv · Næstved Erhvervshus/Ressource City · Næstved City (N) · Slagelse Erhverv · DI Vestsjælland (S) | N S | P1 | HTML / `html-change` (nyhedsbrev i `altAccess`) | POR | SN | – | LR | U |
| Via Ritzau (offentlige pressemeddelelser) | N S | P1 | RSS el. HTML / `rss-parser` | POR | SN | – | LR | U (T8: politikreds-feeds verificeret; øvrige ikke) |
| **Ritzau nyhedstjeneste** | N S | P1 | LIC / `licensed-ritzau` | NW | **BL** | – | LR | **A** (licens før noget) |
| TV2 ØST | N S | P2 | RSS / `rss-parser` (T8-verificeret) | SM | MD (`aiHostile`) | – | LR | – (licensafklaring før level > MD) |
| Sjællandske Nyheder / sn.dk | N S | P2 | HTML / `html-change` (T8: intet feed; robots forbyder AI) | SM | MD (`aiHostile`) | – | LR | U |
| DR P4 Sjælland / DR regionalt | N S | P2 | RSS el. HTML | SM | MD | – | LR | U |
| DK Nyt | N S | P2 | HTML (nyhedsbrev i `altAccess`) | SM | MD | – | LR | U |
| Næstved Nyt (N: Blogger-feed) · Næstved Netavis · Dit Næstved (N) | N | P2 | ATOM `atom` / HTML | SM | MD | – | LR | U |
| 112news.dk · Slagelse.info/.News (4 sites) · SlagelseJournalen (S) | S | P2 | HTML / `html-change` | SM | MD | m | LR | U |
| VORES Næstved / VORES-lokalsider · SlagelsePortal | N S | P2 | HTML / `html-change` | AGG | MD | – | LR | U |
| Mynewsdesk og andre PR-platforme | N S | P2 | RSS / `rss-parser` | POR | SN | – | LR | U |
| Bibliotek/Borgerservice – arrangementer (N) · Slagelse Bibliotekerne – arrangementer (S) | N S | P2 | HTML / `html-list` | PO | SN | – | LR | U |
| Foreningsportalen (N) · Winkas-foreningsoversigt (S) | N S | P2 | SEED / `seed-directory` | PO | MD (seed) | m | LR | U |
| Lokalråd og bylaug (N) · lokalrådsoversigt (S) | N S | P2 | SEED / `seed-directory` | PO | MD (seed) | – | LR | U |
| Kommunale folkeskoler · Privat- og friskoler · Dagtilbud/private dagtilbud | N S | P2 | SEED / `seed-directory` | PO | MD (seed) | – | LR | U |
| Uddannelser: Næstved Gymnasium og HF · ZBC · EUC Sjælland Næstved · Absalon · VUC Storstrøm · Herlufsholm (N) · Absalon Campus Slagelse · ZBC Slagelse · Slagelse Gymnasium (S) | N S | P2 | HTML / `html-list` | POR | SN | – | LR | U |
| Kultur/sport: Grønnegades Kaserne · Rønnebæksholm · Museum Sydøstdanmark · Næstved Arena · Næstved Boldklub · Team FOG Næstved (N) · Museum Vestsjælland/Trelleborg (S) | N S | P2 | HTML / `html-list` | POR | SN | – | LR | U |
| Lokale idrætsforeninger · kirker/sogne · kulturforeninger og spillesteder (S: kulturinstitutioner/teatre/biografer) | N S | P2 | SEED / `seed-directory` (sogn.dk som seed) | POR | MD (seed) | m | LR | U |
| Lokale virksomheders egne newsrooms | N S | P2 | SEED / `cvr-seed` | POR | MD (seed) | m | LR | **N+A** (afhænger af CVR) |
| Officielle lokale Facebook/Instagram/LinkedIn-konti (S: "sociale konti") | N S | P2 | MAN / `manual` | SOC | MD | m | LR | – (officiel API: D30) |

`SN*` = `snippet_allowed` som standard, men **kan hæves til `fulltext_allowed` for strukturerede/åbne data** når konkrete API-/datavilkår dokumenteres i `rightsNote` (§11b). Rækker med flere kilder i én celle oprettes som **én `SourceDefinition` pr. kilde** (importeren splitter kun ved " · "-lister der er skrevet som separate rækker i registeret; kompositceller markeres `needs_split`).

### 11b. Rights-defaults pr. `authorityLevel` / række

`deriveRights(authorityLevel, licenseType, accessMode, sourceClass)` er en **ren, testet funktion** (`lib/localrating/sources/rights-defaults.ts`) der beregner `rightsLevelSuggested`, `personDataClass`, `qualityGate`, `trustLevel`-startværdi og `aiHostile`-udgangspunkt. Den **sætter ikke** `rightsLevel` (effektivt niveau forbliver `metadata_only` til godkendelse; §5 regel 6/7 og ADR-015). Niveauer og håndhævelse er uændret (§5); dette er *defaults og lofter*, ikke juridisk vurdering (D7/D30).

| `authorityLevel` / række | `licenseType` | `rightsLevelSuggested` | Loft / forbud | Øvrige regler |
|---|---|---|---|---|
| `PRIMARY_OFFICIAL` – åbne API'er (DMI, DAWA/Dataforsyningen, DST, Jobindsats, Retsinformation, Folketinget, Plandata, GEUS, TED, Statstidende, Rejseplanen) | `open_data` / `api_terms` | `snippet_allowed`; **efter konkrete API-vilkår** `fulltext_allowed` for tekst der udtrykkeligt er åbne data | Aldrig `licensed` uden aftale; Rejseplanen følger "gældende vilkår" ⇒ default `metadata_only` indtil vilkår er læst | **Strukturerede felter** (tal, koordinater, status, datoer, kommunekode) hvidlistes pr. adapter i `parserConfig.fields` og gemmes under API-vilkår uanset tekstniveau; kun *tekstfelter* styres af `rightsLevel`. Gem altid provenance (`rawPayloadHash`, `canonicalUrl`, `retrievedAt`) |
| `PRIMARY_OFFICIAL` – myndighedssider via `HTML_MONITOR` (kommune, Brand & Redning, politiets døgnrapporter, DSB, Banedanmark, tilsyn, nævn) | `own_content` | `snippet_allowed` (titel + uddrag ≤ 500 tegn) | **Ingen** PDF-/fuldtekstlagring; `rawPayload` uden `content`-felter; T8: genbrugsret hos kommuner ikke afklaret ⇒ effektivt `metadata_only` til godkendelse med `production.rights.manage` + `rightsNote` | Dagsordener/referater og retskilder må **ikke** gengives ordret ud over citatgrænsen (§5 tabel) |
| `PRIMARY_OFFICIAL` med persondata (retslister, Statstidende, CVR-personer, nævn/tilsynsafgørelser, BBR) | `personal_data_restricted` | `metadata_only` (retslister, BBR); `snippet_allowed` for virksomhedsdata (Statstidende/CVR) | Se persondata-tabel nedenfor | `personDataClass` `likely`/`possible`; **D31** |
| `PRIMARY_ORGANIZATION` – havne, forsyning, erhvervsorganisationer, uddannelser, kulturinstitutioner, virksomheders newsrooms, foreninger | `own_content` / `public_pr` | `snippet_allowed` for pressemeddelelser/nyhedssider/RSS; `metadata_only` for ren ændringsdetektion af ikke-presse-sider | Ingen fuldtekst uden skriftlig tilladelse; forsyning/driftsinfo: kun driftsmeddelelsens overskrift + uddrag | Foreningers private oplysninger (navne på børn/medlemmer): `personDataClass=possible` |
| **Via Ritzau** / Mynewsdesk / PR-platforme (afsenderens egne meddelelser) | `public_pr` | `snippet_allowed` (D30: `fulltext_allowed` hvis platformsvilkår tillader gengivelse) | **Må aldrig forveksles** med Ritzau nyhedstjeneste: egne `sourceKey`, `authorityLevel` (`PRIMARY_ORGANIZATION` ≠ `LICENSED_NEWSWIRE`), test `tests/localrating-source-rights.test.ts` | Pressemeddelelser er afsenderens synspunkt ⇒ `trustLevel` 55; skal krydstjekkes |
| **Ritzau nyhedstjeneste** (`LICENSED_NEWSWIRE`) | `licensed` | **`blocked`** (ingen hentning, ingen lagring) indtil underskrevet licens (D30); derefter `licensed` med vilkår i `rightsNote` | Validering **nægter** `enabled=true` mens `rightsLevel=blocked`; kræver `production.rights.manage` + `rightsNote` med aftalenavn/dato/citatgrænser | Ejer af aftale: ejeren (D30) |
| `SECONDARY_MEDIA` – TV2 ØST, sn.dk, DR, DK Nyt, Næstved Nyt, Næstved Netavis, Dit Næstved, 112news.dk, Slagelse.info/.News, SlagelseJournalen m.fl. | `media_copyright` | **`metadata_only`** | **Forbud mod fuldtekst** (ingen `description`, ingen `content:encoded`, ingen artikelhentning, ingen AI-resumé af artiklen); kan ikke hæves over `metadata_only` uden licensaftale (`licensed`) — `rights.manage` alene er ikke nok; `aiHostile`-kilder (T8: TV2 ØST, sn.dk) må højst sende overskrift til AI | **Brug:** discovery, alerts, overskrift+link, krydstjek (`firstSecondarySeenAt`, RELATED/dedupe). `role="supporting"`; aldrig eneste kildegrundlag for en påstand i generering; `qualityGate=headline_only`; `trustLevel` 50 |
| `AGGREGATOR` – VORES-sider, SlagelsePortal | `media_copyright` / `unknown` | `metadata_only` | Som `SECONDARY_MEDIA`; kun leads/events/links | `trustLevel` 35; aldrig `primary` |
| `SOCIAL_SIGNAL` – officielle sociale konti | `unknown` | `metadata_only` | **`MANUAL`** (redaktøren indsætter link/observation) eller **officiel API** efter D30 og platformens vilkår; **aldrig scraping**; embeds kun via officielle embeds; `safeFetch` fetcher ikke sociale platforme | `personDataClass=possible`; verifikationsloft: `verificationConfidence ≤ 35`, kandidater får status `review` og kan ikke være eneste kilde ("altid verificér") |
| Borgertips (CMS `Submission`/`MeddelerSag`) | – | **Ikke en `SourceDefinition`** | Kun tællinger (`tipSupport`, `05-…` §5.1); indhold sendes aldrig til AI | `personDataClass=likely`; D31 |

**Persondata-regler (`personDataClass`)** — gælder retslister, CVR, Statstidende, BBR, nævnsafgørelser, sociale signaler, tips (D31):

| Klasse | Indtag/lagring | AI | Kandidat/generering |
|---|---|---|---|
| `none` | efter rights | normalt (efter `piiPolicy`-gateway-regler, `09-…`) | normalt |
| `possible` | efter rights; navne på privatpersoner **maskeres** i `normalized`/AI-input (`piiPolicy=no_pii`) hvis de ikke er offentlige personer/rolleindehavere | `no_pii`-flag på alle gateway-kald; DeepSeek aldrig | status `review` hvis persondata-detektion rammer; generering kræver redaktørens gennemgang af kilden |
| `likely` | **kun** overskrift, URL, dato, `rawPayloadHash` (+ strukturerede ikke-personfelter); retention 30 dage (kortere end 90) | AI ser kun overskrift uden personnavne (`no_pii`); aldrig fuldtekst | `restricted=true`, status `review`, **ingen AI-udkast** (som politi/112), kun redaktionel manuel gennemgang og evt. Local Arbejdsrum hvor redaktøren selv indsætter kilde |

Ændring af `personDataClass` nedad kræver `production.rights.manage` + begrundelse; opad er altid tilladt. Alt auditeres (`localrating.source.rights`).

### 11c. Seed-import: `npm run sources:import`

Design af et værktøj (`cms/scripts/sources-import.ts` + `cms/lib/localrating/sources/{registry-parser,access-rules,rights-defaults}.ts`; **ikke bygget i Fase 0**). Erstatter `scripts/localrating-seed-sources.ts` (§7) og er ankeret for Fase 2-køen (§11g).

```
npm run sources:import -- --instans <id|domæne> --fil <registry.md> [--overlay <urls.json>] [--apply] [--revert <importedFrom>]
npm run sources:check  -- --instans <id|domæne> [--source <sourceKey>] [--apply]     # robots/aiHostile/feed-discovery; EGEN kommando (se nedenfor)
```

**Adfærd:**
1. **Tørkørsel som standard.** Uden `--apply` skrives intet; rapporten vises (antal nye/uændrede/ændrede/manglende rækker, fordeling pr. `priority`/`accessMode`/`authorityLevel`/`ingestOwner`, advarsler). `--apply` kræver at tørkørslens `registryFileSha256` er den samme som ved anvendelse (print + bekræft).
2. **Ingen netværkskald.** Importen læser kun den lokale fil (stien skal ligge under `docs/localrating/source-registries/` eller være en eksplicit `--overlay`-fil under samme mappe; ingen vilkårlig sti) og databasen. Intet DNS, ingen `safeFetch`.
3. **Parsing.** Markdown-tabeller genkendes på overskriftsrækken (`| Pri | Kilde | …`) og kolonnenavne (case-insensitivt); rækker med `Pri ∈ {P0,P1,P2}` er kilder; andre tabeller/afsnit ignoreres. Geo-kernen læses fra "Kernematch:"-listen (Næstved) eller "**Geo-kerne:**"-linjen (Slagelse) og `kommunekode **NNN**` → `LocalEntityRef` (`kind=place_alias`/`kommune`, `origin=registry`, **`status=godkendt`**, fordi ejeren selv har skrevet dem; "A / B"-aliasser, fx `Næstved / Naestved`, giver to rækker). Afsnit "Native integrationer til første Næstved-MVP" (nummereret liste) og "Første implementeringsprioritet" (Slagelse) → `parserConfig.mvp = { rank?, wave }` på matchende rækker (navnematch; umatchede rapporteres).
4. **Klassificering** med reglerne i §11a/§11b → alle felter i `SourceDefinition`. `geoFilter = { kommuneKoder:[<kode>], aliases:[<geo-kerne>], matchMode: instanceScope==="national" ? "strict" : "any" }`.
5. **Alle rækker oprettes `enabled=false`, `approvalStatus="foreslået"`, `discoveredBy="registry"`, `rightsLevel="metadata_only"`** (+ `rightsLevelSuggested` fra §11b), `status="pending"`, `urlOrEndpoint=null` (medmindre `--overlay` leverer den), `robotsTermsCheckedAt=null`. `ingestOwner` sættes som i §11a. Ritzau nyhedstjeneste får `rightsLevel="blocked"`. **Ingen kilde kan aktiveres ved import.**
6. **Overlay (`urls.json`)** er en reviewbar datafil i repoet: `{ "<sourceKey>": { "urlOrEndpoint": "https://…", "parserConfig": {…}, "geoTagSlug"?: "…", "rightsNote"?: "…" } }`. Må ikke indeholde nøgler/tokens (kun navne på Railway-variabler i `parserConfig.authRef`; `check-secrets`-reglen udvides til at afvise overlay-filer med nøglelignende værdier). Kun T8-verificerede URL'er (§7) er kendt på forhånd.
7. **Idempotent re-import.** Match på `(instansId, sourceKey)`; `registryRowHash` afgør uændret/ændret. For eksisterende rækker opdateres **kun registerejede felter** (`name`, `sourceClass`, `priority`, `accessMode`-forslag, `parserConfig.uses`, `geoFilter`-forslag) og **kun hvis rækken ikke er rørt af et menneske** (ingen `approvedAt`, ingen `updatedById`); menneskeejede felter (`enabled`, `approvalStatus`, `rightsLevel`, `rightsNote`, `urlOrEndpoint`, `trustLevel`, `robotsTermsCheckedAt`, `geoTagId`, `ingestOwner`, `defaultSektionSlug`) **overskrives aldrig**. Rækker der er forsvundet fra filen **slettes aldrig**; de rapporteres (`missing_in_registry`).
8. **GeoTag-gap-rapport:** geo-kernens steder uden matchende `GeoTag` i instansen listes (fx kan Enø, Suså, Sandved, Toksværd mangle; `lib/ingest/geo.ts` `POSTNR_TABLE` dækker kun nogle postnumre). Importen opretter **aldrig** `GeoTag` (CMS-kerne uændret); redaktionen opretter dem i CMS'et, hvorefter `LocalEntityRef.geoTagId` kobles.
9. **Audit:** én `AuditLog`-post `localrating.source.import` pr. kørsel (instans, fil-hash, tællinger) + `importedFrom = "registry:<instans>:<YYYY-MM-DD>:<sha8>"` på hver række. `--revert <importedFrom>` sætter ikke-godkendte, endnu ikke hentede importerede rækker til `status="disabled"` (arkiveret); rækker med `SourceItem`s berøres ikke.
10. **Rettigheder og kanal:** CLI kræver databaseadgang (som Y-import i §8); samme funktion eksponeres i UI (`/redaktion/produktion/kilder`) og som operatørværktøj `sources_import` (`confirm`, kun filer fra mappen, dry-run-resultat i kortet). `production.manage` kræves; ingen rettighedsændring sker ved import.
11. **Pr.-instans:** hver kørsel skriver kun til **én** instans (`--instans`). Samme fil kan ikke importeres til to instanser med ét kald; tværgående nationale kilder (DMI, Folketinget …) oprettes som **separate rækker pr. instans** (egen `geoFilter`).

**`sources:check` (robots/ToS-tjek – udføres separat og logges).** Importen tjekker intet. `sources:check` (CLI/UI/operatørværktøj, `confirm`) tager rækker med `urlOrEndpoint` og: henter `robots.txt` via `safeFetch` (§4), sætter `aiHostile`, kører `feed-discovery` (§2.8) for at foreslå `RSS`/`ATOM`/`SITEMAP` i stedet for `HTML_MONITOR`, tester adapteren (antal items, parser-lag) og skriver `IngestionLog` (`outcome`) samt en `AuditLog`-post `localrating.source.check`. **`robotsTermsCheckedAt` sættes først af et menneske** (efter at have læst ToS/API-vilkår og udfyldt `rightsNote`) — eller automatisk kun for `robots`-delen med feltet `parserConfig.robotsCheckedAt`; ToS-delen er altid manuel. Aktivering (`enabled=true`) kræver: `approvalStatus="godkendt"`, `urlOrEndpoint` sat, `robotsTermsCheckedAt` sat, vellykket test, og (hvis `rightsLevel` > `metadata_only`) `rightsNote`.

**De to `.md`-filer er kilde-til-sandhed.** De ligger uændret i `docs/localrating/source-registries/` (ejerens filer; ændres via commit/PR, aldrig automatisk fra databasen). Databasen er en *operationel kopi* der kan genopbygges fra filerne + overlay + menneskelige beslutninger; en tørkørsel viser altid **drift** mellem fil og database. Sandheden om *hvad* der overvåges ligger i filen; sandheden om *hvad der er godkendt og tændt* ligger i databasen. Nye by-registre (Roskilde, Holbæk …) tilføjes som nye filer i samme mappe med samme tabelformat.

### 11d. Discovery-job: `discoverSources(instance)`

Job (`ProductionJob.kind = DISCOVER_SOURCES`, ugentligt via `tick`-planlægning eller manuelt fra UI/operatør; `dedupeKey = discover:<instans>:<ISO-uge>`) der udfører registrets 10 trin. Tilstand i `SourceDiscoveryRun.steps/stats`; ingen ny infrastruktur (små, idempotente jobs: `DISCOVER_SOURCES` → fan-out `DISCOVER_SEED` pr. godkendt seed → `DISCOVER_HOST` i batches).

| # | Registrets trin | Realisering |
|---|---|---|
| 1 | hente Foreningsportalen | Godkendte `SEED_DIRECTORY`-rækker med `sourceClass=forening` (Næstved Foreningsportalen; Slagelse **Winkas**-oversigt). Seed-adapteren (`parserType=seed-directory`, `parserConfig` med listemønster) udtrækker foreningsposter (navn, officiel URL hvis angivet, kategori) → "association record" (midlertidigt, ikke en tabel; resultatet er forslag til child sources) |
| 2 | hente lokalråd/bylaug | Seed med `sourceClass=lokalsamfund`; **følger kun officielle links** fra kommunens oversigt; nyheds-/kalender-/mødesider foreslås som child sources |
| 3 | hente skoler/institutioner | Seeds: kommunale folkeskoler, privat-/friskoler, dagtilbud, uddannelsesinstitutioner, kirker/sogne (sogn.dk) |
| 4 | opdatere lokal CVR-population | CVR-adapter (kræver adgang/aftale, **D30**) henter virksomheder i kommunekode/postnumre → `LocalEntityRef(kind=cvr/pnummer, origin=cvr)`; prioritering efter registrets liste (større arbejdspladser, nye, status-/ledelsesændringer, havn/forsyning/infrastruktur, miljørisiko-/tilsynsvirksomheder, kommunale kontrakter, byudviklingsprojekter) via `meta.priorityReasons`. **Enkeltmandsvirksomheder og privatpersoner lagres ikke** (D31). Uden CVR-adgang springes trinnet over (`stats.cvrSkipped=true`) |
| 5 | finde officielle websites | Kun fra seed-posten/CVR-feltet (officielt websitefelt); **ingen web-søgning** (jf. §2.8: DuckDuckGo droppet) og ingen gætning af domæner |
| 6 | opdage RSS/Atom/sitemaps/news/events | `feed-discovery`: `link[rel=alternate]` (RSS/Atom), `robots.txt` `Sitemap:`, `/sitemap.xml`, og interne links på forsiden hvis tekst/sti matcher profildata (`nyheder`, `aktuelt`, `presse`, `kalender`, `arrangementer`, `begivenheder`); **maks 5 sider pr. host pr. kørsel**, dybde 1 |
| 7 | sammenligne med Source Registry | Match mod eksisterende `SourceDefinition` på `urlNorm`/host/`sourceKey`; allerede kendt ⇒ opdatér `lastSuccessAt`/`lastSeen`, ellers nyt forslag |
| 8 | foreslå nye child sources til approval | Opret `SourceDefinition` med `parentSourceId`, `discoveredBy="discovery"`, `discoveryRunId`, `approvalStatus="foreslået"`, `enabled=false`, `rightsLevel="metadata_only"`, `accessMode` efter fund (`RSS`/`ATOM`/`SITEMAP`/`HTML_MONITOR`), `authorityLevel` = forslag arvet fra seed (forening/lokalråd/skole/CVR-virksomhed ⇒ `PRIMARY_ORGANIZATION`), `aiClassification` (AI's forslag til type/relevans — kun forslag). Vises i godkendelseskøen `/redaktion/produktion/kilder` (D29) |
| 9 | markere døde/flyttede sources | Child med ≥ 4 på hinanden følgende ugentlige fejl (404/410/DNS/timeout) ⇒ `status="dead"`, `enabled=false`; permanent redirect (301/308) til anden vært/sti i ≥ 2 kørsler ⇒ `status="moved"`, `movedToUrl` sat, **nyt forslag** oprettes for målet (aldrig automatisk følgning); post der forsvinder fra seed ⇒ markeres `orphaned` i `parserConfig` til gennemgang (ikke slukket automatisk) |
| 10 | lære nye stedaliaser | Steder fundet i seed-poster (bynavne, bydele, sogne, adresse-byer) som ikke findes som godkendt `LocalEntityRef`/`GeoTag` ⇒ `LocalEntityRef(place_alias, status=foreslået, origin=discovery)` + "GeoTag-gap"-forslag i UI. LocalRating **skriver aldrig `GeoTag`** (kernen uændret) og sender kun alias-forslag til Knowledge OS hvis `knowledgeEnabled` (ADR-004) |

**Regler (registret: "AI må klassificere kildetype og relevans, men ikke automatisk ophøje ukendte sites til verificerede primærkilder"):**
- AI (gateway, task `triage`, `no_pii`) må **kun** skrive `SourceDefinition.aiClassification` og foreslå felter; den må **aldrig** sætte `approvalStatus="godkendt"`, `enabled=true`, `rightsLevel` > `metadata_only`, `authorityLevel=PRIMARY_*` som endelig værdi eller `robotsTermsCheckedAt`. Test: fuzz mod AI-output, ingen sti fra `aiClassification` til disse felter (invariant I-S3, §11e/`11-…`).
- Godkendelse kræver et menneske med `production.manage`; godkendelse som `PRIMARY_OFFICIAL`/`PRIMARY_ORGANIZATION`, eller rights > `metadata_only`, kræver `production.rights.manage` + `approvalNote`. Børn kan kun godkendes hvis forælderen er `godkendt`. Bulk-godkendelse pr. forælder (≤ 25 rækker med samme foreslåede autoritet) er tilladt efter stikprøve-visning.
- **SSRF-undtagelse S16b (præciserer S16):** S16 forbyder server-side hentning af URL'er *fra feed-indhold*. Discovery **skal** hente officielle websites fra seed-kataloger. Undtagelsen gælder **udelukkende** `DISCOVER_HOST`-jobs og kun når: (i) URL'en stammer fra en `godkendt` `SEED_DIRECTORY`/CVR-post, (ii) alle S1–S15 gælder uændret (`safeFetch`, robots, 1 forespørgsel/sek./host), (iii) maks 300 værter/kørsel og 5 sider/vært, (iv) kun `text/html`/XML/feed-typer, ingen JS-eksekvering, (v) intet indhold fra hentede sider gemmes ud over URL'er, titler, feed-/sitemap-links og dato (metadata), (vi) `aiHostile`-værter får aldrig AI-klassifikation af sideindhold (kun regelbaseret). Alle andre feed-`item.link`-URL'er hentes stadig aldrig.
- Kørslen er read-only mod CMS-kernen; skriver kun `SourceDefinition`/`LocalEntityRef`/`SourceDiscoveryRun`/`ProductionJob`/`AuditLog`/`IngestionLog`.

### 11e. Lokal-relevans-scoring (`localityScore`)

Registrene: *"Lokal relevans må ikke være et simpelt `contains("Næstved")`"*; et nationalt dokument kan være lokalt uden at nævne byen. Modulet `lib/localrating/locality.ts` er en **ren funktion** (ingen I/O, `now` ikke nødvendig):

```ts
scoreLocality(item: LocalityInput, ctx: LocalityContext, cfg: LocalityConfig): { score: number /*0-100 heltal*/; breakdown: LocalitySignal[]; band: "local" | "maybe" | "not_local"; rule?: string }
// ctx = instansens GODKENDTE LocalEntityRef (aliaser, postnumre, kommunekode, cvr/pnummer, matrikler, institutioner, personer), GeoTags,
//       SourceDefinition (geoFilter, instanceScope, keywordFilters), eksisterende kandidater/Story-lokalitet (kun id'er/scores)
```

**Signaler (vægt `w` er profildata i `LocalityConfig`, versioneret som `RatingProfileVersion.config.locality`; `m ∈ [0,1]` er matchstyrke):**

| Id | Signal | Udledes af (deterministisk) | Standardvægt `w` |
|---|---|---|---|
| L1 | Eksplicit sted i overskrift | alias/GeoTag-navn i titel (ord-grænse, translittereret; `m=1`; tvetydigt alias: `m=0,5`) | 0,80 |
| L1b | Eksplicit sted i brødtekst/uddrag | samme, kun tekst AI/rights tillader | 0,60 |
| L2 | Adresse / postnummer | postnr. i `LocalEntityRef(postcode)` (`m=1`), adresse opløst til kommune (`m=1`, `w` 0,90) | 0,55 / 0,90 |
| L3 | `kommuneId` | kommunekode i struktureret payload = instansens (Plandata, DST-område, Statstidende m.fl.) | 0,90 |
| L4 | Geometri | punkt/polygon i kommunens polygon (0,85) eller kun bounding box (`m=0,5`) | 0,85 |
| L5 | Matrikel | matrikel i `LocalEntityRef(matrikel)` (ekspropriation, lokalplan) | 0,90 |
| L6 | CVR/P-nummer | `LocalEntityRef(cvr|pnummer)` godkendt i instansen | 0,85 |
| L7 | Institution | skole, sygehus, havn, kirke, forening i `LocalEntityRef(institution|forening|skole|organisation)` | 0,75 |
| L8 | Person/entity-relation | godkendt lokal person/rolleindehaver (borgmester, formand …) – **kun** når `personDataClass` tillader | 0,50 |
| L9 | Entitetsrelation | relateret til lokal entitet (leverandør/kontrakt med kommunen, projektpart) | 0,40 |
| L10 | Eksisterende Story-lokalitet | `storyMatches` mod kandidat/Story med `localityScore ≥ 60` eller `geoTagIds` | 0,60 |
| L11 | Kildens iboende lokalitet | `instanceScope=instance` & `geoFilter` (`w` 0,65); `region` 0,35; `national` 0 | 0,65 / 0,35 / 0 |
| L12 | `keywordFilters`-træf | fx "Næstved–Rønnede" | 0,30 |

**Kombination (støj-ELLER, så ét stærkt signal er nok, men flere svage ikke summerer ud af kontrol):** `score = round(100 · (1 − Π(1 − w_i·m_i)))`. **Lofter/gulve (profildata, logges i `breakdown.rule`):** (1) *konfliktsted*: findes et sted der hører til **en anden** kommunekode og intet lokalt signal ⇒ `score ≤ 40` (`rule=foreign_place_cap`); (2) tvetydigt alias alene ⇒ `≤ 55`; (3) `SECONDARY_MEDIA`/`AGGREGATOR` alene på L1 ⇒ `≤ 80`; (4) kilde med `instanceScope=instance` får gulv `65` (kommunens egen dagsorden er lokal pr. definition) men kandidater kan stadig afvises af rating. **Bånd:** ≥ 70 `local`, 40–69 `maybe`, < 40 `not_local`. **Tærskel for at danne kandidat** (profildata, pr. `instanceScope`): `instance` 0, `region` 40, `national` 60; under tærsklen ⇒ `SourceItem.status="filtered"` (`reason=locality`), kun hash/metadata gemmes, kort retention (7 dage).

**Hvornår:** i `PROCESS_ITEM` efter normalisering og før dedupe/kandidat. I **Fase 2** leveres en *forfilter-udgave* (L1, L3, L5, L6, L11, nøgleord) så nationale kilder (Folketinget, Retsinformation, Statstidende) ikke fylder databasen; **Fase 3** leverer alle signaler, kalibrering, `StoryCandidate.localityScore`, klynger og `rating`-integration (`05-…` §5.1b). DAWA/Matriklen-opslag sker **ikke** pr. item: adresser/matrikler hentes ugentligt som `LocalEntityRef` (Dataforsyningen) og slås op lokalt.

**Testbare cases (`tests/localrating-locality.test.ts`; ren funktion, fixtures pr. instans):**

| # | Input | Forventet |
|---|---|---|
| T1 | Overskrift "Næstved Havn udvider kaj" | `score ≥ 80`, `local` |
| T2 | **Nationalt dokument** (Folketingsbilag) uden ordet "Næstved", men med CVR for en godkendt lokal virksomhed | `≥ 70`, `rule` tom, signal L6 |
| T3 | Statstidende-konkurs: postnr. 4700 + CVR i kommunen, ingen bynavn | `≥ 70` |
| T4 | Ekspropriation med matrikelnr. i godkendt `LocalEntityRef` | `≥ 80` (L5) |
| T5 | Plandata-objekt med `kommunekode=370` i payload | `≥ 85` (L3) |
| T6 | National nyhed om "Holbæk" (anden kommunekode) uden lokale signaler | `≤ 40` (`foreign_place_cap`) |
| T7 | Tvetydigt alias alene (fx et stednavn der findes i flere kommuner) | `≤ 55`; med postnr. som andet signal ⇒ `≥ 70` |
| T8 | Folketingsspørgsmål om "E47" uden by, men nøgleord "Næstved–Rønnede" + kendt Story-lokalitet (L10+L12) | `≥ 60` |
| T9 | TV2 ØST-overskrift med by i titlen | `≤ 80` (sekundær-loft) |
| T10 | Kommunens egen dagsorden uden by i titlen (`instanceScope=instance`) | `≥ 65` (L11-gulv) |
| T11 | **Tenant:** samme tekst scoret mod to instanser | forskellig score; ingen læk af den anden instans' `LocalEntityRef` |
| T12 | Kun `contains(<bynavn>)` i en uddragstekst fra `metadata_only` (ingen brødtekst) | scorer kun L1 hvis i overskrift; ellers 0 |
| T13 | **Ingen hardcodede bynavne:** scanning af `lib/localrating/locality.ts` og `sources/**` efter strenge fra geo-kernerne ("Næstved", "Slagelse", "Karrebæksminde", "370", "330") | ingen forekomster (som I14 i `05-…`) |
| T14 | Determinisme/monotoni: tilføjelse af et signal sænker aldrig scoren; samme input ⇒ identisk output | |

### 11f. Prioritet → `pollIntervalMinutes` og realisering uden ny infrastruktur

| Prioritet | Registrets mål | `pollIntervalMinutes` (default) | Realisering |
|---|---|---|---|
| **P0** breaking/drift | poll/push 1–5 min | **5** (API/RSS/HTML), push hvor kilden tilbyder det | Railway-cron har minimum 5 min (T8 §5.1) ⇒ `tick` hvert 5. minut er **effektivt gulv**. **Afvigelse fra registrets "1–5 min":** 1–4 minutter er kun muligt via push/webhook, e-mail-indtag eller en separat worker-service (ADR-005 "senere mulighed") – **ikke i v1** (D32/ejer). Validering: `pollIntervalMinutes ≥ 5` for P0-API/RSS med `authorityLevel=PRIMARY_*`; ellers ≥ 15 |
| **P1** primære story-generators | 15–60 min eller efter releaseplan | **30** (API 15; PDF-/HTML-monitor 60; statistik-API'er 1.440 efter releaseplan) | Samme `tick`; `nextFetchAt = now + interval` med jitter |
| **P2** discovery/lokal puls | 1–12 timer | **360** (medier 60–120; seed-/child-kilder 720) | Samme `tick`; natlige pauser (profildata: 23–05 kun P0) |

**Realisering (ingen ny infrastruktur, bygger på `04-…` §3):**
- `tick` planlægger forfaldne kilder med `ORDER BY priority, nextFetchAt` og reserverer kapacitet: P0 får op til halvdelen af tickets jobbudget (`TICK_BUDGET_MS=40_000`, samtidighed 6, ≤ 1 pr. host), så P2 aldrig udsulter P0. `ProductionJob.priority`: P0 = 10, P1 = 50, P2 = 100.
- **Små idempotente batches:** `FETCH_FEED`-job pr. kilde med `dedupeKey = "fetch:<sourceId>:<floor(now/pollInterval)>"`; kun `approvalStatus="godkendt"`, `enabled`, `ingestOwner="localrating"`; kilder uden URL eller med `robotsTermsCheckedAt=null` springes over (`IngestionLog.outcome=skipped_unchecked`). Resterende arbejde tages i næste tick (`remaining` i svaret).
- **Kapacitet (overslag, uverificeret):** Næstved 18 P0 + Slagelse 14 P0 = 32 P0-hentninger pr. 5 min ≈ 32/6 samtidige ≈ 6 bølger × ~2–3 s ⇒ ~15–20 s hvis kilderne svarer; worst case timeouts (15 s) overskrider budgettet ⇒ resten i næste tick. Ved vedvarende overskridelse: sænk P0-poll for sekundære P0-kilder (fx fjernvarme) til 15 min eller tilføj en 2. cron-service (`?task=tick&tiers=P0`).
- **Fejl/backoff** (som `04-…` §3.5) men med tier-loft: P0 maks 30 min, P1 2 t, P2 6 t; `Retry-After`/`Crawl-delay` respekteres; 5 fejl ⇒ `down`, 4 ugentlige ⇒ `dead` (discovery-børn).
- **Push/webhook hvor tilbudt:** `POST /api/webhooks/localrating/<sourceId>` (HMAC-signatur med global `LOCALRATING_WEBHOOK_SECRET`, ingen hemmeligheder i tabeller; kun for `accessMode=WEBHOOK`). Hvilke kilder der faktisk tilbyder push er **uverificeret**; e-mail-/SMS-kanaler (Storebælt, dagsordener, nyhedsbreve) kræver indgående e-mail (ny infrastruktur) og er derfor `altAccess` (D30).
- **Afhængighed af `ingestOwner`:** kilder med `ailibrary` poller LocalRating ikke; deres P0-hastighed styres af aI-library (Cloud Scheduler).

### 11g. MVP-rækkefølge pr. by (Fase 2-køliste)

**Princip: byg adapteren én gang, konfigurér den pr. by som data.** Næstved og Slagelse kører som **pilot samtidigt** (D6); de fleste adaptere (politi, DMI, Plandata, Folketinget, Retsinformation, Statstidende, CVR, DST, Jobindsats, Rejseplanen, udbud/TED, kommunale monitorer) er identiske og adskiller sig kun i `SourceDefinition`-rækkerne. Kolonnen **Afh.** angiver afhængigheder: **–** ren feed/åben side; **N** nøgle/konto; **A** aftale/licens; **D18** afventer ownership; **D31** persondatapolitik; **U** adgangsvej uverificeret.

**Næstved – de 24 integrationer fra registret (rækkefølgen er registrets):**

| # | Integration | Pri | Adgang | Afh. | Fase 2-bølge |
|---|---|---|---|---|---|
| 1 | Politi Update + døgnrapporter | P0 | RSS + HTML | D18 (aI-library leverer i dag), U; politi ⇒ `restricted` | B (efter D18) |
| 2 | Midt- og Sydsjællands Brand & Redning | P0 | HTML | U; `beredskab_112` ⇒ `restricted` | A |
| 3 | Kommune: nyheder/presse | P1 | HTML (RSS ikke fundet, T8) | U (URL-research) | A |
| 4 | Dagsordener og referater | P1 | PDF-monitor | D18, U | B |
| 5 | Høringer/borgermøder | P1 | ATOM (Høringsportalen, T8-verificeret) + HTML | – | **A (første rene feed)** |
| 6 | Lokalplanportal + Plandata | P1 | HTML + WFS | – (T8: GetCapabilities verificeret) | A |
| 7 | Udbud, udbudsplan, udbud.dk, TED | P1 | HTML + API | U (TED N?) | B |
| 8 | Folketingets åbne data | P1 | OData | U | B |
| 9 | Retsinformation | P1 | API | U | B |
| 10 | Statstidende | P1 | API | N? U; `personDataClass=possible` | B |
| 11 | Retten i Næstved – retslister | P1 | PDF-monitor | **D31**, U | **D (efter persondatapolitik)** |
| 12 | CVR | P1 | API | **N+A** (D30) | C |
| 13 | DST StatBank | P1 | API | U | B |
| 14 | Jobindsats API v3 | P1 | API | N? U | C |
| 15 | DMI | P0 | API | D18; N? | B |
| 16 | Vejdirektoratet, DSB, Banedanmark, Movia/Rejseplanen | P0 | DATEX II/HTML/API/GTFS | Vejdirektoratet **N** (T8), Rejseplanen **N+A**, Movia N/A?, DSB/Banedanmark – | A (DSB/Banedanmark) · C (Vejdirektoratet/Rejseplanen/Movia) |
| 17 | NK-Forsyning / Envafors transition | P0 | HTML | – | A |
| 18 | Næstved Fjernvarme + øvrige lokale værker (3) | P0 | HTML | – | A |
| 19 | AffaldPlus | P0 | HTML | – | A |
| 20 | Region Sjælland / Næstved Sygehus | P0 | HTML | – | A |
| 21 | Næstved Havn | P1 | HTML | – | A |
| 22 | Næstved Erhverv | P1 | HTML | – | A |
| 23 | Foreningsportalen + lokalråd/bylaug (seed directories) | P2 | SEED | – (kræver discovery §11d + godkendelseskø D29) | E |
| 24 | Lokale medier (discovery/krydstjek) | P2 | RSS (TV2 ØST, T8) + HTML | rights `metadata_only`; `aiHostile` | A (TV2 ØST) · C (øvrige) |

**Slagelse – registrets "første implementeringsprioritet":** Politi Update + døgnrapporter (D18) → Slagelse Kommune (nyheder; dagsordener D18; høringer + Plandata) → udbud (+ TED) → Via Ritzau → Statstidende → Folketinget → Retsinformation → CVR (N+A) → DST → Jobindsats → DMI (D18) → **Storebælt/Sund & Bælt** (HTML; mail/SMS udskudt) → transport/forsyning (DSB, Banedanmark, Rejseplanen N+A, Cerius, Envafors, AffaldPlus, Agersø-Omø Færgerne) → Region Sjælland → Winkas-foreningsregisteret (SEED; bølge E). Slagelse-specifikke rækker uden Næstved-pendant: Storebælt (2), Cerius, Agersø-Omø Færgerne, Korsør/Skælskør Havn, Forsvaret/Gardehusarregimentet, 112news.dk, SlagelseJournalen/Slagelse.info-gruppen, SlagelsePortal, Indkøbs-/leverandørdata.

**Bølger (sekvens i Fase 2; hver bølge er et sammenhængende leveranceafsnit):**

| Bølge | Indhold | Afhænger af | Eksempler |
|---|---|---|---|
| **A** rene feeds/åbne sider | Adaptere `rss-parser`, `atom`, `html-change`/`html-list`, `wfs` (Plandata); URL-research via overlay; manuel aktivering efter `sources:check` | Fase 1 + `safeFetch`/parser; D9 (`cheerio`) | Høringsportalen, Plandata, kommune-nyheder, forsyning/fjernvarme, affald, DSB, Banedanmark, Brand & Redning, Havne, Erhverv, TV2 ØST |
| **B** åbne API'er uden aftale (U/N?) | Adaptere `odata`, `json-api` (Retsinformation, Statstidende, TED, DST, DMI) + dokumentation af vilkår i `rightsNote`; `ingestOwner`-afklaring | D18, D7 | Folketinget, Retsinformation, Statstidende, DST, TED, DMI, politi/dagsorden (hvis LocalRating ejer) |
| **C** nøgle/aftale | CVR, Jobindsats, Rejseplanen/GTFS, Vejdirektoratet DATEX II, Movia, BBR | D30 (aftaler, nøgler som Railway-variabler) | |
| **D** persondata | Retslister, Statstidende-persondata, sociale signaler, tips | D31 | |
| **E** seeds/discovery | `SEED_DIRECTORY`-adaptere + `discoverSources` + godkendelseskø | `localrating_sources`-migration, D29, CVR (valgfri) | Foreningsportalen/Winkas, lokalråd, skoler, virksomhedsnewsrooms |
| **F** licens | Ritzau nyhedstjeneste | **A** (licens) | |

**Hvad der kræver nøgler/aftaler før aktivering:** se opsummeringen i `12-…` D30 (CVR, Rejseplanen/GTFS+SIRI, Vejdirektoratet DATEX II, Ritzau nyhedstjeneste, Jobindsats og DMI hvis nøgle kræves, Statstidende hvis tilmelding kræves, TED/DAWA hvis nøgle kræves, Movia, BBR/Datafordeler, officielle sociale API'er) — alle markeret **uverificeret** her; verificeres under bølge B/C.

## 12. Åbne spørgsmål (kilderegistre; yderligere til §10)

1. **D29** Godkendelsesflow for AI-opdagede child sources (hvem, hvor mange pr. bulk, krav til stikprøve) – `12-…`.
2. **D30** Tilladte `accessMode` pr. kilde; hvem ejer licens-/API-aftaler (Ritzau, Rejseplanen/GTFS+SIRI, CVR, Statstidende, TED, Vejdirektoratet DATEX II, Movia, BBR/Datafordeler, sociale API'er) og hvor nøgler lagres (kun Railway-variabler).
3. **D31** Persondatapolitik for retslister/CVR/Statstidende/tips: retention (30 dage?), maskering, om retslister overhovedet må indgå, og hvem foretager den redaktionelle gennemgang.
4. **D32** Hvilke af registrenes 167 rækker (93 + 74) aktiveres først pr. by (forslag: bølge A + B, §11g).
5. P0-gulv 5 min (Railway-cron) vs. registrets 1–5 min: acceptabelt, eller ønskes en worker-service/push (§11f)?
6. `cheerio` (HTML_MONITOR) og en PDF-parser: ja/nej/hvornår (D9)?
7. `ingestOwner` pr. kilde (D18): skal LocalRating overtage politi/dagsordener/trafik/DMI fra aI-library, og hvornår slukkes den tilsvarende aI-library-agent?
8. Må AI-klassifikation (`triage`) køre på sideindhold fra discovery (undtagen `aiHostile`), eller kun på metadata (titel/URL)? Default: kun metadata + regelbaseret.


## 12. Manuel hentning (ejerens beslutning, ADR-016)
Indtil ejeren slår automatik til, hentes kilder **kun med en knap**. Cron-endpointet `/api/cron/localrating` bygges, men afviser kald (`409`) medmindre både `LOCALRATING_AUTOPOLL=1` og `LocalRatingConfig.autoPollEnabled=true`. Knapper: "Hent nu" (pr. kilde), "Hent alle aktive" (valgfrit filter), "Test", "Opdag nye kilder". Kun aktive, godkendte kilder med gyldig URL hentes. Cooldown pr. kilde, maks. 3 samtidige hentninger pr. instans, fremdrift via `ProductionJob`, audit pr. knaptryk, SSRF og `rightsLevel` uændret. Alle "poll-interval"-felter er **vejledende metadata**, indtil automatik aktiveres.
