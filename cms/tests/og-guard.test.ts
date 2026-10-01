import assert from "node:assert/strict";
import test from "node:test";
import { OG_IMMUTABLE_CACHE, OG_SHORT_CACHE, Semaphore, guardedOgRender, ogCacheControl, parseOgRequest } from "../lib/cache/og-guard";
import { MemoryRateLimitStore, resetRateLimitStoreForTests, setRateLimitStore } from "../lib/ratelimit";

const q = (s: string) => new URLSearchParams(s);

test("og-parametre: slug-allowlist, format og version", () => {
  assert.deepEqual(parseOgRequest("min-historie.jpg", q("")), { slug: "min-historie", format: "og", version: null });
  assert.deepEqual(parseOgRequest("doegnrapport-2024.jpeg", q("f=16x9&v=abc123")), { slug: "doegnrapport-2024", format: "16x9", version: "abc123" });
  assert.deepEqual(parseOgRequest("blåbær-fest.jpg", q("f=1x1")), { slug: "blåbær-fest", format: "1x1", version: null });
  assert.deepEqual(parseOgRequest(null, q("v=1700000000")), { slug: null, format: "og", version: "1700000000" });
  for (const f of ["4x3", "1x1", "16x9"]) assert.ok(parseOgRequest("a.jpg", q(`f=${f}`)));
});

test("og-parametre: ukendt/ugyldigt -> null (404)", () => {
  assert.equal(parseOgRequest("a.jpg", q("f=2000x2000")), null, "ukendt format (ingen stille fallback)");
  assert.equal(parseOgRequest("a.jpg", q("f=og")), null);
  assert.equal(parseOgRequest("a.jpg", q("x=1")), null, "ukendte parametre ville oppuste CDN-nøgler");
  assert.equal(parseOgRequest("a.jpg", q("f=1x1&f=4x3")), null);
  assert.equal(parseOgRequest("a.jpg", q("v=a b")), null);
  assert.equal(parseOgRequest("a.jpg", q(`v=${"x".repeat(40)}`)), null);
  assert.equal(parseOgRequest("a.gif", q("")), null);
  assert.equal(parseOgRequest("a", q("")), null);
  assert.equal(parseOgRequest("../etc/passwd.jpg", q("")), null);
  assert.equal(parseOgRequest("a_b.jpg", q("")), null);
  assert.equal(parseOgRequest("a b.jpg", q("")), null);
  assert.equal(parseOgRequest("%00.jpg", q("")), null);
  assert.equal(parseOgRequest(`${"a".repeat(170)}.jpg`, q("")), null);
  assert.equal(parseOgRequest("-a.jpg", q("")), null);
});

test("og-cache: uforanderlig med version, ellers kortere", () => {
  assert.equal(ogCacheControl("v1"), OG_IMMUTABLE_CACHE);
  assert.match(OG_IMMUTABLE_CACHE, /immutable/);
  assert.match(OG_IMMUTABLE_CACHE, /s-maxage=31536000/);
  assert.equal(ogCacheControl(null), OG_SHORT_CACHE);
});

test("semafor: begrænser samtidighed, kø og overløb", async () => {
  const s = new Semaphore(2, 1);
  const r1 = await s.acquire();
  const r2 = await s.acquire();
  assert.ok(r1 && r2);
  assert.deepEqual(s.stats(), { active: 2, queued: 0 });
  let thirdGot = false;
  const third = s.acquire().then((r) => {
    thirdGot = true;
    return r;
  });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(thirdGot, false, "venter i kø");
  assert.equal(await s.acquire(), null, "køen er fuld -> 503");
  r1!();
  const r3 = await third;
  assert.ok(r3);
  assert.deepEqual(s.stats(), { active: 2, queued: 0 });
  r1!(); // dobbelt release er harmløs
  r2!();
  r3!();
  assert.deepEqual(s.stats(), { active: 0, queued: 0 });
});

test("guardedOgRender: pr.-IP-grænse giver 429 og skrabere får lavere grænse", async () => {
  setRateLimitStore(new MemoryRateLimitStore());
  try {
    const human = () => new Request("https://x.dk/og/by.jpg", { headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "Mozilla/5.0 (Macintosh) Chrome/126.0 Safari/537.36" } });
    let ok = 0;
    for (let i = 0; i < 60; i++) if ((await guardedOgRender(human(), async () => new Response("x"))).status === 200) ok++;
    assert.equal(ok, 60);
    const res = await guardedOgRender(human(), async () => new Response("x"));
    assert.equal(res.status, 429);
    assert.ok(res.headers.get("retry-after"));

    const scraper = () => new Request("https://x.dk/og/by.jpg", { headers: { "x-forwarded-for": "203.0.113.11", "user-agent": "python-requests/2.31" } });
    let okS = 0;
    for (let i = 0; i < 20; i++) if ((await guardedOgRender(scraper(), async () => new Response("x"))).status === 200) okS++;
    assert.equal(okS, 12, "60 * 0.2 = 12");
  } finally {
    resetRateLimitStoreForTests();
  }
});
