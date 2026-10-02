import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import { compare, hash } from "bcryptjs";
import { db } from "../lib/db";
import { resetRateLimitStoreForTests } from "../lib/ratelimit";
import { createInstance, createUser, findElement, installNextMocks, session } from "./helpers/mock-session";

installNextMocks();

const OLD = "gammel-kode-Ræv-77";
const GOOD = "havregryn-og-fyrtaarn-42";

type AuthMod = typeof import("../lib/auth");
type KontoActions = typeof import("../app/redaktion/konto/actions");
let auth: AuthMod;
let konto: KontoActions;
let instansId = "";
let userId = "";
let email = "";

/** Finder et element med givet id i et React-træ (uden at serialisere funktioner/moduler). */
function hasId(node: unknown, id: string): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((n) => hasId(n, id));
  const props = (node as { props?: Record<string, unknown> }).props;
  if (!props) return false;
  return props.id === id || Object.values(props).some((v) => v && typeof v === "object" && hasId(v, id));
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}
const change = (current: string, next: string, confirm = next) => konto.changePasswordAction({}, form({ current, next, confirm }));

async function freshUser(extra: { mustChangePassword?: boolean; passwordChangedAt?: Date | null } = {}) {
  const u = await createUser(instansId, "Ansvarshavende redaktør");
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await hash(OLD, 4), ...extra } });
  session.userId = u.id;
  session.authTime = null;
  userId = u.id;
  email = u.email;
  return u;
}

before(async () => {
  instansId = (await createInstance("Pw")).id;
  auth = await import("../lib/auth");
  konto = await import("../app/redaktion/konto/actions");
});

beforeEach(() => {
  resetRateLimitStoreForTests();
  session.signInProviders.length = 0;
});

after(async () => {
  await db.auditLog.deleteMany({ where: { instansId } });
  await db.user.deleteMany({ where: { instansId } });
  await db.instance.delete({ where: { id: instansId } });
  await db.$disconnect();
});

test("forkert nuværende adgangskode afvises uden at ændre noget", async () => {
  await freshUser();
  const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const res = await change("forkert-kode-123", GOOD);
  assert.equal(res.ok, undefined);
  assert.deepEqual(res.errors?.current, ["Den nuværende adgangskode er forkert."]);
  const after = await db.user.findUniqueOrThrow({ where: { id: userId } });
  assert.equal(after.passwordHash, before.passwordHash);
  assert.equal(after.passwordChangedAt, null);
});

test("lockout efter 5 forkerte forsøg: selv den rigtige kode afvises bagefter", async () => {
  await freshUser();
  for (let i = 0; i < 5; i++) {
    const res = await change("forkert-kode-123", GOOD);
    assert.ok(res.errors?.current, `forsøg ${i + 1} skal give feltfejl`);
  }
  const locked = await change(OLD, GOOD);
  assert.equal(locked.ok, undefined);
  assert.match(locked.message ?? "", /For mange forkerte forsøg/);
  assert.equal(await compare(OLD, (await db.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash), true, "koden må ikke være skiftet");
});

test("fail-closed: er rate-limit-storen nede, afvises kodeskift", async () => {
  await freshUser();
  const { setRateLimitStore, MemoryRateLimitStore } = await import("../lib/ratelimit");
  const degraded = new MemoryRateLimitStore();
  setRateLimitStore({
    hit: (key, windowMs, now) => ({ ...degraded.hit(key, windowMs, now), degraded: true }),
    peek: (key, now) => degraded.peek(key, now),
    reset: (key) => degraded.reset(key),
    isDegraded: () => true,
  });
  try {
    const res = await change(OLD, GOOD);
    assert.equal(res.ok, undefined);
    assert.match(res.message ?? "", /midlertidigt optaget/);
  } finally {
    resetRateLimitStoreForTests();
  }
  assert.equal(await compare(OLD, (await db.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash), true);
});

test("ny adgangskode skal overholde politikken og være gentaget korrekt", async () => {
  await freshUser();
  assert.ok((await change(OLD, "kort1")).errors?.next?.some((m) => m.includes("mindst 12")));
  assert.ok((await change(OLD, "password1234")).errors?.next?.some((m) => m.includes("almindelig")));
  assert.ok((await change(OLD, OLD)).errors?.next?.some((m) => m.includes("anden end")));
  assert.ok((await change(OLD, email)).errors?.next);
  assert.deepEqual((await change(OLD, GOOD, GOOD + "x")).errors?.confirm, ["De to nye adgangskoder er ikke ens."]);
  assert.ok((await change("", GOOD)).errors?.current);
  assert.equal(await compare(OLD, (await db.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash), true);
});

test("succes: ny hash, passwordChangedAt, mustChangePassword slukket, revisionsspor, ny session udstedt, ingen kode i svar/spor", async () => {
  await freshUser({ mustChangePassword: true });
  const res = await change(OLD, GOOD);
  assert.equal(res.ok, true);
  assert.match(res.message ?? "", /skiftet/);
  const row = await db.user.findUniqueOrThrow({ where: { id: userId } });
  assert.equal(await compare(GOOD, row.passwordHash), true);
  assert.equal(await compare(OLD, row.passwordHash), false);
  assert.notEqual(row.passwordHash, GOOD);
  assert.ok(row.passwordChangedAt && Date.now() - row.passwordChangedAt.getTime() < 10_000);
  assert.equal(row.mustChangePassword, false);
  assert.deepEqual(session.signInProviders, ["credentials"], "nuværende session erstattes af en ny");
  const audit = await db.auditLog.findMany({ where: { targetId: userId, action: "password.change" } });
  assert.equal(audit.length, 1);
  const serialized = JSON.stringify([res, audit]);
  assert.ok(!serialized.includes(GOOD) && !serialized.includes(OLD) && !serialized.includes(row.passwordHash), "ingen adgangskode eller hash i svar/revisionsspor");
});

test("sessioner udstedt før kodeskiftet afvises; den nye (og tokens uden kodeskift) gælder", async () => {
  const changedAt = new Date();
  await freshUser({ passwordChangedAt: changedAt });
  session.authTime = changedAt.getTime() - 60_000; // stjålen/gammel session
  assert.equal(await auth.getAuthorizedUser(), null);
  assert.equal(await auth.getFreshSession(), null);
  assert.equal((await auth.getSessionState()).status, "anonymous");
  session.authTime = null; // token uden authTime
  assert.equal(await auth.getAuthorizedUser(), null);
  session.authTime = changedAt.getTime() + 1; // frisk session efter kodeskift
  assert.equal((await auth.getAuthorizedUser())?.id, userId);

  await db.user.update({ where: { id: userId }, data: { passwordChangedAt: null } });
  session.authTime = null;
  assert.equal((await auth.getAuthorizedUser())?.id, userId, "uden kodeskift er gamle tokens gyldige");
});

test("end-to-end: efter et kodeskift dør den gamle session, men en ny virker", async () => {
  await freshUser();
  session.authTime = Date.now() - 5_000; // sessionen blev udstedt før kodeskiftet
  assert.ok(await auth.getAuthorizedUser());
  assert.equal((await change(OLD, GOOD)).ok, true);
  assert.equal(await auth.getAuthorizedUser(), null, "den gamle JWT afvises nu");
  session.authTime = Date.now() + 1; // udstedt af signIn efter kodeskiftet
  assert.ok(await auth.getAuthorizedUser());
});

test("deaktiveret bruger afvises selv med gyldig session", async () => {
  await freshUser();
  assert.ok(await auth.getAuthorizedUser());
  await db.user.update({ where: { id: userId }, data: { deaktiveretTid: new Date() } });
  assert.equal(await auth.getAuthorizedUser(), null);
});

test("tvungen kodeskift: getAuthorizedUser/getFreshSession nægter, kun kodeskiftet slipper igennem", async () => {
  await freshUser({ mustChangePassword: true });
  assert.equal(await auth.getAuthorizedUser(), null);
  assert.equal(await auth.getAuthorizedUser("article.create"), null);
  assert.equal(await auth.getFreshSession(), null);
  const allowed = await auth.getAuthorizedUser(undefined, { allowPasswordChange: true });
  assert.equal(allowed?.id, userId);
  assert.equal(allowed?.mustChangePassword, true);
});

test("tvungen kodeskift spærrer eksisterende server actions og sider", async () => {
  await freshUser({ mustChangePassword: true });
  const { saveAreaAction } = await import("../app/redaktion/omraader/actions");
  await assert.rejects(() => saveAreaAction(form({ navn: "Testby" })), /Ingen adgang/);
  const { createUserAction } = await import("../app/redaktion/brugere/actions");
  assert.deepEqual((await createUserAction(form({ navn: "X Y", email: "x@y.dk", roleId: "x" }))).ok, false);
  const page = await (await import("../app/redaktion/omraader/page")).default();
  const { NoAccess } = await import("../components/admin/no-access");
  assert.ok(findElement(page, NoAccess), "siden viser Ingen adgang");
  assert.equal(await db.user.count({ where: { email: "x@y.dk" } }), 0);

  // når koden er skiftet, åbner alt igen
  assert.equal((await change(OLD, GOOD)).ok, true);
  session.authTime = Date.now() + 1;
  assert.ok(await auth.getAuthorizedUser("category.manage"));
});

test("layout: tvungen kodeskift viser KUN kodeskiftet (children renderes ikke); anonym sendes til log ind", async () => {
  await freshUser({ mustChangePassword: true });
  const Layout = (await import("../app/redaktion/layout")).default;
  const { ChangePasswordForm } = await import("../components/admin/change-password-form");
  const child = { type: "div", props: { id: "hemmeligt-indhold" }, key: null };
  const tree = await Layout({ children: child as never });
  const el = findElement(tree, ChangePasswordForm);
  assert.ok(el, "kodeskift-formularen vises");
  assert.equal(el.props.forced, true);
  assert.equal(hasId(tree, "hemmeligt-indhold"), false, "sidens indhold må ikke være med");

  await db.user.update({ where: { id: userId }, data: { mustChangePassword: false } });
  const normal = await Layout({ children: child as never });
  assert.equal(hasId(normal, "hemmeligt-indhold"), true);

  session.userId = null;
  await assert.rejects(() => Layout({ children: child as never }), /NEXT_REDIRECT:\/login/);
});

test("kodeskift uden session afvises", async () => {
  session.userId = null;
  const res = await change(OLD, GOOD);
  assert.equal(res.ok, undefined);
  assert.match(res.message ?? "", /session/i);
});

test("login-siden og konto-siden: Glemt adgangskode-tekst og konto kræver login", async () => {
  const { readFileSync } = await import("node:fs");
  assert.match(readFileSync(new URL("../app/login/login-form.tsx", import.meta.url), "utf8"), /Glemt adgangskode\? Kontakt en administrator\./);
  session.userId = null;
  const { NoAccess } = await import("../components/admin/no-access");
  const page = await (await import("../app/redaktion/konto/page")).default();
  assert.ok(findElement(page, NoAccess));
});
