import { NextResponse, type NextRequest } from "next/server";
import { legacyPathToAscii } from "@/lib/slug";
import { getClientIp } from "@/lib/client-ip";
import { classifyUserAgent, pageLimitPerMinute } from "@/lib/bot/detect";
import { isMaliciousPath } from "@/lib/bot/paths";
import { isBanned, localPageLimit, recordStrike } from "@/lib/bot/ban";
import { declaredBodyTooLarge, PUBLIC_BODY_MAX_BYTES } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { tightenLimit } from "@/lib/bot/detect";
import { originLockAllows, ORIGIN_SECRET_HEADER } from "@/lib/origin-lock";
import { cacheTagForHost, decideCachePolicy } from "@/lib/cache/policy";
import {
  baseSecurityHeaders,
  buildCsp,
  cspHeaderName,
  generateNonce,
  isCspReportOnly,
  shouldSendHsts,
} from "@/lib/security-headers";

/**
 * Rækkefølge (billigst først, alt der kan afvises afvises før det rammer render-stien):
 *  0) Origin-lås (ORIGIN_SECRET i produktion): 403 uden korrekt x-origin-secret (undtagen health/ready/cron).
 *  1) Ondsindede stier (/wp-admin, /.env, /.git, *.php …): lille 404 + strike; eskalerende bans (lib/bot/ban.ts).
 *  2) Aktiv ban + grov lokal sidegrænse pr. IP (strammere for skrabere/headless/tom UA).
 *  3) /redaktion/** kræver session-cookie (ellers redirect til /login).
 *  4) Ældre URL'er med rå/percent-kodede æ/ø/å 301-omdirigeres til ASCII-slug.
 *  5) Sikkerhedsheadere + CSP med nonce pr. forespørgsel; Cache-Control for anonym HTML (lib/cache/policy.ts).
 *
 * /partner/* er BEVIDST offentlig: sponsorer åbner deres side via token-link uden login.
 */

const ASSET_PREFIXES = ["/_next/", "/uploads/", "/media/", "/avatars/", "/icons/", "/og/"];
const CROSS_ORIGIN_PREFIXES = ["/uploads/", "/media/", "/avatars/", "/icons/", "/og/"];

function isAsset(pathname: string): boolean {
  return ASSET_PREFIXES.some((p) => pathname.startsWith(p)) || pathname === "/favicon.ico";
}

function tiny(status: number, headers: Record<string, string> = {}): NextResponse {
  const text: Record<number, string> = { 400: "Bad request", 403: "Forbidden", 404: "Not found", 413: "Payload too large", 429: "Too many requests" };
  return new NextResponse(text[status] ?? "Error", {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...headers },
  });
}

/** Redaktionens forside-preview vises i en iframe på samme domæne. */
const FRAME_SELF_PREFIX = "/redaktion/forside/preview";

function applySecurityHeaders(response: NextResponse, request: NextRequest, pathname: string, cspValue: string | null, reportOnly: boolean) {
  const isProduction = process.env.NODE_ENV === "production";
  const hsts = shouldSendHsts({
    isProduction,
    protocol: request.nextUrl.protocol,
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });
  const frameSelf = pathname.startsWith(FRAME_SELF_PREFIX);
  for (const [k, v] of Object.entries(baseSecurityHeaders({ hsts, frameSelf }))) response.headers.set(k, v);
  if (CROSS_ORIGIN_PREFIXES.some((p) => pathname.startsWith(p))) response.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  if (cspValue) response.headers.set(cspHeaderName(reportOnly), cspValue);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === "production";

  // 0) Origin-lås
  if (
    !originLockAllows({
      secret: process.env.ORIGIN_SECRET,
      isProduction,
      pathname,
      headerValue: request.headers.get(ORIGIN_SECRET_HEADER),
    })
  ) {
    return tiny(403);
  }

  const exemptFromBotChecks = pathname === "/api/health" || pathname === "/api/ready" || pathname.startsWith("/api/cron/");
  const ip = getClientIp(request.headers);
  const ua = classifyUserAgent(request.headers.get("user-agent"));

  if (!exemptFromBotChecks) {
    // 1) Ondsindede stier
    if (isMaliciousPath(pathname)) {
      const { banMs } = await recordStrike(ip);
      return tiny(banMs > 0 ? 403 : 404);
    }
    // 2) Ban + grov sidegrænse (kun sider, ikke statiske filer/API — de har egne grænser)
    if (await isBanned(ip)) return tiny(429, { "Retry-After": "600" });
    if (!isAsset(pathname) && !pathname.startsWith("/api/")) {
      // Nexts forhåndshentning (RSC/prefetch) udløses af ét sidevisning for hvert synligt link og må ikke æde besøgendes
      // sidebudget: den får en egen, højere tæller. Rigtige dokument-hentninger tælles som før.
      const isPrefetch = request.headers.get("rsc") === "1" || request.headers.has("next-router-prefetch");
      const baseLimit = pageLimitPerMinute(ua.kind, Number.parseInt(process.env.PAGE_RATE_LIMIT_PER_MIN ?? "", 10) || 300);
      const res = isPrefetch ? localPageLimit(`rsc:${ip}`, baseLimit * 4) : localPageLimit(ip, baseLimit);
      if (!res.ok) return tiny(429, { "Retry-After": String(res.retryAfterSec) });
    }
  }

  // 2b) Request-hygiejne: offentlige POST'er (formularer, server actions, tracking) er små. /redaktion (uploads, kræver
  // session) og /api/ingest (eget loft) er undtaget. Mangler Content-Length (chunked) fanger rute-handlerne selv grænsen.
  if (
    ["POST", "PUT", "PATCH"].includes(request.method) &&
    !pathname.startsWith("/redaktion") &&
    !pathname.startsWith("/api/ingest/") &&
    declaredBodyTooLarge(request.headers, Number.parseInt(process.env.PUBLIC_BODY_MAX_BYTES ?? "", 10) || PUBLIC_BODY_MAX_BYTES)
  ) {
    return tiny(413);
  }

  // 2c) Intern søgning er dyr (LIKE over artikler): længdeloft på q + grænse pr. IP (strammere for skrabere).
  if (pathname === "/soeg" && request.method === "GET") {
    const q = request.nextUrl.searchParams.get("q");
    if (q !== null) {
      if (q.length > 100 || request.nextUrl.searchParams.getAll("q").length > 1) return tiny(400);
      const limited = await rateLimit({ bucket: "soeg", key: ip, limit: tightenLimit(30, ua.kind), windowMs: 60_000 });
      if (!limited.ok) return tiny(429, { "Retry-After": String(limited.retryAfterSec) });
    }
  }

  const reportOnly = isCspReportOnly();
  const wantsCsp = !pathname.startsWith("/api/") && !isAsset(pathname);

  // 3) /redaktion kræver session
  if (pathname === "/redaktion" || pathname.startsWith("/redaktion/")) {
    const hasSession = Boolean(
      request.cookies.get("authjs.session-token") ??
        request.cookies.get("__Secure-authjs.session-token"),
    );
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      const redirect = NextResponse.redirect(loginUrl);
      applySecurityHeaders(redirect, request, pathname, null, reportOnly);
      redirect.headers.set("Cache-Control", "private, no-store");
      return redirect;
    }
  } else {
    // 4) Legacy-URL'er
    const ascii = legacyPathToAscii(pathname);
    if (ascii) {
      const url = request.nextUrl.clone();
      url.pathname = ascii;
      const redirect = NextResponse.redirect(url, 301);
      applySecurityHeaders(redirect, request, pathname, null, reportOnly);
      return redirect;
    }
  }

  // 5) Videresend med nonce + sikkerhedsheadere
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(ORIGIN_SECRET_HEADER); // hemmeligheden skal ikke ligge i applikationens request-headers
  requestHeaders.delete("x-nonce");
  let csp: string | null = null;
  if (wantsCsp) {
    const nonce = generateNonce();
    csp = buildCsp({
      nonce,
      frameSelf: pathname.startsWith(FRAME_SELF_PREFIX),
      isDev: !isProduction,
      extraImgHosts: process.env.CSP_IMG_HOSTS,
      reportUri: process.env.CSP_REPORT_URI === "off" ? null : process.env.CSP_REPORT_URI || "/api/csp-report",
      upgradeInsecure: shouldSendHsts({
        isProduction,
        protocol: request.nextUrl.protocol,
        forwardedProto: request.headers.get("x-forwarded-proto"),
      }),
    });
    requestHeaders.set("x-nonce", nonce);
    // Next.js udtrækker nonce fra CSP-headeren på forespørgslen (både håndhævet og Report-Only-variant).
    requestHeaders.set(cspHeaderName(reportOnly), csp);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(response, request, pathname, csp, reportOnly);

  // Cache for anonym HTML (se lib/cache/policy.ts for reglerne; aldrig med session-cookie).
  const decision = decideCachePolicy({
    method: request.method,
    pathname,
    cookieHeader: request.headers.get("cookie"),
    hasAuthorization: request.headers.has("authorization"),
    search: request.nextUrl.search,
  });
  if (decision.cacheable && decision.cacheControl) {
    response.headers.set("Cache-Control", decision.cacheControl);
    response.headers.set("Vary", "Host");
    response.headers.set("Cache-Tag", cacheTagForHost(request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || request.nextUrl.host));
  } else if (pathname.startsWith("/redaktion") || pathname === "/login") {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = {
  // Alt undtagen Next.js' hashede statiske filer og favicon. API, /uploads og billed-optimering er med, så origin-låsen og
  // botfilteret dækker dem; proxyen springer CSP/side-regler over for dem (se wantsCsp/isAsset).
  matcher: ["/((?!_next/static|favicon.ico).*)"],
};
