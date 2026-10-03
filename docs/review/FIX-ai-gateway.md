# FIX: Fælles AI-gateway (editor-AI, AI-chat og forside-AI på DeepSeek)

Status: kode og tests færdige (ucommittet). Operatøren (`lib/operator/**`) har sin egen udbydervælger og er ikke berørt.

## Hvad er ændret

Al tekst-AI uden for operatøren går nu gennem én gateway, `cms/lib/ai/provider/`, og kan køre på DeepSeek eller Claude.

| Fil | Indhold |
|---|---|
| `lib/ai/provider/select.ts` | Valg af udbyder pr. opgave (`editor`, `chat`, `frontpage`), fælles fejltekst `NO_AI_MESSAGE`. |
| `lib/ai/provider/deepseek-text.ts` | DeepSeek som `AiTextClient` (samme signatur som den Anthropic-baserede): `fetch` til `${DEEPSEEK_BASE_URL}/chat/completions`, JSON-tilstand, maskering, timeout, genforsøg, breaker `ai:deepseek`, `usage`. |
| `lib/ai/provider/deepseek-stream.ts` | DeepSeek-SSE som ren tekststrøm til chatten (maskering, gendannelse af pladsholdere, breaker, timeouts, afbrydelse). |
| `lib/ai/provider/index.ts` | `createAiTextClient({task})` + re-eksport af valg-funktioner. |
| `lib/frontpage/ai-client.ts` | `AiRequest.json?`, `AiResponse.usage?/provider?`, `AiTextClient.providerId?`; `callJson` sætter `json: true`, returnerer `usage`/`provider` og en dansk `userMessage` ved udbyderfejl. `createAnthropicTextClient` er uændret i adfærd (kun valgfri ekstra felter i svaret). |
| `lib/ai/editorial.ts`, `lib/ai/editorial-service.ts` | Klient via gatewayen (`task: "editor"`). Prompts og promptversion (`editorial-2026-10-02.1`) er uændrede. Audit får `udbyder`, `tokensInd`, `tokensUd` (aldrig indhold). Dansk udbydertekst (fx "mangler saldo") vises ved `api-fejl`. |
| `lib/frontpage/service.ts` | Klient via gatewayen (`task: "frontpage"`), generisk `ai-unavailable`-tekst, `[udbyder: x]` i `logAiAction`-begrundelsen for NL-kommandoer. |
| `app/api/chat/route.ts` | Provider-gren: DeepSeek streamer som ren tekst med samme kontrakt, historik (20 beskeder), rate limit (20/10 min), same-origin, JSON-krav, størrelsesloft, persistens og afbrydelseshåndtering. Anthropic-grenen er uændret. |
| `app/api/cron/frontpage-rank/route.ts`, `app/redaktion/forside/_lib/loaders.ts` | Tjekkede kun `ANTHROPIC_API_KEY`; bruger nu `isAiConfigured("frontpage")`. Uden dette ville cron og "AI konfigureret"-flaget ignorere DeepSeek. |
| `lib/env.ts`, `.env.example` | Nye variabler og advarsler (se nedenfor). |

Afvigelse fra planen: JSON-instruktionen ("Svar kun med gyldig JSON ...") tilføjes af DeepSeek-klienten, når `json: true` er sat, ikke inde i `callJson`. Resultatet er det samme (kun DeepSeek får suffikset), og `callJson` forbliver udbyder-neutral.

## Miljøvariabler

| Variabel | Betydning |
|---|---|
| `DEEPSEEK_API_KEY` | Nøglen (Railway-variabel, findes allerede). |
| `DEEPSEEK_MODEL` | Valgfri, standard `deepseek-chat`. |
| `DEEPSEEK_BASE_URL` | Valgfri, standard `https://api.deepseek.com` (bør være https). |
| `AI_PROVIDER` | NY. `deepseek` eller `anthropic`: fælles valg for editor-AI, chat og forside-AI. |
| `EDITOR_AI_PROVIDER` | NY. Override for editorens 13 AI-opgaver. |
| `CHAT_AI_PROVIDER` | NY. Override for AI-docken/chatten. |
| `FRONTPAGE_AI_PROVIDER` | NY. Override for forsidens ranker, cron og NL-kommandoer. |
| `OPERATOR_PROVIDER` | Uændret (kun operatøren). |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Uændret (Anthropic-stien). |

Regel (pr. opgave): `<OPGAVE>_AI_PROVIDER`, ellers `AI_PROVIDER`, ellers DeepSeek hvis `DEEPSEEK_API_KEY`, ellers Anthropic hvis `ANTHROPIC_API_KEY`, ellers AI slået fra. Et eksplicit valg falder ALDRIG stille tilbage til den anden udbyder: mangler nøglen, er AI slået fra for den opgave med en tydelig tekst (og en opstartsadvarsel i `lib/env.ts`).

### Sådan skifter du udbyder pr. opgave

- Alt på DeepSeek (nu): sæt kun `DEEPSEEK_API_KEY` (ingen yderligere variabler nødvendige).
- Chat tilbage på Claude: `CHAT_AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`.
- Kun editor på Claude: `EDITOR_AI_PROVIDER=anthropic`.
- Alt på Claude: `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`.
- Ændring af Railway-variabler giver en ny deploy; ingen kodeændring.

## Persondata

DeepSeek behandler data uden for EU, så ALT udgående indhold maskeres med operatørens `PiiVault` (`lib/operator/redact.ts`) før hvert kald: system, brugerbesked, chat-historik og artikelkontekst.

- E-mail og telefon bliver til stabile pladsholdere (`[e-mail-k3fa2c1b]`), som gendannes lokalt i svaret (også i streamen, selv når en pladsholder deles over to bidder).
- CPR, IBAN/kontonumre og nøgler (`sk-…`/`lk_…`) fjernes helt (kan ikke gendannes).
- Chatten sender ikke redaktørens navn til DeepSeek ("for journalisten").
- Forside-ranker og NL-kommandoer sender kun titler/metadata, som også passerer masken.
- Tests asserter på de opfangede request-bodies: ingen e-mail, telefon, CPR, IBAN eller nøgle (`tests/ai-gateway-*.test.ts`).

Anthropic-stien er uændret og maskerer ikke (som før).

## Governance (uændret)

- Krimi/112/Sundhed-spærring for tekstgenererende opgaver, `article.ai.use`, tenant- og redigeringskontrol, rate limit pr. bruger (40/10 min editor, 20/10 min chat) kører FØR gatewayen; ved spærring sendes intet til DeepSeek (testet).
- AI foreslår, redaktøren godkender: intet gemmes/publiceres af gatewayen. Zod-validering, `extractJson`-fallback og ét genforsøg er bevaret.
- Audit uden indhold: `article.ai.suggest` har opgave, promptversion, udfald, udbyder og tokental.
- Prompt-injektion: indhold ligger kun i den escapede `<data>`-blok; systemprompten er uændret; adlyder modellen alligevel og svarer uden JSON, afvises svaret (testet).

## Fejl og grænser

- Fejltekster (dansk): 401/403 nøglen afvist, 402 mangler saldo, 429 for mange forespørgsler, 5xx fejl/overbelastet, timeout, netværk. Svarindhold og nøgler gengives aldrig.
- Genforsøg: ét ved 429/5xx i transporten (`retry-after` højst 2 s); `callJson` lægger ikke et ekstra lag ovenpå. Ugyldig JSON/skema genforsøges ét gang af `callJson` som før.
- Timeouts: editor 30 s (kalder), forside 20 s (standard), transport maks. 60 s; chat: 30 s til svarhoved, 30 s uden data, 90 s i alt.
- Breaker `ai:deepseek` (3 fejl i træk giver 30 s pause). 401/402/4xx tæller ikke som nedbrud; 429/5xx/timeout gør. Åben breaker: editor "midlertidigt utilgængelig", chat 503 med `Retry-After: 30`, forsiden falder tilbage til almindelig rangering.
- max_tokens holdes mellem 256 og 8192. Temperatur 0,2.
- Chat-fejl FØR strømmen starter besvares som JSON (`{error}`) med status 429/502/503/504. NB: chat-klienten (`chat-interface.tsx`) tjekker ikke `res.ok` og viser derfor JSON-teksten som beskedtekst (samme adfærd som før for Anthropic-fejl). Se anbefalinger.
- Navne i fri tekst kan ikke genkendes mekanisk og maskeres ikke (dokumenteret grænse, som i operatøren). Otte sammenhængende cifre kan fejlagtigt maskeres som telefonnummer.
- Chat uden `usage` (kun tekstklienten returnerer tokens).

## Tests

Nye filer: `tests/ai-gateway-provider.test.ts` (udbydermatrix, JSON-tilstand, ugyldig JSON + retry, 401/402/429/5xx, timeout, breaker, prompt-injektion, persondata for editor/ranker/NL), `ai-gateway-stream.test.ts` (SSE, maskering/gendannelse, fejl, retry, breaker, afbrydelse, idle-timeout), `ai-gateway-chat.test.ts` (rute: stream, persistens, historik, fejl, afbrydelse, rate limit, same-origin), `ai-gateway-editor.test.ts` (editor-AI e2e, audit, spærring), `ai-gateway-frontpage.test.ts` (forslag, NL-kommando, cron), `ai-gateway-env.test.ts`, hjælper `tests/helpers/fake-ai-fetch.ts`.

Kontrol: `npx tsc --noEmit` ren, `npx eslint . --quiet` ren, `npm test` 608/608, `npm run secrets` ingen fund.

## Manuel test med den rigtige nøgle (efter deploy)

Forudsætning: `DEEPSEEK_API_KEY` er sat i Railway og ingen `*_AI_PROVIDER`-variabler peger andetsteds.

1. Editor: åbn en artikel med mindst en kort brødtekst. Tryk "Foreslå" ved overskrift, SEO, opslagstekst (SoMe) og tags/geo. Forvent forslag inden for ca. 5-30 s; gem/publicér sker ikke af sig selv. Tjek at forslag overholder længdegrænserne (ellers vises "AI's forslag overholdt ikke længde- og formatkravene" og et nyt forsøg hjælper). Prøv en artikel i Krimi/Sundhed: tekstforslag skal stadig være spærret.
2. AI-dock/chat: skriv et spørgsmål; svaret skal streame løbende. Skriv en besked med en e-mailadresse og bed om at gentage den: den skal vises korrekt hos dig (gendannes lokalt). Åbn samtalen igen og tjek at historikken er der.
3. Forside: "Foreslå forside" (skal give et AI-forslag med modelnavn `deepseek-chat`; ved DeepSeek-udfald et almindeligt forslag) og en NL-kommando som "gør griddet større".
4. Audit: i AuditLog skal `article.ai.suggest` have `udbyder: deepseek` og tokental, uden artikeltekst.
5. Fejlsti: sæt midlertidigt `DEEPSEEK_API_KEY` til en forkert værdi i en staging-service og bekræft den danske fejltekst (kontakt administratoren) uden at nøglen vises.

## Risici

- DeepSeek er svagere end Claude til streng JSON, længdekrav og dansk journalistisk sprog. Zod-validering og ét genforsøg opfanger det meste, men forvent flere "overholdt ikke kravene"-fejl; kvaliteten af danske formuleringer skal vurderes af redaktionen.
- GDPR: data behandles uden for EU. Mitigering er maskering, kun globale nøgler, ingen artikelindhold i audit, og ejerens eksplicitte valg; den juridiske afklaring (databehandleraftale, overførselsgrundlag) er ejerens. ADR-017 (operatøren) bør udvides til at dække hele gatewayen.
- Fri tekst kan indeholde navne på private personer, som ikke maskeres. Kildebeskyttelse: indsæt ikke kildeidentificerende oplysninger i AI-felter.
- Delt breaker `ai:deepseek`: et udfald slår editor-AI, chat og forside-AI fra samtidigt (resten af CMS'et påvirkes ikke).
- Modelnavne og priser hos DeepSeek er ikke verificeret; `DEEPSEEK_MODEL` kan ændres uden kodeændring.

## Ejerhandlinger

1. Bekræft at `DEEPSEEK_API_KEY` er sat i Railway (nøglen må ikke ligge i chat/git) og vær klar over, at alle AI-funktioner nu sender (maskeret) indhold til DeepSeek.
2. Sæt et forbrugsloft/saldoalarm hos DeepSeek (402 betyder tom saldo, og AI stopper for alle).
3. Afklar GDPR/databehandleraftale for DeepSeek, før redaktionen bruger AI på rigtigt indhold.
4. Beslut om `AI_PROVIDER` skal sættes eksplicit (anbefalet, når begge nøgler kan komme til at eksistere), så valget ikke afhænger af hvilke nøgler der findes.
5. Test efter deploy som beskrevet ovenfor og meld afvigelser.

## Anbefalinger til filer uden for min ejerskabsliste

- `lib/operator/runtime.ts` (linje ~45): `frontpageClient: createAnthropicTextClient()` bør være `createAiTextClient({ task: "frontpage" })` fra `@/lib/ai/provider`, så operatørens forsidekommandoer også følger gatewayen (ellers kræver de `ANTHROPIC_API_KEY`). Beskeden i `lib/operator/types.ts` ("ANTHROPIC_API_KEY") kan opdateres tilsvarende.
- `docs/ops/RAILWAY-SETUP.md` (afsnit 12, linje ~172): "editorens AI, forsidens AI-forslag og chatten bruger fortsat ANTHROPIC_API_KEY" er ikke længere korrekt; tilføj `AI_PROVIDER`, `EDITOR_AI_PROVIDER`, `CHAT_AI_PROVIDER`, `FRONTPAGE_AI_PROVIDER`, og at `ANTHROPIC_API_KEY`-rækken (linje ~45) også kan erstattes af `DEEPSEEK_API_KEY`.
- `app/redaktion/chat/chat-interface.tsx`: tjek `res.ok` og vis `error` fra JSON pænt (gælder begge udbydere).
- `docs/localrating/09-ai-gateway-og-noegler.md` og ADR-007/ADR-017: peg på denne gateway.
- `lib/operator/llm/select.ts` importerer `resolveModel` fra `lib/frontpage/ai-client.ts`; gatewayen importerer `LlmError`/`errorFromStatus` (`llm/errors.ts`) og `PiiVault` (`redact.ts`) fra operatøren. Omdøb ikke disse eksporter uden at opdatere `lib/ai/provider/*`.
