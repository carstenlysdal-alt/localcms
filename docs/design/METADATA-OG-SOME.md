# Metadata, Open Graph og SoMe — felt for felt

Alt redigeres i artikel-editoren (`/redaktion/artikler?id=…`, `/redaktion/artikler/[id]`, `/ny`) og gemmes i `Article` (titel, manchet, slug, seoTitel, seoBeskrivelse, sprog, planlagtTid) og den nye 1:1-tabel `ArticleMeta` (resten). Validering: `lib/article-meta.ts` (zod). Offentlig brug: `lib/seo/article-seo.ts` (fallback-kæder), `lib/seo/meta.ts` (Next-metadata), `lib/seo/jsonld.ts` (schema.org), `lib/seo/sitemap*.ts`.

AI-operatøren og andre kaldere skal gå gennem `lib/article-service.ts` (samme validering og rettigheder som editoren) — se "Service-funktioner" nederst.

## Fallback-kæder (første udfyldte vinder)

| Output | Kæde |
|---|---|
| `<title>` | seoTitel → titel (≤ 60 tegn, ordgrænse; layoutets `%s \| By` tilføjes) |
| meta description | seoBeskrivelse → manchet (≤ 155 tegn) |
| canonical | `canonicalUrl` (kun http/https) → artiklens egen URL |
| robots | `robotsNoindex`/`robotsNofollow` + host-reglen; `unavailable_after` fra `udloebTid` (kun indekserbare sider) |
| `og:title` | ogTitel → seoTitel → titel |
| `og:description` | ogBeskrivelse (≤ 200) → seoBeskrivelse → manchet (≤ 155) |
| `og:image` | ogMediaId (mediets egen URL og mål, uden beskæring) → genereret kort `/og/artikel/<slug>.jpg` (cover beskåret 1200×630, ellers genereret tekstkort) |
| `og:locale` | `sprog` → `da`→`da_DK`, `en`→`en_GB`, `en-us`→`en_US`, øvrige `xx_XX` (ikke længere hardcodet) |
| `twitter:card` | twitterCard → `summary_large_image` |
| `twitter:title` / `description` | twitterTitel → og:title / twitterBeskrivelse → og:description |
| `twitter:image` | twitterMediaId → og:image |
| `article:*` | published = publiceretTid; modified = sistSubstantielOpdateringTid → opdateretTid; expiration = udloebTid; section; tags |
| RSS `<description>` | seoBeskrivelse → manchet (uændret) |
| Kladde-preview | uden cover: byens standardkort (`/og/by.jpg`); med cover: coverens URL (kladder har endnu ingen `/og/artikel/…`) |

## Felter

| Felt (DB) | Redigeres under | Bruges offentligt | Fallback / regel |
|---|---|---|---|
| `Article.titel` | Titel (tæller /110) | H1, `headline` (hvis seoTitel tom), kort | påkrævet, ≥ 3 tegn |
| `Article.manchet` | Underrubrik (/220) | manchet, meta description-fallback | valgfri |
| `Article.slug` | SEO & metadata → Slug | URL `/<sektion>/<slug>` | auto fra titel (`slugify`), unikhedstjek (suffix -2, -3), kan overskrives; auto følger kun titlen på ikke-publicerede artikler |
| `Article.seoTitel` | SEO & metadata (/60) | `<title>`, `headline` (≤110) | titel |
| `Article.seoBeskrivelse` | SEO & metadata (/155) | meta description | manchet |
| `Article.sprog` | SEO & metadata | `og:locale`, `inLanguage` | `da` |
| `Article.planlagtTid` | Planlægning | cron `publish-scheduled` | kun status Planlagt publiceres |
| `ArticleMeta.canonicalUrl` | Avanceret | `<link rel=canonical>`, `og:url` | egen URL; ugyldig URL ignoreres |
| `robotsNoindex` / `robotsNofollow` | Planlægning → Synlighed og Avanceret | robots-meta; noindex-artikler udelades af sitemap og news-sitemap | false |
| `keywords` (≤ 20) | Avanceret | `<meta name=keywords>`, schema `keywords` | tags + områder |
| `newsKeywords` (≤ 10) | Avanceret | `<meta name=news_keywords>`, news-sitemap `news:keywords` | udelades |
| `ogTitel` (≤ 95), `ogBeskrivelse` (≤ 200), `ogMediaId` | Sociale medier → Open Graph | og:* | se kæder |
| `twitterCard`, `twitterTitel` (≤ 70), `twitterBeskrivelse` (≤ 200), `twitterMediaId` | Sociale medier → X | twitter:* | se kæder |
| `social` pr. platform `{tekst, hashtags[], link?, utm?}` | Sociale medier (faner) | ikke offentlig; til manuel/automatisk udsendelse | se platformsgrænser |
| `schemaType` | Avanceret | JSON-LD `@type` | NewsArticle / OpinionNewsArticle (Debat) / Article (kommercielt) |
| `isAccessibleForFree`, `paywall.cssSelector` | Avanceret | `isAccessibleForFree`, `hasPart` (WebPageElement) | gratis |
| `dateline` (≤ 80) | Avanceret | `dateline` (kun NewsArticle-typer) | udelades |
| `standout` | Avanceret | `<meta name=standout content=canonical>` | false |
| `laesetidMin` | Avanceret | `timeRequired` (`PT{n}M`) | beregnes: ord ÷ 200 |
| `udloebTid` | Planlægning | `expires`, `unavailable_after`, `article:expiration_time` | — (artiklen fjernes ikke automatisk) |
| `begivenhedTid` | Avanceret | `contentReferenceTime` | — |
| `medforfattere[{authorId?,navn,rolle}]` | Avanceret | Medforfatter → `author`-liste; Redaktør → `editor`; Fotograf/Grafiker/Researcher/Oversætter → `contributor` (med `jobTitle`) | — |
| `kilder[{titel,url?,udgiver?,dato?}]` | Kilder | `citation` (CreativeWork). **Offentligt synlig — aldrig fortrolige kilder** | — |
| `sistSubstantielOpdateringTid` | Avanceret | `dateModified`, `article:modified_time` | opdateretTid |
| `oversaettelser{sprog:{url,titel?}}` | Avanceret | `<link rel=alternate hreflang>` | — |

Øvrige JSON-LD-felter: `wordCount` (ud fra brødtekst), `speakable` **kun** for engelske artikler med manchet (Google understøtter kun engelsk; vælgerne `.site-article-h1`/`.site-article-manchet` findes i markup), `alternativeHeadline` (titel, hvis seoTitel afviger), `contentLocation` (første område). Al JSON-LD serialiseres med `safeJsonLd` (`<`, `>`, U+2028/2029 escapes).

## Platformsgrænser for opslagstekster (`PLATFORM_SPECS`)

Grænsen gælder tekst + hashtags + (hvor platformen viser links i teksten) et link. Hård grænse = valideres ved gem; anbefalet = blød advarsel.

| Platform | Hård grænse | Anbefalet | Hashtags (maks / anbefalet) | Link |
|---|---|---|---|---|
| Facebook | 5.000 (teknisk 63.206) | 480 | 10 / 3 | i teksten |
| Instagram | 2.200 | 300 | 30 / 8 | ikke klikbart: "link i bio" (tælles ikke) |
| LinkedIn | 3.000 | 700 | 5 / 3 | i teksten |
| X | 280 | 250 | 3 / 2 | tæller altid 23 tegn |
| Bluesky | 300 grafemer | 280 | 3 / 2 | i teksten |

UTM: valgfrit pr. platform; standard `utm_source=<platform>`, `utm_medium=social`, `utm_campaign=<slug>`. Delings-linket er artikel-URL + UTM. Hashtags normaliseres (ingen `#`, ingen mellemrum, ingen dubletter, kun bogstaver/tal/_).

## SEO-score ("metadata komplet")

Deterministisk, 100 point (`lib/editor/seo-score.ts`): titel 12 · metabeskrivelse 12 · slug 6 · featurebillede 6 · alt-tekst 6 · tags 8 · område 8 · sektion 6 · forfatter 4 · underrubrik 6 · brødtekst (≥150 ord) 6 · delingsbillede 6 · opslagstekster (≥3 platforme) 8 · kan indekseres 6. ok = fuldt, advarsel = halvt. Vises i editoren og som ADVARSEL (aldrig blokering) før publicering. AI-kommentaren ("SEO-kommentar") lægges ovenpå og ændrer aldrig scoren.

## Slug-omdirigering

Ændres slug eller sektion på en publiceret artikel, oprettes en `SlugRedirect` (peger på artikel-id, ikke på den nye slug → aldrig kæder; tilbageskift rydder rækken; tenant-afgrænset). `getArticleBySlug` returnerer null for den gamle sti, og siden svarer permanent redirect til den nuværende URL. **Bemærk:** Next.js' `permanentRedirect` sender HTTP **308** (ikke 301); for GET-sider er det ens for søgemaskiner. En ægte 301 kræver DB-opslag i `proxy.ts`.

## Service-funktioner (til AI-operatøren m.fl.)

`lib/article-service.ts` — alle tager den autoriserede bruger, går gennem `prepareArticleSave` (mærkning, AI-brug, Krimi/Sundhed-spærring, workflow, tenant) og returnerer `{ok, value|error}`:
`saveArticleDraft`, `updateArticleFields`, `patchArticleDraft` (felter + metadata i ét gem, med "før"-værdier til Fortryd), `updateArticleMeta`, `getArticleMeta`, `setSocialPost`, `suggestSlug`, `isSlugAvailable`, `setArticleSlug`, `scheduleArticle` (kræver `article.publish`), `setPlannedTime`, `getArticleSeoScore`.
Registreret som operatør-værktøjer i `lib/operator/tools/article-meta.ts`: `get_article_meta`, `check_article_seo`, `suggest_article_slug` (read) · `update_article_meta`, `set_article_social_post`, `set_article_slug`, `set_article_planned_time` (safe-write, med Fortryd; kun kladder). Status Planlagt/publicering er blokeret i operatøren (`policy.ts`).
