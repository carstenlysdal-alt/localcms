import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test, { after, before, beforeEach, mock } from "node:test";
import { db } from "../lib/db";
import { DEFAULT_ROLES } from "../lib/default-roles";
import { PERMISSIONS } from "../lib/permissions";
import { MemoryRateLimitStore, setRateLimitStore } from "../lib/ratelimit";
import { createInstance, createUser, installNextMocks, session, uniq } from "./helpers/mock-session";

installNextMocks();

/**
 * Netværksadgang (ét login til flere byer). Tenant-isolation er den vigtigste invariant: en bruger med [A, B] må aldrig kunne
 * læse eller skrive noget i C — og den AKTIVE by (JWT-claim) er kun et ønske, der genvalideres mod databasen ved hver forespørgsel.
 */
type Auth = typeof import("../lib/auth");
type SwitchActions = typeof import("../app/redaktion/instans-actions");
type NetActions = typeof import("../app/redaktion/brugere/network-actions");
type UserActions = typeof import("../app/redaktion/brugere/actions");

let auth: Auth;
let sw: SwitchActions;
let net: NetActions;
let usr: UserActions;
let A = "";
let B = "";
let C = "";
const ADMIN = "Ansvarshavende redaktør";
const userIds: string[] = [];
const roleNames: string[] = [];

type DbUser = Awaited<ReturnType<typeof createUser>>;

async function makeUser(instansId: string, role = ADMIN): Promise<DbUser> {
  const u = await createUser(instansId, role);
  userIds.push(u.id);
  return u;
}
/** Logger ind som bruger med en given aktiv-by-claim i JWT'en (null = token uden claim, som før funktionen fandtes). */
function login(user: { id: string }, activeInstansId: string | null = null) {
  session.userId = user.id;
  session.authTime = null;
  session.staleJwtPermissions = [];
  session.activeInstansId = activeInstansId;
}
const grant = (userId: string, instansId: string) => db.userInstanceAccess.create({ data: { userId, instansId } });

before(async () => {
  setRateLimitStore(new MemoryRateLimitStore());
  A = (await createInstance("NetA")).id;
  B = (await createInstance("NetB")).id;
  C = (await createInstance("NetC")).id;
  auth = await import("../lib/auth");
  sw = await import("../app/redaktion/instans-actions");
  net = await import("../app/redaktion/brugere/network-actions");
  usr = await import("../app/redaktion/brugere/actions");
});

beforeEach(() => {
  setRateLimitStore(new MemoryRateLimitStore());
  session.activeInstansId = null;
});

after(async () => {
  await db.userInstanceAccess.deleteMany({ where: { userId: { in: userIds } } });
  await db.auditLog.deleteMany({ where: { instansId: { in: [A, B, C] } } });
  await db.operatorAction.deleteMany({ where: { instansId: { in: [A, B, C] } } });
  await db.signal.deleteMany({ where: { instansId: { in: [A, B, C] } } });
  await db.apiKey.deleteMany({ where: { instansId: { in: [A, B, C] } } });
  await db.media.deleteMany({ where: { instansId: { in: [A, B, C] } } });
  await db.frontpagePlacement.deleteMany({ where: { instansId: { in: [A, B, C] } } });
  await db.article.deleteMany({ where: { instansId: { in: [A, B, C] } } });
  await db.category.deleteMany({ where: { instansId: { in: [A, B, C] } } });
  await db.user.deleteMany({ where: { OR: [{ id: { in: userIds } }, { instansId: { in: [A, B, C] } }] } });
  for (const navn of roleNames) await db.role.deleteMany({ where: { navn } });
  await db.instance.deleteMany({ where: { id: { in: [A, B, C] } } });
  await db.$disconnect();
});

// ── Aktiv instans i de DB-friske hjælpere ────────────────────────────────────

test("uden claim (token fra før funktionen) er den aktive by hjemmet; homeInstansId er særskilt", async () => {
  const u = await makeUser(A);
  login(u, null);
  const fresh = await auth.getFreshSession();
  assert.equal(fresh?.user.instansId, A);
  assert.equal(fresh?.user.homeInstansId, A);
});

test("claim = by med adgangsrække: getAuthorizedUser, getFreshSession og getSessionState returnerer ALLE den aktive by", async () => {
  const u = await makeUser(A);
  await grant(u.id, B);
  login(u, B);
  const authorized = await auth.getAuthorizedUser();
  const fresh = await auth.getFreshSession();
  const state = await auth.getSessionState();
  assert.equal(authorized?.instansId, B);
  assert.equal(authorized?.homeInstansId, A);
  assert.equal(fresh?.user.instansId, B);
  assert.equal(state.status === "ok" && state.user.instansId, B);
  assert.equal(state.status === "ok" && state.user.homeInstansId, A);
});

test("claim for en by UDEN adgangsrække ignoreres (falder tilbage til hjemmet) — klienten kan ikke vælge C", async () => {
  const u = await makeUser(A);
  await grant(u.id, B);
  login(u, C);
  assert.equal((await auth.getAuthorizedUser())?.instansId, A);
});

test("tilbagekaldt adgang: forældet claim ignoreres ved næste forespørgsel og logges kun én gang", async () => {
  const u = await makeUser(A);
  const row = await grant(u.id, B);
  login(u, B);
  assert.equal((await auth.getAuthorizedUser())?.instansId, B);
  await db.userInstanceAccess.delete({ where: { id: row.id } });
  const warn = mock.method(console, "warn", () => undefined);
  try {
    assert.equal((await auth.getAuthorizedUser())?.instansId, A, "forældet claim → hjemmet");
    assert.equal((await auth.getFreshSession())?.user.instansId, A);
    assert.equal((await auth.getSessionState()).status, "ok");
    assert.equal(warn.mock.callCount(), 1, "logges én gang pr. (bruger, afvist by)");
    assert.doesNotMatch(String(warn.mock.calls[0].arguments[0]), /passw|hash|token/i);
  } finally {
    warn.mock.restore();
  }
});

test("to parallelle sessioner med hver sin aktive by blander ikke (claimen er den eneste tilstand — ingen server-global)", async () => {
  const u = await makeUser(A);
  await grant(u.id, B);
  const seen: string[] = [];
  for (const claim of [A, B, B, A, null, B]) {
    login(u, claim);
    seen.push((await auth.getAuthorizedUser())!.instansId);
  }
  assert.deepEqual(seen, [A, B, B, A, A, B]);
});

test("kodeskift og deaktivering virker uændret sammen med den aktive by", async () => {
  const u = await makeUser(A);
  await grant(u.id, B);
  login(u, B);
  session.authTime = Date.now() - 60_000;
  await db.user.update({ where: { id: u.id }, data: { passwordChangedAt: new Date() } });
  assert.equal(await auth.getAuthorizedUser(), null, "session udstedt før kodeskift afvises, uanset aktiv by");
  await db.user.update({ where: { id: u.id }, data: { passwordChangedAt: null, deaktiveretTid: new Date() } });
  session.authTime = null;
  assert.equal(await auth.getAuthorizedUser(), null, "deaktiveret bruger afvises");
  await db.user.update({ where: { id: u.id }, data: { deaktiveretTid: null, mustChangePassword: true } });
  assert.equal(await auth.getAuthorizedUser(), null, "tvungen kodeskift spærrer stadig alt");
  await db.user.update({ where: { id: u.id }, data: { mustChangePassword: false } });
});

// ── JWT- og session-callbacks (de rigtige, fra lib/auth.ts) ──────────────────

test("jwt-callback: login sætter aktiv by = hjem; eksisterende token genvalideres mod DB; update-anmodning er kun et ønske", async () => {
  const u = await makeUser(A);
  const cb = session.callbacks!;
  const signedIn = await cb.jwt({ token: {}, user: { id: u.id, roleId: u.roleId, roleName: ADMIN, instansId: A, authorId: null, permissions: [] } });
  assert.equal(signedIn?.instansId, A);
  assert.equal(signedIn?.activeInstansId, A);

  const base = { sub: u.id, authTime: Date.now(), instansId: A };
  // ingen claim → hjem
  assert.equal((await cb.jwt({ token: { ...base } }))?.activeInstansId, A);
  // claim uden adgang → hjem
  assert.equal((await cb.jwt({ token: { ...base, activeInstansId: C } }))?.activeInstansId, A);
  // update-anmodning uden adgang: forfalsket ønske ignoreres, nuværende (gyldige) by beholdes
  await grant(u.id, B);
  assert.equal((await cb.jwt({ token: { ...base, activeInstansId: B }, trigger: "update", session: { user: { activeInstansId: C } } }))?.activeInstansId, B);
  assert.equal((await cb.jwt({ token: { ...base, activeInstansId: A }, trigger: "update", session: { user: { activeInstansId: B } } }))?.activeInstansId, B);
  // ikke-streng/ugyldigt ønske ignoreres
  assert.equal((await cb.jwt({ token: { ...base, activeInstansId: A }, trigger: "update", session: { user: { activeInstansId: { $ne: null } } } }))?.activeInstansId, A);
  // tilbagekaldt adgang i DB → hjem, selv med gyldig claim i token
  await db.userInstanceAccess.deleteMany({ where: { userId: u.id } });
  assert.equal((await cb.jwt({ token: { ...base, activeInstansId: B } }))?.activeInstansId, A);
  // hjemmet læses fra DB (ikke fra tokenets gamle claim)
  assert.equal((await cb.jwt({ token: { ...base, instansId: C, activeInstansId: C } }))?.instansId, A);
});

test("jwt-callback: slettet/deaktiveret bruger og session fra før kodeskift giver ingen session (som før)", async () => {
  const u = await makeUser(A);
  const cb = session.callbacks!;
  assert.equal(await cb.jwt({ token: { sub: "findes-ikke", authTime: Date.now() } }), null);
  await db.user.update({ where: { id: u.id }, data: { passwordChangedAt: new Date() } });
  assert.equal(await cb.jwt({ token: { sub: u.id, authTime: Date.now() - 10_000 } }), null);
  await db.user.update({ where: { id: u.id }, data: { passwordChangedAt: null, deaktiveretTid: new Date() } });
  assert.equal(await cb.jwt({ token: { sub: u.id, authTime: Date.now() } }), null);
});

test("session-callback: session.user.instansId = aktiv by, homeInstansId = hjem", async () => {
  const cb = session.callbacks!;
  const out = (await cb.session({ session: { user: {} }, token: { sub: "u1", instansId: A, activeInstansId: B, permissions: [] } })) as { user: { instansId: string; homeInstansId: string; activeInstansId: string } };
  assert.equal(out.user.instansId, B);
  assert.equal(out.user.activeInstansId, B);
  assert.equal(out.user.homeInstansId, A);
  const legacy = (await cb.session({ session: { user: {} }, token: { sub: "u1", instansId: A, permissions: [] } })) as { user: { instansId: string } };
  assert.equal(legacy.user.instansId, A, "token uden claim → hjem");
});

// ── switchInstance ───────────────────────────────────────────────────────────

test("switchInstance: kun hjem/medlemsby; opdaterer claimen, skriver revisionsspor i målbyen (fra/til) og ingen hemmeligheder", async () => {
  const u = await makeUser(A);
  await grant(u.id, B);
  login(u, null);
  const ok = await sw.switchInstance(B);
  assert.equal(ok.ok, true);
  assert.equal(session.activeInstansId, B, "claimen er skrevet via update-triggeren");
  assert.equal((await auth.getAuthorizedUser())?.instansId, B);
  const entry = await db.auditLog.findFirstOrThrow({ where: { action: "instance.switch", actorId: u.id } });
  assert.equal(entry.instansId, B, "audit i den aktive (nye) by");
  assert.deepEqual(entry.detail, { from: A, to: B });
  assert.ok(!JSON.stringify(entry).match(/passw|hash/i));

  // tilbage til hjemmet er altid tilladt
  assert.equal((await sw.switchInstance(A)).ok, true);
  assert.equal(session.activeInstansId, A);
  // samme by igen: uden effekt
  assert.equal((await sw.switchInstance(A)).ok, true);
});

test("switchInstance uden adgang (C), med ugyldigt input og uden login fejler — claimen ændres ikke", async () => {
  const u = await makeUser(A);
  await grant(u.id, B);
  login(u, B);
  for (const bad of [C, "", "x".repeat(200), "../etc", undefined as unknown as string, { $ne: B } as unknown as string]) {
    const res = await sw.switchInstance(bad);
    assert.equal(res.ok, false, String(bad));
    assert.equal(session.activeInstansId, B);
  }
  session.userId = null;
  assert.equal((await sw.switchInstance(B)).ok, false);
  assert.equal(await db.auditLog.count({ where: { action: "instance.switch", actorId: u.id } }), 0);
});

test("switchInstance afvises for deaktiveret bruger, forældet session og tvungen kodeskift", async () => {
  const u = await makeUser(A);
  await grant(u.id, B);
  login(u, null);
  await db.user.update({ where: { id: u.id }, data: { mustChangePassword: true } });
  assert.equal((await sw.switchInstance(B)).ok, false);
  await db.user.update({ where: { id: u.id }, data: { mustChangePassword: false, deaktiveretTid: new Date() } });
  assert.equal((await sw.switchInstance(B)).ok, false);
  await db.user.update({ where: { id: u.id }, data: { deaktiveretTid: null, passwordChangedAt: new Date() } });
  session.authTime = Date.now() - 60_000;
  assert.equal((await sw.switchInstance(B)).ok, false);
  assert.equal(session.activeInstansId, null);
});

test("switchInstance er rate-limitet pr. bruger (fail-closed)", async () => {
  const u = await makeUser(A);
  await grant(u.id, B);
  login(u, null);
  let blocked = 0;
  for (let i = 0; i < 40; i++) if (!(await sw.switchInstance(i % 2 ? A : B)).ok) blocked++;
  assert.ok(blocked > 0, "efter grænsen afvises skift");
});

test("klienten kan ikke POSTe til /api/auth/session for at vælge by (kun serveractionen)", async () => {
  const route = await import("../app/api/auth/[...nextauth]/route");
  const res = await route.POST(new Request("http://localhost/api/auth/session", { method: "POST", body: JSON.stringify({ data: { activeInstansId: C } }) }) as never);
  assert.equal(res.status, 405);
});

// ── Tenant-isolation: bruger med [A, B] kan intet i C ────────────────────────

test("isolation: med adgang til [A,B] kan ingen server-action læse/skrive i C (og kun i den AKTIVE by)", async () => {
  const me = await makeUser(A);
  await grant(me.id, B);
  const inC = await makeUser(C, "Støtte");
  const inB = await makeUser(B, "Støtte");
  const mk = async (instansId: string) => {
    const tag = uniq("iso");
    const signal = await db.signal.create({ data: { overskrift: `Signal ${tag}`, instansId } });
    const media = await db.media.create({ data: { filtype: "dokument", url: `/x/${tag}`, instansId } });
    const category = await db.category.create({ data: { navn: tag, slug: tag, instansId } });
    const article = await db.article.create({ data: { titel: tag, slug: tag, blocks: [], aiBrug: [], status: "Godkendelse", instansId } });
    const placement = await db.frontpagePlacement.create({ data: { zone: "top-hoved", articleId: article.id, instansId } });
    const { createApiKey } = await import("../lib/ingest/auth");
    const key = await createApiKey({ instansId, name: `Nøgle ${tag}`, scopes: ["health:read"] });
    return { signal, media, category, article, placement, key };
  };
  const dataC = await mk(C);
  const dataB = await mk(B);
  const media = await import("../app/redaktion/medier/actions");
  const sections = await import("../app/redaktion/sektioner/actions");
  const signals = await import("../app/redaktion/signaler/actions");
  const articles = await import("../app/redaktion/artikler/actions");
  const forside = await import("../app/redaktion/forside/actions");
  const ingest = await import("../app/redaktion/ingest/actions");
  const fd = new FormData();
  fd.set("altTekst", "x");

  async function attack(d: Awaited<ReturnType<typeof mk>>) {
    const out: boolean[] = [];
    out.push((await signals.approveSignal(d.signal.id)).ok);
    out.push(Boolean("success" in (await media.updateMedia(d.media.id, {}, fd))));
    out.push(!("error" in (await sections.deleteCategory(d.category.id))));
    out.push(await articles.toggleArticleFlag(d.article.id, "pinned").then(() => true, () => false));
    out.push(await forside.removePlacementAction(d.placement.id).then(() => true, () => false));
    out.push((await ingest.revokeIngestKeyAction(d.key.id)).success);
    return out;
  }
  const untouched = async (d: Awaited<ReturnType<typeof mk>>) => {
    assert.equal((await db.signal.findUniqueOrThrow({ where: { id: d.signal.id } })).godkendtTid, null);
    assert.equal((await db.media.findUniqueOrThrow({ where: { id: d.media.id } })).altTekst, null);
    assert.ok(await db.category.findUnique({ where: { id: d.category.id } }));
    assert.equal((await db.article.findUniqueOrThrow({ where: { id: d.article.id } })).pinned, false);
    assert.ok(await db.frontpagePlacement.findUnique({ where: { id: d.placement.id } }));
    assert.equal((await db.apiKey.findUniqueOrThrow({ where: { id: d.key.id } })).revokedAt, null);
  };

  // Aktiv by A: hverken C eller B (aktiv by er A) kan røres.
  login(me, A);
  assert.deepEqual(await attack(dataC), [false, false, false, false, false, false], "C");
  assert.deepEqual(await attack(dataB), [false, false, false, false, false, false], "B mens A er aktiv");
  await untouched(dataC);
  await untouched(dataB);
  // Selv med en FORFALSKET claim for C (ingen adgangsrække) rammer intet C.
  login(me, C);
  assert.deepEqual(await attack(dataC), [false, false, false, false, false, false], "forfalsket claim");
  await untouched(dataC);
  // Brugeradministration: brugere i C/B findes ikke for en admin med aktiv by A.
  login(me, A);
  assert.equal((await usr.changeRoleAction(inC.id, (await db.role.findUniqueOrThrow({ where: { navn: "Freelancejournalist" } })).id)).ok, false);
  assert.equal((await usr.resetPasswordAction(inC.id)).ok, false);
  assert.equal((await usr.deactivateUserAction(inB.id)).ok, false);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: inC.id } })).deaktiveretTid, null);

  // Skift til B (lovligt): nu virker B, men C er stadig låst, og A's data er ikke længere i scope.
  login(me, null);
  assert.equal((await sw.switchInstance(B)).ok, true);
  assert.deepEqual(await attack(dataC), [false, false, false, false, false, false], "C efter skift til B");
  await untouched(dataC);
  assert.equal((await usr.deactivateUserAction(inB.id)).ok, true, "B's bruger kan nu administreres");
  assert.equal((await usr.deactivateUserAction(inC.id)).ok, false);
  assert.equal((await signals.approveSignal(dataB.signal.id)).ok, true, "signal i B kan godkendes efter skift");
  assert.equal((await ingest.revokeIngestKeyAction(dataB.key.id)).success, true);
  assert.ok((await db.apiKey.findUniqueOrThrow({ where: { id: dataC.key.id } })).revokedAt === null);

  // Brugeroprettelse lander i den aktive by (B), ikke hjemmet, og revisionsspor har den aktive by.
  const form = new FormData();
  const email = `${uniq("nyny")}@test.local`;
  form.set("navn", "Ny Bruger");
  form.set("email", email);
  form.set("roleId", (await db.role.findUniqueOrThrow({ where: { navn: "Støtte" } })).id);
  assert.equal((await usr.createUserAction(form)).ok, true);
  const created = await db.user.findUniqueOrThrow({ where: { email } });
  userIds.push(created.id);
  assert.equal(created.instansId, B);
  const entry = await db.auditLog.findFirstOrThrow({ where: { action: "user.create", targetId: created.id } });
  assert.equal(entry.instansId, B, "audit bærer den aktive by");
});

test("operatør: bekræftelses-token udstedt i by A kan ikke indløses efter skift til B (og omvendt)", async () => {
  const confirm = await import("../lib/operator/confirm");
  const me = await makeUser(A);
  await grant(me.id, B);
  login(me, A);
  const inA = (await auth.getAuthorizedUser())!;
  const issued = await confirm.issueConfirmation({ user: inA, tool: "create_user", input: { navn: "X Y", email: "x@y.dk", rolle: "Støtte" }, sessionId: "op_t1", now: new Date() });
  assert.equal((await db.operatorAction.findUniqueOrThrow({ where: { id: issued.id } })).instansId, A);

  login(me, B);
  const inB = (await auth.getAuthorizedUser())!;
  assert.equal(inB.instansId, B);
  assert.deepEqual(await confirm.consumeConfirmation(inB, issued.token, new Date()), { ok: false, reason: "ugyldig" });
  assert.equal(await confirm.cancelConfirmation(inB, issued.token), false);
  // Tilbage i A virker tokenet stadig — kun dér.
  login(me, A);
  const again = (await auth.getAuthorizedUser())!;
  assert.equal((await confirm.consumeConfirmation(again, issued.token, new Date())).ok, true);
  // Fortryd (undo) er også bundet til instans: en handling fra A findes ikke i B.
  const row = await db.operatorAction.findFirstOrThrow({ where: { id: issued.id } });
  assert.equal(row.instansId, A);
  assert.equal(await db.operatorAction.count({ where: { id: issued.id, instansId: B } }), 0);
});

test("operatøren eksponerer ingen netværksadgang: blokerede navne, intet registreret værktøj, og rettigheden er aldrig i værktøjskrav", async () => {
  const policy = await import("../lib/operator/policy");
  for (const name of ["grant_access", "revoke_access", "set_instance_access", "switch_instance", "switch_city", "give_city_access"]) assert.ok(policy.findBlockedTool(name), name);
  const reg = await import("../lib/operator/registry");
  await import("../lib/operator/extensions");
  const tools = reg.listTools();
  assert.ok(tools.length > 5);
  assert.ok(!tools.some((t) => /access|network|instance|instans|city|by_/.test(t.name)), "ingen værktøjer om adgang/by");
  assert.ok(!tools.some((t) => t.permissions.includes(PERMISSIONS.NETWORK_MANAGE)));
  assert.throws(() => reg.registerTool({ ...tools[0], name: "grant_access" }), /blokeret/);
});

// ── Giv adgang til andre (UI-action) ─────────────────────────────────────────

const NET_ROLE = "NetTest — users+network";
test("network.manage findes og gives kun til den øverste administratorrolle", () => {
  assert.equal(PERMISSIONS.NETWORK_MANAGE, "network.manage");
  const holders = DEFAULT_ROLES.filter((r) => (r.permissions as readonly string[]).includes(PERMISSIONS.NETWORK_MANAGE)).map((r) => r.navn);
  assert.deepEqual(holders, [ADMIN]);
});

test("users.manage alene kan IKKE give adgang til andre byer; kræver network.manage (DB-opslag, ikke JWT)", async () => {
  const roleName = uniq("OnlyUsers");
  roleNames.push(roleName);
  await db.role.create({ data: { navn: roleName, permissions: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.ARTICLE_CREATE] } });
  const onlyUsers = await makeUser(A, roleName);
  await grant(onlyUsers.id, B);
  const target = await makeUser(A, "Støtte");
  login(onlyUsers, A);
  session.staleJwtPermissions = [PERMISSIONS.NETWORK_MANAGE];
  const res = await net.setUserInstanceAccessAction(target.id, [B]);
  assert.equal(res.ok, false);
  assert.equal(await db.userInstanceAccess.count({ where: { userId: target.id } }), 0);
});

test("giv/fjern adgang: kun byer udføreren selv har, hjemmet kan ikke fjernes, revisionsspor pr. ændring, samme rækkevidde-regel som roller", async () => {
  const actor = await makeUser(A);
  await grant(actor.id, B);
  const target = await makeUser(A, "Freelancejournalist");
  login(actor, A);

  // C har udføreren ikke → afvist, intet ændret
  const noC = await net.setUserInstanceAccessAction(target.id, [C]);
  assert.equal(noC.ok, false);
  assert.equal(await db.userInstanceAccess.count({ where: { userId: target.id } }), 0);
  // B har udføreren → giv; hjemmet (A) i listen ignoreres (ingen række)
  const giveB = await net.setUserInstanceAccessAction(target.id, [A, B]);
  assert.equal(giveB.ok, true);
  assert.deepEqual((await db.userInstanceAccess.findMany({ where: { userId: target.id } })).map((r) => r.instansId), [B]);
  const grantAudit = await db.auditLog.findFirstOrThrow({ where: { action: "user.access_grant", targetId: target.id } });
  assert.equal(grantAudit.instansId, B);
  assert.equal(grantAudit.actorId, actor.id);
  // idempotent: samme valg igen ændrer intet og skriver ikke dubletter
  assert.equal((await net.setUserInstanceAccessAction(target.id, [B])).ok, true);
  assert.equal(await db.auditLog.count({ where: { action: "user.access_grant", targetId: target.id } }), 1);
  // målet kan nu vælge B (hjem + medlem) og stadig ikke C
  login(target, null);
  assert.equal((await sw.switchInstance(B)).ok, true);
  assert.equal((await sw.switchInstance(C)).ok, false);
  // fjern: tom liste fjerner kun den ekstra adgang; hjemmet består (mindst én adgang)
  login(actor, A);
  assert.equal((await net.setUserInstanceAccessAction(target.id, [])).ok, true);
  assert.equal(await db.userInstanceAccess.count({ where: { userId: target.id } }), 0);
  assert.equal(await db.auditLog.count({ where: { action: "user.access_revoke", targetId: target.id, instansId: B } }), 1);
  // målets forældede claim (B) falder tilbage til hjemmet ved næste forespørgsel
  login(target, B);
  assert.equal((await auth.getAuthorizedUser())?.instansId, A);

  // en adgang til C, udføreren ikke har, kan udføreren heller ikke fjerne
  await grant(target.id, C);
  assert.equal((await net.setUserInstanceAccessAction(target.id, [])).ok, false);
  assert.equal(await db.userInstanceAccess.count({ where: { userId: target.id, instansId: C } }), 1);
});

test("giv adgang: ikke sig selv, ikke bruger med flere rettigheder, ikke bruger fra anden by, ikke ukendt by eller ugyldigt input", async () => {
  const actor = await makeUser(A);
  await grant(actor.id, B);
  login(actor, A);
  assert.equal((await net.setUserInstanceAccessAction(actor.id, [B])).ok, false, "ikke sig selv");
  const inC = await makeUser(C, "Støtte");
  assert.equal((await net.setUserInstanceAccessAction(inC.id, [B])).ok, false, "bruger fra anden by findes ikke");
  const target = await makeUser(A, "Støtte");
  for (const bad of [["findes-ikke"], "B", [B, 5], Array(80).fill(B)] as unknown as string[][]) {
    assert.equal((await net.setUserInstanceAccessAction(target.id, bad)).ok, false);
  }
  assert.equal(await db.userInstanceAccess.count({ where: { userId: target.id } }), 0);

  // udfører med netværksrettighed men færre rettigheder end målet kan ikke røre målet
  const roleName = uniq("NetOnly");
  roleNames.push(roleName);
  await db.role.create({ data: { navn: roleName, permissions: [PERMISSIONS.NETWORK_MANAGE, PERMISSIONS.USERS_MANAGE] } });
  const small = await makeUser(A, roleName);
  await grant(small.id, B);
  const strong = await makeUser(A, ADMIN);
  login(small, A);
  const res = await net.setUserInstanceAccessAction(strong.id, [B]);
  assert.equal(res.ok, false);
  assert.match(res.message, /flere rettigheder/);
});

// ── Script ───────────────────────────────────────────────────────────────────

test("grant-access: parseArgs, idempotens, --alle-instanser, --revoke, hjemmeby kan ikke fjernes, revisionsspor", async () => {
  const script = await import("../scripts/grant-access");
  assert.throws(() => script.parseArgs(["--alle-instanser"]), /--email/);
  assert.throws(() => script.parseArgs(["--email", "a@b.dk"]), /--alle-instanser eller --instans/);
  assert.throws(() => script.parseArgs(["--email", "a@b.dk", "--alle-instanser", "--instans", "x"]), /ikke begge/);
  assert.deepEqual(script.parseArgs(["--email", "a@b.dk", "--instans", "naestved", "--revoke", "--force"]), { email: "a@b.dk", alle: false, instans: "naestved", revoke: true, force: true });

  const u = await makeUser(A);
  const first = await script.grantAccess(db, { email: u.email, alle: false, instans: B, revoke: false });
  assert.equal(first.added.length, 1);
  const again = await script.grantAccess(db, { email: u.email, alle: false, instans: B, revoke: false });
  assert.deepEqual([again.added.length, again.unchanged.length], [0, 1], "idempotent");
  assert.equal(await db.auditLog.count({ where: { action: "user.access_grant", targetId: u.id } }), 1);
  // hjemmeby gives implicit (ingen række), men kan ikke fjernes
  assert.equal((await script.grantAccess(db, { email: u.email, alle: false, instans: A, revoke: false })).added.length, 0);
  await assert.rejects(script.grantAccess(db, { email: u.email, alle: false, instans: A, revoke: true }), /Hjemmebyen/);
  await assert.rejects(script.grantAccess(db, { email: u.email, alle: false, instans: "findes-ikke.dk", revoke: false }), /Ingen entydig by/);
  await assert.rejects(script.grantAccess(db, { email: "ingen@test.local", alle: true, revoke: false }), /Ingen bruger/);

  const all = await script.grantAccess(db, { email: u.email, alle: true, revoke: false });
  const instanceCount = await db.instance.count();
  assert.equal(await db.userInstanceAccess.count({ where: { userId: u.id } }), instanceCount - 1, "alle byer undtagen hjemmet");
  assert.ok(all.added.length >= 1);
  const revoked = await script.grantAccess(db, { email: u.email, alle: true, revoke: true });
  assert.equal(revoked.removed.length, instanceCount - 1);
  assert.equal(await db.userInstanceAccess.count({ where: { userId: u.id } }), 0);
  assert.ok((await db.user.findUnique({ where: { id: u.id } }))?.instansId === A, "hjemmet består");
  await db.auditLog.deleteMany({ where: { targetId: u.id } });
});

test("grant-access scriptet afviser uden NODE_ENV=production/--force og uden argumenter — uden output på stdout", () => {
  const root = path.resolve(__dirname, "..");
  const run = (args: string[], env: Record<string, string>) =>
    spawnSync(path.join(root, "node_modules/.bin/tsx"), ["scripts/grant-access.ts", ...args], { cwd: root, env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });
  const noForce = run(["--email", "a@b.dk", "--alle-instanser"], { DATABASE_URL: "file:./x.db", NODE_ENV: "development" });
  assert.equal(noForce.status, 1);
  assert.match(noForce.stderr, /NODE_ENV/);
  assert.equal(noForce.stdout, "");
  const noArgs = run(["--force"], { DATABASE_URL: "file:./x.db" });
  assert.equal(noArgs.status, 1);
  assert.match(noArgs.stderr, /--email/);
  assert.equal(noArgs.stdout, "");
});

// ── Skallen: byskifteren ─────────────────────────────────────────────────────

test("skallen: byskifteren får kun byer med adgang som valgbare, markerer den aktive og viser 'Redigerer: <by>'", async () => {
  const me = await makeUser(A);
  await grant(me.id, B);
  login(me, B);
  const Layout = (await import("../app/redaktion/layout")).default;
  const { CitySwitcher } = await import("../components/admin/city-switcher");
  const { NavLinks } = await import("../components/admin/nav-links");
  const { findElement } = await import("./helpers/mock-session");
  const tree = await Layout({ children: null });
  const sw = findElement(tree, CitySwitcher);
  assert.ok(sw, "CitySwitcher er i topbaren");
  const cities = sw.props.cities as Array<{ by: string; instansId: string | null; current: boolean; home?: boolean }>;
  const selectable = cities.filter((c) => c.instansId).map((c) => c.instansId).sort();
  assert.deepEqual(selectable, [A, B].sort(), "kun hjem og adgangsby er valgbare — netværkets øvrige byer er låst");
  assert.equal(cities.filter((c) => c.current).length, 1);
  assert.equal(cities.find((c) => c.current)?.instansId, B);
  assert.equal(cities.find((c) => c.home)?.instansId, A);
  assert.ok(cities.filter((c) => !c.instansId).length >= 6, "de seks netværksbyer uden adgang er ikke klikbare");
  assert.ok(findElement(tree, NavLinks), "samme by-liste i sidebaren");

  // markup: topbarens knap (aria-expanded), aktiv by og 'Se siden'
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const html = renderToStaticMarkup(createElement(CitySwitcher, { cities: cities.map((c) => ({ ...c, publicHref: c.instansId ? "/?by=x" : null })) as never }));
  assert.match(html, /Redigerer:/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Se siden/);
  // forældet claim til by uden adgang: skallen viser hjemmet som aktiv
  login(me, C);
  const tree2 = await Layout({ children: null });
  const cities2 = findElement(tree2, CitySwitcher)!.props.cities as Array<{ instansId: string | null; current: boolean }>;
  assert.equal(cities2.find((c) => c.current)?.instansId, A);
});
