import { isIP } from "node:net";

/**
 * Klient-IP udledt KUN fra kilder vi har grund til at stole på. Ét sted, brugt af al rate limiting,
 * tracking, lockout og logning (via `getClientIp` i lib/ratelimit, som re-eksporterer herfra).
 *
 * Tillidsmodel (i prioriteret rækkefølge):
 *  1. TRUST_CLOUDFLARE=1: `CF-Connecting-IP`, men KUN når `CF-Ray` også er til stede (en rigtig Cloudflare-
 *     forespørgsel har altid begge). Forudsætter at origin er låst (ORIGIN_SECRET / Authenticated Origin Pulls),
 *     ellers kan enhver forfalske headeren ved at ramme originen direkte.
 *  2. `X-Forwarded-For`: hver betroet proxy TILFØJER den adresse den så til HØJRE. Med TRUSTED_PROXY_HOPS=N
 *     tages adressen N pladser fra højre (default 1 = Railways edge-proxy alene; Cloudflare + Railway = 2).
 *     Alt til venstre er klient-leveret og kan forfalskes, så det bruges ikke.
 *  3. Ellers "unknown" (Next.js eksponerer ikke socket-adressen til route handlers; én fælles bucket er
 *     det sikre valg frem for en forfalsket værdi). TRUSTED_PROXY_HOPS=0 slår XFF-tillid fra.
 *
 * IPv6 normaliseres til kanonisk form (små bogstaver, ::ffff:a.b.c.d -> a.b.c.d) og reduceres til sit /64-
 * præfiks, fordi en enkelt ejer typisk har et helt /64 og ellers kunne rotere gratis rundt om grænserne.
 */

export type ClientIpOptions = {
  trustCloudflare?: boolean;
  trustedProxyHops?: number;
};

function envFlag(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

export function resolveClientIpOptions(env: NodeJS.ProcessEnv = process.env): Required<ClientIpOptions> {
  const hopsRaw = env.TRUSTED_PROXY_HOPS;
  const parsed = hopsRaw === undefined || hopsRaw === "" ? 1 : Number.parseInt(hopsRaw, 10);
  const hops = Number.isFinite(parsed) ? Math.min(5, Math.max(0, parsed)) : 1;
  return { trustCloudflare: envFlag(env.TRUST_CLOUDFLARE), trustedProxyHops: hops };
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Udvid en gyldig IPv6-adresse til 8 hextets (heltal). Returnerer null hvis ugyldig. */
function expandIpv6(addr: string): number[] | null {
  let work = addr;
  // Indlejret IPv4 i halen (::ffff:1.2.3.4)
  const lastColon = work.lastIndexOf(":");
  const tail = work.slice(lastColon + 1);
  if (tail.includes(".")) {
    if (!IPV4.test(tail)) return null;
    const [a, b, c, d] = tail.split(".").map(Number);
    work = `${work.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = work.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = halves.length === 1 ? head : [...head, ...Array(missing).fill("0"), ...rest];
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    out.push(Number.parseInt(g, 16));
  }
  return out.length === 8 ? out : null;
}

/**
 * Normalisér en rå adresse fra en header: fjerner anførselstegn, port ("1.2.3.4:5678", "[::1]:80") og zone-id.
 * Returnerer kanonisk tekst (IPv4 som er; IPv6 fuldt udvidet, små bogstaver, IPv4-mapped -> IPv4) eller null.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().replace(/^"|"$/g, "");
  if (!value || value.length > 64) return null;
  const bracket = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  if (bracket) value = bracket[1];
  else if (/^[^:]+:\d+$/.test(value) && value.includes(".")) value = value.slice(0, value.lastIndexOf(":"));
  value = value.replace(/%.+$/, "");

  if (IPV4.test(value)) return value;
  if (isIP(value) !== 6) return null;
  const groups = expandIpv6(value.toLowerCase());
  if (!groups) return null;
  // ::ffff:a.b.c.d (IPv4-mapped) -> a.b.c.d
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
  }
  return groups.map((g) => g.toString(16)).join(":");
}

/** Nøgle til rate limits: IPv4 uændret, IPv6 reduceret til /64. */
export function ipToRateKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const groups = ip.split(":");
  return `${groups.slice(0, 4).join(":")}::/64`;
}

type HeaderReader = Pick<Headers, "get">;

/** Den rå (normaliserede, ikke /64-reducerede) betroede klient-IP, eller null. */
export function trustedClientIp(headers: HeaderReader, options: ClientIpOptions = {}): string | null {
  const resolved = { ...resolveClientIpOptions(), ...stripUndefined(options) };

  if (resolved.trustCloudflare) {
    const cf = normalizeIp(headers.get("cf-connecting-ip"));
    if (cf && headers.get("cf-ray")) return cf;
  }

  if (resolved.trustedProxyHops > 0) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      const entries = forwarded.split(",").map((e) => e.trim()).filter(Boolean);
      if (entries.length > 0) {
        // Adressen hver betroet proxy tilføjede ligger til højre; hop N = N. fra højre.
        const picked = normalizeIp(entries[Math.max(0, entries.length - resolved.trustedProxyHops)]);
        if (picked) return picked;
      }
    }
  }
  return null;
}

function stripUndefined(o: ClientIpOptions): ClientIpOptions {
  const out: ClientIpOptions = {};
  if (o.trustCloudflare !== undefined) out.trustCloudflare = o.trustCloudflare;
  if (o.trustedProxyHops !== undefined) out.trustedProxyHops = o.trustedProxyHops;
  return out;
}

/** Klient-IP til rate limiting m.m. ("unknown" når ingen betroet kilde findes). */
export function getClientIp(headers: HeaderReader, options: ClientIpOptions = {}): string {
  const ip = trustedClientIp(headers, options);
  return ip ? ipToRateKey(ip) : "unknown";
}
