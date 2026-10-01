import assert from "node:assert/strict";
import test from "node:test";
import { getClientIp, ipToRateKey, normalizeIp, resolveClientIpOptions, trustedClientIp } from "../lib/client-ip";

const h = (o: Record<string, string>) => new Headers(o);

test("normalizeIp: IPv4/IPv6, porte, klammer, zone og IPv4-mapped", () => {
  assert.equal(normalizeIp("203.0.113.5"), "203.0.113.5");
  assert.equal(normalizeIp("203.0.113.5:8080"), "203.0.113.5");
  assert.equal(normalizeIp(" 203.0.113.5 "), "203.0.113.5");
  assert.equal(normalizeIp("[2001:DB8::1]:443"), "2001:db8:0:0:0:0:0:1");
  assert.equal(normalizeIp("2001:db8::1%eth0"), "2001:db8:0:0:0:0:0:1");
  assert.equal(normalizeIp("::ffff:203.0.113.5"), "203.0.113.5");
  assert.equal(normalizeIp("::1"), "0:0:0:0:0:0:0:1");
  assert.equal(normalizeIp("999.1.1.1"), null);
  assert.equal(normalizeIp("ikke-en-ip"), null);
  assert.equal(normalizeIp(""), null);
  assert.equal(normalizeIp("1.2.3.4, 5.6.7.8"), null);
});

test("IPv6 reduceres til /64 til rate limiting, IPv4 uændret", () => {
  assert.equal(ipToRateKey("203.0.113.5"), "203.0.113.5");
  assert.equal(ipToRateKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), "2001:db8:1:2::/64");
  const a = getClientIp(h({ "x-forwarded-for": "2001:db8:1:2:1:1:1:1" }), { trustedProxyHops: 1 });
  const b = getClientIp(h({ "x-forwarded-for": "2001:db8:1:2:9:9:9:9" }), { trustedProxyHops: 1 });
  assert.equal(a, b);
});

test("tillidsmatrix: Cloudflare kræver CF-Ray og TRUST_CLOUDFLARE", () => {
  const cf = h({ "cf-connecting-ip": "198.51.100.1", "cf-ray": "abc-CPH", "x-forwarded-for": "203.0.113.7" });
  assert.equal(getClientIp(cf, { trustCloudflare: true, trustedProxyHops: 1 }), "198.51.100.1");
  // Uden tillid til Cloudflare ignoreres CF-headeren (kan forfalskes)
  assert.equal(getClientIp(cf, { trustCloudflare: false, trustedProxyHops: 1 }), "203.0.113.7");
  // CF-Connecting-IP uden CF-Ray er ikke fra Cloudflare -> XFF
  const noRay = h({ "cf-connecting-ip": "198.51.100.1", "x-forwarded-for": "203.0.113.7" });
  assert.equal(getClientIp(noRay, { trustCloudflare: true, trustedProxyHops: 1 }), "203.0.113.7");
  // Ugyldig CF-IP -> falder tilbage
  const bad = h({ "cf-connecting-ip": "ikke-ip", "cf-ray": "x", "x-forwarded-for": "203.0.113.7" });
  assert.equal(getClientIp(bad, { trustCloudflare: true, trustedProxyHops: 1 }), "203.0.113.7");
});

test("tillidsmatrix: X-Forwarded-For tæller hop fra højre", () => {
  const xff = h({ "x-forwarded-for": "6.6.6.6, 198.51.100.1, 10.0.0.9" });
  assert.equal(getClientIp(xff, { trustedProxyHops: 1 }), "10.0.0.9");
  assert.equal(getClientIp(xff, { trustedProxyHops: 2 }), "198.51.100.1");
  assert.equal(getClientIp(xff, { trustedProxyHops: 3 }), "6.6.6.6");
  // Flere hop end poster: bruger den yderste (venstre) i stedet for at gætte
  assert.equal(getClientIp(h({ "x-forwarded-for": "203.0.113.5" }), { trustedProxyHops: 3 }), "203.0.113.5");
  // 0 hop = ingen proxy betroet -> XFF ignoreres helt (forfalsket header kan ikke vælge sin egen bucket)
  assert.equal(getClientIp(xff, { trustedProxyHops: 0 }), "unknown");
});

test("forfalsket venstre XFF-værdi flytter ikke klientens bucket", () => {
  const real = "203.0.113.50";
  const a = getClientIp(h({ "x-forwarded-for": `1.1.1.1, ${real}` }), { trustedProxyHops: 1 });
  const b = getClientIp(h({ "x-forwarded-for": `2.2.2.2, ${real}` }), { trustedProxyHops: 1 });
  assert.equal(a, real);
  assert.equal(b, real);
});

test("ingen betroet kilde -> unknown; x-real-ip ignoreres", () => {
  assert.equal(getClientIp(h({}), { trustedProxyHops: 1 }), "unknown");
  assert.equal(getClientIp(h({ "x-real-ip": "9.9.9.9" }), { trustedProxyHops: 1 }), "unknown");
  assert.equal(trustedClientIp(h({ "x-forwarded-for": "garbage" }), { trustedProxyHops: 1 }), null);
});

test("resolveClientIpOptions læser env med fornuftige standarder", () => {
  assert.deepEqual(resolveClientIpOptions({} as NodeJS.ProcessEnv), { trustCloudflare: false, trustedProxyHops: 1 });
  assert.deepEqual(resolveClientIpOptions({ TRUST_CLOUDFLARE: "1", TRUSTED_PROXY_HOPS: "2" } as unknown as NodeJS.ProcessEnv), { trustCloudflare: true, trustedProxyHops: 2 });
  assert.equal(resolveClientIpOptions({ TRUSTED_PROXY_HOPS: "99" } as unknown as NodeJS.ProcessEnv).trustedProxyHops, 5);
  assert.equal(resolveClientIpOptions({ TRUSTED_PROXY_HOPS: "abc" } as unknown as NodeJS.ProcessEnv).trustedProxyHops, 1);
});
