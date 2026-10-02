/**
 * Sessionsgyldighed (ren logik, uden afhængigheder — bruges af lib/auth.ts og testes direkte).
 *
 * JWT'en bærer et eget claim `authTime` (ms siden epoch) som sættes ÉN gang ved login. Vi bruger IKKE `iat`:
 * Auth.js gen-signerer token med ny `iat` ved hver forlængelse, så en stjålet session ville ellers kunne holde sig
 * "frisk" og overleve et kodeskift. En session er forældet, hvis den blev udstedt før brugerens `passwordChangedAt`.
 */

export function isSessionStale(authTime: unknown, passwordChangedAt: Date | null | undefined): boolean {
  if (!passwordChangedAt) return false;
  // Tokens uden authTime (udstedt før funktionen fandtes) behandles som udstedt før ethvert kodeskift.
  if (typeof authTime !== "number" || !Number.isFinite(authTime)) return true;
  return authTime < passwordChangedAt.getTime();
}
