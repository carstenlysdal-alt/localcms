# FIX: CMS-sikkerhed og API (branch `review-fixes`, ikke committet)

Verifikation: `npx tsc --noEmit` rent, `npm test` 81/81 grønne (heraf 3 nye testfiler: `security-validation`, `ingest-api`, `public-tracking`), eslint 0 fejl. Live-tjek mod dev-serveren på :3000 af `/api/articles` (kun egen by + cache-headere), `ads/metrics/track` (validering, 404), `nyhedsbrev/export` (401), `chat` (401). Ingest-endpoints er testet via route-handlerne i node-tests; dev-serveren skal genstartes (ny Prisma-klient) før de kan kaldes via HTTP.

## 1. Fund -> ændring

| # | Fund | Ændring (fil) |
|---|---|---|
| 1 | `ads/track` + `metrics/track` åbne og kunne pumpes | `app/api/ads/track`, `app/api/metrics/track` + `lib/tracking.ts`, `lib/http.ts`: zod, kampagne/artikel bindes til hostens instans (`getCurrentSite`), kun Aktiv/inden for datoer/Publiceret, `maksVisninger`, dedupe pr. besøgende (30 min visning, 10 min klik, 24 t læsning), tid kappet 120 s/kald, 40 kald/time/besøgende, 120-180 kald/min/IP, same-origin-filter, bot-UA ignoreres, 1 KB body-loft, atomiske `increment` (ingen read-modify-write). |
| 2 | `/api/articles` lækkede alle byer | `app/api/articles(/[slug])` + `lib/public-api.ts`: filter på `instansId` fra host, kun Publiceret, `Cache-Control: public, s-maxage=60, stale-while-revalidate`, `Vary: Host`, rate limit, `?sektion=&omraade=&limit=`. Svar `{data,count,site}`. `marking` reduceret til sponsor/labelTekst/afsender/kilder — **`oprindeligKontakt` (indsenderens kontaktdata) lækkede før**. |
| 3 | Token-actions uden validering/rate limit | `app/actions/{sponsor,qa,interview,meddeler}.ts`, `app/(site)/indsend/actions.ts`, `app/(site)/nyhedsbrev/actions.ts`: zod (`lib/validation/public.ts`: e-mail, længder, enums, antal svar), honeypot (`website`/`_hp_website`), rate limit pr. IP (`lib/ratelimit/guard.ts`), HTML strippes (`cleanText`), nye tokens `crypto.randomBytes(24)` base64url (`generateToken`, eksisterende cuid-tokens virker), svar kan ikke overskrives når allerede besvaret, kun kendte spørgsmål-id'er gemmes, `audioUrl` kun http(s)/`/uploads`. **Konto-overtagelse lukket**: `submitMeddelerTip`/`registerMeddeler` udleverede før en eksisterende profils token til enhver, der kendte e-mailen. |
| 3b | Statusvokabular uens (BriefModtaget/BriefIndsendt, BESVARET/Besvaret, GENNEMFOERT, OPRETTET, Modtaget) | `lib/validation/status.ts`: kanonisk sæt (QA `Sendt/Besvaret/DelvistBesvaret/ArtikelOprettet`, interview `Oprettet/Sendt/Igang/Besvaret/ArtikelOprettet`, sponsor `Booket/BriefIndsendt/…/RettelserAnmodet/Godkendt/Publiceret`, meddeler `Ny/UnderBehandling/BrugtIArtikel/Afvist`). Skrivning er altid kanonisk; læsning via `normalizeStatus/isAnswered/isNewIntakeStatus`, så gamle rækker virker. Læsere opdateret: `QaListClient`, `InterviewListClient`, `(site)/qa/[token]`, `(site)/interview/[token]`, `indbakke/page`, `UnifiedIntakeInbox`. |
| 3c | Indbakke-konvertering lavede ugyldige/usikre blokke | `redaktion/indbakke/actions.ts`: `paragraph`-blokke brugte `data.text` (skema kræver `content` -> tom artikeltekst) og ville være rå HTML fra offentlige indsendelser. Nu `content: textToParagraphHtml()` (escapet `<p>`). |
| 4 | Manglende `can()`/tenant-tjek | Nye rettigheder `newsletter.manage`, `ads.manage`, `ingest.manage` (`lib/permissions.ts`, `lib/default-roles.ts`, seed + `npm run roles:sync`). `nyhedsbrev`-actions og `/api/nyhedsbrev/export`: NEWSLETTER_MANAGE. `omraader`: CATEGORY_MANAGE/FRONTPAGE_EDIT/ARTICLE_EDIT_ALL **+ instansId** (før kunne enhver indlogget redigere/slette andre byers områder). `annoncer`: ADS_MANAGE/SUPPORT_MANAGE **+ instansId**, zod, `linkUrl` kun http(s), status læses fra DB (ikke klientens). `signaler`: ARTICLE_CREATE + `updateMany` med instansId (markRead ramte før alle byer). `emner/ny` createTopic: ARTICLE_CREATE + validering. `forside/actions`: artikel/placering scopet til instansId. `honorar/export` og `nyhedsbrev/export`: CSV-formel-injektion neutraliseret (`csvCell`), `Cache-Control: no-store`. |
| 4b | Proxy-uafhængig auth | `lib/auth.ts` `getAuthorizedUser(permission|[…])`: verificerer JWT via `auth()` og slår derefter bruger + rolle op i databasen (slettede brugere/ændrede roller gælder straks; JWT bærer ellers rettigheder fra login). Brugt i alle nye/ændrede actions og route handlers. Cookie-tilstedeværelse (proxy) bruges ikke som beslutning nogen steder. De øvrige redaktion-actions (artikler, opgaver, indbakke, medier, sektioner, honorar) bruger fortsat `auth()` (verificeret JWT) + `can()` + instansId; medier bruger `getAuthorizedUser`. |
| 5 | `/api/chat` uden grænser | `app/api/chat/route.ts`: auth, zod (`sessionId` `[A-Za-z0-9_-]{8,64}`, besked <= 4000 tegn, `mode` enum), 20 beskeder/10 min/bruger, samtalen skal tilhøre brugeren og instansen (før kunne et gættet sessionId læse andres historik i samme by), nyeste 20 beskeder i korrekt rækkefølge, rolle-normalisering, stream-fejl fanges og afbrydes ved klient-abort, assistentsvar gemmes med userId, model fra `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`), 503 hvis `ANTHROPIC_API_KEY` mangler. |
| 6 | Upload valideret på klient-MIME | `lib/upload.ts` + `redaktion/medier/actions.ts`: filtype afgøres af magic bytes (JPEG/PNG/WebP/WAV/OGG/MP3/MP4/WebM/PDF), SVG/HTML/XML/script/EXE afvises eksplicit, PDF med JavaScript/OpenAction/Launch/EmbeddedFile afvises, 10 MB-loft pr. type, filnavn på disk altid uuid + fast endelse, visningsnavn renset (`safeFilename`), billeder re-enkodes til WebP (EXIF/GPS fjernes; pixelloft 40 MP i `media-storage.ts`), 30 uploads/10 min/bruger, eksterne medie-URL'er kun http(s). |
| 7 | Auth/seed/env | `lib/auth.ts`: login-lockout (5 fejl/e-mail, 20/IP pr. 15 min), dummy-bcrypt mod timing/enumerering, password-loft 200 tegn. `prisma/seed.ts`: afviser `NODE_ENV=production`, ingen hardkodet adgangskode — `SEED_DEMO_PASSWORD` (>= 12 tegn) eller tilfældig engangsadgangskode printet i dev. `.env.example` komplet (AUTH_SECRET, DATABASE_URL, NEXT_PUBLIC_APP_URL, DEFAULT_SITE_DOMAIN, ANTHROPIC_API_KEY/MODEL, ingest, SEED_DEMO_PASSWORD, drift). README/HANDOFF opdateret. |
| 8 | Ingen agent-indtag | `ApiKey`-model, `lib/ingest/{schema,auth,signals,articles}.ts`, `POST /api/ingest/signals`, `POST /api/ingest/articles`, `GET /api/ingest/health`, `scripts/create-ingest-key.ts` (`npm run ingest:key`), `createIngestKeyAction/revokeIngestKeyAction`. Se `AGENT-INGEST-API.md`. Signal-felter: `externalId`, `kildeUrlNorm`, `sourceType`, `omraadeId/omraadeTekst`, `kildeTidspunkt`, `maskinindsamlet`, `ingestKeyId`; Article: `externalId`, `provenance`. Maskinindsamlet-badge på `/redaktion/signaler`. |

Rate limiter: `lib/ratelimit/index.ts` (pluggable `RateLimitStore`).

## 2. Migration og drift

- Schemaændringer er **additive** (nye nullable kolonner, nye unikke indekser der tillader flere NULL, ny tabel `ApiKey`). Dev: `prisma/dev.db` blev kopieret til scratchpad (`dev.db.backup-132329`) før `npx prisma db push --accept-data-loss` (advarslen gjaldt kun det nye unikke indeks på tom kolonne `Article.externalId`); 97 artikler og 17 brugere uændrede. `npx prisma generate` kørt.
- **Dev-serveren skal genstartes** (jeg har ikke rørt den): den kører med den gamle Prisma-klient, så `/api/ingest/*` fejler indtil da.
- Produktion (Postgres): kør tilsvarende migration (`prisma migrate`), derefter `npm run roles:sync` (tilføjer nye rettigheder til eksisterende roller, fjerner intet). Brugere skal logge ind igen for at JWT-rettigheder afspejler det; server-actions bruger DB-opslag og virker straks.
- Status-vokabular: ingen datamigrering nødvendig (læsning er bagudkompatibel). Valgfrit oprydnings-SQL: `UPDATE SourceQA SET status='Besvaret' WHERE status='BESVARET'` m.fl.
- Rate limits, dedupe, login-lockout er **proces-lokale**. I produktion på flere instanser/serverless: implementér `RateLimitStore` mod Redis/Upstash eller Postgres og kald `setRateLimitStore()` ved opstart. Uden det multipliceres grænserne med antal instanser, og tællere nulstilles ved deploy.
- Opret agent-nøgle: `npm run ingest:key -- --domain <by-domæne> --name "<navn>"` (vises én gang).

## 3. Hemmeligheder der bør roteres

- `AUTH_SECRET` i lokal `.env` hvis den er delt/brugt andre steder; sæt en ny unik værdi pr. miljø (`openssl rand -base64 32`).
- Demo-adgangskoden `cms-demo-2026` har været hardkodet i seed + docs: ændr adgangskoden på alle 17 demo-brugere i enhver delt/staging-database (dev.db-hashes er stadig for den gamle kode).
- Gammel Knowledge-API-nøgle i aI-library-historikken (commits 553b2a8, 1ab0bd1) — uændret fund fra review (T9), ikke en del af denne ændring.
- Ingen nøgler er skrevet i kode eller docs; ingest-nøgler lever kun som sha256 i databasen.

## 4. Ikke rettet (og hvorfor)

- Offentlig tilmelding til nyhedsbrev afslører stadig "allerede tilmeldt" (e-mail-enumerering) — kræver double opt-in-flow (bekræftelsesmail), uden for scope.
- Nyhedsbrev/andre offentlige actions mangler captcha; honeypot + rate limit er kun første lag.
- `getAuthorizedUser` er ikke indført i **alle** redaktion-actions (artikler, opgaver, honorar, indbakke, sektioner bruger `auth()` + `can()` + instansId, hvilket er verificeret men JWT-baseret). Kan rulles ud mekanisk.
- Redaktion-sider (page.tsx) viser sig selv ved `session.user`; selve dataadgangen er beskyttet i actions/API, men rolle-baseret sidegating (fx skjule `/redaktion/ingest`) er ikke lavet. Der er heller ikke bygget UI til API-nøgler (kun CLI + server actions).
- `proxy.ts` (cookie-tilstedeværelse, og `/partner/*`-matcheren) er andres ejerskab; min kode antager ikke at proxy beskytter noget.
- Upload: ingen virusscanning; video/lyd valideres kun på signatur (en forged MP4-header med skjult indhold serveres som `.mp4` — kræver `X-Content-Type-Options: nosniff` på `/uploads/*`, se nedenfor). Større filer end ~10 MB kan ikke uploades (Server Actions-loft 12 MB); brug ekstern URL.
- Tracking-ID'er kan ikke fuldt authenticeres (anonym first-party-måling): rate limit/dedupe begrænser, men ikke eliminerer målemanipulation fra mange IP'er.
- `submitMeddelerTip` returnerer ikke længere token til anonyme med eksisterende profil (sikkerhed) — UI viser da en generisk fejl (se anmodninger).

## 5. Anmodninger til andre ejere

- **next.config.ts**: tilføj `headers()` med `X-Content-Type-Options: nosniff` (og gerne `Content-Security-Policy: default-src 'none'; sandbox` + `Content-Disposition` for pdf) på `/uploads/:path*`.
- **proxy.ts** (ejer: links-agent): proxy er kun en bekvemmelighed; `/partner/*` bør fjernes fra matcheren (token-baseret offentlig side, jf. T2 F8).
- **Offentlige formularer** (`SponsorBriefForm`, `QaPortalClient`, `InterviewPortalClient`, `MeddelerPortalClient`, `ThreeStepSubmissionWizard`, `NewsletterSignup`/`NewsletterPageForm`): tilføj skjult honeypot-input `website` (objekt-actions) hhv. `_hp_website` (FormData) — skjult via CSS, `tabIndex=-1`, `autoComplete=off`. Uden dem virker honeypot ikke (rate limit virker).
- **MeddelerPortalClient / Wizard**: håndtér `res.existingProfile === true` (tip er gemt, men token udleveres ikke) med en venlig besked frem for fejl.
- **SiteBlockRenderer/sanitering** (ejer: sanitering): `paragraph.data.content` renderes som HTML — indtags-API'et og indbakke-konverteringen leverer escapet `<p>`, men renderer skal stadig sanitere (defense in depth).
- **Signaler-side/redaktion**: knap "Opret kladde fra signal" (Signal -> Article) i `/redaktion/signaler` (ikke bygget).
- **sitemap/feeds/metadata**: artikler med `indholdstype = AI-assisteret` og status `Idé` er aldrig offentlige; ingen ændring nødvendig, men mærkning (jf. T4) bør også dække `provenance`/`maskinleveret` hvis det vises.
- **Rate limit-store i produktion**: platform/drift skal vælge Redis/Postgres (se afsnit 2).
