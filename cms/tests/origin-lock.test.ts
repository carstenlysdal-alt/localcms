import assert from "node:assert/strict";
import test from "node:test";
import { isOriginLockExempt, originLockAllows, safeEqualStrings } from "../lib/origin-lock";

const base = { secret: "s3cret-value-1234", isProduction: true, pathname: "/", headerValue: null as string | null };

test("origin-lås: inaktivt uden hemmelighed eller uden for produktion", () => {
  assert.equal(originLockAllows({ ...base, secret: undefined }), true);
  assert.equal(originLockAllows({ ...base, secret: "" }), true);
  assert.equal(originLockAllows({ ...base, isProduction: false }), true);
});

test("origin-lås: 403 uden eller med forkert header, ellers tilladt", () => {
  assert.equal(originLockAllows({ ...base }), false);
  assert.equal(originLockAllows({ ...base, headerValue: "forkert" }), false);
  assert.equal(originLockAllows({ ...base, headerValue: "s3cret-value-123" }), false, "kortere prefix afvises");
  assert.equal(originLockAllows({ ...base, headerValue: "s3cret-value-12345" }), false, "længere afvises");
  assert.equal(originLockAllows({ ...base, headerValue: "s3cret-value-1234" }), true);
  assert.equal(originLockAllows({ ...base, pathname: "/api/articles", headerValue: null }), false);
  assert.equal(originLockAllows({ ...base, pathname: "/uploads/a.jpg", headerValue: null }), false);
});

test("origin-lås: health, ready og cron er undtaget", () => {
  for (const p of ["/api/health", "/api/ready", "/api/health/", "/api/cron/frontpage-rank"]) {
    assert.equal(isOriginLockExempt(p), true, p);
    assert.equal(originLockAllows({ ...base, pathname: p }), true, p);
  }
  assert.equal(isOriginLockExempt("/api/healthz"), false);
  assert.equal(isOriginLockExempt("/api/ingest/health"), false);
  assert.equal(isOriginLockExempt("/api/cronx"), false);
});

test("safeEqualStrings sammenligner hele strengen, også ved forskellig længde og unicode", () => {
  assert.equal(safeEqualStrings("abc", "abc"), true);
  assert.equal(safeEqualStrings("abc", "abd"), false);
  assert.equal(safeEqualStrings("abc", "abcd"), false);
  assert.equal(safeEqualStrings("", ""), true);
  assert.equal(safeEqualStrings("æøå", "æøå"), true);
  assert.equal(safeEqualStrings("æøå", "aoa"), false);
});
