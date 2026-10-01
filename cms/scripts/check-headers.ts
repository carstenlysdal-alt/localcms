/**
 * Sikkerhedsheader-tjek (securityheaders-lignende) mod en kørende server.
 *
 *   npx tsx scripts/check-headers.ts [--base http://127.0.0.1:3000] [--host naestvedlokalt.localhost:3000]
 *                                    [--origin-secret <hemmelighed>] [--prod]
 *
 *  --base           hvor der forbindes (standard http://127.0.0.1:3000)
 *  --host           Host-header (vælger by; standard naestvedlokalt.localhost:<port>)
 *  --origin-secret  sendes som x-origin-secret (hvis ORIGIN_SECRET er sat på serveren)
 *  --prod           kræv også HSTS, håndhævet CSP og cache-header (kør mod `next start` / produktion)
 *
 * Afslutter med kode 1 hvis et krav fejler. Rører kun GET/HEAD-endpoints.
 */
import { request } from "./check-headers-lib";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

type Check = { name: string; ok: boolean; detail?: string };

function main() {
  const base = arg("base", "http://127.0.0.1:3000")!;
  const port = new URL(base).port || "3000";
  const host = arg("host", `naestvedlokalt.localhost:${port}`)!;
  const originSecret = arg("origin-secret");
  const prod = process.argv.includes("--prod");
  const extra: Record<string, string> = originSecret ? { "x-origin-secret": originSecret } : {};
  if (prod && base.startsWith("http:")) extra["x-forwarded-proto"] = "https"; // simulér Railway/Cloudflare-terminering af TLS (HSTS-tjek)
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, detail });

  return (async () => {
    const home = await request(base, "/", host, extra);
    const h = home.headers;
    const csp = String(h["content-security-policy"] ?? h["content-security-policy-report-only"] ?? "");
    const enforced = Boolean(h["content-security-policy"]);

    add("HTTP 200 på forsiden", home.status === 200, String(home.status));
    add("CSP til stede", csp.length > 0);
    add("CSP: nonce + strict-dynamic", /'nonce-[^']+'/.test(csp) && csp.includes("'strict-dynamic'"));
    add("CSP: ingen unsafe-inline/eval i script-src", !/script-src[^;]*'unsafe-(inline|eval)'/.test(csp) || !prod, "unsafe-eval kun tilladt i udvikling");
    add("CSP: frame-ancestors 'none'", csp.includes("frame-ancestors 'none'"));
    add("CSP: object-src 'none', base-uri 'self'", csp.includes("object-src 'none'") && csp.includes("base-uri 'self'"));
    add("X-Content-Type-Options: nosniff", h["x-content-type-options"] === "nosniff");
    add("Referrer-Policy", h["referrer-policy"] === "strict-origin-when-cross-origin");
    add("Permissions-Policy (kamera/mikrofon/geolokation)", /camera=\(\)/.test(String(h["permissions-policy"])) && /microphone=\(\)/.test(String(h["permissions-policy"])) && /geolocation=\(\)/.test(String(h["permissions-policy"])));
    add("X-Frame-Options: DENY", String(h["x-frame-options"]).toUpperCase() === "DENY");
    add("COOP: same-origin", h["cross-origin-opener-policy"] === "same-origin");
    add("CORP til stede", Boolean(h["cross-origin-resource-policy"]));
    add("Ingen X-Powered-By", !h["x-powered-by"], String(h["x-powered-by"] ?? ""));
    if (prod) {
      add("HSTS (kræver https/x-forwarded-proto: https)", Boolean(h["strict-transport-security"]), "send --base https://… eller header x-forwarded-proto");
      add("CSP håndhæves (ikke Report-Only)", enforced);
      add("Cache-Control til CDN (s-maxage + stale-while-revalidate)", /s-maxage=\d+/.test(String(h["cache-control"])) && /stale-while-revalidate/.test(String(h["cache-control"])), String(h["cache-control"]));
    }

    const withCookie = await request(base, "/", host, { ...extra, Cookie: "authjs.session-token=x" });
    add("Aldrig delt cache med session-cookie", !/s-maxage/.test(String(withCookie.headers["cache-control"])), String(withCookie.headers["cache-control"]));

    const red = await request(base, "/redaktion", host, extra);
    add("/redaktion uden session -> redirect til login, private/no-store", red.status >= 300 && red.status < 400 && /no-store|private/.test(String(red.headers["cache-control"])), `${red.status} ${red.headers["cache-control"]}`);

    const api = await request(base, "/api/csp-report", host, extra);
    add("/api/csp-report afviser GET (405)", api.status === 405, String(api.status));

    const wp = await request(base, "/wp-login.php", host, extra);
    add("Ondsindet sti -> lille 404", wp.status === 404 && wp.body.length < 40, `${wp.status} (${wp.body.length} B)`);

    const og = await request(base, "/og/by.jpg?f=999x999", host, extra);
    add("/og med ugyldigt format -> 404", og.status === 404, String(og.status));

    const feed = await request(base, "/feed.xml", host, extra);
    if (feed.status === 200) {
      add("Feed: s-maxage + ETag", /s-maxage/.test(String(feed.headers["cache-control"])) && Boolean(feed.headers.etag), String(feed.headers.etag));
      const again = await request(base, "/feed.xml", host, { ...extra, "If-None-Match": String(feed.headers.etag) });
      add("Feed: If-None-Match -> 304", again.status === 304, String(again.status));
    }

    const up = await request(base, "/uploads/__findes-ikke__.jpg", host, extra);
    add("/uploads: nosniff + sandbox-CSP", up.headers["x-content-type-options"] === "nosniff" && /sandbox/.test(String(up.headers["content-security-policy"])), `${up.status}`);

    let failed = 0;
    for (const c of checks) {
      if (!c.ok) failed++;
      console.log(`${c.ok ? "OK  " : "FEJL"}  ${c.name}${c.detail && !c.ok ? `  [${c.detail}]` : ""}`);
    }
    console.log(`\n${checks.length - failed}/${checks.length} tjek bestået (${prod ? "produktionskrav" : "grundkrav"}) — Host: ${host}`);
    process.exit(failed ? 1 : 0);
  })();
}

main().catch((e) => {
  console.error("check-headers fejlede:", e instanceof Error ? e.message : e);
  process.exit(2);
});
