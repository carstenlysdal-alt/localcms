/**
 * Hvilken vært (domæne) forespørgslen gælder — udledt KUN fra kilder vi har grund til at stole på (T5 P2-1).
 *
 * Problem: `X-Forwarded-Host` kan sættes af klienten. Hvis kanten ikke overskriver den, kunne en angriber sende
 * `GET https://slagelselokalt.dk/` med `X-Forwarded-Host: naestvedlokalt.dk`, få Næstveds indhold renderet og — hvis et CDN
 * nøgler cachen på URL — få det cachet under Slagelses adresse (tenant confusion / cache poisoning).
 *
 * Regler (samme tillidsmodel som lib/client-ip.ts):
 *  1. Standard: kun `Host`. Cloudflare bevarer Host, og Railway router på Host, så det er den ægte vært.
 *  2. `X-Forwarded-Host` bruges KUN når TRUST_FORWARDED_HOST=1 er sat udtrykkeligt (kanten skal da garantere, at klientens
 *     værdi overskrives/tilføjes til). Hver betroet proxy TILFØJER til HØJRE, så med TRUSTED_PROXY_HOPS=N tages
 *     elementet N pladser fra højre (default 1), aldrig det venstre (klient-leverede).
 *  3. Ugyldige værdier (tegn uden for værtsnavne, for lange) ignoreres og vi falder tilbage til `Host`.
 *
 * Cache: svar på anonym HTML har `Vary: Host` (se `varyHeaderFor`). Når forwarded host er betroet, varieres der også på
 * `X-Forwarded-Host`, så en CDN aldrig blander byer.
 */

type HeaderReader = Pick<Headers, "get">;

export type HostTrustOptions = {
  trustForwardedHost?: boolean;
  trustedProxyHops?: number;
};

function envFlag(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

export function resolveHostTrustOptions(env: NodeJS.ProcessEnv = process.env): Required<HostTrustOptions> {
  const hopsRaw = env.TRUSTED_PROXY_HOPS;
  const parsed = hopsRaw === undefined || hopsRaw === "" ? 1 : Number.parseInt(hopsRaw, 10);
  const hops = Number.isFinite(parsed) ? Math.min(5, Math.max(1, parsed)) : 1;
  return { trustForwardedHost: envFlag(env.TRUST_FORWARDED_HOST), trustedProxyHops: hops };
}

const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const IPV6_HOST = /^\[[0-9a-f:.]+\]$/i;

/** Gyldigt værtsnavn (evt. med port)? Afviser mellemrum, skråstreg, @, kontroltegn m.m. */
export function isValidHost(raw: string | null | undefined): boolean {
  if (!raw || raw.length > 255) return false;
  const value = raw.trim();
  const m = /^(.*?)(?::(\d{1,5}))?$/.exec(value);
  if (!m) return false;
  const name = value.startsWith("[") ? value.replace(/:\d{1,5}$/, "") : m[1];
  return IPV6_HOST.test(name) || (HOSTNAME.test(name) && name.length <= 253);
}

/** Den betroede vært (evt. med port) eller null hvis ingen gyldig vært findes. */
export function trustedHost(headers: HeaderReader, options: HostTrustOptions = {}): string | null {
  const resolved = { ...resolveHostTrustOptions(), ...Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)) } as Required<HostTrustOptions>;
  if (resolved.trustForwardedHost) {
    const forwarded = headers.get("x-forwarded-host");
    if (forwarded) {
      const entries = forwarded.split(",").map((e) => e.trim()).filter(Boolean);
      const picked = entries[Math.max(0, entries.length - resolved.trustedProxyHops)];
      if (isValidHost(picked)) return picked.toLowerCase();
    }
  }
  const host = headers.get("host")?.trim();
  return isValidHost(host) ? (host as string).toLowerCase() : null;
}

/** `Vary`-værdi til cachebare svar: altid Host; også X-Forwarded-Host når den indgår i tenant-valget. */
export function varyHeaderFor(options: HostTrustOptions = {}): string {
  const resolved = { ...resolveHostTrustOptions(), ...Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)) } as Required<HostTrustOptions>;
  return resolved.trustForwardedHost ? "Host, X-Forwarded-Host" : "Host";
}
