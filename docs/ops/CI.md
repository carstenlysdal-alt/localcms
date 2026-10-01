# CI, tests og kodehygiejne

Gælder CMS'et i `cms/`. Alt nedenfor er verificeret lokalt (se `docs/review/FIX-ci-hygiejne.md` for beviser).

## 1. Hvad kører hvor

| Hvad | Hvor | Udløser | Blokerer? |
|---|---|---|---|
| Typecheck, lint-budget, tests, hemmelighedsscan | GitHub Actions `CI / verify` | push til `main`, alle PR'er der rører `cms/**` | Ja |
| `next build` + smoke mod `next start` (alle 6 byer) | `CI / build` | som ovenfor | Ja |
| Playwright e2e (valgfri) | `CI / build` (kun hvis repo-variablen `CI_E2E=true`) | som ovenfor | Ja når slået til |
| `npm audit --omit=dev --audit-level=high` + allowlist | `CI / audit` | som ovenfor | Nej (`continue-on-error`) til vi har ryddet op |
| Gitleaks over hele git-historikken | `CI / gitleaks` | som ovenfor | Ja |
| Postgres-skema i sync (`npm run prisma:pg:check`) | `CI / pg-schema-sync` | som ovenfor; springer over hvis `scripts/gen-pg-schema.ts` mangler | Ja når den kører |
| CodeQL (javascript-typescript, `security-extended`) | `CodeQL / analyze` | push til `main`, PR'er, mandag 04:17 UTC | Ja (som required check, se afsnit 6) |
| Dependabot | `.github/dependabot.yml` | mandag: npm (`/cms`, minor+patch grupperet) og github-actions | PR'er |
| Pre-commit (lint-staged + hemmelighedsscan) | Lokalt, **opt-in** | `npm run precommit` | Kun lokalt |

Workflows ligger i `.github/workflows/`. Alle actions er pinnet til commit-SHA (versionen står som kommentar); Dependabot opdaterer dem. `permissions:` er `contents: read` som standard; kun CodeQL får `security-events: write`. Samtidige kørsler på samme gren annulleres (`concurrency`).

## 2. Lokale kommandoer (kør i `cms/`)

```bash
npm test                      # isolerede tests (se afsnit 3) — ~9 s efter første kørsel
npm test -- tests/site.test.ts tests/taxonomy.test.ts   # udvalgte filer
npm run test:dev-db           # gammel adfærd: deler prisma/dev.db (kun til fejlsøgning)
npx tsc --noEmit              # typecheck
npm run lint:budget           # ESLint: fejl = rød, advarsler skal være <= .lint-budget
npm run lint:budget -- --update   # sænk budgettet når advarsler er ryddet (commit .lint-budget)
npm run secrets               # regex-scan over sporede + usporede (ikke-ignorerede) filer
npm run hygiene               # rapport: ubrugte filer/eksports/afhængigheder, dublerede slugify
npm run audit:prod            # npm audit med allowlist
npm run smoke -- http://127.0.0.1:3000          # fetch-baseret smoke, alle byer
npm run smoke -- https://naestvedlokalt.dk --direct   # ét rigtigt domæne
E2E_PORT=3000 npm run test:e2e                  # Playwright (valgfri)
npm run precommit             # lint-staged (kun staged filer) — se afsnit 5
```

### Smoke (`scripts/smoke.ts`)
Plain `fetch`/`http`, ingen browser. Pr. by sendes `Host: <by>.localhost:<port>` til base-URL'en (Node resolver ikke `*.localhost`). Pr. by tjekkes: forside 200 med byens titel, ingen anden bys navn i title/canonical/og/description/JSON-LD og ingen andre byers artikler i forsidens links; en artikelside (JSON-LD parser, canonical, `og:image` giver 200 `image/*`); `/soeg`, `/om-mediet/privatliv`, `/nyhedsbrev` 200; ukendt sti = 404 med links; nyhedsbrev med ugyldig mail = 400 (ingen data gemmes); `/redaktion` omdirigerer til `/login`; `/partner/<falsk token>` sendes ikke til login; `/api/articles` kun egen by (og uden `instansId`/`oprindeligKontakt`); sikkerhedsheadere (CSP report-only accepteres); `/api/health` 200. `WARN` fejler ikke; `FAIL` giver exit 1. Smoke pacer sig selv (250 ms mellem kald, `--delay`) og venter på `Retry-After` ved 429, fordi botforsvaret i `proxy.ts` har en sidegrænse pr. IP.

### Playwright e2e (`cms/e2e`, valgfri)
`npx playwright install chromium` (engangs-download, ~150 MB), derefter `E2E_PORT=<port> npm run test:e2e`. Mangler Chromium eller svarer serveren ikke på `/api/health`, **springes alle tests over** med en forklaring (ikke fejl). Start serveren med `PAGE_RATE_LIMIT_PER_MIN=100000`, ellers kan browserens mange RSC-prefetch-kald ramme sidegrænsen (429 "Too many requests").

## 3. Testisolation (hvorfor `npm test` ikke rører `prisma/dev.db`)

`scripts/test-runner.ts` bygger én gang en **skabelon-database** i `os.tmpdir()/cms-tests/template-<hash>.db` (`prisma db push` + `prisma/seed.ts` med en tilfældig engangsadgangskode). Hashen dækker schema, seed og de filer seed importerer, så skabelonen genbygges automatisk når de ændres (`CMS_TEST_REBUILD=1` tvinger). Derefter starter runneren `node --test` med `tests/helpers/isolated-db.mjs` som preload: **hver testfil (egen proces) får sin egen kopi** `test-<pid>.db` og `DATABASE_URL` peger dér. Kørslens mappe slettes bagefter, også ved Ctrl-C. Konsekvenser:

- Ingen "database is locked"/Prisma-låsfejl, hverken mellem testfiler i samme kørsel eller mellem samtidige kørsler (flere agenter/terminaler/CI).
- Tests der skriver (tracking, ingest, forside) forurener hverken dev-data eller hinanden.
- Tests der forudsætter seed-data (`network-sites`, `intake-pipeline`) virker, fordi skabelonen er seedet.
- Første kørsel (eller efter schema/seed-ændring) tager ~11 s ekstra til skabelonen.
- `CMS_TEST_TMPDIR` flytter tmp-mappen.

## 4. Sådan læser du en rød CI

1. Åbn fanen **Actions** → kørslen → det røde job. Trinnene har sigende navne:
   - *Hemmelighedsscan*: viser `fil:linje [regel]`, aldrig værdien. Fjern hemmeligheden og **roter den**, hvis den har været pushet. Bevidst eksempel: `secret-scan:ignore` på linjen.
   - *TypeScript*: almindelige `tsc`-fejl. Kør `npx tsc --noEmit` lokalt.
   - *ESLint*: enten fejl (ret dem) eller "For mange advarsler: N > budget M" (du har tilføjet advarsler; ret dem). Budgettet står i `cms/.lint-budget`.
   - *Tests*: node:test-output; kør samme fil lokalt: `npm test -- tests/<fil>.test.ts`.
   - *next build*: manglende dummy-variabel (se tabel) eller en typefejl der kun rammer produktionsbuild.
   - *Smoke*: hver linje er `FAIL <tjek> -> detalje`. Kør lokalt: start `npm run dev` og `npm run smoke -- http://127.0.0.1:3000`. Serverloggen printes nederst i jobbet.
   - *Gitleaks*: fund i historikken; se rapporten i jobbets log.
   - *CodeQL*: fund vises under **Security → Code scanning**.
2. Flaky? Tests bruger throwaway-databaser og er målt flakefri (se rapporten); genkør jobbet én gang og meld det, hvis den samme test fejler igen.

### Dummy-miljø til `next build`/`next start` i CI
Ingen rigtige hemmeligheder. Værdierne er bevidst kun dummy og findes kun i workflowet.

| Variabel | Dummy | Hvorfor |
|---|---|---|
| `DATABASE_URL` | `file:/tmp/ci-build.db` | Prisma-skema er SQLite; filen oprettes med `prisma db push` og seedes til smoke |
| `AUTH_SECRET` | >= 32 tegn | kræves af `lib/env.ts` i produktion |
| `CRON_SECRET` | >= 16 tegn | kræves af `lib/env.ts` i produktion |
| `NEXT_PUBLIC_APP_URL` | `http://127.0.0.1:3100` | kræves (http/https-URL) |
| `DEFAULT_SITE_DOMAIN` | `slagelselokalt.dk` | standardby for bar host/health |
| `PAGE_RATE_LIMIT_PER_MIN` | `100000` | kun for `next start` i smoke/e2e (én IP) |
| `NEXT_TELEMETRY_DISABLED` | `1` | ingen telemetri |

Advarsler fra `lib/env.ts` om SQLite, manglende `REDIS_URL` osv. er forventede i CI.

## 5. Pre-commit (opt-in — intet er installeret)

`npm run precommit` kører `lint-staged` (konfig: `cms/lint-staged.config.mjs`) på **staged** filer: ESLint (kun fejl blokerer), `tsc --noEmit`, og `scripts/check-secrets.ts` på alle staged filer. Der er **ikke** installeret nogen git-hook, og `git config` er uændret. Vil du bruge det som hook, så opret selv:

```bash
cat > .git/hooks/pre-commit <<'EOF'
#!/bin/sh
cd cms && npm run precommit
EOF
chmod +x .git/hooks/pre-commit
```

(Alternativt `git config core.hooksPath .githooks` med samme script i en sporet mappe — beslutning for ejeren.) Spring en hook over i nødstilfælde med `git commit --no-verify`; CI fanger det alligevel.

## 6. GitHub: secrets, variabler og branch protection

**Secrets:** ingen er påkrævet. `GITHUB_TOKEN` stilles til rådighed automatisk. Valgfrit: `GITLEAKS_LICENSE` — kun hvis repoet flyttes til en GitHub-*organisation* (gratis nøgle fra gitleaks.io); på en personlig konto er den ikke nødvendig.
**Variabler (valgfrit):** `CI_E2E=true` slår Playwright-e2e til i `build`-jobbet.

**Anbefalet branch protection for `main`** (Settings → Branches → Add rule):
- Require a pull request before merging (mindst 1 godkendelse når I er flere).
- Require status checks to pass: `Typecheck, lint, tests`, `next build + smoke`, `Gitleaks (hemmeligheder i historik)`, `Analyze (javascript-typescript)` (CodeQL). `Postgres-skema i sync` når `gen-pg-schema` er i `main`.
- Require branches to be up to date before merging.
- Block force pushes og sletning af `main`.
- Slå Dependabot alerts, secret scanning og push protection til (Settings → Code security).
- Når `npm audit`-fundene er håndteret: fjern `continue-on-error` på `audit`-jobbet og gør det til required check.

Bemærk: CI-workflowet har `paths: cms/**`. En PR der kun ændrer docs udløser ikke CI; en **required** check, der aldrig kører, blokerer PR'en. Løsning: fjern `paths`-filteret i `ci.yml`, når branch protection slås til, eller brug en "paths-ignore"-variant.

## 7. Railway: "Wait for CI" og rollback

- **Wait for CI:** Railway → service → *Settings → Source* (GitHub-repoet skal være forbundet) → slå **Wait for CI** til. Railway venter så på, at GitHub Actions-checks på commit'et er grønne, før der deployes. Sæt *Root Directory* til `cms`. Tjek efter første aktivering, at en docs-only commit (hvor CI ikke kører pga. `paths`) ikke hænger — det er ikke verificeret her. Deploy-kommandoerne og healthcheck (`/api/ready`) står i `cms/railway.json`.
- **Rollback af kode:** Railway → *Deployments* → vælg sidste grønne deployment → **Redeploy** (eller *Rollback*). Kør derefter `git revert <sha>` på `main`, så næste push ikke genindfører fejlen.
- **Rollback af database:** migrationer er additive (Prisma). `railway.json` kører `prisma migrate deploy` ved start; en rollback af koden efterlader nye kolonner/tabeller uskadt. Er en migration destruktiv: gendan fra Railway Postgres-backup (test gendannelsen i staging først) og marker migrationen `prisma migrate resolve --rolled-back <navn>`.
- **Hemmeligheder:** Railway-variabler pr. miljø; roteres de, skal servicen genstartes.

## 8. Kendte begrænsninger

- Smoke/e2e kører mod SQLite-seed, ikke Postgres. `pg-schema-sync` sikrer kun, at Postgres-skemaet matcher; en rigtig Postgres-integrationstest mangler (næste skridt: service-container i CI).
- `npm audit`: se `docs/review/FIX-ci-hygiejne.md` — Next har nu en ikke-major rettelse (`16.3.8`), som HANDOFF.md ikke kendte; allowlisten skjuler den ikke, men udskriver "RETTELSE FINDES".
- Lint-advarsler ryddes i en senere runde: se `docs/ops/LINT-BACKLOG.md`.
