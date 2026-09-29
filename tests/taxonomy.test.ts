import assert from "node:assert/strict";
import test from "node:test";
import { isReservedSlug, validateCategoryNesting } from "../lib/taxonomy";

test("isReservedSlug genkender reserverede offentlige stier", () => {
  assert.equal(isReservedSlug("redaktion"), true);
  assert.equal(isReservedSlug("om-mediet"), true);
  assert.equal(isReservedSlug("kalender"), true);
  assert.equal(isReservedSlug("nyheder"), false);
  assert.equal(isReservedSlug("erhverv"), false);
});

test("validateCategoryNesting afviser mere end to niveauer", () => {
  // Top-kategori oprettes uden forælder
  assert.equal(validateCategoryNesting(null).valid, true);

  // Underkategori oprettes med forælder der er top-kategori (parentId === null)
  assert.equal(validateCategoryNesting({ parentId: null }).valid, true);

  // Tredje niveau afvises (forælderen har allerede en parentId)
  assert.equal(validateCategoryNesting({ parentId: "parent-1" }).valid, false);
});
