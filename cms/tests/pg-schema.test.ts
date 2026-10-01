import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { checkInSync, PG_SCHEMA, SOURCE_SCHEMA, toPostgresSchema } from "../scripts/gen-pg-schema";
import { pendingMigrationSql } from "../scripts/pg-migration";

const modelNames = (schema: string) => [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);

test("prisma/postgres/schema.prisma er i sync med prisma/schema.prisma (kør: npm run prisma:pg:schema)", () => {
  const res = checkInSync();
  assert.equal(res.ok, true, res.reason);
});

test("PostgreSQL-skemaet har postgres-provider og samme modeller som kilden", () => {
  const source = readFileSync(SOURCE_SCHEMA, "utf8");
  const pg = readFileSync(PG_SCHEMA, "utf8");
  assert.match(pg, /provider\s*=\s*"postgresql"/);
  assert.ok(!/sqlite/.test(pg.replace(/^\/\/.*$/gm, "")), "ingen sqlite-rester uden for kommentarer");
  assert.match(pg, /url\s*=\s*env\("DATABASE_URL"\)/);
  assert.deepEqual(modelNames(pg), modelNames(source));
  assert.equal((pg.match(/@@index|@@unique|@unique/g) ?? []).length, (source.match(/@@index|@@unique|@unique/g) ?? []).length);
});

test("toPostgresSchema er deterministisk og afviser ikke-sqlite kilder", () => {
  const source = readFileSync(SOURCE_SCHEMA, "utf8");
  assert.equal(toPostgresSchema(source), toPostgresSchema(source));
  assert.throws(() => toPostgresSchema(source.replace('provider = "sqlite"', 'provider = "postgresql"')), /sqlite/);
  assert.throws(() => toPostgresSchema("model A { id String @id }"), /datasource/);
});

test("skemaændringer uden PostgreSQL-migration opdages (kør: npm run prisma:pg:migration -- <navn>)", () => {
  assert.equal(pendingMigrationSql(), "");
});

test("første migration opretter alle tabeller og migration_lock er postgresql", () => {
  const dir = path.resolve(__dirname, "../prisma/postgres/migrations");
  const lock = readFileSync(path.join(dir, "migration_lock.toml"), "utf8");
  assert.match(lock, /provider\s*=\s*"postgresql"/);
  const sql = readFileSync(path.join(dir, "20261001000000_init/migration.sql"), "utf8");
  for (const model of modelNames(readFileSync(PG_SCHEMA, "utf8"))) {
    assert.ok(sql.includes(`CREATE TABLE "${model}"`), `migration mangler tabellen ${model}`);
  }
});
