import assert from "node:assert/strict";
import test from "node:test";
import { classifyUserAgent, isNonHumanForTracking, pageLimitPerMinute, tightenLimit } from "../lib/bot/detect";
import { isMaliciousPath } from "../lib/bot/paths";
import { banDurationForStrikes, isBanned, localPageLimit, recordStrike, resetBanStateForTests, STRIKE_WINDOW_MS } from "../lib/bot/ban";
import { MemoryRateLimitStore, setRateLimitStore, resetRateLimitStoreForTests } from "../lib/ratelimit";
import { isLikelyBot } from "../lib/tracking";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const SAFARI_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

test("UA-klassificering: mennesker, søgemaskiner, AI, social, skrabere, headless, tom", () => {
  assert.equal(classifyUserAgent(CHROME).kind, "human");
  assert.equal(classifyUserAgent(SAFARI_IOS).kind, "human");
  assert.equal(classifyUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)").kind, "search");
  assert.equal(classifyUserAgent("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)").kind, "search");
  assert.equal(classifyUserAgent("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)").kind, "ai");
  assert.equal(classifyUserAgent("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)").kind, "ai");
  assert.equal(classifyUserAgent("Mozilla/5.0 (compatible; PerplexityBot/1.0)").kind, "ai");
  assert.equal(classifyUserAgent("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)").kind, "social");
  assert.equal(classifyUserAgent("Twitterbot/1.0").kind, "social");
  assert.equal(classifyUserAgent("python-requests/2.31.0").kind, "scraper");
  assert.equal(classifyUserAgent("curl/8.4.0").kind, "scraper");
  assert.equal(classifyUserAgent("Go-http-client/2.0").kind, "scraper");
  assert.equal(classifyUserAgent("Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)").kind, "scraper");
  assert.equal(classifyUserAgent("Mozilla/5.0 (compatible; CCBot/2.0; +http://commoncrawl.org/faq/)").kind, "scraper");
  assert.equal(classifyUserAgent("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36").kind, "headless");
  assert.equal(classifyUserAgent("").kind, "empty");
  assert.equal(classifyUserAgent(null).kind, "empty");
  assert.equal(classifyUserAgent("x").kind, "empty");
  assert.equal(classifyUserAgent("sqlmap/1.7").kind, "scraper");
});

test("sporing springer alt der ikke er et menneske over; eksisterende isLikelyBot er stadig streng", () => {
  assert.equal(isNonHumanForTracking(CHROME), false);
  assert.equal(isNonHumanForTracking("Googlebot/2.1"), true);
  assert.equal(isNonHumanForTracking(undefined), true);
  assert.equal(isLikelyBot(CHROME), false);
  assert.equal(isLikelyBot("Mozilla/5.0 (compatible; GPTBot/1.1)"), true);
  assert.equal(isLikelyBot("curl/8.4.0"), true);
});

test("grænser strammes for mistænkelige klasser, lempes for søgemaskiner", () => {
  assert.equal(pageLimitPerMinute("human", 300), 300);
  assert.ok(pageLimitPerMinute("search", 300) > 300);
  assert.ok(pageLimitPerMinute("scraper", 300) < 100);
  assert.ok(pageLimitPerMinute("empty", 300) < 100);
  assert.ok(pageLimitPerMinute("ai", 300) < 300);
  assert.equal(tightenLimit(30, "human"), 30);
  assert.equal(tightenLimit(30, "scraper"), 6);
  assert.equal(tightenLimit(1, "scraper"), 1);
});

test("ondsindede stier: scannere fanges, rigtige sider og .well-known ikke", () => {
  for (const p of ["/wp-admin", "/wp-admin/install.php", "/wp-login.php", "/xmlrpc.php", "/.env", "/.env.production", "/.git/config", "/.git", "/phpmyadmin/", "/pma", "/admin.php", "/cgi-bin/test.cgi", "/vendor/phpunit/x", "/backup.sql", "/db.sqlite", "/config.json", "/.aws/credentials", "/server-status", "/a/../../etc/passwd", "/shell.php", "/actuator/health", "/.DS_Store"]) {
    assert.equal(isMaliciousPath(p), true, p);
  }
  for (const p of ["/", "/nyheder", "/nyheder/min-historie", "/.well-known/security.txt", "/uploads/foto.jpg", "/soeg", "/om-mediet", "/kalender", "/sitemap.xml", "/feed.xml", "/api/articles", "/emne/politik", "/omraade/korsoer", "/wordpress-tips-til-lokale-medier"]) {
    assert.equal(isMaliciousPath(p), false, p);
  }
});

test("eskalerende bans: 4/8/16 strikes -> 10 min / 1 t / 24 t, aldrig for 'unknown'", async () => {
  assert.equal(banDurationForStrikes(1), 0);
  assert.equal(banDurationForStrikes(3), 0);
  assert.equal(banDurationForStrikes(4), 10 * 60_000);
  assert.equal(banDurationForStrikes(8), 3_600_000);
  assert.equal(banDurationForStrikes(100), 24 * 3_600_000);

  setRateLimitStore(new MemoryRateLimitStore());
  resetBanStateForTests();
  try {
    const now = 5_000_000;
    const ip = "203.0.113.77";
    for (let i = 1; i <= 3; i++) assert.equal((await recordStrike(ip, now + i)).banMs, 0);
    assert.equal(await isBanned(ip, now + 10), false);
    const fourth = await recordStrike(ip, now + 4);
    assert.equal(fourth.strikes, 4);
    assert.equal(fourth.banMs, 10 * 60_000);
    assert.equal(await isBanned(ip, now + 5), true);
    assert.equal(await isBanned(ip, now + 10 * 60_000 + 10), false, "banen udløber");
    assert.equal(await isBanned("203.0.113.78", now + 5), false, "andre IP'er berøres ikke");

    for (let i = 0; i < 4; i++) await recordStrike(ip, now + 20 * 60_000 + i);
    const eighth = await recordStrike(ip, now + 20 * 60_000 + 9);
    assert.ok(eighth.banMs >= 3_600_000);

    assert.deepEqual(await recordStrike("unknown", now), { strikes: 0, banMs: 0 });
    for (let i = 0; i < 30; i++) await recordStrike("unknown", now);
    assert.equal(await isBanned("unknown", now), false);
    assert.ok(STRIKE_WINDOW_MS >= 24 * 3_600_000);
  } finally {
    resetBanStateForTests();
    resetRateLimitStoreForTests();
  }
});

test("lokal sidegrænse pr. IP og minut", () => {
  resetBanStateForTests();
  const now = 10_000_000;
  const results = Array.from({ length: 6 }, () => localPageLimit("198.51.100.5", 5, now));
  assert.deepEqual(results.map((r) => r.ok), [true, true, true, true, true, false]);
  assert.ok(results[5].retryAfterSec >= 1);
  assert.equal(localPageLimit("198.51.100.5", 5, now + 61_000).ok, true);
  assert.equal(localPageLimit("unknown", 1, now).ok, true);
  assert.equal(localPageLimit("unknown", 1, now).ok, true);
  resetBanStateForTests();
});
