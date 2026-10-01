import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import { FetchTimeoutError, PUBLIC_BODY_MAX_BYTES, declaredBodyTooLarge, fetchWithTimeout, readJsonBody, rejectOversize } from "../lib/http";
import { CircuitBreaker, CircuitOpenError, TimeoutError, backoffDelay, getBreaker, isBreakerFailure, withTimeout } from "../lib/resilience";
import { baseSecurityHeaders, buildCsp, cspHeaderName, generateNonce, isCspReportOnly, shouldSendHsts, UPLOADS_HEADERS } from "../lib/security-headers";

test("body-størrelse: Content-Length-filter og 413", async () => {
  assert.equal(declaredBodyTooLarge(new Headers({ "content-length": "2000000" }), PUBLIC_BODY_MAX_BYTES), true);
  assert.equal(declaredBodyTooLarge(new Headers({ "content-length": "1000" }), PUBLIC_BODY_MAX_BYTES), false);
  assert.equal(declaredBodyTooLarge(new Headers(), PUBLIC_BODY_MAX_BYTES), false);
  assert.equal(declaredBodyTooLarge(new Headers({ "content-length": "abc" }), 10), false);

  const big = new Request("https://x.dk/api/x", { method: "POST", headers: { "content-length": "99999" }, body: "{}" });
  const res = rejectOversize(big, 1024);
  assert.equal(res?.status, 413);
  assert.equal(rejectOversize(new Request("https://x.dk", { method: "POST", body: "{}" }), 1024), null);

  // readJsonBody (eksisterende) afviser også uden Content-Length (chunked/sendBeacon)
  const chunked = new Request("https://x.dk/api/x", { method: "POST", body: JSON.stringify({ a: "x".repeat(5000) }) });
  const parsed = await readJsonBody(chunked, 1024);
  assert.equal(parsed.ok, false);
  assert.equal(!parsed.ok && parsed.status, 413);
});

test("fetchWithTimeout: timeout afbryder og kaster FetchTimeoutError; normal respons passerer", async () => {
  const server = http.createServer((req, res) => {
    if (req.url === "/slow") return void setTimeout(() => res.end("sent"), 500);
    res.end("hurtig");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const { port } = server.address() as { port: number };
  try {
    const fast = await fetchWithTimeout(`http://127.0.0.1:${port}/fast`, { timeoutMs: 1000 });
    assert.equal(await fast.text(), "hurtig");
    const started = Date.now();
    await assert.rejects(() => fetchWithTimeout(`http://127.0.0.1:${port}/slow`, { timeoutMs: 50 }), FetchTimeoutError);
    assert.ok(Date.now() - started < 480);
    // Kalderens eget signal respekteres
    const ctrl = new AbortController();
    const p = fetchWithTimeout(`http://127.0.0.1:${port}/slow`, { timeoutMs: 1000, signal: ctrl.signal });
    ctrl.abort();
    await assert.rejects(p);
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
});

test("circuit breaker: åbner efter N fejl, half-open prøve, lukker igen, klientfejl tæller ikke", async () => {
  let t = 0;
  const events: string[] = [];
  const b = new CircuitBreaker({ name: "t", failureThreshold: 2, openMs: 1000, now: () => t, onStateChange: (_n, s) => events.push(s) });
  const fail = () => Promise.reject(new Error("fejl"));
  await assert.rejects(() => b.exec(fail));
  assert.equal(b.getState(), "closed");
  await assert.rejects(() => b.exec(fail));
  assert.equal(b.getState(), "open");
  await assert.rejects(() => b.exec(async () => 1), CircuitOpenError);
  t = 1001;
  assert.equal(b.getState(), "half-open");
  assert.equal(await b.exec(async () => 42), 42);
  assert.equal(b.getState(), "closed");
  assert.deepEqual(events, ["open", "closed"]);

  // 4xx (undtagen 408/429) tæller ikke som nedbrud
  const c = new CircuitBreaker({ name: "c", failureThreshold: 1, onStateChange: () => undefined });
  await assert.rejects(() => c.exec(() => Promise.reject(Object.assign(new Error("bad"), { status: 400 })), isBreakerFailure));
  assert.equal(c.getState(), "closed");
  await assert.rejects(() => c.exec(() => Promise.reject(Object.assign(new Error("rate"), { status: 429 })), isBreakerFailure));
  assert.equal(c.getState(), "open");
  assert.equal(isBreakerFailure(Object.assign(new Error(), { status: 503 })), true);
  assert.equal(isBreakerFailure(new CircuitOpenError("x")), false);
  assert.equal(getBreaker("delt-test"), getBreaker("delt-test"));
});

test("backoff og withTimeout", async () => {
  assert.equal(backoffDelay(1, 300, 5000, () => 0.5), 150);
  assert.equal(backoffDelay(3, 300, 5000, () => 1), 1200);
  assert.equal(backoffDelay(20, 300, 5000, () => 1), 5000);
  assert.equal(await withTimeout(async () => "ok", 100), "ok");
  await assert.rejects(() => withTimeout(() => new Promise(() => undefined), 20, "test"), TimeoutError);
});

test("CSP: nonce + strict-dynamic, frame-ancestors none, ingen unsafe-inline i script-src", () => {
  const nonce = generateNonce();
  assert.match(nonce, /^[A-Za-z0-9+/]{22}==$/);
  assert.notEqual(nonce, generateNonce());
  const csp = buildCsp({ nonce, isDev: false, upgradeInsecure: true, reportUri: "/api/csp-report" });
  const script = csp.split("; ").find((d) => d.startsWith("script-src "))!;
  assert.ok(script.includes(`'nonce-${nonce}'`) && script.includes("'strict-dynamic'"));
  assert.ok(!script.includes("'unsafe-inline'") && !script.includes("'unsafe-eval'"));
  assert.ok(script.includes("https://challenges.cloudflare.com"));
  for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "default-src 'self'", "font-src 'self' data:", "upgrade-insecure-requests", "report-uri /api/csp-report"]) {
    assert.ok(csp.includes(d), d);
  }
  assert.ok(csp.includes("img-src 'self' data: blob:"));
  assert.ok(!/fonts\.(googleapis|gstatic)/.test(csp), "fonts er self-hostet");
  assert.ok(buildCsp({ nonce, isDev: true }).includes("'unsafe-eval'"), "kun i udvikling");
  assert.ok(!buildCsp({ nonce, turnstile: false }).includes("challenges.cloudflare.com"));
  const withHosts = buildCsp({ nonce, extraImgHosts: "cdn.example.dk, https://img.example.dk, ugyldig host!" });
  assert.ok(withHosts.includes("https://cdn.example.dk") && withHosts.includes("https://img.example.dk") && !withHosts.includes("ugyldig"));
});

test("CSP Report-Only som standard i udvikling, håndhævet i produktion, CSP_REPORT_ONLY overstyrer", () => {
  const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
  assert.equal(isCspReportOnly(env({ NODE_ENV: "development" })), true);
  assert.equal(isCspReportOnly(env({ NODE_ENV: "production" })), false);
  assert.equal(isCspReportOnly(env({ NODE_ENV: "production", CSP_REPORT_ONLY: "1" })), true);
  assert.equal(isCspReportOnly(env({ NODE_ENV: "development", CSP_REPORT_ONLY: "0" })), false);
  assert.equal(cspHeaderName(true), "Content-Security-Policy-Report-Only");
  assert.equal(cspHeaderName(false), "Content-Security-Policy");
});

test("øvrige sikkerhedsheadere og HSTS-regler", () => {
  const h = baseSecurityHeaders({ hsts: false });
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.match(h["Permissions-Policy"], /camera=\(\)/);
  assert.match(h["Permissions-Policy"], /microphone=\(\)/);
  assert.match(h["Permissions-Policy"], /geolocation=\(\)/);
  assert.equal(h["X-Frame-Options"], "DENY");
  assert.equal(h["Cross-Origin-Opener-Policy"], "same-origin");
  assert.ok(h["Cross-Origin-Resource-Policy"]);
  assert.equal(h["Strict-Transport-Security"], undefined);
  assert.match(baseSecurityHeaders({ hsts: true })["Strict-Transport-Security"], /max-age=31536000/);

  assert.equal(shouldSendHsts({ isProduction: false, protocol: "https:" }), false);
  assert.equal(shouldSendHsts({ isProduction: true, protocol: "http:" }), false);
  assert.equal(shouldSendHsts({ isProduction: true, protocol: "http:", forwardedProto: "https" }), true);
  assert.equal(shouldSendHsts({ isProduction: true, protocol: "https:" }), true);
  assert.equal(shouldSendHsts({ isProduction: true, protocol: "http:", forwardedProto: "http, https" }), false, "første hop afgør");

  assert.equal(UPLOADS_HEADERS["X-Content-Type-Options"], "nosniff");
  assert.match(UPLOADS_HEADERS["Content-Security-Policy"], /sandbox/);
});

test("frame-ancestors: kun forside-preview må indlejres af eget domæne, alt andet er låst", async () => {
  const { buildCsp, baseSecurityHeaders } = await import("../lib/security-headers");
  assert.match(buildCsp({ nonce: "abc" }), /frame-ancestors 'none'/);
  assert.match(buildCsp({ nonce: "abc", frameSelf: true }), /frame-ancestors 'self'/);
  assert.equal(baseSecurityHeaders()["X-Frame-Options"], "DENY");
  assert.equal(baseSecurityHeaders({ frameSelf: true })["X-Frame-Options"], "SAMEORIGIN");
});
