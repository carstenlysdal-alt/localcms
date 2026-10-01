<!-- FIX-forside-editor: modulær forside + forsideeditor (T11/T12 UI). Ingen commits. Skrevet 2026-10-02. -->
# FIX-forside-editor: modulær forside og drag-and-drop-editor

Bygger oven på backend-laget i `cms/lib/frontpage/**` (uændret: ingen filer i `lib/frontpage/**` er rørt). Spec: `docs/review/T11-T12-spec.md`.

## 1. Hvad findes nu

### Offentlig forside (`app/(site)/page.tsx`)
- Renderes af `resolveFrontpageForRender(site.id)` (kaster aldrig): layoutets moduler i rækkefølge, hvert modul med sine tildelte artikler og korrekt variant (hero, kort, kompakt, liste, tekstlinje). Hvilken kilde der blev brugt (godkendt snapshot, deterministisk, seneste nyt) vises **kun i editoren**.
- Modulkomponenter i `components/site/frontpage/`: `Hero`, `TopGrid`, `BreakingBar`, `SenesteNyt`, `DitOmraade`, `SektionRail` og `Debat` (`rails.tsx`), `AdBreak`, `SponsoreretBreak`, `PartnerBreak`, `EgenPromo` (`breaks.tsx`), `KalenderStrip`, `FraKommunenPolitiet`, `Opslagstavle` (`dynamic.tsx`) og `ModuleRenderer` (type til komponent; ukendte typer ignoreres, tomme moduler skjules). Fælles `FrontpageRender` bruges også af editorens preview.
- Genbrug: `ArticleCard` til kort/kompakt, `CommunityBoardBlock` til opslagstavlen, `LatestTicker` er erstattet af `BreakingBar`. Liste/tekstlinje er nye (findes ikke som kort). Annoncer: `getActiveAds` + `/api/ads/track` (samme motor som `FirstPartyAd`), men egne komponenter, fordi varianterne kort/kompakt/tekstlinje og "tæl først når synlig" ikke findes i `FirstPartyAd`.
- **Mærkning i alle varianter**: `SlotLabel` viser altid `assignment.label.tekst` (også "Uafhængig") som tekst + ikon, i samme DOM-blok som titlen. ArticleCards eget badge skjules med CSS, så der ikke dobbeltmærkes. Placering uden synlig label vises ikke. Annonce-break: fast "Annonce" + annoncør, `rel="sponsored noopener noreferrer"`, ingen kampagne = skjult. Sponsoreret/partner-bokse skjules når de er tomme. Signaler: fast "Maskinindsamlet – ikke redaktionelt vurderet", link til kilde med `rel=nofollow`.
- **Break efter slot N**: inline-breaks renderes af værten (`breakPlan`/`segmentSlots`, også `repeatEvery`); gridet deles i segmenter mellem breaks, så rækker fyldes uden huller. Annonce-breaks får hver deres kampagne (`adIndex`).
- Ingen hardcodet Slagelse-indhold. Per-by accent bevaret via `--site-accent*`. Tidspunkter i Europe/Copenhagen uanset servertid; lister viser dato for ældre artikler.
- **Måling**: `FrontpageTracker` (klient, monteres én gang): IntersectionObserver (≥ 50 % i ≥ 1 s), klik, `sendBeacon` til `/api/frontpage/track`, batchet (flush hvert 3. s og ved pagehide), dedupe og loft pr. sideindlæsning, slår sig fra ved `webdriver`/Do Not Track, ingen PII. Verificeret: impressions landede i `FrontpageSlotMetric`.
- Fast efter modulerne (ikke en del af layoutet): "Bliv en del af journalistikken" og fyrtårnspartnere. Seneste nyt-fallback er kronologisk (backend, `publiceretTid desc`); verificeret i browser.

### Editor (`/redaktion/forside`)
Rettigheder via `getAuthorizedUser` (OR af `frontpage.edit`, `.layout.manage`, `.snapshot.approve`), derefter `can()` pr. handling i både UI og server actions. Faner (ARIA tabs, piletaster, deep link `#forslag`): **Layout**, **Forslag**, **Historik**, **Metrikker** og **Fastgør** (de eksisterende zone-pins, `FrontpageManager`, uændret og nåbar).

**Layout**: bibliotek (alle moduler + 10 skabeloner, søgbar; tilføj/fjern/dublér/skjul), lærred med `@dnd-kit` (pointer, touch med 180 ms forsinkelse, tastatur; danske skærmlæser-meddelelser og instruktion; synlig drop-indikator; knapperne Flyt op/ned som alternativ), inspektør genereret af modulets definition (slots, variant, område, synlighed, tilstand forslag/auto med tydelig advarsel om at auto ikke er aktiv, config-felter ud fra `allowedConfigKeys`), break-punkt-editor ("efter slot N", gentag hver N. i Seneste nyt, skift type), skabelonvælger med bekræftelse (tilføj eller erstat), fortryd/gentag (Ctrl/Cmd+Z), "ugemte ændringer", gem som kladde, konfliktløsning (`expectedVersion`: genindlæs deres version eller overskriv), Publicér med diff-dialog (bagefter: meddelelse om nulstillet godkendelse + knappen "Foreslå forside"), slet kladde, preview-iframe ved 375/768/1440, advarselspanel og AI-panel.
**Forslag**: "Foreslå forside" (AI til/fra, "opret nyt selv om uændret"; danske beskeder for rate-limit, ai-unavailable, no-candidates, AI-fejl med fallback til almindelig rangering), liste over forslag, detalje med status, kilde (AI/almindelig + model), diff mod forsiden lige nu (ny/ændret/flyttet/fjernes/uændret), pr. placering: mærkning, kilde (AI/Regel/Redaktør), prioritet, konfidens, score, pin, rækværksadvarsler og **"Hvorfor står den her?"**. Godkend (dialog med opsummering), Afvis (med begrundelse), Redigér placeringer (træk mellem slots, artikelpulje, Sæt i slot, op/ned/fjern, fortryd; hver ændring gemmes straks via `editSnapshot` og rulles tilbage ved afvisning). Pins og "blokeret af rækværk" vises.
**Historik**: layoutversioner med rul tilbage (bekræftelse) og beslutningslog (`FrontpageDecision`, filtrerbar). **Metrikker**: tilgængelig tabel pr. modul og pr. slot (impressions, klik, CTR) + SVG-søjler/sparkline uden diagrambibliotek, periode 7/14/30 dage.

**Preview-rute** `/redaktion/forside/preview?draft=<id>|live` eller `?snapshot=<id>`: login og forsideretighed kræves (ellers login eller 404), brugerens egen instans (aldrig værten), `noindex`, ingen måling, samme `FrontpageRender` som den offentlige side.

### AI i editoren (alt via servicelaget, altid kun forslag)
(a) "Foreslå layout" og (d) kommandofelt bruger `interpretEditorCommand`; resultatet vises som læsbar liste ("Læg et Sponsoreret boks-break efter slot 3 i Top-grid") med forklaring, afklarende spørgsmål og afviste operationer; **Anvend i kladden** (kan fortrydes) eller **Kassér**; begge valg logges. Fastgørelser (pin) udføres kun med rettigheden `frontpage.edit` og samme regler som den eksisterende pin-handling. (b) "Fyld slots" = `createProposal`. (c) forklaring pr. placering. (e) advarselspanel fra rækværkene (kvoteloft, diversitet, mærkning, tomme slots, AI i hero, samlet pr. modul). Uden nøgle eller rettighed: tydelig dansk besked, resten virker.

## 2. Sådan bruger en redaktør det
1. Layout: vælg skabelon eller byg af moduler, træk i rækkefølgen, indstil moduler og break-punkter, kontrollér advarsler og preview, **Gem kladde**, **Publicér**.
2. Efter publicering er godkendelsen nulstillet (nyt layout). Tryk **Foreslå forside** (fanen Forslag).
3. Gennemgå forslaget (diff, begrundelser, advarsler), justér om nødvendigt, **Godkend**. Først da er forslaget forsiden. Indtil da: sidst godkendte forside, ellers almindelig rangering, ellers seneste nyt.
4. Historik og Metrikker til opfølgning; rul tilbage hvis et layout fejler.

## 3. Kode og filer
- Offentlig: `app/(site)/page.tsx`, `components/site/frontpage/**`, `styles/frontpage.css`.
- Editor: `app/redaktion/forside/{page.tsx, editor-actions.ts, preview/page.tsx, _components/*, _lib/*}`, `styles/frontpage-editor.css`. `actions.ts` (pin-handlinger) er uændret.
- Server actions (`editor-actions.ts`): `getAuthorizedUser`, zod, `instansId` altid fra brugeren, `revalidatePath`, danske fejl for alle servicekoder (`_lib/messages.ts`); `createProposal` har desuden rate limit (10 pr. 10 min pr. bruger).
- Tests (`tests/frontpage-ui-*.test.ts`, 31 tests): reducer/undo/redo, modulflyt og break-punkter, config-formularer til layout, DnD-flyt og diff af placeringer, servicekode-beskeder, preview-adgang, render (mærkning i alle varianter, ukendt modul, break efter slot N, ingen label = ingen artikel), tracker-kø, tidsformat.
- Midlertidigt (slettet igen): et harness `app/fp-harness`, et seed-script og testrækker i dev-databasen (layout, forslag, beslutninger, målinger). Dev-databasen er ryddet; tabellerne var tomme før.

## 4. Verifikation
| Kontrol | Resultat |
|---|---|
| `npx tsc --noEmit` | ren (tidligere fejl i `tests/seed-prod.test.ts` fra en anden agent er væk) |
| `npx eslint` på mine filer | 0 fejl, 0 advarsler (React-compiler-regler overholdt; to bevidste `eslint-disable` med begrundelse) |
| `npm test` | 317 af 318 grønne; den ene fejl er `tests/site-news.test.ts` (`formatRelativeTime` er afhængig af klokkeslæt og fejler efter midnat; ikke min kode) |
| Næstved forside `scrollWidth` | 375: 375, 768: 768, 1440: 1440 (ingen horisontal overflow) |
| Editor `scrollWidth` | 375: 375 (alle faner, i app-skallen) |
| Tastatur-DnD | moduler: mellemrum, piletaster, mellemrum flytter, meddelelser på dansk; slots i forslag: virker, men flytter med ét tastetryks forsinkelse (scroll). Knapper er fuldt alternativ |
| Konsol | ingen applikationsfejl på forsiden; hydreringsfejl i editoren (dnd-kit `aria-describedby`) er rettet med fast `id` på `DndContext` |
| Berøringsmål (forsiden, 375) | alle mine mål ≥ 44 px; to eksisterende knapper i `BlivEnDelAfJournalistikkenBlock` er 42–43 px (ikke min fil) |

Skærmbilleder i `docs/review/screenshots/`: `fp-naestved-forside-{375-hero,375-grid,768-grid,1440-grid,1440-seneste-nyt}`, `fp-slagelse-{annonce-break,kalender-debat-opslag,seneste-nyt-promo}-1440` (midlertidigt layout med break), `fp-editor-{layout-break-1440,layout-375,forslag-redigering-1440,forslag-fejlbesked-1440,metrikker-1440}`.

## 5. Beslutninger
- Standardlayoutet (`forside-standard`) er slankere end den gamle forside: "Det sker"/"Dit nabolag"-søjlen, "Mere fra" og sektionsblokkene er væk, medmindre redaktøren tilføjer `kalender-strip`, `sektion-rail` osv. Det er netop modulerne der skal bære dem. Overvej at udvide standardlayoutet (backend).
- Preview viser den **gemte** kladde (preview-ruten læser fra databasen); ugemte ændringer vises som tydelig besked med "Gem og opdatér". Preview bruger almindelig rangering, ikke et AI-forslag.
- Hver flytning i et forslag gemmes straks (optimistisk, tilbagerulning ved afvisning) frem for en samlet "gem"; det giver øjeblikkelig rækværksvalidering.
- AI-handlinger i editoren logges to gange: selve forslaget af servicen, og redaktørens valg (Anvend/Kassér) via `logAiDecisionAction`.
- Beslutningsloggen og dagligt metrikforløb læses direkte fra databasen i `_lib/loaders.ts` (med `can()`/instans), da servicen ikke har funktioner til det.
- Kalenderstriben bruger artikler mærket arrangement/kalender med `publiceretTid` som dato (der findes ingen startdato i datamodellen); opslagstavlen bruger artikler mærket opslag.

## 6. Åbne spørgsmål
1. **Preview-iframe og sikkerhedsheaders**: hardening-sporet må ikke sætte `X-Frame-Options: DENY`/`frame-ancestors 'none'` på `/redaktion/forside/preview`; den skal være `SAMEORIGIN`/`'self'`, ellers bliver preview tomt.
2. Backend-ønsker (ikke lavet): `listDecisions` i servicen; startdato på kalenderbegivenheder; om `fra-politiet` skal være skjult som standard (specens åbne spørgsmål 5; editoren advarer kun).
3. Skal standardforsiden udvides, så den svarer til den gamle (sektionsblokke, kalender)?
4. Skal "Publicér" automatisk oprette et deterministisk forslag (spec 9)? I dag tilbydes det med én knap.
5. Træk fra biblioteket til lærredet (spec 13) er ikke lavet; moduler tilføjes med knap og flyttes derefter.

## 7. Ikke verificeret (ærligt)
- **Alle login-afhængige flows**: der er ingen kendt lokal demo-adgangskode i seed/README (kun i `.env`, som jeg ikke har brugt), så jeg har ikke logget ind. Editoren er derfor verificeret i browseren via et midlertidigt, nu slettet harness med rigtige data fra dev-databasen uden login (alle server actions svarede korrekt "ingen rettighed", hvilket bekræfter gating), plus komponent- og logiktests. **Ikke set med login**: succesvejen for Gem kladde, Publicér, Godkend, Afvis, Redigér forslag, rul tilbage, createProposal, samt preview-iframen med session. Preview-ruten er verificeret til at omdirigere til login uden session.
- **Rigtige AI-kald** (ingen nøgle): kun fejl-/ikke-konfigureret-stierne og logikken for at vise/anvende operationer (testet med `applyOps`).
- Touch-træk (drag) på rigtig enhed, skærmlæser (kun meddelelses-tekster og ARIA er kontrolleret), automatisk a11y-audit (axe) og farvekontrast-måling af editoren. Offentlig side: kontrast følger eksisterende tokens, ikke målt på ny.
- Annonce-break og de dynamiske moduler er set i browseren på Slagelse med et midlertidigt layout; signalmodulerne (fra kommunen/politiet) havde ingen data og viste derfor ingenting.
- Reduceret bevægelse er implementeret i CSS, men ikke afprøvet med emuleret præference.
