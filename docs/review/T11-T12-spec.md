<!-- T11/T12 spec. Skrevet 2026-10-01. Kode: cms/lib/frontpage/**, cms/app/api/cron/frontpage-rank, cms/app/api/frontpage/track. Tests: cms/tests/frontpage-*.test.ts -->
# T11 + T12 – Modulær forside med AI-forslag, modulbibliotek og forsideeditor

Status: **spec + backend/logik-lag er bygget og testet** (193 tests grønne, `tsc` og `eslint` rene). UI (modulær `page.tsx`, editor) bygges af en senere agent oven på API-kontrakten i afsnit 20.

Kilder: `docs/review/00-plan.md` (T11/T12 + ejerens beslutning), `docs/review/T3-design-review.md` (designkontekst), `files/03-cms-og-ai-kravspecifikation.md` §3.5 (AI-governance), eksisterende `lib/distribution-engine.ts`, `lib/frontpage-governance.ts`, `lib/marking.ts`, `FrontpagePlacement`.

---

## 1. Problem

Forsiden er i dag hårdkodet i `app/(site)/page.tsx` + `getFrontpageData`: ét fast layout, scoring uden forklaring, og redaktøren kan kun fastgøre enkeltartikler i fire zoner. Der er ingen måde at (a) ændre forsidens opbygning (fx bryde toppen med en annonce eller sponsoreret boks), (b) se *hvorfor* en artikel står, hvor den står, eller (c) lade en AI hjælpe uden at miste redaktionel kontrol. Design-reviewet (T3) viser desuden at "Seneste nyt" ikke er kronologisk (P2-13), at mærkning skal være konsekvent synlig, og at hero-overskrifter bliver for lange på mobil.

## 2. Løsning (kort)

Forsiden bygges af **moduler med slots** (hero, top-grid, breaking-bar, seneste nyt, dit område, sektionsrækker, partner-/sponsoreret-/annonce-break, egen promo, kalender, signaler, debat, opslagstavle). Et **layout** er en gemt rækkefølge af modul-instanser (kladde → publicér → rul tilbage). En **ranker i to lag** (deterministisk score + valgfri Claude-re-rangering) fylder slottene og gemmer resultatet som et **forslag** (snapshot). **AI'en foreslår, redaktøren godkender**; indtil da vises den sidst godkendte forside, ellers deterministisk score, ellers Seneste nyt. Hårde **rækværk** (kvoteloft, mærkning, AI-restriktioner, tenant, kun Publiceret) håndhæves i ren kode som hverken AI, ranker eller editor kan omgå. Alt AI gør logges.

```
 candidates (Article, Publiceret, pr. instans) ──┐
 layout (live | standard) ───────────────────────┤
 pins (FrontpagePlacement + Article.pinned) ─────┼─► compose ─► guardrails ─► SlotAssignment[]
 AI-vurdering (valgfri, Claude, valideret) ──────┘                │
                                                                  ├─► FrontpageSnapshot(status: forslag) + FrontpageDecision-log
 cron /api/cron/frontpage-rank  (kun forslag)  ───────────────────┘          │ redaktør godkender (can: snapshot.approve)
                                                                              ▼
 render: resolveFrontpageForRender ► godkendt snapshot (revalideret) ► deterministisk ► seneste nyt
```

## 3. Mål og ikke-mål

**Mål**
1. Redaktøren kan sammensætte og omarrangere forsiden af genbrugelige moduler uden kodeændring.
2. AI kan *foreslå* placeringer og layout, med forklaring pr. placering, men aldrig publicere eller omgå governance.
3. Forsiden går aldrig ned: AI-fejl, timeout, ugyldigt svar eller manglende godkendelse giver altid en fornuftig forside.
4. Mærkning (Uafhængig/Partner/Sponsoreret/Brugerindsendt/AI-assisteret/PR/Annonce) er altid synlig og kan ikke slås fra.
5. Pr. by (tenant) isolation; alt testbart som rene funktioner.

**Ikke-mål (denne leverance):** UI/renderering, editorens React-komponenter, tiptap-baserede promo-tekster, auto-tilstand (publicering uden godkendelse), personlig/adfærdsbaseret tilpasning pr. besøgende, A/B-test af layouts, Facebook/nyhedsbrev-distribution.

## 4. User stories

**Redaktør (ansvarshavende / redaktionsleder)**
1. Som redaktør vil jeg åbne forsiden i en editor og trække moduler op/ned, så jeg kan ændre opbygningen uden udvikler.
2. Som redaktør vil jeg tilføje et modul fra et bibliotek (fx "Sponsoreret boks"), så jeg kan sælge og placere nye formater.
3. Som redaktør vil jeg vælge en skabelon (fx "Top med break efter slot 3"), så jeg hurtigt får et gennemtænkt layout.
4. Som redaktør vil jeg gemme en kladde og først publicere når jeg er tilfreds, så den levende forside aldrig er halvfærdig.
5. Som redaktør vil jeg fortryde/gentage og rulle tilbage til en tidligere publiceret version, så fejl koster sekunder.
6. Som redaktør vil jeg se AI's forslag til hele forsiden som et udkast ("forslag"), se hvorfor hver artikel står der (begrundelse, konfidens, score), og godkende, justere eller afvise det.
7. Som redaktør vil jeg fastgøre en artikel til et slot (pin) som AI ikke flytter, så mine redaktionelle valg altid vinder.
8. Som redaktør vil jeg se advarsler (kvoteloft, to artikler om samme emne i toppen, tomme slots, manglende mærkning), så jeg kan rette før jeg godkender.
9. Som redaktør vil jeg skrive "Sæt den vigtigste politiske sag i toppen og læg en sponsoreret boks efter tredje historie" og få en forhåndsvisning af ændringerne, så jeg ikke skal finde rundt i menuer.
10. Som redaktør vil jeg forhåndsvise forsiden ved 375/768/1440 px, så jeg ser mobiloplevelsen.
11. Som redaktør vil jeg se CTR pr. slot, så jeg kan vurdere hvad der virker.
12. Som redaktør vil jeg have tastaturstyring og skærmlæserstøtte i editoren (a11y).

**Ansvarshavende redaktør**
13. Som ansvarshavende vil jeg garantere at AI aldrig kan publicere, fjerne mærkning, hæve kvoteloftet eller placere AI-assisteret indhold i hero/Krimi/Sundhed.
14. Som ansvarshavende vil jeg have en log over alle AI-valg og alle godkendelser (hvem, hvornår, hvad).
15. Som ansvarshavende vil jeg styre hvem der må redigere layout, godkende forslag og bruge AI (tre separate rettigheder).

**AI / systemet**
16. Som ranker vil jeg få en afgrænset kandidatliste og returnere struktureret JSON (prioritet 1–5, forslagModul, begrundelse ≤ 200 tegn, konfidens), så output kan valideres og bruges deterministisk.
17. Som system vil jeg køre rankingen i baggrunden (cron) og kun oprette forslag, så besøgende aldrig venter på AI.
18. Som system vil jeg falde tilbage (godkendt snapshot → deterministisk → seneste nyt) ved enhver fejl, så forsiden aldrig går ned.
19. Som system vil jeg revalidere et godkendt snapshot mod friske data (afpublicerede artikler, kvoteloft) ved hver visning, så forældede placeringer aldrig vises.

**Besøgende**
20. Som besøgende vil jeg se de vigtigste lokale nyheder først, og altid kunne se hvad der er redaktionelt, sponsoreret, partner, indsendt eller AI-assisteret.
21. Som besøgende vil jeg have en "Seneste nyt"-liste der faktisk er kronologisk (T3 P2-13).
22. Som besøgende vil jeg se "Dit område" for min by/område.
23. Som besøgende med skærmlæser vil jeg have korrekte landemærker, overskriftsniveauer og mærkning som tekst (ikke kun farve).

**Salg / annoncører**
24. Som salgsansvarlig vil jeg have faste, tydeligt mærkede pladser (annonce-, partner- og sponsoreret-break) i layoutet, med kvoteloft der beskytter uafhængigheden.

## 5. Modulkatalog (`cms/lib/frontpage/modules.ts`)

`kind = artikel`: slottene fyldes af komponeringen. `kind = dynamisk`: rendereren henter data fra egen kilde (komponeringen rører dem ikke), men de placeres/flyttes/mærkes som alle andre moduler. "Auto" = hvad ranker/AI selv må placere; "Redaktør" = hvad en redaktør må pinne.

| Modul | Slots (min–maks, std) | Indholdstyper (auto / redaktør) | Varianter (std) | Render-regler |
|---|---|---|---|---|
| `hero` | 1–1 | Uafhængig, Brugerindsendt / + AI-assisteret, Partner, Sponsoreret, PR | hero | Max 1 pr. layout. AI-assisteret aldrig automatisk. Kommercielt kun som redaktør-pin og kun hvis kvoteloft tillader. Titel ≤ 3 linjer på 375 px (maxTitelTegn 120). |
| `top-grid` | 2–6 (3) | som hero | kort, kompakt (kort) | Diversitet: max 1 artikel pr. emne i topzonen. Kan være vært for inline-breaks. |
| `breaking-bar` | 1–3 (1) | kun Uafhængig + `breaking` | tekstlinje | Kun friske breaking (< 12 t). Må vise artikler der også er hero. Skjules når tom. |
| `seneste-nyt` | 3–15 (8) | Uafhængig, Brugerindsendt, AI-assisteret, PR / + Partner, Sponsoreret | liste, tekstlinje (liste) | **Altid kronologisk** (publiceretTid desc), aldrig AI-rangeret; udelader det der står højere. Annonce-break kan gentages hver N. slot. |
| `dit-omraade` | 2–6 (3) | Uafhængig, Brugerindsendt, AI-assisteret, PR | kort, kompakt, liste | Kun artikler med geotag; `config.omraadeSlug` låser området, ellers filtrerer rendereren pr. besøgendes valg. |
| `sektion-rail` | 2–6 (4), maks 8 instanser | som dit-omraade | kort, kompakt, liste | `config.sektionSlug`. |
| `partner-break` | 1–2 (1) | kun Partner | kort, kompakt (kompakt) | Dedikeret, mærket "Partner" + sponsor. Tæller i kvoteloft. Tom/skjult når loft nået. |
| `sponsoreret-break` | 1–2 (1) | kun Sponsoreret | kort, kompakt | Som ovenfor, "Sponsoreret". |
| `ad-break` | 1 | (dynamisk: AdCampaign, formater NATIVE_PREMIUM, NATIVE_SEKTION, IN_FEED_BANNER, EVENT_POST, GUIDE_PROFILE) | kort, kompakt, tekstlinje | Fast mærkning "Annonce". Ingen aktiv kampagne = skjult. Måles via `/api/ads/track`. |
| `egen-promo` | 1 | (dynamisk: `promoKind` = stoet / nyhedsbrev / indsend) | kompakt, tekstlinje | Fast mærkning "Fra redaktionen". |
| `kalender-strip` | 3–8 (4) | (dynamisk: kalender) | kompakt, liste | Sorteret efter startdato; brugerindsendte begivenheder mærkes. |
| `fra-kommunen` | 2–6 (3) | (dynamisk: `Signal`, `sourceTypes` kommune_*) | liste, tekstlinje | Signaler er **ikke artikler**: mærket "Maskinindsamlet – ikke redaktionelt vurderet", link til kilde. |
| `fra-politiet` | 2–5 (3) | (dynamisk: `Signal`, politi/beredskab_112) | liste, tekstlinje | Som ovenfor; aldrig AI-resumé. Følsomt: se åbne spørgsmål. |
| `debat` | 2–4 (3) | Uafhængig, Brugerindsendt | kort, liste, tekstlinje | Sektion "debat" (`config.sektionSlug`) eller brugerindsendt. |
| `opslagstavle` | 3–6 (4) | (dynamisk: opslag) | kompakt, liste | Fast mærkning "Brugerindsendt". |

Fælles modulfelter: `id` (stabilt, 2–40 tegn), `type`, `slots`, `variant?`, `region` (`full`/`main`/`sidebar`), `visible`, `mode` (`forslag` = standard, `auto` reserveret), `config` (kun nøgler tilladt for typen; strikt).

## 6. Layout-varianter og render-regler

Samme artikel kan rendres i fem varianter (`VARIANT_RULES` i `modules.ts`):

| Variant | Billede | Manchet | Maks titel | Mærkning |
|---|---|---|---|---|
| `hero` | ja | ja | 120 | over titel |
| `kort` | ja | ja | 90 | over titel |
| `kompakt` | ja | nej | 80 | over titel |
| `liste` | nej | nej | 110 | foran titel |
| `tekstlinje` | nej | nej | 100 | foran titel |

**Mærkning i alle varianter (hård regel):**
- `SlotAssignment.label = { tekst, synlig: true }` udledes **altid** af artiklen (`labelFor`: `marking.labelTekst` ellers standardtekst pr. indholdstype) – aldrig af snapshot, AI eller klient. `synlig` er typet som literal `true`.
- Layout-schemaet er `.strict()` og har intet felt der styrer mærkning; `hideLabel`/`skjulMaerkning` giver valideringsfejl.
- Mærkningen skal være tekst (ikke kun farve), ligge i samme DOM-blok som titlen og høres af skærmlæser. Dynamiske moduler har fast tekst (`fastMaerkning`).
- Rendereren skal vise `label.tekst` i alle varianter; manglende label = artiklen vises ikke.

## 7. Skabelonbibliotek (`cms/lib/frontpage/templates.ts`)

| Skabelon | Indhold | Parametre |
|---|---|---|
| `top-3-grid` | top-grid (3) | – |
| `top-hero-sidebar` | hero (main) + top-grid (3, kompakt, sidebar) | – |
| `top-med-annonce-break` | hero + top-grid (N slots) + break (inline efter slot X) | `slots` 3–6, `breakAfter` 1–5, `breakType` ad-break / sponsoreret-break / partner-break / egen-promo |
| `breaking-banner` | breaking-bar | – |
| `dit-omraade-rail` | dit-omraade | `slots` |
| `kalender-strip` | kalender-strip | – |
| `fra-kommunen-politiet` | fra-kommunen + fra-politiet | – |
| `debat-opslagstavle` | debat + opslagstavle | – |
| `sektionsside-skabelon` | hero + top-grid (3) + seneste-nyt (10), alle filtreret på sektion | `sektionSlug` |
| `forside-standard` | breaking-bar, hero, top-grid (3), dit-omraade (3), seneste-nyt (8) – bruges som standardlayout når instansen intet har gemt | – |

**Break efter slot N:** en break er et selvstændigt modul med `config.placement = "inline"`; værten har `config.breaks = [{ afterSlot: N, moduleId, repeatEvery? }]`. Valideringen sikrer: break findes og er break-type, værten er `breakHost`, `afterSlot ≤ slots`, hver inline-break refereres af præcis én vært, `repeatEvery` kun i seneste-nyt. En skabelon kan have flere break-punkter. Break-moduler med `placement = "sequence"` står som egne rækker mellem moduler.

`instantiateTemplate(id, params, takenIds)` giver validerede instanser med unikke id'er; `applyTemplate(existing, id, params, "append"|"replace")` validerer det samlede layout (fx afvises to heroer).

## 8. Layout-datamodel, versionering og rollback

**`FrontpageLayout`** (Prisma): `instansId`, `name`, `status` (`kladde` | `live`), `version`, `schemaVersion`, `modules` (Json), `scope` (fremtid: dagsdel/periode), `createdBy`, `publishedBy/At`. Pr. instans: højst **én** `live`-række (app-håndhævet i transaktion) + valgfrit mange `kladde`-rækker.

**`FrontpageLayoutVersion`**: én række pr. publiceret version (`layoutId`, `version`, `modules`, `note`, `createdBy`), unik pr. `(layoutId, version)`.

```json
{ "id": "top-grid", "type": "top-grid", "slots": 4, "variant": "kort", "region": "full", "visible": true, "mode": "forslag",
  "config": { "maxAgeHours": 72, "breaks": [{ "afterSlot": 2, "moduleId": "ad-break" }] } }
```

- **Kladde:** `saveDraftLayout` med optimistisk samtidighed (`expectedVersion`); forældet version → `conflict` (editor viser "ændret af en anden, genindlæs/flet").
- **Publicér:** `publishLayout(draftId)` kopierer kladdens moduler til live-rækken i en transaktion, øger `version` og skriver en `FrontpageLayoutVersion`. Kladden bevares.
- **Rul tilbage:** `rollbackLayout(toVersion)` opretter en *ny* version (version+1) med indholdet fra den gamle – historikken bevares.
- **Konsekvens:** et godkendt snapshot hører til én layout-version. Når layoutet ændres, er snapshotet forældet og forsiden går på deterministisk ranking indtil et nyt forslag er godkendt. **UI skal derfor tilbyde "Foreslå forside" lige efter publicering.**
- Pr. by: layouts er pr. `instansId`. Pr. dagsdel/tidspunkt er forberedt (`scope`) men ikke implementeret.

## 9. Forslag (snapshot), godkendelse og livscyklus

**`FrontpageSnapshot`**: `instansId`, `layoutId`, `status` (`forslag` | `godkendt` | `afvist` | `udløbet`), `items` (Json: `{schemaVersion, layoutVersion, assignments[], warnings[]}`), `mode` (`forslag` | `auto`), `generatedBy` (`deterministic` | `ai`), `modelId`, `inputHash`, `godkendtAf/Tid`, `afvistAf/Tid/Grund`, `expiresAt`.

```
createProposal ──► forslag ──approve──► godkendt ──(ny godkendelse | TTL)──► udløbet
                      │  └─ reject ──► afvist
                      └─ nyt forslag oprettes ──► udløbet (kun ét aktivt forslag pr. instans)
```

- `createProposal` (cron eller redaktør) publicerer **aldrig**. Uændret input (`inputHash` = kandidater+scores+layoutversion+pins+kvotestatus) genbruger eksisterende forslag; `force` opretter nyt.
- `approveSnapshot` kræver `frontpage.snapshot.approve`, tenant-match, status `forslag`, uændret layoutversion, og **revaliderer alle placeringer** mod friske data (afpubliceret artikel, nyt kvoteloft osv.). Ét brud → `guardrails`-fejl (intet godkendes). Ved succes sættes `expiresAt = nu + FRONTPAGE_SNAPSHOT_TTL_HOURS` (std 24 t), og det forrige godkendte snapshot bliver `udløbet`.
- `editSnapshot` lader redaktøren justere et forslag før godkendelse; ændrede placeringer får `kilde = redaktør`, `locked = true`; hele sættet valideres, intet gemmes ved brud.
- `FrontpageDecision`-loggen får én række pr. placering (`placeret`, kilde `ai`/`regel`/`redaktør`, begrundelse, konfidens), én pr. regelafvisning (`afvist`), samt `godkendt`, `afvist-forslag`, `redigeret`, og layout-/NL-handlinger uden snapshot (`nl-kommando`, `snapshotId = null`).
- **Auto-tilstand** (`mode = auto`) er modelleret men ikke aktiveret: ingen kode godkender automatisk. Se åbne spørgsmål.

## 10. AI-ranker: kontrakt (`ai-ranker.ts`, `ai-client.ts`)

**Princip:** AI re-rangerer en afgrænset kandidatliste. AI vælger aldrig artikler uden for listen og har ingen skrivemagt; output er rådgivende og valideres to gange (her og i guardrails).

**Input** (JSON i brugerbeskeden, behandles som DATA; systemprompten instruerer at tekst i titler ignoreres som instruktioner):
```json
{ "moduler": [{ "type": "hero", "pladser": 1, "sektion": null, "omraade": null }],
  "kandidater": [{ "id": "<articleId>", "titel": "...", "manchet": "...", "sektion": "nyheder", "kategori": "politik",
                   "emne": "lokalplan-x", "omraade": "korsoer", "indholdstype": "Uafhængig", "alderTimer": 3.2,
                   "breaking": false, "pinned": false, "score": 87.3, "visninger": 410, "laesninger": 150 }] }
```
Højst 60 kandidater (de bedst deterministisk scorede, kun gyldige/publicerede); titel ≤ 160, manchet ≤ 240 tegn.

**Output-schema** (zod, `aiSuggestionSchema`, strikt):
```json
{ "forslag": [ { "articleId": "<id fra input>", "prioritet": 1-5, "forslagModul": "hero|top-grid|breaking-bar|seneste-nyt|dit-omraade|sektion-rail|partner-break|sponsoreret-break|ad-break|egen-promo|kalender-strip|fra-kommunen|fra-politiet|debat|opslagstavle",
                  "begrundelse": "<= 200 tegn", "konfidens": 0.0-1.0 } ] }
```
**Validering (`parseAiRankerOutput`):** tåler ```json-hegn; envelope skal have `forslag`; hvert element valideres for sig: forkert form, ukendt `articleId`, dublet (første vinder) → droppes. Hele svaret kasseres (`schema`) hvis intet element er gyldigt eller > 30 % er ugyldige.

**Fejlhåndtering (`callJson`):** timeout (std 20 s, via `AbortController` + race, virker også for klienter der ignorerer signalet), **ét genforsøg** ved timeout / 5xx / 429 / 408 / netværksfejl / ugyldigt svar (400 ms · forsøg backoff), ingen genforsøg ved 4xx (fx ugyldig nøgle). Resultat er altid `{ok:true,…}` eller `{ok:false, reason: ingen-noegle | timeout | ugyldig-json | schema | api-fejl | tomt-svar}` – **kaster aldrig**, og bruges aldrig i render-stien.

**Claude-kald (`claude-api`-skill):** `@anthropic-ai/sdk`, `messages.create`, model fra `ANTHROPIC_MODEL` (std `claude-sonnet-4-6`), `max_tokens` 4096, SDK-`maxRetries: 0` (genforsøg styres af os), stabil systemprompt som `cache_control: {type: "ephemeral"}` (prompt caching; ingen datoer/data i systemprompten). Klienten injiceres (`AiTextClient`) så tests aldrig rammer nettet. Bemærk: systemprompten er p.t. under modellens minimale cache-længde, så caching aktiveres først når prompten vokser (uskadeligt). Alternativ senere: `output_config.format` (structured outputs) i stedet for tekst-JSON + zod; zod-valideringen bevares uanset.

**Sammenblanding (`compose.ts`):** AI-forslag med konfidens < 0.4 ignoreres. Ellers `kombineret = 0.55·norm(deterministisk score) + 0.45·(prioritet−1)/4`; et modul får +0.15 til artikler hvor `forslagModul` matcher modultypen. Kronologiske moduler (seneste-nyt, debat, breaking-bar) påvirkes aldrig af AI. Hver placering gemmer `kilde` (`ai` hvis AI-vurdering påvirkede valget, ellers `regel`), `prioritet`, `begrundelse`, `konfidens`, `score`.

## 11. Hårde rækværk (`guardrails.ts`)

Præcedens: **governance (tenant, status, mærkning, kvoteloft, AI-restriktioner) > redaktørens pins > breaking > AI/score.** Rækværkene køres under udvælgelsen (`placementProblems`), som sidste led i `composeFrontpage`/`enforceGuardrails`, ved godkendelse og redigering, og ved hver visning af et godkendt snapshot.

| # | Regel | Detalje | Kode |
|---|---|---|---|
| 1 | Pins/breaking vinder | `FrontpagePlacement` (zoner → hero/top-grid/dit-omraade/sektion-rail), `Article.pinned` (hero → top-grid) og friske breaking (< 12 t, kun Uafhængig; nyeste → hero, alle → breaking-bar) går forud for AI/score. Pin > breaking. | `compose.ts` |
| 2 | Kvoteloft | `quotaExceeded` (7-dages andel ≥ `Instance.kvoteloftProcent`, fra `calculateSupportedContentQuota`) blokerer **al** Partner/Sponsoreret/PR/Annonce, også redaktør-pins. Derudover maks `floor(udfyldte slots · loft%)` kommercielle placeringer i hele forsiden og i topzonen: AI/regel fjernes (laveste prioritet først), redaktørens pins bevares med advarsel. Automatisk placeres kommercielt kun i partner-/sponsoreret-bokse. | `kvoteloft` |
| 3 | AI-assisteret | Aldrig automatisk i hero (redaktør må, med eksplicit pin). Aldrig i Krimi/Sundhed (`isAiRestrictedCategory`) – heller ikke for redaktør. | `ai-hero`, `ai-begraenset` |
| 4 | Kun Publiceret | `status = Publiceret`, `publiceretTid` sat og ikke i fremtiden. | `status` |
| 5 | Diversitet | Max 1 artikel pr. `emneKey` i topzonen (hero + top-grid). Redaktørens valg bevares med advarsel. | `diversitet` |
| 6 | Friskhed | Pr. modul `config.maxAgeHours` eller modulstandard (hero/top 72 t, seneste-nyt 168 t, breaking 12 t …). Redaktør-pins og godkendte snapshots er undtaget. | `friskhed` |
| 7 | Tenant | `candidate.instansId === ctx.instansId`; fremmede kandidater ignoreres/afvises; service filtrerer altid på brugerens/cronens `instansId`. | `tenant` |
| 8 | Mærkning kan ikke fjernes | Label udledes af artiklen og er altid synlig; kommerciel/brugerindsendt/AI-assisteret uden gyldig mærkning (`validateMarking`) vises ikke; layout-schema afviser skjul-felter. | `maerkning` |
| 9 | Én artikel ét sted | Dubletter fjernes (undtagen breaking-bar, som er en peger). | `dublet` |
| 10 | Typer pr. modul | `autoContentTypes` for ranker/AI, `allowedContentTypes` for redaktør. Partner-boks kun Partner osv. | `type-ikke-tilladt` |
| 11 | AI-output | Ukendte `articleId`, forkert schema og forslag i strid med 1–10 får ingen effekt. | `ai-ranker.ts` |

Rækværkene er ikke konfigurerbare i layoutet og kan ikke slås fra via NL-kommandoer (ingen operation findes til det).

## 12. Fallback-kæde (`fallback.ts`, `resolveFrontpageForRender`)

1. **Sidst godkendte snapshot** hvis `status = godkendt`, `expiresAt` ikke passeret, og lavet til det aktuelle layout (`layoutId` + `layoutVersion`). Placeringerne **revalideres**; ugyldige (afpubliceret, kvoteloft nået …) erstattes deterministisk ("repareret"), resten bevares. Er intet gyldigt tilbage → trin 2.
2. **Deterministisk score** (`rank.ts` → `compose` → guardrails) hvis intet godkendt findes / det er udløbet / layoutet er ændret / trin 1 er tomt.
3. **Seneste nyt** (publiceretTid desc, kun ikke-kommercielt, tenant/status/mærkning/AI-restriktioner gælder) hvis trin 2 fejler eller giver intet (fx alt for gammelt). Er layoutet uden almindelige artikelmoduler bruges standardlayoutet.

Alle trin er indkapslet i try/catch; `resolveFrontpage` og `resolveFrontpageForRender` kaster aldrig – ved databasefejl returneres en tom seneste-nyt-model. Svaret indeholder `source`, `reason` (til editor-banner/log), `repaired` og `warnings`. AI deltager ikke i render-stien; en AI-fejl giver blot et deterministisk *forslag* + advarselen `ai-fejl`.

## 13. Editor-UX (`/redaktion/forside/editor`, bygges af UI-agenten)

**Layout:** tre kolonner – bibliotek (moduler + skabeloner, søgbar), lærred (forsiden som blokke), inspektør (valgt moduls indstillinger/slots/variant/config). Topbar: kladdenavn, version, **Gem kladde**, **Publicér**, **Fortryd/Gentag**, **Historik/Rul tilbage**, **Foreslå forside (AI)**, breakpoint-skifter 375/768/1440.

**Drag-and-drop:** `@dnd-kit/core` + `@dnd-kit/sortable` (installeres af UI-agenten; ikke i `package.json` endnu).
- Træk moduler fra biblioteket til lærredet og omsortér moduler; træk artikler mellem slots (kandidatliste i sidepanel; artikler fra forslaget kan byttes).
- **Tastatur:** `KeyboardSensor` med `sortableKeyboardCoordinates`; Mellemrum løfter/slipper, piletaster flytter, Esc annullerer; `aria-live`-meddelelser ("Hero flyttet til position 2 af 7"); synligt fokus; alternative knapper "Flyt op/ned", "Flyt til…" for ikke-træk-brugere; touchmål ≥ 44 px.
- Moduler har landemærke/overskrift (`role="group"` + `aria-label`); mærkning læses som tekst.

**Preview:** iframe/container med faktisk site-CSS ved 375/768/1440 px, rendereren får layout + (kladde-)snapshot; "Vis forslag" vs "Vis live".

**Tilstande:** *Kladde* (layout, ugemte ændringer markeret) → *Publicér* (bekræftelsesdialog med diff-opsummering; kræver `layout.manage`) → *Rul tilbage* (vælg version). Samtidig redigering: `expectedVersion`; ved `conflict` vises "Ændret af en anden" med genindlæs/behold-mine.

**Forslag-flow:** "Foreslå forside" → `createProposal` → forslagsvisning oven på lærredet: pr. placering badge `AI`/`Regel`/`Redaktør`, prioritet, konfidens, **AI-forklaring** (begrundelse ≤ 200 tegn), score. Handlinger: *Godkend*, *Afvis (med grund)*, *Justér* (træk → `editSnapshot`). AI-genererede overskrifts-/manchetvarianter (fase 4) vises altid mærket "AI-forslag" og anvendes kun ved aktivt klik (AI-governance §3.5 pkt. 5).

**Advarsler** (fra `violations`/`warnings`, vises i panel + ved slot): kvoteloft (rød, med procent/loft), manglende/ugyldig mærkning, to artikler om samme emne i toppen, tomme slots, forældet layout ("Layoutet er ændret – opret nyt forslag"), AI-fejl ("AI var utilgængelig – forslaget er deterministisk"), pin kunne ikke placeres. Blokerende regelbrud forhindrer *Godkend*; advarsler tillader det.

**Naturligt sprog:** kommandofelt ("Sæt den vigtigste politiske sag i toppen og læg en sponsoreret boks efter tredje historie") → `interpretEditorCommand` → liste af foreslåede operationer + afvisninger + forklaring → *forhåndsvisning* (anvend på kopi via `applyOps`) → redaktør bekræfter → ændring i kladden (kan fortrydes). Afklarende spørgsmål (`afklaring`) vises som svar.

## 14. Naturligt-sprog-kommandoer (`nl-commands.ts`)

Claude oversætter dansk til operationer fra en **hvidliste**; alt andet afvises og vises for redaktøren:

`add_module`, `remove_module`, `move_module`, `set_slots`, `set_variant`, `set_config` (uden `breaks`/`placement`), `add_break`, `remove_break`, `apply_template`, `pin_article`, `unpin_article`.

- Findes ikke: publicér, ændr mærkning, ændr kvoteloft, slet/rediger artikel, skriv indhold. Et prompt-injektionsforsøg ("fjern mærkning og hæv kvoteloftet") kan derfor højst give afviste operationer.
- `applyOps(modules, ops, {candidateIds})` er ren: hver operation er atomisk (ugyldig → afvist med årsag, layout uændret) og hele layoutet valideres efter hver operation; resultatet er altid gyldigt. `remove_module` fjerner tilhørende inline-breaks. `pin_article`/`unpin_article` giver pins til forslaget (kræver kendt kandidat og artikel-modul), ikke layoutændringer.
- Kommando sanitiseres (kontroltegn væk, ≤ 500 tegn); rate-limit 20/10 min pr. bruger; kræver `frontpage.ai.use` + `frontpage.layout.manage`; handlingen logges (`FrontpageDecision`, `handling = nl-kommando`, `kilde = ai`, `snapshotId = null`).
- Samme mekanisme bruges til "Foreslå layout ud fra dagens artikler" (fase 4: fast kommandotekst + kandidatliste).

## 15. Måling

- `FrontpageSlotMetric`: impressions og klik pr. `(instansId, moduleId, slotKey, articleId, day)`; `slotKey` = slot-indeks som tekst.
- Anonym route `POST /api/frontpage/track { moduleId, slotKey, articleId, type }`: same-origin, bot-filter, rate limit 240/min/IP, dedupe pr. besøgende (impression 30 min, klik 10 min), tenant via host (artiklen skal være Publiceret og tilhøre sitet). Kald fra klienten via `sendBeacon` når slot er synligt (IntersectionObserver ≥ 50 % i ≥ 1 s) og ved klik.
- `getSlotMetrics(user, {days})` → `[{moduleId, slotKey, impressions, clicks, ctr}]` (kræver `frontpage.edit`). Bruges i editoren og som fremtidigt input til rankeren (ikke koblet på endnu).
- Annoncer måles fortsat via `/api/ads/track`; artikelmetrik via `/api/metrics/track`.

## 16. Rettigheder

| Rettighed | Giver | Standardroller (`lib/default-roles.ts`, `npm run roles:sync`) |
|---|---|---|
| `frontpage.edit` (eksisterende) | Se forside-admin, pinne artikler, oprette *deterministiske* forslag, se metrics/snapshots | Ansvarshavende, Redaktionsleder |
| `frontpage.layout.manage` | Gemme kladder, publicere, rulle tilbage, NL-kommandoer | Ansvarshavende |
| `frontpage.snapshot.approve` | Godkende, afvise og redigere forslag | Ansvarshavende, Redaktionsleder |
| `frontpage.ai.use` | Bede om AI-rangering/NL-kommandoer | Ansvarshavende, Redaktionsleder |

Alle server-funktioner tager en bruger (`{id, name?, instansId, permissions}` – `AuthorizedUser` passer) og tjekker `can()`; `instansId` kommer altid fra brugeren, aldrig fra input; fremmede id'er giver `not-found` (ikke `forbidden`). Cron-ruten er ikke en bruger: den kan kun oprette forslag.

## 17. Migration og udrulning

1. `cd cms && npx prisma db push` (additivt: fem nye tabeller `FrontpageLayout`, `FrontpageLayoutVersion`, `FrontpageSnapshot`, `FrontpageDecision`, `FrontpageSlotMetric`; ingen eksisterende tabeller ændres). Produktion (Postgres): `prisma migrate` fra samme modeller.
2. `npm run roles:sync` (tilføjer de tre nye rettigheder til eksisterende roller; additivt). Brugere skal ikke logge ind igen: server-funktionerne læser rettigheder fra databasen via `getAuthorizedUser`.
3. Miljø: `CRON_SECRET` (min. 16 tegn; ellers svarer cron-ruten 503), valgfrit `FRONTPAGE_SNAPSHOT_TTL_HOURS`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` (som `/api/chat`). Se `cms/.env.example`.
4. Cron: kald `GET /api/cron/frontpage-rank` med `Authorization: Bearer $CRON_SECRET` hvert 15.–30. minut (Vercel Cron sender headeren selv). `?instans=<id>` for én by, `&ai=0` for kun deterministisk. Ruten er rate-limited (6 kørsler/min, 20 fejl/min/IP), konstant-tids sammenligning, og publicerer aldrig.
5. **Bagudkompatibilitet:** uden gemt layout bruges standardlayoutet; eksisterende `FrontpagePlacement` (pin-handlingerne på `/redaktion/forside`) fortsætter og indgår som pins. Indtil `page.tsx` skiftes til `resolveFrontpageForRender`, er den nuværende forside uberørt.
6. Rollback af hele T11/T12: skift `page.tsx` tilbage til `getFrontpageData`; tabellerne kan blive liggende.

## 18. Åbne spørgsmål

1. **Auto-tilstand:** hvornår (og for hvilke moduler) må et AI-snapshot gå live uden godkendelse? Foreslået: først efter 30 dages forslags-drift med < 5 % afviste/justerede placeringer; kun moduler uden kommercielt indhold; stadig underlagt alle rækværk.
2. **Snapshot-TTL:** 24 t (nu) – eller kortere (fx 6 t) så forsiden ikke "fryser"? Hvad skal ske natten over?
3. **Kvoteloft-semantik:** nuværende governance er 7-dages andel (`isExceeded` ved ≥ loft). Er "floor(slots·loft)" pr. forside + topzone den ønskede ekstra skærpelse, og skal Annonce-breaks (AdCampaign, ikke artikler) tælle med?
4. **AI-assisteret i hero:** må en redaktør pinne den (nu: ja, eksplicit pin) – eller skal det kræve ekstra bekræftelse/anden redaktør?
5. **Fra politiet/112:** må maskinindsamlede signaler vises på forsiden uden redaktionel gennemgang? Forslag: modulet er `visible=false` som standard og kræver redaktionelt opt-in; ellers risiko ved følsomme hændelser.
6. **Dit område personalisering:** område vælges i URL/lokal lagring (cookie-fri); acceptabelt, eller skal det være pr. instans-standard + redaktør-kuratering?
7. **Dagsdel/tidsstyrede layouts** (`scope`): skal det med i v1 (fx morgen vs. aften)?
8. **Delt rate-limit-store:** rate limits er proces-lokale (jf. `lib/ratelimit`); kræver Redis/Postgres ved flere instanser.
9. **Layoutpublicering nulstiller godkendelsen:** skal publicering automatisk oprette et deterministisk forslag (så redaktøren kan godkende med ét klik)?
10. **Emne-nøgle:** diversitet bruger første tag (ellers kategori). Skal der være en eksplicit "emne/sag"-relation (fx `Topic`)?
11. **Facebook/nyhedsbrev-distribution** af godkendt forside (jf. priser-siden) – udenfor scope, men bør bruge samme snapshot.

## 19. Testplan

Node `--test` i `cms/tests/frontpage-*.test.ts` (kører i `npm test`; 81 nye tests):

| Fil | Dækker |
|---|---|
| `frontpage-layout` | Modulregister-invarianter; schema (slots, varianter, config-nøgler, dublet-id, maks instanser, **mærkning kan ikke slås fra**), inline-break-regler, alle skabeloner, `top-med-annonce-break`, `applyTemplate`. |
| `frontpage-guardrails` | Hvert rækværk isoleret: tenant, status, mærkning, label-tampering, AI-hero, AI-Krimi/Sundhed, kvoteloft (blokering + loft-andel, redaktør bevares), typeregler, diversitet, friskhed, dubletter/ugyldige slots, variant-rettelse, redaktør vinder, tomme slots. |
| `frontpage-compose` | Ranker-determinisme (input-rækkefølge, ties), distribution-engine-genbrug, compose-determinisme, seneste-nyt kronologisk, breaking vinder, pin vinder, udløbne pins, kvoteloft vs. pin, AI-reranking (konfidens, ukendte id'er, kommercielt til hero), AI-assisteret-regler, diversitet + filtre, partner-/sponsoreret-bokse, tenant, mærkning/prioritet/begrundelse på alle placeringer, `placementsToPins`. |
| `frontpage-ai-fallback` | Model-env, `extractJson`, ranker succes/inputHash/systemprompt, ugyldig JSON (genforsøg), timeout, 5xx vs 4xx, ingen nøgle, streng schema (hvert felt), AI kan ikke bryde rækværk, **fallback-kæde**: godkendt → udløbet/layout ændret → deterministisk → seneste nyt → tom uden at kaste. |
| `frontpage-nl-commands` | Operationshvidliste, strikse parametre, `applyOps` (break efter slot N, atomisk afvisning, add/move/variant/config/template, kaskade ved remove, pins), sanitering, Claude-svar valideret, injektionsforsøg, fejl → `{ok:false}`. |
| `frontpage-service` (dev-SQLite, egne instanser ryddes) | Kandidater (tenant/status/mærkning), `createProposal` (rettigheder, tenant, AI-fejl → deterministisk, AI-succes, genbrug/force), **godkendelse (rettighed + tenant-isolation + revalidering + dobbeltgodkendelse)**, reparation ved afpubliceret artikel, afvis/redigér + log, layout kladde/publicér/historik/rollback/konflikt/tenant, slot-metrics (tenant, CTR), NL via service (rettigheder, logning), **cron-auth** (503/401/429, kun forslag, aldrig publicering). |

Manglende/anbefalet i UI-fasen: komponenttests af editoren, e2e af drag-and-drop med tastatur (Playwright/`webapp-testing`), a11y-audit (axe), visuel regression pr. breakpoint, og en live-røgtest mod Claude med rigtig nøgle (ingen test kalder nettet).

## 20. Faseplan

| Fase | Indhold | Status |
|---|---|---|
| 0 | Spec (dette dokument) | **Færdig** |
| 1 | Datamodel (5 tabeller), modulregister, layout-schema, skabeloner, rettigheder | **Færdig** |
| 2 | Ranker (deterministisk), guardrails, compose, fallback + tests | **Færdig** |
| 3 | AI-lag (Claude), service (forslag/godkend/afvis/redigér), cron, måling, NL-kommando-lag + tests | **Færdig** |
| 4 | **Modulær render** i `app/(site)/page.tsx` + module-komponenter (bruger API'et nedenfor); `/redaktion/forside` viser aktuelt forslag/godkendelse | UI-agent |
| 5 | **Editor** (`/redaktion/forside/editor`, dnd-kit, preview, kladde/publicér/rollback, NL-felt, advarsler, AI-forklaring, metrics-visning) | UI-agent |
| 6 | AI-udvidelser: "Foreslå layout", overskrifts-/manchetvarianter (altid mærket, kun ved klik), CTR som ranker-input | Senere |
| 7 | Auto-tilstand pr. modul (efter åbne spørgsmål 1), dagsdel-layouts, delt rate-limit-store | Senere |

---

## 21. API-kontrakt til UI-agenten (`cms/lib/frontpage/**`)

Alle server-funktioner importeres fra `@/lib/frontpage/service`; rene funktioner fra deres egne filer. Alle fejl returneres som `{ ok: false, code, error, violations?, details? }` med `code` ∈ `forbidden | not-found | conflict | invalid | layout-aendret | guardrails | no-candidates | rate-limited | ai-unavailable | fejl` – ingen kaster ind i UI'et (undtagen uforudsete bugs). Brugerobjektet er `FrontpageUser = { id: string; name?: string; instansId: string; permissions: readonly string[] }` (`AuthorizedUser` fra `getAuthorizedUser()` kan sendes direkte).

### Render (offentlig forside) – kaster aldrig
```ts
resolveFrontpageForRender(instansId: string, opts?: { now?: Date }): Promise<{ resolved: ResolvedFrontpage; layout: ActiveLayout }>
// ResolvedFrontpage: { source: "godkendt-snapshot"|"deterministisk"|"seneste-nyt"; reason: string; assignments: SlotAssignment[];
//                      warnings: Violation[]; snapshotId: string|null; layoutId: string|null; layoutVersion: number; repaired: number; modules: ModuleInstance[] }
// ActiveLayout: { id: string|null; version: number; name: string; modules: ModuleInstance[]; source: "live"|"standard" }
assignmentsByModule(assignments: SlotAssignment[]): Record<moduleId, SlotAssignment[]>   // @/lib/frontpage/compose
```
Rendering: iterér `resolved.modules` (brug dem, ikke kun `layout.modules` – i nødfallback kan de være standardlayoutet) i rækkefølge; spring `visible=false` over; for `kind="artikel"` hent artiklerne for `assignmentsByModule(...)[module.id]` (`db.article.findMany({ where: { id: { in }, instansId, status: "Publiceret" }, include: cover/forfatter/kategori })` – ét kald for hele siden); vis `label.tekst` i **alle** varianter; `variant` kommer fra assignment; skjul modul uden placeringer (breaking-bar, partner-/sponsoreret-break); inline-breaks (`module.config.breaks[{afterSlot, moduleId, repeatEvery?}]`) indsættes efter slot N i værten og må ikke renderes igen som egen række (`config.placement === "inline"`). `kind="dynamisk"`-moduler (`MODULE_REGISTRY[type].dataSource`) henter egen data og viser `fastMaerkning`. Sæt `data-module-id`/`data-slot-key` til måling. `region` (`full|main|sidebar`) styrer to-spalte-layout i `top-hero-sidebar`.

### Moduler, skabeloner, schema (rene)
```ts
MODULE_REGISTRY, MODULE_LIST, getModuleDef(type), VARIANT_RULES, DEFAULT_LABEL_TEXT      // modules.ts
TEMPLATES, getTemplate(id), instantiateTemplate(id, params?, takenIds?), applyTemplate(existing, id, params?, "append"|"replace"), defaultLayoutModules()   // templates.ts
parseModules(json): {ok:true,value:ModuleInstance[]}|{ok:false,errors:string[]}; validateLayoutModules(modules): {path,message}[]; effectiveVariant(m); listArticleSlots(modules)   // layout-schema.ts
applyOps(modules, ops, {candidateIds}): { modules; pins: Pin[]; unpins: string[]; applied; rejected }; validateOps(raw); ALLOWED_OPS   // nl-commands.ts
labelFor(candidate), enforceGuardrails({modules, assignments, candidates, ctx, skipFreshness?}), composeFrontpage(input)   // guardrails.ts / compose.ts (til klient-side preview bør kun serialiserbare data sendes til serveren)
```
Typer: `ModuleInstance`, `ModuleConfig`, `SlotAssignment`, `Violation`, `Pin`, `Candidate`, `AiSuggestion`, `SnapshotItems` (`types.ts`, `layout-schema.ts`).

### Forslag og godkendelse (kræver login)
```ts
createProposal(instansId: string, opts: { actor: {kind:"user", user: FrontpageUser} | {kind:"cron"}; useAi?: boolean /*std true*/; aiClient?: AiTextClient|null; force?: boolean; now?: Date }):
  Promise<{ ok:true; snapshotId; reused: boolean; generatedBy: "ai"|"deterministic"; modelId: string|null; warnings: Violation[]; aiFailure: {reason; detail?}|null; assignmentCount: number } | ServiceError>
  // kræver frontpage.edit (eller approve); useAi kræver frontpage.ai.use. Publicerer aldrig.
listSnapshots(user, { status?: "forslag"|"godkendt"|"afvist"|"udløbet"; take?: number }): Promise<SnapshotSummary[]>
getSnapshot(user, snapshotId): Promise<{ snapshot; items: SnapshotItems; decisions: FrontpageDecision[] } | null>
approveSnapshot(user, snapshotId): Promise<{ ok:true; expiresAt: Date; warnings: Violation[] } | ServiceError>   // frontpage.snapshot.approve; code "guardrails" + violations hvis noget ikke længere er gyldigt
rejectSnapshot(user, snapshotId, reason?): Promise<{ ok:true } | ServiceError>
editSnapshot(user, snapshotId, assignments: SlotAssignment[]): Promise<{ ok:true; items: SnapshotItems } | ServiceError>   // drag-and-drop på et forslag
```

### Layout (kræver `frontpage.layout.manage`)
```ts
listLayouts(user): Promise<{ live: FrontpageLayout|null; drafts: FrontpageLayout[] }>          // læsning: frontpage.edit eller layout.manage
saveDraftLayout(user, { draftId?: string|null; name: string; modules: unknown; expectedVersion?: number }): Promise<{ ok:true; draftId; version } | ServiceError>   // draftId udeladt = ny kladde; ellers expectedVersion påkrævet (conflict ved forældet)
publishLayout(user, draftId): Promise<{ ok:true; layoutId; version } | ServiceError>           // bagefter: tilbyd createProposal
listLayoutVersions(user): Promise<{ id; version; note; createdBy; createdAt }[]>
rollbackLayout(user, toVersion: number): Promise<{ ok:true; version } | ServiceError>
```

### AI i editoren og måling
```ts
interpretEditorCommand(user, text: string, modules: unknown /*editorens nuværende layout*/, opts?: { client?; timeoutMs?; retries? }):
  Promise<{ ok:true; ops: FrontpageOp[]; rejected: {op; reason}[]; forklaring: string; afklaring: string|null; modelId: string; candidateIds: string[] }
         | { ok:false; reason: string; detail?: string; candidateIds: string[] }   // AI-fejl (timeout, ugyldig JSON …)
         | ServiceError>                                                            // forbidden / invalid / rate-limited / ai-unavailable
  // kræver frontpage.ai.use + layout.manage; rate-limited 20/10 min; logger. Anvend derefter applyOps(modules, ops, {candidateIds: new Set(candidateIds)}) på kladden efter redaktørens bekræftelse.
logAiAction(user, { handling: string; begrundelse: string; konfidens?: number|null; slot?: string }): Promise<void>
getSlotMetrics(user, { days?: number }): Promise<{ moduleId; slotKey; impressions; clicks; ctr }[]>
recordSlotEvent({ instansId, moduleId, slotKey, articleId, type: "impression"|"click" }): Promise<{ok:true}|{ok:false; reason:"invalid"|"not-found"}>   // bruges af /api/frontpage/track
```
Klient → `POST /api/frontpage/track` med `{ moduleId, slotKey: String(slotIndex), articleId, type }` (JSON; `sendBeacon` ok).

### Øvrige ruter og miljø
- `GET|POST /api/cron/frontpage-rank[?instans=<id>][&ai=0]`, `Authorization: Bearer ${CRON_SECRET}` → `{ ok, published: false, results: [{instansId, ok, snapshotId, reused, generatedBy, assignments, aiFailure}] }`.
- Miljø: `CRON_SECRET`, `FRONTPAGE_SNAPSHOT_TTL_HOURS`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (std `claude-sonnet-4-6`).
- Rettigheder: `PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE` (`frontpage.layout.manage`), `FRONTPAGE_SNAPSHOT_APPROVE` (`frontpage.snapshot.approve`), `FRONTPAGE_AI_USE` (`frontpage.ai.use`); eksisterende `FRONTPAGE_EDIT`.

### Filoversigt
`cms/lib/frontpage/`: `types.ts`, `modules.ts`, `layout-schema.ts`, `templates.ts`, `guardrails.ts`, `rank.ts`, `compose.ts`, `fallback.ts`, `ai-client.ts`, `ai-ranker.ts`, `nl-commands.ts`, `service.ts`. Ruter: `cms/app/api/cron/frontpage-rank/route.ts`, `cms/app/api/frontpage/track/route.ts`. Schema: fem nye modeller i `cms/prisma/schema.prisma`. Tests: `cms/tests/frontpage-{layout,guardrails,compose,ai-fallback,nl-commands,service}.test.ts` + `frontpage-fixtures.ts`.
