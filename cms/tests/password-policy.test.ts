import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, passwordStrength, validatePassword } from "../lib/password-policy";
import { generateTempPassword, TEMP_PASSWORD_ALPHABET } from "../lib/password";
import { isSessionStale } from "../lib/session-validity";

const ctx = { email: "karen.hansen@example.dk", name: "Karen Hansen" };

test("politik: mindst 12 tegn", () => {
  assert.ok(validatePassword("kort-1", ctx).some((m) => m.includes(String(MIN_PASSWORD_LENGTH))));
  assert.deepEqual(validatePassword("havregryn-og-fyrtaarn-42", ctx), []);
  assert.equal(validatePassword("x".repeat(MIN_PASSWORD_LENGTH - 1) + "!", ctx).some((m) => m.includes("mindst")), false);
});

test("politik: ikke lig med e-mail, e-mailens lokale del eller navn (uanset store/små bogstaver og tegnsætning)", () => {
  assert.ok(validatePassword("Karen.Hansen@example.dk", ctx).some((m) => m.includes("e-mail eller dit navn")));
  assert.ok(validatePassword("karen.hansen", ctx).length > 0);
  assert.ok(validatePassword("KAREN HANSEN!!", { ...ctx, name: "Karen Hansen!!" }).some((m) => m.includes("e-mail eller dit navn")));
  assert.ok(validatePassword("Karen Hansen", ctx).length > 0);
});

test("politik: almindelige og gentagne adgangskoder afvises", () => {
  for (const bad of ["Password1234", "adgangskode123", "123456789012", "qwertyuiop12", "aaaaaaaaaaaaaa", "abababababab", "cms-demo-2026", "Slagelselokalt"]) {
    assert.ok(validatePassword(bad, ctx).some((m) => m.includes("almindelig")), `${bad} burde afvises`);
  }
});

test("politik: ikke lig med den nuværende, og højst 72 bytes (bcrypt afkorter ellers stille)", () => {
  assert.ok(validatePassword("havregryn-og-fyrtaarn-42", { ...ctx, current: "havregryn-og-fyrtaarn-42" }).some((m) => m.includes("anden end")));
  assert.deepEqual(validatePassword("havregryn-og-fyrtaarn-42", { ...ctx, current: "noget-helt-andet-123" }), []);
  assert.ok(validatePassword("å".repeat(MAX_PASSWORD_BYTES / 2 + 1), ctx).some((m) => m.includes("bytes")));
  assert.ok(!validatePassword("a1".repeat(30) + "Zq", ctx).some((m) => m.includes("bytes")));
});

test("styrkeindikator: vejledende og uden at kaste på tom/mærkelig input", () => {
  assert.equal(passwordStrength("").score, 0);
  assert.equal(passwordStrength("kort").label, "For kort");
  assert.equal(passwordStrength("password1234").label, "For svag");
  assert.equal(passwordStrength("havregryn-og-fyrtaarn-42", ctx).label, "Stærk");
  assert.doesNotThrow(() => passwordStrength("🙂".repeat(30)));
});

test("midlertidig adgangskode: ≥16 tegn, læsbart alfabet, tilfældig, overholder egen politik", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const pw = generateTempPassword();
    assert.ok(pw.length >= 16);
    assert.match(pw, /^[A-HJ-NP-Za-km-z2-9]{6}-[A-HJ-NP-Za-km-z2-9]{6}-[A-HJ-NP-Za-km-z2-9]{6}$/);
    assert.deepEqual(validatePassword(pw), []);
    seen.add(pw);
  }
  assert.equal(seen.size, 200);
  assert.ok(!/[0O1lI]/.test(TEMP_PASSWORD_ALPHABET));
});

test("session-gyldighed: afvis tokens udstedt før kodeskift", () => {
  const changed = new Date("2026-10-02T10:00:00Z");
  assert.equal(isSessionStale(changed.getTime() - 1, changed), true);
  assert.equal(isSessionStale(changed.getTime(), changed), false);
  assert.equal(isSessionStale(changed.getTime() + 5000, changed), false);
  assert.equal(isSessionStale(undefined, changed), true, "token uden authTime er ældre end ethvert kodeskift");
  assert.equal(isSessionStale("nu", changed), true);
  assert.equal(isSessionStale(undefined, null), false, "uden kodeskift er alle sessioner gyldige");
  assert.equal(isSessionStale(1, null), false);
});
