import assert from "node:assert/strict";
import test, { after } from "node:test";
import { db } from "../lib/db";

// Bevis for testisolation: under `npm test` (scripts/test-runner.ts) skal denne proces bruge sin egen kopi af skabelon-databasen.
// Under `npm run test:dev-db` (CMS_TEST_TEMPLATE ikke sat) springes testen over.
const isolated = Boolean(process.env.CMS_TEST_TEMPLATE);

after(async () => {
  await db.$disconnect();
});

test("npm test bruger en throwaway-database, aldrig prisma/dev.db", { skip: !isolated && "kører mod DATABASE_URL (test:dev-db)" }, async () => {
  const url = process.env.DATABASE_URL ?? "";
  assert.match(url, /^file:.*test-\d+\.db$/, "DATABASE_URL skal pege på test-<pid>.db");
  assert.equal(url.includes("dev.db"), false);

  // Prisma siger selv hvilken fil forbindelsen er åbnet mod.
  const rows = await db.$queryRawUnsafe<{ name: string; file: string }[]>("PRAGMA database_list");
  const main = rows.find((r) => r.name === "main");
  assert.ok(main, "main-database findes");
  assert.match(main.file, new RegExp(`test-${process.pid}\\.db$`));
  assert.equal(main.file.endsWith("prisma/dev.db"), false);
});

test("throwaway-databasen er seedet (netværkets 6 sites findes)", { skip: !isolated && "kører mod DATABASE_URL (test:dev-db)" }, async () => {
  assert.ok((await db.instance.count()) >= 6);
});
