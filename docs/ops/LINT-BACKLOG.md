# ESLint-backlog (advarsler)

Status ved udgangen af CI-/hygiejnesporet: **76 advarsler, 0 fejl** (regel i `cms/.lint-budget`; CI fejler hvis tallet stiger). Oprindeligt rapporteret: 83. Genereres med `npm run lint:budget` (samlet) og `npx eslint -f json .` (pr. fil).

Kun tests og uejede lib-filer er ryddet automatisk (`tests/intake-pipeline.test.ts`; `lib/ingest/*` fik fælles `slugify`). Resten ligger i filer andre spor ejer (UI, offentlige portaler, redaktion) og ryddes i en samlet runde **efter at UI-arbejdet er landet**, så der ikke opstår merge-konflikter.

## Pr. regel

| Regel | Antal | Typisk rettelse |
|---|---:|---|
| `@typescript-eslint/no-unused-vars` | 66 | Fjern ubrugt import/variabel (autofix findes ikke; `_`-præfiks for bevidst ubrugte). Mekanisk og risikofri. |
| `react-hooks/set-state-in-effect` | 8 | Flyt til initial state/`useSyncExternalStore`/event handler, eller udled værdien under render. Kræver et blik pr. komponent. |
| `@next/next/no-img-element` | 2 | Brug `next/image` (eller dokumentér undtagelsen for eksterne/SVG-billeder). |

## Pr. fil og regel

| Fil | Antal | Regler (linjer) | Spor |
|---|---:|---|---|
| `app/(site)/meddeler/MeddelerPortalClient.tsx` | 9 | ts/no-unused-vars (7,11,14,15,17,18,76); rh/set-state-in-effect (95,133) | øvrige |
| `app/(site)/meddeler/[token]/MeddelerDashboardClient.tsx` | 8 | ts/no-unused-vars (10,12,13,14,18,20,106); rh/set-state-in-effect (152) | øvrige |
| `components/site/ThreeStepSubmissionWizard.tsx` | 8 | ts/no-unused-vars (12,13,14,16,17,18,19); rh/set-state-in-effect (107) | UI |
| `app/(site)/indsend/page.tsx` | 6 | ts/no-unused-vars (3,6,7,8,8,8) | øvrige |
| `app/redaktion/qa/page.tsx` | 4 | ts/no-unused-vars (3,4,4,4) | øvrige |
| `app/(site)/nyhedsbrev/actions.ts` | 3 | ts/no-unused-vars (5,6,7) | øvrige |
| `app/redaktion/interview/page.tsx` | 3 | ts/no-unused-vars (3,4,4) | øvrige |
| `components/admin/UnifiedIntakeInbox.tsx` | 3 | ts/no-unused-vars (12,13,60) | øvrige |
| `components/site/BrugerprofilClient.tsx` | 3 | ts/no-unused-vars (8,11); rh/set-state-in-effect (55) | UI |
| `app/(site)/interview/page.tsx` | 2 | ts/no-unused-vars (5,5) | øvrige |
| `app/(site)/meddeler/[token]/page.tsx` | 2 | ts/no-unused-vars (2,7) | øvrige |
| `app/(site)/partner/[token]/PartnerReviewClient.tsx` | 2 | ts/no-unused-vars (5,5) | øvrige |
| `app/(site)/qa/page.tsx` | 2 | ts/no-unused-vars (3,6) | øvrige |
| `app/(site)/qa/QaPortalClient.tsx` | 2 | ts/no-unused-vars (8,19) | øvrige |
| `app/redaktion/indbakke/page.tsx` | 2 | ts/no-unused-vars (4,4) | øvrige |
| `components/site/SavedArticlesClient.tsx` | 2 | ts/no-unused-vars (5); rh/set-state-in-effect (23) | UI |
| `app/(site)/interview/[token]/InterviewRunner.tsx` | 1 | rh/set-state-in-effect (80) | øvrige |
| `app/(site)/interview/InterviewPortalClient.tsx` | 1 | ts/no-unused-vars (8) | øvrige |
| `app/(site)/partner/[token]/page.tsx` | 1 | ts/no-unused-vars (2) | øvrige |
| `app/(site)/qa/[token]/page.tsx` | 1 | ts/no-unused-vars (2) | øvrige |
| `app/(site)/qa/[token]/SourceQaResponder.tsx` | 1 | ts/no-unused-vars (39) | øvrige |
| `app/(site)/sponsor/page.tsx` | 1 | ts/no-unused-vars (5) | øvrige |
| `app/(site)/sponsor/SponsorBriefForm.tsx` | 1 | ts/no-unused-vars (8) | øvrige |
| `app/redaktion/annoncer/actions.ts` | 1 | ts/no-unused-vars (70) | øvrige |
| `app/redaktion/emner/page.tsx` | 1 | next/no-img-element (80) | øvrige |
| `app/redaktion/meddeler/page.tsx` | 1 | ts/no-unused-vars (3) | øvrige |
| `app/redaktion/qa/CreateQaModal.tsx` | 1 | ts/no-unused-vars (5) | øvrige |
| `app/redaktion/sponsor/page.tsx` | 1 | ts/no-unused-vars (3) | øvrige |
| `components/admin/article-table.tsx` | 1 | next/no-img-element (54) | øvrige |
| `components/site/BookmarkButton.tsx` | 1 | rh/set-state-in-effect (30) | UI |
| `components/site/SiteHeader.tsx` | 1 | ts/no-unused-vars (27) | UI |

## Plan for oprydningsrunden

1. Vent til UI-sporet (`components/site/**`, `app/(site)/page.tsx`, `app/redaktion/forside/**`) er landet på `main`.
2. `no-unused-vars` (størstedelen): ét mekanisk pass pr. mappe; kør `npm test`, `npx tsc --noEmit` og `npm run smoke` bagefter.
3. `set-state-in-effect` og `no-img-element`: manuel gennemgang pr. komponent (adfærd kan ændres).
4. Kør `npm run lint:budget -- --update` og commit det nye `.lint-budget`. Mål: 0 advarsler, derefter `--max-warnings 0` i CI.
5. Overvej at hæve `@typescript-eslint/no-unused-vars` til `error` med `argsIgnorePattern: "^_"`, når tallet er 0.

## Advarsel om fejl fra igangværende arbejde
Under arbejdet dukkede ESLint-**fejl** (`react-hooks/refs`, `react-hooks/immutability`) midlertidigt op i nye filer under `app/redaktion/forside/_components/` (UI-sporet, uafsluttet). De er væk i seneste måling (0 fejl), men CI fejler på enhver ESLint-fejl, så de skal være rene, før UI-grenen merges.
