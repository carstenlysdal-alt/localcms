import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";

/** Samme bcrypt-omkostning som login, seed:prod og dummy-hashen i lib/auth.ts. */
export const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST);
}

/** Letlæseligt alfabet: ingen 0/O, 1/l/I (54 tegn). */
export const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const GROUP_SIZE = 6;
const GROUPS = 3;

/**
 * Midlertidig adgangskode: 18 tegn fra et letlæseligt alfabet (≈ 104 bit), vist i tre grupper med bindestreg
 * (XXXXXX-XXXXXX-XXXXXX = 20 tegn). randomBytes + rejection sampling → ingen bias. Logges aldrig.
 */
export function generateTempPassword(): string {
  const limit = 256 - (256 % TEMP_PASSWORD_ALPHABET.length);
  const chars: string[] = [];
  while (chars.length < GROUP_SIZE * GROUPS) {
    for (const byte of randomBytes(32)) {
      if (byte >= limit) continue;
      chars.push(TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length]);
      if (chars.length === GROUP_SIZE * GROUPS) break;
    }
  }
  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i++) groups.push(chars.slice(i * GROUP_SIZE, (i + 1) * GROUP_SIZE).join(""));
  return groups.join("-");
}
