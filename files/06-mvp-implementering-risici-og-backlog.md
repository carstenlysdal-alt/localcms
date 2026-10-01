# Del 6: MVP, implementering, risici og backlog
### Ny lokal medieplatform for Slagelse Kommune

---

## 1. MVP-afgrænsning

### 1.1 Princip

MVP'en skal bevise to ting samtidig: at der er en redaktion, der kan levere lokalt relevant journalistik i fast kadence, og at der er lokale aktører, der reelt vil betale for at støtte den. Alt, der ikke er nødvendigt for at bevise dette, udskydes.

### 1.2 Funktionstabel

| Funktion | Nødvendigt til lancering | Bygges kort efter (0-6 mdr. post-launch) | Kan vente (6-18 mdr.) | Langsigtet (18+ mdr.) |
|---|---|---|---|---|
| Oprette og publicere artikler (blokeditor, basiskomponenter) | ✔ | | | |
| Kategorier og emnetags | ✔ | | | |
| Geografiske områdetags og -sider | ✔ | | | |
| Billeder + basal mediehåndtering | ✔ | | | |
| Video/lyd-upload og -afspilning | | ✔ | | |
| Grundlæggende kalendermodul (indsend, godkend, vis) | ✔ | | | |
| Historieforslags- og eventformular (CMS-07) | ✔ | | | |
| Manuel forsidestyring (uden automatiske regler) | ✔ | | | |
| Automatiske forsideregler | | ✔ | | |
| Støttepakker: oprettelse, kobling til artikler, manuel kvote-tracking | ✔ | | | |
| Fuldt automatisk kvote-/fakturaflow | | | ✔ | |
| Mærkningssystem (badges, obligatoriske felter) | ✔ | | | |
| Rollebaseret adgang (kernemodel) | ✔ | | | |
| Opgave-/honorarmodul (basalt: opret, tildel, godkend) | ✔ | | | |
| Automatisk honorarberegning | | ✔ | | |
| AI niveau 1 (mærkningskontrol, alt-tekst-udkast, deadline-advarsler) | ✔ | | | |
| AI niveau 2 (omskrivning, SEO-forslag, sociale opslag) | | ✔ | | |
| Skriveassistent, "Spørg"-tilstand (research/kildeopslag) | | ✔ | | |
| Skriveassistent, "Auto"-tilstand (agent-udkast) | | | ✔ | |
| Signals-modul (kun kommunale dagsordener, politi.dk, indsendt materiale) | | ✔ | | |
| Signals-modul, fuld kildebredde inkl. betalt telegrambureau | | | ✔ | |
| Topics-modul (AI-klyngede historieidéer) | | | ✔ | |
| AI niveau 3 (prædiktiv konvertering/churn) | | | | ✔ |
| Grundlæggende SEO (titler, metabeskrivelser, sitemap) | ✔ | | | |
| Strukturerede data (schema.org) | | ✔ | | |
| Nyhedsbrev (ét, ugentligt) | ✔ | | | |
| Segmenterede/emnespecifikke nyhedsbreve | | | ✔ | |
| Basal analyse (GA4/Plausible) | ✔ | | | |
| Intern BI/dashboard | | | ✔ | |
| Kommentarfunktion (afgrænset til udvalgte kategorier) | | ✔ | | |
| Fuld kommentarfunktion på alt indhold | | | ✔ | |
| Brugerprofiler + "følg"-funktion | | ✔ | | |
| Personaliseret "Til dig"-modul | | | ✔ | |
| Supporterdashboard (basalt: aftale, status, materialer) | ✔ | | | |
| Fuldt performance-dashboard til støtter | | ✔ | | |
| Mobilvenligt, hurtigt frontend-site | ✔ | | | |
| Print-magasin/årsudgivelse | | | | ✔ |
| Udvidelse til nabokommuner / multi-tenant | | | | ✔ |

---

## 2. Implementeringsplan

For hver fase: formål, aktiviteter, leverancer, ansvarlig, afhængigheder, risici, beslutningspunkt, succeskriterium.

### Fase 1 — Konceptvalidering (uge 1-4)

- **Formål:** Be- eller afkræfte, at der er reel betalingsvilje blandt lokale virksomheder og foreninger, før teknisk udvikling igangsættes.
- **Aktiviteter:** 15-20 uformelle samtaler med potentielle støtter (bank, ejendomsaktør, 2-3 SMV'er, 2-3 foreninger); konkurrentanalyse af trafik (Similarweb) for sn.dk/VDonline.dk.
- **Leverancer:** Valideret (eller justeret) prisniveau for støttepakker; kvalitativ liste over "hurtige" og "svære" salgscases.
- **Ansvarlig:** Stifter/kommende chefredaktør.
- **Afhængigheder:** Ingen.
- **Risici:** Falsk positiv respons ("det lyder da spændende") uden reel betalingsvilje — modvirkes ved at bede om en uforpligtende hensigtserklæring, ikke kun mundtlig interesse.
- **Beslutningspunkt:** Go/no-go baseret på om mindst 8-10 af de adspurgte udtrykker konkret interesse i at underskrive en hensigtserklæring.
- **Succeskriterium:** Mindst 8 skriftlige hensigtserklæringer om støtte inden fase 3.

### Fase 2 — Forretningsmodel og redaktionelle principper (uge 3-6, delvis parallel med fase 1)

- **Formål:** Låse forretningsmodel, prissætning og de redaktionelle spilleregler, før de kommunikeres til første støtte.
- **Aktiviteter:** Finalisere støttepakker (del 1), udarbejde redaktionelle principper og mærkningsregler som offentliggjort tekst, udarbejde standardkontrakter (støtte + freelance).
- **Leverancer:** Underskriftsklare kontrakter; offentliggørbar "Redaktionelle principper"-side.
- **Ansvarlig:** Chefredaktør + ekstern juridisk rådgivning (medieret/markedsføringsret).
- **Afhængigheder:** Fase 1-indsigter.
- **Risici:** Utilstrækkelig juridisk kvalitetssikring af kickback-modellen ift. markedsføringsloven — afværges ved eksplicit advokatgennemgang, ikke kun intern vurdering.
- **Beslutningspunkt:** Juridisk godkendelse af kontrakttekst.
- **Succeskriterium:** Kontrakter og principper klar til brug ved første salgsmøde.

### Fase 3 — Design og informationsarkitektur (uge 5-9)

- **Formål:** Fastlægge visuel identitet, sitemap og navngivning.
- **Aktiviteter:** Navnevalg og domænesikring; logo/typografi/farvevalg; wireframes af kernesider (forside, artikelside, kategoriside, støtteside, kalenderside).
- **Leverancer:** Brandmanual (let version); klikbare wireframes/designfiler.
- **Ansvarlig:** Designer (freelance/bureau) + chefredaktør.
- **Afhængigheder:** Navneretning fra del 1.
- **Risici:** For meget tid brugt på visuel polering før teknisk fundament — tidsboks designfasen hårdt (max. 4 uger).
- **Beslutningspunkt:** Designgodkendelse.
- **Succeskriterium:** Designsystem klar til implementering.

### Fase 4 — Teknisk arkitektur og opsætning (uge 7-12)

- **Formål:** Etablere teknisk fundament (Model A, jf. del 5).
- **Aktiviteter:** CMS-opsætning, datamodeller (del 3), hosting, CI/CD, grundlæggende sikkerhedskonfiguration.
- **Leverancer:** Kørende CMS med tomme datamodeller; testmiljø.
- **Ansvarlig:** Teknisk konsulent/udvikler.
- **Afhængigheder:** Kravspec (del 3), designsystem (fase 3).
- **Risici:** Scope creep, hvis udvikleren forsøger at bygge Model B-funktionalitet fra start — modvirkes ved skarp reference til MVP-tabellen (afsnit 1).
- **Beslutningspunkt:** Teknisk godkendelse af MVP-arkitektur.
- **Succeskriterium:** CMS og frontend kan udveksle data end-to-end.

### Fase 5 — MVP-udvikling (uge 8-16, overlapper fase 4)

- **Formål:** Bygge de funktioner, der er markeret "Nødvendigt til lancering" (afsnit 1.2).
- **Aktiviteter:** Udvikling, intern test, indholdsmigrering/opsætning af taksonomi.
- **Leverancer:** Funktionsdygtig MVP i testmiljø.
- **Ansvarlig:** Teknisk konsulent + produktansvarlig.
- **Afhængigheder:** Fase 4.
- **Risici:** Underestimering af AI-integrationens kompleksitet (selv niveau 1) — byg buffer på 20 % ekstra tid ind i estimatet.
- **Beslutningspunkt:** Intern acceptance-test bestået (jf. acceptkriterier, del 3).
- **Succeskriterium:** Alle MVP-kriterier fra afsnit 1.2 er funktionsdygtige i testmiljø.

### Fase 6 — Rekruttering af journalister og bidragydere (uge 6-14, parallel)

- **Formål:** Sikre redaktionel produktionskapacitet fra dag ét.
- **Aktiviteter:** Rekruttere et bredere freelancekorps svarende til 2 årsværk (fx 4-6 personer på deltid, bredt dækkende geografi/emner, jf. del 7), lave aftaler om honorarmodel.
- **Leverancer:** Underskrevne freelanceaftaler.
- **Ansvarlig:** Chefredaktør.
- **Afhængigheder:** Honorarmodel (del 2).
- **Risici:** For få lokale freelancere med tilstrækkelig erfaring — afværges ved at kombinere erfarne freelancere med oplæring af lokale talenter/praktikanter.
- **Beslutningspunkt:** Minimum redaktionel dækning sikret (mindst 1 fast bidragyder pr. hovedområde: Slagelse by, Korsør, Skælskør).
- **Succeskriterium:** Freelancekorps svarende til mindst 1 årsværk aktivt ved lancering, optrappet til det fulde mål på 2 årsværk i løbet af år 1-2 (jf. del 7's optrapningsscenarie).

### Fase 7 — Rekruttering af de første støtter (uge 8-16, parallel)

- **Formål:** Konvertere hensigtserklæringer fra fase 1 til underskrevne aftaler.
- **Aktiviteter:** Salgsmøder, kontraktunderskrivelse, opsætning i CMS.
- **Leverancer:** 15-25 underskrevne støtteaftaler ved lancering, voksende mod ca. 30 ved udgangen af år 1 (grundlæggerpakke, jf. del 7, afsnit 3).
- **Ansvarlig:** Salgs-/partnerskabsansvarlig (evt. stifter selv i opstart).
- **Afhængigheder:** Fase 2.
- **Risici:** Konverteringsrate fra hensigtserklæring til betalt aftale bliver lavere end forventet — indbygget i budgetscenarierne (afsnit 3) som lav/middel/høj.
- **Beslutningspunkt:** Minimumsantal støtter nået til at finansiere lancering (se afsnit 3).
- **Succeskriterium:** Mindst 15 betalende støtter ved lancering.

### Fase 8 — Pilotproduktion (uge 14-18)

- **Formål:** Teste hele den redaktionelle produktionskæde i praksis, før offentlig lancering.
- **Aktiviteter:** Producere 15-25 artikler "i mørket" (ikke offentligt tilgængelige), teste workflow fra idé til publicering, teste AI-assistancen i praksis.
- **Leverancer:** Et redaktionelt indholdslager klar til lancering; justeret workflow baseret på erfaringer.
- **Ansvarlig:** Redaktionsleder.
- **Afhængigheder:** Fase 5 og 6.
- **Risici:** Workflowet viser sig for tungt for freelancere, der ikke er vant til strukturerede CMS-krav — afværges med en kort, obligatorisk onboarding-session for alle freelancere.
- **Beslutningspunkt:** Redaktionel kvalitet vurderet lanceringsklar af chefredaktør.
- **Succeskriterium:** Mindst 15 publiceringsklare artikler + en fungerende ugentlig kadence.

### Fase 9 — Test (uge 16-18, overlapper fase 8)

- **Formål:** Teknisk og redaktionel kvalitetssikring før offentlig lancering.
- **Aktiviteter:** Funktionel test mod acceptkriterier (del 3), performance-test (Core Web Vitals), tilgængelighedstest, gennemgang af mærkningssystemets håndhævelse.
- **Leverancer:** Testrapport, prioriteret liste over kritiske fejl (skal rettes) og mindre fejl (kan rettes post-launch).
- **Ansvarlig:** Teknisk konsulent + chefredaktør.
- **Afhængigheder:** Fase 5, 8.
- **Risici:** Tidspres fører til, at mærkningshåndhævelsen (kritisk for troværdighed) nedprioriteres — denne test bør eksplicit være en "no-go"-blokerende test, ikke en "nice to have."
- **Beslutningspunkt:** Lanceringsgodkendelse.
- **Succeskriterium:** Ingen kritiske fejl åbne; mærkningssystemet 100 % funktionelt.

### Fase 10 — Lancering (uge 18-20)

- **Formål:** Offentlig lancering.
- **Aktiviteter:** Offentliggørelse af sitet, første nyhedsbrev, pressemeddelelse om lancering (ironisk nok relevant her), synliggørelse af støtter fra dag ét.
- **Leverancer:** Live, offentligt tilgængeligt medie.
- **Ansvarlig:** Hele teamet.
- **Afhængigheder:** Fase 9.
- **Risici:** Teknisk overbelastning ved lanceringsdagens trafiktop — sikres ved lasttest og CDN-caching (del 5).
- **Beslutningspunkt:** Ingen — lancering er eksekvering af tidligere beslutninger.
- **Succeskriterium:** Sitet er oppe og stabilt; ingen kritiske hændelser første 48 timer.

### Fase 11 — Måling og optimering (uge 20-32)

- **Formål:** Kalibrere forretningsmodel og redaktionel drift på baggrund af reelle data.
- **Aktiviteter:** Ugentlig gennemgang af trafik/konvertering, kvartalsvis rekalibrering af indtægtsmiks (jf. del 1, afsnit 7.1), justering af redaktionel kadence.
- **Leverancer:** Kvartalsrapport til bestyrelse/investorer.
- **Ansvarlig:** Chefredaktør + produktansvarlig.
- **Afhængigheder:** Fase 10.
- **Risici:** For sen reaktion på lav konvertering eller lav trafik — modvirkes ved faste, ufravigelige kvartalsvise "go/adjust/stop"-beslutningspunkter.
- **Beslutningspunkt:** Kvartalsvis fortsæt/justér-vurdering.
- **Succeskriterium:** Trafik- og støttevækst følger (eller overgår) de opstillede scenarier i afsnit 4.

### Fase 12 — Udvidelse (måned 12+)

- **Formål:** Vurdere skalering — flere støtteniveauer, print-tillæg, evt. udvidelse til nabokommune, migrering til Model B.
- **Aktiviteter:** Business case for næste investeringstrin.
- **Leverancer:** Opdateret forretningsplan for år 2-3.
- **Ansvarlig:** Chefredaktør/bestyrelse.
- **Afhængigheder:** Fase 11-data.
- **Risici:** For hurtig geografisk udvidelse udvander den lokale dybde, der er konceptets kernefordel — enhver udvidelse bør kun ske, når kernemarkedet (Slagelse Kommune) har vist sig bæredygtigt alene.
- **Beslutningspunkt:** Investerings-/udvidelsesbeslutning.
- **Succeskriterium:** Positiv business case understøttet af 12 måneders reelle data.

---

## 3. Budgetposter og væsentlige omkostningsdrivere

**Antagelse:** Der er ikke oplyst et budget eller en finansieringskilde i det oprindelige opdrag.
**Konsekvens:** Budgettet er udfoldet i sin fulde form i et selvstændigt dokument — **del 7, "Finansieringsmodel — egen løn og 2 årsværk"** — der regner konkret på målsætningen om 75.000 kr/md i egen løn og et freelancekorps svarende til 2 årsværk, fordelt på et bredere korps af 4-6 deltidstilknyttede journalister. Nedenstående er en kondenseret opsummering; del 7 er den autoritative kilde til alle tal og indeholder desuden optrapningsscenariet fra lancering til fuld indfasning.

| Omkostningspost | Engangs (opstart) | Løbende (månedligt, fuldt indfaset — år 2) |
|---|---|---|
| Teknisk udvikling (MVP, Model A) | 150.000-300.000 kr. | — |
| Design/visuel identitet | 40.000-80.000 kr. | — |
| Juridisk rådgivning (kontrakter, kickback-model) | 20.000-40.000 kr. | — |
| Hosting, SaaS og AI-forbrug (Model A) | — | ~15.000 kr. |
| Egen løn (chefredaktør/direktør) | — | 75.000 kr. |
| Freelancehonorarer (2 årsværk, bredere korps) | — | ~80.000 kr. |
| Let salgs-/adminhjælp + community-/socialmediehjælp | — | ~18.000 kr. |
| Regnskab/forsikring/kontor | — | ~8.000 kr. |
| Markedsføring/lancering | 30.000-60.000 kr. | ~4.000 kr. |
| Diverse/uforudset (~8 % buffer) | 25.000-50.000 kr. | ~17.000 kr. |
| **Samlet estimat** | **265.000-530.000 kr. i opstartsinvestering** | **~221.000 kr./md. ved fuld indfasning (~2,65 mio. kr./år)** |

**De vigtigste omkostningsdrivere** er (1) egen løn og freelancehonorarer tilsammen, som udgør langt størstedelen af den løbende omkostning, og (2) tiden fra lancering til break-even. Del 7 viser et kumuleret underskud på ca. 1,2 mio. kr. i år 1 (hvor kun 1 af de 2 årsværk er nået), hvorefter modellen stort set balancerer i år 2. Det samlede kapitalbehov til at nå fuld indfasning er **ca. 2-2,5 mio. kr.**, inkl. opstartsinvestering og en likviditetsbuffer (jf. del 7, afsnit 3) — væsentligt mere overkommeligt end de tidligere overvejede scenarier med et fuldt fastansat redaktionslag.

**Simpelt scenarie ved fuld drift:** ca. 71 støtteaftaler (fordelt 45 × Pakke 1, 20 × Pakke 2, 6 × Pakke 3, jf. del 7, afsnit 2) genererer ca. 1.590.000 kr./år i støtteindtægt — suppleret af ca. 1.060.000 kr./år fra øvrige indtægtskilder (jobannoncer, sponsorater m.v.), så den samlede omsætning matcher den løbende omkostning på ca. 2,65 mio. kr./år. Dette er en realistisk, om end ikke garanteret, målsætning for Slagelse Kommunes marked — se realismetjekket i del 7, afsnit 2.2.

---

## 4. Risici og afværgeforanstaltninger

| Risiko | Kategori | Sandsynlighed | Konsekvens | Afværgeforanstaltning |
|---|---|---|---|---|
| Kickback-modellen glider i praksis mod betalt omtale | Journalistisk/troværdighed | Middel | Meget høj | Organisatorisk adskillelse salg/redaktion (del 2), teknisk håndhævet mærkning (del 3), kvoteloft, årlig ekstern revision (del 1, afsnit 8.3) |
| For lav konvertering fra hensigtserklæring til betalt støtteaftale | Økonomisk | Middel-høj | Høj | Fase 1-validering før teknisk investering; konservativt startbudget; kvartalsvise go/adjust/stop-punkter |
| Sjællandske Medier reagerer med prispres eller øget lokalt fokus | Konkurrence | Lav-middel | Middel | Differentiering på relation/dybde frem for pris/rækkevidde er svær for en regional koncern at kopiere strukturelt |
| Juridisk udfordring af kickback-modellen (skjult reklame) | Juridisk | Lav-middel | Høj | Ekstern juridisk kvalitetssikring i fase 2; håndhævet mærkning; dokumenteret redaktionel uafhængighed |
| AI-genereret indhold indeholder faktafejl eller opfundne detaljer, der undslipper redaktionel kontrol | Journalistisk/juridisk | Middel | Høj | Obligatorisk diff-visning og menneskelig godkendelse (del 3, AI-governance); ingen auto-publicering |
| Utilstrækkelig moderationskapacitet fører til skadeligt kommentarspor | Presseetisk/juridisk (medieansvarsloven) | Middel | Middel-høj | Afgrænset kommentarfunktion i MVP (del 4, afsnit 5.2), gradvis udvidelse |
| Nøglepersonafhængighed (chefredaktør bærer for mange roller) | Organisatorisk | Høj | Middel-høj | Tidlig ansættelse/tilknytning af redaktionsleder, dokumenterede processer frem for tavs viden |
| Teknisk leverandør/konsulent forsvinder eller leverer dårligt | Teknisk | Lav-middel | Høj | Headless arkitektur med eksportmuligheder (del 5); kontraktlig dokumentationspligt |
| GDPR-brud, særligt vedr. kildeoplysninger eller børn/mindreårige i lokalstof | Juridisk | Lav | Meget høj | Adskilt adgangsniveau til fortrolige data (del 5, afsnit 7); klare samtykkeprocedurer |
| Freelancekorpset er for tyndt til at dække hele kommunen konsekvent | Redaktionel kapacitet | Middel | Middel | Geografisk fordelt rekruttering (fase 6); prioriteret dækningsplan pr. delområde |

---

## 5. Mangler og huller i det oprindelige koncept

Det oprindelige opdrag er ambitiøst og internt sammenhængende, men hviler på en række uafklarede antagelser, som er markeret undervejs i de seks dokumenter. Samlet set er de vigtigste:

1. **Intet oplyst budget eller finansieringskilde.** Uden en afklaring af, om mediet er egenfinansieret, lånefinansieret eller søger ekstern investering/fondsstøtte, kan ambitionsniveauet (fx AI-lag på niveau 2-3 fra dag ét) ikke realistisk vurderes. Løst via budgetscenariet i afsnit 3, men skal valideres af en reel finansieringsplan.
2. **Ingen konkret markedsvalidering.** Opdraget antager, at der er betalingsvillige støtter, men indeholder ingen data herom. Fase 1 i implementeringsplanen adresserer dette, men bør gennemføres, **før** yderligere ressourcer bruges på teknik og design.
3. **Kickback-modellens juridiske robusthed er ikke testet.** Konceptet beskriver principperne rigtigt, men "støtte" er en kommerciel konstruktion, uanset sprogbrug, og bør juridisk kvalitetssikres eksplicit — ikke antages at være i orden, fordi hensigten er god.
4. **Ambitionsniveauet for CMS og AI er sat til et niveau, der typisk ses hos mellemstore mediehuse, ikke hos en lokal opstart.** Hele den oprindelige kravliste er reel og rigtig at have som målbillede, men uden en skarp MVP-prioritering (afsnit 1) risikerer projektet aldrig at komme i luften. Dette er formentlig den enkeltstående største risiko for projektets gennemførlighed.
5. **Moderation og community-funktioner er underspecificerede ift. ressourcebehov.** Et åbent kommentarspor på et lokalmedie i en kommune med kendte polariserende sager (fx den nævnte retssag om skyderi ved Næsby Strand, som er dækket af regionale medier) kan hurtigt blive en presseetisk og juridisk belastning uden dedikeret moderation — adresseret med en gradvis udrulning (del 4).
6. **Forholdet til kommunen som nyhedskilde vs. mulig "støtte" er ikke eksplicit afklaret i originalopdraget.** Det er tilføjet som et ufravigeligt princip i del 1, afsnit 4, men bør fremhæves som en bevidst, kommunikeret beslutning fra dag ét.
7. **Ingen eksitstrategi eller governance ved vækst/salg er beskrevet.** Hvis mediet lykkes og senere selv bliver attraktivt for opkøb (jf. konsolideringen i det eksisterende marked, del 1 afsnit 3.1), bør det allerede fra stiftelsen overvejes, hvordan den redaktionelle uafhængighed sikres uafhængigt af fremtidigt ejerskab (fx via en fondskonstruktion eller vedtægtsbestemte principper) — en model flere danske uafhængige medier har valgt netop for at undgå den konsolideringsdynamik, der ses hos Sjællandske Medier.

---

## 6. Endelig anbefaling

Byg mediet. Markedet har en reel, dokumenterbar åbning: én dominerende, regionalt organiseret konkurrent uden strukturelt incitament til kommunal dybde, en voksende befolkning af tilflyttende børnefamilier, og et fravær af et seriøst, relationsdrevet alternativ. Konceptets kerneidé — støtte frem for annoncesalg, konstruktiv men ikke konfliktsky journalistik, fleksibel freelanceorganisation — er sund og kan bæres teknisk af en beskeden, headless CMS-løsning (Model A) uden at kompromittere den redaktionelle ambition.

Men rækkefølgen er afgørende: **valider betalingsvilje, før der bygges teknik; lås de redaktionelle principper juridisk, før første støtteaftale underskrives; og byg en skarpt afgrænset MVP, ikke den fulde kravliste.** Den største trussel mod projektet er ikke konkurrence fra Sjællandske Medier — det er risikoen for, at et for ambitiøst første udkast aldrig når i luften, eller at en for løst styret kickback-model undergraver troværdigheden, før mediet har fået etableret sig.

---

## 7. Prioriteret liste over de næste 10 konkrete handlinger

1. Gennemfør 15-20 uformelle salgssamtaler med potentielle grundlæggerstøtter for at teste betalingsvilje (fase 1).
2. Sikr domænenavn og foretag et endeligt navnevalg blandt retningerne i del 1, afsnit 2.2.
3. Bestil en ekstern juridisk vurdering af kickback-modellen ift. markedsføringsloven og presseetiske regler.
4. Udarbejd og lås de tre støttepakkers pris og indhold baseret på reelle tilbagemeldinger fra trin 1.
5. Skriv og offentliggør (som klar tekst, ikke kun internt dokument) mediets redaktionelle principper og mærkningsregler.
6. Identificér og indgå aftale med en teknisk konsulent/udvikler til Model A-implementeringen.
7. Rekruttér de første 4-6 faste freelancejournalister/fotografer med geografisk spredt lokalkendskab.
8. Igangsæt designforløb for visuel identitet (logo, typografi, farver) parallelt med teknisk opsætning.
9. Byg og test mærkningssystemet og den redaktionelle godkendelseskæde i CMS'et som første tekniske prioritet — før øvrige features.
10. Fastlæg et konkret startbudget og finansieringskilde baseret på scenarierne i afsnit 3, og træf en formel go/no-go-beslutning for projektet.

---

## 8. Vigtigste beslutninger, som stifteren skal træffe

- **Finansiering:** Egenfinansiering, lån, ekstern investering eller fondsstøtte — og i hvilket omfang mediets uafhængighed skal beskyttes strukturelt (fx via en fondskonstruktion) mod fremtidigt ejerskifte.
- **Navn og domæne.**
- **Organisationsform:** Enkeltmandsvirksomhed, ApS, eller en fondsejet model fra start (påvirker både troværdighed over for støtter og skattemæssige forhold).
- **Startbemanding:** Hvor mange roller stifteren selv varetager i de første 12 måneder, og hvornår der ansættes en redaktionsleder.
- **Ambitionsniveau for AI ved lancering:** Accept af, at niveau 2-3 AI-funktioner udskydes til efter MVP (anbefalet), eller prioritering af tidlig AI-investering på bekostning af andre funktioner.
- **Risikovillighed ift. kommentarfunktion:** Lancere med afgrænset eller udskudt kommentarspor, kontra fuld åbning fra dag ét.
- **Pris- og pakkeniveau for støtteaftaler**, endeligt fastlåst efter markedsvalidering.
- **Teknologivalg:** Model A som beskrevet, eller en anden konfiguration, hvis stifteren har eksisterende tekniske relationer/præferencer.
- **Udvidelse til netværk på Sjælland:** Om Slagelse-mediet skal være første site i et netværk af kommunespecifikke medier (del 8), med et kapitalbehov på ca. 6-8 mio. kr. i basisscenariet og 10-17 mio. kr. hvis omsætningen pr. indbygger bliver 20 % lavere end antaget. Retningen er lokale medejere pr. kommune (51/49, Slagelse 100 % eget som pilot), hvilket sænker holdingens kapitalbehov med ca. 10-20 % (fra ca. 8,5 til ca. 7,2 mio. kr. i basisscenariet med den oprindelige bemanding, del 8, afsnit 6, og lavere med den revurderede produktionsmodel i del 9). Multi-site-kravene bygges ind i CMS'ets MVP fra start, men selve udvidelsesbeslutningen træffes først, når Slagelse har målt den faktiske omsætning pr. indbygger (Gate 1, del 8, afsnit 5).
- **Lysdals CMS som selvstændigt produkt:** Om det generiske CMS (del 3) udelukkende skal bruges internt til Slagelse-mediet, eller om det er en bevidst ambition at udvikle og senere sælge/licensere det til andre lokalmedier som en selvstændig softwareforretning — med den medfølgende interessekonflikt, hvis det sælges til en konkurrent til Slagelse-mediet (jf. del 3, afsnit 0). Anbefalingen er at udskyde denne beslutning, til Slagelse-instansen har bevist konceptet, men den bør besluttes bevidst, ikke glide ind som en bieffekt af, at systemet er bygget generisk.

---

## 9. Redaktionelt workflow (kort resumé — fuld beskrivelse i del 2)

Idé → Indsendt forslag → Vurdering → Godkendt idé → Tildelt journalist → Research/kildearbejde → Første udkast → Redigering → Faktatjek → Juridisk/etisk kontrol → SEO-optimering → Valg af billeder/medier → Godkendelse (kun ansvarshavende redaktør) → Planlagt → Publiceret → Distribueret → Opdateret → Arkiveret (eller Afvist fra enhver fase før publicering).

---

## 10. Produkt-backlog — epics og user stories (uddrag, prioriteret)

### Epic 1: Artikelproduktion og -publicering (MVP-kritisk)
- Som **journalist** vil jeg kunne oprette en artikel i en blokbaseret editor, så jeg kan strukturere tekst, billeder og faktabokse konsistent.
- Som **redaktør** vil jeg kunne se en artikel i workflow-fasen "Godkendelse" og enten publicere eller sende tilbage med kommentarer, så jeg har fuld kontrol over, hvad der udgives.
- Som **journalist** vil jeg kunne se versionshistorik på en artikel, så ændringer efter publicering er sporbare.

### Epic 2: Mærkning og redaktionel uafhængighed (MVP-kritisk)
- Som **redaktør** vil jeg blive forhindret i at publicere sponsoreret indhold uden udfyldt mærkningsfelt, så vi aldrig utilsigtet bryder vores redaktionelle principper.
- Som **læser** vil jeg tydeligt kunne se, om en artikel er uafhængig, partnerfinansieret eller sponsoreret, allerede i listevisningen, så jeg kan vurdere indholdets karakter uden at klikke ind.

### Epic 3: Støtteaftaler og kickback-levering (MVP-kritisk)
- Som **partnerskabsansvarlig** vil jeg kunne oprette en støtteaftale med et pakkeniveau og en årlig kvote, så leverancer kan spores mod aftalen.
- Som **støtte** vil jeg i mit dashboard kunne se, hvor mange artikler/videoer jeg har tilgode i år, så jeg kan planlægge min brug af aftalen.
- Som **støtte** vil jeg kunne downloade godkendt materiale i et ikke-redigerbart format med korrekt kreditering, så jeg kan bruge det i egne kanaler uden at ændre i det journalistiske indhold.

### Epic 4: Indsendt materiale (MVP-kritisk)
- Som **borger/forening** vil jeg kunne indsende en historieidé eller et arrangement via en formular, så redaktionen kan vurdere det uden at jeg behøver kende nogen på redaktionen.
- Som **redaktionsleder** vil jeg kunne se alle indsendte forslag i én samlet liste, så intet forsvinder i en indbakke.

### Epic 5: Kalender (MVP-kritisk)
- Som **arrangør** vil jeg kunne indsende et arrangement med lokation, tidspunkt og billetlink, så det kan vises i mediets kalender efter godkendelse.
- Som **læser** vil jeg kunne filtrere kalenderen på kategori og delområde, så jeg kun ser relevante arrangementer.

### Epic 6: AI-assistance niveau 1-2 (kort efter MVP)
- Som **journalist** vil jeg kunne få forslag til SEO-titel og metabeskrivelse baseret på min artikeltekst, så jeg sparer tid uden at gå på kompromis med kvalitet.
- Som **journalist** vil jeg kunne se en tydelig sammenligning mellem min originaltekst og en AI-foreslået sproglig korrektur, så jeg selv beslutter, hvad der accepteres.

### Epic 7: Community og distribution (kort efter MVP)
- Som **læser** vil jeg kunne følge et emne eller et lokalområde, så jeg får relevante artikler fremhævet.
- Som **community manager** vil jeg kunne planlægge sociale medieopslag direkte fra en artikel, så distributionen er en integreret del af workflowet, ikke en separat opgave.

### Epic 8: Analyse og rapportering (kan vente)
- Som **chefredaktør** vil jeg kunne se journalistisk produktion pr. støttekrone som et samlet nøgletal, så jeg kan rapportere ansvarligt til bestyrelsen.
- Som **partnerskabsansvarlig** vil jeg kunne se tidlige tegn på faldende engagement hos en støtte (churn-risiko), så jeg kan handle proaktivt (AI niveau 3, langsigtet).
