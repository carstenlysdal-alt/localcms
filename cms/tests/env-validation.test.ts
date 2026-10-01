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
