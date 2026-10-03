# Logbog: hvad der er ændret (agent-arbejdet, 1.–3. okt. 2026)

Baseline: `fc7c5d7` (1. okt. 2026). Alt ligger på branchen `review-fixes` (pushet; `main` er uændret). 13 commits, 628 filer, ca. 72.000 tilføjede og 14.000 fjernede linjer. Rapporter pr. spor ligger i `docs/review/`, design i `docs/design/`, drift i `docs/ops/`, LocalRating i `docs/localrating/`.

## 1. Tidslinje (commits)
| Commit | Tidspunkt | Indhold |
|---|---|---|
| `1f2593e` | 1. okt. 21:00 | Statisk nyhedssite: formularfejl, døde ankre, by-skifter for 7 byer, scroll-spy, tilgængelighed, SEO-basis |
| `eb36b19` | 1. okt. 21:00 | SEO/schema: JSON-LD-escaping, OG-billeder, news-sitemap, robots, llms.txt, feeds, HTML-sanitering |
| `734c6f6` | 1. okt. 21:00 | Forside-backend (T11/T12): modulregister, skabeloner, ranker med AI-forslag og fallback til seneste nyt |
| `60f51a7` | 1. okt. 21:00 | Sikkerhed: tenant-isolation, rate limit, validering, rettigheder, `/api/ingest` |
| `7a0e6be` | 1. okt. 21:06 | CMS-links, indhold, by-skifter, privatlivsside, nyhedsbrev, slugs, første designrettelser |
| `6957bd4` | 2. okt. 00:26 | Forside-moduler og -editor, hærdning, Railway/Postgres, CI, Next 16.3.8 |
| `84ba051`, `9c98e47` | 2. okt. 08:11 | Governance, rettigheder, signal-godkendelse, geo-match; pladsholdere i stedet for rigtige varemærker |
| `5b8af9f` | 2. okt. 16:03 | Sundhedstjek venter på Redis-forbindelsen |
| `968ac73` | 2. okt. 17:11 | Skift af adgangskode, tvunget skift, brugeradministration |
| `2155d16` | 3. okt. 01:57 | Redesign (designsystem/shell), AI-operatør, editor med metadata/SoMe/AI, standardsektioner, analytics |
| `989fd4a` | 3. okt. 01:59 | LocalRating Fase 0 (arkitektur, 15 ADR'er, kilderegistre) |
| `5e66129` | 3. okt. 08:16 | LocalRating: kilder hentes kun manuelt (ADR-016) |

## 2. Ændringer pr. område
**Review (T1–T9):** statisk site, CMS-crawl (99 sider/by), design (Næstved), SEO/schema/SoMe (score Google 3/10 før), kode- og sikkerhedsreview, governance (34 regler), agent-integration, kildematrix og aI-library/Knowledge OS. Samlet oversigt og P0–P3-backlog: `docs/review/00-oversigt.md`.

**Statisk site (`nyhedssite.html`/`build_nyhedssite.py`):** P0-formularfejl rettet, døde ankre, by-skifter for 7 byer, scroll-spy, a11y, canonical/OG/JSON-LD, byggetjek mod døde ankre, rigtige varemærker/opdigtede citater fjernet.

**CMS – links og indhold:** privatlivsside, by-skifter med domænelinks, forside pr. by uden Slagelse-lækage, nyhedsbrev der gemmer, offentlig `/partner`, ASCII-slugs med omdirigering, områder/emner-indeks, fejlsider, diakritik-ufølsom søgning.

**CMS – SEO/SoMe:** JSON-LD-escaping, raster-OG-billeder pr. artikel/by, canonical overalt, NewsMediaOrganization/WebSite/NewsArticle, news-sitemap, robots med AI-botpolitik, `llms.txt`, feeds med autodiscovery, sanitiser-bypass lukket.

**CMS – sikkerhed og hærdning:** validerede og rate-limitede offentlige endpoints, tenant-filtrering i `/api/articles`, honeypot/zod, rettighedstjek på alle redaktionssider, signaler kræver redaktørgodkendelse, tenant kun fra Host, rettigheder slås op i DB, upload via magic bytes, login-lockout, CSP med nonce, klient-IP fra betroede kilder, origin-lås, Redis rate limit med fallback, botfilter, Turnstile (valgfri), cache-headere, `/api/health` og `/api/ready`.

**Agent-indtag:** `POST /api/ingest/signals|articles` (hashede nøgler pr. by; kun kladder, kræver kilder med dato; aldrig publicering).

**Platform/drift:** dobbelt Prisma-provider (SQLite lokalt, Postgres i produktion), migrationer, `railway.json`, miljøvalidering, `seed:prod`, uploads-adapter, GitHub Actions (CI/CodeQL/gitleaks/dependabot), isolerede tests, røgtest, Playwright. Next 16.2.12→16.3.8 (kritisk sårbarhed).

**Login/brugere:** skift af adgangskode (min. 12 tegn, lockout, andre sessioner logges ud), tvunget skift ved første login, `/redaktion/brugere` (opret/nulstil/rolle/deaktiver, revisionslog), `user:reset-password`.

**Forside:** 15 moduler, drag-and-drop-editor med AI-forslag (redaktør godkender), fallback til seneste nyt, preview, metrikker.

**AI-operatør (tale/skrift):** 40 værktøjer med tre risikoniveauer (direkte/bekræft/blokeret), Fortryd, audit, `chat-module`-UI, talestyring (da-DK), udvideligt register. Publicering, nyhedsbrev, betaling, sletning af brugere, adgangskoder og rolle-eskalering er bevidst blokeret.

**Editor og metadata:** master-detail-artikelside med autosave, preview og delings-previews; alle metadata (SEO, canonical, robots, keywords, OG/Twitter, opslagstekster pr. platform, schema-type, kilder, medforfattere, udløb m.m.); slug-omdirigering; planlagt udgivelse (cron-endpoint, slået fra til servicen oprettes); feltniveau-AI (13 opgaver, kun forslag).

**Designsystem og shell:** `--cms-*`-tokens, 20+ komponenter, SVG-diagrammer, grupperet rettighedsfiltreret sidebar, mobil-drawer, alle sider i samme mønster, Analytics med kun rigtige data.

**Sektioner:** nu fem topsektioner (Nyheder, Politik, Erhverv, 112, Kultur), øvrige emner under Nyheder; 112 AI-spærret; emnebjælken drevet af kategoritræet; `npm run sections:sync` og knappen "Opret standardsektioner". Oprettet i produktion for alle seks byer (29 pr. by).

**LocalRating (kun dokumentation, Fase 0):** 13 dokumenter + ADR-001…016 (+017 under arbejde). Lag ovenpå CMS'et; Y Rating uændret og portering envejs; to ratingmodeller (`score`/`local`); `SourceDefinition`/`SourceItem` fra Næstved- og Slagelse-registrene; kilder hentes kun med en knap; simulator og prompt-bibliotek designet.

**aI-library (separat repo, branch `review-fixes`, ucommittet):** DAWA erstattet af postnummertabel, Ritzau-URL og politikredse rettet, døde feeds fjernet, standard `editor` med godkendelsesvagt, ét kilde-register, CMS-adapter (slået fra), `CLAUDE.md`. 620 tests grønne.

## 3. Railway (ændringer uden for git)
Nyt projekt `Lysdal-local-cms`: services `lysdalcms` (fra GitHub, rod `cms`), Postgres, Redis, volumen på `/data`, offentligt domæne `lysdalcms-production.up.railway.app`, `cron-frontpage` (hver 3. time; kun forslag). Variabler: `DATABASE_URL`/`REDIS_URL` (referencer), `AUTH_SECRET`, `CRON_SECRET`, `ADMIN_EMAIL`, `NEXT_PUBLIC_APP_URL`, m.fl. Migrationer anvendt: `user_password_flags`, `operator_log`, `article_meta_social` m.fl. Rettigheder synkroniseret og sektioner oprettet. Gamle CMS-services i `lucky-happiness` slettet; to duplikerede Redis-services oprettet ved en fejl og slettet igen.

## 4. Beslutninger taget undervejs
AI foreslår, mennesket godkender (forside, signaler, kilder); kun globale AI-nøgler som Railway-variabler; engangsportering af Y (Y uændret); Local-navne kun i localcms; kilder hentes kun manuelt; hosting Railway bag Cloudflare (ejerens opsætning); nye topsektioner som ovenfor.

## 5. Åbent / ejerens opgaver
Sæt `ANTHROPIC_API_KEY` og/eller `DEEPSEEK_API_KEY` (operatør: DeepSeek, med maskering af persondata); Railway-cron `cron-publish`; `SEO_SITE_CONFIG`; Cloudflare; rotér gamle nøgler (Knowledge, Y's Reuters/Exa, `AUTH_SECRET`); ejertekster (Pressenævnet, ansvarshavende, privatlivs-pladsholdere); godkend LocalRating Fase 0 (D1–D5, D15, D19, D26, D29–D32); commit/gennemgang af aI-library-branchen; slet gammel SSH-nøgle i Railway og `~/.ssh/old/`.

## 6. Kendte begrænsninger
UI er ikke set med login af agenterne (kun tests og markup); Postgres-migrationer er kun kørt i Railway (ikke lokalt); Redis og rigtige Claude/DeepSeek-kald kun testet med falske klienter; 768 px/1440 px kun delvist visuelt verificeret; sociale opslag kan skrives og forhåndsvises, men ikke postes automatisk; analytics-tiles uden datakilde (unikke læsere, kilder, enhed, aktive timer, nyhedsbrev-CTR) vises som "ikke tilsluttet".
