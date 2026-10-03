# FIX: alle seks byer på den ene Railway-adresse

Branch `review-fixes`. Intet er committet eller pushet. Bygning og røgtest køres af lead.

## Problem

Produktion har kun én nåbar vært (`lysdalcms-production.up.railway.app`). Tenancy er pr. `Host`, så en ukendt vært viser enten Slagelse (`FALLBACK_SITE_DOMAIN`) eller 404. De fem andre byer kunne ikke ses, byvælgeren pegede på domæner, der ikke findes, og kun Slagelse havde områder og en bruger.

## Design

### 1. Preview-by på allow-listede værter

- Ny env `PREVIEW_HOSTS` (kommasepareret hostnavne). Parser og regler i `lib/preview.ts` (ren fil, ingen `next/headers`).
- Kun på de værter vælges byen med `?by=<nøgle>`. Nøglerne er defineret ét sted: `cityKey(domæne)` i `lib/network-sites.ts` (slagelse, naestved, holbaek, koege, roskilde, ringsted; hvidliste `NETWORK_KEYS`, validering `parseCityKey`, opslag `domainForKey`).
- `proxy.ts` (trin 3b): GET/HEAD på en preview-vært med gyldig `?by=` sætter cookien `lk_by` og svarer 303 til samme sti uden `by` (øvrige parametre bevares). Cookie: HttpOnly, SameSite=Lax, Path=/, 30 dage, Secure når https (`x-forwarded-proto`). `Location` er relativ og saneres, så `//vært` eller backslash aldrig giver en åben omdirigering. Ugyldig eller ukendt `by` ignoreres helt (ingen cookie, ingen omdirigering).
- `lib/site.ts`: `resolveSiteDomain` får `previewHosts` og `previewCookie`. På en preview-vært: cookie-byen, ellers `FALLBACK_SITE_DOMAIN`, ellers (i `getCurrentSite`) den ældste instans. På alle andre værter er funktionen uændret; cookien læses kun, når værten er en preview-vært.
- Lokal udvikling (`*.localhost`, dev-cookie `site`) er uændret.

### 2. Byvælger på preview-værter

- `NetworkSiteLink` har nyt valgfrit felt `previewBy`; `getNetworkLinks()` sætter det kun på en preview-vært.
- `networkHref(site, path, sectionPaths, options?)` er bagudkompatibel: er `previewBy` sat (eller `options.previewBy`), returneres `/?by=<nøgle>`, ellers som før. Alle kaldere (header, mobilark, bundlinje, emnelinje) blev dækket uden komponentændringer, fordi layoutet allerede sender `getNetworkLinks()` ned. Aktiv by markeres som før (`currentDomaene`/by-navn).
- `/api/site/switch` omdirigerer på en preview-vært til `/?by=<nøgle>` (og accepterer nu også by-nøglen som `site`).
- Redaktionens sidebar (`app/redaktion/layout.tsx` + `components/admin/nav-links.tsx`): på en preview-vært vises seks links til byens OFFENTLIGE forside; brugerens egen by er mærket "Din by". Der tilbydes ingen redigering på tværs af instanser. Tilsvarende by-faner på `/redaktion/artikler` og `/redaktion/metrikker` linker til forsiden i stedet for en andens redaktion.

### 3. Områder til alle byer

- `lib/default-areas.ts`: delområder fra `prisma/network-seed-data.ts` (og Slagelses fra `prisma/seed.ts`) plus små byer fra kilderegistrene. Næstved +Herlufmagle, Sandved, Toksværd, Enø, Suså. Slagelse +Antvorskov, Halsskov, Stigsnæs. ASCII-slugs, unikke pr. by.
- Koordinater: kun hvor seed-dataene allerede har dem. De otte nye steder har `lat/lng = null` (GeoTag tillader det). Der er ikke opfundet nogen.
- `lib/default-areas-sync.ts` (plan/apply som `default-sections-sync.ts`) og `scripts/sync-areas.ts`. Dry-run er standard, kun oprettelser, eksisterende GeoTags ændres aldrig (heller ikke deres koordinater), navne-/slug-konflikter rapporteres og oprettes ikke. `Instance.geografiskDækning` får de nye navne lagt til (eksisterende poster røres ikke), på samme måde som sections-sync opdaterer `kategoriTaksonomi`.

### 4. Administrator pr. by

`scripts/create-admin.ts` (`npm run user:create-admin`). Afviser uden `NODE_ENV=production` medmindre `--force`. Opretter rollen "Ansvarshavende redaktør" i den valgte instans (id, domæne eller by-nøgle), tilfældig midlertidig adgangskode (samme generator som reset-password) udskrevet én gang, `mustChangePassword=true`, `AuditLog` (`user.create_cli`, uden hemmeligheder). Findes e-mailen allerede (globalt unik), afvises med en dansk besked og et plus-adresse-forslag, uden at afsløre hvilken by der ejer den.

### 5. Env

`PREVIEW_HOSTS` er tilføjet til `lib/env.ts` (aldrig fatal) og `.env.example`. Produktionsadvarsler: en preview-vært er aktiv (husk at fjerne den), en post er et rigtigt by-domæne (ignoreres), en post er ikke et gyldigt hostnavn.

## Sikkerhedsvurdering

| Emne | Vurdering |
|---|---|
| Hvem kan vælge by? | Kun forespørgsler, hvis betroede `Host` står i `PREVIEW_HOSTS`. Værten kommer fra `trustedHost()`; en forfalsket `X-Forwarded-Host` virker kun med `TRUST_FORWARDED_HOST=1` (som før), og testen `forfalsket X-Forwarded-Host` viser, at den ikke gør en vært til preview. |
| Hvad kan en klient indsætte? | Cookien `lk_by` kan kun pege på en af seks hårdkodede nøgler. Domæner, id'er og vilkårlig tekst afvises i både proxy og resolver. Ingen databaseværdi eller SQL påvirkes af klienten. |
| Tenancy for /redaktion | Uændret: redaktionssider bruger `user.instansId` fra databasen. En test sikrer, at `app/redaktion`, `app/login`, `app/api/auth`, `app/api/ingest`, `app/api/cron`, `lib/auth.ts`, `lib/redaktion-access.ts` og `lib/admin-guard.ts` hverken nævner preview-cookien eller `getCurrentSite`. `?by=` behandles ikke på `/redaktion`, `/login` og `/api/*`. |
| API-indtag og cron | Bundet til API-nøgle henholdsvis `CRON_SECRET`, bruger ikke `getCurrentSite`. Uændret. |
| Åben omdirigering | Relativ `Location`, protokol-relative stier (`//evil`) og backslash falder tilbage til `/`. Testet. |
| Cache poisoning | `decideCachePolicy({ previewHost: true })` er aldrig cache'bar. Alle svar på en preview-vært får `Cache-Control: private, no-store` og `Vary: Host, Cookie` (undtagen `/_next/`). Rigtige domæner er uændret cache'bare. |
| Indeksering | Preview-værter er altid "ukendte" i `classifyHost` (robots.txt `Disallow: /`, ingen sitemaps/llms.txt, meta noindex/nofollow), også hvis de viser en bys eget domæne. Nyt: `X-Robots-Tag: noindex, nofollow` på alle svar. |
| Fejlkonfiguration | By-domæner kan aldrig være preview-værter (filtreres i `parsePreviewHosts`, advarsel ved opstart), så en rigtig by hverken kan blive noindex'et eller få cookie-styret tenancy ved en fejl. |
| CSRF/cookie | Cookien indeholder ingen hemmelighed og styrer kun hvilken offentlig by der vises; SameSite=Lax. Server Actions er uændret same-origin. |
| Ny skrivefladeeffekt | Offentlige formularer (indsend, nyhedsbrev, målinger) kan nu lande i hvilken som helst af de seks byer via preview-adressen. Tilladt, rate-limitet som før. Se risici. |
| create-admin | Ingen netværksflade, kun CLI. Kræver `NODE_ENV=production` eller `--force`. Adgangskoden findes kun i bcrypt-hash og som én stdout-linje. Revisionsspor uden hemmeligheder. Sikret af test (console-spion og CLI end-to-end). |

## Kommandoer

```bash
# Railway-variabler
railway variable set PREVIEW_HOSTS=lysdalcms-production.up.railway.app --service lysdalcms --environment production

# Områder (dry-run er standard)
npm run areas:sync -- --alle
npm run areas:sync -- --alle --apply
npm run areas:sync -- --instans naestvedlokalt.dk --apply

# Administrator i en bestemt by
npm run user:create-admin -- --instans naestved --email navn+naestved@gmail.com --navn "Dit Navn" --force
```

På Railway køres de via `railway ssh ... -- npm run ...` (se `docs/ops/RAILWAY-SETUP.md`, afsnit 13). Forventet resultat af `areas:sync --alle --apply` på produktion (0 områder i dag): Slagelse 11, Næstved 13, Holbæk/Ringsted/Køge/Roskilde 8 hver.

## Når de rigtige domæner kommer

1. Tilføj domænerne (afsnit 3 i RAILWAY-SETUP).
2. Fjern `PREVIEW_HOSTS` og `FALLBACK_SITE_DOMAIN`.
3. Byvælgeren og redaktionens by-liste bruger automatisk de rigtige domæner igen (ingen kodeændring). Cookien `lk_by` bliver ubrugt.
4. Områder og brugere ligger i databasen, intet at migrere. Plus-adresserne kan beholdes eller byttes til rigtige adresser.

## Ændrede og nye filer

Ændret: `lib/network-sites.ts`, `lib/site.ts`, `lib/preview.ts` (ny), `lib/seo/host.ts`, `lib/cache/policy.ts`, `lib/env.ts`, `proxy.ts`, `app/api/site/switch/route.ts`, `app/redaktion/layout.tsx`, `app/redaktion/artikler/page.tsx`, `app/redaktion/metrikker/page.tsx`, `components/admin/nav-links.tsx`, `.env.example`, `package.json` (to scripts), `docs/ops/RAILWAY-SETUP.md`.
Nyt: `lib/preview.ts`, `lib/default-areas.ts`, `lib/default-areas-sync.ts`, `scripts/sync-areas.ts`, `scripts/create-admin.ts`, tests `preview-hosts`, `preview-proxy`, `preview-site`, `areas-sync`, `create-admin-script`.
`SiteHeader`, `SiteFooter`, `SectionSheet` og `TopicFilterBar` er uændrede: de får `previewBy` via `networkSites` fra `getNetworkLinks()` og `networkHref`.

## Tests og kontroller (kørt)

`npx tsc --noEmit`, `npx eslint . --quiet`, `npm run secrets`, `npm run prisma:pg:check` er rene. `npm test`: 676 af 676 består (isoleret SQLite). Dækket: oversættelsesfunktionen for by-nøgler, `PREVIEW_HOSTS`-parser, resolver-matrix (tilladt/ikke-tilladt vært, gyldig/ugyldig cookie, standardby, første instans, ingen virkning på rigtige domæner/ukendte værter), proxy (cookie-attributter, 303 uden parameter, ignoreret ugyldig `by`, kun GET/HEAD, ingen virkning på /redaktion, /login, /api, åben omdirigering), cache- og noindex-headere, `getCurrentSite`/`getNetworkLinks` mod test-DB, rendering af SiteHeader/SectionSheet/SiteFooter/NavLinks på preview og rigtigt domæne, områdesync (plan/apply/idempotens/tenant-isolation/ingen koordinater), create-admin (afvisninger, rolle, instansbinding, kodeord ikke logget, e-mail findes, CLI end-to-end).

## Manuel verifikation (efter deploy)

1. Sæt `PREVIEW_HOSTS`. Åbn `/?by=naestved`: du lander på `/`, forsiden viser NæstvedLokalt, cookien `lk_by` er sat (HttpOnly) og URL'en har ikke `?by=`.
2. Skift by i topbaren, mobilmenuen, bundlinjen og emnelinjen: hvert skift lander på den valgte bys forside på samme adresse. Aktiv by er markeret.
3. `/?by=ukendt` og `/?by=naestvedlokalt.dk` ændrer ikke byen.
4. `https://<railway>/robots.txt` er `Disallow: /`, `/sitemap.xml` giver 404, svar har `X-Robots-Tag: noindex, nofollow` og `Cache-Control: private, no-store` (`curl -I`).
5. Log ind som Slagelse-administrator mens cookien peger på Næstved: `/redaktion` viser stadig Slagelse; sidebarens by-liste har seks links til offentlige forsider og "Din by" ved Slagelse.
6. `areas:sync -- --alle` (dry-run), derefter `--apply`; `/omraade` viser områderne i hver by. Kør igen: 0 nye.
7. `user:create-admin` for Næstved med plus-adresse: log ind, tvunget kodeskifte, `/redaktion` viser Næstved. Samme e-mail igen giver den danske besked.
8. Ingen ændring på et rigtigt domæne (fx via en test-staging): byvælgeren linker til `https://<by>lokalt.dk`.

## Risici og kendte begrænsninger

- Redaktionens bruger kan se by A offentligt (cookie) og redigere by B (egen instans) samtidig; det er tilsigtet, men kan forvirre. Sidebaren mærker egen by "Din by".
- Én administrator pr. by kræver én e-mailadresse pr. by (plus-adressering). Det er en følge af, at `User.email` er globalt unik, og er ikke ændret.
- Offentlige formularer på preview-adressen kan skrive i alle seks byer; brug den ikke som rigtig tilmeldingsside.
- Cookien valideres i proxyen mod de seks kendte nøgler, ikke mod databasen (ingen DB-opslag i proxyen). Findes en bys instans ikke, falder resolveren tilbage til standardbyen/første instans.
- `Vary: Host, Cookie` sættes i proxyen; Next kan selv tilføje `Vary` på RSC-svar. Sikkerheden hviler på `Cache-Control: private, no-store`, ikke på `Vary` alene.
- Emnelinjens by-dropdown er kun testet via `networkHref` (menuen er lukket i statisk rendering); header, mobilark, bundlinje og redaktionens by-liste er render-testet.
- Ikke kørt: `next build` og live-røgtest i browser (lead). Preview kan ikke afprøves lokalt uden at sætte `PREVIEW_HOSTS=localhost` og genstarte dev-serveren.
- `areas:sync` tilføjer navne til `Instance.geografiskDækning`. Ønskes det ikke, fjern det afsnit i `applyAreaSync`; GeoTags er upåvirkede.

> **Opdatering (netværksadgang):** Redaktionens by-liste/faner og "Din by"-adfærd beskrevet ovenfor er erstattet af byskifteren i `FIX-netvaerksadgang.md`: ét login kan redigere flere byer (medlemskaber), og "Se siden" peger på `/?by=<nøgle>`. Offentlig by-valg via `?by=`/`lk_by` er uændret og uafhængig af redaktionens aktive by.
