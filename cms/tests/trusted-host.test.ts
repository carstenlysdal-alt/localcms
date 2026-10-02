import assert from "node:assert/strict";
import test from "node:test";
import { isSameOrigin } from "../lib/http";
import { isValidHost, resolveHostTrustOptions, trustedHost, varyHeaderFor } from "../lib/trusted-host";
import { resolveSiteDomain } from "../lib/site";

const h = (o: Record<string, string>) => new Headers(o);

test("T5 P2-1: Host bruges som standard; X-Forwarded-Host ignoreres uden udtrykkelig tillid", () => {
  assert.equal(trustedHost(h({ host: "slagelselokalt.dk", "x-forwarded-host": "naestvedlokalt.dk" })), "slagelselokalt.dk");
  assert.equal(trustedHost(h({ "x-forwarded-host": "naestvedlokalt.dk" })), null, "uden Host og uden tillid: ingen vært");
  assert.equal(trustedHost(h({ host: "SlagelseLokalt.DK:443" })), "slagelselokalt.dk:443");
  assert.equal(varyHeaderFor({}), "Host");
});

test("betroet X-Forwarded-Host: elementet N pladser fra højre (samme model som X-Forwarded-For), aldrig klientens venstre", () => {
  const headers = h({ host: "intern.railway.app", "x-forwarded-host": "klient.evil, slagelselokalt.dk" });
  assert.equal(trustedHost(headers, { trustForwardedHost: true }), "slagelselokalt.dk");
  assert.equal(trustedHost(headers, { trustForwardedHost: true, trustedProxyHops: 2 }), "klient.evil", "hop 2 = næstsidste betroede proxy");
  assert.equal(trustedHost(h({ host: "intern.railway.app", "x-forwarded-host": "slagelselokalt.dk" }), { trustForwardedHost: true, trustedProxyHops: 5 }), "slagelselokalt.dk");
  assert.equal(varyHeaderFor({ trustForwardedHost: true }), "Host, X-Forwarded-Host");
  // Ugyldig betroet værdi falder tilbage til Host
  assert.equal(trustedHost(h({ host: "slagelselokalt.dk", "x-forwarded-host": "a b/c" }), { trustForwardedHost: true }), "slagelselokalt.dk");
});

test("miljø: TRUST_FORWARDED_HOST og TRUSTED_PROXY_HOPS", () => {
  assert.deepEqual(resolveHostTrustOptions({} as NodeJS.ProcessEnv), { trustForwardedHost: false, trustedProxyHops: 1 });
  assert.deepEqual(resolveHostTrustOptions({ TRUST_FORWARDED_HOST: "1", TRUSTED_PROXY_HOPS: "2" } as unknown as NodeJS.ProcessEnv), { trustForwardedHost: true, trustedProxyHops: 2 });
  assert.equal(resolveHostTrustOptions({ TRUST_FORWARDED_HOST: "0" } as unknown as NodeJS.ProcessEnv).trustForwardedHost, false);
});

test("isValidHost afviser tegn der ikke hører til et værtsnavn", () => {
  for (const ok of ["slagelselokalt.dk", "a.b-c.dk:3000", "localhost", "127.0.0.1:3000", "[::1]:3000", "naestved.localhost:3000"]) assert.ok(isValidHost(ok), ok);
  for (const bad of ["", " ", "a b", "evil.dk/path", "evil.dk@x.dk", "evil.dk\r\nX: y", "-ugyldig.dk", "x".repeat(300), "evil.dk:99999999"]) assert.ok(!isValidHost(bad), JSON.stringify(bad));
});

test("tenant-valg: den betroede vært vælger instans; en forfalsket X-Forwarded-Host kan ikke flytte tenant", () => {
  const spoof = h({ host: "slagelselokalt.dk", "x-forwarded-host": "naestvedlokalt.dk" });
  const r = resolveSiteDomain(trustedHost(spoof), { isProduction: true });
  assert.equal(r.domain, "slagelselokalt.dk");
});

test("isSameOrigin bruger den betroede vært (falsk X-Forwarded-Host gør ikke en fremmed Origin same-origin)", () => {
  const forged = new Request("https://slagelselokalt.dk/api/x", { method: "POST", headers: { origin: "https://evil.test", host: "slagelselokalt.dk", "x-forwarded-host": "evil.test" } });
  assert.equal(isSameOrigin(forged), false);
  const ok = new Request("https://slagelselokalt.dk/api/x", { method: "POST", headers: { origin: "https://slagelselokalt.dk", host: "slagelselokalt.dk" } });
  assert.equal(isSameOrigin(ok), true);
});
