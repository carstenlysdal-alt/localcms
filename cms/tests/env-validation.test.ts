import assert from "node:assert/strict";
import test from "node:test";
import { assertEnv, checkEnv, EnvError } from "../lib/env";

const SECRET = "x".repeat(40);
const good = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:hunter2-db-password@host:5432/db",
  AUTH_SECRET: SECRET,
  NEXT_PUBLIC_APP_URL: "https://slagelselokalt.dk",
  CRON_SECRET: "c".repeat(20),
} as unknown as NodeJS.ProcessEnv;

test("gyldigt produktionsmiljø passerer (kun advarsler)", () => {
  const r = checkEnv(good);
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.startsWith("REDIS_URL mangler")), "REDIS_URL er kun advarsel");
});

test("manglende påkrævede variabler listes ved navn", () => {
  const r = checkEnv({ NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv);
  assert.equal(r.ok, false);
  assert.deepEqual([...r.missing].sort(), ["AUTH_SECRET", "CRON_SECRET", "DATABASE_URL", "NEXT_PUBLIC_APP_URL"]);
});

test("tomme pladsholdere (som i .env.example) tæller som manglende", () => {
  const r = checkEnv({ ...good, AUTH_SECRET: "  ", CRON_SECRET: "" } as unknown as NodeJS.ProcessEnv);
  assert.deepEqual([...r.missing].sort(), ["AUTH_SECRET", "CRON_SECRET"]);
});

test("for korte hemmeligheder og ugyldig URL afvises", () => {
  const r = checkEnv({ ...good, AUTH_SECRET: "kort", CRON_SECRET: "a".repeat(15), NEXT_PUBLIC_APP_URL: "ikke-en-url" } as unknown as NodeJS.ProcessEnv);
  assert.equal(r.ok, false);
  assert.equal(r.invalid.length, 3);
  assert.ok(r.invalid.some((m) => m.startsWith("AUTH_SECRET")));
  assert.ok(r.invalid.some((m) => m.startsWith("CRON_SECRET")));
  assert.ok(r.invalid.some((m) => m.startsWith("NEXT_PUBLIC_APP_URL")));
});

test("fejlbeskeder indeholder aldrig værdier", () => {
  const env = { ...good, AUTH_SECRET: "hemmelig-men-for-kort", CRON_SECRET: undefined } as unknown as NodeJS.ProcessEnv;
  const r = checkEnv(env);
  const text = JSON.stringify(r);
  assert.ok(!text.includes("hemmelig-men-for-kort"));
  assert.ok(!text.includes("hunter2"));
  assert.throws(() => assertEnv(env), (err: unknown) => {
    assert.ok(err instanceof EnvError);
    assert.ok(!err.message.includes("hemmelig-men-for-kort") && !err.message.includes("hunter2"));
    assert.match(err.message, /CRON_SECRET/);
    assert.match(err.message, /AUTH_SECRET/);
    return true;
  });
});

test("udenfor produktion kaster validering aldrig", () => {
  const r = checkEnv({ NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv);
  assert.equal(r.ok, true);
  assert.equal(r.production, false);
  const t = checkEnv({ NODE_ENV: "test" } as unknown as NodeJS.ProcessEnv);
  assert.equal(t.ok, true);
});

test("advarsler: SQLite i produktion, ugyldig REDIS_URL, manglende AUTH_TRUST_HOST", () => {
  const r = checkEnv({ ...good, DATABASE_URL: "file:./dev.db", REDIS_URL: "http://nope" } as unknown as NodeJS.ProcessEnv);
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.includes("postgresql")));
  assert.ok(r.warnings.some((w) => w.includes("REDIS_URL skal starte med")));
  assert.ok(r.warnings.some((w) => w.includes("AUTH_TRUST_HOST")));
  const ok = checkEnv({ ...good, AUTH_TRUST_HOST: "true", REDIS_URL: "redis://default:pw@redis.railway.internal:6379" } as unknown as NodeJS.ProcessEnv);
  assert.ok(!ok.warnings.some((w) => w.includes("AUTH_TRUST_HOST") || w.includes("REDIS_URL")));
});

// ── T5 P2-2: kant og tillid ──────────────────────────────────────────────────────────────────────

test("TRUST_CLOUDFLARE uden ORIGIN_SECRET er en startfejl i produktion (CF-Connecting-IP kan ellers forfalskes)", () => {
  const bad = checkEnv({ ...good, TRUST_CLOUDFLARE: "1" } as unknown as NodeJS.ProcessEnv);
  assert.equal(bad.ok, false);
  assert.ok(bad.invalid.some((m) => m.includes("TRUST_CLOUDFLARE") && m.includes("ORIGIN_SECRET")), bad.invalid.join(" | "));
  assert.throws(() => assertEnv({ ...good, TRUST_CLOUDFLARE: "true" } as unknown as NodeJS.ProcessEnv), EnvError);
  const blank = checkEnv({ ...good, TRUST_CLOUDFLARE: "1", ORIGIN_SECRET: "   " } as unknown as NodeJS.ProcessEnv);
  assert.equal(blank.ok, false, "tom/mellemrums-hemmelighed tæller som manglende");
  const ok = checkEnv({ ...good, TRUST_CLOUDFLARE: "1", ORIGIN_SECRET: "o".repeat(32) } as unknown as NodeJS.ProcessEnv);
  assert.equal(ok.ok, true, ok.invalid.join(" | "));
  const off = checkEnv({ ...good, TRUST_CLOUDFLARE: "0" } as unknown as NodeJS.ProcessEnv);
  assert.equal(off.ok, true, "TRUST_CLOUDFLARE=0 kræver ikke origin-lås");
});

test("ORIGIN_SECRET: advarsel når den mangler, fejl når den er for kort, advarsel om delt IP-bucket bag Cloudflare", () => {
  const none = checkEnv(good);
  assert.ok(none.warnings.some((w) => w.startsWith("ORIGIN_SECRET mangler")));
  const short = checkEnv({ ...good, ORIGIN_SECRET: "kort" } as unknown as NodeJS.ProcessEnv);
  assert.equal(short.ok, false);
  assert.ok(short.invalid.some((m) => m.includes("ORIGIN_SECRET")));
  const lockOnly = checkEnv({ ...good, ORIGIN_SECRET: "o".repeat(32) } as unknown as NodeJS.ProcessEnv);
  assert.ok(lockOnly.ok);
  assert.ok(lockOnly.warnings.some((w) => w.includes("delt") || w.includes("deler")), lockOnly.warnings.join(" | "));
  const full = checkEnv({ ...good, ORIGIN_SECRET: "o".repeat(32), TRUST_CLOUDFLARE: "1" } as unknown as NodeJS.ProcessEnv);
  assert.ok(!full.warnings.some((w) => w.includes("ORIGIN_SECRET mangler") || w.includes("rate-limit-bucket")));
  const hops = checkEnv({ ...good, ORIGIN_SECRET: "o".repeat(32), TRUSTED_PROXY_HOPS: "2" } as unknown as NodeJS.ProcessEnv);
  assert.ok(!hops.warnings.some((w) => w.includes("rate-limit-bucket")));
});

test("advarsler: Turnstile uden nøgle og TRUST_FORWARDED_HOST; uden for produktion ingen støj eller fejl", () => {
  assert.ok(checkEnv(good).warnings.some((w) => w.startsWith("TURNSTILE_SECRET_KEY mangler")));
  assert.ok(!checkEnv({ ...good, TURNSTILE_SECRET_KEY: "t" } as unknown as NodeJS.ProcessEnv).warnings.some((w) => w.startsWith("TURNSTILE")));
  assert.ok(checkEnv({ ...good, TRUST_FORWARDED_HOST: "1" } as unknown as NodeJS.ProcessEnv).warnings.some((w) => w.includes("TRUST_FORWARDED_HOST")));
  const dev = checkEnv({ NODE_ENV: "development", TRUST_CLOUDFLARE: "1" } as unknown as NodeJS.ProcessEnv);
  assert.equal(dev.ok, true);
  assert.deepEqual(dev.invalid, []);
});
