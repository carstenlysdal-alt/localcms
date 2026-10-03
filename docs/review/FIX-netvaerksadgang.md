# FIX: netværksadgang — ét login til alle byer

Branch `review-fixes`. Intet er committet eller pushet. Bygning, røgtest og deploy køres af lead.

## Problem

Hver bruger hørte til præcis én instans (by). For at redigere flere byer krævede det ét login pr. by (fem midlertidige test-administratorer var oprettet i produktion). Ejerens mockups viser ét samlet CMS med byliste og faner "Alle | Slagelse | Næstved | …".

## Design

1. **Medlemskaber.** Ny model `UserInstanceAccess { userId, instansId, createdBy, createdAt }`, `@@unique([userId, instansId])`, indeks på `instansId`, `onDelete: Cascade` fra bruger. Hjemmeinstansen (`User.instansId`) er altid implicit tilladt og gemmes ikke. Brugerens ene globale rolle gælder i alle tilladte byer (roller er globale). Additivt og uden enums (SQLite + PostgreSQL); migration `prisma/postgres/migrations/20261003121227_user_instance_access`.
2. **Aktiv instans = tenanten overalt.** JWT'en får `activeInstansId` (default = hjem ved login; tokens uden claim = hjem). `getSessionState` (som `getAuthorizedUser` og `getFreshSession` går igennem) returnerer **`user.instansId = den aktive by`**, og `homeInstansId` som særskilt felt. Dermed er alle de eksisterende `user.instansId`-brug rigtige uden ændring. Claimen er kun et *ønske*: `resolveActiveInstance` (`lib/instance-access.ts`) accepterer den kun, hvis den er hjemmet eller en række findes **i databasen lige nu**; ellers bruges hjemmet (og det logges én gang pr. proces/bruger/by). Samme genvalidering sker i JWT-callbacken ved hver læsning, så selv rå `auth()` aldrig viser en forældet by.
3. **Skift af by** kun via serveractionen `switchInstance` (`app/redaktion/instans-actions.ts`): frisk DB-session (kodeskift/deaktivering/tvungen kodeskift afvises), validering af input, rate limit (30 pr. 10 min pr. bruger og IP, fail-closed), medlemskab/hjem tjekkes i databasen, Auth.js `unstable_update` (trigger `update`) skriver claimen via jwt-callbacken (som genvaliderer igen), `AuditLog` `instance.switch` med `{from, to}` i målbyen, `revalidatePath`. Klientens `POST /api/auth/session` (`update()`) afvises med 405 (`app/api/auth/[...nextauth]/route.ts`), så kun serveractionen kan skifte.
4. **Skifter-UI.** Sidebar: by-listen er knapper for byer med adgang (aktiv = `aria-current="true"`, "Redigeres nu"/"Hjem"), låste byer (ikke klikbare) og ved siden af hver et "Se siden"-link (44 px) til byens offentlige side — på Railway-adressen `/?by=<nøgle>`, så den offentlige forhåndsvisning følger den redigerede by. Topbar: "Redigerer: Næstved" (menu med knapper, Esc lukker, tastatur, 44 px, drawer på mobil bruger samme sidebar) + "Se siden". Efter skift sker en hård navigation (`window.location.assign`), så klientens router-cache aldrig kan vise den forrige bys sider. En enkelt artikel/medie-side falder tilbage til listen (`sectionRoot`). Den tidligere "Din by"/"ingen redigering på tværs"-adfærd fra FIX-flere-byer er erstattet. Komponenter: `components/admin/city-switcher.tsx`, `lib/shell-cities.ts`, `styles/cms-shell.css`.
5. **Adgang til andre.** (a) `npm run user:grant-access -- --email <e> (--alle-instanser | --instans <id|domæne|nøgle>) [--revoke] [--force]` (`scripts/grant-access.ts`): afvises uden `NODE_ENV=production`/`--force`, idempotent, audit pr. ændring, hjemmebyen kan ikke fjernes. (b) `/redaktion/brugere` → knappen "Byer" (`app/redaktion/brugere/network-actions.ts`), ny rettighed `network.manage` (`lib/permissions.ts`, kun *Ansvarshavende redaktør* via `default-roles`; `roles:sync` tilføjer den). Regler (`planAccessChange`): udføreren kan kun tilføje/fjerne byer, udføreren selv har adgang til; hjemmebyen kan hverken gives eller fjernes (en bruger har altid mindst én adgang); ikke sig selv; målet skal have den aktive by som hjemmeby og må ikke have flere rettigheder end udføreren; `users.manage` alene er ikke nok. AI-operatøren: filen importeres ikke fra `lib/operator`, og navne som `grant_access`/`switch_city` er i `BLOCKED_TOOLS`.
6. **"Alle byer"** (fase 2, lavet): `/redaktion/artikler/alle-byer` (samlet, skrivebeskyttet liste med by-kolonne; en artikel åbnes i sin by — byen skiftes først, serveren tjekker igen) og `/redaktion/metrikker/alle-byer` (totaler, søjler og tabel pr. by). Faner "Alle byer | Slagelse | Næstved | …" på begge sider (`CityTabs`). Byerne afgøres kun på serveren; er der kun én by, sendes man til den almindelige side.

## Trusselsmodel (tenant-isolation er invariant nr. 1)

| Trussel | Modforanstaltning |
|---|---|
| Klienten vælger en by (body/URL/cookie/JWT-ændring) | Ingen request tager instans fra klienten. Claimen er et ønske, der genvalideres mod DB ved hver læsning (`getSessionState` + jwt-callback). Test: forfalsket claim for C ignoreres. |
| Tilbagekaldt adgang, men gammel session | Fald tilbage til hjemmet ved næste forespørgsel; logges én gang. |
| `update()` fra browseren | `POST /api/auth/session` → 405; jwt-callbacken afviser alligevel ønsker uden række og beholder den nuværende by. |
| Skift uden adgang / uden login / deaktiveret / forældet session / tvungent kodeskift | `switchInstance` afviser (frisk DB-session + medlemskab). |
| Rettighedseskalering via netværk | `network.manage` kun hos øverste rolle; kun egne byer; rækkevidde-regel som for roller; ikke sig selv; AI-operatøren har ingen vej. |
| Bekræftelses-/fortryd-tokens på tværs af byer | Allerede bundet til bruger + instans; token udstedt i A kan ikke indløses i B (test). |
| To faner/sessioner i hver sin by | Tilstanden ligger kun i hver sessions JWT; ingen server-global (test). |
| Audit i forkert by | `AuditLog.instansId` = den aktive by (test). |
| Rå `auth()`/JWT-claims i sider | Alle `app/redaktion`-sider bruger nu `getFreshSession()` (DB-friske rettigheder og aktiv by). Guard-test låser det. |

## Filer

Skema/migration: `prisma/schema.prisma`, `prisma/postgres/{schema.prisma,.last-migrated-schema.txt,migrations/20261003121227_user_instance_access}`. Kerne: `lib/instance-access.ts`, `lib/auth.ts`, `types/next-auth.d.ts`, `lib/permissions.ts`, `lib/shell-cities.ts`, `lib/operator/policy.ts` (BLOCKED_TOOLS). Actions/ruter: `app/redaktion/instans-actions.ts`, `app/redaktion/brugere/{network-actions.ts,page.tsx}`, `app/api/auth/[...nextauth]/route.ts`. UI: `app/redaktion/layout.tsx`, `components/admin/{city-switcher,nav-links,user-admin}.tsx`, `app/redaktion/artikler/{page.tsx,alle-byer/page.tsx}`, `app/redaktion/metrikker/{page.tsx,alle-byer/page.tsx}`, `styles/cms-shell.css`, `app/globals.css`. Sider der brugte rå `auth()` er flyttet til `getFreshSession()` (emner, emner/ny, chat, medier, medier/ny, medier/[id], sektioner, honorar, opgaver, opgaver/ny, opgaver/[id], artikler/[id]). Script: `scripts/grant-access.ts` + `npm run user:grant-access`. Docs: `docs/ops/RAILWAY-SETUP.md` §14.

## Tests

- `tests/network-access.test.ts` (24): aktiv by i alle tre helpers; forfalsket/forældet claim; revokering → hjem + log én gang; parallelle sessioner; kodeskift/lockout/deaktivering uændret; jwt- og session-callbacks; `switchInstance` (ok, uden adgang, input, afviste sessioner, rate limit, audit); `POST /api/auth/session` = 405; isolation med [A,B] mod C over artikler, sektioner, medier, signaler, forside, ingest-nøgler og brugeradministration (negative kontroller + positive efter skift); operatør-token bundet til instans; operatøren har ingen adgangsværktøjer; `network.manage`-regler; grant-access-scriptet; skallens skifter.
- `tests/network-overview.test.ts` (4): "Alle byer" begrænset til brugerens byer (også med forfalsket claim/query), redirect uden flere byer, rettighed, tilbagekaldt adgang.
- `tests/instance-guard.test.ts` (7): grep-vagt — `homeInstansId` kun i en liste af filer, rå `auth()`/`token.*` kun i `lib/auth.ts`, `updateSession` kun i `switchInstance`, `userInstanceAccess` kun i fire filer, ingen `db.user`-genlæsning af instans, netværksadgang aldrig fra operatør/API.
- Opdateret: `tests/preview-site.test.ts` (ny by-liste), `tests/helpers/mock-session.ts` (additivt: `activeInstansId`, de rigtige jwt-callbacks, `unstable_update`, `usePathname`), `tests/helpers/operator-fixtures.ts` (`homeInstansId`).

## Ikke dækket / bevidste grænser

- Brugerlisten i `/redaktion/brugere` viser kun brugere med den aktive by som **hjemmeby**; brugere, der kun har *adgang* til byen, vises ikke og kan ikke få nulstillet kode/rolle derfra (de administreres i deres hjemby). Nye brugere oprettes med den aktive by som hjemmeby.
- Én global rolle: samme rettigheder i alle byer (ingen rolle pr. by). Pr.-by-roller kræver en model `UserInstanceAccess.roleId` — ikke bygget.
- "Alle byer" er skrivebeskyttede oversigter (ingen masseredigering) og viser ikke forside/nyhedsbrev/annoncer pr. by.
- Sletning af en instans med medlemsrækker blokeres af FK (`RESTRICT`); der findes ingen UI til at slette instanser.
- Visuel browser-test og `next build` er ikke kørt af denne leverance (markup, tilgængelighedsattributter og server-/klient-grænser er dækket af tests/tsc/eslint); lead kører build/smoke. Skifteren er ikke afprøvet med skærmlæser.
- Kun 12 timers JWT (`SESSION_MAX_AGE_SECONDS`): en tilbagekaldt adgang virker straks (DB-genvalidering), men claimen ligger i cookien til sessionen udløber; den giver dog ingen adgang.
