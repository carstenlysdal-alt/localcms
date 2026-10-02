import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test, { after } from "node:test";
import { compare } from "bcryptjs";
import { db } from "../lib/db";
import { parseArgs, resetPassword } from "../scripts/reset-password";
import { createInstance, createUser } from "./helpers/mock-session";

const root = path.resolve(__dirname, "..");
const run = (args: string[], env: Record<string, string>) =>
  spawnSync(path.join(root, "node_modules/.bin/tsx"), ["scripts/reset-password.ts", ...args], { cwd: root, env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });

let instansId = "";
after(async () => {
  if (instansId) {
    await db.auditLog.deleteMany({ where: { instansId } });
    await db.user.deleteMany({ where: { instansId } });
    await db.instance.delete({ where: { id: instansId } });
  }
  await db.$disconnect();
});

test("scriptet afviser uden NODE_ENV=production/--force, mod ikke-postgres og uden --email", () => {
  const noForce = run(["--email", "a@b.dk"], { DATABASE_URL: "postgresql://u:p@localhost:1/x", NODE_ENV: "development" });
  assert.equal(noForce.status, 1);
  assert.match(noForce.stderr, /NODE_ENV/);
  assert.equal(noForce.stdout, "", "intet må udskrives ved afvisning");

  const sqlite = run(["--email", "a@b.dk", "--force"], { DATABASE_URL: "file:./x.db" });
  assert.equal(sqlite.status, 1);
  assert.match(sqlite.stderr, /postgresql/);

  const noEmail = run(["--force"], { DATABASE_URL: "postgresql://u:p@localhost:1/x" });
  assert.equal(noEmail.status, 1);
  assert.match(noEmail.stderr, /--email/);
});

test("parseArgs", () => {
  assert.deepEqual(parseArgs(["--email", "a@b.dk", "--force"]), { email: "a@b.dk", force: true });
  assert.throws(() => parseArgs(["--email"]), /--email/);
  assert.throws(() => parseArgs(["--email", "--force"]), /--email/);
});

test("resetPassword: ny midlertidig adgangskode, mustChangePassword, passwordChangedAt, revisionsspor uden hemmeligheder", async () => {
  instansId = (await createInstance("Cli")).id;
  const user = await createUser(instansId, "Ansvarshavende redaktør");
  const res = await resetPassword(db, user.email.toUpperCase());
  assert.equal(res.email, user.email);
  assert.ok(res.password.length >= 16);
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(await compare(res.password, row.passwordHash), true);
  assert.equal(row.mustChangePassword, true);
  assert.ok(row.passwordChangedAt);
  const audit = await db.auditLog.findMany({ where: { targetId: user.id } });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actorId, null);
  assert.ok(!JSON.stringify(audit).includes(res.password));
  await assert.rejects(() => resetPassword(db, "ukendt@example.dk"), /Ingen bruger/);
  await assert.rejects(() => resetPassword(db, "ikke-en-mail"));
});
