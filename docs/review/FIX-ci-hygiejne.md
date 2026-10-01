# FIX: CI, testisolation og sikker kodehygiejne (branch `review-fixes`, ikke committet)

Spor A3. Ingen commits, ingen `git add`, ingen hooks installeret, `git config` urørt. Detaljeret drift: `docs/ops/CI.md`. Lint-gæld: `docs/ops/LINT-BACKLOG.md`.

## 0. Kort status

| Punkt | Resultat |
|---|---|
| Testisolation | `npm test` bruger én throwaway-SQLite pr. testfil; `prisma/dev.db` urørt (sha256 identisk før/efter fuld kørsel) |
| Flakes | 3 kørsler i træk + 6 par samtidige kørsler (+ 12 samtidige i alt i en tidligere måling): **0 flakes** |
| GitHub Actions | `ci.yml` (verify, build+smoke, audit, gitleaks, pg-schema-sync), `codeql.yml`, `dependabot.yml`, PR-skabelon. Pinnet til SHA. Kan ikke køres uden push — alle trin er kørt lokalt enkeltvis |
| Smoke | `npm run smoke`: 157 pass / 6 warn / 0 fail mod produktionsbuild (`next build` + `next start`, 6 byer) |
| E2E | Playwright 11/11 grønne mod produktionsbuild; springer over uden Chromium/server |
| Hygiejne | precommit, secret-scan (6 tests), hygiene-rapport, lint-budget, audit-script |
| TypeScript | `strict` var allerede til; 4 ekstra flags aktiveret (0 fejl), resten målt og **ikke** aktiveret |

## 1. Testisolation

**Problem:** alle DB-tests delte `prisma/dev.db`; `node --test` kører hver fil som egen proces, så filerne låste hinanden (og dev-serveren/andre agenter) og testdata røg ind i dev-data. Seed-afhængige tests (`network-sites`, `intake-pipeline`) kan desuden ikke køre mod en tom database.

**Løsning**
- `cms/scripts/test-runner.ts` (`npm test`): bygger én gang en skabelon-database i `os.tmpdir()/cms-tests/template-<hash>.db` (`prisma db push --skip-generate --accept-data-loss` + `prisma/seed.ts` med tilfældig engangsadgangskode). Hash over schema/seed/`lib/slug`/`default-roles`/`permissions` → automatisk genbygning. Bygges i privat fil og flyttes atomisk (samtidige kørsler kan ikke se en halv skabelon).
- `cms/tests/helpers/isolated-db.mjs` (preload via `--import`): hver testproces kopierer skabelonen til `<kørselsmappe>/test-<pid>.db` og sætter `DATABASE_URL`. Kørselsmappen slettes bagefter (også ved SIGINT/SIGTERM); forældede mapper ryddes efter 24 t.
- `npm run test:dev-db` = den gamle adfærd. `npm test -- tests/x.test.ts` kører udvalgte filer.
- `cms/tests/isolated-db.test.ts`: bevis i selve testkørslen — `PRAGMA database_list` skal pege på `test-<pid>.db`, aldrig `dev.db`.

**Evidens** (maskinen var tung belastet af andre agenters builds under målingerne, derfor lange vægtider)

| Måling | Resultat |
|---|---|
| Første kørsel (inkl. skabelon) | 193/193 grønne, 27,7 s (skabelon ~11 s ved rolig maskine; 192 s i ren stue under last) |
| 3 kørsler i træk (319-322 tests) | 318/318, 318/318, 318/318 — 44,3 s / 57,5 s / 49,0 s vægtid (under last). Rolig maskine, 193 tests: 8,6-10,0 s |
| 2 samtidige kørsler × 3 runder | 6/6 par: 319/319, 319/319, 321/321 på begge sider, 0 `✖` |
| 4 samtidige kørsler × 3 runder (færre filer) | 12/12 med 179/179 grønne, ingen "database is locked" |
| Rolig kørsel til sidst | 322/322, `duration_ms` 38 191 |
| `prisma/dev.db` før/efter fuld kørsel | `shasum -a 256 -c` = OK, størrelse 1 011 712 B og mtime uændret |
| Ren stue uden `.env` (kopi af cms/ uden `.env`, nyt tmp) | skabelon bygget fra bunden, 318 tests; 1 fejl = tidsafhængig test (se nedenfor), nu rettet |

Bemærk om `dev.db`-mtime: den ændrede sig én gang (~00:09) mellem to af mine målinger uden at størrelsen ændrede sig. Ingen af mine kørsler peger på `dev.db` (bevist af `isolated-db.test.ts`); skyldige er andre processer (dev-server/anden agents `next build` mod `.env`). Den afsluttende måling i et roligt vindue viste uændret hash.

**Fundne og rettede fejl undervejs**
- `tests/site-news.test.ts` "formatRelativeTime": fejlede hver nat 00:00-03:00 (3 t. siden = "i går"). Rettet med `mock.timers` (fast kl. 12:00).
- `tests/security-validation.test.ts` "rate limiter…" (`getClientIp`) fejlede midlertidigt, mens hardening-sporet omskrev `getClientIp`; er grøn i alle de afsluttende kørsler.
- `tests/intake-pipeline.test.ts`: 4 ubrugte imports erstattet af en rigtig eksistenstest af de fire konverterings-actions.

## 2. GitHub Actions (`.github/`)

- `workflows/ci.yml`: trigger push `main` + PR + manuelt, `paths: cms/**`; `concurrency` (annullér forrige på samme ref); `permissions: contents: read`; npm-cache; Node 22; `NEXT_TELEMETRY_DISABLED=1`. Jobs:
  - **verify**: `npm ci`, `prisma generate`, `npm run secrets`, `tsc --noEmit`, `npm run lint:budget` (ESLint-fejl = rød; advarsler <= `cms/.lint-budget` = **76**, nuværende tal), `npm test` (isolerede DB'er), hygiejne-rapport (informativ).
  - **build**: `prisma db push` til tom SQLite, `next build` med dummy-miljø (se CI.md: `DATABASE_URL`, `AUTH_SECRET` >= 32, `CRON_SECRET` >= 16, `NEXT_PUBLIC_APP_URL`, `DEFAULT_SITE_DOMAIN`), seed, `next start -p 3100` (`PAGE_RATE_LIMIT_PER_MIN=100000`), `npm run smoke`, valgfri Playwright (repo-variabel `CI_E2E=true`), serverlog ved fejl, `.next/cache` caches.
  - **audit**: `continue-on-error` (ikke-blokerende). Rå `npm audit --omit=dev --audit-level=high` + `npm run audit:prod` (allowlist next/postcss/sharp jf. HANDOFF).
  - **gitleaks** (hele historikken, `fetch-depth: 0`; licens kun nødvendig ved organisation).
  - **pg-schema-sync**: kører `npm run prisma:pg:check` hvis `scripts/gen-pg-schema.ts` og scriptet findes (de findes nu — kørt lokalt: "skema og migrationer er i sync"); ellers springes over uden fejl.
- `workflows/codeql.yml`: `javascript-typescript`, `security-extended`, kun `cms/`, push/PR + mandag 04:17 UTC, `security-events: write` kun her.
- `dependabot.yml`: npm `/cms` ugentligt (minor+patch grupperet; major af next/prisma ignoreres bevidst), github-actions ugentligt grupperet.
- `pull_request_template.md` (dansk tjekliste).
- Verifikation: YAML parset med `yaml`-pakken (fangede en kolon-fejl i et trinnavn, rettet); alle SHA'er slået op via `gh api` (checkout v7.0.1, setup-node v7.0.0, cache v6.1.0, gitleaks-action v3.0.0, codeql-action v4.38.2). Selve kørslen på GitHub er **ikke** verificeret (intet push).

## 3. Smoke og e2e

`cms/scripts/smoke.ts` (`npm run smoke -- <baseUrl> [--cities a,b] [--direct] [--delay ms] [--json]`). Node `http` (undici ignorerer en overstyret `Host`-header, derfor ikke `fetch`). Pr. by 25 tjek (forside/titel/canonical/JSON-LD/lækage mod andre byer, artikelside inkl. `og:image`, `/soeg`, `/om-mediet/privatliv`, `/nyhedsbrev`, 404 med links, nyhedsbrev-valideringsfejl, `/redaktion` -> `/login`, `/partner/<falsk>` ikke til login, `/api/articles` kun egen by og uden `instansId`/`oprindeligKontakt`, sikkerhedsheadere, `/api/health`). Pacer sig selv (250 ms) og venter på `Retry-After` ved 429.

Resultat mod produktionsbuild (`NEXT_DIST_DIR=.next-ci`, port 3100, seedet kopi): **157 pass, 6 warn, 0 fail, 7,9 s** (`--delay 100`). Tidligere run mod dev-serveren afslørede de samme to ting som warnings/fund nedenfor. Dev-serveren på :3000 var ikke oppe ved afslutningen (jeg har ikke stoppet den), så sidste smoke er mod prod-buildet.

`cms/e2e` (Playwright 1.63, `playwright.config.ts`, `support.ts`, `smoke.spec.ts`): `npx playwright install chromium` lykkedes (engangs-download). 11/11 grønne mod prod-build (6 byforsider uden `pageerror`, forside -> artikel, nyhedsbrevfejl, 404, `/redaktion` -> login, `/partner/…`). Uden Chromium eller server: `11 skipped` med forklaring (verificeret med `E2E_PORT=3999`).

## 4. Hygiejne

- **(a) precommit:** `npm run precommit` = `lint-staged` (`cms/lint-staged.config.mjs`: ESLint-fejl, `tsc --noEmit`, secret-scan på staged filer). Kørt via `--diff=HEAD --no-stash` mod arbejdstræet: alle tre trin grønne. Ingen hook installeret; opt-in-opskrift i CI.md.
- **(b) `scripts/check-secrets.ts`** (`npm run secrets`): AWS-nøgler, `sk-ant-`, `ghp_`/`github_pat_`, Slack, `lk_` (ingest), private nøgleblokke, `postgres://user:pass@`, `AUTH_SECRET=<værdi>` m.fl. Over `git ls-files --cached --others --exclude-standard`. Værdier udskrives aldrig; `secret-scan:ignore` pr. linje; svage regler springes over i `tests/`. 6 enhedstests (`tests/check-secrets.test.ts`). Nuværende repo: 571 filer, 0 fund. Kører i `precommit` og CI.
- **(c) `npm run hygiene`** (knip 6 som devDependency + eget script, `knip.json`): ubrugte filer 15, ubrugte afhængigheder 2 (`@auth/prisma-adapter`, `pg`), ulistet `server-only` (importeres i `app/redaktion/medier/actions.ts`), ubrugte eksports 121, dublerede slugify 2. **Konsolideret** (uejede lib-filer, dækket af `ingest-api`/`links-and-slugs`-tests): `lib/ingest/signals.ts` og `lib/ingest/articles.ts` bruger nu `lib/slug.ts`. **Kun listet** (ejes af andre): `app/redaktion/indbakke/actions.ts:10 slugify` (50 tegn, "indsendt-forslag"-fallback) og `app/redaktion/omraader/actions.ts:12 toSlug`. Ubrugte filer (kun liste, intet slettet): `components/site/{AiNetworkEntryBlock,AiShortNewsBox,AiToolBar,AreaPicker,CitizenStoriesBox,FirstPartyAd,LatestTicker,NewsletterMiniForm,ShortNewsList,TurnstileField,WeekendCalendar}.tsx`, `components/admin/SubmissionInbox.tsx`, `lib/blocks/renderer.tsx`, `lib/validation/index.ts`, `app/redaktion/ingest/actions.ts`. Listen ændrer sig, mens UI-sporet lander.
- **(d) ESLint:** 83 -> **76 advarsler, 0 fejl** (resten var ryddet af andre spor eller ligger i deres filer). Pr. regel: `no-unused-vars` 66, `react-hooks/set-state-in-effect` 8, `no-img-element` 2. Autofix kun i tests (`intake-pipeline`) og `lib/ingest/*`. Resten kortlagt pr. fil/regel/linje i `docs/ops/LINT-BACKLOG.md`. `eslint.config.mjs`: `.next-*/**` ignoreres (ellers 14 900 falske advarsler fra `NEXT_DIST_DIR`-builds). Ratchet: `npm run lint:budget [-- --update]` + `.lint-budget`.
- **(e) TypeScript:** `strict: true` var allerede aktiv. Målt med `tsc --noEmit` pr. ekstra flag: `noUncheckedIndexedAccess` 204 fejl, `exactOptionalPropertyTypes` 121, `noPropertyAccessFromIndexSignature` 393, `noUnusedLocals` 59, `noUnusedParameters` 6 — **ikke aktiveret**. `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `allowUnreachableCode:false` = 0 fejl -> **aktiveret** i `tsconfig.json`; `tsc` stadig ren. (`noUnusedLocals/Parameters` kan tages sammen med lint-oprydningen: 59+6 fejl svarer næsten til de 66 `no-unused-vars`.)

## 5. Fund til andre ejere (ikke rettet af mig)

1. **Next har nu en ikke-major rettelse: `next@16.3.8`.** `npm audit --omit=dev`: 1 critical (Next, flere RCE-advisories) + 7 high (Next-indlejret postcss/sharp, `@tiptap/core`, `nanoid`, `prisma`/`@prisma/config`/`deepmerge-ts`). HANDOFF.md siger "ingen rettet version" — det er forældet. Allowlisten skjuler det ikke (`RETTELSE FINDES`). Anbefaling: opgradér Next til >= 16.3.8 og tiptap; test; fjern så Next fra allowlisten. (Ejer: platform/hardening.)
2. **Botforsvarets sidegrænse tæller Next.js RSC-prefetch-kald** (`proxy.ts`, 300/min pr. IP). En forside har ~60 links; headless Chrome i e2e fik "Too many requests" efter få sidevisninger, og `curl`/smoke gjorde det samme. Rigtige brugere bag NAT (kontor, mobilnet) kan ramme den. Anbefaling: undtag requests med `RSC`/`Next-Router-Prefetch`-header (eller `?_rsc=`) fra `localPageLimit`. Workaround i CI/e2e: `PAGE_RATE_LIMIT_PER_MIN=100000`. (Ejer: hardening.)
3. **404 på enkeltsegment-stier (`/[sektion]`, fx `/findes-ikke`) klientrenderes**: status 404, men serverens HTML har hverken `h1` eller links (kun RSC-payload og byens normale `<title>`); `/a/b/c` og `/nyheder/xyz` giver rigtig server-HTML. Smoke giver WARN. (Ejer: UI/links.)
4. Nyhedsbrev-ruten har 6 byer × 1 kald i smoke og ramte tidligt sin rate limit (429) — smoke sender derfor pr.-by `x-forwarded-for` og behandler 429 som WARN.
5. `.fp-verify.ts` ligger i `cms/` (ikke min; ser ud som et midlertidigt script fra forside-sporet) — slettes eller flyttes før commit.
6. Dev-serveren på :3000 var nede ved afslutningen.

## 6. Åbne punkter

- CI er ikke kørt på GitHub (intet push). Ved første push: kontroller at `gitleaks`, `CodeQL` og cache-nøgler virker, og aktivér branch protection (CI.md afsnit 6). `paths: cms/**` + required checks: docs-only PR'er udløser ikke CI (beskrevet i CI.md).
- Railway "Wait for CI": beskrevet i CI.md; adfærd ved commits der ikke udløser workflowet er ikke verificeret.
- Smoke/e2e kører mod SQLite; en Postgres-service-container i CI (migrate deploy + smoke) mangler.
- `npm audit`-jobbet er non-blocking til punkt 5.1 er håndteret.
- Lint-oprydning (76 advarsler) og eventuel `noUnusedLocals/Parameters` venter på at UI-sporet lander.
- Belastningstest (k6/autocannon) fra T13 er ikke del af dette spor.
- `nyhedsbrev`-flow i e2e tester kun valideringsfejl, ikke succes (ville skrive til databasen).

## 7. Filer (alle nye hvis ikke andet angivet)

`.github/workflows/{ci,codeql}.yml`, `.github/{dependabot.yml,pull_request_template.md}`, `docs/ops/{CI,LINT-BACKLOG}.md`, `docs/review/FIX-ci-hygiejne.md`;
`cms/scripts/{test-runner,smoke,check-secrets,check-hygiene,check-lint-budget,check-audit}.ts`, `cms/tests/helpers/isolated-db.mjs`, `cms/tests/{isolated-db,check-secrets}.test.ts`, `cms/e2e/{playwright.config.ts,support.ts,smoke.spec.ts,.gitignore}`, `cms/{knip.json,lint-staged.config.mjs,.lint-budget}`;
ændret: `cms/package.json` (nøgler `test`, `test:dev-db`, `test:smoke`, `test:e2e`, `smoke`, `secrets`, `precommit`, `hygiene`, `lint:budget`, `audit:prod`; devDependencies `lint-staged`, `knip`, `@playwright/test`), `cms/package-lock.json`, `cms/tsconfig.json` (4 flags), `cms/eslint.config.mjs` (`.next-*/**`), `cms/.gitignore` (`/.next-*/`), `cms/tests/{site-news,intake-pipeline}.test.ts`, `cms/lib/ingest/{signals,articles}.ts` (fælles `slugify`).
