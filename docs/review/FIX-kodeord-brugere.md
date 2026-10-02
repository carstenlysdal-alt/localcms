# Skift af adgangskode og brugeradministration

Baggrund: CMS'et havde hverken skift af adgangskode eller brugeradministration. Ejeren mistede den midlertidige admin-adgangskode fra `seed:prod` og kunne ikke komme ind. Dette er rettet i denne leverance.

## Hvad der findes

| Funktion | Sted | Bemærkning |
|---|---|---|
| Skift egen adgangskode | `/redaktion/konto` ("Min konto" i sidemenuen) | Nuværende + ny + gentag, vis/skjul, styrkeindikator |
| Tvunget skift ved første login | `app/redaktion/layout.tsx`, `lib/auth.ts` | `mustChangePassword` spærrer alle sider og server actions, kun kodeskift og log ud virker |
| Brugeradministration | `/redaktion/brugere` | Kræver `users.manage`; kun egen instans |
| Nulstil via terminal | `npm run user:reset-password -- --email <e-mail> --force` | Udskriver en ny midlertidig adgangskode én gang |
| Seed | `npm run seed:prod -- --force` | Admin oprettes med `mustChangePassword=true` |
| Login-side | `/login` | "Glemt adgangskode? Kontakt en administrator." |

## Politik for adgangskoder (`lib/password-policy.ts`)
- Mindst 12 tegn og højst 72 bytes (bcrypt-grænsen).
- Må ikke være e-mailen eller navnet, ikke en almindelig adgangskode og ikke den nuværende.
- bcrypt cost 12 (`lib/password.ts`). Den nuværende adgangskode kontrolleres med `bcrypt.compare`.
- Rate limit pr. bruger og pr. IP (fail-closed) og lockout efter 5 forkerte nuværende adgangskoder pr. 15 minutter.

## Sessioner
- Ved login sættes claimet `authTime` i JWT'en (ikke `iat`, som Auth.js gen-signerer ved forlængelse).
- JWT-callbacken afviser tokens, hvor brugeren er slettet/deaktiveret, eller hvor `authTime` ligger før `passwordChangedAt`. `getSessionState` og `getAuthorizedUser` tjekker det samme i databasen.
- Ved skift af adgangskode dør alle andre sessioner; den nuværende får en frisk session.
- Pris: én ekstra databaselæsning pr. `auth()`-kald.

## Brugeradministration (`users.manage`)
- Liste, opret (engangsadgangskode vist én gang med kopiér-knap), nulstil adgangskode, skift rolle, deaktiver/aktivér og liste over seneste handlinger.
- Engangsadgangskoder er 18 tegn fra et læsbart alfabet (`randomBytes` med rejection sampling). Kun hash gemmes, og den logges aldrig.
- `instansId` kommer altid fra udførerens databaserække, aldrig fra klienten.
- Den sidste aktive bruger med `users.manage` kan ikke nedgraderes eller deaktiveres (Serializable-transaktion).
- Ingen rettighedseskalering: man kan kun tildele roller og røre brugere, hvis rolle er en delmængde af ens egne rettigheder.
- Alle handlinger skrives til `AuditLog` (hvem, hvad, hvem det ramte; aldrig hemmeligheder) og er rate limited.
- Deaktivering i stedet for sletning, fordi revisioner, opgaver og honorar peger på brugeren.

## Schema (additivt)
`User.mustChangePassword`, `User.passwordChangedAt`, `User.deaktiveretTid` og modellen `AuditLog`. Postgres-migration: `prisma/postgres/migrations/20261002144521_user_password_flags` (kører automatisk via `prisma migrate deploy` ved deploy).

## Ejerhandlinger
1. Efter deploy: kør `npm run user:reset-password` for den nuværende admin (se `docs/ops/RAILWAY-SETUP.md`, afsnit "Mistet adgangskode"), log ind, og vælg egen adgangskode i `/redaktion/konto`.
2. `users.manage` ligger allerede på "Ansvarshavende redaktør". Kør `npm run roles:sync` ved behov (sikker, additiv).
3. Lockout og rate limit er kun delt mellem instanser, når `REDIS_URL` er sat (den er sat i Railway).

## Ikke bygget (opfølgning)
- Nulstilling via e-mail ("glemt adgangskode"-link) kræver e-mailudsendelse, som ikke findes endnu.
- Tofaktor-login (MFA).
- Sletning af brugere (kun deaktivering) og rolleadministration i UI.

## Test
Nye tests: `password-policy`, `password-change`, `user-admin`, `reset-password-script`, udvidet `seed-prod`, `pg-schema` og `helpers/mock-session` (authTime, signIn-sporing, AuthError).
