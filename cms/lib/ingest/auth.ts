import { db } from "../db";
import { sha256Hex, safeEqual, generateToken } from "../validation/tokens";
import { getClientIp, rateLimit, rateLimitHeaders } from "../ratelimit";
import { INGEST_SCOPES, type IngestScope } from "./schema";

/**
 * API-nøgler til agent-indtaget.
 *  - Format: lk_<43 tegn base64url> (32 bytes CSPRNG). Klartekst vises KUN ved oprettelse.
 *  - Databasen gemmer kun sha256(hex) af hele nøglen + et ikke-hemmeligt prefix (til visning/log).
 *  - Nøglen er bundet til én instans (ApiKey.instansId); en request kan aldrig vælge en anden.
 *  - Scopes: signals:write | articles:draft | health:read.
 */

export const KEY_PREFIX = "lk_";

export function hashApiKey(key: string): string {
  return sha256Hex(key);
}

export function generateApiKey(): { key: string; prefix: string; hashedKey: string } {
  const key = `${KEY_PREFIX}${generateToken(32)}`;
  return { key, prefix: key.slice(0, 11), hashedKey: hashApiKey(key) };
}

export async function createApiKey(input: { instansId: string; name: string; scopes: readonly IngestScope[]; expiresAt?: Date | null; createdById?: string | null }) {
  const scopes = input.scopes.filter((s) => (INGEST_SCOPES as readonly string[]).includes(s));
  if (scopes.length === 0) throw new Error("Mindst ét gyldigt scope er påkrævet.");
  const { key, prefix, hashedKey } = generateApiKey();
  const record = await db.apiKey.create({
    data: {
      instansId: input.instansId,
      name: input.name.slice(0, 120),
      hashedKey,
      prefix,
      scopes,
      expiresAt: input.expiresAt ?? null,
      createdById: input.createdById ?? null,
    },
  });
  return { id: record.id, prefix, key /* vis kun én gang! */ };
}

export type IngestPrincipal = {
  keyId: string;
  prefix: string;
  instansId: string;
  scopes: string[];
};

export type IngestAuthResult = { ok: true; principal: IngestPrincipal } | { ok: false; response: Response };

function fail(status: number, error: string, extra: Record<string, string> = {}): IngestAuthResult {
  return {
    ok: false,
    response: Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...(status === 401 ? { "WWW-Authenticate": 'Bearer realm="ingest"' } : {}), ...extra } }),
  };
}

export function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S{20,200})$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Autentificér en ingest-request: Bearer-nøgle -> hashopslag -> konstant-tids sammenligning ->
 * ikke tilbagekaldt/udløbet -> scope. Rate limits: 30 fejl/min pr. IP, 120 kald/min pr. nøgle.
 */
export async function authenticateIngest(request: Request, requiredScope: IngestScope): Promise<IngestAuthResult> {
  const ip = getClientIp(request.headers);
  const token = extractBearer(request.headers.get("authorization"));

  if (!token || !token.startsWith(KEY_PREFIX)) {
    const limited = await rateLimit({ bucket: "ingest-authfail", key: ip, limit: 30, windowMs: 60_000 });
    if (!limited.ok) return fail(429, "For mange mislykkede forsøg.", rateLimitHeaders(limited));
    return fail(401, "Manglende eller ugyldig API-nøgle.");
  }

  const hashed = hashApiKey(token);
  const record = await db.apiKey.findUnique({ where: { hashedKey: hashed } });
  // Konstant-tids sammenligning af hashes (opslaget er allerede på unikt hash; dette forhindrer timing-forskelle ved delvist match).
  if (!record || !safeEqual(record.hashedKey, hashed) || record.revokedAt || (record.expiresAt && record.expiresAt.getTime() < Date.now())) {
    const limited = await rateLimit({ bucket: "ingest-authfail", key: ip, limit: 30, windowMs: 60_000 });
    if (!limited.ok) return fail(429, "For mange mislykkede forsøg.", rateLimitHeaders(limited));
    return fail(401, "Manglende eller ugyldig API-nøgle.");
  }

  const scopes = Array.isArray(record.scopes) ? (record.scopes as string[]) : [];
  if (!scopes.includes(requiredScope)) return fail(403, `Nøglen mangler scope '${requiredScope}'.`);

  const perKey = await rateLimit({ bucket: "ingest-key", key: record.id, limit: 120, windowMs: 60_000 });
  if (!perKey.ok) return fail(429, "Rate limit overskredet for denne nøgle.", rateLimitHeaders(perKey));

  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 60_000) {
    await db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }

  return { ok: true, principal: { keyId: record.id, prefix: record.prefix, instansId: record.instansId, scopes } };
}
