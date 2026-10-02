# T5 – Uafhængigt kode- og sikkerhedsreview (branch review-fixes, HEAD 6957bd4)

Metode: ren læsning af koden (ingen kildefiler ændret). Sanitiseren er kørt mod ca. 50 payloads i et throwaway-script i scratchpad. Testene `html-sanitize`, `client-ip`, `origin-lock` og `proxy` er kørt og er grønne (24/24). Alt markeret "uverificeret" er ikke bekræftet i kørende miljø.

Skala: P0 = udnyttelig nu med kritisk effekt. P1 = alvorlig, bør rettes før lancering. P2 = skal rettes, kræver betingelser. P3 = hærdning/lav effekt.

**Ingen P0-fund.** Ingest-API, cron, uploads, SSRF-værn, tenant-isolation i actions og AI-kontrakten holder (se "Verificeret OK").

---

## P1

### P1-1 Sanitiser-bypass: dobbelt entity-dekodning i href — `cms/lib/html-sanitize.ts:27-56`
* Kategori: xss (stored). Verificeret med script.
* Beskrivelse: `safeHref` dekoder entities, tjekker skema på den dekodede værdi og returnerer den dekodede værdi. `escAttr` bevarer derefter alt der ligner en gyldig entity (`&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)`). Browseren dekoder attributten en gang til.
* Bevis (input -> output):
  * `<a href="java&amp;#115;cript:alert(1)">x</a>` -> `<a href="java&#115;cript:alert(1)">x</a>` (browser: `javascript:`)
  * `<a href="javascript&amp;colon;alert(1)">` -> `<a href="javascript&colon;alert(1)">` (browser: `javascript:`)
  * `<a href="&amp;#x6a;avascript:alert(1)">` -> `<a href="&#x6a;avascript:alert(1)">`
  * Alle andre testede varianter (nested `<scr<script>`, svg/math, on*-attributter, `<img onerror>`, unclosed tags, kommentarer, CDATA, noscript/textarea-breakout, `//evil`, `data:`/`vbscript:`) blev neutraliseret korrekt.
* Udnyttelse: en bruger med `article.create` (freelancer) skriver linket i en brødtekst-/manchet-/faktaboks-blok (`normalizeHtml` -> `dangerouslySetInnerHTML` i `components/site/blocks/SiteBlockRenderer.tsx` og `app/(site)/[sektion]/[slug]/page.tsx:525`). En læser eller redaktør der klikker, får udført JS i sidens origin.
* Afbødning i dag: produktions-CSP er håndhævet (`script-src` uden `unsafe-inline`), så `javascript:`-navigation blokeres i moderne browsere. Ikke afbødet når `CSP_REPORT_ONLY=1`, i dev, eller i browsere/værktøjer uden CSP (e-mail-/RSS-visning af brødtekst bruges ikke i dag).
* Fix (minimal): i `escAttr` (til href/cite) escape ALLE `&` til `&amp;` fordi værdien allerede er dekodet; og/eller kør skematjekket på værdien efter gentagen dekodning til fikspunkt. Tilføj regressionstest med ovenstående tre payloads i `tests/html-sanitize.test.ts` (findes ikke i dag).

### P1-2 Redaktionssider uden rettighedstjek viser persondata til enhver login — `cms/app/redaktion/{indbakke,nyhedsbrev,meddeler,qa,interview,sponsor,annoncer,metrikker,omraader}/page.tsx`
* Kategori: authorization (broken access control). Verificeret ved læsning.
* Beskrivelse: siderne bruger kun `auth()` + `instansId`. Layoutet (`app/redaktion/layout.tsx:8-9`) kræver blot en session. Rettigheden `source.viewConfidential` findes men bruges ingen steder (grep).
* Udnyttelse: en bruger med rollen "Medieproducent", "Støtte" eller "Salgs- og partnerskabsansvarlig" kan åbne `/redaktion/indbakke` og se indsenderes navne, e-mail/telefon, tips, kildekontakter (QA/interview), sponsor-kontakter, og `/redaktion/nyhedsbrev` med hele abonnentlisten (e-mail, navn). Eksport-ruten `/api/nyhedsbrev/export` er korrekt rettighedsstyret, men siden viser de samme data. Strider mod governance-reglen "salgsrolle må ikke se kildeoplysninger" (`.agents/skills/lokalt-medieplatform/references/governance.md` §4).
* Fix: brug `getAuthorizedUser(<permission>)` og `redirect`/`notFound` ved nej: indbakke/qa/interview/meddeler -> `ARTICLE_CREATE`; nyhedsbrev -> `NEWSLETTER_MANAGE`; sponsor/annoncer -> `SUPPORT_READ|ADS_MANAGE`; metrikker -> `FRONTPAGE_EDIT|ARTICLE_EDIT_ALL`. Håndhæv `SOURCE_VIEW_CONFIDENTIAL` på kildekontakter.

### P1-3 Anonym maskin-indhold vises offentligt uden redaktørgodkendelse — `cms/components/site/frontpage/data.ts:44-60`, `components/site/frontpage/dynamic.tsx:57-90`
* Kategori: integritet/governance (se også T6). Verificeret.
* Beskrivelse: signaler fra `/api/ingest/signals` (inkl. kildetyperne `politi` og `beredskab_112`) vises på forsiden i modulerne "Fra politiet"/"Fra kommunen" med kun filteret `maskinindsamlet: true`. Der er intet godkendelsesflag. Overskriften er agentens fritekst (kun HTML-strippet). Mærkningen "Maskinindsamlet – ikke redaktionelt vurderet" er til stede, men indholdet er publiceret uden et menneske.
* Udnyttelse: en kompromitteret eller fejlende agentnøgle (`signals:write`) kan få vilkårlig tekst bragt på forsiden under "Fra politiet". Selv uden angreb kan en fejlagtig kommunal-/politimelding gå live uden gennemsyn.
* Fix: kræv `notable`/`godkendt`-flag sat af redaktør før visning (eller et eksplicit "vis maskinsignaler"-valg pr. modul, default fra), og lad aldrig `politi`/`beredskab_112` auto-vises.

---

## P2

### P2-1 Tenant og host udledes af klient-styrbar `X-Forwarded-Host` — `cms/lib/site.ts:104,163`, `lib/seo/host.ts:33`, `lib/http.ts:48`, `app/api/site/switch/route.ts:25`, `proxy.ts:190`
* Kategori: cache poisoning / tenant confusion. Uverificeret i kørende miljø.
* Beskrivelse: `getCurrentSite()` foretrækker `x-forwarded-host` frem for `host`. Proxy sætter `Cache-Control: public, s-maxage=60` + `Vary: Host` (ikke `X-Forwarded-Host`) på anonym HTML, API og OG-billeder (`OG_IMMUTABLE_CACHE` 1 år med `?v=`).
* Udnyttelse (hvis kanten ikke overskriver headeren): angriber sender `GET https://slagelselokalt.dk/` med `X-Forwarded-Host: naestvedlokalt.dk`. Origin renderer Næstved-indhold; en CDN der nøgler på URL cacher det under Slagelses URL i 60 s. Samme for `/og/artikel/<slug>.jpg?v=1` (cachet 404 i 5 min / forkert billede). Direkte data-læk er ikke mulig (kun offentligt indhold), men indhold forveksles og canonical/OG bliver forkert. Ukendt host i produktion giver 404 (cachebart).
* Fix: brug kun `Host` (Cloudflare bevarer den), eller kun `x-forwarded-host` hvis den findes i en allowlist af kendte domæner; sæt `Vary: Host, X-Forwarded-Host`; verificér hvad Railways edge gør med headeren.

### P2-2 Origin-lås er valgfri, og `TRUST_CLOUDFLARE` har ingen sikkerhedsnet — `cms/lib/env.ts:32-47`, `lib/client-ip.ts:102-105`, `lib/origin-lock.ts:40-41`
* Kategori: bypass af rate limit/ban/lockout.
* Beskrivelse: `ORIGIN_SECRET` er ikke i `productionSchema` og giver ingen advarsel. Er `TRUST_CLOUDFLARE=1` sat uden aktiv origin-lås, kan enhver der rammer Railway-origin direkte forfalske `CF-Connecting-IP` + `CF-Ray`.
* Udnyttelse: roterer "klient-IP" pr. request og omgår login-lockout (5 pr. e-mail er stadig bundet til e-mail, men IP-grænsen på 20 og alle sidegrænser falder), `ingest-authfail`, tracking-dedupe og botbans; eller forfalsker et offers IP og udløser strikes/ban mod dem (`lib/bot/ban.ts`).
* Fix: i `checkEnv` – fejl/warning hvis `TRUST_CLOUDFLARE` er sat uden `ORIGIN_SECRET` i produktion; advar også når `ORIGIN_SECRET` mangler. Dokumentér korrekt `TRUSTED_PROXY_HOPS` (Cloudflare + Railway = 2) – standard 1 giver delt bucket pr. Cloudflare-PoP, hvis `TRUST_CLOUDFLARE` ikke er sat.

### P2-3 Server actions bruger JWT-rettigheder (forældede) i stedet for databaseopslag — `cms/app/redaktion/artikler/actions.ts:37,189,209,267`, `honorar/actions.ts:9`, `opgaver/actions.ts`, `sektioner/actions.ts`, `indbakke/actions.ts`, `forside/actions.ts:10,66`
* Kategori: sessionshåndtering/privilegie-eskalering. Verificeret.
* Beskrivelse: `getAuthorizedUser()` (DB-opslag) findes og bruges af forsideeditoren, medier, ingest, nyhedsbrev m.fl., men artikel-, honorar-, opgave-, sektion-, indbakke- og gamle forside-actions bruger `auth()` og læser `session.user.permissions` fra JWT'en. Sessionen har ingen eksplicit `maxAge` (Auth.js-standard 30 dage).
* Udnyttelse: en fyret bruger eller en nedgraderet rolle kan fortsat gemme/publicere artikler, godkende honorar og ændre sektioner i op til 30 dage (JWT'en slettes ikke). Slettet bruger: handlingen fejler først ved FK-fejl, ikke ved auth.
* Fix: skift til `getAuthorizedUser(perm)` i alle actions; sæt `session.maxAge` (fx 8-12 t) og `updateAge`.

### P2-4 Enhver forfatter kan sætte `pinned`/`breaking` — `cms/app/redaktion/artikler/actions.ts:134-135`
* Kategori: mass assignment/privilegie-omgåelse. Verificeret.
* Beskrivelse: `saveArticle` skriver `pinned` og `breaking` fra formularen for alle med `ARTICLE_CREATE`; `toggleArticleFlag` kræver derimod `FRONTPAGE_EDIT`. I `lib/frontpage/compose.ts:173-186` tvinges en frisk breaking-artikel af typen "Uafhængig" ind i hero.
* Udnyttelse: en freelancer afkrydser "breaking" på sit udkast; når en redaktør blot publicerer, ligger artiklen i hero uden forsideredaktørens beslutning.
* Fix: ignorér `pinned`/`breaking` i `saveArticle` medmindre brugeren har `FRONTPAGE_EDIT` (behold eksisterende værdi).

### P2-5 Rettelser kan slettes hårdt af enhver forfatter, uden spor — `artikler/actions.ts:263-296`, `prisma/schema.prisma:431-443`
* Kategori: authorization/integritet. Verificeret.
* Beskrivelse: `deleteArticleCorrection` kræver kun `ARTICLE_CREATE` og tenant; den tjekker ikke `canEditArticle`, sletter fysisk og modellen har ingen `createdBy`/versionslog. `dato` kan bagdateres frit i `addArticleCorrection:232-239`. Fejlbeskeder returnerer rå `err.message`.
* Konsekvens: den offentlige rettelseslog (Pressenævnet-relevant) kan ændres uden revisionsspor.
* Fix: kræv `ARTICLE_PUBLISH` eller `ARTICLE_EDIT_ALL` til sletning, soft delete (`fjernetAf`, `fjernetTid`), gem `oprettetAf`, og returnér generisk fejltekst.

### P2-6 Case-sensitive søgning i produktion (SQLite/Postgres-drift) — `cms/lib/site-queries.ts:752-753`, `app/redaktion/{artikler,emner,medier,opgaver}/page.tsx`
* Kategori: dual-schema-drift. Verificeret ved kodelæsning (ikke kørt mod Postgres).
* Beskrivelse: `contains` uden `mode: "insensitive"` er case-insensitiv i SQLite men case-sensitiv i PostgreSQL. Søgning efter "slagelse" finder ikke "Slagelse" i produktion.
* Fix: tilføj `mode: "insensitive"` (virker kun på Postgres; guard efter provider) eller normalisér til en søgekolonne. Genereret schema er ellers i sync (`scripts/gen-pg-schema.ts --check` OK).

### P2-7 Rolle-/navnebaseret AI-spærring kan omgås — `artikler/actions.ts:104-109`, `lib/marking.ts:101-106`
* Kategori: governance-håndhævelse (se T6). Verificeret.
* Beskrivelse: editoren tjekker kun selve kategorien (ikke forælder, som ingest gør), kun når `indholdstype === "AI-assisteret"`, og matcher på slug/navn. Omdøbning af en kategori (`sektioner/actions.ts`, krav `FRONTPAGE_EDIT`/`EDIT_ALL`) eller registrering som "Uafhængig" med `aiBrug=["Udkast"]` omgår spærringen.
* Fix: tjek også `category.parent`; knyt spærringen til et eksplicit `aiForbudt`-flag på Category; blokér `aiBrug` ∈ {Udkast, Omskrivning} i spærrede kategorier uanset indholdstype.

---

## P3

* P3-1 `forside/actions.ts:9-63` (`pinArticleToZoneAction`): `zone` er ufiltreret streng, `durationHours<=0` giver pin uden udløb, ingen `status: "Publiceret"`-tjek, kvotetjek udelader `PR` (modsat `editor-actions.ts:applyPinsAction` og `COMMERCIAL_TYPES`). Render-lagets guardrails fanger status/kvote, men fix inputtet.
* P3-2 `lib/frontpage-governance.ts:38-42` tæller ikke `PR` som støttefinansieret, mens forsidens loft (`types.ts:31`) gør; to definitioner af "kommercielt".
* P3-3 `app/actions/meddeler.ts:32`: "Der findes allerede en profil med denne e-mailadresse" afslører e-mail-eksistens (enumerering). Neutralt svar anbefales.
* P3-4 Ældre `cuid`-tokens accepteres (`lib/validation/tokens.ts:24-26`); cuid v1 er delvist forudsigelig. Rotér seed-/legacy-tokens til `generateToken()`.
* P3-5 Metrics/ads/frontpage-tracking dedupes på hash(IP+UA) og kan pustes af en angriber med mange IP'er; `visninger`/`laesninger` indgår i score og AI-input (`ai-ranker.ts:108-118`). Lav effekt, ranker-forslag skal alligevel godkendes.
* P3-6 `app/api/chat/route.ts` har cookie-auth uden Origin-tjek og accepterer `text/plain`-JSON; sikret af `SameSite=Lax` på Auth.js-cookien. Tilføj `isSameOrigin()` som forsvar i dybden.
* P3-7 `lib/seo/og.tsx:104-111`: lokale cover-URL'er `/uploads/<uuid>` læses fra `public/`, men produktionsuploads ligger i `UPLOAD_DIR`; OG falder tilbage til genereret kort (funktionel fejl, ingen sikkerhedseffekt). Brug `findUpload`.
* P3-8 `lib/upload.ts:44-47`: PDF-skanning af `/JavaScript` omgås med hex-escapede navne (`/#4aavaScript`); serveres dog med `default-src 'none'`. Acceptabelt, dokumentér.
* P3-9 Turnstile er stille no-op uden `TURNSTILE_SECRET_KEY` i produktion (`lib/turnstile.ts:33`); tilføj advarsel i `checkEnv`. Login-lockout pr. e-mail kan misbruges til at låse en bestemt redaktør ude (5 forsøg/15 min).
* P3-10 `app/(site)/nyhedsbrev/page.tsx:25`: `?besked=` vises uverificeret (React-escaped; kun indholdsforfalskning). Brug kodet fejlkode i stedet for tekst.
* P3-11 Ingen `X-Frame`/CSP-problemer fundet; `style-src 'unsafe-inline'` er bevidst (dokumenteret).
* P3-12 `.agents/skills/lokalt-medieplatform/SKILL.md:68` indeholder stadig den gamle demo-adgangskode `cms-demo-2026` (seed bruger nu tilfældig kode; `FIX-sikkerhed-api.md:35` nævner at gamle hashes i dev.db skal skiftes). Fjern fra dokumentet.

---

## Verificeret OK (læst og vurderet)

* Ingest (`lib/ingest/**`, `app/api/ingest/**`): nøgler 256 bit, kun sha256 gemmes, konstant-tids sammenligning, instans bundet til nøglen (klient kan ikke vælge), scopes, rate limit fail-closed, `assertNoStatusOverride` + `.strict()`. Ingen kodesti til `Publiceret`; status altid første workflow-tilstand; `godkendtAf` tomt så `assertPublishableMarking` blokerer; citater kræver `kildeUrl`+`dato`; politi/112-kilder og Krimi/Sundhed (inkl. forælder) spærret; tekst går via `textToParagraphHtml` (escaped); idempotens på `externalId`.
* AI-ranker og NL-parser: kandidattekst sendes som `JSON.stringify` (kan ikke bryde JSON-strukturen), systemprompt instruerer ignorér-instruktioner, output valideres strengt (zod `.strict()`, hvidlistede operationer, `articleId` mod kendte ids, >30 % ugyldige = afvist), og `enforceGuardrails` kører igen ved forslag, redigering og godkendelse. NL-parseren får redaktørens tekst (≤500 tegn) og kandidat-titler; der findes ingen operation til publicering, mærkning, kvoteloft eller indhold. Titel-/manchet-injektion kan højst påvirke rangering/forslag, som en redaktør skal godkende (`approveSnapshot` kræver `FRONTPAGE_SNAPSHOT_APPROVE`). Cron opretter kun `forslag`. Signaler er ikke kandidater til AI'en.
* Tenant-isolation: alle forsideservices og redaktionsactions filtrerer på `instansId` fra bruger/nøgle; fremmed id giver "findes ikke". `loadCandidates` kræver `Publiceret` og `publiceretTid <= nu`.
* `proxy.ts`: origin-lås konstant-tids, undtagelser kun health/ready/cron; `x-origin-secret` og `x-nonce` fjernes fra videresendte headers; nonce pr. request; sti-normalisering (`%2e%2e`, `%00`, `..`) afvises; ingen åben redirect (`callbackUrl` er altid egen sti, login-siden validerer `/`-start, ikke `//`, ikke `\`); `/api/site/switch` bruger hvidliste.
* `client-ip.ts`: højre-til-venstre XFF, IPv6 /64, ugyldige værdier -> "unknown". Rate-limit-nøgler er `bucket:key`; Redis-nøgler >180 tegn hashes; fail-open/closed er konsekvent (login, ingest, token-actions lukker).
* Cache-politik: ingen caching med session-/authorization, aldrig `/redaktion`, `/api`, token-sider, `/uploads`; personaliserede sider (`/gemte`, `/profil`) er ekskluderet.
* Uploads: magic bytes, afvisning af aktivt indhold, billeder gen-kodet via sharp (EXIF/polyglot væk), uuid-filnavn med fast endelse, `wx`-skrivning, strikt navne-regex ved servering, `nosniff` + CSP `default-src 'none'; sandbox`, Range korrekt.
* SSRF: OG-hentning kun for `SEO_OG_REMOTE_HOSTS`-allowlist, `redirect: "error"`, type- og størrelsesgrænse; lokal sti kontrolleret mod `public/`. Ingen anden `fetch` af brugerleverede URL'er (kun Turnstile, Cloudflare-purge, Anthropic).
* Ingen `$queryRaw`/`$executeRaw` med brugerinput (kun `SELECT 1`), ingen `child_process` i app-kode, ingen `eval`.
* CSV-eksporter har formel-injektionsbeskyttelse og rettighedstjek; honorar-eksport `HONORAR_VIEW`.
* RSS/sitemap: `escapeXml`, `]]>`-sikker CDATA; JSON-LD escaper `<`, `>`, U+2028/2029.
* Hemmeligheder: ingen hardkodede nøgler i kode; `seed.ts` kræver ikke-produktion og genererer tilfældig adgangskode; `seed-prod.ts` genererer engangskode; `.env` er ikke committet; `scripts/check-secrets.ts` findes. Env-fejl logger kun variabelnavne.
* Offentlige actions: honeypot + rate limit + Turnstile (hvis aktiveret) + zod + `cleanText`; token-actions slår op på token og kontrollerer ejerskab (`sag.meddelerId === profile.id`); `registerMeddeler` udleverer aldrig eksisterende tokens.
* Server actions er beskyttet af Next.js' indbyggede Origin/Host-kontrol; `isSameOrigin` på tracking er korrekt som første filter.
* Dobbelt Prisma-skema: `prisma/postgres/schema.prisma` er i sync (`gen-pg-schema --check`), migrationslås og `.last-migrated-schema.txt` findes.

## Testhuller (anbefalede nye tests)

1. `html-sanitize`: entity-kodede skemaer (`&amp;#115;`, `&amp;colon;`, `&amp;#x6a;`) — fanger P1-1 (nuværende test dækker kun enkelt-dekodede varianter).
2. Rettighedstest pr. redaktionsside (P1-2) og pr. action med slettet/nedgraderet bruger (P2-3).
3. `saveArticle`: `pinned`/`breaking` uden `FRONTPAGE_EDIT`; AI-assisteret i barn af Krimi; `aiBrug` uden "Ingen"-valg; slet rettelse som fremmed forfatter.
4. `getCurrentSite`: `x-forwarded-host` ≠ `host` i produktion (forventet adfærd defineres).
5. `checkEnv`: `TRUST_CLOUDFLARE` uden `ORIGIN_SECRET`.
6. Signal-visning: signal uden godkendelse må ikke renderes (P1-3).
7. Postgres-integrationstest af søgning (case) og af migration mod ægte Postgres i CI (kun SQLite testes i dag).
8. Ingen e2e dækker redaktionens rollebaserede adgang.
