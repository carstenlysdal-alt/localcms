## Hvad og hvorfor

<!-- Kort: hvad ændrer PR'en, og hvilket problem løser den? Link til issue/review-fund hvis relevant. -->

## Hvordan er det testet

- [ ] `npm test` (isolerede throwaway-databaser) er grøn
- [ ] `npx tsc --noEmit` og `npm run lint:budget` er grønne
- [ ] `npm run smoke -- http://127.0.0.1:3000` kørt mod en kørende server (ved ændringer i sider, proxy, headers eller API)
- [ ] Manuel kontrol i browser (mobil + desktop) hvis UI er ændret

## Tjekliste

- [ ] Ingen hemmeligheder, nøgler eller rigtige adgangskoder i koden, `.env.example`, tests eller docs (`npm run secrets`)
- [ ] Alle offentlige datalæsninger og -skrivninger er afgrænset til byens instans (`instansId` fra host, aldrig fra klienten)
- [ ] Nye offentlige formularer/endpoints har validering (zod), rate limit og honeypot/Turnstile
- [ ] Prisma-skema ændret? Så er `prisma/postgres/` regenereret (`npm run prisma:pg:schema`) og migration oprettet
- [ ] Nye miljøvariabler er tilføjet i `.env.example`, `lib/env.ts` og Railway-docs
- [ ] Ingen nye ESLint-advarsler (budgettet i `cms/.lint-budget` må ikke stige)

## Risiko og rollback

<!-- Hvad kan gå galt i produktion? Hvordan rulles det tilbage (Railway: Redeploy forrige deployment; DB-migration: se docs/ops/CI.md)? -->
