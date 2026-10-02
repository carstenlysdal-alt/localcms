# Samlet review og backlog – Lokalt-platformen

Baseline: `localcms` HEAD fc7c5d7 (1. okt. 2026) → arbejdet ligger på branchen `review-fixes`. aI-library: HEAD 166786f, rettelser på branch `review-fixes` (ucommittet). Knowledge OS: bafbc99 (kun læst).

## 1. Rapporter

| Spor | Rapport | Rettelser |
|---|---|---|
| T1 Statisk site, links og klik | T1-statisk-site-links.md | FIX-statisk-site.md |
| T2 CMS-crawl, links og klik | T2-cms-links-crawl.md | FIX-cms-links.md |
| T3 Design (Næstved først) | T3-design-review.md | FIX-design.md |
| T4 SEO, schema, SoMe, AI-synlighed | T4-seo-schema-some.md | FIX-seo.md |
| T5 Kode- og sikkerhedsreview | T5-kodereview-sikkerhed.md | FIX-t5-t6.md, FIX-sikkerhed-api.md |
| T6 Redaktionel governance | T6-governance.md | FIX-t5-t6.md |
| T7 Agent→CMS-integration (design) | T7-agent-integration-design.md | AGENT-INGEST-API.md, FIX-ailibrary.md (adapter) |
| T8 Kilde- og dækningsmatrix | T8-kildematrix.md | – |
| T9 aI-library og Knowledge OS | T9-ailibrary-knowledge-os.md | FIX-ailibrary.md |
| T11/T12 Modulær forside og editor | T11-T12-spec.md | FIX-forside-editor.md |
| T13 Hærdning, Railway, CI | – | FIX-hardening.md, FIX-platform-railway.md, FIX-ci-hygiejne.md (+ docs/ops/*) |

## 2. Status (verificeret 2. okt. 2026)
- CMS: typecheck og lint 0 fejl, 393/393 tests (isolerede test-databaser), Postgres-skema i sync, hemmelighedsscan 601 filer uden fund, produktionsbuild grøn (Next 16.3.8), røgtest 157 bestået / 0 fejl på 6 byer.
- aI-library: lint og 620/620 tests grønne.
- Ikke verificeret: migration mod rigtig Postgres, rigtig Redis, rigtige Claude-kald, hydrering under håndhævet CSP, editorens succesveje med login, touch/skærmlæser, Google Rich Results Test og Facebook Sharing Debugger.

## 3. Backlog

### P0 – før lancering (ejer / drift)
1. Opret CMS-servicen i Railway og deploy (docs/ops/RAILWAY-SETUP.md): variabler, Volume `/data`, `seed:prod`, cron-service. Første `prisma migrate deploy` er første rigtige Postgres-kørsel.
2. Sæt hemmeligheder direkte i Railway: `AUTH_SECRET`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `ADMIN_EMAIL`, `NEXT_PUBLIC_APP_URL`.
3. Roter hemmeligheder: `AUTH_SECRET`, demo-adgangskoder i delte databaser, den gamle Knowledge-nøgle (commits 553b2a8, 1ab0bd1); sæt `API_KEY` på Knowledge-serveren.
4. Cloudflare foran alle by-domæner (docs/ops/EDGE-HARDENING.md); `ORIGIN_SECRET` og `TRUST_CLOUDFLARE` hænger sammen (startfejl i produktion hvis kun den ene).
5. Ejerbeslutninger/-tekster: "Tilmeldt Pressenævnet", ansvarshavende redaktør, de 8 privatlivs-pladsholdere (siden er `noindex` indtil godkendt), `SITE_URL`/canonical.
6. Kør `npm run roles:sync` efter deploy (nye rettigheder: `signal.approve`, `frontpage.*`, `newsletter.manage`, `ads.manage`, `ingest.manage`).

### P1 – kort sigt
7. Rich Results Test, Facebook Sharing Debugger, LinkedIn/X-validering, Search Console + sitemaps, Publisher Center (kræver netværk og konti).
8. Test editoren med login: gem, publicér, godkend, afvis, rul tilbage, "Foreslå forside", AI-kommandofelt; verificér tastatur-DnD og touch.
9. Monter `TurnstileField` i formularerne først derefter sæt `TURNSTILE_SECRET_KEY`.
10. Håndhævet CSP: kør først med `CSP_REPORT_ONLY=1`, gennemgå rapporter, flip til håndhævelse.
11. ISR/cache pr. by (kræver tenant-routing uden `headers()`); indtil da kun edge-cache via headere.
12. Event-model (kalender) og opslagstavle-model; i dag viser siderne tagget indhold eller tom tilstand.
13. aI-library: gennemgå branch `review-fixes`, commit og merge efter eget valg; ret `~/.claude/skills/knowledge/SKILL.md` (linje 96–97, 175–177); arkivér/slet `/Users/lysdal/aI-library`.
14. Koble faktatjek på redaktionsagentens UI (ellers blokerer afsendelsesvagten, tilsigtet).
15. Kilder P1 fra T8: kommune dagsorden/referat, politi (rettede kredse), Vejdirektoratet, kommune-RSS (Roskilde verificeret); licens-afklaring før brug af sn.dk/tv2east.dk (forbyder AI-crawlere).

### P2 – mellemlang sigt
16. Schedulers + persistent dedupe + ændringssporing (dagsorden→referat) + klynge af samme hændelse (T8 scheduler-plan).
17. Pilot Næstved af agent→CMS-flowet (T7 faseplan), derefter Slagelse, Holbæk, Køge, Roskilde, Ringsted, Kalundborg.
18. Udvid GeoTags til småbyer (Karrebæksminde, Mogenstrup m.fl.) og Kalundborg; postnummer-tabel pr. by.
19. Uploads til S3-kompatibel bucket (så flere replicas er mulige); Redis/Postgres til rate-limit-state i flere replicas.
20. Slut-lint: ryd 76 ESLint-advarsler (docs/ops/LINT-BACKLOG.md), 15 ubrugte filer, `slugify`-dubletter i redaktionens actions; ratchet `.lint-budget` ned.
21. Rettelsestype og "rettelse af rettelse", revision ved alle felter (T6 nr. 9, 11), blok-skema for citater (nr. 16); to-øjne-princip for godkender.
22. 404-side server-renderet med links også for enkelt-segment-stier (røgtest-advarsel); `next/image` og hero `priority`.
23. Auto-tilstand for forsidemoduler: kun hvis/når kriterier (spec §18) er besluttet; CTR tilbage i rankeren; prompt caching når systemprompten er lang nok.
24. Støt-konvertering: bundmenuens 5. fane er Profil (DESIGN.md) – vurder Støt; en syvende byfarve til Ringsted ved lancering.
25. `docs/ops/CI.md`: bekræft hvordan Railway "Wait for CI" opfører sig med `cms/**`-path-filter.

### P3
26. `noUncheckedIndexedAccess` (204 fejl) og øvrige strengere TS-flag.
27. Dobbelt opt-in og captcha på nyhedsbrev; UI til API-nøgler; "kladde fra signal"-knap.
28. Opdatér `cms/HANDOFF.md` (påstår at der ikke findes Next-rettelse; nu 16.3.8) og DESIGN.md (bundmenu, Okker/Skov-farver).
29. Genbyg/afskaf committet forældet byggeoutput `functions/lib` i aI-library.

## 4. Det der er lukket i dette forløb (uddrag)
Formularfejl og døde ankre i prototypen; by-skifter med rigtige domænelinks; privatlivsside; forside pr. by uden Slagelse-lækage; nyhedsbrev der gemmer; offentlig `/partner`; ASCII-slugs med 301; JSON-LD-escaping, OG-billeder, news-sitemap, robots, llms.txt, feeds; sanitiser-bypass; tenant-isolation i API'er; rate limit, honeypot og zod på offentlige actions; rettighedstjek på redaktionssider; signaler kræver redaktørgodkendelse; agent-indtag (`/api/ingest/*`, kun kladder); modulær forside med AI-forslag og fallback til seneste nyt; drag-and-drop-editor; hærdning (CSP, klient-IP, origin-lås, Redis-fallback, bots, cache); Railway/Postgres-opsætning; CI, isolerede tests og smoke; Next 16.2.12→16.3.8; aI-library: DAWA-erstatning, Ritzau-URL, politikredse, godkendelsesvagt og CMS-adapter.
