import test from "node:test";
import assert from "node:assert/strict";

const VALID_ZONES = ["top-hoved", "top-sekundaer", "omraade", "sektion"];

function isPlacementExpired(udloebTid: Date | null, now = new Date()): boolean {
  if (!udloebTid) return false;
  return udloebTid.getTime() <= now.getTime();
}

function checkQuotaExceeded(percentage: number, kvoteloftProcent: number): boolean {
  return percentage >= kvoteloftProcent;
}

test("VALID_ZONES indeholder alle fire gyldige forsidezoner (Del 4 §4)", () => {
  assert.equal(VALID_ZONES.length, 4);
  assert.ok(VALID_ZONES.includes("top-hoved"));
  assert.ok(VALID_ZONES.includes("top-sekundaer"));
  assert.ok(VALID_ZONES.includes("omraade"));
  assert.ok(VALID_ZONES.includes("sektion"));
});

test("isPlacementExpired detekterer udløbne og aktive placeringer korrekt", () => {
  const now = new Date();

  // Permanent
  assert.equal(isPlacementExpired(null, now), false);

  // Udløber om 2 timer
  const future = new Date(now.getTime() + 2 * 3600 * 1000);
  assert.equal(isPlacementExpired(future, now), false);

  // Udløbet for 1 time siden
  const past = new Date(now.getTime() - 3600 * 1000);
  assert.equal(isPlacementExpired(past, now), true);
});

test("checkQuotaExceeded advarer korrekt ved overskridelse af kvoteloft", () => {
  const loft = 25;

  assert.equal(checkQuotaExceeded(15, loft), false);
  assert.equal(checkQuotaExceeded(24, loft), false);
  assert.equal(checkQuotaExceeded(25, loft), true, "25% skal markeres som nået loft");
  assert.equal(checkQuotaExceeded(33, loft), true, "33% er over loftet");
});
