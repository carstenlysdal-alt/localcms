import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { PG_SCHEMA, SQLITE_SCHEMA, clientProviderFromSchemaText, isPostgresUrl, needsRegenerate, schemaFor } from "../scripts/db-provider.mjs";

const SCRIPT = path.join(process.cwd(), "scripts", "db-provider.mjs");

test("schemaFor: Postgres-URL'er vælger Postgres-skemaet, alt andet SQLite", () => {
  for (const u of ["postgresql://u:p@h:5432/db", "postgres://u:p@h/db", " POSTGRESQL://x"]) assert.equal(schemaFor(u), PG_SCHEMA, u);
  for (const u of ["file:./dev.db", "file:/tmp/test.db", "", undefined, null, "mysql://x"]) assert.equal(schemaFor(u as string), SQLITE_SCHEMA, String(u));
  assert.equal(isPostgresUrl("postgresql://x"), true);
});

test("generate (tørkørsel): bruger Postgres-skemaet kun når DATABASE_URL er Postgres", () => {
  const pg = spawnSync("node", [SCRIPT, "generate", "--dry-run"], { env: { ...process.env, DATABASE_URL: "postgresql://u:p@h:5432/db" }, encoding: "utf8" });
  assert.equal(pg.status, 0);
  assert.match(pg.stdout, /prisma generate --schema prisma\/postgres\/schema\.prisma/);
  const lite = spawnSync("node", [SCRIPT, "generate", "--dry-run"], { env: { ...process.env, DATABASE_URL: "file:./x.db" }, encoding: "utf8" });
  assert.match(lite.stdout, /prisma generate --schema prisma\/schema\.prisma/);
});

test("migrate (tørkørsel): kører kun for Postgres og printer aldrig URL'en", () => {
  const pg = spawnSync("node", [SCRIPT, "migrate", "--dry-run"], { env: { ...process.env, DATABASE_URL: "postgresql://bruger:hemmelig@h:5432/db" }, encoding: "utf8" });
  assert.equal(pg.status, 0);
  assert.match(pg.stdout, /migrate deploy --schema prisma\/postgres\/schema\.prisma/);
  assert.ok(!pg.stdout.includes("hemmelig"), "URL/adgangskode må ikke udskrives");
  const lite = spawnSync("node", [SCRIPT, "migrate", "--dry-run"], { env: { ...process.env, DATABASE_URL: "file:./x.db" }, encoding: "utf8" });
  assert.match(lite.stdout, /ingen migrationer/);
});

test("selvhelbred: klient bygget til forkert database genereres igen ved start", () => {
  const sqliteClient = 'generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}\n';
  const pgClient = sqliteClient.replace('"sqlite"', '"postgresql"');
  assert.equal(clientProviderFromSchemaText(sqliteClient), "sqlite");
  assert.equal(clientProviderFromSchemaText(pgClient), "postgresql");
  assert.equal(clientProviderFromSchemaText("støj"), null);
  assert.equal(needsRegenerate("postgresql://x", "sqlite"), true, "Railway-fejlen: sqlite-klient + Postgres-URL");
  assert.equal(needsRegenerate("postgresql://x", "postgresql"), false);
  assert.equal(needsRegenerate("file:./dev.db", "sqlite"), false);
  assert.equal(needsRegenerate("file:./dev.db", "postgresql"), true);
  assert.equal(needsRegenerate("postgresql://x", null), false, "ukendt klient håndteres af prestart (genererer)");
});
