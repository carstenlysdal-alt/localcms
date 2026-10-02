import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import { compare, hash } from "bcryptjs";
import { db } from "../lib/db";
import { PERMISSIONS } from "../lib/permissions";
import { DEFAULT_ROLES } from "../lib/default-roles";
import { resetRateLimitStoreForTests } from "../lib/ratelimit";
import { createInstance, createUser, findElement, installNextMocks, session, uniq } from "./helpers/mock-session";

installNextMocks();

type Actions = typeof import("../app/redaktion/brugere/actions");
let act: Actions;
let instA = "";
let instB = "";
const ADMIN = "Ansvarshavende redaktør";
const created: string[] = [];

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}
const roleId = async (navn: string) => (await db.role.findUniqueOrThrow({ where: { navn } })).id;
async function asUser(instansId: string, role: string) {
  const u = await createUser(instansId, role);
  session.userId = u.id;
  session.authTime = null;
  return u;
}

before(async () => {
  instA = (await createInstance("UsrA")).id;
  instB = (await createInstance("UsrB")).id;
  act = await import("../app/redaktion/brugere/actions");
});

beforeEach(() => resetRateLimitStoreForTests());

after(async () => {
  for (const id of [instA, instB]) {
    await db.auditLog.deleteMany({ where: { instansId: id } });
    await db.user.deleteMany({ where: { instansId: id } });
    await db.instance.delete({ where: { id } });
  }
  for (const navn of created) await db.role.deleteMany({ where: { navn } });
  await db.$disconnect();
});

test("users.manage findes og gives kun til den øverste administratorrolle i standardrollerne", () => {
  assert.equal(PERMISSIONS.USERS_MANAGE, "users.manage");
  const holders = DEFAULT_ROLES.filter((r) => (r.permissions as readonly string[]).includes(PERMISSIONS.USERS_MANAGE)).map((r) => r.navn);
  assert.deepEqual(holders, [ADMIN]);
});

test("uden users.manage: alle actions og siden nægtes (DB-opslag, ikke JWT)", async () => {
  await asUser(instA, "Redaktionsleder");
  session.staleJwtPermissions = [PERMISSIONS.USERS_MANAGE]; // en gammel JWT påstår rettigheden
  const target = await createUser(instA, "Støtte");
  const results = [
    await act.createUserAction(form({ navn: "Ny Bruger", email: "ny@x.dk", roleId: await roleId("Støtte") })),
    await act.resetPasswordAction(target.id),
    await act.changeRoleAction(target.id, await roleId(ADMIN)),
    await act.deactivateUserAction(target.id),
    await act.reactivateUserAction(target.id),
  ];
  for (const r of results) {
    assert.equal(r.ok, false);
    assert.match(r.message, /ikke adgang/);
  }
  const page = await (await import("../app/redaktion/brugere/page")).default();
  const { NoAccess } = await import("../components/admin/no-access");
  assert.ok(findElement(page, NoAccess));
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: target.id } })).roleId, target.roleId);
  session.staleJwtPermissions = [];
});

test("siden viser kun brugere fra egen instans og kun roller inden for rækkevidde", async () => {
  const admin = await asUser(instA, ADMIN);
  const mine = await createUser(instA, "Støtte");
  const foreign = await createUser(instB, "Støtte");
  const page = await (await import("../app/redaktion/brugere/page")).default();
  const { UserAdmin } = await import("../components/admin/user-admin");
  const el = findElement(page, UserAdmin);
  assert.ok(el);
  const ids = (el.props.users as { id: string }[]).map((u) => u.id);
  assert.ok(ids.includes(admin.id) && ids.includes(mine.id));
  assert.ok(!ids.includes(foreign.id), "bruger fra anden instans må ikke vises");
  assert.ok(!JSON.stringify(el.props.users).includes("passwordHash"));
  assert.equal((el.props.roles as unknown[]).length, DEFAULT_ROLES.length);
});

test("tenant-isolation: bruger i anden instans kan hverken nulstilles, få ny rolle eller deaktiveres", async () => {
  await asUser(instA, ADMIN);
  const foreign = await createUser(instB, "Støtte");
  const before = await db.user.findUniqueOrThrow({ where: { id: foreign.id } });
  for (const r of [
    await act.resetPasswordAction(foreign.id),
    await act.changeRoleAction(foreign.id, await roleId("Redaktionsleder")),
    await act.deactivateUserAction(foreign.id),
    await act.reactivateUserAction(foreign.id),
  ]) {
    assert.equal(r.ok, false);
    assert.match(r.message, /findes ikke/);
  }
  const after = await db.user.findUniqueOrThrow({ where: { id: foreign.id } });
  assert.deepEqual(after, before);
  assert.equal(await db.auditLog.count({ where: { targetId: foreign.id } }), 0);
});

test("opret bruger: instans fra udføreren, adgangskode vises én gang og gemmes kun som hash, mustChangePassword, revisionsspor", async () => {
  const admin = await asUser(instA, ADMIN);
  const email = `${uniq("ny")}@test.local`;
  const res = await act.createUserAction(form({ navn: "  Ny <b>Kollega</b> ", email: email.toUpperCase(), roleId: await roleId("Freelancejournalist"), instansId: instB }));
  assert.equal(res.ok, true);
  assert.ok(res.tempPassword && res.tempPassword.length >= 16);
  const row = await db.user.findUniqueOrThrow({ where: { email }, include: { role: true } });
  assert.equal(row.instansId, instA, "klientens instansId ignoreres");
  assert.equal(row.navn, "Ny Kollega");
  assert.equal(row.mustChangePassword, true);
  assert.equal(row.role.navn, "Freelancejournalist");
  assert.notEqual(row.passwordHash, res.tempPassword);
  assert.equal(await compare(res.tempPassword!, row.passwordHash), true);

  const audit = await db.auditLog.findMany({ where: { targetId: row.id } });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, "user.create");
  assert.equal(audit[0].actorId, admin.id);
  assert.equal(audit[0].instansId, instA);
  // Adgangskoden findes ingen andre steder: ikke i revisionssporet, ikke i siden, ikke i nogen User-kolonne.
  assert.ok(!JSON.stringify(audit).includes(res.tempPassword!));
  const page = await (await import("../app/redaktion/brugere/page")).default();
  const { UserAdmin } = await import("../components/admin/user-admin");
  assert.ok(!JSON.stringify(findElement(page, UserAdmin)?.props).includes(res.tempPassword!), "adgangskoden vises ikke igen ved genindlæsning");
  assert.ok(!JSON.stringify({ ...row, passwordHash: undefined }).includes(res.tempPassword!));

  const dup = await act.createUserAction(form({ navn: "Dublet", email, roleId: await roleId("Støtte") }));
  assert.equal(dup.ok, false);
  assert.ok(dup.fieldErrors?.email);
  const invalid = await act.createUserAction(form({ navn: "x", email: "ikke-en-mail", roleId: "" }));
  assert.equal(invalid.ok, false);
  assert.ok(invalid.fieldErrors?.navn && invalid.fieldErrors.email && invalid.fieldErrors.roleId);
});

test("den nye bruger får tvungen kodeskift ved første login", async () => {
  await asUser(instA, ADMIN);
  const email = `${uniq("tvang")}@test.local`;
  const res = await act.createUserAction(form({ navn: "Tvang Test", email, roleId: await roleId("Støtte") }));
  assert.equal(res.ok, true);
  const row = await db.user.findUniqueOrThrow({ where: { email } });
  session.userId = row.id;
  const auth = await import("../lib/auth");
  assert.equal(await auth.getAuthorizedUser(), null);
  assert.equal((await auth.getSessionState()).status, "must-change-password");
});

test("nulstil adgangskode: ny engangskode, mustChangePassword, andres sessioner dør, ikke sig selv", async () => {
  const admin = await asUser(instA, ADMIN);
  const target = await createUser(instA, "Støtte");
  await db.user.update({ where: { id: target.id }, data: { passwordHash: await hash("gammel-kode-Ræv-77", 4) } });
  const res = await act.resetPasswordAction(target.id);
  assert.equal(res.ok, true);
  assert.ok(res.tempPassword && res.tempPassword.length >= 16);
  const row = await db.user.findUniqueOrThrow({ where: { id: target.id } });
  assert.equal(row.mustChangePassword, true);
  assert.ok(row.passwordChangedAt);
  assert.equal(await compare(res.tempPassword!, row.passwordHash), true);
  assert.equal(await compare("gammel-kode-Ræv-77", row.passwordHash), false);
  const audit = await db.auditLog.findFirstOrThrow({ where: { targetId: target.id, action: "user.reset_password" } });
  assert.equal(audit.actorId, admin.id);
  assert.ok(!JSON.stringify(audit).includes(res.tempPassword!));

  // målets gamle session er forældet
  session.userId = target.id;
  session.authTime = row.passwordChangedAt!.getTime() - 10_000;
  const auth = await import("../lib/auth");
  assert.equal((await auth.getSessionState()).status, "anonymous");

  session.userId = admin.id;
  const self = await act.resetPasswordAction(admin.id);
  assert.equal(self.ok, false);
  assert.match(self.message, /Min konto/);
});

test("rolleskift: kan ikke tildele/røre roller med flere rettigheder end udføreren (ingen eskalering)", async () => {
  const limitedName = uniq("Brugeradmin");
  created.push(limitedName);
  const limited = await db.role.create({ data: { navn: limitedName, permissions: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.ARTICLE_CREATE] } });
  const actorUser = await db.user.create({ data: { email: `${uniq("la")}@test.local`, passwordHash: "x", navn: "Begrænset Admin", roleId: limited.id, instansId: instA } });
  session.userId = actorUser.id;
  session.authTime = null;
  const support = await createUser(instA, "Støtte"); // SUPPORT_READ: udføreren har den ikke
  const journalist = await createUser(instA, "Freelancejournalist"); // ARTICLE_CREATE + flere: ikke delmængde
  const bigBoss = await createUser(instA, ADMIN);

  const escalate = await act.changeRoleAction(journalist.id, await roleId(ADMIN));
  assert.equal(escalate.ok, false);
  const touchBoss = await act.resetPasswordAction(bigBoss.id);
  assert.equal(touchBoss.ok, false);
  assert.equal((await act.deactivateUserAction(bigBoss.id)).ok, false);
  assert.equal((await act.changeRoleAction(support.id, limited.id)).ok, false, "målet har en rolle uden for rækkevidde");
  const createAdmin = await act.createUserAction(form({ navn: "Snyd", email: `${uniq("s")}@test.local`, roleId: await roleId(ADMIN) }));
  assert.equal(createAdmin.ok, false);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: bigBoss.id } })).deaktiveretTid, null);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: journalist.id } })).roleId, journalist.roleId);
});

test("rolleskift: gyldigt skift gemmes og logges med fra/til-rolle; ukendt rolle afvises", async () => {
  const admin = await asUser(instA, ADMIN);
  const target = await createUser(instA, "Støtte");
  const ok = await act.changeRoleAction(target.id, await roleId("Redaktionsleder"));
  assert.equal(ok.ok, true);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: target.id } })).roleId, await roleId("Redaktionsleder"));
  const audit = await db.auditLog.findFirstOrThrow({ where: { targetId: target.id, action: "user.change_role" } });
  assert.deepEqual(audit.detail, { fromRole: "Støtte", toRole: "Redaktionsleder" });
  assert.equal(audit.actorId, admin.id);
  assert.equal((await act.changeRoleAction(target.id, "findes-ikke")).ok, false);
});

test("sidste administrator: kan hverken nedgraderes (heller ikke sig selv), deaktiveres eller tælles med når deaktiveret", async () => {
  const inst = (await createInstance("Last")).id;
  try {
    const a1 = await asUser(inst, ADMIN);
    // eneste administrator: egen nedgradering afvises
    const self = await act.changeRoleAction(a1.id, await roleId("Støtte"));
    assert.equal(self.ok, false);
    assert.match(self.message, /mindst én aktiv bruger/);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: a1.id } })).roleId, a1.roleId);

    // to administratorer: den ene kan nedgraderes
    const a2 = await createUser(inst, ADMIN);
    assert.equal((await act.changeRoleAction(a2.id, await roleId("Støtte"))).ok, true);
    // nu er a1 igen den sidste: ingen kan nedgradere/deaktivere
    assert.equal((await act.changeRoleAction(a1.id, await roleId("Redaktionsleder"))).ok, false);
    assert.equal((await act.deactivateUserAction(a1.id)).ok, false, "kan ikke deaktivere sig selv");

    // en deaktiveret administrator tæller ikke med
    const a3 = await createUser(inst, ADMIN);
    assert.equal((await act.deactivateUserAction(a3.id)).ok, true);
    const blocked = await act.changeRoleAction(a1.id, await roleId("Støtte"));
    assert.equal(blocked.ok, false, "a3 er deaktiveret, så a1 er stadig den sidste");

    // en deaktiveret administrator har ingen adgang overhovedet
    session.userId = a3.id;
    assert.equal((await act.deactivateUserAction(a1.id)).ok, false);
    // genaktivér a3: a1 kan nu nedgraderes
    session.userId = a1.id;
    assert.equal((await act.reactivateUserAction(a3.id)).ok, true);
    assert.equal((await act.changeRoleAction(a1.id, await roleId("Støtte"))).ok, true);
    // a3 er nu sidste administrator og kan ikke nedgradere sig selv
    session.userId = a3.id;
    assert.equal((await act.changeRoleAction(a3.id, await roleId("Støtte"))).ok, false);
    // men kan stadig deaktivere en ikke-administrator
    assert.equal((await act.deactivateUserAction(a2.id)).ok, true);
  } finally {
    await db.auditLog.deleteMany({ where: { instansId: inst } });
    await db.user.deleteMany({ where: { instansId: inst } });
    await db.instance.delete({ where: { id: inst } });
  }
});

test("administratorer i en ANDEN instans tæller ikke som 'en anden administrator'", async () => {
  const inst = (await createInstance("Iso")).id;
  try {
    const only = await asUser(inst, ADMIN);
    await createUser(instA, ADMIN); // admin i anden instans
    assert.equal((await act.changeRoleAction(only.id, await roleId("Støtte"))).ok, false);
  } finally {
    await db.user.deleteMany({ where: { instansId: inst } });
    await db.instance.delete({ where: { id: inst } });
  }
});

test("deaktiveret bruger kan ikke bruge sin session, og kan aktiveres igen", async () => {
  await asUser(instA, ADMIN);
  const target = await createUser(instA, "Støtte");
  assert.equal((await act.deactivateUserAction(target.id)).ok, true);
  assert.equal((await act.resetPasswordAction(target.id)).ok, false, "nulstilling kræver en aktiv bruger");
  const adminId = session.userId;
  session.userId = target.id;
  const auth = await import("../lib/auth");
  assert.equal(await auth.getAuthorizedUser(), null);
  session.userId = adminId;
  assert.equal((await act.reactivateUserAction(target.id)).ok, true);
  session.userId = target.id;
  assert.ok(await auth.getAuthorizedUser());
  const actions = (await db.auditLog.findMany({ where: { targetId: target.id }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
  assert.deepEqual(actions, ["user.deactivate", "user.reactivate"]);
});

test("rate limit: for mange nye-bruger-forsøg afvises (fail-closed grænse pr. bruger)", async () => {
  await asUser(instA, ADMIN);
  let last = await act.createUserAction(form({ navn: "x", email: "x", roleId: "" }));
  for (let i = 0; i < 15; i++) last = await act.createUserAction(form({ navn: "x", email: "x", roleId: "" }));
  assert.equal(last.ok, false);
  assert.match(last.message, /for mange forsøg/);
});
