# 08 – Simulator og AI-udgivelsesplan (`/redaktion/simulator`)

Dato: 2. oktober 2026. Status: Fase 0 (design). Kilder: master-spec §20-§23; plan Tilføjelse 1 og Fase 6; CMS: `lib/frontpage/{rank,compose,guardrails,fallback,service,types,modules,layout-schema}.ts`, `lib/distribution-engine.ts`, `lib/frontpage-governance.ts`; `docs/review/T11-T12-spec.md`.

## 1. Formål og afgrænsning

Ejeren skal kunne **se hvordan flowet virker og hvordan AI'en vil prioritere og planlægge, før noget går live**: sandbox med virtuelt ur, rigtige eller syntetiske artikler, en AI-udgivelsesplan (kun forslag), forklaring af placeringer, "anvend som forslag", shadow-mode og sammenligning af politikker.

**Kerneprincip (ikke til forhandling):** simulatoren bruger **samme forsidekode som produktion** (`rankCandidates`, `composeFrontpage`, `enforceGuardrails`, `resolveFrontpage`), men **skriver aldrig til live**. Eneste skrivninger er egne rækker (`SimulationRun`, `AiUsage`) og — efter eksplicit klik — *forslag* ("Anvend som forslag", §7). Samme input + politik + virtuelt ur ⇒ samme output (spec §16, §28).

**Hvad simulatoren ikke er:** en recommendation-motor (den *kalder* forsidekernen), en ny scoringsmodel, historisk replay (uden for scope; kræver "as-of" metrics, §2).

## 2. Hvad kan genbruges uændret – og hvad mangler (verificeret)

Plan-antagelsen var "kald `resolveFrontpageForRender({now})` i en sandbox". **Verificeret mod koden: `now` kan ikke injiceres overalt.** Derfor bygger simulatoren på de *rene* funktioner (alle tager `now`), ikke på `resolveFrontpageForRender`.

| Funktion | Fil:linje | `now` injicerbar? | Skriver? | Bruges i simulator? |
|---|---|---|---|---|
| `rankCandidates(candidates, {now, hour})` | `rank.ts:45-63` | **Ja** (`copenhagenHour(now)` `:24`) | nej | **Ja, uændret** |
| `calculateArticleScore(art, {now, currentHour})` | `distribution-engine.ts:71-118` | **Ja** (`currentHour` ellers `now.getHours()`, men `rank.ts` angiver den) | nej | via `rankCandidates` |
| `composeFrontpage({instansId, modules, candidates, pins, ai, quota, now, hour, fixed})` | `compose.ts:59-238` | **Ja** (inkl. pin-udløb `:128`) | nej | **Ja, uændret** |
| `basicEligibility`, `placementProblems`, `enforceGuardrails`, `ageHours` (`ctx.now`) | `guardrails.ts:41,81,119,174` | **Ja** | nej | **Ja, uændret** |
| `adBreakAllowance`, `commercialCap` | `guardrails.ts:62-78` | rene | nej | Ja (annoncer/kvote) |
| `resolveFrontpage({…, approved, now, hour})` | `fallback.ts:62-120` | **Ja** (snapshot-udløb `:73`) | nej | Ja (til shadow: "hvad ville live vise") |
| `buildAiInput({modules, ranked, now})`, `rankWithAi(input, {client})` | `ai-ranker.ts:96,146` | **Ja**; AI-klient injiceres | nej (kun AI-kald) | Ja (valgfrit "AI-re-ranker"-trin) |
| `publicSignalWhere(instansId, module, now)` | `signals.ts:20` | **Ja** | nej (kun læsning) | Ja til signalmoduler |
| `loadCandidates(instansId, {now})` | `service.ts:77-117` | **Delvis**: `publiceretTid ≤ now`, men `status`/`ArticleMetric` er *nuværende* (ikke "as-of") | nej | Ja til rigtige artikler, med forbehold |
| `loadPlacementPins(instansId, now)` | `service.ts:69-75` | **Ja** for udløb; men aktuelle placements | nej | Ja (pins/locks som input) |
| `getActiveLayout(instansId)` | `service.ts:54-62` | **Nej** (kun nuværende live-layout) | nej | Ja, read-only; scenarie kan overstyre `modules` |
| `getApprovedSnapshot(instansId)` | `service.ts:119-128` | **Nej** (nyeste godkendte) | nej | Kun til shadow på *rigtigt nu* |
| `getQuota` → `calculateSupportedContentQuota` | `service.ts:64`, `frontpage-governance.ts:21-58` | **Nej:** `Date.now()` (`:28`) | nej | **Nej** – simulatoren beregner kvote fra scenariet (§3.3) |
| `resolveFrontpageForRender(instansId, {now})` | `service.ts:139-159` | **Delvis** (se ovenfor; kvote/layout/snapshot ikke as-of) | nej | Kun som "faktisk forside lige nu" i shadow |
| `createProposal(instansId, {now,…})` | `service.ts:189-266` | beregning ja | **Ja** (snapshot+decisions) | **Nej** – må ikke kaldes i sandbox |

**Hvad der mangler (og hvordan det løses uden kerneændring):**
1. *Kvote som på klokkeslæt X:* simulatoren genberegner 7-dages-kvoten fra scenariets artikler med samme formel (`percentage = round(supported/total·100)`, `isExceeded = percentage ≥ kvoteloftProcent`; `COMMERCIAL_TYPES`, `types.ts:35`). **Ækvivalenstest** (`tests/localrating-simulator-quota.test.ts`): identisk data ⇒ samme `isExceeded` som `calculateSupportedContentQuota` ved reelt nu. *Evt. senere, kræver ejerens tilladelse:* valgfri `now`-parameter på `calculateSupportedContentQuota` (additiv, default `Date.now()`).
2. *Syntetiske artikler:* `Candidate` er et fladt serialiserbart objekt (`types.ts:42-65`) – scenariet leverer dem direkte; ingen DB-skrivning.
3. *As-of metrics/status:* v1 bruger metrics fra scenariet (syntetisk) eller *nuværende* `ArticleMetric` for rigtige artikler (mærkes "metrics = nu"). Historical replay (virkelige historiske døgn) er **uden for scope** (kræver historiske metrics, spec §23).
4. *Tuning af rank-vægte:* konstanterne i `distribution-engine.ts` (`50/+300/+150`, decay, daypart, geo) og `AI_WEIGHT`/`AI_MIN_CONFIDENCE` (`compose.ts:32-33`) er modul-konstanter, **ikke parametre**. "Politik" i v1 er derfor begrænset til det kernen allerede tager som data: layout/modulkonfiguration (`slots`, `config.maxAgeHours`, `sektionSlug`, breaks), `kvoteloftProcent`, pins/locks, AI til/fra + planner-prompt/model, og LocalRatings A/B/C→prioritet-mapping (§7). Rank-vægt-politikker kræver en lille additiv kerneændring (valgfri `ComposeInput.rankOptions`) – åbent spørgsmål.
5. **Tenant-hardcode i kernen:** `distribution-engine.ts:100` giver +15 til alle områder ≠ `"slagelse-by"` (og `:41,:53` hardkoder sektions-slugs). I andre byer får *alle* områder bonus (konsistent, men ikke meningsfuldt). Simulatoren **arver** dette (samme kode som produktion = samme adfærd); det flages og vises som advarsel i UI ("geo-bonus er kalibreret til Slagelse-slugs"). Retning kræver ejerbeslutning (README nr. 5).

## 3. Sandbox og virtuelt ur

### 3.1 Virtuelt ur
```ts
interface VirtualClock { date: string /* YYYY-MM-DD, Europe/Copenhagen */; times: string[] /* "07:00","09:00","12:00","15:00","18:00","22:00" + frie "HH:mm" */ }
```
- Forudindstillinger (spec §23): **07:00, 09:00, 12:00, 15:00, 18:00, 22:00** + frit klokkeslæt. Tid omsættes til UTC `Date` via `Intl` med `Europe/Copenhagen` (sommer-/vintertid testes: 2026-03-29 og 2026-10-25).
- For hvert tidspunkt kaldes `rankCandidates`/`composeFrontpage` med `now = t` og `hour = copenhagenHour(t)`. Ingen kald til `Date.now()` i simulatorkode (lint/test: `tests/localrating-simulator-no-wallclock.test.ts` grep'er `Date.now|new Date()` uden argument i `lib/localrating/simulator/**`).

### 3.2 Scenarie-input (rigtige eller syntetiske)
| Inputtype | Indhold | Kilde |
|---|---|---|
| **Rigtige artikler** | `articleIds[]` fra instansen (publicerede) → `Candidate` via `loadCandidates` (instans-filtreret) | DB, read-only |
| **Rigtige kandidater/kladder** | `StoryCandidate`/`Article` (status `Idé…Godkendelse`) med `plannedPublishAt` → *simuleres som publiceret fra det tidspunkt*; mærkning antages godkendt (`assumeApproved=true`, advarsel "kladde ville fejle `maerkning` uden godkendelse", `guardrails.ts:88-90`) | DB, read-only |
| **Syntetiske artikler** | Fuld `Candidate`-form: A/B/C, `StoryType`, `sektionSlug`, `omraadeSlug`, `indholdstype`/mærkning, `publiceretTid`, `breaking`, metrics (`visninger`, `laesninger`, `totalLaesetidSek`; evt. impressions/CTR/engaged time som afledte felter), `emneKey` | scenarie-JSON |
| **Hændelser** | `breaking` (sætter `breaking=true` fra tidspunkt T), `tip_cluster` (kun kontekst i v1: ingen rank-effekt), `sponsor_campaign` (antal annonceenheder → `adBreakAllowance`) | scenarie-JSON |
| **Layout** | Instansens aktive layout (read-only) eller scenarie-`modules` (valideret af `parseModules`) | DB/scenarie |
| **Pins/locks** | `FrontpagePlacement`-pins (read-only) + scenarie-pins | DB/scenarie |

Alle ID'er tjekkes mod `instansId` (fremmed id ⇒ ignoreres + `tenant`-advarsel, som `compose.ts:71-73`). Grænser: ≤ 200 artikler, ≤ 24 tidspunkter, ≤ 50 hændelser.

### 3.3 Kvote og politik
`QuotaInput { kvoteloftProcent, isExceeded }` udledes af scenariets 7-dages-vindue (§2 pkt. 1) eller sættes manuelt ("simulér at kvoteloftet er nået"). `SimulationPolicy { version, … }` indeholder kun det kernen tager som data (§2 pkt. 4); `policyVersion` gemmes (spec §21).

## 4. AI-udgivelsesplan (kontrakt)

AI'en (Claude via `AiGateway`, task `planner`, prompt `lr:simulator.planner`) **foreslår**: hvilke kandidater der skrives/udgives hvornår, i hvilket forsidemodul/slot, med foreslået A/B/C og begrundelse. Planen er **forslag**; den udfører ingenting.

### 4.1 Input til planlæggeren
BRUGER-del (betroet JSON): scenarie-oversigt, ur, modulernes pladser, aktive pins/locks, kvotestatus, redaktionelle prioriteter. HENTET INDHOLD (ubetroet): kandidaternes titel/resumé/rating-delscorer (kun feltsæt tilladt af rights). Max 60 kandidater (som `AI_MAX_CANDIDATES`, `ai-ranker.ts:16`).

### 4.2 Output (zod, strikt; mønster fra `aiSuggestionSchema`, `ai-ranker.ts:39-47`)
```ts
export const planItemSchema = z.object({
  kind: z.enum(["write", "publish", "promote", "update"]),
  candidateId: z.string().max(64).optional(),
  articleId: z.string().max(64).optional(),
  plannedAt: z.string().datetime({ offset: true }),
  moduleType: z.enum(MODULE_TYPE_IDS).optional(),     // kun kind:"artikel"-moduler
  slotIndex: z.number().int().min(0).max(50).optional(),
  priority: z.enum(["A", "B", "C"]).optional(),
  begrundelse: z.string().trim().min(1).max(200),
  konfidens: z.number().min(0).max(1),
}).strict();
export const planSchema = z.object({ items: z.array(planItemSchema).max(60), forklaring: z.string().max(600) }).strict();
```
Per-element validering som `parseAiRankerOutput` (`:61-81`): ukendt id/dublet/forkert form ⇒ droppes; > 30 % ugyldige ⇒ hele planen kasseres (`schema`-fejl).

### 4.3 Hårde regler (kan ikke tilsidesættes af AI) – håndhæves *efter* AI-svaret
| # | Regel | Håndhævelse |
|---|---|---|
| H1 | Kun kendte id'er fra input; tenant = instansen | whitelist; `tenant`-violation |
| H2 | **Pins/locks vinder:** redaktørens pins og `locked` placeringer flyttes aldrig | `composeFrontpage` placerer pins først (`compose.ts:127-157`); plan-items i konflikt droppes med årsag |
| H3 | **Kvoteloft:** `commercialCap`, `quotaExceeded` blokerer kommercielt, også AI-forslag | `placementProblems :146-148`, `applyCommercialCap :258-296` |
| H4 | **Mærkning:** ugyldig mærkning ⇒ ikke vist; label udledes af artiklen | `basicEligibility :88-90`, `labelFor :47` |
| H5 | **Krimi/Sundhed + AI-assisteret:** aldrig; AI-assisteret aldrig automatisk i hero | `isAiRestricted :53-59`, `placementProblems :143-145` |
| H6 | **Kun godkendt indhold på forsiden:** kun `Publiceret` (eller `assumeApproved`-simuleret med advarsel) | `basicEligibility :85-87` |
| H7 | **Aldrig udførsel:** ingen plan-handling ændrer status, publicerer eller opretter kladder; `PlanItem.status` starter `proposed` | arkitektur: planner har kun læse-/forslags-adgang |
| H8 | Politi/112- og Krimi/Sundhed-kandidater kan ikke planlægges til `write` (AI-udkast) | samme regler som `createIngestDraft` (`articles.ts:69-81`) forhåndstjekkes |
| H9 | Horisont ≤ 48 t, ≤ 6 `write`/time, `plannedAt` skal ligge i horisonten | `validatePlan` |
| H10 | Diversitet (1 pr. emne i topzonen), friskhed pr. modul, dublet-forbud | `enforceGuardrails` |

**Pipeline:** `planWithAi` → `validatePlan` (zod + H1,H7-H9) → `simulatePlan` (planen omsættes til virtuelle publicerings-/pin-hændelser og køres gennem `composeFrontpage` pr. tidspunkt; H2-H6/H10 håndhæves af kernen) → resultat: *gyldige* poster + *afviste* poster med årsag (vises). Ved AI-fejl/timeout/ugyldig JSON/budget: planen udebliver, den **deterministiske** simulering vises stadig (som forsidens fallback-kæde `fallback.ts:18-26`).

### 4.4 Determinisme og AI
Den deterministiske del er bit-reproducerbar. AI-planen er et *artefakt*: gemmes i `SimulationRun.aiPlan` (+ `promptVersionId`, model, `usageId`) og **gen-afspilles fra gemt plan** i stedet for nyt AI-kald (valgfrit "kør ny AI-plan"). `inputHash = sha256(kanonisk JSON af scenarie+politik+ur+layout+kvote)`.

## 5. Forklaring af placeringer ("hvorfor flyttede den?")

`SlotAssignment` bærer allerede `kilde` (ai/redaktør/regel), `prioritet`, `begrundelse`, `konfidens`, `score`, `locked` (`types.ts:73-90`) og `describeScore` (`rank.ts:82-85`). `simulator/explain.ts` tilføjer **delscore-nedbrydning pr. tidspunkt** fra `DistributionScoreResult` (`distribution-engine.ts:18-26`): `baseEditorialScore`, `decayMultiplier`, `velocityScore`, `daypartBonus`, `geoBonus`, `totalScore`.

Mellem to tidspunkter T₁→T₂ beregnes pr. artikel `Δ` for hver delscore + positionsændring og formuleres deterministisk (ingen LLM):

> *12:00: "Kommunen lukker Ringvejen" flyttede hero → top-grid[0]. Friskhed −9 (decay 0,84→0,71), dagsdel −25 (nyheder 06-10 → 0), konkurrence: ny A-historie "Brand på havnen" (breaking, +300 basis) tog hero.*

Visning: tidslinje med badge pr. placering (`Redaktør`/`Regel`/`AI`), delscore-bjælker, og en "ændringslog" (spec §21 "Why did this move?"). Gemmes i `SimulationRun.result.explanations`.

## 6. Shadow-mode og sammenligning

**Shadow-mode** (spec §23, "før AUTO"): for *rigtige* data kører simulatoren (uden AI-plan, eller med) ved reelt `now` og sammenligner **"hvad redaktøren valgte" (faktisk forside via `resolveFrontpageForRender(instansId, {now})`, `service.ts:139`) mod "hvad motoren ville vælge" (`composeFrontpage` under valgt politik)**. Kørsel som `ProductionJob` hvert N. minut (default 60) når `simulatorEnabled`; gemmer `SimulationRun` (`kind: shadow`) med metrikker: overlap@k, rangkorrelation, antal flyttede slots, antal rækværksovertrædelser. UI: sektion "Redaktørens valg vs. motorens valg". **Ingen auto-tilstand aktiveres** (spec Fase 11; AUTO_* er uden for scope).

**Politiksammenligning (A mod B):** samme scenarie + ur køres med to `SimulationPolicy`; `compare(a,b)` viser pr. tidspunkt hvilke artikler/slots der afviger og hvorfor (delscore-/rækværksforskelle). Begrænset til de politik-parametre §2 pkt. 4 beskriver.

## 7. "Anvend som forslag" (aldrig direkte på live)

Redaktøren (kræver `SIMULATOR_USE` + `FRONTPAGE_EDIT`) vælger ét tidspunkt (typisk "nu") i en kørsel og trykker **Anvend som forslag**. Server-handling `applyAsProposal(user, runId, {time, planId?})`:

1. **Forudsætninger:** scenariets layout = instansens *aktive* layout (ellers kun sammenligning; `snapshot.layoutId/layoutVersion` skal matche, jf. `approveSnapshot :291-293`); kørslen tilhører brugerens instans; ingen `forslag` med nyere input uden bekræftelse.
2. **Valider mod friske data:** genindlæs kandidater (`loadCandidates(instansId, {now: reelt nu})`), kør `enforceGuardrails({ …, skipFreshness:true })` (som `approveSnapshot :295`). Hvis færre placeringer overlever ⇒ afbryd med `guardrails`-fejl og vis hvilke.
3. **Skriv i én transaktion** (efter mønstret i `createProposal`, `service.ts:245-260`, **uden at ændre den**): udløb eksisterende `forslag` (`updateMany status:"forslag"→"udløbet"`, kun denne instans) → `FrontpageSnapshot.create({ status:"forslag", mode:"forslag", generatedBy: planBrugt ? "ai" : "deterministic", modelId:"localrating-simulator:<model>", inputHash, layoutId, items: SnapshotItems(schemaVersion 1, layoutVersion, assignments, warnings) })` + `FrontpageDecision`-rækker (`handling:"placeret"`, `kilde: ai|regel`, `begrundelse`). `items` valideres med `parseSnapshotItems` (`layout-schema.ts:221`). **Status er altid `forslag`; aldrig `godkendt`.** Godkendelse sker i den eksisterende forsideeditor (`approveSnapshot`).
4. **Redaktionelle prioriteter:** `EditorialPriority` upsert for artikler i planen (`A|B|C`, `source:"simulation:<id>"`, `expiresAt = horisontens slut`). *Kendt begrænsning:* kernen læser ikke `EditorialPriority` (hverken `rank.ts` eller `compose.ts`); effekten på live går udelukkende gennem snapshot-placeringerne. For at A/B/C er meningsfulde i forslaget sættes `SlotAssignment.prioritet` (1–5) fra A→5, B→3, C→2 (redaktøren kan redigere via `editSnapshot`).
5. **Plan:** `PublicationPlan` (`status:"proposed"`) + `PlanItem`-rækker (`status:"proposed"`). Redaktøren godkender/afviser poster i `/redaktion/simulator/planer`; udførelse sker i det eksisterende workflow; `RECONCILE` markerer poster `done` når artiklen observeres publiceret (`04-…` §4).
6. `writeAudit("localrating.simulator.apply", …)`; svar: `{ snapshotId, planId }` + link til forsideeditoren ("Forslag venter på godkendelse").

**Konsekvens at vise før bekræftelse:** "Dette erstatter det nuværende forsideforslag" (kun ét aktivt forslag pr. instans, `T11-T12-spec §9`).

## 8. UI (`/redaktion/simulator`)

Venstre: **scenariebygger** (faner: Artikler [vælg rigtige / opret syntetiske], Hændelser, Kampagner, Ur & politik, Plan). Midte: **tidslinje** (6 faste tider + frie) og **forsidevisning pr. tidspunkt** (modul/slot-grid med variant, mærkning som tekst, `kilde`-badge). Højre: **"Hvorfor?"-panel** (delscore-nedbrydning, ændringslog, advarsler/rækværksfund). Topbar: Kør, Sammenlign politik, Kør AI-plan (viser pris-estimat; kræver `production.ai.use`), Anvend som forslag, Gem scenarie. Forudindstillede scenarier: *Almindelig hverdag*, *Breaking kl. 14*, *Kvoteloft nået*, *Rolig nat*. Display genbruger kernens `assignmentsByModule` (`compose.ts:265`) og artikel-DTO-mønstret fra `app/redaktion/forside/_lib/loaders.ts` (`loadArticleLites`); at eksisterende `PreviewPanel`/`SlotBoard` kan genbruges er **uverificeret** (kun filnavne set) – ellers egne komponenter.

### 8.1 Chat-lignende flader og AI-operatøren
- **Chat-lignende dele** af simulatoren ("Hvorfor flyttede den?" som samtale, "Spørg AI om scenariet", planlæggerens begrundelsesdialog) bygges efter skillet **`chat-module`** på de delte komponenter i `components/chat/` (besked-rendering, auto-scroll kun nær bunden, typing-indikator m. `prefers-reduced-motion`, input-adfærd, kopi-knap, fejl/retry) – se `04-…` §6. Forklaringerne (§5) er deterministiske data; kun *dialogen* er AI.
- **AI-operatøren** kan oprette og køre simulatorting via værktøjsregistret (`04-…` §5.1): `scenario_create/update` (safe-write), `simulation_run` (safe-write uden AI, **confirm** med AI-plan), `plan_create_manual/plan_item_update` (safe-write), `priority_set` (safe-write), `plan_approve/plan_reject` (**confirm**, udfører intet) og `simulator_apply_as_proposal` (**confirm**; skriver kun `FrontpageSnapshot(status=forslag)`). `approve_snapshot`/`publish_layout` er og forbliver **blokerede** for operatøren (`lib/operator/policy.ts` `BLOCKED_TOOLS`); operatøren kan derfor aldrig få en AI-plan live uden redaktørens egen godkendelse i forsideeditoren. Registreres i Fase 6.

## 9. Rettigheder, grænser, drift
- `SIMULATOR_USE` (`simulator.use`): se/køre/gemme scenarier; AI-plan kræver desuden `PRODUCTION_AI_USE`; "Anvend som forslag" desuden `FRONTPAGE_EDIT`. Side-gating via `PAGE_PERMISSIONS` + nav.
- Alle kald instans-bundne; rate limit via `guardAdminAction`; AI-forbrug i `AiUsage` (`task=planner`) og under månedsloft.
- `SimulationRun`-rækker beholdes 90 dage (housekeeping); `appliedSnapshotId/appliedPlanId` bevares via soft refs.

## 10. Tests (`tests/localrating-simulator-*.test.ts`)
| Test | Dækker |
|---|---|
| Determinisme | samme scenarie+politik+ur ⇒ identisk `result` og `inputHash` (inkl. ties) |
| **Ingen skrivning til live** | kør alle simulatorveje mod en Prisma-proxy der kaster ved skrivning til alt andet end `SimulationRun`/`AiUsage`/`ProductionJob`; `applyAsProposal` skriver kun `FrontpageSnapshot(status=forslag)`, `FrontpageDecision`, `EditorialPriority`, `PublicationPlan/PlanItem` |
| Rækværk kan ikke omgås | AI-plan der placerer AI-assisteret i hero, Krimi/Sundhed, kommercielt over loft, eller flytter en pin ⇒ droppet/afvist med årsag; resultat er altid gyldigt |
| Tenant | scenarie med artikel-id fra anden instans ⇒ ignoreres; `applyAsProposal` på fremmed run ⇒ "findes ikke" |
| Kvote-ækvivalens | simuleret `isExceeded` = `calculateSupportedContentQuota` på identiske data |
| Uret | ingen `Date.now()` i simulatorkode; sommer-/vintertid; frit klokkeslæt |
| Plan-validering | ukendt id, dublet, > 30 % ugyldige, plannedAt udenfor horisont |
| Fallback | AI-fejl/budget ⇒ deterministisk visning + `ai-fejl`-advarsel, ingen crash |
| Anvend-forslag | layout-mismatch ⇒ afvist; færre overlevende placeringer ⇒ `guardrails`; transaktion rulles tilbage ved fejl |

## 11. Mulige senere, minimale kerneændringer (kræver ejerens tilladelse; ingen er nødvendige i v1)
1. `calculateSupportedContentQuota(instansId, now?)` (additiv parameter).
2. `ComposeInput.rankOptions`/`scoreAdjust` så rank-vægte og `EditorialPriority` kan indgå (additiv).
3. Fjern `"slagelse-by"`/sektions-hardcodes i `distribution-engine.ts` til instans-konfiguration.
4. Valgfri hook så `FrontpageSnapshot`-godkendelse kan observeres uden polling.
