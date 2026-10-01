---
name: lokalt-medieplatform
description: Byggeplan og regler for Lysdals CMS og den offentlige nyhedsfrontend til netværket "[By]Lokalt" (første site SlagelseLokalt) i /Users/Lysdal/GITS/Local2027. Brug dette skill ALTID, når du skal bygge, ændre, teste eller reviewe noget i Local2027/cms — forside, sektions- og undersektionssider, artikelside, mærkning, kortsystem, navigation, kalender, guide, indsendelse, støtteaftaler, supporterdashboard, forsidestyring, site-konfiguration, multi-site, datamodel eller designsystem. Trigger også ved "byg forsiden", "lav sektionssiden", "fortsæt med CMS'et", "næste fase", "SlagelseLokalt", "Lysdals CMS", "produktkataloget", "DESIGN.md" eller når brugeren henviser til konceptdokumenterne 01-10. Læs skillet FØR du skriver kode.
---

# Lysdals CMS + [By]Lokalt — byggeplan

Du bygger videre på et eksisterende Next.js 16-CMS og bygger den **offentlige nyhedsfrontend** til et netværk af lokale nyhedsmedier på Sjælland. Første site er **SlagelseLokalt** (`slagelselokalt.dk`). Brugeren er Carsten, dansk, stifter og ansvarshavende redaktør. **Svar og skriv UI-tekster på dansk.**

Sitet er **primært et nyhedssite med sektioner og undersektioner.** Kalender, guide og community er sekundære og bygges efter nyhedskernen.

## 1. Læs i denne rækkefølge, før du koder

| # | Fil | Hvorfor |
|---|---|---|
| 1 | `cms/HANDOFF.md` (driftslog + afsnit 3-4) | Hvad der findes, og **Next 16-/Prisma-faldgruber** |
| 2 | `cms/AGENTS.md` | Next 16 har breaking changes: læs `cms/node_modules/next/dist/docs/` før du bruger et API, du er i tvivl om |
| 3 | `files/DESIGN.md` | **Designsystemet til den offentlige frontend.** Eneste kilde til tokens, typografi, kort, zoner, sektioner (§6a) |
| 4 | `references/produktkatalog.md` (dette skill) | Alt, der skal bygges, med status, prioritet og acceptkriterier |
| 5 | `references/arkitektur.md` (dette skill) | Routes, site-opslag, tema, datamodel-udvidelser |
| 6 | `references/governance.md` (dette skill) | Ufravigelige regler og de tests, der beviser dem |
| 7 | `files/04-frontend-ux-og-community.md` | Sitemap, sidetyper, forsidestyring |
| 8 | `files/03-cms-og-ai-kravspecifikation.md` §2, §4-7 | Modulerne CMS-01…12, editor, datamodel, acceptkriterier |
| 9 | `files/01` §6, §8-9 · `files/09` §2 · `files/08` §3 | Taksonomi, støttepakker, mærkning, AI-regler, netværk |
| 10 | `files/10-inspirationsanalyse-migogaalborg.md` | Hvad der er taget med fra referencen, og hvad der er fravalgt |

Alle stier er relative til `/Users/Lysdal/GITS/Local2027/`. Læs ikke hele 01-09 på én gang. Slå op, når en opgave kræver det.

## 2. Ti regler, der aldrig brydes

1. **Offentlig frontend = `files/DESIGN.md`.** Ingen andre farver, skrifttyper eller komponentstile. Ingen mørk tilstand (`color-scheme: light`).
2. **Administrationen beholder sit eget designsystem** (det nuværende i `cms/app/globals.css`/`cms/styles/`). Bland aldrig admin-klasser ind i den offentlige frontend eller omvendt. Offentlige komponenter ligger i `cms/components/site/`.
3. **Intet hardkodet "Slagelse" i kernen.** Navn, domæne, farver, sektioner, områder og tekster kommer fra site-konfigurationen (`Instance`). `grep -ri slagelse cms/lib cms/app cms/components` må kun ramme seed, tests og README.
4. **Mærkning er teknisk håndhævet** (AC-01): partner, sponsoreret, AI-assisteret, indsendt og PR kan ikke publiceres uden mærkningsfelter, og mærkningen vises **øverst** i artiklen og **på kortet** i alle lister. Se `references/governance.md`.
5. **Ingen genererede citater.** Et citat i en AI-assisteret artikel kræver kilde-URL/-reference og dato (del 9 §2).
6. **Kvoteloft pr. site** for støttefinansieret indhold på forsiden (standard 25 %, konfigurerbart). Redaktøren advares; netværkspakker kan ikke omgå det.
7. **Ingen bannerannoncer, trackere eller tredjepartsscripts** i den offentlige frontend. Performancebudget: < 60 forespørgsler, < 1,5 MB på forsiden, LCP < 2,5 sek. på mobil.
8. **WCAG 2.1 AA.** Mærkning bæres aldrig kun af farve. Synlig fokusring, "Spring til indhold", `prefers-reduced-motion`.
9. **Eksisterende funktioner må ikke brydes.** `npm test`, `npm run lint`, `npx tsc --noEmit` og `npm run build` skal være grønne efter hver fase.
10. **Kopiér intet fra migogaalborg.dk / Min By Media** — hverken navn, logo, farver, tekst eller billeder. Kun principper (se `files/10`).

## 3. Arbejdsgang

Arbejd i **faser**, én ad gangen, i rækkefølgen i `references/produktkatalog.md` §0. For hver fase:

1. **Planlæg kort:** skriv i chatten, hvilke katalogpunkter fasen dækker, hvilke filer der ændres, og hvilke datamodelændringer der kræves. Spørg kun, hvis en beslutning reelt er brugerens (se §6).
2. **Datamodel først:** ret `cms/prisma/schema.prisma`, kør `npx prisma db push`, opdatér `prisma/seed.ts` (idempotent), kør `npm run seed`.
3. **Byg** efter `references/arkitektur.md`. Genbrug eksisterende libs (`lib/marking.ts`, `lib/workflow.ts`, `lib/permissions.ts`, `lib/blocks/*`, `lib/media.ts`) frem for at skrive nyt.
4. **Test:** tilføj Node-tests i `cms/tests/` for ny forretningslogik (mønster: `node --import tsx --test`). Governance-regler skal have tests.
5. **Verificér i browser** på 375 px og 1440 px: siden virker med seed-data, mærkningen er synlig, tastaturnavigation virker, ingen konsolfejl. Tjek med `curl` at offentlige sider ikke kræver login.
6. **Kør:** `npm test && npm run lint && npx tsc --noEmit && npm run build`.
7. **Dokumentér:** tilføj en kort arbejdslog øverst i `cms/HANDOFF.md` (dato, hvad er bygget, hvad mangler, næste skridt) og opdatér status i `references/produktkatalog.md` (⬜ → ✅).
8. **Commit** i `cms/`-repoet med en dansk besked, der nævner katalog-ID'erne (fx `P-03 P-04: sektionssider med undersektionsbar`).
9. **Stop og rapportér** til brugeren: hvad er bygget, hvordan det testes (URL'er + demo-login), hvad der ikke blev gjort og hvorfor.

Gå ikke videre til næste fase, før brugeren har set den forrige, medmindre brugeren har bedt om at køre flere faser i træk.

## 4. Kør projektet

```bash
cd /Users/Lysdal/GITS/Local2027/cms
npm install
npx prisma db push
npm run seed
npm run dev          # http://localhost:3000
```

Demo-login til redaktionen: `redaktoer@slagelse.test` / `journalist@slagelse.test`, adgangskode `cms-demo-2026` (se `HANDOFF.md`). Efter fase 1 ligger redaktionen på `/redaktion`.

## 5. Kendte faldgruber (kort — detaljer i HANDOFF.md §3-4)

- `middleware.ts` hedder `proxy.ts` i Next 16. `params`, `searchParams`, `cookies()`, `headers()` er **async** — altid `await`.
- `revalidateTag` kræver to argumenter; brug hellere `revalidatePath`.
- Prisma er **v6** (ikke v7). SQLite i dev: lister gemmes som `Json` eller relationer, enums som `String` + TS-union.
- next-auth v5 beta: credentials + JWT.
- `next/font/google` selv-hoster skrifttyperne — brug det til Bricolage Grotesque og Literata.

## 6. Beslutninger, der tilhører brugeren (spørg, gæt ikke)

- Endelige skrifttyper og accentfarve (forslag står i DESIGN.md §13).
- Logo/ordmærke (brug et midlertidigt tekst-ordmærke "Slagelse**Lokalt**" i Bricolage Grotesque 800 indtil da).
- Betalingsintegration (MVP: manuel fakturering, ingen betaling på sitet).
- Nyhedsbrevsudbyder og analyseværktøj (MVP: gem tilmeldinger i databasen; ingen tracking).
- Alt, der ændrer støttepakkernes indhold, priser eller de redaktionelle principper.

## 7. Referencer i dette skill

- `references/produktkatalog.md` — hele kataloget: faser, sider, komponenter, moduler, kommercielle produkter, status og acceptkriterier.
- `references/arkitektur.md` — route-struktur, flytning af admin til `/redaktion`, site-opslag via host, tema fra `Instance`, datamodel-udvidelser, SEO.
- `references/governance.md` — mærkning, AI-citater, kvoteloft, adskillelse af salg og redaktion, med de tests der skal findes.
- `references/komponenter.md` — komponentkontrakter for den offentlige frontend (props, varianter, a11y).
