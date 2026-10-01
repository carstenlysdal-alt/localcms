import assert from "node:assert/strict";
import test from "node:test";
import { parseSiteColors } from "../lib/site";

test("parseSiteColors bruger standardfarver ved manglende data", () => {
  const colors = parseSiteColors(null);
  assert.equal(colors.accent, "#9E3D1B");
  assert.equal(colors.accentStrong, "#7F2F13");
  assert.equal(colors.accentSoft, "#F6E3D8");
  assert.equal(colors.onAccent, "#FFFFFF");
});

test("parseSiteColors læser tilpassede farver fra instansen", () => {
  const colors = parseSiteColors({
    accent: "#1F5663",
    accentStrong: "#163F49",
    accentSoft: "#DCE9EC",
    onAccent: "#FFFFFF",
  });
  assert.equal(colors.accent, "#1F5663");
  assert.equal(colors.accentStrong, "#163F49");
});
