import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import { db } from "../lib/db";
import { MemoryRateLimitStore, setRateLimitStore } from "../lib/ratelimit";
import { createInstance, createUser, findElement, installNextMocks, session, uniq } from "./helpers/mock-session";

installNextMocks();

/**
 * "Alle byer" (Artikler + Analytics): skrivebeskyttede, samlede oversigter. Skal være STRENGT begrænset til de byer brugeren har
 * adgang til (hjem + adgangsrækker i databasen) — aldrig til andre byer, og aldrig styret af claim, URL eller klient.
 */
let A = "";
let B = "";
let C = "";
const userIds: string[] = [];
const articleIds: Record<string, string> = {};

before(async () => {
  setRateLimitStore(new MemoryRateLimitStore());
  A = (await createInstance("OvA")).id;
  B = (await createInstance("OvB")).id;
  C = (await createInstance("OvC")).id;
  const now = new Date();
  for (const [key, instansId, views] of [["a", A, 100], ["b", B, 20], ["c", C, 7000]] as const) {
    const art = await db.article.create({ data: { titel: `Artikel ${key} ${uniq("t")}`, slug: uniq("ov"), blocks: [], aiBrug: [], status: "Publiceret", publiceretTid: new Date(now.getTime() - 86_400_000), instansId } });
    articleIds[key] = art.id;
    await db.articleMetric.create({ data: { articleId: art.id, instansId, visninger: views, laesninger: Math.round(views / 2) } });
  }
});
beforeEach(() => {
  session.activeInstansId = null;
});
after(async () => {
  await db.articleMetric.deleteMany({ where: { instansId: { in: [A, B, C] } } });
  await db.article.deleteMany({ where: { instansId: { in: [A, B, C] } } });
  await db.userInstanceAccess.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.instance.deleteMany({ where: { id: { in: [A, B, C] } } });
  await db.$disconnect();
});

async function loginMulti(extra: string[], claim: string | null = null, role = "Ansvarshavende redaktør") {
  const u = await createUser(A, role);
  userIds.push(u.id);
  for (const instansId of extra) await db.userInstanceAccess.create({ data: { userId: u.id, instansId } });
  session.userId = u.id;
  session.authTime = null;
  session.staleJwtPermissions = [];
  session.activeInstansId = claim;
  return u;
}
type Row = { id: string };
async function tableRows(page: unknown): Promise<Row[]> {
  const { DataTable } = await import("../components/ui/DataTable");
  const el = findElement(page, DataTable);
  assert.ok(el, "DataTable findes");
  return el.props.rows as Row[];
}
const searchParams = (o: Record<string, string> = {}) => Promise.resolve(o);

test("Alle byer · Artikler: kun artikler fra byer med adgang (A og B) — aldrig C, også med forfalsket claim", async () => {
  const Page = (await import("../app/redaktion/artikler/alle-byer/page")).default;
  await loginMulti([B], null);
  let ids = (await tableRows(await Page({ searchParams: searchParams() }))).map((r) => r.id).filter((id) => Object.values(articleIds).includes(id));
  assert.deepEqual(ids.sort(), [articleIds.a, articleIds.b].sort());

  await loginMulti([B], C); // forfalsket claim for C (ingen række) ignoreres
  ids = (await tableRows(await Page({ searchParams: searchParams() }))).map((r) => r.id).filter((id) => Object.values(articleIds).includes(id));
  assert.deepEqual(ids.sort(), [articleIds.a, articleIds.b].sort());

  // aktiv by B: oversigten er stadig [A,B] (brugerens byer), ikke kun den aktive
  await loginMulti([B], B);
  ids = (await tableRows(await Page({ searchParams: searchParams() }))).map((r) => r.id).filter((id) => Object.values(articleIds).includes(id));
  assert.deepEqual(ids.sort(), [articleIds.a, articleIds.b].sort());

  // forgiftede/ukendte query-parametre kan ikke udvide omfanget
  await loginMulti([B], null);
  const page = await Page({ searchParams: searchParams({ instansId: C, by: C, forfatter: "x" }) });
  ids = (await tableRows(page)).map((r) => r.id);
  assert.ok(!ids.includes(articleIds.c));
});

test("Alle byer · Artikler: uden adgang til flere byer sendes man til den almindelige liste", async () => {
  const Page = (await import("../app/redaktion/artikler/alle-byer/page")).default;
  await loginMulti([], null);
  await assert.rejects(Page({ searchParams: searchParams() }), /NEXT_REDIRECT:\/redaktion\/artikler/);
  await assert.rejects(Page({ searchParams: searchParams() }), (e: Error) => !/alle-byer/.test(e.message));
});

test("Alle byer · Analytics: totaler og rækker kun for byer med adgang; tilbagekaldt adgang fjerner byen med det samme", async () => {
  const Page = (await import("../app/redaktion/metrikker/alle-byer/page")).default;
  const u = await loginMulti([B], null);
  const page = await Page({ searchParams: searchParams() });
  const rows = await tableRows(page);
  assert.deepEqual(rows.map((r) => r.id).sort(), [A, B].sort());
  const { StatCard } = await import("../components/ui/StatCard");
  const views = findElement(page, StatCard);
  assert.equal(views?.props.value, (120).toLocaleString("da-DK"), "100 + 20 — C's 7000 er ikke med");
  const { Bars } = await import("../components/charts");
  const bars = findElement(page, Bars);
  const total = (bars?.props.series as Array<{ values: number[] }>)[0].values.reduce((a, b) => a + b, 0);
  assert.equal(total, 120);

  await db.userInstanceAccess.deleteMany({ where: { userId: u.id } });
  await assert.rejects(Page({ searchParams: searchParams() }), /NEXT_REDIRECT:\/redaktion\/metrikker/, "kun hjemmet tilbage → normal Analytics");
});

test("Alle byer · Analytics kræver samme rettighed som Analytics (DB-opslag)", async () => {
  const Page = (await import("../app/redaktion/metrikker/alle-byer/page")).default;
  await loginMulti([B], null, "Støtte");
  const { NoAccess } = await import("../components/admin/no-access");
  assert.ok(findElement(await Page({ searchParams: searchParams() }), NoAccess));
});
