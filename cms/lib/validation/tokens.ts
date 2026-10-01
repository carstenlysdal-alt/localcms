import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * Kryptografisk tilfældigt token til NYE offentlige links (/qa/{token}, /partner/{token} …).
 * 24 bytes = 192 bit entropi, base64url (32 tegn). Eksisterende cuid-tokens virker uændret —
 * opslag sker altid på det lagrede token, uanset format.
 */
export function generateToken(bytes = 24): string {
  return randomBytes(Math.max(24, bytes)).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Konstant-tids sammenligning af to strenge (via hash, så længde ikke lækker). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Rimeligt udseende af et token fra en URL (afviser åbenlys støj før DB-opslag). */
export function looksLikeToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(value);
}
