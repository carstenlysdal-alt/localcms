/**
 * Sikkerhedsheadere som rene funktioner (testbare). Bruges af proxy.ts (CSP med nonce pr. forespørgsel + øvrige
 * headere på svar) og next.config.ts (statiske headere, /uploads/*).
 *
 * CSP-strategi (se docs/ops/EDGE-HARDENING.md for hvordan man skifter fra Report-Only til håndhævelse):
 *  - script-src: 'nonce-…' + 'strict-dynamic' (Next.js sætter nonce på sine egne scripts, og hvert indlæst script
 *    arver tillid). 'unsafe-inline' tilføjes kun som fallback til gamle browsere (ignoreres når nonce findes).
 *    I udvikling tillades 'unsafe-eval' (React-fejlsøgning). Turnstile-origin tillades (fallback uden strict-dynamic).
 *  - style-src: 'self' 'unsafe-inline'. Bevidst: siden bruger React `style={…}`-attributter (by-farver som CSS-variabler)
 *    og style-attributter kan ikke dækkes af nonce. Risikoen ved inline CSS er langt lavere end ved inline scripts.
 *  - Skrifttyper: Next/font self-hoster Google Fonts ved build (ingen kald til fonts.googleapis.com) -> font-src 'self'.
 *  - Billeder: 'self' data: blob: (+ CSP_IMG_HOSTS for eksplicit tilladte fjernværter).
 *  - frame-ancestors 'none', object-src 'none', base-uri 'self', form-action 'self'.
 */

export type CspOptions = {
  nonce: string;
  isDev?: boolean;
  /** Tilføj Turnstile-origin (script/frame/connect). Standard: true. */
  turnstile?: boolean;
  /** Ekstra billedværter, kommasepareret (env CSP_IMG_HOSTS). */
  extraImgHosts?: string;
  reportUri?: string | null;
  upgradeInsecure?: boolean;
  /** Tillad at siden indlejres af eget domæne (kun forside-preview i redaktionen). */
  frameSelf?: boolean;
};

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function hostList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter((h) => /^(https:\/\/)?[a-z0-9.*-]+(:\d+)?$/i.test(h))
    .map((h) => (h.startsWith("https://") ? h : `https://${h}`));
}

export function buildCsp(o: CspOptions): string {
  const turnstile = o.turnstile !== false ? [TURNSTILE_ORIGIN] : [];
  const imgHosts = hostList(o.extraImgHosts);
  const dev = Boolean(o.isDev);
  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", `'nonce-${o.nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : []), ...turnstile]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", ...imgHosts]],
    ["font-src", ["'self'", "data:"]],
    ["media-src", ["'self'", "blob:", "https:"]],
    ["connect-src", ["'self'", ...(dev ? ["ws:", "wss:"] : []), ...turnstile]],
    ["frame-src", [...(turnstile.length ? turnstile : ["'none'"])]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", [o.frameSelf ? "'self'" : "'none'"]],
  ];
  const parts = directives.map(([k, v]) => `${k} ${v.join(" ")}`);
  if (o.upgradeInsecure) parts.push("upgrade-insecure-requests");
  if (o.reportUri) parts.push(`report-uri ${o.reportUri}`);
  return parts.join("; ");
}

/** Report-Only som standard i udvikling; håndhævet i produktion. CSP_REPORT_ONLY=1/0 overstyrer begge. */
export function isCspReportOnly(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env.CSP_REPORT_ONLY;
  if (v === "1" || v?.toLowerCase() === "true") return true;
  if (v === "0" || v?.toLowerCase() === "false") return false;
  return env.NODE_ENV !== "production";
}

export function cspHeaderName(reportOnly: boolean): "Content-Security-Policy" | "Content-Security-Policy-Report-Only" {
  return reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}

export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=(self)",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "usb=()",
  "serial=()",
  "bluetooth=()",
  "interest-cohort=()",
  "browsing-topics=()",
].join(", ");

export type BaseHeaderOptions = {
  /** HSTS kun i produktion over https (aldrig på localhost/http). */
  hsts?: boolean;
  /** X-Frame-Options SAMEORIGIN i stedet for DENY (kun forside-preview). */
  frameSelf?: boolean;
};

/** Headere uden nonce (samme for alle svar). */
export function baseSecurityHeaders(o: BaseHeaderOptions = {}): Record<string, string> {
  const h: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": PERMISSIONS_POLICY,
    "X-Frame-Options": o.frameSelf ? "SAMEORIGIN" : "DENY", // fallback for frame-ancestors (virker også i Report-Only-tilstand)
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
    "X-DNS-Prefetch-Control": "on",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
  if (o.hsts) h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  return h;
}

/** HSTS må kun sendes i produktion over https (direkte eller via x-forwarded-proto bag proxy). */
export function shouldSendHsts(opts: { isProduction: boolean; protocol: string | null | undefined; forwardedProto?: string | null }): boolean {
  if (!opts.isProduction) return false;
  const proto = (opts.forwardedProto?.split(",")[0]?.trim() || opts.protocol || "").replace(/:$/, "").toLowerCase();
  return proto === "https";
}

/** Headere til /uploads/*: brugerleverede filer må aldrig udføres/renderes som sider. */
export const UPLOADS_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  // Offentlige billeder/medier må gerne vises på tværs af egne by-domæner (CORP same-site dækker ikke *.dk-netværket).
  "Cross-Origin-Resource-Policy": "cross-origin",
  "X-Robots-Tag": "noindex",
};
