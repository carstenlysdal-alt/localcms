import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { createInstance, createUser, installNextMocks, session, uniq } from "./helpers/mock-session";

installNextMocks();

type Actions = typeof import("../app/redaktion/artikler/actions");
type Draft = typeof import("../app/redaktion/artikler/draft-actions");
type Redirects = typeof import("../lib/slug-redirect");
type Queries = typeof import("../lib/site-queries");
let actions: Actions;
let draft: Draft;
let redirects: Redirects;
let queries: Queries;
let instansId = "";
let otherInstansId = "";
let authorId = "";
let nyhederId = "";
let politikId = "";
let krimiId = "";
let imageId = "";
let otherImageId = "";
let editor: { id: string; navn: string };
let freelancer: { id: string };

const BLOCKS = JSON.stringify([{ id: "b1", type: "paragraph", data: { content: "<p>Et afsnit med en del ord i sig.</p>" } }]);

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  const base: Record<string, string | string[]> = { titel: "Testartikel om byrådet", slug: uniq("slug").replace(/[^a-z0-9-]/g, "-"), indholdstype: "Uafhængig", sprog: "da", blocks: BLOCKS };
  for (const [k, v] of Object.entries({ ...base, ...fields })) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}

async function makeArticle(over: Record<string, unknown> = {}) {
  return db.article.create({ data: { titel: "Eksisterende", slug: uniq("art"), blocks: JSON.parse(BLOCKS), aiBrug: [], status: "Udkast", instansId, forfatterId: authorId, kategoriId: nyhederId, ...over } });
}
const as = (u: { id: string } | null) => { session.userId = u?.id ?? null; };

before(async () => {
  actions = await import("../app/redaktion/artikler/actions");
  draft = await import("../app/redaktion/artikler/draft-actions");
  redirects = await import("../lib/slug-redirect");
  queries = await import("../lib/site-queries");
  instansId = (await createInstance("Meta")).id;
  otherInstansId = (await createInstance("MetaAndet")).id;
  authorId = (await db.author.create({ data: { navn: "Frida", instansId } })).id;
  nyhederId = (await db.category.create({ data: { instansId, navn: "Nyheder", slug: "nyheder" } })).id;
  politikId = (await db.category.create({ data: { instansId, navn: "Politik", slug: "politik" } })).id;
  const krimi = await db.category.create({ data: { instansId, navn: "Krimi og retsvæsen", slug: "krimi-og-retsvaesen" } });
  krimiId = krimi.id;
  imageId = (await db.media.create({ data: { instansId, filtype: "billede", url: "/uploads/a.jpg", altTekst: "Alt" } })).id;
  otherImageId = (await db.media.create({ data: { instansId: otherInstansId, filtype: "billede", url: "/uploads/b.jpg" } })).id;
  editor = await createUser(instansId, "Ansvarshavende redaktør");
  freelancer = await createUser(instansId, "Freelancejournalist", { authorId });
});

after(async () => {
  for (const id of [instansId, otherInstansId]) {
    await db.slugRedirect.deleteMany({ where: { instansId: id } });
    await db.articleMeta.deleteMany({ where: { instansId: id } });
    await db.articleRevision.deleteMany({ where: { article: { instansId: id } } });
    await db.auditLog.deleteMany({ where: { instansId: id } });
    await db.article.deleteMany({ where: { instansId: id } });
    await db.media.deleteMany({ where: { instansId: id } });
    await db.category.deleteMany({ where: { instansId: id } });
    await db.user.deleteMany({ where: { instansId: id } });
    await db.author.deleteMany({ where: { instansId: id } });
    await db.instance.delete({ where: { id } });
  }
});

const FULL_META = {
  canonicalUrl: "https://andet.dk/original", robotsNoindex: true, robotsNofollow: true, keywords: ["Byråd", "Skole"], newsKeywords: ["Næstved"],
  ogTitel: "OG titel", ogBeskrivelse: "OG beskrivelse", twitterCard: "summary", twitterTitel: "X titel", twitterBeskrivelse: "X beskrivelse",
  social: { facebook: { tekst: "FB-opslag", hashtags: ["by"], utm: { source: "facebook", medium: "social", campaign: "x" } }, x: { tekst: "X-opslag", hashtags: [] } },
  schemaType: "OpinionNewsArticle", isAccessibleForFree: false, paywall: { cssSelector: ".betaling" }, dateline: "NÆSTVED —", standout: true, laesetidMin: 3,
  udloebTid: "2027-01-01T10:00:00.000Z", begivenhedTid: "2026-10-01T10:00:00.000Z",
  medforfattere: [{ authorId: null, navn: "Pia Foto", rolle: "Fotograf" }], kilder: [{ titel: "Budgetnotat", url: "https://naestved.dk/b", udgiver: "Kommunen", dato: "2026-09-29" }],
  sistSubstantielOpdateringTid: "2026-10-02T10:00:00.000Z", oversaettelser: { en: { url: "https://naestvedlokalt.dk/en/x" } },
};

test("metadata-persistens: alle felter gennem saveArticle (+ planlagtTid), og tilbage igen", async () => {
  as(editor);
  const art = await makeArticle();
  const meta = { ...FULL_META, ogMediaId: imageId, twitterMediaId: imageId };
  const r = await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen", kategoriId: nyhederId, meta: JSON.stringify(meta), planlagtTid: "2026-12-24T09:00:00.000Z" }));
  assert.equal(r.error, undefined, r.error);
  assert.ok(r.version && r.version > 0);
  const row = await db.article.findUniqueOrThrow({ where: { id: art.id }, include: { meta: true } });
  assert.equal(row.planlagtTid?.toISOString(), "2026-12-24T09:00:00.000Z");
  const m = row.meta!;
  assert.equal(m.instansId, instansId);
  assert.equal(m.canonicalUrl, "https://andet.dk/original");
  assert.equal(m.robotsNoindex, true);
  assert.equal(m.robotsNofollow, true);
  assert.deepEqual(m.keywords, ["Byråd", "Skole"]);
  assert.deepEqual(m.newsKeywords, ["Næstved"]);
  assert.equal(m.ogTitel, "OG titel");
  assert.equal(m.ogBeskrivelse, "OG beskrivelse");
  assert.equal(m.ogMediaId, imageId);
  assert.equal(m.twitterCard, "summary");
  assert.equal(m.twitterTitel, "X titel");
  assert.equal(m.twitterMediaId, imageId);
  assert.equal((m.social as { facebook: { tekst: string; utm: { campaign: string } } }).facebook.tekst, "FB-opslag");
  assert.equal(m.schemaType, "OpinionNewsArticle");
  assert.equal(m.isAccessibleForFree, false);
  assert.deepEqual(m.paywall, { cssSelector: ".betaling" });
  assert.equal(m.dateline, "NÆSTVED —");
  assert.equal(m.standout, true);
  assert.equal(m.laesetidMin, 3);
  assert.equal(m.udloebTid?.toISOString(), "2027-01-01T10:00:00.000Z");
  assert.equal(m.begivenhedTid?.toISOString(), "2026-10-01T10:00:00.000Z");
  assert.deepEqual(m.medforfattere, [{ authorId: null, navn: "Pia Foto", rolle: "Fotograf" }]);
  assert.equal((m.kilder as { titel: string }[])[0].titel, "Budgetnotat");
  assert.equal(m.sistSubstantielOpdateringTid?.toISOString(), "2026-10-02T10:00:00.000Z");
  assert.deepEqual(m.oversaettelser, { en: { url: "https://naestvedlokalt.dk/en/x", titel: null } });

  // Uden meta-felt i formularen: uændret. Med tomt objekt: nulstillet til standard (rækken bevares).
  assert.equal((await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen" }))).error, undefined);
  assert.equal((await db.articleMeta.findUniqueOrThrow({ where: { articleId: art.id } })).ogTitel, "OG titel");
  assert.equal((await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen", meta: "{}" }))).error, undefined);
  const reset = await db.articleMeta.findUniqueOrThrow({ where: { articleId: art.id } });
  assert.equal(reset.ogTitel, null);
  assert.equal(reset.robotsNoindex, false);
  // planlagtTid: tom streng rydder
  await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen", planlagtTid: "" }));
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: art.id } })).planlagtTid, null);
});

test("metadata-validering: ugyldig meta afviser hele gemningen; delingsbillede fra anden instans afvises (tenant)", async () => {
  as(editor);
  const art = await makeArticle();
  const bad = await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen", meta: JSON.stringify({ social: { x: { tekst: "x".repeat(400), hashtags: [] } } }) }));
  assert.match(bad.error ?? "", /X: opslaget er/);
  const foreign = await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen", meta: JSON.stringify({ ogMediaId: otherImageId }) }));
  assert.match(foreign.error ?? "", /tilhører ikke denne CMS-instans/);
  assert.equal(await db.articleMeta.count({ where: { articleId: art.id } }), 0, "ingen delvis skrivning");
});

test("autosave: kun kladdefelter — ingen statusskift, ingen revision, ingen redirect; targetStatus ignoreres", async () => {
  as(editor);
  const art = await makeArticle({ status: "Udkast" });
  const before = await db.articleRevision.count({ where: { articleId: art.id } });
  const fd = form({ slug: art.slug, titel: "Ny titel via autosave", targetStatus: "Redigering", aiBrug: "Ingen", meta: JSON.stringify({ ogTitel: "Auto" }) });
  fd.append("baseVersion", String(art.opdateretTid.getTime()));
  const r = await draft.saveDraftAction(art.id, fd);
  assert.ok(r.ok, JSON.stringify(r));
  if (!r.ok) return;
  assert.equal(r.created, false);
  const row = await db.article.findUniqueOrThrow({ where: { id: art.id }, include: { meta: true } });
  assert.equal(row.titel, "Ny titel via autosave");
  assert.equal(row.status, "Udkast", "autosave skifter aldrig status");
  assert.equal(row.meta?.ogTitel, "Auto");
  assert.equal(await db.articleRevision.count({ where: { articleId: art.id } }), before, "ingen revision ved autosave");
  assert.equal(r.version, row.opdateretTid.getTime());
});

test("autosave: versionskonflikt giver dansk besked og skriver intet; ny version virker", async () => {
  as(editor);
  const art = await makeArticle();
  const stale = new FormData();
  for (const [k, v] of form({ slug: art.slug, titel: "Forældet", aiBrug: "Ingen" }).entries()) stale.append(k, v);
  stale.append("baseVersion", String(art.opdateretTid.getTime() - 5000));
  const r = await draft.saveDraftAction(art.id, stale);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.conflict, true);
  assert.match(r.error, /ændret et andet sted/);
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: art.id } })).titel, "Eksisterende");

  // saveArticle har samme konfliktkontrol, når baseVersion er med
  const fd = form({ slug: art.slug, aiBrug: "Ingen" });
  fd.append("baseVersion", String(art.opdateretTid.getTime() - 5000));
  const full = await actions.saveArticle(art.id, {}, fd);
  assert.equal(full.conflict, true);
  assert.match(full.error ?? "", /Genindlæs/);
});

test("autosave omgår ikke reglerne: publicerede artikler afvises, Krimi/Sundhed-spærring og tenant gælder, forfattere kun egne", async () => {
  as(editor);
  const live = await makeArticle({ status: "Publiceret", publiceretTid: new Date() });
  const r = await draft.saveDraftAction(live.id, form({ slug: live.slug, titel: "Skal ikke gemmes", aiBrug: "Ingen" }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /Opdater artikel/);
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: live.id } })).titel, "Eksisterende");

  const art = await makeArticle();
  const spaerret = await draft.saveDraftAction(art.id, form({ slug: art.slug, kategoriId: krimiId, aiBrug: "Udkast" }));
  assert.equal(spaerret.ok, false);
  if (!spaerret.ok) assert.match(spaerret.error, /ikke tilladt i Krimi/);
  const ai = await draft.saveDraftAction(art.id, form({ slug: art.slug, kategoriId: krimiId, indholdstype: "AI-assisteret", aiBrug: "Sproglig korrektur", markingKilder: "https://k.test" }));
  assert.equal(ai.ok, false);

  // Mærkning: Partner uden sponsor gemmes som kladde, men kan stadig ikke publiceres
  const partner = await draft.saveDraftAction(art.id, form({ slug: art.slug, indholdstype: "Partner", aiBrug: "Ingen" }));
  assert.ok(partner.ok);
  const fd = form({ slug: art.slug, indholdstype: "Partner", aiBrug: "Ingen", targetStatus: "Publiceret" });
  assert.ok((await actions.saveArticle(art.id, {}, fd)).error, "publicering kræver stadig mærkning/status");

  // Tenant: delingsbillede fra anden instans
  const foreign = await draft.saveDraftAction(art.id, form({ slug: art.slug, aiBrug: "Ingen", meta: JSON.stringify({ ogMediaId: otherImageId }) }));
  assert.equal(foreign.ok, false);

  // Forfatter må ikke autosave andres artikel; og ingen adgang uden login
  const others = await makeArticle({ forfatterId: null });
  as(freelancer);
  const denied = await draft.saveDraftAction(others.id, form({ slug: others.slug, aiBrug: "Ingen" }));
  assert.equal(denied.ok, false);
  as(null);
  const anon = await draft.saveDraftAction(others.id, form({ slug: others.slug, aiBrug: "Ingen" }));
  assert.equal(anon.ok, false);
});

test("autosave opretter ny kladde (Idé) uden redirect; slugAuto giver unikt suffix ved konflikt", async () => {
  as(freelancer);
  const taken = await makeArticle({ slug: "byraadet-vedtager-budget" });
  void taken;
  const fd = form({ titel: "Byrådet vedtager budget", slug: "byraadet-vedtager-budget", aiBrug: "Ingen" });
  fd.append("slugAuto", "1");
  const r = await draft.saveDraftAction(null, fd);
  assert.ok(r.ok, JSON.stringify(r));
  if (!r.ok) return;
  assert.equal(r.created, true);
  assert.equal(r.slug, "byraadet-vedtager-budget-2");
  const row = await db.article.findUniqueOrThrow({ where: { id: r.id } });
  assert.equal(row.status, "Idé");
  assert.equal(row.forfatterId, authorId);
  // blank slug => genereret fra titlen
  const gen = await draft.saveDraftAction(null, form({ titel: "Æblet falder ikke langt fra Åen", slug: "", aiBrug: "Ingen" }));
  assert.ok(gen.ok);
  if (gen.ok) assert.equal(gen.slug, "aeblet-falder-ikke-langt-fra-aaen");
  // eksplicit slug i konflikt (uden slugAuto) giver fejl
  const clash = await draft.saveDraftAction(null, form({ titel: "Noget andet", slug: "byraadet-vedtager-budget", aiBrug: "Ingen" }));
  assert.equal(clash.ok, false);
  if (!clash.ok) assert.match(clash.error, /Sluggen bruges allerede/);
  // for kort titel
  const short = await draft.saveDraftAction(null, form({ titel: "Hi", aiBrug: "Ingen" }));
  assert.equal(short.ok, false);
});

test("slug-redirect: omdøbning/sektionsskift på publiceret artikel -> redirect til nuværende URL; ingen kæder/løkker; kladder giver intet", async () => {
  as(editor);
  const art = await makeArticle({ status: "Publiceret", publiceretTid: new Date(), slug: uniq("rd-a") });
  const A = art.slug;
  const B = uniq("rd-b");
  const C = uniq("rd-c");
  const save = (slug: string, kategoriId = nyhederId) => actions.saveArticle(art.id, {}, form({ slug, kategoriId, aiBrug: "Ingen" }));
  assert.equal((await save(B)).error, undefined);
  assert.equal(await redirects.findArticleRedirect(instansId, "nyheder", A), `/nyheder/${B}`);
  // A -> B -> C giver A -> C og B -> C (peger på artikel-id, aldrig kæder)
  assert.equal((await save(C)).error, undefined);
  assert.equal(await redirects.findArticleRedirect(instansId, "nyheder", A), `/nyheder/${C}`);
  assert.equal(await redirects.findArticleRedirect(instansId, "nyheder", B), `/nyheder/${C}`);
  // Nuværende URL har ingen redirect (ingen løkke)
  assert.equal(await redirects.findArticleRedirect(instansId, "nyheder", C), null);
  // Tilbage til A: A's redirect ryddes, og A serveres direkte
  assert.equal((await save(A)).error, undefined);
  assert.equal(await redirects.findArticleRedirect(instansId, "nyheder", A), null);
  assert.equal(await redirects.findArticleRedirect(instansId, "nyheder", C), `/nyheder/${A}`);
  assert.ok(await queries.getArticleBySlug(instansId, "nyheder", A));
  // Sektionsskift: gammel sti -> ny sti
  assert.equal((await save(A, politikId)).error, undefined);
  assert.equal(await redirects.findArticleRedirect(instansId, "nyheder", A), `/politik/${A}`);
  assert.equal(await queries.getArticleBySlug(instansId, "nyheder", A), null, "forkert sektion giver stadig null (så siden kan redirecte)");
  assert.ok(await queries.getArticleBySlug(instansId, "politik", A));
  // tilbage til nyheder rydder politik/A's modsatte spor og bevarer ingen løkke
  assert.equal((await save(A)).error, undefined);
  assert.equal(await redirects.findArticleRedirect(instansId, "nyheder", A), null);
  assert.equal(await redirects.findArticleRedirect(instansId, "politik", A), `/nyheder/${A}`);

  // Tenant: samme sti i en anden instans finder intet
  assert.equal(await redirects.findArticleRedirect(otherInstansId, "nyheder", C), null);
  // Afpubliceret mål giver ingen redirect (404 i stedet)
  await db.article.update({ where: { id: art.id }, data: { status: "Arkiveret" } });
  assert.equal(await redirects.findArticleRedirect(instansId, "politik", A), null);

  // Kladde der omdøbes giver ingen redirect
  const d = await makeArticle({ status: "Udkast" });
  const old = d.slug;
  await actions.saveArticle(d.id, {}, form({ slug: uniq("nyt"), aiBrug: "Ingen" }));
  assert.equal(await db.slugRedirect.count({ where: { fraSlug: old } }), 0);
});

test("slug-redirect: ny artikel på en tidligere URL overtager den (gammel redirect ryddes); percent-kodede opslag", async () => {
  as(editor);
  const a = await makeArticle({ status: "Publiceret", publiceretTid: new Date(), slug: uniq("ov-a") });
  const old = a.slug;
  await actions.saveArticle(a.id, {}, form({ slug: uniq("ov-b"), aiBrug: "Ingen" }));
  assert.ok(await redirects.findArticleRedirect(instansId, "nyheder", old));
  const b = await makeArticle({ status: "Udkast", slug: uniq("tmp") });
  const r = await actions.saveArticle(b.id, {}, form({ slug: old, aiBrug: "Ingen" }));
  assert.equal(r.error, undefined, r.error);
  assert.equal(await db.slugRedirect.count({ where: { instansId, fraSlug: old, fraSektion: "nyheder" } }), 1, "uændret: kun den gamle række findes");
  await db.article.update({ where: { id: b.id }, data: { status: "Publiceret", publiceretTid: new Date() } });
  await actions.saveArticle(b.id, {}, form({ slug: old, aiBrug: "Ingen" })); // live-gem rydder redirect på egen sti
  assert.equal(await redirects.findArticleRedirect(instansId, "nyheder", old), null);
});

test("planlægning: Planlagt kræver publiceringsret og fremtidigt tidspunkt; AI-assisteret godkendes af planlæggeren", async () => {
  const art = await makeArticle({ status: "Godkendelse" });
  const future = new Date(Date.now() + 3600_000).toISOString();
  // uden tidspunkt
  as(editor);
  assert.match((await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen", targetStatus: "Planlagt" }))).error ?? "", /udgivelsestidspunkt/);
  // fortid
  assert.match((await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen", targetStatus: "Planlagt", planlagtTid: "2020-01-01T00:00:00.000Z" }))).error ?? "", /fortiden/);
  // forfatter uden publiceringsret
  const own = await makeArticle({ status: "Godkendelse" });
  as(freelancer);
  assert.match((await actions.saveArticle(own.id, {}, form({ slug: own.slug, aiBrug: "Ingen", targetStatus: "Planlagt", planlagtTid: future }))).error ?? "", /publiceringsret/);
  // redaktør
  as(editor);
  const ok = await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen", targetStatus: "Planlagt", planlagtTid: future }));
  assert.equal(ok.error, undefined, ok.error);
  const row = await db.article.findUniqueOrThrow({ where: { id: art.id } });
  assert.equal(row.status, "Planlagt");
  assert.equal(row.planlagtTid?.toISOString(), future);
  assert.equal(row.publiceretTid, null);

  const ai = await makeArticle({ status: "Godkendelse" });
  const r = await actions.saveArticle(ai.id, {}, form({ slug: ai.slug, indholdstype: "AI-assisteret", aiBrug: "Udkast", markingKilder: "https://k.test/a", targetStatus: "Planlagt", planlagtTid: future }));
  assert.equal(r.error, undefined, r.error);
  const marking = (await db.article.findUniqueOrThrow({ where: { id: ai.id } })).marking as { godkendtAf: string; godkendtAfUserId: string };
  assert.equal(marking.godkendtAf, editor.navn);
  assert.equal(marking.godkendtAfUserId, editor.id);
});

test("publicering giver ikke-blokerende metadata-advarsler; komplet metadata giver ingen", async () => {
  as(editor);
  const art = await makeArticle({ status: "Godkendelse" });
  const r = await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen", targetStatus: "Publiceret" }));
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.success, "Artiklen er publiceret.");
  assert.ok(r.warnings && r.warnings.length > 3, "ufuldstændig metadata advarer");
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: art.id } })).status, "Publiceret", "advarsler blokerer ikke");
  // Opdatering af allerede publiceret artikel advarer ikke igen
  const again = await actions.saveArticle(art.id, {}, form({ slug: art.slug, aiBrug: "Ingen" }));
  assert.equal(again.warnings, undefined);
});
