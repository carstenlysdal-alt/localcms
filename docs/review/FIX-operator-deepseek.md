# FIX: AI-operatøren kan bruge DeepSeek (ud over Anthropic)

Status: bygget og testet. `npx tsc --noEmit`, `npx eslint . --quiet`, `npm test` (628 tests, alle bestået, ingen netværk) og `npm run secrets` er kørt. `npm run build` er ikke kørt. Beslutning og GDPR-vurdering: `docs/localrating/adr/ADR-017.md`.

## 1. Hvad er ændret

| Område | Fil(er) |
|---|---|
| Udbyderabstraktion (neutralt format, `stream/complete`) | `cms/lib/operator/llm/types.ts`, `errors.ts` |
| Anthropic-adapter (uændret adfærd, delt breaker `anthropic`) | `llm/anthropic.ts` (`model.ts` re-eksporterer for bagudkompatibilitet) |
| DeepSeek-adapter (`fetch`, SSE, tool_calls-deltaer, retry, timeouts, breaker `operator:deepseek`) | `llm/deepseek.ts` |
| Valg af udbyder | `llm/select.ts`, `runtime.ts` (`resolveOperatorProvider`, `getOperatorProviderInfo`) |
| Dataminimering | `cms/lib/operator/redact.ts`; `ToolDef.externalLlm` på 8 værktøjer |
| Løkke/ruter/audit | `loop.ts`, `audit.ts`, `events.ts` (`done.provider`), `app/api/operator/route.ts`, `confirm/route.ts` |
| UI | note i panel og på `/redaktion/operator`, udbyder under "Hvad må AI for dig?", `help`-værktøjet nævner udbyderen |
| Konfiguration | `lib/env.ts`, `scripts/check-secrets.ts`, `.env.example`, `docs/ops/RAILWAY-SETUP.md` (afsnit 12) |
| Tests | `tests/operator-deepseek-{client,flow,route}.test.ts`, `operator-provider-select`, `operator-redact`, `helpers/fake-deepseek.ts` |

Systemprompten er den samme versionerede konstant (`operator-v1.0`); data-blokkene og zod-skemaerne er identiske for begge udbydere. Modellen leverer aldrig `instansId`/`userId`.

## 2. Sådan skifter du udbyder (Railway-variabler)

- `OPERATOR_PROVIDER=deepseek|anthropic` (eksplicit). Mangler nøglen til den valgte udbyder, svarer `/api/operator` 503; der falder aldrig stille tilbage til den anden.
- Ikke sat: DeepSeek hvis `DEEPSEEK_API_KEY` er sat, ellers Anthropic hvis `ANTHROPIC_API_KEY` er sat, ellers 503 med besked om begge variabler.
- Valgfrit: `DEEPSEEK_MODEL` (default `deepseek-chat`), `DEEPSEEK_BASE_URL` (default `https://api.deepseek.com`).
- Nøglen sættes fra ejerens egen terminal, så den aldrig står i chat (se `RAILWAY-SETUP.md` afsnit 12):
  ```bash
  read -rs "DEEPSEEK_KEY?DeepSeek-nøgle: "; echo
  printf %s "$DEEPSEEK_KEY" | railway variable set DEEPSEEK_API_KEY --stdin --service lysdalcms --environment production
  unset DEEPSEEK_KEY
  ```
- Opstartsadvarsel (kun produktion): hverken `ANTHROPIC_API_KEY` eller `DEEPSEEK_API_KEY`; ugyldig/uforenelig `OPERATOR_PROVIDER`; begge nøgler uden `OPERATOR_PROVIDER` (så vælges DeepSeek).

## 3. Dataminimering (kun når udbyderen er DeepSeek)

1. **Tekst** (brugerbesked, historik, alle værktøjsresultater): e-mail og telefon (flere formater, også +45) -> stabile pladsholdere `[e-mail-k…]`/`[telefon-k…]`; CPR-lignende numre, danske kontonumre og nøgler (`sk-…`, `lk_…`) fjernes. Maskeringen sker **før** afkortning/pakning.
2. **Felter:** nøgler med e-mail, telefon, kontakt, afsender, adresse, ip, cpr, adgangskode, token, secret fjernes fra al værktøjsdata. Værktøjer kan erklære mere (`externalLlm.dropKeys`/`summaryOnOk`): `list_users` (navn), `create_user` (navn, resumé), `list_inbox` (afsender, navn, uddrag), `create_assignment` (resumé), `list_media` (ophavsperson), `create_source_qa` (resumé), `search_articles`/`get_article` (forfatter). Nye værktøjer fra udvidelser skal selv erklære deres persondata.
3. **Gendannelse kun lokalt:** pladsholdere i modellens værktøjsargumenter gendannes før udførelsen (så `create_user`/`create_source_qa` virker), og i svarteksten til redaktøren. CPR gendannes aldrig.
4. **Kontekst:** brugerens navn sendes ikke ("redaktøren"). Adapteren har en sidste, tilstandsløs maske over alt udgående tekst.
5. **Revisionsspor:** udført handling og tur-post (`ai-operator.turn`) har `provider`, promptversion og kun tal (maskerede e-mails/telefoner, fjernede CPR/nøgler/felter). Aldrig indhold.

Tests beviser (falsk fetch, ingen netværk): navn/e-mail/telefon/CPR fra indsendelser, brugere og redaktørens egne beskeder findes ikke i nogen udgående body; `create_user` med e-mail fra brugeren virker via pladsholder, bekræftelseskortet viser den rigtige adresse, og adressen sendes aldrig.

## 4. Grænser (kendte)

- Navne og andre persondata i **fri tekst** genkendes ikke mekanisk: det redaktøren selv skriver, artikelbrødtekst og titler på indsendelser (`emne`) sendes (e-mail/telefon i dem maskeres). Panelnoten og hjælpen beder om at undgå personoplysninger i beskeder.
- Resuméer fra værktøjer, der ikke har erklæret `externalLlm`, kan indeholde navne (fx sektionsnavne, artikeltitler; det er indhold, ikke persondata om private).
- Anthropic-stien er uændret og maskerer ikke (aftale-baseret behandling).
- `complete()` bruger samme streaming-sti uden delta; operatøren bruger kun `stream`.
- Audit af confirm/undo bruger den udbyder der er aktiv ved klikket (ikke nødvendigvis den, der foreslog handlingen).
- Pris, modelnavne og DeepSeeks vilkår er ikke verificeret her.

## 5. Manuel test med rigtig nøgle (ejeren)

1. Sæt `DEEPSEEK_API_KEY` som i afsnit 2 (eller lokalt i en `.env`, som aldrig committes), genstart/redeploy.
2. Åbn `/redaktion/operator`: noten "Bruger DeepSeek — persondata maskeres før de sendes" skal stå øverst.
3. Skriv "Opret sektionerne Nyheder, Erhverv, Sport, Kultur, Foreningsliv og Debat": 6 sektioner, ét kald, Fortryd-knap.
4. Skriv "Hvad kan du?" (kalder `help`, nævner DeepSeek) og "Vis indbakken": ingen afsendernavne eller kontaktdata i svaret.
5. Skriv "Opret brugeren Test Bruger, e-mail test@eksempel.dk, rolle Støtte": kortet viser den rigtige e-mail; ingen handling før Anvend.
6. Tjek `AuditLog`: `ai-operator.turn` med `provider=deepseek`. Fejl: 401 (nøgle), 402 (saldo), 429 (for mange kald) vises på dansk.

## 6. Risici

- **Tool-calling-kvalitet:** DeepSeek er mere tilbøjelig til ugyldig JSON, forkerte feltnavne og ekstra spørgsmål end Claude. Afbødet: strenge zod-skemaer, ugyldige argumenter afvises uden udførelse og modellen prøver igen, loft på 8 kald, bekræftelseskort og blokerede handlinger er uændrede. Temperatur 0.2.
- Svartid og tilgængelighed (udbyder uden for EU); breaker `operator:deepseek` åbner efter 3 fejl i træk, 4xx (401/402) tæller ikke som nedbrud.
- Navne i fri tekst (se afsnit 4); databehandleraftale/overførselsgrundlag er ejerens ansvar.

## 7. Ejerens handlinger

1. Vurdér DeepSeeks vilkår og indgå evt. aftale; sæt forbrugsloft/saldo-advarsel hos udbyderen.
2. Sæt `DEEPSEEK_API_KEY` (og evt. `OPERATOR_PROVIDER`) i Railway fra egen terminal; deploy.
3. Kør afsnit 5.
4. Husk `npm run roles:sync` hvis det ikke er kørt efter operatørens første deploy (rettigheden `operator.use`).

## 8. Stabile eksporter til den fælles AI-gateway

- `cms/lib/operator/redact.ts`: `PiiVault` (`mask`, `restore`, `restoreDeep`, `restorer`, `stats`), `redactForExternalLlm`, `maskPiiText`, `containsPii`, `isContactKey`, typerne `ExternalLlmSpec`, `RedactionStats`, `RedactableOutcome`.
- `cms/lib/operator/llm/deepseek.ts`: `createDeepseekProvider`, `CompletionAccumulator`, `readSse`, `parseToolArguments`, `toOpenAiMessages`, `toOpenAiTools`, `resolveDeepseekModel`, `resolveDeepseekBaseUrl`; `llm/errors.ts`: `LlmError`, `errorFromStatus`.
