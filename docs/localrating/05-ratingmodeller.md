# 05 – Ratingmodeller: `RatingModel`, modellen `score` (Local Score = porteret Y Rating) og modellen `local` (ny)

Dato: 2. oktober 2026 (opdateret 3. oktober 2026: lokale signaler fra kilderegistrene, §5.1b og I21-I25). Status: Fase 0 (design). Kilder: master-spec §10-§11, §27, §28, §31; planens Tilføjelse 2 og beslutning 3; Y: `sireRoute.ts:1759-2050`, `businessArticleTypes.ts:758-791`.

## 1. Principper

1. **Editorial Rating er pre-publication** ("Hvor interessant er dette som journalistisk mulighed?"). Den må ikke blandes med forsidens post-publication-ranking (`lib/frontpage/*`, `lib/distribution-engine.ts`) – spec §10, §31. Ingen kodedeling mellem dem; kun simulatoren *læser* begge.
2. **AI estimerer delscorer og begrundelser – aldrig total, bånd eller A/B/C.** Total, tærskler, regler og A/B/C-forslag beregnes transparent af en ren funktion (`RatingModel.score`) ud fra *konfiguration som data* (`RatingProfileVersion.config`). Ingen "AI score = 87" (spec §10).
3. **Alle delscorer gemmes** (`RatingRun.dimensions` + `features` + `deterministic`) sammen med profilversion, modelversion, input-hash og tidspunkt (spec §10, §31). Total alene er aldrig nok.
4. **To udskiftelige modeller** bag samme grænseflade og samme `RatingRun`-form, så de kan køre side om side på samme kandidat og sammenlignes (plan Tilføjelse 2).
5. **Intet hardcodet**: vægte, tærskler, regler, halveringstider, kildetype-priors, nøgleord og "småby"-lister ligger i profilen; bynavne findes kun som `GeoTag`-data pr. instans (spec §31 "hardcode ikke bynavne").
6. **Sponsoreret/kommercielt indhold påvirker aldrig editorial score** (spec §28): ratinginputtet indeholder ingen felter om annoncer, sponsorer, kampagner eller `indholdstype` (se invariant I15).
7. **Rights-gate først:** hvad AI må *se* afgøres af kildens `rightsLevel` (`10-…` §5). Ratingen fungerer også på kun overskrift (`aiInput="headline"`), men med deterministiske lofter på verifikation og publicérbarhed.

## 2. Grænseflade og dataflow

Signaturer: `04-service-graenser-og-events.md` §2.5. Flow pr. kørsel:

```
RatingInput (kandidat + SourceItems efter rights-gate + geo + kontekst)
   │
   ├─► computeDeterministic()  → geoFit, localityScore, sourceAuthority, clusterStrength, sourceQuality, timeliness*, duplication, civicSignal, tipSupport, caps-inputs
   │                              (* storyType kommer fra AI; formlen er deterministisk)
   ├─► AI (PromptTemplate "rating.<model>")  → Estimates (zod): delscorer 0-100 + begrundelser + storyType + flag
   │
   └─► score(est, det, config) → dimensions{} · total · band · A/B/C · priorityConfidence · priorityReason · explanation · flags
        PURE: samme input ⇒ samme output (bit-identisk), ingen I/O, ingen `Date.now()` (now ligger i `det`)
```
`RatingRun` gemmer: `features` (rå validerede AI-estimater), `deterministic`, `dimensions` (endelige), `total`, `band`, `suggestedPriority`, `priorityConfidence`, `priorityReason`, `explanation`, `flags`, `profileVersionId`, `modelId`, `modelVersion`, `inputHash`, `inputVersion`, `promptVersionId`, `aiProvider/aiModel`, `ratedAt`, `usageId`.

**Fejl:** AI-timeout/budget/ugyldig JSON (efter ét reparationsforsøg) ⇒ ingen `RatingRun` med score; kandidaten forbliver `new`; job genforsøges (`04` §3.5). Aldrig stille 0-score.

## 3. Bånd og tærskler (fælles for begge modeller)

Fælles bånd-enum (spec §11): `IGNORE`, `REVIEW`, `POTENTIAL`, `HIGH`, `URGENT`. Tærsklerne ligger i profilen (`thresholds: [{min, band}]`, faldende), så de kan ændres uden kode.

| Profil | IGNORE | REVIEW | POTENTIAL | HIGH | URGENT | Bemærkning |
|---|---|---|---|---|---|---|
| `default-local-news` (spec §11) | 0–29 | 30–49 | 50–69 | 70–84 | 85–100 | `total` sammenlignes direkte mod `min` (29,9 ⇒ IGNORE; 30,0 ⇒ REVIEW) |
| `local-score` (Y: `businessArticleTypes.ts:783-785`) | < 40 (`ignore`) | 40–54 (`low`) | 55–69 (`watch`) | 70–84 (`high`) | ≥ 85 (`critical`) | Bånd-*navne* mappes (critical→URGENT …); *tallene* er Y's og bevares for 1:1-reproduktion. `yLabel` gemmes i `explanation` |

**Foreslået A/B/C** (spec §11; endelig A/B/C vælges i CMS'et, aldrig her). Regelsæt i profilen (`priorityRules`), default for `local`:
- **A**: `total ≥ 80` og `localRelevance ≥ 70` og `verificationConfidence ≥ 50`; *eller* `storyType = BREAKING` og `total ≥ 70` og `verificationConfidence ≥ 50`.
- **B**: `total ≥ 55` (og ikke A).
- **C**: `total ≥ 30` (og ikke B).
- ellers `null`.
For `score`: `URGENT→A`, `HIGH→B`, `POTENTIAL→C`, ellers `null` (kun for sammenligning).

**priorityConfidence** (0,1–0,95; deterministisk): `0,40 + 0,30·min(verificationConfidence, sourceQuality)/100 + 0,15·[aiInput ≠ headline] + 0,10·[knowledge=ok] − 0,10·(antal udløste cap-regler, maks 3)`, klampet til [0,10; 0,95].
**priorityReason** (dansk, deterministisk skabelon): "Foreslår A: høj lokal relevans (92), aktualitet (88) og kommunal kilde (80). Svagest: eksklusivitet (20). Regler: ingen." – bygget af de 3 største positive og 1 største negative bidrag + udløste regler fra `explanation`. Ingen LLM-formuleret begrundelse i selve prioriteringen (AI's begrundelser pr. dimension gemmes og vises separat).

## 4. Modellen `score` (Local Score = porteret Y Rating)

Mål: **reproducere Y's tal 1:1** for samme AI-output. Ingen forbedringer i matematikken (forbedringer ⇒ ny `modelVersion` og ny model, ikke ændring af `score`).

### 4.1 Dimensioner og vægte (REUSE; Y: `businessArticleTypes.ts:758-776`, `sireRoute.ts:1860-1870`, `:2013-2021`)

| Dimension | Vægt | Kilde |
|---|---|---|
| `audience_relevance` | 0,20 | AI |
| `impact` | 0,15 | AI |
| `counter_narrative_value` | 0,15 | AI |
| `perspective_value` | 0,15 | AI |
| `decision_value` | 0,15 | AI |
| `trust` | 0,15 | AI |
| `production_potential` | 0,05 | AI |

`local_score` (Y: `y_score`) `= Math.round(Σ rating × weight)` (hver rating først `clampScore`: ikke-endelig ⇒ 0, ellers 0–100; `sireRoute.ts:1969-1973`).

### 4.2 Øvrige Y-beregninger (alle **server-side**, aldrig LLM)
- **11 journalistiske funktioner** (0–100) fra AI: `challenge, blind_spot, perspective, mythbuster, signal, threat, opportunity, inspiration, guide, curiosity, solution` (`sireRoute.ts:1777-1857`).
- `primary_function` = højeste score; ved lighed `TIEBREAK_ORDER = challenge → blind_spot → solution → threat → signal → perspective → mythbuster → opportunity → inspiration → guide → curiosity` (`:366-369`, `:1953-1967`).
- `secondary_functions` = op til 3 med score > 50, uden primær, faldende (`:2027-2034`).
- `editorial_pillar` og `recommended_format` fra faste maps `PILLAR_BY_FUNCTION`/`FORMAT_BY_FUNCTION` (`:337-363`, `:2036-2040`).
- **Pillar-scores** (`:1975-2007`): Challenge = `challenge·.30 + blind_spot·.25 + mythbuster·.15 + threat·.10 + perspective·.10 + signal·.05 + trust·.05`; Inspire = `solution·.25 + opportunity·.22 + guide·.20 + inspiration·.18 + signal·.05 + perspective·.05 + trust·.05`; Understand = `perspective·.30 + signal·.25 + curiosity·.10 + threat·.10 + opportunity·.08 + challenge·.07 + trust·.10` (hver `Math.round`).
- **Bånd** `critical ≥ 85 · high ≥ 70 · watch ≥ 55 · low ≥ 40 · ignore` (`:2022-2023`).
- Taksonomi (`taxonomy.ts:230-267`) bruges ikke af `score`-modellens score (kun visning); i LocalRating erstattes den af instansens kategori-/geo-data (`taxonomy.ts` i `lib/localrating`).
- AI-outputtets egne felter `local_score` (Y: `y_score`), `priority`, `primary_function`, `secondary_functions`, `editorial_pillar`, `recommended_format`, `pillar_scores` **ignoreres og overskrives** (som Y gør: `:2009-2050`).

### 4.3 Konfiguration (`local-score` / `RatingProfileVersion.config`, uddrag)
```json
{
  "model": "score",
  "weights": { "audience_relevance": 0.20, "impact": 0.15, "counter_narrative_value": 0.15, "perspective_value": 0.15, "decision_value": 0.15, "trust": 0.15, "production_potential": 0.05 },
  "thresholds": [ {"min":85,"band":"URGENT","yLabel":"critical"}, {"min":70,"band":"HIGH","yLabel":"high"}, {"min":55,"band":"POTENTIAL","yLabel":"watch"}, {"min":40,"band":"REVIEW","yLabel":"low"}, {"min":0,"band":"IGNORE","yLabel":"ignore"} ],
  "functions": { "tiebreak": ["challenge","blind_spot","solution","threat","signal","perspective","mythbuster","opportunity","inspiration","guide","curiosity"], "secondaryMin": 50, "secondaryMax": 3 },
  "pillarWeights": { "challenge": {"challenge":0.30,"blind_spot":0.25,"mythbuster":0.15,"threat":0.10,"perspective":0.10,"signal":0.05,"trust":0.05}, "inspire": { "...": "..." }, "understand": { "...": "..." } },
  "priorityRules": [ {"band":"URGENT","priority":"A"}, {"band":"HIGH","priority":"B"}, {"band":"POTENTIAL","priority":"C"} ]
}
```
Prompten (`rating.score`) er den porterede SIRE-prompt (`sireRoute.ts:1759-1947`) som `PromptTemplateVersion` 1. Bemærk: Y's "korte artikler"-straf (trust/impact ≤ 40, production_potential ≤ 50; `:1881`) er kun en *prompt-instruktion* og håndhæves ikke server-side – `y` bevarer dette (1:1); `local` håndhæver tilsvarende lofter i kode.

### 4.4 Navngivning og feltparitet (ejerens tilføjelse: Y → Local)
Modellen hedder `score` i koden og **Local Score** i UI/brand (Y Rating → LocalRating, Y Score → Local Score, SIRE → LocalRating-motor). **Alle attributter bevares 1:1** (7 `ratings`-dimensioner, 11 `functions`, `primary_function`, `secondary_functions`, `editorial_pillar`, `pillar_scores`, `recommended_format`, `source_risk`, `editorial_warning`, `source_type`, `source_originality`, `source_origin_name`, `topics`, `taxonomy`, `summary`, `why_it_matters`, `possible_angles`, `how_to_elevate`, `missing_sources`, `pairing_potential`). Eneste nøgleomdøbninger: `y_score` → `local_score`, `yRating` → `localRating`, `Y_SCORE_WEIGHTS` → `LOCAL_SCORE_WEIGHTS`, `YRatingDimensions` → `LocalRatingDimensions`. Prioritetsværdierne (`critical/high/watch/low/ignore`) bevares som `yLabel` → omdøbes til `scoreLabel` i `explanation`. Fuld mapping: `README.md` (navne-mapping) og `01-…` §0.

### 4.5 Rolle i LocalRating (paritet med Y Test Lab)
`score` er en **førsteklasses, valgbar model** (profil `local-score`), ikke kun et sammenligningsgrundlag: den driver **Local Lab** (manuel rating af indsat tekst/URL/fil og af feed-items – Y Test Labs kerneflow, `sireRoute.ts` `/rate`, `/rss-items`, `/summary`, `/compare`, `/semantic-search`, `/score-sources`), og kan vælges som aktiv model for en instans eller køre som shadow ved siden af `local`. Y-prompten er skrevet til mediet Y's redaktionelle DNA ("borgerlige" målgruppe, modpol, pillarerne Challenge/Inspire/Understand). Ved omdøbningen bevares **pillarer, funktioner og redaktionel stemme som data** (profilens `pillarWeights`, prompt-tekstens målgruppeafsnit som *redigerbar* promptversion), men brandreferencer ("Projekt Y", "Mediet Y", "Y.dk") erstattes af profil-/instansvariabler (`{{medienavn}}`, `{{målgruppe}}`). Prompt-portering: `07-…` §6.

## 5. Modellen `local` (ny)

### 5.1 Dimensioner (0–100, heltal)

Kolonne **Kilde:** *AI* = estimeret af LLM; *Det* = beregnet deterministisk; *Hybrid* = AI-estimat + deterministiske regler/lofter. Spec §10's 12 dimensioner er markeret **S**, lokale signaler **L**.

| # | Dimension | | Kilde | Definition og beregning |
|---|---|---|---|---|
| 1 | `localRelevance` | S | Hybrid | `round(wGeo·localSignal + (1−wGeo)·ai.localAudienceFit)` (`wGeo=0,5`; `localSignal = max(geoFit, localityScore)`, §5.1b). Loft: hvis `localSignal < 20` ⇒ `≤ capNoGeo (45)`. Bonus `+10` (≤ 100) hvis matchet `GeoTag.slug ∈ smallTownSlugs` (profildata – "småby-match") |
| 2 | `editorialImportance` | S | AI | Samfundsmæssig vigtighed for byens borgere. Anker: 0–20 bagatel · 40 mindre · 60 bemærkelsesværdig · 80 stor · 100 usædvanlig |
| 3 | `timeliness` | S | Det (storyType fra AI) | `round(100 · 0,5^(alderTimer / halveringstid(storyType)))` (spec §17). Alder = `now − (seneste substantielle opdatering ‖ publishedAt ‖ retrievedAt)`. EVENT/SERVICE med AI-leveret `eventTime` inden for næste 72 t ⇒ 100, ≤ 7 dage ⇒ 80, ellers decay. `now` injiceres |
| 4 | `originality` | S | Hybrid | AI-estimat; loft `≤ 40` hvis AI `sourceOriginality = republished`, `≤ 55` hvis `aggregated` |
| 5 | `sourceQuality` | S | Det | `round(0,50·trustLevel + 0,20·typePrior[sourceType] + 0,15·authorityPrior[sourceAuthority] + 0,15·contentDepth)`; `contentDepth` 0 ved `aiInput=headline`, lineært 0→100 fra 200→1.500 tegn brødtekst; `authorityPrior` (profildata, §5.1b): `PRIMARY_OFFICIAL` 90 · `LICENSED_NEWSWIRE` 80 · `PRIMARY_ORGANIZATION` 70 · `SECONDARY_MEDIA` 50 · `AGGREGATOR` 30 · `SOCIAL_SIGNAL` 20 |
| 6 | `verificationConfidence` | S | Hybrid | AI-estimat; lofter: `aiInput=headline` ⇒ `≤ 35`; AI-flag `hasNamedPrimarySource=false` ⇒ `≤ 50`; **kildeautoritet (§5.1b):** `SOCIAL_SIGNAL` ⇒ `≤ 35`, `AGGREGATOR` ⇒ `≤ 45`, `SECONDARY_MEDIA` som eneste kilde ⇒ `≤ 55`. Gulv pr. kildetype fra profil (fx `kommune_dagsorden: 60`) og for `PRIMARY_OFFICIAL` ved faktuelle felter fra API (`60`) |
| 7 | `communityValue` | S | AI | Værdi for lokalsamfundet/foreningsliv/deltagelse |
| 8 | `storyPotential` | S | Hybrid | AI-estimat `+5` (≤ 100) hvis kandidaten har `RELATED`-naboer eller en Knowledge-Story; **`+ clusterBonus`** (0–15) fra story-klynger (§5.1b): `round(0,15 · clusterStrength)` |
| 9 | `publicInterest` | S | AI | Bred offentlig interesse (ikke blot nysgerrighed) |
| 10 | `exclusivity` | S | Hybrid | AI-estimat; loft `≤ 20` hvis samme klynge ses i ≥ 3 forskellige kilder inden 24 t |
| 11 | `duplication` | S | Det | `round(100 · maxLighed)` mod SourceItems/kandidater/artikler/signaler i vinduet; `DUPLICATE ⇒ 100`; `UPDATE ⇒ 35`. **Indgår omvendt** i total (`100 − duplication`) |
| 12 | `publishability` | S | Hybrid | `min(ai.publishability, lofter)`: `restricted` (politi/112/Krimi-Sundhed, `personDataClass=likely`) ⇒ `≤ 25` (kræver menneskelig gennemskrivning); `aiInput=headline` ⇒ `≤ 40`; `localSignal < 20` ⇒ `≤ 60`; ingen kilde-URL ⇒ 0 |
| 13 | `civicSignal` | L | Det | `typePrior[sourceType]` (kommune_dagsorden 80, kommune_pressemeddelelse 55, trafik 65, politi/beredskab 70, lokalt_medie 45, vejr 40, forening 35, klub 30, andet 30 – profildata) `+5` pr. nøgleordstræf i `keywordBoosters` (maks +20) |
| 14 | `tipSupport` | L | Det | Borgertip-klynger: antal unikke tippere og tips (14 dage) i samme `GeoTag` med titel-lighed (Jaccard ≥ 0,25): `min(100, 30·unikke + 10·(tips − unikke))`. **Kun tællinger** fra `Submission`/`MeddelerSag` – aldrig indhold til AI (GDPR) |
| 15 | `civicUtility` | L | AI | Praktisk nytte for borgere: service, frister, lukninger, regler |
| 16 | `localConsequence` | L | AI | Konkret konsekvens for lokale borgere/økonomi/institutioner (penge, job, trafik, tilbud) |

`geoFit` (deterministisk delfeature til #1, ikke selvstændig vægt; **uændret**): match af instansens `GeoTag`s (`lib/ingest/geo.ts:56` `matchGeo`) i overskrift = 100; kun i brødtekst (hvis rights tillader) = 80; by-/kommuneniveau efter `geoKey`-normalisering = 70; kildens egen `geoTagId` uden tekstomtale = 50; ingen = 0; `+5` pr. ekstra distinkt GeoTag (≤ 100). Kun instansens egne GeoTags (tenant). `geoFit` er den billige, GeoTag-baserede delmængde; **`localityScore`** (§5.1b) er den fulde kombination af signaler og kan være høj uden at nævne byen.

### 5.1b Lokale signaler fra kilderegistrene: `localityScore`, `sourceAuthority`, story-klynger

Næstved- og Slagelse-registrene (`source-registries/`) kræver at lokal relevans er en **kombination** (ikke `contains(<by>)`), at kildens autoritet vejer, og at historier samles i klynger. Disse tre er **deterministiske features beregnet i kilde-laget** (`10-…` §11e) og læses af `local`-modellen via `Deterministic`; AI estimerer dem ikke.

| Signal | Beregnes | Bruges i | Regel |
|---|---|---|---|
| **`localityScore`** (0-100) | `scoreLocality` (støj-ELLER over L1-L12: eksplicit sted, postnr./adresse, `kommuneId`, geometri, matrikel, CVR/P-nummer, institution, person/entity-relation, eksisterende Story-lokalitet, kildens iboende lokalitet, nøgleord) — `StoryCandidate.localityScore` = max over primære `sourceRefs` | `localRelevance` (via `localSignal = max(geoFit, localityScore)`), forfilter af nationale kilder, inbox-filter | Et nationalt dokument uden bynavn kan score ≥ 70 via CVR/matrikel/institution; fremmed kommunekode uden lokalt signal ⇒ ≤ 40 (`10-…` §11e T1-T14) |
| **`sourceAuthority`** (`PRIMARY_OFFICIAL` … `SOCIAL_SIGNAL`) | Snapshot fra `SourceDefinition.authorityLevel` pr. `SourceItem`; kandidatens = højeste blandt `sourceRefs` | `sourceQuality` (`authorityPrior`), `verificationConfidence` (lofter), `exclusivity`-hint, metrik `primaryFirst` | Primære kilder løfter kvalitet/verifikationsgulv; `SECONDARY_MEDIA`/`AGGREGATOR`/`SOCIAL_SIGNAL` kan **ikke** alene give høj verifikation; sekundære medier er discovery/krydstjek (`role=supporting`) |
| **`storyClusters`** + `clusterStrength` (0-100) | Klynge-definitioner er **profildata** (`RatingProfileVersion.config.storyClusters`, pr. instans; ingen bynavne i kode): `[{ key, label, anyOf:[{ entityRefs?, sourceClasses?, geoTagSlugs?, keywords? }], minDistinctSources, windowDays }]`. `clusterStrength = min(100, 25·antal distinkte kilde-/entitetsklasser der rammer klyngen inden for vinduet + 20·[primær kilde] + 15·[tidligere Story/kandidat i klyngen])` | `storyPotential` (`clusterBonus`), `RELATED`-sammenkædning, simulator (emnespredning) | Se eksempler nedenfor |

**Pilotklynger (eksempler fra registrene; seedes som profildata for hhv. Næstved og Slagelse, ikke som kode):**

| Klynge | Kilder/entiteter der samles | Eksempel på udløsende kombination |
|---|---|---|
| `harbor` (havn og havneby) | Havn + dagsordener + havnebydel + lokalplaner + udbud + lokale CVR-virksomheder | nyt byrådsbilag + Næstved Havn + lokalplan + lokal CVR-virksomhed + tidligere Story |
| `coast` (kyst/Karrebæksminde–Enø) | DMI + Kystdirektoratet + høringer + lokalplaner + lokalråd + tidligere højvands-Story | høring i Karrebæksminde + Kystdirektorat/DMI + lokalråd + tidligere stormflods-Story |
| `utilities` (forsyning) | NK-Forsyning + Envafors-overgang + GEUS Jupiter + DMA + vand-/spildevandsplaner | forsynings-/miljøhistorie |
| `naestved-roennede` (infrastruktur) | Vejdirektoratet + Folketinget + kommunale planer + udbud + ekspropriation/Statstidende + berørte adresser/CVR | infrastruktur-story |
| `storebaelt` (Slagelse) | Sund & Bælt/Storebælt + Vejdirektoratet + DSB/Banedanmark + DMI (vind) + Korsør/Halsskov | vindrestriktion/lukning med konsekvens for pendling og gods |

Klynger er et *lokalt signal*, ikke en kategori: de påvirker kun `storyPotential` og `RELATED`-gruppering, aldrig `total` direkte.

**Succeskriterium (registrene) som acceptkriterium:** *"StoryCandidate fra primærdata før sekundære medier."* — formaliseret som invariant **I21** (§8) og målt som metrik (andel af kandidater ≥ `HIGH` med `primaryFirst=true`; Fase 5).

### 5.2 AI-estimat-kontrakt (zod; `rating.local`)

AI returnerer kun dette (alt andet afvises/ignoreres; `total`, `band`, `priority`, `score` i svaret kasseres):
```json
{
  "storyType": "BREAKING|DEVELOPING|NEWS|INVESTIGATION|ANALYSIS|BACKGROUND|SERVICE|SPORT|CULTURE|EVENT|COMMUNITY|DEBATE|SHORT_NOTE|LIVE|EVERGREEN",
  "estimates": {
    "localAudienceFit":      { "score": 0-100, "reason": "≤200 tegn" },
    "editorialImportance":   { "score": 0-100, "reason": "…" },
    "originality":           { "score": 0-100, "reason": "…" },
    "verificationConfidence":{ "score": 0-100, "reason": "…" },
    "communityValue":        { "score": 0-100, "reason": "…" },
    "storyPotential":        { "score": 0-100, "reason": "…" },
    "publicInterest":        { "score": 0-100, "reason": "…" },
    "exclusivity":           { "score": 0-100, "reason": "…" },
    "publishability":        { "score": 0-100, "reason": "…" },
    "civicUtility":          { "score": 0-100, "reason": "…" },
    "localConsequence":      { "score": 0-100, "reason": "…" }
  },
  "sourceOriginality": "original|republished|aggregated|unknown",
  "hasNamedPrimarySource": true,
  "eventTime": "ISO-8601 | null",
  "entities": ["…"], "topics": ["…"], "geoMentions": ["…"],
  "claimsNeedingVerification": ["…"]
}
```
Validering: heltal 0–100 (ikke-heltal afrundes; udenfor interval/mangler ⇒ `invalid_output`, ét reparationsforsøg, ellers fejl); `reason` ≤ 200 tegn (trunkeres); `eventTime` skal være ISO og inden for ±90 dage; `entities/topics/geoMentions` ≤ 12 elementer à ≤ 80 tegn; ukendte felter fjernes.

**Injektionsværn:** feedtekst og Knowledge-kontekst sendes som `retrieved` (HENTET INDHOLD), *aldrig* i system-/brugerdelen; systemprompten (incl. låst præambel) siger at hentet indhold er data (`06-…` §6, `07-…` §5). Hvis hentet tekst indeholder instruktioner, ignoreres de; output valideres strengt, så en vellykket injektion højst kan ændre *estimater inden for 0–100*, ikke total/bånd/prioritet (disse beregnes af `score`).

### 5.3 Standardprofil `default-local-news` (v1, uddrag)

Vægter (sum = 100):

| Dimension | Vægt | | Dimension | Vægt |
|---|---|---|---|---|
| localRelevance | 16 | | publishability | 5 |
| editorialImportance | 9 | | civicSignal | 4 |
| timeliness | 8 | | tipSupport | 3 |
| originality | 5 | | civicUtility | 6 |
| sourceQuality | 7 | | localConsequence | 5 |
| verificationConfidence | 5 | | exclusivity | 2 |
| communityValue | 7 | | nonDuplication (=100−duplication) | 5 |
| storyPotential | 6 | | publicInterest | 7 |

`total = round(Σ vægt_i · værdi_i / 100, 1)`; derefter **regler i rækkefølge** (hver logges i `explanation.rules` med før/efter):

| Regel | Betingelse | Effekt |
|---|---|---|
| `duplicate_cap` | `duplication ≥ 85` | `total = min(total, 29)` |
| `no_local_angle_cap` | `localSignal < 20` (dvs. `geoFit` og `localityScore` begge lave) og `localConsequence < 40` | `total = min(total, 49)` |
| `unverified_cap` | `verificationConfidence < 30` | `total = min(total, 69)` (aldrig HIGH/URGENT uden verifikation) |
| `stale_cap` | `timeliness < 10` og `storyType ∉ {EVERGREEN, ANALYSIS, BACKGROUND}` | `total = min(total, 49)` |
| `breaking_boost` | `storyType = BREAKING` og `timeliness ≥ 80` og `sourceQuality ≥ 60` | `total = min(100, total + 8)` |

Halveringstider (timer, spec §17, ændres som data): `BREAKING 2 · DEVELOPING 4 · NEWS 6 · SPORT 8 · SERVICE 12 · ANALYSIS 24 · COMMUNITY 36 · EVENT 24 · SHORT_NOTE 6 · LIVE 2 · INVESTIGATION 48 · DEBATE 24 · CULTURE 36 · BACKGROUND 72 · EVERGREEN 168`.

Øvrige profiler (spec §10: `breaking`, `community`, `sport`, `events`, `feed-content`) er **vægt-/regelvarianter** af samme `local`-model (fx `breaking`: `timeliness 20`, `verificationConfidence 10`, lavere `storyPotential`; `community`: `communityValue`/`tipSupport`/`civicUtility` opvægtes) – oprettes som egne profiler uden kodeændring. Hvilken profil der er aktiv pr. instans/feed vælges i `LocalRatingConfig.activeRatingProfileId` (og pr. feed senere via `SourceDefinition`-override – åbent spørgsmål).

## 6. Versionering

- **Profil** = identitet (`RatingProfile`); **profilversion** = uforanderlig config (`RatingProfileVersion`, `configHash`). Aktivering sætter `RatingProfile.activeVersionId`; gamle versioner arkiveres, aldrig slettes. En aktiv version kan ikke redigeres (ny version kræves) – invariant I19.
- **Modelversion** = implementeringens semver (`local@1.0.0`, `score@1.0.0`); ændres når en *formel/lofttype/AI-kontrakt* ændres (kode). Rene vægt-/tærskelændringer er profilversioner, ikke modelversioner.
- **inputVersion** = version af `RatingInput`-skemaet (hvilke felter ratingen ser).
- **Reproducerbarhed:** `RatingRun.features` + `deterministic` + `profileVersionId` er nok til at **gen-score uden AI** (`rescore(runId, profileVersionId)`): bruges til "forhåndsvis ny vægtning på de seneste 50 kandidater" før aktivering og til sammenligning af profilversioner. Tidsafhængige features (`timeliness`) gemmes med `computedAt`; gen-scoring bruger enten gemt værdi eller en eksplicit ny `now`.
- **Re-rating** af en kandidat (ny tekst, `UPDATE`, ny profil) opretter en **ny** `RatingRun`; ældre bevares. `StoryCandidate.latest*` peger på nyeste fra den *aktive* profil.

## 7. Sammenligning score mod local

Begge modeller kører på samme kandidat med samme `inputHash` og `comparisonGroupId` (`RatingEngine.rateBoth`, kun hvis `shadowRatingProfileId` er sat og budgettet tillader det; det dobbelte AI-kald logges i `AiUsage`).

| Visning | Indhold |
|---|---|
| Inbox (kolonne) | Aktiv models bånd + score; lille markør hvis shadow-modellen er uenig (±1 bånd) |
| Kandidat-detalje | Tabel: hver models delscorer, total, bånd, A/B/C-forslag og begrundelser side om side; **vejledende** dimensionskortlægning (kun visning, ikke scoring): `audience_relevance ≈ localRelevance+publicInterest`, `impact ≈ editorialImportance+localConsequence`, `counter_narrative_value ≈ originality+exclusivity`, `perspective_value ≈ storyPotential`, `decision_value ≈ civicUtility`, `trust ≈ sourceQuality+verificationConfidence`, `production_potential ≈ publishability` |
| Simulator | Samme `RatingRun`-form gør, at et scenarie kan bruge enten models total som input til udgivelsesplanen (`08-…` §4) |
| Statistik (Fase 5) | Enighed i bånd, rangkorrelation (Spearman) pr. uge, hvor ofte redaktøren accepterer kandidater ≥ HIGH i hver model |

## 8. Testbare invarianter (`tests/localrating-rating-*.test.ts`)

| ID | Invariant |
|---|---|
| I1 | **Determinisme:** `score(est, det, config)` er ren: samme input ⇒ identisk output (deep-equal), ingen læsning af tid/DB/netværk |
| I2 | `validateConfig` afviser vægte ≠ sum 100 (local) / ≠ 1,00 (y), negative vægte, ukendte dimensioner, ikke-monotone tærskler |
| I3 | AI kan ikke sætte `total`/`band`/`priority`/`local_score`: felterne fjernes af `parseEstimates` og påvirker ikke resultat (fuzz) |
| I4 | Alle dimensionsværdier er heltal 0–100; `local`: manglende/ugyldigt estimat ⇒ `invalid_output` (ikke stille 0); `score`: som Y (`clampScore` ⇒ 0) + flag `invalid_estimate:<dim>` |
| I5 | **Y-golden:** for ≥ 30 AI-outputs (genereret offline med Y's egne funktioner) giver `score`-modellen identiske `local_score` (Y: `y_score`), `priority`, `primary_function`, `secondary_functions`, `pillar_scores`, `editorial_pillar` (inkl. alle tiebreak-tilfælde) |
| I6 | **Bånd-monotoni og grænser:** 29,9/30/49,9/50/69,9/70/84,9/85 mapper korrekt; `total↑ ⇒ bånd ikke ↓` |
| I7 | **Lofter:** `duplication ≥ 85 ⇒ band=IGNORE`; `localSignal<20 ∧ localConsequence<40 ⇒ total ≤ 49`; `verificationConfidence<30 ⇒ total ≤ 69`; regler logges i `explanation.rules` |
| I8 | **Timeliness:** alder 0 ⇒ 100; alder = halveringstid ⇒ 50 (±1); strengt aftagende; BREAKING aftager hurtigere end NEWS; EVERGREEN næsten konstant |
| I9 | **Tenant:** `geoFit` bruger kun instansens GeoTags; tekst om en anden instans' by ⇒ 0; fixtures med to instanser |
| I10 | **Rights-gate:** ved `metadata_only` indeholder AI-payloaden kun overskrift (+URL/kilde), `contentDepth=0`, `verificationConfidence ≤ 35`, `publishability ≤ 40` (assertion på det der sendes til `FakeAi`) |
| I11 | **Gen-score uden AI:** ændret vægtprofil ⇒ ny total beregnes fra gemt `features` uden gateway-kald; uændret profil ⇒ identisk total |
| I12 | **Persistens:** hver `RatingRun` har alle dimensionsnøgler + `profileVersionId`, `modelVersion`, `inputHash`, `ratedAt` |
| I13 | **Sammenligning:** `rateBoth` giver to runs med samme `comparisonGroupId` og `inputHash` |
| I14 | **Ingen hardcodede bynavne:** test scanner `lib/localrating/rating/**` for strenge fra seed-GeoTags (Næstved, Slagelse …) og for `"slagelse-by"` |
| I15 | **Sponsor-neutralitet:** tilladte `RatingInput`-nøgler er en eksplicit allowlist; ingen felt om sponsor/annonce/kampagne/indholdstype |
| I16 | **Knowledge-flag:** `disabled`/`unavailable` ⇒ score produceres, `flags` indeholder `knowledge:disabled|unavailable` |
| I17 | **AI-fejl:** timeout/budget/ugyldig JSON ⇒ ingen score-række, kandidat uændret, `AiUsage`-række med fejlstatus |
| I18 | `priorityConfidence ∈ [0,10; 0,95]` og deterministisk; `suggestedPriority` følger profilens `priorityRules` |
| I19 | **Uforanderlig version:** opdatering af `config` på en `active`/`archived` version afvises; ny version kræves |
| I20 | **Provider-uafhængighed:** samme estimater fra anthropic-/gemini-/deepseek-fake giver samme score (ratingen kender ikke udbyderen) |
| **I21** | **Primærdata før sekundære medier (registrenes succeskriterium):** pipeline-test med falske kilder og scriptet ur. *Scenario 1 (havn):* t0 ingestes primære `SourceItem`s (byrådsbilag fra kommunens dagsordensmonitor + lokalplan + udbud + CVR-match + en eksisterende kandidat/Story i klyngen `harbor`); t0+3 t ingestes en `SECONDARY_MEDIA`-overskrift om samme sag. Forventet: der findes en `StoryCandidate` allerede efter t0-tick'et med `sourceAuthority=PRIMARY_OFFICIAL`, `localityScore ≥ 70`, `latestBand ≥ POTENTIAL`, `primaryFirst=true`, `firstPrimarySeenAt < firstSecondarySeenAt`; den sekundære item giver `RELATED`/`UPDATE` (ingen ny kandidat) og sætter `firstSecondarySeenAt`. *Scenario 2 (kyst):* høring i Karrebæksminde + DMI/Kystdirektorat + lokalråd + tidligere stormflods-kandidat ⇒ kandidat `≥ POTENTIAL` før noget sekundært item. *Negativ:* uden primære items skaber en sekundær overskrift alene en kandidat med `sourceAuthority=SECONDARY_MEDIA`, `verificationConfidence ≤ 55`, `primaryFirst=false` |
| **I22** | **`localityScore` er ren og tenant-sikker:** samme input ⇒ identisk score; T1-T14 i `10-…` §11e (bl.a. nationalt dokument uden bynavn men med lokal CVR/matrikel ≥ 70; fremmed kommune ≤ 40; to instanser giver forskellig score uden læk) |
| **I23** | **Autoritetslofter:** `SOCIAL_SIGNAL` ⇒ `verificationConfidence ≤ 35`; `AGGREGATOR` ≤ 45; `SECONDARY_MEDIA` som eneste kilde ≤ 55; `authorityPrior` indgår i `sourceQuality` med den dokumenterede vægt; ændring af `authorityLevel` på kilden ændrer kun nye items (snapshot) |
| **I24** | **Klynger er data:** `storyClusters` læses fra profilversionen; test scanner `lib/localrating/rating/**` for klyngenøgler/bynavne (`harbor`, `coast`, "Næstved", "Slagelse" …) — ingen forekomster; en profil uden klynger giver `clusterBonus=0` uden fejl |
| **I25** | **Lokalt signal uden bynavn:** kandidat hvis eneste lokale link er et godkendt `LocalEntityRef` (CVR/matrikel/institution) får `localRelevance` svarende til `localSignal ≥ 70` og undgår `no_local_angle_cap`; samme kandidat med `LocalEntityRef.status="foreslået"` (ikke godkendt) gør det ikke |

## 9. Åbne spørgsmål (rating)

1. Må rating køre på overskrift alene for `metadata_only`-kilder (juridisk), eller skal den springes over (kandidat kun med link)? Default i dette design: ja, med deterministiske lofter (I10).
2. Skal `tipSupport` bruge `MeddelerSag`/`Submission` (persondata-tabeller, kun tællinger) allerede i v1, eller først når Knowledge `CitizenTip` findes? Default: tællinger i v1.
3. Pr.-feed profil-override (fx `breaking` for politi) – ønsket i v1?
4. `score` (Local Score) er en førsteklasses, valgbar model (paritet med Y Rating, se §4.5) – skal den også køre som shadow på alle kandidater, eller kun ad hoc i Local Lab? Default: ad hoc + valgfri shadow.
5. Kalibrering: hvem godkender de første 50 manuelle "gold"-vurderinger, som `local`-vægtene justeres mod (Fase 3-gate)? De skal nu også dække `localityScore`-vægtene (L1-L12), `authorityPrior`-værdierne og pilotklyngerne (§5.1b), og indeholde mindst 10 kandidater fra **primære** kilder uden bynavn i teksten.
6. Må `LocalEntityRef` med `status="foreslået"` (discovery/CVR) tælle i `localityScore`? Default: nej, kun `godkendt` (I25).
