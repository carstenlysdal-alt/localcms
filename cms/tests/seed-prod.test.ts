import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { compare } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLES } from "../lib/default-roles";
import { instanceSeeds, seedProduction } from "../scripts/seed-prod";

// Tom, throwaway SQLite — prisma/dev.db og testskabelonen røres aldrig.
const dir = mkdtempSync(path.join(tmpdir(), "cms-seedprod-"));
const url = `file:${path.join(dir, "empty.db")}`;
let db: PrismaClient;

before(() => {
  const root = path.resolve(__dirname, "..");
  const res = spawnSync(path.join(root, "node_modules/.bin/prisma"), ["db", "push", "--skip-generate", "--accept-data-loss", "--schema", "prisma/schema.prisma"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  assert.equal(res.status, 0, res.stderr || res.stdout);
  db = new PrismaClient({ datasourceUrl: url });
});

after(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test("de 6 byer, korrekte domæner", () => {
  const seeds = instanceSeeds();
  assert.deepEqual(seeds.map((s) => s.domaene).sort(), ["holbaeklokalt.dk", "koegelokalt.dk", "naestvedlokalt.dk", "ringstedlokalt.dk", "roskildelokalt.dk", "slagelselokalt.dk"]);
});

test("seedProduction opretter instanser, roller og én admin med engangsadgangskode — og er idempotent", async () => {
  const first = await seedProduction(db, { adminEmail: "Admin@Example.dk", adminName: "Første Admin" });
  assert.equal(first.instances.created.length, 6);
  assert.equal(first.roles.created.length, DEFAULT_ROLES.length);
  assert.equal(first.admin.created, true);
  assert.ok(first.admin.password && first.admin.password.length >= 20);
  assert.notEqual(first.admin.password, "cms-demo-2026");

  const user = await db.user.findUniqueOrThrow({ where: { email: "admin@example.dk" }, include: { role: true, instans: true } });
  assert.equal(user.role.navn, "Ansvarshavende redaktør");
  assert.equal(user.instans.domaene, "slagelselokalt.dk");
  assert.equal(await compare(first.admin.password!, user.passwordHash), true);
  assert.equal(await db.instance.count(), 6);
  assert.equal(await db.user.count(), 1);

  const second = await seedProduction(db, { adminEmail: "admin@example.dk" });
  assert.equal(second.instances.created.length, 0);
  assert.equal(second.instances.existing.length, 6);
  assert.equal(second.roles.created.length, 0);
  assert.equal(second.admin.created, false);
  assert.equal(second.admin.password, undefined);
  assert.equal(await db.instance.count(), 6);
  assert.equal(await db.user.count(), 1);
  // adgangskoden er uændret
  const again = await db.user.findUniqueOrThrow({ where: { email: "admin@example.dk" } });
  assert.equal(again.passwordHash, user.passwordHash);
});

test("ugyldig e-mail og ukendt admin-by afvises", async () => {
  await assert.rejects(() => seedProduction(db, { adminEmail: "ikke-en-mail" }));
  await assert.rejects(() => seedProduction(db, { adminEmail: "a@b.dk", adminInstanceDomain: "ukendt.dk" }), /ADMIN_INSTANCE_DOMAIN/);
});

test("CLI afviser uden NODE_ENV=production/--force og mod ikke-postgres", () => {
  const root = path.resolve(__dirname, "..");
  const run = (args: string[], env: Record<string, string>) =>
    spawnSync(path.join(root, "node_modules/.bin/tsx"), ["scripts/seed-prod.ts", ...args], { cwd: root, env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });
  const noForce = run([], { DATABASE_URL: "postgresql://u:p@localhost:1/x", ADMIN_EMAIL: "a@b.dk" });
  assert.equal(noForce.status, 1);
  assert.match(noForce.stderr, /NODE_ENV/);
  const sqlite = run(["--force"], { DATABASE_URL: url, ADMIN_EMAIL: "a@b.dk" });
  assert.equal(sqlite.status, 1);
  assert.match(sqlite.stderr, /postgresql/);
  const noEmail = run(["--force"], { DATABASE_URL: "postgresql://u:p@localhost:1/x" });
  assert.equal(noEmail.status, 1);
  assert.match(noEmail.stderr, /ADMIN_EMAIL/);
});
