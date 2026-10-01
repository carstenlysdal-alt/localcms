# Arkitektur — offentlig frontend i det eksisterende CMS

Stack (uændret): Next.js 16.2 App Router · React 19.2 · TypeScript · Prisma 6 (SQLite i dev) · Auth.js v5 beta · Tailwind v4 · Zod 4 · TipTap · Sharp. Kode ligger i `/Users/Lysdal/GITS/Local2027/cms` (eget git-repo).

## 1. Route-struktur efter fase 1

```
cms/app/
├── (site)/                         ← offentlig frontend, DESIGN.md
│   ├── layout.tsx                  SiteHeader, BottomNav, SiteFooter, fonts, site.css, --site-* vars
│   ├── page.tsx                    P-01 forside
│   ├── [sektion]/page.tsx          P-02 sektion
│   ├── [sektion]/[slug]/page.tsx   P-03 undersektion ELLER P-04 artikel (se §3)
│   ├── [sektion]/rss.xml/route.ts  S-05
│   ├── omraade/[slug]/page.tsx     P-05
│   ├── emne/[slug]/page.tsx        P-06
│   ├── forfatter/[slug]/page.tsx   P-07
│   ├── soeg/page.tsx               P-08
│   ├── om-mediet/…                 P-11…P-14
│   ├── indsend/page.tsx            P-15
│   ├── nyhedsbrev/page.tsx         P-16
│   ├── kalender/…                  P-17…P-19
│   ├── guide/…, virksomhed/[slug], forening/[slug]   P-20
│   ├── bliv-stoette/page.tsx       P-21
│   └── not-found.tsx               P-09
├── partner/…                       P-22 supporterdashboard (eget login-krav, site-design)
├── redaktion/                      ← al nuværende admin flyttes hertil (F-01)
│   ├── layout.tsx                  nuværende (admin)/layout.tsx
│   ├── artikler/…  medier/…  opgaver/…  honorar/…  chat/…  emner/…  signaler/…
│   └── sektioner/… forside/… indsendt/… kalender/… stoetteaftaler/… nyhedsbrev/… (nye)
├── login/…                         uændret, redirect → /redaktion/artikler
├── api/…                           uændret + nye endpoints
├── sitemap.ts, robots.ts           S-02 (host-afhængige)
```

**Reserverede slugs:** `omraade`, `emne`, `forfatter`, `soeg`, `om-mediet`, `indsend`, `nyhedsbrev`, `kalender`, `guide`, `virksomhed`, `forening`, `bliv-stoette`, `partner`, `redaktion`, `login`, `api`. Sektionsadministrationen (A-01) skal afvise sektions-slugs, der rammer dem.

**`proxy.ts`:** matcher kun `/redaktion/:path*` og `/partner/:path*`. Offentlige ruter må aldrig kræve login.

## 2. Site-opslag og tema

```ts
// cms/lib/site.ts
export async function getCurrentSite(): Promise<Site>  // cache() pr. request
```

- Læs `host` fra `await headers()`, strip port og `www.`, slå op i `Instance.domaene`.
- Dev-fallback: `process.env.DEFAULT_SITE_DOMAIN` (sæt `slagelselokalt.dk` i `.env`), og tillad `?site=naestvedlokalt.dk` **kun når `NODE_ENV !== "production"`** til test af N-02.
- Ukendt host i produktion → 404.
- Alle offentlige queries filtrerer på `instansId = site.id` og `status = "Publiceret"` (genbrug mønstret fra `app/api/articles/route.ts`).

**Tema:** `(site)/layout.tsx` skriver `--site-accent`, `--site-accent-strong`, `--site-accent-soft`, `--site-on-accent` som inline `style` på `<body>` ud fra `Instance.farver`. Alle faste tokens (DESIGN.md §2 + §10) ligger i `cms/styles/site.css`, som kun importeres i `(site)/layout.tsx`. Tailwind bruges kun til layout-utilities i site-komponenter; farver/typografi kommer fra tokens.

**Skrifttyper:** `Bricolage_Grotesque` og `Literata` fra `next/font/google` med `display: "swap"`, `subsets: ["latin", "latin-ext"]`, eksponeret som `--font-display` og `--font-body`. Kun i `(site)/layout.tsx`.

## 3. Artikel eller undersektion på `/[sektion]/[slug]`

Samme URL-form bruges til undersektion og artikel (DESIGN.md §6a.1). Opslag i rækkefølge:
1. Findes en undersektion med `slug` under sektionen? → P-03.
2. Findes en publiceret artikel med `slug` og sektion (eller undersektion under sektionen)? → P-04.
3. Ellers `notFound()`.

Sektionsadministrationen skal forhindre, at en undersektion får samme slug som en eksisterende artikel i sektionen (og omvendt ved artikeloprettelse).

## 4. Datamodel-udvidelser (Prisma, fase for fase)

Hold dig til eksisterende konventioner: danske feltnavne, `instansId` på alt, `String` + TS-union i stedet for enum, `Json` til lister.

**Fase 1**
```prisma
model Category {           // udvid
  parentId    String?
  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  sortering   Int        @default(0)
  beskrivelse String?
  iNavigation Boolean    @default(true)
  // artikler i undersektion: Article.kategoriId peger på undersektionen; sektionen findes via parent
}
model GeoTag {             // udvid
  slug String
  lat  Float?
  lng  Float?
  @@unique([instansId, slug])
}
model Author { slug String?  @@unique([instansId, slug]) }   // udvid
model Tag    { slug String?  }                               // udvid
model Instance {           // udvid
  kvoteloftProcent Int   @default(25)
  sideTekster      Json?  // om-mediet, principper, kontakt (redigerbare)
  netvaerk         Json?  // [{ navn, domaene }] søstersites
}
```
`Article.indholdstype` får værdien `"AI-assisteret"`. `Article.marking` udvides (validering i `lib/marking.ts`, se governance.md).

**Fase 3-4**
```prisma
model Correction  { id, articleId, tekst, dato, instansId }
model FrontpagePlacement { id, zone String, articleId, position Int, udloeber DateTime?, instansId }
```

**Fase 5**
```prisma
model Submission { id, type String /* historie|tip|event|pressemeddelelse */, navn, kontakt, tekst, filer Json,
                   rettighedsErklaering Boolean, samtykke Boolean, status String @default("Ny"), articleId String?, instansId, createdAt }
model NewsletterSubscriber { id, email, samtykkeTid DateTime, afmeldt DateTime?, instansId  @@unique([instansId, email]) }
```

**Fase 6**
```prisma
model SupportPackage { id, navn, prisAar Int, kvoteArtikler Int, kvoteVideo Int, kvoteSoMe Int, fremhaevelse String, instansId }
// SupportAgreement: tilføj packageId, siteIds Json (netværkspakke)
// Organization: tilføj slug, type ("virksomhed"|"forening"), logoUrl, beskrivelse, adresse, web, profilAktiv Boolean
```

**Fase 7**
```prisma
model Event { id, titel, slug, beskrivelse, start DateTime, slut DateTime?, gentagelse Json?, sted, adresse, lat Float?, lng Float?,
              billetUrl String?, pris String?, kategori String, geoTagId String?, organizationId String?, coverMediaId String?,
              status String @default("Indsendt"), sponsoreret Boolean @default(false), marking Json?, instansId }
```

**Fase 8** — regionale artikler: `ArticleSite { articleId, instansId, canonical Boolean, lokalIndledning String? }` eller et `Json`-felt; vælg den løsning, der holder `instansId`-filtreringen enkel, og dokumentér valget i HANDOFF.

Efter hver ændring: `npx prisma db push` → opdatér `prisma/seed.ts` (idempotent via `upsert`) → `npm run seed`.

## 5. Data-lag

- Læsefunktioner til frontend samles i `cms/lib/site-queries.ts` (fx `getFrontpage(site)`, `getSection(site, slug, {omraade, page})`, `getArticle(site, sektion, slug)`). Server components kalder dem direkte; ingen fetch mod egne API-ruter.
- Alle offentlige sider er server components. Client components kun til: bottom sheet, områdefilter, "Vis flere", nyhedsbrevsformular, indsendelsesformular.
- Caching: brug Next 16's standarder; kald `revalidatePath("/", "layout")` fra publicerings-actions, så forsiden og sektioner opdateres.
- Billeder: `next/image` med størrelser 3:2 og 1:1; `alt` er obligatorisk og findes allerede i `Media`.

## 6. SEO

- `generateMetadata` på alle sider. Canonical = site-domæne + path.
- `app/sitemap.ts` og `app/robots.ts` læser host og returnerer kun det aktuelle sites indhold.
- JSON-LD i artikelsiden: `NewsArticle` med `headline`, `datePublished`, `dateModified`, `author` (Person), `publisher` (NewsMediaOrganization med `publishingPrinciples`-URL), `contentLocation`, `correction` (hvis rettet), `isAccessibleForFree: true`.
- Sektions- og områdesider: `CollectionPage` + `BreadcrumbList`.

## 7. Tests

Eksisterende tests i `cms/tests/*.test.ts` køres med `npm test`. Tilføj mindst:
- `site.test.ts` — host-opslag, fallback, ukendt host.
- `taxonomy.test.ts` — maks. to niveauer, reserverede slugs, slug-kollision artikel/undersektion.
- `marking.test.ts` — alle fem mærkede typer (se governance.md).
- `frontpage.test.ts` — udløb af fastgørelse, kvoteloft.
- `submission.test.ts` — validering, honeypot, ingen auto-publicering.
