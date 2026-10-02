import assert from "node:assert/strict";
import test from "node:test";
import { db } from "../lib/db";
import { caseVariants, containsInsensitive, isPostgresUrl, searchOr } from "../lib/search";
import { searchSiteArticles } from "../lib/site-queries";
import { createInstance, uniq } from "./helpers/mock-session";

test("T5 P2-6: PostgreSQL får mode: insensitive, SQLite får varianter — begge matcher uanset store/små bogstaver", () => {
  assert.deepEqual(searchOr(["titel", "manchet"], "Slagelse", true), [
    { titel: { contains: "Slagelse", mode: "insensitive" } },
    { manchet: { contains: "Slagelse", mode: "insensitive" } },
  ]);
  const sqlite = searchOr(["titel"], "slagelse", false) as Array<{ titel: { contains: string; mode?: string } }>;
  assert.ok(sqlite.every((c) => c.titel.mode === undefined), "mode findes ikke på SQLite-klienten");
  const terms = sqlite.map((c) => c.titel.contains);
  assert.ok(terms.includes("slagelse") && terms.includes("Slagelse") && terms.includes("SLAGELSE"));
  assert.ok(caseVariants("ørsted").includes("Ørsted"), "stort begyndelsesbogstav for æ/ø/å (SQLite LIKE er kun ASCII-ufølsom)");
  assert.deepEqual(searchOr(["titel"], "   ", true), []);
  assert.deepEqual(containsInsensitive("Hej", true), { contains: "Hej", mode: "insensitive" });
  assert.deepEqual(containsInsensitive(" Hej ", false), { contains: "Hej" });
});

test("providerregistrering følger DATABASE_URL", () => {
  assert.equal(isPostgresUrl("postgresql://u:p@h:5432/db"), true);
  assert.equal(isPostgresUrl("postgres://u:p@h/db"), true);
  assert.equal(isPostgresUrl("file:./dev.db"), false);
  assert.equal(isPostgresUrl(""), false);
});

test("offentlig søgning finder 'Slagelse' uanset versaler (og æøå) på SQLite", async () => {
  const inst = await createInstance("Sog");
  try {
    const mk = (titel: string) => db.article.create({ data: { titel, slug: uniq("s"), blocks: [], aiBrug: [], status: "Publiceret", publiceretTid: new Date(), instansId: inst.id } });
    await mk("Slagelse får ny skole");
    await mk("Ørsted henter vindmøller");
    for (const q of ["slagelse", "SLAGELSE", "Slagelse", "ørsted", "Ørsted"]) {
      const res = await searchSiteArticles(inst.id, q);
      assert.equal(res.artikler.length, 1, `søgning på '${q}'`);
    }
  } finally {
    await db.article.deleteMany({ where: { instansId: inst.id } });
    await db.instance.delete({ where: { id: inst.id } });
  }
});
