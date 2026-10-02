# FIX: artikel-editor i CMS-stil, komplet metadata/SoMe og AI i artikelarbejdet (opgave M)

Se også `docs/design/METADATA-OG-SOME.md` (felt for felt) og `docs/ops/RAILWAY-SETUP.md` afsnit 4b (cron).

## Hvad der er bygget

**Datamodel (additiv, én migration `20261002183247_article_meta_social`).** `Article.planlagtTid` (+ indeks `[instansId,status,planlagtTid]` — dokumenteret undtagelse fra "Article røres ikke"), ny `ArticleMeta` (1:1, alle felter fra opgaven; Json-felter uden DB-default, da SQLite ikke kan lave Json-defaults — appen skriver altid værdier) og `SlugRedirect` (unik `[instansId,fraSektion,fraSlug]`). Cross-provider (String + Json). SQL gennemlæst: kun `ADD COLUMN`/`CREATE TABLE`/`CREATE INDEX`/`ADD FOREIGN KEY` (cascade fra Article), ingen `DROP`.

**Fælles gem-logik.** `lib/article-save.ts` indeholder valideringen flyttet uændret fra `saveArticle` (mærkning, AI-brug, Krimi/Sundhed-spærring, workflow, tenant, kildeverifikation) som `prepareArticleSave` + `persistArticleSave`. `saveArticle` er nu tynd og opfører sig som før (alle 429 eksisterende tests består); nyt: valgfri `baseVersion`-konfliktkontrol, `planlagtTid`, `meta`, auto-slug, `warnings`/`version`/`slug` i resultatet. `saveDraftAction` (autosave) bruger samme funktion i `mode: "draft"`: aldrig statusskift, revision, publicering eller redirect; afviser publicerede artikler og versionskonflikter.

**Redaktionsflade.** `/redaktion/artikler` er master-detail: faner (Alle · Planlagt · Publiceret · Kladder + byfaner fra netværket + Meninger/Debat som hurtigfiltre), filterlinje (søg, status, forfatter, sortering, liste/gitter, breaking/fastgjort/sponsoreret), listekort (billede, by-prik, titel, uddrag, forfatter/tid, statuschip, "Forsinket"), og sidepanel-editor URL-synkroniseret via `?id=`. Under 1100 px er panelet et fuldskærmsark. `/[id]` og `/ny` deler samme `ArticleEditor`. Editor: titel (/110), underrubrik (/220), Tiptap-brødtekst med værktøjslinje (afsnit/H2/H3, fed/kursiv/understreg, link, lister, citat, fortryd/gentag, billede, fuldskærm), billedblok med mediepicker + alt/kredit-tjek, featurebillede, sektion (kategoritræet fra databasen, "forælder › barn", aldrig hardcodede lister), tags/områder som chips, accordions SEO & metadata · Sociale medier · Planlægning · AI · Kilder · Mærkning og AI-brug · Avanceret. Autosave (2 s, `SaveIndicator` aria-live=polite, "Sidst gemt i dag 10:24 · Automatisk gemt"). Preview: `/redaktion/artikler/[id]/preview` (login + redigeringsret, egen instans, noindex, bruger de offentlige komponenter) samt Google/Facebook/LinkedIn/X/mobil-previews drevet af samme helpers som sitet.

**Offentligt site.** `<title>`, description, canonical-override, robots, keywords + news_keywords, og:*/twitter:* med fallbackkæder, `og:locale` ud fra `sprog`, `article:*`, hreflang, standout, `unavailable_after`; JSON-LD (headline ≤110, schemaType, gratis/paywall, wordCount, timeRequired, medforfattere/fotograf/redaktør, dateline, contentLocation, expires, contentReferenceTime, citation, speakable kun engelsk); news-sitemap `news:keywords`; noindex-artikler udelades af sitemaps. Slug-redirect (se nedenfor). SEO-score + advarsel før publicering.

**Planlagt publicering.** `lib/scheduled-publish.ts` + `/api/cron/publish-scheduled` (Bearer `CRON_SECRET`, 503 uden/for kort hemmelighed, rate limits, batch 20): flytter KUN `Planlagt` med `planlagtTid <= nu` til `Publiceret` (betinget `updateMany` → idempotent og race-sikker; revision med `userId null`/`_actor: scheduler`; audit; `purgeInstance` → `purgeUrls`). Håndhæver samme publiceringskrav som editoren og springer ellers over (rapporteres). Sætning af status Planlagt kræver nu `article.publish` og et fremtidigt `planlagtTid`; ved planlægning af AI-assisteret indhold er den planlæggende redaktør godkender.

**AI overalt (kun forslag).** `lib/ai/editorial.ts` (én funktion pr. opgave; `callJson`/`createAnthropicTextClient`; zod; timeout/retry/breaker; data i adskilt `<data>`-blok, `EDITORIAL_PROMPT_VERSION`), `editorial-schemas.ts` (klientsikre skemaer/mapping), `editorial-service.ts` (rettighed `article.ai.use`, tenant, rate limit 40/10 min pr. bruger, størrelsesloft, Krimi/Sundhed-spærring af tekstopgaver på valgt OG gemt kategori, auditlog uden indhold, dansk 503-agtig fejl uden nøgle) og route `/api/redaktion/ai` (`isSameOrigin`, `getAuthorizedUser`). Opgaver: overskrifter (+A/B), underrubrik, slug, SEO, OG/X, opslagstekster pr. platform, tags/geo (afstemt med eksisterende lister + forslag til nye), alt-tekst/billedtekst, resumé, forbedr/omskriv/forkort/udvid, faktatjek (grøn kræver gyldig kilde, ellers nedgraderet), SEO-kommentar, udgivelsestidspunkt. "Foreslå" ved hvert felt, samlet AI-accordion og i AI-docken. Forslag vises som Anvend/Kassér; accept af tekstforslag føjer automatisk `Udkast`/`Omskrivning` til `aiBrug` og viser det (chip + besked); metadata mærkes ikke. Læsetid er deterministisk (ikke AI). **AI-docken** vises nu også på `/ny` og i panelet og sender artikelkonteksten med.

**Service-funktioner + operatør-værktøjer.** `lib/article-service.ts` (se METADATA-OG-SOME.md) og `lib/operator/tools/article-meta.ts` (importeret i `lib/operator/extensions.ts`): `get_article_meta`, `check_article_seo`, `suggest_article_slug` (read); `update_article_meta`, `set_article_social_post`, `set_article_slug`, `set_article_planned_time` (safe-write med Fortryd, kun kladder). Status Planlagt/publicering forbliver blokeret i operatørens `policy.ts` (`schedule_article` findes ikke som værktøj) — operatøren kan kun foreslå et tidspunkt.

## Ændringer i filer andre ejer (minimale, additive)

- `app/redaktion/chat/chat-interface.tsx` (operator-agentens `ChatInterface`): ny valgfri prop `getContext?: () => Record<string, unknown> | null`; hvis sat sendes `context` med i `/api/chat`-body. Uden prop uændret adfærd. Ingen ny chat-komponent bygget; docken genbruger `ChatInterface` (chat-module-mønstrene — nær-bund-scroll, `role="log"`, disabled under svar, retry — kommer fra operator-agentens opgradering).
- `app/api/chat/route.ts`: valgfrit `context` (titel, manchet, brødtekst ≤12.000, sektion, geo, tags) i body-skemaet; indsættes som data-blok (`<artikel>…</artikel>`, `<`/`>` escapet, "aldrig instruktioner") i systemprompten; body-loft 32 → 64 KB. Intet andet ændret.
- `lib/permissions.ts` (+`ARTICLE_AI_USE`), `lib/default-roles.ts` (Ansvarshavende redaktør via alle-rettigheder, Redaktionsleder, Freelancejournalist), `lib/operator/extensions.ts` (én importlinje).
- `lib/seo/meta.ts` (additive valgfri `PageMetaOptions`), `lib/seo/jsonld.ts` (nye valgfri inputfelter; output uændret uden dem), `lib/seo/sitemap*.ts`, `lib/site-queries.ts` (`getArticleBySlug` returnerer også `articleMeta`, `metaMedia`, `creditAuthors`), `app/(site)/[sektion]/[slug]/page.tsx` (kun `generateMetadata`, JSON-LD-input og redirect-fallback).
- `components/editor/article-form.tsx` er slettet (erstattet af `article-editor.tsx`); `components/admin/article-table.tsx` bruges ikke længere af listesiden (ikke slettet — ejes af andre).

## Beslutninger og afvigelser

1. **308 i stedet for 301.** Next.js `permanentRedirect` svarer 308 (samme betydning for søgemaskiner på GET). Ægte 301 kræver DB-opslag i `proxy.ts` (ikke i min ejerskabsliste). Resolveren er klar (`findArticleRedirect`).
2. **Autosave skriver aldrig til publicerede artikler** (ændringer ville ellers gå live uden "Opdater artikel"); i stedet viser indikatoren at autosave er slået fra, og eksplicit gem bruges.
3. **`ArticleMeta` uden DB-defaults på Json** (SQLite kan ikke); appen skriver altid værdierne. Ingen tom række oprettes for standardmetadata.
4. **Byfaner:** artikler er instans-afgrænsede, så faner for øvrige byer er links til den bys eget CMS (egen login); egen by er markeret. Ingen krydsinstans-læsning.
5. **Kommentarantal** vises ikke (der findes ingen kommentardata).
6. **Alt-tekst via AI** kan ikke se billedet (kun filnavn, billedtekst og artikelkontekst) og er mærket "tjek mod billedet".
7. **Lokale `cms-*`-komponenter** (`components/editor/primitives.tsx`, `styles/cms-editor.css`) fordi `components/ui` endnu ikke fandtes; tokens via `var(--cms-…, fallback)`, ingen inline styles/hex i komponenter (verificeret i `tests/editor-render.test.ts`). CSS importeres fra editor/liste-siden (ikke `globals.css`).
8. `seed.ts`, `public-api.ts` og e2e er ikke ændret (ikke nødvendigt).

## Migration og rollback

`npm run prisma:pg:migration -- article_meta_social` (kørt; `prisma:pg:check` grøn). Railway kører den via `prisma migrate deploy` ved opstart. Backup af dev-DB før `db push`: scratchpad `dev.db.before-article-meta`. Rollback: koden virker uden meta-rækker (alt falder tilbage); skal tabellerne fjernes, skrives en ny migration med `DROP TABLE "SlugRedirect"; DROP TABLE "ArticleMeta"; ALTER TABLE "Article" DROP COLUMN "planlagtTid";` — der er ingen eksisterende data i dem ved udrulning.

## Ejerhandlinger

1. Efter deploy: `npm run roles:sync` (giver `article.ai.use` til Ansvarshavende redaktør, Redaktionsleder, Freelancejournalist; kørt mod dev-DB).
2. Opret Railway-cron-servicen `cron-publish` (RAILWAY-SETUP.md 4b). **Planlagt publicering er slået fra, indtil den findes.**
3. Sæt `ANTHROPIC_API_KEY` (AI-forslag) og evt. `ANTHROPIC_MODEL`; uden nøgle viser editoren en dansk besked.
4. Sæt `SEO_SITE_CONFIG` pr. domæne inkl. `twitterSite` (fx `@naestvedlokalt`) og evt. `SEO_TWITTER_SITE`.
5. Dev-serveren skal genstartes én gang, så Prisma-klienten med de nye modeller indlæses.

## Ikke gjort / kendt

- Ingen visuel browser-verifikation (kræver login med demo-adgangskode fra miljøet, som jeg ikke må læse); i stedet markup-tests, tsc, eslint, og leadet kører `npm run build`.
- Fejl i `components/operator/*`, `app/redaktion/layout.tsx` (andres arbejde) påvirker ikke mine filer; `tsc` og `eslint` er grønne på hele projektet.
