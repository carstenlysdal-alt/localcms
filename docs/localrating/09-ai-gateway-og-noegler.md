# 09 – AI-gateway, globale nøgler, forbrugsmåling og GDPR

Dato: 2. oktober 2026. Status: Fase 0 (design). Kilder: plan beslutning 2; CMS: `lib/frontpage/ai-client.ts`, `lib/resilience.ts`, `lib/env.ts`, `scripts/check-secrets.ts`, `app/api/chat/route.ts`, `docs/ops/RAILWAY-SETUP.md`; Y: `sireRoute.ts:85-331`, `index.ts`, `server/services/aiService.ts`.

## 1. Udgangspunkt

| | Y Rating (donor) | CMS i dag |
|---|---|---|
| Udbydere | DeepSeek `deepseek-chat` (primær) → **stille** fald tilbage til Gemini 2.5 flash (`sireRoute.ts:100-156`) | Anthropic (`ANTHROPIC_API_KEY`, model `claude-sonnet-4-6`) |
| Kopier af wrapper | 3 + `aiService.ts`: `callDeepSeek :100`, `callDeepSeekStream :158`, `callDeepSeekText :240`, `server/services/aiService.ts:1-49` | 2 kaldesteder: `ai-client.ts` (forside) og `app/api/chat/route.ts` |
| Nøgler | Firebase secrets + **hardcodede fallback-værdier i kildekoden** (se §7) | Kun Railway-variabel |
| Forbrugsmåling | Ingen | Ingen (`usage` læses ikke) |
| Loft | Ingen | Ingen |
| Fejl | Gemini-fallback uden vidende om dataflytning | Circuit breaker `anthropic` (`ai-client.ts:44`, `route.ts:75`), `callJson` retry/timeout |

**Beslutning (ADR-007):** ét provider-agnostisk lag `lib/ai/` bruges af LocalRating og simulator. `lib/frontpage/ai-client.ts` og `/api/chat` forbliver **uændrede** (ingen refaktorering af eksisterende moduler); de kan senere flyttes til gatewayen som separat beslutning.

## 2. Arkitektur

```
Kalder (rating/generate/translate/factcheck/planner/playground)
   │  AiGatewayRequest { instansId, task, system, user, retrieved[], json?, piiPolicy, runRef… }
   ▼
AiGateway.complete()/stream()
   1. policy-gate  : instans enabled · provider tilladt · piiPolicy · rights (kalder har allerede gatet input)
   2. budget-gate  : månedsloft (instans) + globalt loft + per-tick-/per-bruger-rate-limit
   3. model-routing: task → provider:model (env) · override i LocalRatingConfig.defaultProvider/allowedProviders
   4. præambel     : prompt-registrets låste SYSTEM-præambel; retrieved[] indrammes (<hentet_indhold>) — aldrig i system
   5. provider-adapter (anthropic | gemini | deepseek) bag circuit breaker + timeout + 1 retry
   6. parse        : json-repair + zod (hvis json.schema) — aldrig kast
   7. usage        : ÉN AiUsage-række (altid, også ved afvisning/fejl)
   ▼
AiGatewayResult { ok:true, value, usage } | { ok:false, reason, detail }
```

**Providers** (`lib/ai/providers/`):
| Provider | Default? | Transport | Bemærkning |
|---|---|---|---|
| `anthropic` | **Ja** | `@anthropic-ai/sdk` (allerede afhængighed `^0.115.0`), `maxRetries: 0` (retries styres af gatewayen), `cache_control: ephemeral` på systemblok hvis > minimumslængde | Samme mønster som `ai-client.ts:42-59` |
| `gemini` | Nej | `fetch` mod Google Generative Language REST (`generateContent`), ingen ny pakke | Valgfri; kræver `GEMINI_API_KEY` |
| `deepseek` | Nej, **spærret som standard** | `fetch` mod OpenAI-kompatibel `chat/completions`, ingen ny pakke | Kun efter eksplicit ejergodkendelse (§6) |

Ingen ny runtime-afhængighed er nødvendig for gatewayen (kun `fetch`/eksisterende SDK).

**Evner ud over tekst (paritet med Y):** (a) **vision** – `parse_file` af billeder/avisudklip (Y: Gemini Vision, `sireRoute.ts:302-317`) går gennem gatewayen som `AiGatewayRequest.attachments` (billede/PDF-sider, ≤ `LOCALRATING_MAX_UPLOAD_MB`); Anthropic er default-udbyder (understøtter billedinput), `gemini` valgfri; (b) **billedgenerering** (Y: `callGeminiImageGeneration :319-331`) er **ikke** en gateway-opgave i v1 – kun `hero-brief` (tekstbrief); billedgenerering kræver ejerbeslutning om AI-billeder i journalistik (D22); (c) **søgning** (Exa) er en separat connector (`lib/localrating/research.ts`), ikke en LLM-udbyder; (d) alle disse fylder `AiUsage` (task `parse_file`, `research` …).

## 3. Konfiguration: kun globale Railway-variabler (plan beslutning 2)

**Ingen nøgler i databasen. Ingen BYOK-UI.** Variabelnavne (værdier gengives aldrig i dokumentation, logs, `AiUsage`, fejlbeskeder eller klient):

| Variabel | Påkrævet | Default | Betydning |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ja for default-provider | – | Findes allerede (`lib/env.ts:44`) |
| `ANTHROPIC_MODEL` | nej | `claude-sonnet-4-6` (`ai-client.ts:13`) | Findes; bruges af forside/chat. Gatewayen bruger den som default for opgaver uden egen model |
| `GEMINI_API_KEY` | nej | – | Aktiverer `gemini` |
| `DEEPSEEK_API_KEY` | nej | – | Aktiverer `deepseek` *kun* hvis `LOCALRATING_ALLOW_DEEPSEEK=1` |
| `EXA_API_KEY` | nej | – | Valgfri research/claim-verificering; uden nøgle slås funktionen fra |
| `LOCALRATING_DEFAULT_PROVIDER` | nej | `anthropic` | Provider hvis opgave-modellen ikke angiver en |
| `LOCALRATING_MODEL_TRIAGE`, `_RATING`, `_TRANSLATE`, `_GENERATE`, `_FACTCHECK`, `_PLANNER` | nej | = `ANTHROPIC_MODEL` | Format `provider:model`, fx `anthropic:<model-id>`. Tydelige, små modeller anbefales til triage/oversættelse (omkostning) |
| `LOCALRATING_ALLOW_DEEPSEEK` | nej | `0` | Skal være `1` før `deepseek` kan vælges; kræver desuden `allowedProviders` pr. instans |
| `LOCALRATING_GLOBAL_MONTHLY_BUDGET_MICRO_USD` | anbefalet | `0` (= spærret) | **Globalt** loft på tværs af instanser (den delte nøgle kan ellers forbruges af én by) |
| `LOCALRATING_CONTACT_EMAIL` | ja for feed-hentning | – | Indgår i feed-User-Agent (`10-…` §3) |
| `LOCALRATING_PAUSED` | nej | `0` | `1` pauser al LocalRating-cron/AI-arbejde globalt (rollback-niveau A, `11-…` §3) |
| `LOCALRATING_MAX_UPLOAD_MB` | nej | `20` | Grænse for `parse_file` (Y: 20 MB, `sireRoute.ts:7692`) |
| `LOCALRATING_AI_TIMEOUT_MS_<TASK>` | nej | se §5 | Overstyr timeouts |

**Modelvalg pr. opgave (anbefaling, bekræftes i Fase 1):** `triage` lille/billig · `translate` lille/mellem · `rating` mellem (skal kunne følge JSON-kontrakt) · `generate` bedste · `factcheck` mellem/bedste, **helst anden model end generate** (uafhængighed) · `planner` bedste. Konkrete model-id'er kan ikke fastsættes i Fase 0 (**uverificeret** mod udbydernes aktuelle modelkatalog); default er den allerede anvendte `claude-sonnet-4-6`, indtil ejeren vælger.

**Validering i `lib/env.ts`** (kun tilføjelser i `optionalSchema` `:42-55` og advarsler `:127`): nye navne som `optionalText`; **advarsler, ikke startfejl** (LocalRating skal kunne være slået fra uden at CMS'et påvirkes): "LocalRating er aktiveret men ingen AI-nøgle sat", "DEEPSEEK_API_KEY sat uden LOCALRATING_ALLOW_DEEPSEEK=1 (ignoreres)", "ugyldigt LOCALRATING_MODEL_*-format (opgaven slås fra)", "LOCALRATING_GLOBAL_MONTHLY_BUDGET_MICRO_USD mangler (AI spærret)", "LOCALRATING_CONTACT_EMAIL mangler (feed-hentning slået fra)". Uden nøgle: AI-funktioner slås fra (UI viser "AI ikke konfigureret"), cron springer AI-jobs over.

## 4. `AiUsage`, priser og forbrugsloft

**Hver** AI-kald skriver én `AiUsage`-række (`03-…`): `instansId, period (YYYY-MM UTC), task, provider, model, input/output/cacheRead/cacheWrite-tokens, costMicroUsd, priceVersion, status, errorCode, latencyMs, attempt, runKind/runId, promptVersionId, userId`. Også afvisninger (`blocked_budget`, `blocked_policy`, `circuit_open`).

- **Token-tal** fra udbyderens svar (`usage` / `usageMetadata`); ved streaming fra afsluttende event. Mangler tal ⇒ estimat (tegn/4) med `status=ok` og `errorCode="estimated_usage"`.
- **Pris:** `lib/ai/pricing.ts` — versioneret tabel pr. `provider:model` i USD pr. million tokens (input, output, cacheRead, cacheWrite) + `PRICE_VERSION`. **Tabellens værdier skal verificeres mod udbydernes prissider ved Fase 1** (ikke verificeret i Fase 0). Ukendt model ⇒ *konservativ* pris (dyreste kendte for udbyderen) + `priceVersion="unknown"`. Optionelt override via env-JSON.
- **Loft (fail-closed):** før kald: `spent(instans, period) + worstCase(call) ≤ monthlyBudgetMicroUsd` hvor `worstCase = inputEst·pIn + maxTokens·pOut`. `monthlyBudgetMicroUsd = 0` ⇒ AI spærret. Globalt loft på tværs af instanser fra `LOCALRATING_GLOBAL_MONTHLY_BUDGET_MICRO_USD`. Advarsel ved 80 % (inbox-banner + audit), hård stop ved 100 %. Tæller beregnes via indekset `AiUsage(instansId, period, provider)`; én proces (`numReplicas: 1`) har desuden en in-memory reservation for samtidige kald (ved >1 replika kan loftet overskrides med højst den samtidige worst-case – accepteret, dokumenteret).
- **Per-opgave- og per-bruger-grænser:** `rateLimit` (`lib/ratelimit/index.ts:166`) pr. bruger (fx 20 AI-kald/10 min) og pr. cron-tick (fx 20 ratings/tick).
- **UI:** `/redaktion/produktion/forbrug` (Fase 5): forbrug pr. dag/opgave/udbyder/instans, loft, top-kandidater efter pris.

## 5. Fejlhåndtering, timeout, circuit breaker og fallback

| Emne | Regel |
|---|---|
| Kast aldrig | `complete()` returnerer `{ ok:false, reason }` for `no_key | budget | policy | circuit_open | timeout | invalid_output | api_error` (som `callJson`, `ai-client.ts:116`) |
| Timeout (pr. opgave) | triage 15 s · rating 25 s · translate 20 s (Y: `AI_CHUNK_TIMEOUT_MS=20000`, `sireRoute.ts:1706`) · generate 120 s (stream) · factcheck 60 s · planner 60 s; konfigurerbare |
| Retry | ét genforsøg ved timeout/5xx/429/408/netværk/ugyldigt svar, backoff `attempt·400 ms` (som `ai-client.ts:147`); ingen retry ved 4xx (auth/ugyldig forespørgsel) |
| Circuit breaker | `getBreaker(name)` (`resilience.ts:162`): 3 fejl i træk ⇒ åben 30 s; `isBreakerFailure` (`:173`) tæller ikke 4xx (undtagen 408/429). **Navn:** `anthropic` for anthropic-adapteren (samme upstream som forside/chat – delt tilstand) og `ai:gemini`, `ai:deepseek` for de øvrige (plan: `ai:<provider>`; afvigelse for anthropic er bevidst og kan ændres til `ai:anthropic` hvis ejeren foretrækker adskilt tilstand). Én udbyders fejl åbner **kun** dens breaker |
| **Ingen stille cross-provider-fallback** | Y falder tilbage DeepSeek→Gemini uden at nogen ved det (`sireRoute.ts:127-131`). Gatewayen gør det **ikke** som standard: data må ikke forlade den godkendte udbyder i det skjulte. Fallback sker kun hvis `fallbackChain` er sat pr. opgave i konfigurationen, kun mellem `allowedProviders`, og logges i `AiUsage` (`attempt`, `provider`). Standard: ingen kæde ⇒ jobbet genforsøges senere (`04-…` §3.5) |
| Ugyldigt svar | `json-repair` + zod; ét reparationsforsøg; derefter `invalid_output` (ingen gætning, ingen tom score) |
| Sikkerhed i fejl | Fejlbeskeder renses: aldrig headers, nøgler, hele svartekst; `errorCode` er en kort kode |

## 6. GDPR og DeepSeek

- **Principper:** dataminimering (send kun hvad rights + opgaven kræver), formålsbegrænsning, ingen persondata til udbyder uden databehandleraftale og overførselsgrundlag. Ejeren skal **verificere/indgå databehandleraftaler** (Anthropic, evt. Google) og dokumentere overførselsgrundlag; dette dokument er ikke juridisk rådgivning.
- **DeepSeek** (Y's primære model) behandler data hos en udbyder uden for EU/EØS (**udbyderens placering/vilkår skal verificeres af ejeren før brug** – ikke verificeret her). Derfor:
  1. **Spærret som standard**: kræver `LOCALRATING_ALLOW_DEEPSEEK=1` **og** `allowedProviders ∋ "deepseek"` pr. instans **og** ejerens skriftlige godkendelse (README-spørgsmål).
  2. Må **kun** bruges til *ikke-personhenførbart* feedtekst – kaldere sætter eksplicit `piiPolicy: "no_pii"`; gatewayen afviser `deepseek` for alt andet (`blocked_policy`).
  3. **Aldrig** til: borgertips (`Submission`, `MeddelerSag`, Knowledge `CitizenTip`), brugernavne/kontaktdata, politi-/112-/retslistekilder, kladder med personoplysninger, faktatjek af kladder, Knowledge-kontekst.
  4. `piiPolicy` er pr. opgave og pr. kilde: LocalRating sætter `no_pii` kun for `translate`/`triage` på kildetyperne `kommune_pressemeddelelse`, `vejr`, `trafik` (offentlige organisationers meldinger); alt andet er `allow` (= kan indeholde personoplysninger ⇒ kun godkendte udbydere). **Kilderegistre (3. oktober 2026):** `SourceDefinition.personDataClass` er `possible`/`likely` for retslister, CVR-personer, Statstidende, BBR, nævns-/tilsynsafgørelser, sociale signaler og tips ⇒ alle gateway-kald for disse kilder sætter `piiPolicy="no_pii"` *og* sender kun det der er tilladt efter maskering (`likely`: kun overskrift uden personnavne); DeepSeek bruges aldrig til dem; `triage` af discovery-sider (AI-klassifikation af kilder) bruger kun titel/URL-metadata og `no_pii` (`10-…` §11b, §11d, D31).
- **Default-udbyder: Anthropic** (plan, godkendes af ejeren).
- **Logning:** hverken prompts, svar eller kildetekst gemmes i `AiUsage`; kun metadata. `RatingRun.features`/`GenerationRun.result` indeholder AI-output (nødvendigt for audit) men ikke persondata ud over hvad kilden indeholdt; opbevaring styres af `itemRetentionDays` og housekeeping.
- **Tips:** `tipSupport` i rating er *kun tællinger* (`05-…`); tipindhold sendes aldrig til AI i v1.

## 7. Y's lækkede nøgler (kun omtale – ingen værdier)

Y's kildekode indeholder **hardcodede fallback-værdier** for Reuters Connect (klient-id og -secret: `SN-DeepDive/functions/src/index.ts:56-65`, `y-test-lab/sireRoute.ts:5279-5280`) og for Exa (`sireRoute.ts:5489`, `:8748`). Værdierne ligger i git-historikken. **Ejeren skal rotere dem hos udbyderne** (Reuters Connect, Exa) og tilbagekalde de gamle — uafhængigt af LocalRating. De må **aldrig** kopieres til CMS'et, dokumentationen eller `.env.example`. **Y-repoet (`SN-DeepDive`) fortsætter uændret og røres aldrig af dette arbejde** (ingen oprydning, ingen historik-rensning, ingen ændring af filer eller deploy); hvad ejeren selv vælger at gøre i Y (rotation hos udbyderne, evt. scanning) er uden for LocalRatings scope.

## 8. Ændringer i `scripts/check-secrets.ts`, `.env.example` og drift-dokumenter (kun tilføjelser; Fase 1)

| Fil | Ændring |
|---|---|
| `scripts/check-secrets.ts:27` (`SECRET_NAMES`) | Tilføj `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `EXA_API_KEY` (så `NAVN=bogstavelig` i filer fanges af `env-secret-assignment`) |
| `scripts/check-secrets.ts` (`RULES`) | Nye regler: `google-api-key` (`\bAIza[0-9A-Za-z_-]{35}\b`), `openai-style-key` (`\bsk-[A-Za-z0-9]{32,}\b`, dækker DeepSeek m.fl.), **`env-fallback-literal`**: `process\.env\.[A-Z0-9_]*(KEY|SECRET|TOKEN)[A-Z0-9_]*\s*\|\|\s*['"][^'"\s]{12,}['"]` (præcis Y's mønster) – med `allow` for tydelige pladsholdere som i dag (`PLACEHOLDER`) |
| `tests/check-secrets.test.ts` | Fixtures for de tre nye regler (positiv/negativ), inkl. at Y's mønster fanges |
| `.env.example` | Nye variabelnavne med tomme værdier og forklaring (aldrig værdier) |
| `docs/ops/RAILWAY-SETUP.md` §2 | Tabelrækker for de nye variabler; §4-mønster til `cron-localrating`; ny §12 "LocalRating" (eller henvis til `docs/ops/LOCALRATING.md`, Fase 5) |
| `lib/env.ts` | Advarsler (§3) |
| Test | `tests/localrating-no-public-keys.test.ts`: ingen `NEXT_PUBLIC_*`-variabel indeholder `KEY|SECRET|TOKEN` for AI-udbydere; ingen nøgler i klientbundles |

## 9. Test (ingen netværk i `npm test`)
- `lib/ai/fakes.ts`: `FakeAiGateway`/`FakeProvider` (deterministisk, scriptbar pr. `task`/prompt-slug; kan simulere timeout, 429, ugyldig JSON, tom tekst, token-usage).
- Adapter-kontrakttests med `fetchImpl`-mock for gemini/deepseek og SDK-mock for anthropic (samme mønster som `tests/frontpage-ai-fallback.test.ts`).
- Gateway-tests: budget (loft, 0 = spærret, 80 %-advarsel, globalt loft), breaker pr. provider (anthropic-fejl åbner ikke gemini), `piiPolicy` (deepseek afvist uden `no_pii`), ingen stille fallback, `AiUsage` skrives ved *alle* udfald, nøgler lækker ikke i fejltekst/log, `retrieved[]` ender aldrig i `system`.

## 10. Rest-risici og åbne spørgsmål
1. Konkrete model-id'er og priser pr. opgave (Fase 1-verifikation).
2. Skal ejeren tillade Gemini som alternativ (EU-region/databehandleraftale)? Default: kun Anthropic.
3. DeepSeek: skal det overhovedet kunne aktiveres i v1? (Anbefaling: ja teknisk, men *slået fra* og kun efter juridisk gennemgang.)
4. Globalt vs. pr.-instans-loft: hvem fordeler budget mellem byer?
5. Skal forside/chat flyttes til gatewayen (ensartet måling) – eget beslutningspunkt efter Fase 5.
