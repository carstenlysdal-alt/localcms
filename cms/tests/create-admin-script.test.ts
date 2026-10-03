import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test, { after, before } from "node:test";
import { compare } from "bcryptjs";
import { db } from "../lib/db";
import { ADMIN_ROLE, createAdmin, emailExistsMessage, parseArgs, suggestPlusAddress } from "../scripts/create-admin";
import { createInstance, createUser, uniq } from "./helpers/mock-session";

const root = path.resolve(__dirname, "..");
const run = (args: string[], env: Record<string, string>) =>
  spawnSync(path.join(root, "node_modules/.bin/tsx"), ["scripts/create-admin.ts", ...args], {
    cwd: root,
    env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv,
    encoding: "utf8",
  });

let a = "";
let b = "";
const emails: string[] = [];
const email = (tag: string) => {
  const e = `${uniq(tag)}@test.local`;
  emails.push(e);
  return e;
};

before(async () => {
  a = (await createInstance("AdmA")).id;
  b = (await createInstance("AdmB")).id;
});
after(async () => {
  await db.auditLog.deleteMany({ where: { instansId: { in: [a, b] } } });
  await db.user.deleteMany({ where: { OR: [{ instansId: { in: [a, b] } }, { email: { in: emails } }] } });
  await db.instance.deleteMany({ where: { id: { in: [a, b] } } });
  await db.$disconnect();
});

test("scriptet afviser uden NODE_ENV=production/--force og uden påkrævede argumenter — uden at udskrive noget til stdout", () => {
  const noForce = run(["--instans", "naestved", "--email", "a@b.dk"], { DATABASE_URL: "file:./x.db", NODE_ENV: "development" });
  assert.equal(noForce.status, 1);
  assert.match(noForce.stderr, /NODE_ENV/);
  assert.equal(noForce.stdout, "", "intet må udskrives ved afvisning");

  const noInstans = run(["--email", "a@b.dk", "--force"], { DATABASE_URL: "file:./x.db" });
  assert.equal(noInstans.status, 1);
  assert.match(noInstans.stderr, /--instans/);
  assert.equal(noInstans.stdout, "");

  const noEmail = run(["--instans", "naestved", "--force"], { DATABASE_URL: "file:./x.db" });
  assert.equal(noEmail.status, 1);
  assert.match(noEmail.stderr, /--email/);
  assert.equal(noEmail.stdout, "");
});

test("parseArgs", () => {
  assert.deepEqual(parseArgs(["--instans", "naestved", "--email", "a@b.dk", "--navn", "Mette", "--force"]), { instans: "naestved", email: "a@b.dk", navn: "Mette", force: true });
  assert.deepEqual(parseArgs(["--instans", "x", "--email", "a@b.dk"]), { instans: "x", email: "a@b.dk", navn: undefined, force: false });
  assert.throws(() => parseArgs(["--email", "a@b.dk"]), /--instans/);
  assert.throws(() => parseArgs(["--instans", "x"]), /--email/);
  assert.throws(() => parseArgs(["--instans", "--email", "a@b.dk"]), /--instans/);
  assert.throws(() => parseArgs(["--instans", "x", "--email", "--force"]), /--email/);
});

test("plus-adressering: forslag og dansk besked", () => {
  assert.equal(suggestPlusAddress("carsten@gmail.com", "naestved"), "carsten+naestved@gmail.com");
  assert.equal(suggestPlusAddress("carsten+slagelse@gmail.com", "koege"), "carsten+koege@gmail.com");
  const msg = emailExistsMessage("carsten@gmail.com", "naestved");
  assert.match(msg, /findes allerede/);
  assert.match(msg, /plus-adressering/);
  assert.match(msg, /carsten\+naestved@gmail\.com/);
});

test("createAdmin: rolle Ansvarshavende redaktør, bundet til den valgte instans, midlertidig adgangskode, mustChangePassword, revisionsspor", async () => {
  const mail = email("ny").toUpperCase();
  const res = await createAdmin(db, { instans: a, email: mail, navn: "Mette Admin" });
  assert.equal(res.email, mail.toLowerCase());
  assert.equal(res.instansId, a);
  assert.ok(res.password.length >= 16);

  const row = await db.user.findUniqueOrThrow({ where: { email: res.email }, include: { role: true } });
  assert.equal(row.role.navn, ADMIN_ROLE);
  assert.equal(row.instansId, a, "bundet til den valgte instans");
  assert.notEqual(row.instansId, b);
  assert.equal(row.mustChangePassword, true);
  assert.equal(row.navn, "Mette Admin");
  assert.equal(await compare(res.password, row.passwordHash), true);
  assert.notEqual(row.passwordHash, res.password);

  const audit = await db.auditLog.findMany({ where: { targetId: row.id } });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, "user.create_cli");
  assert.equal(audit[0].instansId, a);
  assert.equal(audit[0].actorId, null);
  assert.equal(audit[0].targetLabel, res.email);
  assert.ok(!JSON.stringify(audit).includes(res.password), "adgangskoden står aldrig i revisionssporet");
  assert.ok(!JSON.stringify(audit).includes(row.passwordHash));
  assert.equal(await db.user.count({ where: { instansId: b } }), 0, "ingen bruger i andre byer");
});

test("createAdmin: findes e-mailen allerede (i en hvilken som helst by) afvises med dansk besked og plus-adresse-forslag, intet oprettes", async () => {
  const other = await createUser(b, ADMIN_ROLE);
  const before = await db.user.count();
  const auditBefore = await db.auditLog.count();
  await assert.rejects(
    () => createAdmin(db, { instans: a, email: other.email.toUpperCase() }),
    (err: Error) => {
      assert.match(err.message, /findes allerede/);
      assert.match(err.message, /plus-adressering/);
      assert.ok(err.message.includes(`${other.email.split("@")[0]}+`), "forslag med plus-adresse");
      assert.ok(!err.message.includes(b), "afslører ikke hvilken by e-mailen tilhører");
      return true;
    },
  );
  assert.equal(await db.user.count(), before);
  assert.equal(await db.auditLog.count(), auditBefore);
});

test("createAdmin: ukendt instans, ugyldig e-mail og manglende rolle afvises; by-nøgle virker som opslag", async () => {
  await assert.rejects(() => createAdmin(db, { instans: "findes-ikke", email: email("x") }), /Ingen by fundet/);
  await assert.rejects(() => createAdmin(db, { instans: a, email: "ikke-en-mail" }), /ikke en gyldig e-mail/);
  // by-nøgle virker som opslag: "naestved" -> naestvedlokalt.dk (seed-instansen)
  const mail = email("key");
  const res = await createAdmin(db, { instans: "naestved", email: mail });
  assert.equal(res.domaene, "naestvedlokalt.dk");
  const inst = await db.instance.findUniqueOrThrow({ where: { id: res.instansId } });
  assert.equal(inst.domaene, "naestvedlokalt.dk");
  assert.match((await db.user.findUniqueOrThrow({ where: { email: mail } })).navn, /^Ansvarshavende redaktør Næstved$/);

  const role = await db.role.findUniqueOrThrow({ where: { navn: ADMIN_ROLE } });
  await db.user.deleteMany({ where: { roleId: role.id, email: mail } });
  await db.role.update({ where: { id: role.id }, data: { navn: `${ADMIN_ROLE} (midlertidigt)` } });
  try {
    await assert.rejects(() => createAdmin(db, { instans: a, email: email("norole") }), /Rollen .* findes ikke/);
  } finally {
    await db.role.update({ where: { id: role.id }, data: { navn: ADMIN_ROLE } });
  }
});

test("adgangskoden logges aldrig af createAdmin (hverken stdout, stderr eller console)", async () => {
  const captured: string[] = [];
  const originals = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  for (const k of Object.keys(originals) as Array<keyof typeof originals>) console[k] = (...args: unknown[]) => void captured.push(args.map(String).join(" "));
  let res;
  try {
    res = await createAdmin(db, { instans: a, email: email("quiet") });
  } finally {
    Object.assign(console, originals);
  }
  assert.ok(res);
  assert.ok(!captured.join("\n").includes(res.password), "createAdmin udskriver intet");
});

test("CLI end-to-end (--force): udskriver adgangskoden ÉN gang som sidste stdout-linje, intet på stderr, hash i databasen", async () => {
  const mail = email("cli");
  const r = run(["--instans", b, "--email", mail, "--navn", "Cli Admin", "--force"], { DATABASE_URL: process.env.DATABASE_URL ?? "", NODE_ENV: "development" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, "");
  const lines = r.stdout.trim().split("\n");
  assert.equal(lines.length, 2, "præcis to linjer: en forklaring uden adgangskode + adgangskoden");
  const password = lines[1];
  assert.match(password, /^[A-Za-z0-9]{6}-[A-Za-z0-9]{6}-[A-Za-z0-9]{6}$/);
  assert.ok(!lines[0].includes(password));
  assert.equal(r.stdout.split(password).length - 1, 1, "adgangskoden optræder kun ÉN gang");
  const row = await db.user.findUniqueOrThrow({ where: { email: mail } });
  assert.equal(row.instansId, b);
  assert.equal(await compare(password, row.passwordHash), true);

  // Samme e-mail igen: afvist med dansk besked, intet på stdout
  const again = run(["--instans", a, "--email", mail, "--force"], { DATABASE_URL: process.env.DATABASE_URL ?? "", NODE_ENV: "development" });
  assert.equal(again.status, 1);
  assert.match(again.stderr, /findes allerede/);
  assert.match(again.stderr, /plus-adressering/);
  assert.equal(again.stdout, "");
});
