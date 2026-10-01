# Governance — regler, der skal være håndhævet i kode

Kilder: del 1 §8.2-8.3 og §9, del 3 §2.4 og §3.5, del 8 §3.4, del 9 §2. Reglerne gælder hele netværket og kan ikke slås fra pr. site.

## 1. Mærkning (AC-01, udvidet)

| Indholdstype | Påkrævede felter før publicering | Vises på kort | Vises øverst i artiklen |
|---|---|---|---|
| `Uafhængig` | – | Intet | Intet |
| `Partner` | `sponsor`, `labelTekst`, `aftaleId` | Blå badge "Finansieret af [sponsor]" | Boks: "Historien er finansieret af [sponsor] som en del af en støtteaftale. Redaktionen har haft fuld redaktionel kontrol." + link til principper |
| `Sponsoreret` | `sponsor`, `labelTekst` | Rav-ramme + "ANNONCE" | Rav-ramme om hele artiklen + "Annonce fra [sponsor]" |
| `Brugerindsendt` | `afsender` | "Indsendt" + stiplet ramme | "Indsendt af [afsender], redigeret af redaktionen." |
| `AI-assisteret` | `godkendtAf`, `kilder[]` (≥ 1 URL/reference) | "AI-assisteret" + stiplet ramme | "AI-assisteret, redigeret og godkendt af [navn]." + kildeliste |
| `PR` | `afsender` | "Pressemeddelelse" | "Pressemeddelelse fra [afsender]." |

- Implementér i `lib/marking.ts` (`validateMarking`, `assertPublishableMarking`) — udvid, skriv ikke en parallel funktion.
- Server actions afviser publicering; editoren viser fejlen (eksisterende mønster).
- Mærkningstekster kommer fra `Instance.markingTekster`, men **felt-kravene** er hardkodede.
- Frontend: `ContentLabel` og `MarkingBox` er de eneste komponenter, der må vise mærkning. Ingen side må rendere en mærket artikel uden dem.

## 2. AI og citater (del 9 §2)

- Indholdstypen `AI-assisteret` kan kun publiceres af en bruger med publiceringsret, og `godkendtAf` sættes til den godkendende bruger (ikke fritekst).
- En `quote`-blok i en AI-assisteret artikel kræver `kildeUrl` (eller kildereference) og `dato` i blokdata. Udvid Zod-skemaet i `lib/blocks/schema.ts` med valgfri felter, og håndhæv kravet i `validateMarking`/publicerings-action.
- Risikoklasser: artikler i Krimi og retsvæsen, Sundhed samt artikler med navngivne privatpersoner **må ikke** have indholdstypen `AI-assisteret` uden journalistisk gennemskrivning. MVP: bloker `AI-assisteret` i undersektionerne "Krimi og retsvæsen" og "Sundhed" (konfigurerbar liste pr. site, standard disse to).

## 3. Kvoteloft (del 1 §8.3 punkt 4, del 8 §3.4)

- Andel = støttefinansierede (Partner + Sponsoreret) placeringer ÷ alle placeringer i forsidezonerne for de seneste 7 dage, **pr. site**.
- Loft fra `Instance.kvoteloftProcent` (standard 25).
- Forsidestyringen advarer, når en ny placering bringer andelen over loftet. MVP: advarsel, ikke blokering. Advarslen logges.
- Netværksaftaler tælles på hvert site for sig.

## 4. Adskillelse af salg og redaktion (del 1 §8.2-8.3)

- Rollen for partnerskab/salg må **ikke** have `article.publish`, må ikke redigere artikler og må ikke se kildeoplysninger.
- Supporterdashboardet (`/partner`) er læseadgang til egen aftale. Ingen forhåndsvisning af upublicerede artikler.
- Fast tekstboks i dashboardet med begrænsningerne fra del 4 §8.2.

## 5. Indsendt materiale (CMS-07, del 9 §3)

- Ingen automatisk publicering. En indsendelse bliver kun til en artikel ved en redaktionel handling.
- Rettighedserklæring og samtykke er obligatoriske felter og følger med til artiklen.
- Spamværn: honeypot-felt + simpel rate limit pr. IP (i hukommelse eller DB). Ingen CAPTCHA fra tredjepart.
- Uploads: kun billeder (JPG/PNG/WebP), maks. 10 MB, genbrug `lib/media.ts`-validering.

## 6. Privatliv

- Ingen tredjepartsscripts, trackere eller eksterne skrifttyper ved runtime (next/font selv-hoster).
- Nyhedsbrevstilmelding gemmer e-mail, samtykketidspunkt og site. Afmelding via link.
- Visningstælling (X-03) må kun være aggregeret pr. artikel og dag, uden IP eller cookies.

## 7. Tests, der skal findes

| Test | Beviser |
|---|---|
| Publicering af hver af de fem mærkede typer uden påkrævede felter fejler | §1 |
| Publicering med felterne lykkes | §1 |
| AI-assisteret artikel med citat uden kilde fejler | §2 |
| AI-assisteret i "Krimi og retsvæsen" fejler | §2 |
| Kvoteloft-beregning pr. site; netværksaftale omgår ikke loftet | §3 |
| Salgsrolle kan ikke publicere eller redigere | §4 |
| Indsendelse opretter aldrig en publiceret artikel | §5 |
| Offentlige queries returnerer kun `Publiceret` fra det aktuelle site | Arkitektur §2 |
