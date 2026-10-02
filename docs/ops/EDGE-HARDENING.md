# Kant og hærdning: Cloudflare + Railway (runbook til ejeren)

Mål: gøre sitet **billigt at besøge** (cache i kanten), **dyrt at misbruge** (rate limits, bot-filtre, Turnstile) og **svært at vælte** (origin låst, timeouts, circuit breakers).
Volumetriske DDoS-angreb stoppes i kanten, ikke i Node. Alt nedenfor i afsnit 2-9 er opsætning, som **du** skal gøre i Cloudflare og Railway (Claude kan ikke oprette konti eller ændre DNS). Koden i repoet (afsnit 1) er allerede lavet og virker uden kanten, men giver først fuld beskyttelse med den.

```
Bruger / bot
   │
   ▼
Cloudflare (DNS proxied, WAF, bot-filter, rate limits, Turnstile, cache af HTML/billeder/feeds)
   │  tilføjer header  x-origin-secret: <ORIGIN_SECRET>   og   CF-Connecting-IP / CF-Ray
   ▼
Railway edge-proxy  ──►  Next.js (proxy.ts: origin-lås, bot-/bane-filter, CSP-nonce, cache-header)
                                   │
                                   ├─ Postgres (privat netværk)
                                   └─ Redis (privat netværk)  ← delte rate limits, lockout, bans
```

## 1. Hvad koden allerede gør (kort)

| Område | Hvad | Hvor |
|---|---|---|
| Sikkerhedsheadere | CSP med nonce + `strict-dynamic`, HSTS (kun produktion + https), nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP, `frame-ancestors 'none'`, ingen `X-Powered-By`; `/uploads/*` får nosniff + sandbox-CSP | `proxy.ts`, `lib/security-headers.ts`, `next.config.ts` |
| Klient-IP | Kun fra betroede kilder (`TRUST_CLOUDFLARE`, `TRUSTED_PROXY_HOPS`); IPv6 -> /64 | `lib/client-ip.ts` |
| Origin-lås | `ORIGIN_SECRET`: 403 uden `x-origin-secret` (undtagen `/api/health`, `/api/ready`, `/api/cron/*`) | `proxy.ts`, `lib/origin-lock.ts` |
| Delt rate-limit-store | Redis via ioredis, korte timeouts, circuit breaker (30 s hukommelses-fallback), fail-closed for login/indtag/token-actions | `lib/ratelimit/redis-store.ts` |
| Bots | UA-klassificering, ondsindede stier -> lille 404 + eskalerende bans (10 min / 1 t / 24 t), grov lokal sidegrænse | `lib/bot/*`, `proxy.ts` |
| Dyre endpoints | `/og/*` (allowlist, semafor, IP-grænse, immutable cache), `/soeg` (q ≤ 100 tegn, 30/min/IP), feeds/sitemaps (ETag/304 + s-maxage), POST-body ≤ 1 MB | `lib/cache/og-guard.ts`, `proxy.ts`, `lib/seo/xml-response.ts` |
| Cache af anonym HTML | `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300` kun for anonym GET uden session; purge ved publicering | `lib/cache/policy.ts`, `lib/cache/purge.ts` |
| Captcha | Turnstile (valgfri via env) på offentlige formularer | `lib/turnstile.ts`, `components/site/TurnstileField.tsx` |
| Stabilitet | `fetchWithTimeout`, circuit breaker om Anthropic (`lib/chat`/forside-AI), 503 med Retry-After i stedet for hængende kald | `lib/http.ts`, `lib/resilience.ts` |

## 2. Miljøvariabler (Railway -> web-servicen)

| Variabel | Værdi | Bemærkning |
|---|---|---|
| `ORIGIN_SECRET` | `openssl rand -base64 36` (min. 24 tegn) | Samme værdi i Cloudflare Transform Rule (afsnit 3.3). Uden den er originen åben for alle, der kender Railway-domænet. |
| `TRUST_CLOUDFLARE` | `1` | **Kun** når `ORIGIN_SECRET` er sat; ellers kan alle forfalske `CF-Connecting-IP`. Fra T5 P2-2 er `TRUST_CLOUDFLARE=1` uden `ORIGIN_SECRET` en **startfejl** i produktion (`lib/env.ts`), og manglende `ORIGIN_SECRET` giver en advarsel. |
| `TRUST_FORWARDED_HOST` | (udeladt) | Standard: tenant og cache-nøgle bruger kun `Host` (Cloudflare bevarer den; Railway router på den). `X-Forwarded-Host` kan sættes af klienten og ignoreres, medmindre kanten garanterer at den overskrives — sæt da `1` (`lib/trusted-host.ts`). Anonym HTML får `Vary: Host` (`Host, X-Forwarded-Host` når den er betroet), så en CDN aldrig blander byer. |
| `TRUSTED_PROXY_HOPS` | `2` (Cloudflare + Railway) | Bruges når `CF-Connecting-IP`/`CF-Ray` mangler (fx Railways healthcheck). Kun Railway foran: `1` (standard). |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (privat adresse) | Påkrævet ved mere end 1 replika, ellers er grænser/lockout/bans pr. proces. |
| `CSP_REPORT_ONLY` | `1` de første dage, derefter fjernes | Se afsnit 7. Standard i produktion er **håndhævet**. |
| `CACHE_PUBLIC_HTML` | (udeladt = til i produktion) | `0` slår HTML-cache-headeren fra. `CACHE_HTML_S_MAXAGE` (60) og `CACHE_HTML_SWR` (300) kan hæves under angreb. |
| `CF_API_TOKEN`, `CF_ZONE_ID` | Token med **Zone > Cache Purge > Purge** | Valgfrit: uden dem sker der ingen purge (siden fornyes efter `s-maxage`). Ved én zone pr. by: `CF_ZONE_IDS='{"naestvedlokalt.dk":"<id>",…}'`. `CF_PURGE_BY_TAG=1` kun hvis planen understøtter purge pr. Cache-Tag. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site-nøgle | **Build-time** (indlejres i JS): skal være sat, før Railway bygger. |
| `TURNSTILE_SECRET_KEY` | Turnstile hemmelighed | Kun server. Når den er sat, kræves gyldigt token på formularerne. `TURNSTILE_FAIL_OPEN=1` hvis Cloudflares verifikations-API driller. |
| `PAGE_RATE_LIMIT_PER_MIN` | `300` (standard) | Grov grænse pr. IP og replika; skrabere/tom UA får automatisk ~20 %. |
| `RATELIMIT_FAIL_CLOSED` | `1` (standard) | `0` = login/indtag nægtes **ikke** når Redis er nede (i stedet proces-lokal grænse). |
| `OG_CONCURRENCY` | `4` | Samtidige billedgenereringer pr. proces. |

## 3. Cloudflare: opsætning trin for trin

### 3.1 DNS og TLS
1. Tilføj hvert by-domæne (`naestvedlokalt.dk`, `slagelselokalt.dk`, …) som zone. Peg `@` og `www` på Railway-målet (CNAME) med **Proxied** (orange sky).
2. **SSL/TLS > Overview: Full (strict).** Railway udsteder gyldigt certifikat på custom domains. Aldrig "Flexible".
3. **SSL/TLS > Edge Certificates:** Always Use HTTPS = til, Minimum TLS 1.2, TLS 1.3 til. HSTS sender appen selv (kun produktion + https); slå ikke Cloudflares HSTS til samtidig.
4. `www` -> apex omdirigerer appen allerede (308). Behold begge proxied.

### 3.2 Managed WAF
- **Security > WAF > Managed rules:** aktivér *Cloudflare Managed Ruleset* (alle planer). På Pro+ også *OWASP Core Ruleset* (start på "Medium" paranoia, aktion *Log* første uge, derefter *Block*).
- Opret en custom rule *Block* for udtryk der aldrig er legitime hos os (supplerer appens egen 404/ban): `(http.request.uri.path matches "^/(wp-|xmlrpc|phpmyadmin|cgi-bin|\\.git|\\.env)")`.

### 3.3 Lås originen (vigtigste trin)
Railways egen proxy kan ikke validere Cloudflares mTLS-certifikat (TLS termineres hos Railway), så **Authenticated Origin Pulls** er ikke en mulighed. Brug i stedet en hemmelig header:
1. Generér hemmeligheden og sæt den som `ORIGIN_SECRET` i Railway.
2. Cloudflare: **Rules > Transform Rules > Modify Request Header > Create rule**, "All incoming requests", *Set static* header `x-origin-secret` = samme værdi. (Gør det for hver zone.)
3. Fra nu giver `https://<service>.up.railway.app/` **403** uden headeren. Undtagelser, bevidst: `/api/health` og `/api/ready` (Railways healthcheck og uptime-monitor) samt `/api/cron/*` (egen `CRON_SECRET`).
4. Roter hemmeligheden ved mistanke om lækage: sæt ny værdi i Cloudflare **først**, derefter i Railway (kortvarigt 403 mellem de to trin; vælg et stille tidspunkt).

### 3.4 Bot-filtre
- **Security > Bots:** *Bot Fight Mode* (Free) eller *Super Bot Fight Mode* (Pro+): "Definitely automated" = Block (Pro+: Managed Challenge til start), "Verified bots" = Allow. Tjek efter en uge i *Security > Events*, at Googlebot, Bingbot og AI-søgebots du vil have (se `lib/seo/robots-policy.ts`) ikke rammes.
- Appen klassificerer selv UA (`lib/bot/detect.ts`) og strammer grænser for skrabere/headless/tom UA. En UA kan forfalskes; stol på Cloudflares *Verified Bots* til at skelne ægte Googlebot.
- Bot Fight Mode på Free kan ikke undtages med custom rules. Mangler nyhedsbrevs-/RSS-læsere trafik, så overvej Pro.

### 3.5 Rate limiting rules
Appen har egne grænser (Redis), men kanten stopper trafikken, før den når Railway. Anbefalede regler (*Security > WAF > Rate limiting rules*; Free-planen tillader 1 regel med 10 s vindue, vælg da "global pr. IP" nederst):

| Regel | Match | Grænse | Aktion |
|---|---|---|---|
| Login | `http.request.uri.path eq "/login"` eller `starts_with "/api/auth"` og metode POST | 5 / 1 min pr. IP | Block 10 min |
| API | `starts_with "/api/"` og ikke `/api/ingest/`, `/api/health`, `/api/ready`, `/api/cron/` | 60 / 1 min pr. IP | Managed Challenge 5 min |
| Søg | `eq "/soeg"` (query indeholder `q=`) | 20 / 1 min pr. IP | Block 5 min |
| Billedgenerering | `starts_with "/og/"` | 30 / 1 min pr. IP | Block 10 min |
| Formularer (POST) | metode POST og path i `/nyhedsbrev`, `/indsend`, `/sponsor`, `/qa`, `/interview`, `/meddeler`, `/api/newsletter/subscribe` | 10 / 10 min pr. IP | Block 1 time |
| Global | alle forespørgsler der ikke er `/_next/static/` | 600 / 10 s pr. IP | Managed Challenge 10 min |

Agent-indtaget (`/api/ingest/*`) rate-limites af appen pr. API-nøgle. Hvis agentens IP er fast, så opret en WAF *Skip*-regel for den IP på ingest-stien.

### 3.6 Turnstile
1. **Turnstile > Add widget:** navn "Lokalt formularer", tilføj alle by-domænerne, mode *Managed*.
2. Site-nøgle -> `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Railway, før build). Hemmelighed -> `TURNSTILE_SECRET_KEY`.
3. **UI-ejere skal montere feltet** `components/site/TurnstileField.tsx` i formularerne, før hemmeligheden aktiveres (se `docs/review/FIX-hardening.md` for listen). Uden hemmelighed gør serveren intet, så felterne kan rulles ud først.
4. Test-nøgler (Cloudflares dummy-keys) virker lokalt.

### 3.7 Cache rules (det vigtigste DDoS-værn)
Appen sender `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300` på anonyme GET-sider **uden** session-cookie. Kanten skal bare respektere den. *Caching > Cache Rules*, i denne rækkefølge:

1. **Bypass:** `(starts_with(http.request.uri.path, "/redaktion")) or (starts_with(http.request.uri.path, "/api/")) or (http.request.uri.path eq "/login") or (http.cookie contains "authjs") or (http.cookie contains "next-auth")` -> *Bypass cache*.
2. **HTML og feeds:** `(http.request.method in {"GET" "HEAD"})` og hostname i dine domæner -> *Eligible for cache*, **Edge TTL: "Use cache-control header if present, bypass cache if not present"**, Browser TTL: respect origin. **Cache key:** inkludér hele query string (nødvendigt: Next.js' RSC-navigation bruger `?_rsc=` for at adskille den fra HTML; ellers kan HTML og RSC blandes). Host indgår som standard.
3. **/_next/static/*:** Edge TTL 1 år (filnavne er hashede).
4. **/og/*, /uploads/*, /icons/*:** respekter origin (billeder uden `?v=` caches 1 dag, med `?v=` 1 år/immutable).
5. Slå **Tiered Cache** (Smart) til, så kun ét datacenter henter fra Railway pr. objekt.
6. Aktivér **Always Online** ikke (kan vise forældet indhold ved rettelser).

Sikkerhed ved cache: koden cache'r aldrig `/redaktion`, `/api`, token-sider (`/qa`, `/interview`, `/meddeler`, `/partner`), `/gemte`, `/profil`, `/velkommen`, svar til forespørgsler med session-cookie eller Authorization-header, eller non-GET. Sider sætter ikke cookies for anonyme. Mangler du tillid, så brug kun regel 2 på de stier du vil cache.

**CSP og cachede sider:** nonce'en i HTML'en og i CSP-headeren cachelagres sammen, så alle brugere inden for ét cache-vindue deler nonce. Det er acceptabelt, fordi indhold sanitiseres og scripts er `strict-dynamic`, men det betyder at nonce ikke er en hemmelighed i cachede sider. Vil du have unik nonce pr. besøgende, så sæt `CACHE_PUBLIC_HTML=0` (og accepter at Node renderer hver side).

**Purge ved publicering:** appen kalder Cloudflares purge-API (forside, feeds, sitemaps og artiklens URL) når en artikel publiceres/ændres/afpubliceres og når forsiden godkendes eller et layout publiceres. Uden `CF_API_TOKEN` sker det ikke; så venter siden maks. 60 s (+ stale-while-revalidate). Test efter opsætning: publicér en artikel og tjek `cf-cache-status: MISS` på forsiden bagefter.

### 3.8 /uploads
- Appen sender `X-Content-Type-Options: nosniff` og `Content-Security-Policy: default-src 'none'; … sandbox` (PDF'er: `default-src 'none'`) på alle `/uploads/*`.
- Cloudflare: cache billeder og video (regel 4), slå *Hotlink Protection* til (Scrape Shield), og lav en WAF-regel der blokerer POST > 12 MB (`http.request.body.size gt 12582912`, Business+; ellers håndhæver appen 1 MB på offentlige POST'er og 12 MB på redaktionens upload).
- Uploads ligger på Railway Volume/objektlager (A1), ikke i Cloudflare; ryd cache for en fil ved sletning (URL-purge).

### 3.9 Cloudflare Access for /redaktion
Giver en ekstra lås foran CMS'et (MFA/SSO), også hvis appen havde en login-fejl.
1. **Zero Trust > Access > Applications > Add > Self-hosted.** Application domain: dit by-domæne, path `redaktion*` (og evt. `login`). Tilføj en række pr. by-domæne (eller brug én fælles redaktionsside).
2. Policy *Allow*: e-mails/domæne for redaktionen (Free op til 50 brugere), kræv MFA hos identitetsudbyderen.
3. Udeluk `/api/cron/*`, `/api/ingest/*`, `/api/health`, `/api/ready` (de ligger ikke under `redaktion*`, så de rammes ikke).
4. Appen har stadig sit eget login (Auth.js); Access er et ekstra lag.

## 4. Under-Attack-playbook

Mistænkt angreb: svartider stiger, 5xx fra Railway, CPU/hukommelse høj, Cloudflare sender *HTTP DDoS Attack Alert*.

1. **Se** (Cloudflare *Analytics > Traffic* og *Security > Events*): hvilke stier, lande, ASN, UA? Er `cf-cache-status` mest HIT? (Hvis ikke: tjek cache rules, afsnit 3.7.)
2. **Slå Under Attack Mode til** (*Security > Settings > Security Level: I'm Under Attack*) for de ramte domæner. Det lægger en JS-udfordring foran alle; RSS-læsere og søgebots kan blive ramt, så slå det fra igen, når det er overstået.
3. **Stram cache:** sæt `CACHE_HTML_S_MAXAGE=600` og `CACHE_HTML_SWR=3600` i Railway (kræver redeploy) eller lav en Cloudflare Cache Rule med *Edge TTL 10 min, ignorer origin*, kun for anonyme GET uden cookie.
4. **Afskær dyre stier midlertidigt** med en WAF custom rule (*Block*): `starts_with "/og/"`, `/soeg` med `q=`, `/api/` undtagen health/ready/ingest/cron.
5. **Blokér mønstre:** ASN/land uden for Danmark (kun hvis det rammer få læsere), tom/useriøs UA, `http.request.uri.path contains` på det angribende mønster. Brug *Managed Challenge* hellere end *Block* ved tvivl.
6. **Stram appen:** `PAGE_RATE_LIMIT_PER_MIN=120` (redeploy). Appens bans (4/8/16 strikes) kører allerede automatisk for scannere.
7. **Skalér** Railway-servicen (flere replicas; Redis deler grænser). Tjek at Postgres-forbindelser ikke er flaskehalsen (`connection_limit`).
8. **Hvis originens adresse er lækket** (angreb uden om Cloudflare): bekræft at `curl https://<service>.up.railway.app/` giver 403; roter `ORIGIN_SECRET`; skift Railway-domænet (slet det genererede `*.up.railway.app`, hvis custom domains kører).
9. **Bagefter:** slå Under Attack Mode fra, nulstil midlertidige regler, notér tidslinje + hvad der virkede, justér rate-limit-tabellen i 3.5.

## 5. Alarmer
- **Cloudflare > Notifications:** HTTP DDoS Attack Alert, Advanced HTTP DDoS Attack Alert, Origin health (hvis Load Balancing/Health Checks bruges), Security Events spike (Pro+), Certificate expiry. Send til en fælles driftsadresse + evt. webhook til Slack.
- **Uptime:** BetterStack/UptimeRobot på `https://<by-domæne>/api/ready` pr. by (originlåsen undtager endpointet; domænet går gennem Cloudflare, som tilføjer headeren alligevel). Alarmér ved 2 mislykkede tjek i træk.
- **Railway:** alarmer på CPU, hukommelse og genstarter; Postgres-forbindelser; Redis-hukommelse.
- **Logs:** søg i Railway-logs efter `[csp]` (CSP-overtrædelser), `[ratelimit] Redis utilgængelig` (breaker åbnet; logges én gang pr. åbning) og `[resilience]` (kredsløb for Anthropic).

## 6. Railway
- **Ingen WAF/DDoS-filter for brugerdomæner hos Railway.** Al filtrering sker i Cloudflare. Brug ikke Railways genererede `*.up.railway.app` offentligt (origin-låsen svarer 403 uden header; slet domænet når custom domains virker).
- **Begræns offentlig netværk:** kun web-servicen har offentligt domæne. Postgres og Redis: brug **privat netværk** (`*.railway.internal`), slå *TCP Proxy* fra, og brug de interne URL'er i `DATABASE_URL`/`REDIS_URL`. (ioredis bruger `family: 0` for IPv6 på privat netværk.)
- **Healthcheck:** `/api/ready` (railway.json er A1's); `/api/health` til liveness. Begge er undtaget originlåsen.
- **Replicas:** flere end 1 kræver `REDIS_URL` (delte rate limits, lockout, bans). Uden Redis ganges alle grænser med antal replicas.
- **Variabler:** `AUTH_TRUST_HOST=true`, `ORIGIN_SECRET`, `TRUST_CLOUDFLARE=1`, `TRUSTED_PROXY_HOPS=2`, `REDIS_URL`, `CRON_SECRET`, Turnstile-nøgler. `NEXT_PUBLIC_*` indlejres ved build.
- **Cron:** Railway Cron-service kalder `/api/cron/frontpage-rank` med `Authorization: Bearer $CRON_SECRET` (undtaget originlåsen; kald gerne direkte mod Railway-domænet).

## 7. CSP: fra Report-Only til håndhævelse
Standarden er: **udvikling = Report-Only, produktion = håndhævet**. Anbefalet udrulning:
1. Første deploy: sæt `CSP_REPORT_ONLY=1` i Railway. Browserne rapporterer overtrædelser til `/api/csp-report`; de logges som `[csp] directive=… blocked=… doc=…`.
2. Kør lokalt/staging: `npx tsx scripts/csp-inline-audit.ts --base <url> --host <domæne>` (lister alle `<script>`-tags på ~10 sider og fejler hvis et kørbart inline-script mangler nonce) og `npx tsx scripts/check-headers.ts --base <url> --host <domæne> --prod`.
3. Klik rundt på sitet i en rigtig browser (forside, artikel, søg, nyhedsbrev, indsend, login, redaktion, Turnstile) med DevTools-konsollen åben; tjek at der ikke kommer "Refused to …"-fejl, og at `[csp]`-linjerne i logs er tomme i 3-7 dage.
4. Fjern `CSP_REPORT_ONLY` (eller sæt `0`) og redeploy. Fra da blokerer browseren overtrædelser og `frame-ancestors 'none'` gælder. Nødbremse: sæt `CSP_REPORT_ONLY=1` igen.
5. Hvis du indlejrer nye eksterne ressourcer: billeder `CSP_IMG_HOSTS=cdn.example.dk`; scripts/iframes kræver ændring i `lib/security-headers.ts` (`buildCsp`).
Bevidste valg: `style-src 'unsafe-inline'` (React `style={…}` bruges til by-farver og kan ikke nonce'es), `media-src https:` (lyd/video kan være eksterne URL'er), skrifttyper self-hostes af `next/font` (ingen Google Fonts-kald i browseren).

## 8. Fejlsøgning
| Symptom | Årsag | Løsning |
|---|---|---|
| Alle får 403 | `ORIGIN_SECRET` sat i Railway, men Cloudflare-reglen mangler/forkert værdi | Tjek Transform Rule (3.3) og at domænet er proxied |
| Alle deler rate limit / ser samme IP | `TRUST_CLOUDFLARE` ikke sat, eller `TRUSTED_PROXY_HOPS` forkert | Sæt `TRUST_CLOUDFLARE=1`; kontrollér `x-forwarded-for` i en testrute |
| Login fejler pludseligt | Redis nede og fail-closed | Tjek Redis; midlertidigt `RATELIMIT_FAIL_CLOSED=0` |
| Forsiden opdateres ikke efter publicering | Purge ikke sat op | Sæt `CF_API_TOKEN` + `CF_ZONE_ID`, eller vent `s-maxage` |
| Forkert side vist for anden by | Cache nøgle uden host | Cloudflare nøgler på host som standard; brug ikke *Ignore query string*/custom key uden host |
| Formular afviser "kunne ikke bekræfte menneske" | `TURNSTILE_SECRET_KEY` sat, men feltet ikke monteret i UI | Montér `TurnstileField` (se rapport) eller fjern hemmeligheden |

## 9. Tjekliste med curl-tests

Udskift `DOMÆNE` og `RAILWAY` (service-domænet).

- [ ] DNS proxied, SSL/TLS Full (strict), Always Use HTTPS.
  `curl -sI http://DOMÆNE/ | head -3` -> 301 til https.
- [ ] Origin låst:
  `curl -s -o /dev/null -w "%{http_code}\n" https://RAILWAY/` -> **403**
  `curl -s -o /dev/null -w "%{http_code}\n" https://RAILWAY/api/ready` -> 200
  `curl -s -o /dev/null -w "%{http_code}\n" -H "x-origin-secret: <værdi>" https://RAILWAY/` -> 200
  `curl -s -o /dev/null -w "%{http_code}\n" https://DOMÆNE/` -> 200 (Cloudflare tilføjer headeren)
- [ ] Klient-IP er den rigtige (ikke Cloudflares): se at to forskellige netværk får forskellige rate-limit-spande (fx via `X-RateLimit-Remaining` på `/api/articles`).
- [ ] Sikkerhedsheadere:
  `npx tsx scripts/check-headers.ts --base https://DOMÆNE --host DOMÆNE --prod` -> alle OK.
  `curl -sI https://DOMÆNE/ | grep -iE "strict-transport|content-security|x-content-type|referrer|permissions"`.
- [ ] CSP: `npx tsx scripts/csp-inline-audit.ts --base https://DOMÆNE --host DOMÆNE` -> "0 fund".
- [ ] Cache: `curl -sI https://DOMÆNE/ | grep -iE "cf-cache-status|cache-control|age"` to gange -> andet kald `HIT`, `cache-control: public, max-age=0, s-maxage=60, …`.
  Med cookie: `curl -sI -H "Cookie: authjs.session-token=x" https://DOMÆNE/ | grep -i cf-cache-status` -> `BYPASS`/`DYNAMIC`.
  `curl -sI https://DOMÆNE/redaktion | grep -iE "cf-cache-status|location"` -> ikke HIT; redirect til login (eller Cloudflare Access).
- [ ] Feeds/sitemaps 304: `E=$(curl -sI https://DOMÆNE/feed.xml | awk -F': ' 'tolower($1)=="etag"{print $2}' | tr -d '\r'); curl -s -o /dev/null -w "%{http_code}\n" -H "If-None-Match: $E" https://DOMÆNE/feed.xml` -> 304.
- [ ] Ondsindede stier: `curl -s -o /dev/null -w "%{http_code}\n" https://DOMÆNE/wp-login.php` -> 404 (eller 403/managed challenge fra WAF); `…/.env` -> 404.
- [ ] Rate limits: `for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code} " "https://DOMÆNE/soeg?q=test$i"; done` -> ender med 429 (Cloudflare eller appen).
- [ ] /og: `curl -s -o /dev/null -w "%{http_code}\n" "https://DOMÆNE/og/by.jpg?f=999x999"` -> 404; `…/og/by.jpg?v=1` -> `cache-control: … immutable`.
- [ ] /uploads: `curl -sI https://DOMÆNE/uploads/<fil>.jpg | grep -iE "nosniff|content-security"` -> nosniff + sandbox.
- [ ] Turnstile: formular uden token afvises (når hemmelighed er sat); med token virker.
- [ ] Cloudflare Access: `curl -sI https://DOMÆNE/redaktion | grep -i location` -> `…cloudflareaccess.com…`.
- [ ] Publicér en artikel -> forsiden viser den inden for sekunder (purge) og `cf-cache-status: MISS` første gang efter.
- [ ] Alarmer: send en test-notifikation fra Cloudflare; luk Redis i staging og bekræft `[ratelimit] Redis utilgængelig` i logs og at forsiden stadig svarer.
- [ ] Under-Attack-playbook læst og rollerne fordelt (hvem logger ind i Cloudflare, hvem skalerer Railway).
