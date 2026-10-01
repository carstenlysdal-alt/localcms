# Del 5: Teknisk arkitektur og sikkerhed
### Ny lokal medieplatform for Slagelse Kommune

---

## 1. Tekstbaseret systemarkitektur

```
                              ┌────────────────────────────┐
                              │        Læsere (web)         │
                              │  Mobil / tablet / desktop   │
                              └──────────────┬───────────────┘
                                             │ HTTPS
                              ┌──────────────▼───────────────┐
                              │   CDN + edge cache (statisk   │
                              │   frontend, billeder, video)  │
                              └──────────────┬───────────────┘
                                             │
                    ┌────────────────────────▼────────────────────────┐
                    │        Frontend (SSG/SSR, jf. afsnit 3)          │
                    │  Forside · artikelside · kategori · kalender     │
                    │  · søgning · profil · partnerdashboard           │
                    └────────────────────────┬────────────────────────┘
                                             │ Publicerings-API (GraphQL/REST)
                    ┌────────────────────────▼────────────────────────┐
                    │              Headless CMS-kerne                  │
                    │  Artikler · taksonomi · medier · brugere/roller   │
                    │  · opgaver/honorar · støtteaftaler · kalender     │
                    └───┬─────────────┬─────────────┬──────────────┬──┘
                        │             │             │              │
             ┌──────────▼──┐  ┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
             │  AI-lag      │  │ Søgeindeks   │ │ Medie-    │ │ Autentifi-  │
             │ (niveau 1-3, │  │ (fuldtekst)  │ │ lager/CDN │ │ kation &    │
             │  del 3)      │  │              │ │ (billede/ │ │ rollestyring│
             │              │  │              │ │ video/lyd)│ │             │
             └──────────────┘  └──────────────┘ └───────────┘ └─────────────┘
                                             │
                    ┌────────────────────────▼────────────────────────┐
                    │         Redaktionelt administrationslag          │
                    │  Kanban · kalender · opgaveliste · forsidestyring │
                    │  (internt, adgangsbegrænset subdomæne)            │
                    └────────────────────────┬────────────────────────┘
                                             │
      ┌───────────────┬────────────────┬─────▼───────────┬────────────────┬─────────────┐
      │  Nyhedsbrev    │  Sociale medier │  Analyse/BI      │  Betaling/      │  Bogføring/  │
      │  (fx Mailchimp/│  (planlægning + │  (GA4/Plausible  │  fakturering    │  løn (fx     │
      │  Klaviyo)      │  publicering)   │  + intern BI)    │  (fx Stripe/    │  e-conomic/  │
      │                │                 │                  │  Reepay + faktura)│  Dinero)   │
      └────────────────┴─────────────────┴──────────────────┴─────────────────┴─────────────┘
```

**Arkitekturprincip:** Headless CMS forrest, adskilt frontend — dette valg begrundes i afsnit 4.

---

## 2. Teknologistakke — tre løsningsmodeller

### 2.1 Model A — Økonomisk MVP-løsning

| Parameter | Valg |
|---|---|
| CMS | Open source headless CMS (fx Strapi eller Directus, selv-hostet eller let managed-tier) |
| Frontend | Next.js (React) med statisk/inkrementel generering |
| Backend | Indbygget i CMS'et (Node.js) |
| Database | PostgreSQL (managed, fx Supabase eller almindelig cloud-udbyder) |
| Hosting | Vercel/Netlify (frontend) + billig VPS eller managed container (CMS) |
| Mediehåndtering | Cloudinary (gratis/lav tier) eller S3-kompatibel storage + billedoptimering |
| Søgning | Postgres fuldtekstsøgning (indbygget, ingen ekstra tjeneste) |
| Login/brugerstyring | Indbygget i CMS + simpelt OAuth til læserprofiler (fx via e-mail-magic-link) |
| Betaling | Stripe eller Reepay til jobannoncer/mindre betalinger; manuel fakturering af støttepakker i opstart |
| Nyhedsbrev | Mailchimp/Brevo (gratis-tier op til et vist abonnenttal) |
| Analyse | Plausible eller GA4 (gratis) |
| Sociale integrationer | Manuel/semi-automatisk (Buffer/Metricool gratis-tier) |
| AI-integration | Direkte kald til Anthropic/OpenAI API for niveau 1-2-funktioner, ingen custom ML |
| Kalender | Custom-bygget modul i CMS'et (ingen tredjepartskalender nødvendig i MVP) |
| Supporterdashboard | Simpelt, indbygget i frontend med begrænset funktionalitet |
| Freelance-/opgavestyring | Custom-bygget, minimalt modul i CMS'et |
| Sikkerhed | Standard managed-hosting-sikkerhed, 2FA på CMS-login |
| Backup | Automatisk daglig databasebackup via hostingudbyder |
| Skalerbarhed | Begrænset — velegnet til de første 12-18 måneder og op til ca. 50-100.000 sidevisninger/md. |
| Vedligeholdelse | Lav-moderat, kræver én teknisk ansvarlig konsulent på deltid |
| Leverandørafhængighed | Moderat (flere små SaaS-afhængigheder, men alle med eksportmuligheder) |
| **Fordele** | Lav startomkostning, hurtig time-to-market, ingen tung infrastruktur at drifte |
| **Ulemper** | Kræver teknisk oprydning/migrering ved vækst; begrænset indbygget AI/BI |
| **Kompleksitet** | Lav-moderat |
| **Omkostningsniveau** | **Antagelse:** ca. 8.000-15.000 kr./md. i driftsomkostninger (hosting, SaaS-abonnementer, AI-API) ved MVP-skala, plus udviklingstimer |

### 2.2 Model B — Professionel skalerbar løsning

| Parameter | Valg |
|---|---|
| CMS | Managed headless CMS (fx Sanity eller Contentful) eller professionelt selv-hostet Strapi/Payload med dedikeret drift |
| Frontend | Next.js med ISR (Incremental Static Regeneration) for høj hastighed ved høj trafik |
| Backend | Dedikerede API-services (Node.js/TypeScript) for opgave-, honorar- og partnerlogik, adskilt fra CMS-kernen |
| Database | Managed PostgreSQL med read-replicas ved behov |
| Hosting | Cloud-udbyder (fx AWS/GCP/Hetzner Cloud) med containerorkestrering (fx enkel Docker/ECS-opsætning) |
| Mediehåndtering | Dedikeret medie-CDN (Cloudinary/Imgix eller cloud-native) med automatisk transskribering til lyd/video |
| Søgning | Dedikeret søgeindeks (Meilisearch eller Elasticsearch) |
| Login/brugerstyring | Dedikeret identitetstjeneste (fx Auth0/Clerk) med rollebaseret adgang |
| Betaling | Stripe/Reepay fuldt integreret med automatisk fakturering og abonnementsstyring |
| Nyhedsbrev | Dedikeret ESP (fx Klaviyo) med segmentering pr. emne/lokation |
| Analyse | GA4 + dedikeret BI-lag (fx Metabase) til intern rapportering på tværs af trafik, konvertering og honorarøkonomi |
| Sociale integrationer | API-baseret automatisk distribution (Meta/LinkedIn Graph API) |
| AI-integration | Custom AI-service-lag med logning, promptversionering og governance-kontrol (jf. del 3, AI-governance) |
| Kalender | Dedikeret kalendermodul med .ics-eksport og evt. ekstern kalenderintegration |
| Supporterdashboard | Fuldt udbygget, selvstændig frontend-sektion med realtidsstatistik |
| Freelance-/opgavestyring | Dedikeret modul med automatisk honorarafregning og eksport til løn/bogføring |
| Sikkerhed | WAF, rollebaseret adgang, audit-logning, penetrationstest før lancering |
| Backup | Automatiseret, geografisk redundant backup med testet gendannelsesplan |
| Skalerbarhed | Høj — understøtter vækst til flere hundrede tusinde sidevisninger/md. og evt. udvidelse til nabokommuner |
| Vedligeholdelse | Moderat-høj, kræver fast teknisk ressource (intern eller fast konsulentaftale) |
| Leverandørafhængighed | Moderat, men med klare exit-strategier (headless arkitektur muliggør CMS-skifte) |
| **Fordele** | Robust, klar til vækst, god AI-governance, professionel partneroplevelse |
| **Ulemper** | Væsentligt højere start- og driftsomkostning; kræver mere teknisk kompetence i organisationen |
| **Kompleksitet** | Moderat-høj |
| **Omkostningsniveau** | **Antagelse:** ca. 25.000-45.000 kr./md. i driftsomkostninger, plus en betydelig initial udviklingsinvestering |

### 2.3 Model C — Avanceret langsigtet løsning

| Parameter | Valg |
|---|---|
| CMS | Specialudviklet eller dybt tilpasset headless CMS med fuldt custom redaktionelt lag, evt. multi-tenant til flere kommuner |
| Frontend | Next.js/edge-rendering med personaliseringsmotor og A/B-test-infrastruktur |
| Backend | Mikroservice-arkitektur (indhold, AI, community, partner/CRM som separate services) |
| Database | Polyglot persistence — relationel database til kernedata, dokumentdatabase til fleksibelt indhold, dedikeret grafdatabase eller vektordatabase til AI-relaterede/relaterede-historie-funktioner |
| Hosting | Fuldt cloud-native, multi-region, autoskalering |
| Mediehåndtering | Fuldt automatiseret pipeline (transskribering, AI-udtræk af nøgleklip, automatisk formattilpasning) |
| Søgning | Elasticsearch/OpenSearch med semantisk søgning (vektor-embeddings) |
| Login/brugerstyring | Fuldt enterprise-identitetslag, SSO til interne brugere |
| Betaling | Fuldt automatiseret abonnements- og partnerøkonomi med dynamisk fakturering |
| Nyhedsbrev | Fuldt personaliseret, AI-assisteret nyhedsbrevsgenerering pr. segment |
| Analyse | Prædiktiv BI (niveau 3-AI, jf. del 3) med churn- og konverteringsmodeller |
| Sociale integrationer | Fuldt automatiseret, AI-optimeret publiceringstidspunkt og formatvalg |
| AI-integration | Dyb integration inkl. eget fine-tunet sprogmodel-lag til lokalt tonefald (langsigtet, ressourcekrævende) |
| Kalender | Fuldt integreret med ekstern eventinfrastruktur (billettering, kommunale kalendere) |
| Supporterdashboard | White-label-klar, kan tilbydes som separat produkt til andre lokalmedier |
| Freelance-/opgavestyring | Fuldt marketplace-lignende modul med bud, ratings og automatisk matching |
| Sikkerhed | Enterprise-niveau: SOC2-lignende kontroller, løbende penetrationstest, formaliseret hændelsesberedskab |
| Backup | Multi-region redundans, katastrofegendannelsesplan med testede RTO/RPO-mål |
| Skalerbarhed | Meget høj — bygget til at kunne skaleres til flere kommuner/regioner |
| Vedligeholdelse | Høj, kræver et egentligt udviklingsteam (internt eller fast partnerbureau) |
| Leverandørafhængighed | Lav (mest custom-bygget), men høj kompleksitet og "bus factor"-risiko |
| **Fordele** | Fuldt differentierende produkt, klar til at blive en platform for flere lokalmedier |
| **Ulemper** | Langt ude af proportion med en enkelt-kommune-opstart; høj udviklingsrisiko |
| **Kompleksitet** | Høj |
| **Omkostningsniveau** | **Antagelse:** flere hundrede tusinde kroner i initial udvikling og 60.000+ kr./md. i drift — kun realistisk med ekstern investering eller efter flere års organisk vækst |

---

## 3. Sammenligning (samlet tabel)

| | Model A — Økonomisk MVP | Model B — Professionel skalerbar | Model C — Avanceret langsigtet |
|---|---|---|---|
| Arkitektur | Headless CMS + Next.js | Headless CMS + dedikerede services | Mikroservices, multi-tenant-klar |
| Egnet fra dag ét | Ja | Nej (for tung til opstart) | Nej |
| Egnet ved 50.000+ besøgende/md. | Nej (kræver migrering) | Ja | Ja |
| Kompleksitet | Lav-moderat | Moderat-høj | Høj |
| Estimeret driftsomkostning/md. | 8.000-15.000 kr. | 25.000-45.000 kr. | 60.000+ kr. |
| Krav til teknisk organisation | 1 deltidskonsulent | Fast teknisk ressource | Udviklingsteam |
| Risiko ved fejlvalg | Lav (let at migrere fra) | Moderat | Høj (svær at afvikle uden tab) |

---

## 4. Anbefalet teknologistak — og begrundelse

**Anbefaling: Model A ved lancering, med bevidst arkitektonisk forberedelse til Model B.**

Begrundelse:

1. **Headless CMS er det rigtige grundvalg uanset skala.** Det adskiller indholdsmodellen fra præsentationslaget, hvilket gør det muligt at starte simpelt (Model A) og senere skifte til en kraftigere CMS-motor (Model B) uden at skulle bygge frontend, taksonomi og redaktionelt workflow forfra.
2. **Open source frem for tung SaaS i opstartsfasen** minimerer bindingen til én leverandørs prismodel, mens mediet stadig har begrænset forhandlingskraft og usikker indtægt.
3. **Specialudvikling fra bunden (Model C) er ude af proportion** med en enkelt-kommune-medievirksomhed i opstart — det er en fejlallokering af de første, knappe kroner, uanset hvor ambitiøst konceptet er.
4. **Hybrid-elementet:** Selvom CMS-kernen i Model A er open source, anbefales det at bruge **managed hosting** (ikke egen server-drift) for database og CMS fra dag ét — det sparer driftstid, der er bedre brugt på redaktion og salg end på serverovervågning.

Skiftet til Model B bør trigges af konkrete tærskler, ikke en fast kalenderdato: fx når trafikken konsekvent overstiger ca. 75.000 sidevisninger/md., når antallet af aktive støtteaftaler overstiger ca. 40-50 (hvor manuel fakturering bliver en reel flaskehals), eller når AI-governance-kravene (fuld logning/audit, jf. del 3) bliver forretningskritiske.

---

## 5. SEO, performance og analyse

### 5.1 SEO-arkitektur

Redigerbare SEO-titler og metabeskrivelser pr. artikel (AI-assisteret udkast, jf. del 3) · canonical-tags (kritisk ved genbrug af pressemeddelelser/AI-omskrevet indhold) · Open Graph-data · strukturerede data efter schema.org: `NewsArticle`, `Event`, `Organization`, `Person` · breadcrumbs · XML-sitemap + dedikeret news-sitemap (for hurtig Google News-indeksering) · intern linkstruktur via de AI-foreslåede relaterede artikler (jf. del 3, niveau 2) · optimerede, responsive billeder med lazy loading · Core Web Vitals som fast del af release-tjeklisten · SSR/SSG via Next.js (jf. afsnit 2) · CDN-caching af statisk indhold · konsekvent 301-redirect-styring ved slug-ændringer · ren arkivstruktur (URL'er ændres ikke ved omkategorisering).

### 5.2 Analyseparametre

Brugere · sidevisninger · engageret læsetid · scroll-dybde · artikelgennemførsel · nyhedsbrevstilmeldinger · delinger · kommentarer · andel tilbagevendende brugere · trafikkilde (direkte/organisk/social) · konvertering til støtte (fra "Bliv støtte"-siden) · effekt af partnerindhold (visninger/klik pr. støttefinansieret artikel, sammenlignet med redaktionelt gennemsnit — bruges internt, ikke til at styre redaktionel prioritering) · lokal geografisk rækkevidde (fordeling på delområder) · indholdsomkostning pr. artikeltype (honorar ÷ visninger) · journalistisk produktion pr. støttekrone (nøgletal til bestyrelsesrapportering, jf. del 6).

**Vigtigt princip:** Performance-data på partnerindhold bruges til rapportering til støtten og til intern økonomistyring — **aldrig** som kriterium for, om en uafhængig historie skal nedprioriteres eller ej.

---

## 6. Integrationer

| Integration | Formål | Prioritet |
|---|---|---|
| Nyhedsbrev (Mailchimp/Brevo → Klaviyo ved skalering) | Distribution, segmentering | MVP |
| Analyse (Plausible/GA4) | Trafik- og konverteringsmåling | MVP |
| Betaling/fakturering (Stripe/Reepay) | Jobannoncer, evt. mindre støttebeløb | MVP (manuel fakturering af hovedparten af støttepakker i opstart) |
| Bogføring (e-conomic/Dinero) | Honorar- og støtteøkonomi | MVP (manuel eksport), automatiseret i Model B |
| Sociale medier (Meta Business Suite/Buffer) | Planlagt distribution | MVP (semi-manuel), fuldt API-baseret i Model B |
| AI-API (Anthropic/OpenAI) | Redaktionel AI-assistance, jf. del 3 | MVP |
| Kortdata (fx OpenStreetMap/Mapbox) | Lokationsvisning i events/geografiske sider | MVP |
| CRM (fx HubSpot, ved skalering) | Støttesalg, pipeline-styring | Model B |
| Presseovervågning/pressemeddelelsestjeneste (fx Ritzau) | Tilgang til pressestof, hvis relevant | Model B, valgfri |

---

## 7. Sikkerhed, GDPR og governance

### 7.1 Persondata og GDPR

- **Dataminimering:** kun nødvendige data indsamles ved brugerregistrering, kildekontakt og nyhedsbrevstilmelding.
- **Samtykke:** eksplicit, opt-in samtykke til nyhedsbreve og evt. personalisering; cookiebanner efter gældende danske/EU-regler med reelt fravalg af ikke-nødvendige cookies.
- **Følsomme oplysninger:** kildeoplysninger markeret fortrolige (jf. del 2, afsnit 4) opbevares adskilt med strammere adgangskontrol end øvrige persondata.
- **Dataeksport og sletning:** brugere kan anmode om indsigt/eksport/sletning af egne data via profilsiden eller ved henvendelse; fortrolige journalistiske kildeoplysninger er undtaget sletteret, hvor det er nødvendigt for dokumentation af offentliggjort materiale (afvejning efter databeskyttelsesreglernes undtagelser for journalistisk virksomhed).
- **Databehandleraftaler:** indgås med alle tredjepartsleverandører, der behandler persondata (hosting, ESP, analyse, betaling).

### 7.2 Adgang og drift

- **2FA** obligatorisk for alle redaktionelle og administrative brugere.
- **Rollebaseret adgang** som beskrevet i del 2, afsnit 6 — teknisk håndhævet, ikke kun proceduremæssig.
- **Logning:** alle publicerings-, rednings- og sletningshandlinger logges med bruger og tidsstempel (jf. versionshistorik, del 3).
- **Sikker filupload:** filtypekontrol og virusscanning på alt brugerindsendt materiale (jf. CMS-07).
- **Beskyttelse mod spam/misbrug:** rate limiting på offentlige formularer, CAPTCHA ved indsendelse.
- **Backup:** daglig automatisk backup (Model A) med testet gendannelse mindst kvartalsvist.

### 7.3 Redaktionel beredskabsplan

- **Rettelser:** synlig rettelsespolitik og -log (fast side, jf. sitemap del 4), med tydelig markering i selve artiklen ved væsentlige faktuelle rettelser.
- **Klager og genmæle:** fast procedure og kontaktvej, ansvarshavende redaktør som slutinstans, med reference til Pressenævnet som ekstern klageinstans.
- **AI-governance:** som beskrevet i del 3, afsnit 3.5 — inkl. periodisk (fx halvårlig) intern gennemgang af AI-brugslog for at sikre, at reglerne efterleves i praksis, ikke kun på papiret.
