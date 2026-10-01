# Startprompt — kopiér teksten mellem stregerne ind i den nye model

Åbn den nye session med arbejdsmappen `localcms`. Skillet ligger i `.agents/skills/lokalt-medieplatform/` (og er linket ind i `.claude/skills/`).

---

Du skal bygge videre på mit projekt i dette repo (`localcms` — som overtager og fuldstændig erstatter det forældede `Local2027`): Lysdals CMS (Next.js 16 i `cms/`) og den offentlige nyhedsfrontend til mit netværk af lokale nyhedsmedier, "[By]Lokalt". Første site er **SlagelseLokalt** (`slagelselokalt.dk`). Svar mig på dansk, og skriv alle UI-tekster på dansk.

**Start sådan:**

1. Læs skillet `.agents/skills/lokalt-medieplatform/SKILL.md` og dets fire referencefiler (`references/produktkatalog.md`, `arkitektur.md`, `governance.md`, `komponenter.md`). Følg det. Hvis dit værktøj ikke indlæser skills automatisk, så læs filerne direkte.
2. Læs derefter i den rækkefølge, skillet angiver: `cms/HANDOFF.md`, `cms/AGENTS.md` og `files/DESIGN.md`. Konceptdokumenterne `files/01-10` slår du op i, når en opgave kræver det.
3. Kør projektet (`npm install`, `npx prisma db push`, `npm run seed`, `npm test`, `npm run build` i `cms/`), og fortæl mig kort, om alt er grønt, før du ændrer noget.

**Opgaven:**

Byg hele produktkataloget i `references/produktkatalog.md`, fase for fase, i den rækkefølge der står i §0. Det vigtigste er, at sitet er **et nyhedssite med sektioner og undersektioner** efter `files/DESIGN.md` (især §2-6a). Kalender, guide og kommercielle moduler kommer efter nyhedskernen.

Begynd med **fase 1 (fundament)** og **fase 2 (nyhedskernen: layout, kortsystem, forside, sektions- og undersektionssider, artikelside med mærkning, område-, emne- og forfattersider, søgning)**. Kør de to faser i træk. Stop derefter, og vis mig resultatet, før du fortsætter med fase 3.

**For hver fase:**
- Skriv kort, hvad du vil bygge, og hvilke filer og datamodelændringer det kræver.
- Byg det, tilføj tests til ny logik, og verificér i browseren på 375 px og 1440 px.
- Kør `npm test && npm run lint && npx tsc --noEmit && npm run build`. Alt skal være grønt.
- Skriv en arbejdslog øverst i `cms/HANDOFF.md`, opdatér status i produktkataloget, og commit i `cms/`-repoet med en dansk besked, der nævner katalog-ID'erne.
- Rapportér til mig: hvad er bygget, hvilke URL'er jeg skal åbne, og hvad der ikke blev gjort og hvorfor.

**Ufravigelige regler (detaljer i skillet):**
- Den offentlige frontend følger kun `files/DESIGN.md`. Ingen mørk tilstand. Redaktionen (`/redaktion`) beholder sit nuværende design, og de to må ikke blandes.
- Intet hardkodet "Slagelse" i kernen. Alt site-specifikt kommer fra `Instance`.
- Mærkning af partner-, sponsoreret, indsendt, AI-assisteret og PR-indhold er teknisk håndhævet og vises både på kort og øverst i artiklen.
- Ingen genererede citater. Ingen annoncer, trackere eller tredjepartsscripts.
- Kopiér intet fra migogaalborg.dk eller Min By Media.
- Bryd ikke det, der virker i dag.

Spørg mig kun om beslutninger, der reelt er mine (skillet §6: skrifttyper, accentfarve, logo, betaling, nyhedsbrevsudbyder, støttepakker og principper). Alt andet beslutter du selv efter dokumenterne, og du skriver beslutningen i HANDOFF.md.

---

## Når fase 1-2 er godkendt

Skriv til modellen:

> Fase 1-2 er godkendt. Fortsæt med fase 3 og 4 efter samme arbejdsgang, og stop igen bagefter.

Og derefter fase 5-6, 7-8 osv. Hvis du vil lade den køre længere uden stop:

> Kør de resterende MVP-faser i træk (3-8). Stop kun, hvis en beslutning er min, eller hvis build/tests ikke kan blive grønne.
