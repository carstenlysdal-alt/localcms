# Agent-indtags-API (aI-library / Knowledge OS -> Lokalt-CMS)

Status: implementeret i `cms/` (branch `review-fixes`, ikke committet). Kode: `cms/lib/ingest/*`, `cms/app/api/ingest/*`, `cms/scripts/create-ingest-key.ts`, tests i `cms/tests/ingest-api.test.ts`.

Princip: agenter **leverer rå signaler og kladder**, aldrig publiceret indhold. Hver nøgle er bundet til **én instans (by)**. Alt agent-leveret er maskinmærket, og en menneskelig redaktør med `ARTICLE_PUBLISH` skal føre en kladde gennem det eksisterende workflow (`lib/workflow.ts`) før noget kan blive offentligt.

## 1. Endpoints

| Metode | Sti | Scope | Formål |
|---|---|---|---|
| GET | `/api/ingest/health` | `health:read` | Verificér nøgle, instans-binding, scopes, grænser |
| POST | `/api/ingest/signals` | `signals:write` | Ét signal eller `{signals:[…]}` (maks 100). Idempotent upsert + dedupe |
| POST | `/api/ingest/articles` | `articles:draft` | Opretter KUN en kladde (status `Idé`, `AI-assisteret`) |

Base-URL = den bys domæne (fx `https://naestvedlokalt.dk`). Nøglen bestemmer instansen; host/`instansId` i body kan ikke ændre det (`instansId` i body giver 403).

## 2. Autentificering og nøgler

```
Authorization: Bearer lk_<43 tegn base64url>
```

- Format `lk_` + 32 bytes CSPRNG. Klartekst vises **kun én gang** ved oprettelse. Databasen (`ApiKey`) gemmer `sha256(hex)` af nøglen + et ikke-hemmeligt `prefix` (11 tegn) til visning/log. Opslag på hash + konstant-tids sammenligning.
- Scopes: `signals:write`, `articles:draft`, `health:read`. Nøgler kan tilbagekaldes (`revokedAt`) og have udløb (`expiresAt`). `lastUsedAt` opdateres.
- Rate limits: 120 kald/min pr. nøgle, 30 mislykkede forsøg/min pr. IP (429 + `Retry-After`). **Proces-lokal i dev**; i produktion skal `setRateLimitStore()` pege på Redis/Postgres (se `lib/ratelimit/index.ts`).

Opret en nøgle (CLI, kører mod den DATABASE_URL der er sat):

```bash
cd cms
npm run ingest:key -- --domain naestvedlokalt.dk --name "aI-library / Graver" \
  --scopes signals:write,articles:draft,health:read --expires-days 365
```

Alternativt server action `createIngestKeyAction(name, scopes, days)` (`app/redaktion/ingest/actions.ts`, kræver rettigheden `ingest.manage`; roller opdateres med `npm run roles:sync`). `revokeIngestKeyAction(id)` tilbagekalder.

## 3. Signal-kontrakt (`POST /api/ingest/signals`)

```json
{
  "externalId": "agenda_mentions:0370:2026-10-01:punkt-4",
  "overskrift": "Byrådet behandler ny lokalplan for havneudvidelse",
  "braedtekst": "Dagsordenspunkt 4 ... (ren tekst; HTML fjernes)",
  "kilde": "Næstved Kommune – Byrådet",
  "kildeUrl": "https://naestved.dk/dagsorden/2026-10-01",
  "sourceType": "kommune_dagsorden",
  "geo": { "omraade": "Karrebæksminde", "postnr": "4736", "by": "Karrebæksminde", "kommune": "Næstved" },
  "publishedAt": "2026-10-01T08:00:00Z",
  "meta": { "category": "Plan og byg", "geographyPrecision": "postcode" }
}
```

| Felt | Krav |
|---|---|
| `externalId` | påkrævet, 1-200 tegn, stabilt pr. kildeobjekt (idempotens-nøgle) |
| `overskrift` | påkrævet, 3-300 |
| `braedtekst` / `brødtekst` | valgfri, <= 20.000, HTML strippes |
| `kilde` | påkrævet (visningsnavn) |
| `kildeUrl` | påkrævet, http(s) |
| `sourceType` | enum: `kommune_dagsorden, politi, beredskab_112, trafik, vejr, forening, klub, lokalt_medie, kommune_pressemeddelelse, andet` |
| `geo` | streng (slug/navn/postnr) eller objekt `{omraade?, postnr?, by?, kommune?}`. Matches mod instansens egne `GeoTag` (slug -> navn -> postnr i slug/navn). Intet match: gemmes som tekst-hint (`omraadeTekst`) |
| `publishedAt` | valgfri ISO-8601 |
| `meta` | valgfri, op til 20 skalarer (gemmes ikke endnu; reserveret) |

Ukendte felter afvises (400, strict) — herunder `breaking`, `notable`, `instansId`. Signaler gemmes altid med `maskinindsamlet = true`, `breaking = false`, `notable = false`; redaktionen ser dem som "Maskinindsamlet · ikke vurderet" på `/redaktion/signaler`.

**Dedupe/idempotens** (pr. instans):
1. `(instansId, externalId)` findes -> uændret indhold = `duplicate` (`duplicateOf: "externalId"`), ændret = `updated` (version + 1).
2. Normaliseret `kildeUrl` findes (lowercase vært, uden `www.`, fragment, `utm_*`/`fbclid` m.fl., afsluttende `/`; http=https) -> `duplicate` (`duplicateOf: "kildeUrl"`), intet overskrives.
3. Ellers `created`.

Svar (enkelt): `201 {"status":"created","id":"…","externalId":"…"}`, `200` for `updated`/`duplicate`.
Svar (batch): `200 {"summary":{"created":2,"updated":0,"duplicate":1,"rejected":0},"results":[…]}`.

```bash
curl -sS -X POST https://naestvedlokalt.dk/api/ingest/signals \
  -H "Authorization: Bearer $CMS_INGEST_API_KEY" -H "Content-Type: application/json" \
  -d '{"externalId":"sig-1","overskrift":"Ny lokalplan i høring","kilde":"Næstved Kommune",
       "kildeUrl":"https://naestved.dk/hoering/42","sourceType":"kommune_dagsorden",
       "geo":{"by":"Næstved"},"publishedAt":"2026-10-01T08:00:00Z"}'
```

## 4. Artikel-kontrakt (`POST /api/ingest/articles`) — kun kladder

```json
{
  "externalId": "graver:run-2026-10-01-017",
  "titel": "Ny lokalplan for havnen sendt i høring",
  "manchet": "Planen omfatter 40 boliger og en ny promenade.",
  "tekst": "Første afsnit.\n\nAndet afsnit.",
  "blocks": [
    { "type": "heading", "text": "Hvad er besluttet?", "level": 2 },
    { "type": "paragraph", "text": "…" },
    { "type": "quote", "quote": "Vi glæder os til at høre borgerne", "attribution": "Borgmesteren",
      "kildeUrl": "https://naestved.dk/pressemeddelelse/42", "dato": "2026-10-01" },
    { "type": "factbox", "title": "Fakta", "content": "Høringsfrist: 29. oktober" }
  ],
  "sektion": "politik",
  "omraader": ["naestved-by"],
  "aiBrug": ["Udkast", "Sproglig korrektur"],
  "sources": [
    { "url": "https://naestved.dk/dagsorden/2026-10-01", "dato": "2026-10-01",
      "titel": "Byrådets dagsorden", "udgiver": "Næstved Kommune", "sourceType": "kommune_dagsorden" }
  ],
  "signalIds": ["agenda_mentions:0370:2026-10-01:punkt-4"],
  "agent": { "name": "aI-library/Redaktion", "version": "2026.10", "runId": "run-017" }
}
```

Garantier (håndhævet i `lib/ingest/articles.ts`, testet):
- **Status tvinges** til workflowets første tilstand (`Idé`, `ARTICLE_STATUSES[0]`), `indholdstype = "AI-assisteret"`, `publiceretTid = null`, `pinned/breaking = false`, ingen forfatter. Feltet `status`, `publiceretTid`, `pinned`, `breaking`, `marking`, `forfatterId`, `instansId` i body giver **422**. `indholdstype` må kun være `AI-assisteret`.
- `aiBrug` påkrævet (min. 1 af `Sproglig korrektur, Omskrivning, Transskribering, Udkast` — samme værdier som redaktørens felt; `Ingen` afvises).
- `sources[]` påkrævet (min. 1): hver med `url` (http/https) og `dato`. `quote`-blokke kræver `kildeUrl` og `dato`.
- **Spærret i Krimi og Sundhed**: `sektion` (eller dens overkategori) = Krimi og retsvæsen/Sundhed -> 403 (`isAiRestrictedCategory`, samme regel som editoren). Kilder med `sourceType` `politi` eller `beredskab_112` -> 403 (lever dem som signal i stedet).
- Tekst er ren tekst: HTML fjernes; `paragraph`-blokke gemmes som escapet `<p>…</p>`.
- `marking = { godkendtAf: "", kilder:[urls], maskinleveret:true }` — `godkendtAf` er tom, så `assertPublishableMarking` blokerer publicering, indtil en redaktør har udfyldt godkender. `provenance` (JSON på artiklen) gemmer nøgle-prefix, agent, kilder med dato og signal-id'er.
- Idempotent på `(instansId, externalId)`: gentagelse giver `200 duplicate` og **overskriver aldrig** redaktørens version.
- Ingen direkte PUBLISH: der findes ingen kodesti fra API'et til `Publiceret`. Veje til publicering: redaktør åbner kladden, gennemgår -> eksisterende `canTransition` (kræver `ARTICLE_PUBLISH` for `Godkendelse`/`Publiceret`).

Svar: `201 {"status":"created","id":"…","externalId":"…","workflowStatus":"Idé","note":"…"}`.

```bash
curl -sS -X POST https://naestvedlokalt.dk/api/ingest/articles \
  -H "Authorization: Bearer $CMS_INGEST_API_KEY" -H "Content-Type: application/json" \
  -d @udkast.json
```

## 5. Health

```bash
curl -sS https://naestvedlokalt.dk/api/ingest/health -H "Authorization: Bearer $CMS_INGEST_API_KEY"
# {"ok":true,"service":"lokalt-cms-ingest","version":1,"instance":{"id":"…","domaene":"naestvedlokalt.dk","navn":"Næstved Lokalt"},
#  "key":{"prefix":"lk_ab12cd34","scopes":["signals:write","articles:draft","health:read"]},"limits":{…},"serverTime":"…"}
```

## 6. Fejlkoder

| Kode | Betydning |
|---|---|
| 400 | JSON/validering fejlede (`issues[]` med sti + besked) |
| 401 | Manglende/ugyldig/tilbagekaldt/udløbet nøgle (`WWW-Authenticate: Bearer`) |
| 403 | Manglende scope, `instansId` i body, eller AI-spærret område/kilde |
| 413 | Body for stor (signaler 2 MB, artikler 1 MB) |
| 422 | Forsøg på at sætte status/publicering m.m., ukendt `sektion` |
| 429 | Rate limit (`Retry-After`) |

## 7. Mapping fra aI-library (`/Volumes/SSD Data/Gits/aI-library/src`, commit 88d89b8; kun læst)

### `LocalMonitoringItem` (`src/services/municipalities.ts`) -> signal

| LocalMonitoringItem | CMS-signal |
|---|---|
| `id` | `externalId` = `"<source>:<id>"` |
| `title` | `overskrift` |
| `summary` | `braedtekst` |
| `url` | `kildeUrl` |
| `sourceName` | `kilde` |
| `publishedAt` | `publishedAt` |
| `source` | `sourceType` (se nedenfor) |
| `geographyLabel` | `geo.omraade` |
| `postalCodes[0]` | `geo.postnr` |
| `municipalityNames[0]` | `geo.kommune` |
| `category`, `deadline`, `geographyPrecision`, `municipalityCodes` | `meta` (skalarer; `municipalityCodes` som kommasepareret streng) |

`LocalMonitoringSource` -> `sourceType`: `agenda_mentions` -> `kommune_dagsorden`; `police` -> `politi`; `regional_news` -> `lokalt_medie`; `weather`, `air_quality` -> `vejr`; `plans`, `hearings`, `cvr`, `parliament`, `ritzau_releases`, `ritzau_announcements` -> `andet`. (`beredskab_112`, `trafik`, `forening`, `klub`, `kommune_pressemeddelelse` har endnu ingen kilde i aI-library — se T8.)

### `SourceItem` (`src/editorial/types.ts`) -> `sources[]` på en artikelkladde

| SourceItem | `sources[]` |
|---|---|
| `sourceIdentifier` (URL) | `url` (kilder uden URL kan ikke leveres som kilde) |
| `date` | `dato` |
| `title` | `titel` |
| `publisher` | `udgiver` |
| `sourceType` (`article/url/pdf/report/...`) | ikke 1:1 — udelad, eller `andet`/`lokalt_medie` efter kildens art |
| `rawContent`, `metadata`, `ingestionStatus` | sendes ikke (kun URL + dato + titel er proveniens) |

Redaktions-agentens output -> `titel`, `manchet`, `tekst`/`blocks`; hvad modellen har gjort -> `aiBrug`; kilder -> `sources`; citater kun med kildeUrl + dato.

## 8. Drifts- og sikkerhedsnoter

- Kør `npx prisma db push` (dev) / migration (prod), derefter `npx prisma generate` og **genstart dev-serveren** (den gamle Prisma-klient kender ikke `ApiKey`).
- Nøgler i aI-library gemmes som secret (`CMS_INGEST_API_KEY`), aldrig i git. Roter ved mistanke: tilbagekald + opret ny.
- Rate limit/dedupe-vinduer er proces-lokale (se `lib/ratelimit`); dedupe af signaler er databasebåret (unikke indekser) og derfor sikker på flere instanser.
- Ikke implementeret (bevidst, til næste skridt): UI til nøgleadministration (`/redaktion/ingest`), webhook/kvittering, `Signal -> kladde`-knap, billeder via API.
