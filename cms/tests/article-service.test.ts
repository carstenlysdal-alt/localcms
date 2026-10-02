import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { cleanupInstance } from "./helpers/operator-fixtures";
import { createInstance, createUser, installNextMocks, session, uniq } from "./helpers/mock-session";

installNextMocks();

type Svc = typeof import("../lib/article-service");
type Auth = typeof import("../lib/auth");
let svc: Svc;
let auth: Auth;
let inst = "";
let authorId = "";
let nyhederId = "";
let editor: Awaited<ReturnType<typeof createUser>>;
let freelancer: Awaited<ReturnType<typeof createUser>>;

before(async () => {
  svc = await import("../lib/article-service");
  auth = await import("../lib/auth");
  inst = (await createInstance("Svc")).id;
  authorId = (await db.author.create({ data: { navn: "Frida Svc", instansId: inst } })).id;
  nyhederId = (await db.category.create({ data: { instansId: inst, navn: "Nyheder", slug: "nyheder" } })).id;
  editor = await createUser(inst, "Ansvarshavende redaktør");
  freelancer = await createUser(inst, "Freelancejournalist", { authorId });
});
after(() => cleanupInstance(inst));

async function as(u: { id: string }) {
  session.userId = u.id;
  const user = await auth.getAuthorizedUser();
  assert.ok(user);
  return user!;
}
const make = (over: Record<string, unknown> = {}) =>
  db.article.create({ data: { titel: "Service", slug: uniq("svc"), blocks: [{ id: "b", type: "paragraph", data: { content: "<p>x</p>" } }], aiBrug: ["Ingen"], instansId: inst, forfatterId: authorId, kategoriId: nyhederId, status: "Udkast", ...over } });

test("service: scheduleArticle kræver publiceringsret + gyldig overgang + fremtidigt tidspunkt; publicerer aldrig selv", async () => {
  const art = await make({ status: "Godkendelse" });
  const when = new Date(Date.now() + 3600_000);
  const fl = await as(freelancer);
  assert.equal((await svc.scheduleArticle(fl, art.id, when)).ok, false);
  const ed = await as(editor);
  const past = await svc.scheduleArticle(ed, art.id, new Date(Date.now() - 3600_000));
  assert.equal(past.ok, false);
  const bad = await svc.scheduleArticle(ed, art.id, new Date("nope"));
  assert.equal(bad.ok, false);
  const ok = await svc.scheduleArticle(ed, art.id, when);
  assert.ok(ok.ok, JSON.stringify(ok));
  const row = await db.article.findUniqueOrThrow({ where: { id: art.id } });
  assert.equal(row.status, "Planlagt");
  assert.equal(row.publiceretTid, null, "intet publiceres af servicen");
  // ændrer tidspunkt på allerede planlagt artikel (ingen ny overgang)
  const later = new Date(Date.now() + 7200_000);
  assert.ok((await svc.scheduleArticle(ed, art.id, later)).ok);
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: art.id } })).planlagtTid?.toISOString(), later.toISOString());
  // ugyldig overgang (Udkast -> Planlagt)
  const draft = await make();
  assert.equal((await svc.scheduleArticle(ed, draft.id, when)).ok, false);
});

test("service: setArticleSlug på publiceret artikel kræver publiceringsret og opretter redirect; saveArticleDraft afviser live", async () => {
  const live = await make({ status: "Publiceret", publiceretTid: new Date(), slug: uniq("live-a") });
  const old = live.slug;
  const fl = await as(freelancer);
  const denied = await svc.setArticleSlug(fl, live.id, uniq("live-x"));
  assert.equal(denied.ok, false, "forfatter uden publiceringsret kan ikke ændre live-slug");
  const ed = await as(editor);
  const newer = uniq("live-b");
  const ok = await svc.setArticleSlug(ed, live.id, newer);
  assert.ok(ok.ok, JSON.stringify(ok));
  assert.equal(await db.slugRedirect.count({ where: { instansId: inst, fraSlug: old, tilArticleId: live.id } }), 1);
  assert.equal((await svc.saveArticleDraft(ed, live.id, { titel: "Ny titel" })).ok, false);
  assert.ok((await svc.updateArticleFields(ed, live.id, { titel: "Ny titel her" })).ok, "Opdater artikel-semantik virker for publiceret");
});

test("service: saveArticleDraft opretter/opdaterer kladde, baseVersion-konflikt, metadata-patch og isSlugAvailable/suggestSlug", async () => {
  const ed = await as(editor);
  const created = await svc.saveArticleDraft(ed, null, { titel: "Ny kladde fra service", seoTitel: "S" });
  assert.ok(created.ok, JSON.stringify(created));
  if (!created.ok) return;
  assert.equal(created.value.created, true);
  assert.equal(created.value.status, "Idé");
  const conflict = await svc.saveArticleDraft(ed, created.value.id, { titel: "Konflikt" }, { baseVersion: created.value.version - 10 });
  assert.equal(conflict.ok === false && conflict.conflict, true);
  const meta = await svc.updateArticleMeta(ed, created.value.id, { ogTitel: "OG", social: { x: { tekst: "Hej", hashtags: ["by"] } } });
  assert.ok(meta.ok, JSON.stringify(meta));
  const m = await svc.getArticleMeta(ed, created.value.id);
  assert.ok(m.ok && m.value.ogTitel === "OG" && m.value.social.x?.tekst === "Hej");
  const social = await svc.setSocialPost(ed, created.value.id, "facebook", { tekst: "FB", hashtags: ["by"], utm: true });
  assert.ok(social.ok && social.value.check.errors.length === 0);
  assert.equal(await svc.isSlugAvailable(ed, created.value.slug, created.value.id), true);
  assert.equal(await svc.isSlugAvailable(ed, created.value.slug, null), false);
  const sg = await svc.suggestSlug(ed, "Ny kladde fra service", null);
  assert.ok(sg.ok && sg.value.slug === "ny-kladde-fra-service-2");
  assert.equal((await svc.suggestSlug(ed, "!!!", null)).ok, false);
  const score = await svc.getArticleSeoScore(ed, created.value.id);
  assert.ok(score.ok && score.value.items.length > 5);
  assert.equal((await svc.setPlannedTime(ed, created.value.id, new Date(Date.now() + 1000))).ok, true);
});
