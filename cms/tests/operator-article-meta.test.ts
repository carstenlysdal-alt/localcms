import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { MemoryRateLimitStore, setRateLimitStore } from "../lib/ratelimit";
import { cleanupInstance, ctxFor } from "./helpers/operator-fixtures";
import { createInstance, createUser, installNextMocks, uniq } from "./helpers/mock-session";

installNextMocks();
setRateLimitStore(new MemoryRateLimitStore());

type Dispatch = typeof import("../lib/operator/dispatch");
type Registry = typeof import("../lib/operator/registry");
let dispatch: Dispatch;
let reg: Registry;
let inst = "";
let otherInst = "";
let authorId = "";
let editor: Awaited<ReturnType<typeof createUser>>;
let freelancer: Awaited<ReturnType<typeof createUser>>;
let outsider: Awaited<ReturnType<typeof createUser>>;

const TOOLS = ["get_article_meta", "check_article_seo", "update_article_meta", "set_article_social_post", "suggest_article_slug", "set_article_slug", "set_article_planned_time"];

before(async () => {
  dispatch = await import("../lib/operator/dispatch");
  reg = await import("../lib/operator/registry");
  await reg.ensureBuiltinTools();
  inst = (await createInstance("OpMeta")).id;
  otherInst = (await createInstance("OpMetaB")).id;
  authorId = (await db.author.create({ data: { navn: "Frida OP", instansId: inst } })).id;
  editor = await createUser(inst, "Ansvarshavende redaktør");
  freelancer = await createUser(inst, "Freelancejournalist", { authorId });
  outsider = await createUser(otherInst, "Ansvarshavende redaktør");
});
after(async () => {
  await cleanupInstance(inst);
  await cleanupInstance(otherInst);
});

const make = (over: Record<string, unknown> = {}) =>
  db.article.create({ data: { titel: "Operatør", slug: uniq("op"), blocks: [{ id: "b", type: "paragraph", data: { content: "<p>Tekst</p>" } }], aiBrug: [], instansId: inst, forfatterId: authorId, status: "Udkast", ...over } });
type Result = Extract<Awaited<ReturnType<Dispatch["dispatchTool"]>>, { kind: "result" }>;
const run = async (user: typeof editor, name: string, input: unknown): Promise<Result> => {
  const r = await dispatch.dispatchTool(ctxFor(user), name, input);
  assert.equal(r.kind, "result", JSON.stringify(r));
  return r as Result;
};

test("registrering: tools findes med korrekt risikoniveau og publicerings-/planlægnings-handlinger forbliver blokeret", () => {
  const risk = Object.fromEntries(TOOLS.map((n) => [n, reg.getTool(n)?.risk]));
  assert.deepEqual(risk, {
    get_article_meta: "read", check_article_seo: "read", update_article_meta: "safe-write", set_article_social_post: "safe-write",
    suggest_article_slug: "read", set_article_slug: "safe-write", set_article_planned_time: "safe-write",
  });
  for (const n of TOOLS.filter((x) => reg.getTool(x)?.risk === "safe-write")) assert.ok(reg.getTool(n)!.undo, `${n} kan fortrydes`);
  assert.equal(reg.getTool("schedule_article"), null, "status Planlagt/publicering sker aldrig via AI");
  assert.equal(reg.getTool("publish_article"), null);
  const schemas = reg.toAnthropicTools(TOOLS.map((n) => reg.getTool(n)!));
  for (const s of schemas) {
    assert.equal(s.input_schema.additionalProperties, false, s.name);
    assert.ok(!/instansId|userId/i.test(JSON.stringify(s.input_schema.properties)), s.name);
  }
});

test("update_article_meta: SEO + metadata i ét gem; Fortryd sætter værdierne tilbage; kladde-status/brødtekst røres ikke", async () => {
  const art = await make({ seoTitel: "Gammel SEO" });
  const r = await run(editor, "update_article_meta", {
    artikel: art.id, seoTitel: "Ny SEO-titel", seoBeskrivelse: "Ny beskrivelse til søgemaskiner", ogTitel: "OG", noindex: true, keywords: ["byråd"], schemaType: "OpinionNewsArticle",
    kilder: [{ titel: "Notat", url: "https://a.dk/n" }],
  });
  assert.equal(r.ok, true, r.summary);
  assert.ok(r.undoId);
  const row = await db.article.findUniqueOrThrow({ where: { id: art.id }, include: { meta: true } });
  assert.equal(row.seoTitel, "Ny SEO-titel");
  assert.equal(row.status, "Udkast");
  assert.equal(row.meta?.ogTitel, "OG");
  assert.equal(row.meta?.robotsNoindex, true);
  assert.equal(row.meta?.schemaType, "OpinionNewsArticle");
  assert.deepEqual(row.blocks, art.blocks);

  const get = await run(editor, "get_article_meta", { artikel: art.id });
  assert.equal((get.data as { ogTitel: string }).ogTitel, "OG");

  const undo = await dispatch.applyUndo(ctxFor(editor), r.undoId!);
  assert.equal(undo.ok, true, JSON.stringify(undo));
  const back = await db.article.findUniqueOrThrow({ where: { id: art.id }, include: { meta: true } });
  assert.equal(back.seoTitel, "Gammel SEO");
  assert.equal(back.meta?.ogTitel, null);
  assert.equal(back.meta?.robotsNoindex, false);
  assert.equal(back.meta?.schemaType, null);
});

test("update_article_meta: ugyldigt input afvises, publicerede artikler afvises, ukendt/anden instans afvises, forfatter kun egne", async () => {
  const art = await make();
  const bad = await dispatch.dispatchTool(ctxFor(editor), "update_article_meta", { artikel: art.id, canonicalUrl: "javascript:alert(1)" });
  assert.equal(bad.kind, "result");
  assert.equal((bad as Result).ok, false);
  const extra = await dispatch.dispatchTool(ctxFor(editor), "update_article_meta", { artikel: art.id, instansId: "x", ogTitel: "A" });
  assert.equal(extra.kind, "rejected");
  const empty = await run(editor, "update_article_meta", { artikel: art.id });
  assert.equal(empty.ok, false);

  const live = await make({ status: "Publiceret", publiceretTid: new Date() });
  const liveRes = await run(editor, "update_article_meta", { artikel: live.id, ogTitel: "Ændring" });
  assert.equal(liveRes.ok, false);
  assert.match(liveRes.summary, /Opdater artikel/);
  assert.equal(await db.articleMeta.count({ where: { articleId: live.id } }), 0);

  const foreign = await dispatch.dispatchTool(ctxFor(outsider), "update_article_meta", { artikel: art.id, ogTitel: "Fremmed" });
  assert.equal((foreign as Result).ok, false, "anden instans finder ikke artiklen");
  const notOwn = await make({ forfatterId: null });
  const fl = await run(freelancer, "update_article_meta", { artikel: notOwn.id, ogTitel: "x" });
  assert.equal(fl.ok, false);
});

test("set_article_social_post: platformens tegngrænse, hashtags og UTM håndhæves; Fortryd fjerner opslaget igen", async () => {
  const art = await make({ slug: "social-slug" });
  const tooLong = await run(editor, "set_article_social_post", { artikel: art.id, platform: "x", tekst: "x".repeat(270) });
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.summary, /X: opslaget er/);
  assert.equal(await db.articleMeta.count({ where: { articleId: art.id } }), 0);

  const ok = await run(editor, "set_article_social_post", { artikel: art.id, platform: "bluesky", tekst: "Byrådet siger ja til skolerne.", hashtags: ["Næstved", "skole"], utm: true });
  assert.equal(ok.ok, true, ok.summary);
  const social = (await db.articleMeta.findUniqueOrThrow({ where: { articleId: art.id } })).social as { bluesky: { tekst: string; hashtags: string[]; utm: { campaign: string; source: string } } };
  assert.equal(social.bluesky.tekst, "Byrådet siger ja til skolerne.");
  assert.deepEqual(social.bluesky.hashtags, ["Næstved", "skole"]);
  assert.deepEqual(social.bluesky.utm, { source: "bluesky", medium: "social", campaign: "social-slug" });
  const ig = await run(editor, "set_article_social_post", { artikel: art.id, platform: "instagram", tekst: "Kort." });
  assert.equal(ig.ok, true);
  const both = (await db.articleMeta.findUniqueOrThrow({ where: { articleId: art.id } })).social as Record<string, unknown>;
  assert.deepEqual(Object.keys(both).sort(), ["bluesky", "instagram"], "andre platforme bevares ved flet");
  assert.equal((await dispatch.applyUndo(ctxFor(editor), ig.undoId!)).ok, true);
  const after = (await db.articleMeta.findUniqueOrThrow({ where: { articleId: art.id } })).social as Record<string, unknown>;
  assert.deepEqual(Object.keys(after), ["bluesky"]);
});

test("suggest_article_slug / set_article_slug: unik, kun kladder, Fortryd; publiceret afvises (omdirigering oprettes kun i editoren)", async () => {
  const taken = await make({ slug: "byraadet-giver-penge" });
  void taken;
  const art = await make();
  const s = await run(editor, "suggest_article_slug", { titel: "Byrådet giver penge", artikel: art.id });
  assert.equal((s.data as { slug: string }).slug, "byraadet-giver-penge-2");
  const set = await run(editor, "set_article_slug", { artikel: art.id, slug: "byraadet-giver-penge-2" });
  assert.equal(set.ok, true, set.summary);
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: art.id } })).slug, "byraadet-giver-penge-2");
  const clash = await run(editor, "set_article_slug", { artikel: art.id, slug: "byraadet-giver-penge" });
  assert.equal(clash.ok, false);
  assert.match(clash.summary, /bruges allerede/);
  const invalid = await dispatch.dispatchTool(ctxFor(editor), "set_article_slug", { artikel: art.id, slug: "Ugyldig Slug" });
  assert.equal(invalid.kind, "rejected");
  assert.equal((await dispatch.applyUndo(ctxFor(editor), set.undoId!)).ok, true);
  assert.notEqual((await db.article.findUniqueOrThrow({ where: { id: art.id } })).slug, "byraadet-giver-penge-2");

  const live = await make({ status: "Publiceret", publiceretTid: new Date() });
  const liveSet = await run(editor, "set_article_slug", { artikel: live.id, slug: "ny-slug-paa-live" });
  assert.equal(liveSet.ok, false);
  assert.equal(await db.slugRedirect.count({ where: { instansId: inst } }), 0);
});

test("set_article_planned_time: foreslået tidspunkt uden statusskift; fortid/ugyldigt afvises; Fortryd; check_article_seo er read-only", async () => {
  const art = await make();
  const when = new Date(Date.now() + 86_400_000).toISOString();
  const r = await run(editor, "set_article_planned_time", { artikel: art.id, tidspunkt: when });
  assert.equal(r.ok, true, r.summary);
  let row = await db.article.findUniqueOrThrow({ where: { id: art.id } });
  assert.equal(row.planlagtTid?.toISOString(), when);
  assert.equal(row.status, "Udkast", "status Planlagt sættes aldrig via AI");
  assert.equal((await run(editor, "set_article_planned_time", { artikel: art.id, tidspunkt: "2020-01-01T00:00:00Z" })).ok, false);
  assert.equal((await run(editor, "set_article_planned_time", { artikel: art.id, tidspunkt: "ikke en dato" })).ok, false);
  assert.equal((await dispatch.applyUndo(ctxFor(editor), r.undoId!)).ok, true);
  row = await db.article.findUniqueOrThrow({ where: { id: art.id } });
  assert.equal(row.planlagtTid, null);

  const score = await run(editor, "check_article_seo", { artikel: art.id });
  assert.equal(score.ok, true);
  assert.equal(typeof (score.data as { score: number }).score, "number");
  assert.ok(Array.isArray((score.data as { mangler: string[] }).mangler));
});
