import test from "node:test";
import assert from "node:assert/strict";

// Ad format validering og standardpriser
const STANDARD_AD_PRICES: Record<string, number> = {
  EVENT_POST: 499,
  IN_FEED_BANNER: 3500,
  NATIVE_PREMIUM: 14500,
};

function validateAdCreative(creative: {
  overskrift?: string;
  badgeTekst?: string;
  linkUrl?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!creative.overskrift || creative.overskrift.trim().length === 0) {
    errors.push("Overskrift er påkrævet");
  }

  // Ufravigeligt krav: Mærkning skal være synlig
  const validBadges = ["ANNONCE", "SPONSORERET"];
  if (!creative.badgeTekst || !validBadges.includes(creative.badgeTekst.toUpperCase())) {
    errors.push("Mærkning skal indeholde 'ANNONCE' eller 'SPONSORERET'");
  }

  if (!creative.linkUrl || !creative.linkUrl.startsWith("http")) {
    errors.push("Gyldig linkUrl med http/https er påkrævet");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

test("validateAdCreative afviser annonce uden påkrævet ANNONCE-mærkning", () => {
  const invalid = validateAdCreative({
    overskrift: "Super tilbud",
    badgeTekst: "Kategori",
    linkUrl: "https://slagelse.dk",
  });

  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((e) => e.includes("Mærkning")));
});

test("validateAdCreative accepterer korrekt mærket annonce", () => {
  const valid = validateAdCreative({
    overskrift: "Lokalt håndværkertilbud i Skælskør",
    badgeTekst: "ANNONCE",
    linkUrl: "https://haandvaerk.dk",
  });

  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);
});

test("STANDARD_AD_PRICES afspejler Min By Media og lokalprislisten", () => {
  assert.equal(STANDARD_AD_PRICES.EVENT_POST, 499, "Event Post skal koste 499 kr.");
  assert.equal(STANDARD_AD_PRICES.IN_FEED_BANNER, 3500, "In-feed banner ugepris skal være 3.500 kr.");
  assert.equal(STANDARD_AD_PRICES.NATIVE_PREMIUM, 14500, "Native premium artikel skal være 14.500 kr.");
});
