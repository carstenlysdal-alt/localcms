# [By]Lokalt — Kort Koncept & Projekt-Pitch

> **Brug denne fil som prompt/kontekst, når du beder en ny sprogmodel udvikle features på projektet.**

---

## 1. Formål (Purpose)
At genrejse og styrke den lokale, tillidsbårne journalistik i danske kommuner gennem en bæredygtig og uafhængig platform. Projektet bryder med clickbait og uigennemskuelige annonce-netværk ved at tilbyde læserne en hurtig, troværdig og 100 % transparent lokal nyhedskilde.

---

## 2. Konceptet
- **Netværket "[By]Lokalt":** En skalerbar multi-tenant platform for hyperlokale medier. Første reference-site er **SlagelseLokalt** (`slagelselokalt.dk`), bygget til let udrulning i andre byer (f.eks. RoskildeLokalt, RingstedLokalt).
- **Redaktionel uafhængighed & mærkning:** Fuld gennemsigtighed. Alt indhold er teknisk håndhævet med tydelig mærkning: *Uafhængigt redaktionelt*, *Partner (støtte)*, *Sponsoreret (annonce)* eller *Brugerindsendt*.
- **Borgerinddragelse & tips:** Tovejs-dialog via en integreret 3-trins wizard (`/indsend` / `/tip-os`), hvor borgere og foreninger nemt indsender historier, tips og billeder.
- **Ingen invasive trackere:** Ingen tredjeparts-annoncenetværk, cookieskærme eller intrusive tracking-scripts.

---

## 3. Hvad er bygget? (Tech Stack & Status)
- **Frontend & App:** Next.js 16 (App Router, Turbopack, TypeScript, Vanilla CSS designsystem baseret på `files/DESIGN.md`).
- **Backend & Data:** Prisma ORM med fleksibel multi-site datamodel (`Instance`-tabel — intet byspecifikt er hardkodet).
- **To adskilte miljøer:**
  1. **Offentlig Frontend (`/(site)`):** Forside med dynamisk layout, sektioner & undersektioner, kortmoduler, artikelsider med mærknings-badges, søgning, kalender og indsendelses-flow.
  2. **Redaktions-CMS (`/redaktion`):** Artikelredigering, forsidestyring, mediearkiv, takst-/honorarstyring, opgavestyring, chat og metrik-dashboard (`/redaktion/metrikker`).

---

## 4. Retningslinjer til AI/udvikler
1. **Dansk sprog:** Al UI og redaktionel tekst skrives på naturligt dansk.
2. **Multi-tenant integritet:** Hardkod aldrig et bynavn i kernen – hent altid data via `getCurrentSite()` / `Instance`.
3. **Designsystem:** Frontend følger `files/DESIGN.md` (ingen mørk tilstand på frontenden). CMS'et bevarer sit eget administrative design.
4. **Verificering:** Kør altid `npm test`, `npm run lint` og `npm run build` i `cms/` for at sikre, at eksisterende funktionalitet ikke brydes.
