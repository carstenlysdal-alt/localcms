# Railway-opsætning (lysdalcms)

Mål: CMS'et kører som ét Railway-service `lysdalcms` i projektet **Lysdal-local-cms** (miljø `production`) sammen med de eksisterende services **Postgres** og **Redis**. Dev forbliver SQLite; produktion kører på et afledt PostgreSQL-skema (`cms/prisma/postgres/`).

## 0. Sådan hænger det sammen

| Miljø | Skema | Klient genereres af | DB |
|---|---|---|---|
| dev/test | `prisma/schema.prisma` (SQLite) | `postinstall` (`prisma generate`) | `prisma/dev.db` |
| Railway | `prisma/postgres/schema.prisma` (**afledt**, må ikke redigeres) | `npm run build:railway` | Railway Postgres |

- `prisma/schema.prisma` er eneste kilde. Efter ændringer i den: `npm run prisma:pg:migration -- <navn>` (genererer pg-skemaet og en ny migration uden database) og commit begge dele. `npm run prisma:pg:check` / `npm test` fejler, hvis pg-skema eller migration mangler.
- **Gennemlæs altid den genererede `migration.sql`** (omdøbning af felter bliver til DROP + ADD = datatab). Større ændringer: ekspansion først (tilføj), kode, så oprydning (fjern) i en senere migration — så kan et rollback af koden køre mod den nye database.
- `railway.json` (i `cms/`): build `npm run build:railway` (genererer pg-skema, pg-klient, `next build`); start `npm run start:railway` (`prisma migrate deploy` og derefter `next start -H 0.0.0.0 -p $PORT`); healthcheck `/api/ready` (120 s), `ON_FAILURE` med 5 genstarter, 1 replika.
- `instrumentation.ts` validerer miljøet ved opstart: i produktion **stopper serveren** med en liste over manglende variabel-NAVNE (aldrig værdier). Se logs, hvis deploy fejler på healthcheck.

## 1. Opret servicen fra GitHub

1. Railway -> projektet **Lysdal-local-cms** -> *New* -> *GitHub Repo* -> vælg repoet.
2. *Settings* -> **Root Directory**: `cms`. **Branch**: `main` (eller den branch der skal i produktion; `review-fixes` indtil den er merget).
3. *Settings* -> navngiv servicen **`lysdalcms`** (navnet indgår i variabel-referencer og det private domæne `lysdalcms.railway.internal`).
4. Tjek at Railway har fundet `cms/railway.json` (deploy-fanen skal vise healthcheck-sti `/api/ready`). Hvis ikke: *Settings -> Config-as-code -> Railway Config File* = `/cms/railway.json`.
5. Sæt variablerne i afsnit 2 **før** første deploy (ellers fejler opstarten bevidst).
6. *Settings -> Build*: sæt IKKE `NODE_ENV=production` som service-variabel (det udelader devDependencies under `npm ci`, og `next build` har brug for Tailwind/TypeScript). Railway sætter selv produktion ved kørsel.

## 2. Variabler

**Referencer (sæt som variabel-reference, ikke som kopieret værdi):**

| Variabel | Værdi |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (privat netværk) |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |

**Skal sættes i hånden af ejeren** (generér hemmeligheder med `openssl rand -base64 48`; brug forskellige værdier pr. miljø; skriv dem aldrig i git/chat):

| Variabel | Påkrævet | Indhold |
|---|---|---|
| `AUTH_SECRET` | ja (>= 32 tegn) | `openssl rand -base64 48` |
| `CRON_SECRET` | ja (>= 16 tegn) | `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | ja | primær offentlig URL, fx `https://slagelselokalt.dk` (indbages i klientkode ved build: sæt den før deploy) |
| `AUTH_TRUST_HOST` | ja i praksis | `true` (Auth.js bag Railways proxy og flere domæner; uden den fejler login med UntrustedHost) |
| `PORT` | anbefalet | `3000` (så Cron-servicen kan referere `${{lysdalcms.PORT}}`) |
| `ADMIN_EMAIL` | til `seed:prod` | den første administrators e-mail (valgfrit `ADMIN_NAME`, `ADMIN_INSTANCE_DOMAIN`) |
| `ANTHROPIC_API_KEY` | valgfri | Anthropic som AI-udbyder (alternativ til DeepSeek). Uden nogen AI-nøgle: deterministisk fallback / 503 på /api/chat |
| `AI_PROVIDER`, `EDITOR_AI_PROVIDER`, `CHAT_AI_PROVIDER`, `FRONTPAGE_AI_PROVIDER` | valgfri | `deepseek` eller `anthropic`. Uden: DeepSeek hvis `DEEPSEEK_API_KEY` er sat, ellers Anthropic hvis `ANTHROPIC_API_KEY` er sat. Pr.-opgave-variablen overstyrer `AI_PROVIDER` |
| `DEEPSEEK_API_KEY` | valgfri | AI-operatøren bruger DeepSeek når den er sat (se afsnit 12; sættes fra egen terminal, aldrig i chat/git). Persondata maskeres før de sendes |
| `OPERATOR_PROVIDER` | valgfri | `deepseek` eller `anthropic`: eksplicit valg til AI-operatøren. Uden den: DeepSeek hvis `DEEPSEEK_API_KEY` er sat, ellers Anthropic |
| `DEEPSEEK_MODEL` / `DEEPSEEK_BASE_URL` | valgfri | defaults `deepseek-chat` og `https://api.deepseek.com` |
| `SEO_SITE_CONFIG` | valgfri | JSON pr. domæne (sameAs, logo, adresse m.m.; se `lib/seo/config.ts`) |
| `UPLOAD_DIR` | ved volume | `/data/uploads` (se afsnit 5) |
| `FALLBACK_SITE_DOMAIN` | kun test/staging | `slagelselokalt.dk` — lader et ukendt domæne (fx `*.up.railway.app`) vise den by. **Fjern i produktion**, ellers viser alle ukendte værter Slagelse (duplicate content). |
| `DATABASE_POOL_SIZE` | valgfri | forbindelser i Prisma-puljen (default 10) |

Alt andet fra `cms/.env.example` er valgfrit. `REDIS_URL` mangler -> kun advarsel (rate limits og login-lockout er så proces-lokale).

## 3. Domæner (ét pr. by)

Servicen vælger by ud fra `Host` (`getCurrentSite()`); ukendt vært giver 404. For hver by (`slagelselokalt.dk`, `naestvedlokalt.dk`, `holbaeklokalt.dk`, `koegelokalt.dk`, `roskildelokalt.dk`, `ringstedlokalt.dk`):

1. `lysdalcms` -> *Settings -> Networking -> Custom Domain* -> tilføj apex-domænet **og** `www.`-varianten (appen 308-omdirigerer `www.` til apex).
2. Opret DNS-posterne Railway viser (CNAME til `<id>.up.railway.app`, evt. TXT `_railway-verify`). Apex kræver CNAME-flattening/ALIAS (Cloudflare gør det).
3. Cloudflare foran (proxied, SSL *Full (strict)*) jf. T13 — Railway har ingen WAF for brugerdomæner.
4. Tjek planens grænse for antal custom domains pr. service (12 hostnames i alt), før du går i gang.
5. Efter DNS er live: fjern `FALLBACK_SITE_DOMAIN`, og tjek at `https://<by>/api/ready` giver 200 og at forsiden viser den rigtige by.

## 4. Cron: forsidens AI-forslag

`/api/cron/frontpage-rank` kræver `Authorization: Bearer $CRON_SECRET` og opretter kun FORSLAG (publicerer aldrig). Kald den fra en separat Railway-service over det private netværk (ingen offentlig trafik):

1. *New -> Empty Service* (eller Docker Image `curlimages/curl`), navn `cron-frontpage`.
2. Variabler: `CRON_SECRET=${{lysdalcms.CRON_SECRET}}`, `APP_PORT=${{lysdalcms.PORT}}`.
3. *Settings -> Deploy -> Custom Start Command*:
   `sh -c 'curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "http://lysdalcms.railway.internal:$APP_PORT/api/cron/frontpage-rank"'`
4. *Settings -> Cron Schedule*: fx `0 */3 * * *` (UTC; hver 3. time). Servicen starter, kalder ruten og afslutter; en kørsel der ikke afslutter blokerer næste.
5. Valgfrit: `?instans=<id>` for én by, `?ai=0` for kun deterministisk forslag. Ruten tillader 6 kørsler/min i alt.
6. Test manuelt: `railway run -s cron-frontpage -- sh -c 'echo "$CRON_SECRET" | wc -c'` viser kun længden; selve kaldet ses i servicens logs.

### 4b. Cron: planlagt publicering (`/api/cron/publish-scheduled`)

Ruten flytter artikler i status **Planlagt** med `planlagtTid <= nu` til **Publiceret** (revision med actor `scheduler`, `publiceretTid`, CDN-purge). Den rører aldrig andre statusser, er idempotent (betinget opdatering) og kører i små batches (standard 20, `?batch=<n>` op til 100). Artikler der ikke opfylder publiceringskravene (mærkning, AI-brug registreret, kilde verificeret) springes over og forbliver Planlagt — de rapporteres i svaret (`skipped`).

**Status: slået fra, indtil servicen nedenfor oprettes.** Uden en cron-service publiceres planlagte artikler ikke af sig selv (redaktøren kan stadig publicere manuelt).

1. *New -> Empty Service* (eller Docker Image `curlimages/curl`), navn `cron-publish`.
2. Variabler: `CRON_SECRET=${{lysdalcms.CRON_SECRET}}`, `APP_PORT=${{lysdalcms.PORT}}` (samme hemmelighed som `cron-frontpage`; min. 16 tegn — ellers svarer ruten 503).
3. *Settings -> Deploy -> Custom Start Command*:
   `sh -c 'curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "http://lysdalcms.railway.internal:$APP_PORT/api/cron/publish-scheduled"'`
4. *Settings -> Cron Schedule*: `*/5 * * * *` (UTC; hvert 5. minut). Ruten tillader 30 kørsler/min i alt og 20 mislykkede auth-forsøg/min pr. IP.
5. Valgfrit: `?instans=<id>` for én by. Svaret er `{ ok, checked, published:[{id,instansId,slug}], skipped:[{id,instansId,reason}] }`.
6. Efter deploy: kør `npm run roles:sync` (eller `railway run -s lysdalcms npm run roles:sync`) så den nye rettighed `article.ai.use` når eksisterende roller.

## 5. Uploads (Railway Volume)

Filsystemet er flygtigt: `public/uploads` forsvinder ved redeploy. Brug en Volume:

1. `lysdalcms` -> *Settings -> Volumes* (eller `Ctrl+K` -> *Volume*) -> *Add Volume*, mount path `/data`. Railway sætter `RAILWAY_VOLUME_MOUNT_PATH=/data` automatisk.
2. Sæt `UPLOAD_DIR=/data/uploads` (eller lad adapteren bruge `$RAILWAY_VOLUME_MOUNT_PATH/uploads`). Alternativt `UPLOAD_STORAGE=volume`.
3. `lib/media-storage.ts` skriver filen som `<uuid>.<ext>`; den serves af `/uploads/<fil>` (`app/uploads/[name]/route.ts`) med korrekt Content-Type, `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, 1 års immutable cache, ETag/304 og Range.
4. Begrænsninger: en Volume kan kun monteres på **én** replika (derfor `numReplicas: 1`), og deploys har en kort nedetid, fordi den gamle instans skal slippe volumen. Får processen `EACCES` på volumen, sæt `RAILWAY_RUN_UID=0`.
5. Backup: filer på volumen er ikke i `pg_dump`. Brug Railways volume-backups (Backups-fanen, planafhængigt) eller kopiér periodisk.
6. **S3-kompatibel bucket er ikke implementeret** (ingen S3-SDK i dependencies). Opfølgning: tilføj en `s3`-driver i `lib/media-storage.ts` (`saveUpload`/`findUpload`) og redirect `/uploads/*` til bucketens CDN-URL; så kan `numReplicas` > 1.

## 6. Første deploy — tjekliste

1. [ ] Variabler fra afsnit 2 er sat (inkl. `AUTH_TRUST_HOST=true`, `ADMIN_EMAIL`, og midlertidigt `FALLBACK_SITE_DOMAIN=slagelselokalt.dk`).
2. [ ] Volume monteret (afsnit 5), `UPLOAD_DIR` sat.
3. [ ] Deploy. Build-loggen skal vise `prisma generate --schema prisma/postgres/schema.prisma`; start-loggen `prisma migrate deploy` (1 migration anvendt) og derefter Next.js. Healthcheck `/api/ready` skal blive grøn.
4. [ ] Hvis deploy fejler: læs `[env] FEJL: Manglende miljøvariabler: …` i logs (kun navne).
5. [ ] Opret instanser, roller og første admin (kun første gang; idempotent):
   `railway ssh -s lysdalcms` og derefter i containeren `npm run seed:prod -- --force`.
   Den printer en **engangs-adgangskode én gang** (gem i password manager; skift ved første login). Findes brugeren allerede, printes intet. (Seed kan ikke køres fra din Mac: den lokale Prisma-klient er til SQLite, og `*.railway.internal` kan ikke nås udefra.)
6. [ ] Test via servicens `*.up.railway.app`-domæne: `/api/health` (200), `/api/ready` (200, `{"status":"ready"}`), `/login`, `/redaktion` efter login.
7. [ ] Opret sektioner/områder pr. by i `/redaktion` (seed:prod opretter ikke kategorier eller demo-indhold) og upload et testbillede -> genstart/redeploy -> billedet er der stadig (volume).
8. [ ] Opret agent-nøgler: `npm run ingest:key -- --domain <by> --name "<navn>"` (via `railway ssh`).
9. [ ] Tilføj domæner (afsnit 3), fjern `FALLBACK_SITE_DOMAIN`, opret Cron-servicen (afsnit 4).
10. [ ] Uptime-monitor på `https://<by>/api/ready` pr. by; Cloudflare-regler jf. `docs/review/00-plan.md` T13.

## 7. Rollback

- **Kode:** *Deployments* -> vælg et tidligere vellykket deploy -> *Rollback* (genbruger det byggede image, ingen ny build). Healthcheck gælder også her.
- **Database:** migrationer er kun fremadrettede. Rollback af koden virker kun, hvis seneste migration var additiv. Tag `pg_dump` (afsnit 8) **før** hver deploy med skemaændring; ved en dårlig migration: gendan dumpen i en ny database, peg `DATABASE_URL` dertil, eller skriv en rettende migration frem for at redigere en anvendt.
- Anvendte migrationer må aldrig redigeres eller omdøbes (`_prisma_migrations` checksum).

## 8. Backup og gendannelse (pg_dump via `railway run`)

`railway run` kører en lokal kommando med servicens variabler. Postgres' `DATABASE_URL` peger på det private netværk, som ikke kan nås fra din maskine; brug derfor `DATABASE_PUBLIC_URL` (TCP-proxy; udgående trafik kan koste). `pg_dump` skal være mindst samme hovedversion som serveren.

```bash
cd cms    # linket til projektet (railway link)
# backup (custom format, komprimeret)
railway run -s Postgres -- sh -c 'pg_dump -Fc --no-owner "$DATABASE_PUBLIC_URL" > "backup-$(date +%F).dump"'
# gendan (på en TOM database, helst staging først)
railway run -s Postgres -- sh -c 'pg_restore --no-owner --clean --if-exists -d "$DATABASE_PUBLIC_URL" backup-2026-10-01.dump'
```

- Gem dumps krypteret uden for repoet; de indeholder persondata (abonnenter, indsendelser) og password-hashes.
- Test gendannelsen mindst én gang i staging, og gentag kvartalsvis. Aktivér desuden Railways egne Postgres-backups (volume Backups-fanen), hvis planen tillader det.
- Efter gendannelse: `prisma migrate status --schema prisma/postgres/schema.prisma` (via `railway ssh`) skal vise at alt er anvendt.

## 9. Staging

- Opret et **separat miljø** `staging` i samme projekt (*Environments -> New Environment -> Duplicate*): egen Postgres, Redis og egen `lysdalcms` med **egne** hemmeligheder (`AUTH_SECRET`, `CRON_SECRET`; genbrug aldrig produktionens) og aldrig en kopi af produktionens database med persondata uden anonymisering.
- Peg staging-servicen på en `staging`-branch; produktion på `main`. Merge staging -> main efter test.
- Brug servicens `*.up.railway.app`-domæne + `FALLBACK_SITE_DOMAIN` (kun i staging), eller egne `*.staging.<domæne>`. Hold staging ude af søgemaskiner (Cloudflare Access eller IP-begrænsning; appen har ingen miljø-afhængig noindex endnu).
- Test migrationer her først: `railway run`/dump fra produktion (anonymiseret) og gendan i staging, kør deploy, tjek `migrate status`.
- `ANTHROPIC_API_KEY` i staging: brug en nøgle med lavt forbrugsloft.

## 10. Omkostninger (overslag — tjek Railways aktuelle priser)

- Railway afregner efter forbrug (CPU, RAM, volumen, udgående trafik) oven på planens grundpris. Services: `lysdalcms` (Next.js; typisk 0,5–1 GB RAM, billedbehandling med sharp kan spidse), Postgres, Redis, Cron (afslutter hurtigt = næsten gratis), Volume (pr. GB-måned).
- Trafikken til borgerne bør tages af Cloudflare-cache (anonym HTML, feeds, sitemaps, OG-billeder) — det er både DDoS-værn og den vigtigste omkostningsreduktion.
- Staging-miljøet fordobler grundforbruget; sæt det i dvale/slet det, når det ikke bruges.
- `DATABASE_PUBLIC_URL` (TCP-proxy) giver egress-omkostning ved dumps; brug den kun til drift.
- Anthropic-omkostninger er separate og styres af `ANTHROPIC_API_KEY` (sæt forbrugsloft hos Anthropic). AI-operatøren (`/api/operator`) kan lave op til 9 modelkald pr. besked; ratelimit er 30 beskeder pr. 10 min pr. bruger.
- **Efter deploy af AI-operatøren:** kør `railway ssh -s lysdalcms` og `npm run roles:sync` én gang, så rollerne Ansvarshavende redaktør og Redaktionsleder får rettigheden `operator.use` (uden den ser ingen operatøren; ingen nye miljøvariabler). Migrationen `operator_log` (tabellen `OperatorAction`) køres automatisk af `start:railway`.

## 11. Mistet adgangskode og brugere

- Almindeligt skift: log ind og brug `/redaktion/konto` ("Min konto"). Kræver mindst 12 tegn; andre sessioner logges ud.
- En administrator med `users.manage` kan oprette brugere og nulstille andres adgangskode i `/redaktion/brugere` (engangsadgangskode vises én gang og skal ændres ved første login).
- Ingen administrator kan logge ind (nødudgang) — nulstil via terminal. Scriptet kræver en registreret SSH-nøgle (`railway ssh keys add`; første gang skal serverens fingeraftryk bekræftes med `yes`):
  ```bash
  railway ssh --project <projekt-id> --environment production --service lysdalcms -- npm run user:reset-password -- --email <admin-e-mail> --force
  ```
  Scriptet udskriver en ny midlertidig adgangskode **én gang**, sætter `mustChangePassword=true` og logger handlingen i `AuditLog`. Gem adgangskoden med det samme i en adgangskodemanager. Omdirigér ikke output til en delt placering.
- Efter nulstilling vælger brugeren selv en adgangskode i `/redaktion/konto`; gamle sessioner er ugyldige.
- Lockout: 5 forkerte nuværende adgangskoder pr. 15 minutter pr. bruger; udløber automatisk.
- Kør ikke `seed:prod` igen for at få en ny adgangskode: den udskriver kun en adgangskode, når admin-brugeren oprettes første gang.

## 12. AI-operatørens modeludbyder (DeepSeek eller Anthropic)

AI-operatøren (`/redaktion/operator`, Cmd/Ctrl+K) kan bruge **DeepSeek** eller **Anthropic**. Al øvrig AI (editorens forslag, AI-dock-chatten og forsidens AI-forslag) går gennem den fælles gateway (`lib/ai/provider`) og vælger udbyder efter samme regel: DeepSeek hvis `DEEPSEEK_API_KEY` er sat, ellers Anthropic; hver opgave kan overstyres med `EDITOR_AI_PROVIDER`/`CHAT_AI_PROVIDER`/`FRONTPAGE_AI_PROVIDER`. Beslutning og GDPR-vurdering: `docs/localrating/adr/ADR-017.md`.

**Valg af udbyder** (alt er Railway-variabler; ingen nøgler i databasen):

| Situation | Resultat |
|---|---|
| `OPERATOR_PROVIDER=deepseek` | DeepSeek (kræver `DEEPSEEK_API_KEY`, ellers 503 — der falder aldrig stille tilbage til Anthropic) |
| `OPERATOR_PROVIDER=anthropic` | Anthropic (kræver `ANTHROPIC_API_KEY`) |
| ikke sat, `DEEPSEEK_API_KEY` sat | DeepSeek |
| ikke sat, kun `ANTHROPIC_API_KEY` sat | Anthropic |
| ingen nøgle | `/api/operator` svarer 503 med besked om begge variabler |

**Sæt nøglen uden at den vises i chat eller historik** (kør i din egen terminal i det linkede Railway-projekt; scriptet læser nøglen skjult og sender den via stdin, så den ikke står i kommandolinjen):

```bash
# zsh (macOS): beskeden "DeepSeek-nøgle:" vises, indtastningen vises ikke
read -rs "DEEPSEEK_KEY?DeepSeek-nøgle: "; echo
printf %s "$DEEPSEEK_KEY" | railway variable set DEEPSEEK_API_KEY --stdin --service lysdalcms --environment production
unset DEEPSEEK_KEY
```

Valgfrit (ikke hemmeligt): `railway variable set DEEPSEEK_MODEL=deepseek-chat --service lysdalcms --environment production`. Railway genudruller servicen, når en variabel ændres; tilføj `--skip-deploys`, hvis du vil samle flere ændringer. Tilbage til Claude: `railway variable set OPERATOR_PROVIDER=anthropic ...` (eller fjern `DEEPSEEK_API_KEY`).

**Kontrol:** åbn `/redaktion/operator`: ved DeepSeek står der "Bruger DeepSeek — persondata maskeres før de sendes", og "Hvad må AI for dig?" viser udbyder og model. `help` i operatøren nævner også udbyderen. Opstartsloggen advarer, hvis `OPERATOR_PROVIDER` peger på en udbyder uden nøgle, eller hvis begge nøgler er sat uden `OPERATOR_PROVIDER`.

**Omkostning og model (ikke verificeret):** standardmodellen er `deepseek-chat` med OpenAI-kompatibel function calling. DeepSeeks modelnavne, priser og regionsplacering ændrer sig; tjek deres aktuelle dokumentation og prisside og sæt et forbrugsloft/saldo-advarsel på kontoen, før du går i produktion. Saldo 0 giver HTTP 402, som operatøren viser som "kontoen mangler saldo". Ratelimit i CMS'et (30 beskeder pr. 10 min pr. bruger, højst 9 modelkald pr. besked) gælder uændret.

**Databehandling:** DeepSeek behandler data uden for EU/EØS. Operatøren maskerer e-mail, telefon, CPR-lignende numre og nøgler og udelader kontaktfelter (indsendere, brugere, kilder), men kan ikke genkende navne i fri tekst, som redaktøren selv skriver. Ejeren skal selv vurdere databehandleraftale og overførselsgrundlag (ikke juridisk rådgivning).
