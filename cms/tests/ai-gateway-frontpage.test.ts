import assert from "node:assert/strict";
import test, { after, afterEach, before, beforeEach } from "node:test";
import { db } from "../lib/db";
import { PERMISSIONS } from "../lib/permissions";
import { MemoryRateLimitStore, setRateLimitStore } from "../lib/ratelimit";
import { getBreaker } from "../lib/resilience";
import { createProposal, interpretEditorCommand, type FrontpageUser } from "../lib/frontpage/service";
import { defaultLayoutModules } from "../lib/frontpage/templates";
import { GET as cronGet } from "../app/api/cron/frontpage-rank/route";
import { failure, fakeFetch, jsonCompletion, type FakeFetch } from "./helpers/fake-ai-fetch";

const run = Date.now().toString(36);
let A = "";
let firstId = "";
const realFetch = globalThis.fetch;
const KEYS = ["DEEPSEEK_API_KEY", "ANTHROPIC_API_KEY", "AI_PROVIDER", "FRONTPAGE_AI_PROVIDER", "CRON_SECRET"] as const;
const saved: Record<string, string | undefined> = {};
const P = PERMISSIONS;
const FULL = [P.FRONTPAGE_EDIT, P.FRONTPAGE_LAYOUT_MANAGE, P.FRONTPAGE_SNAPSHOT_APPROVE, P.FRONTPAGE_AI_USE];
const user = (): FrontpageUser => ({ id: `user-${A}`, name: "Test Redaktør", instansId: A, permissions: FULL });
const EMAIL = "tipser@example.dk";

before(async () => {
  for (const k of KEYS) saved[k] = process.env[k];
  setRateLimitStore(new MemoryRateLimitStore());
  A = (await db.instance.create({ data: { navn: `GwFp${run}`, domaene: `gwfp-${run}.test`, geografiskDækning: [], kategoriTaksonomi: [], markingTekster: {}, kvoteloftProcent: 25 } })).id;
  for (let i = 0; i < 6; i++) {
    const a = await db.article.create({
      data: {
        instansId: A,
        titel: i === 0 ? `Kontakt ${EMAIL} om cykelstien` : `Gateway-test ${i} ${run}`,
        slug: `gw-${run}-${i}`,
        blocks: [],
        aiBrug: [],
        status: "Publiceret",
        publiceretTid: new Date(Date.now() - (i + 1) * 3_600_000),
        metric: { create: { instansId: A, visninger: 900 - i * 60, laesninger: 300 - i * 20, totalLaesetidSek: 5000 } },
      },
    });
    if (i === 0) firstId = a.id;
  }
});
after(async () => {
  await db.frontpageDecision.deleteMany({ where: { instansId: A } });
  await db.frontpageSnapshot.deleteMany({ where: { instansId: A } });
  await db.frontpageLayoutVersion.deleteMany({ where: { instansId: A } });
  await db.frontpageLayout.deleteMany({ where: { instansId: A } });
  await db.article.deleteMany({ where: { instansId: A } });
  await db.instance.delete({ where: { id: A } });
});
beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  process.env.DEEPSEEK_API_KEY = "test-noegle-deepseek";
  getBreaker("ai:deepseek").reset();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
const install = (f: FakeFetch) => {
  globalThis.fetch = f;
  return f;
};
const ranking = () => jsonCompletion({ forslag: [{ articleId: firstId, prioritet: 5, forslagModul: "hero", begrundelse: "Vigtig lokal sag.", konfidens: 0.9 }] });

test("forside-forslag på DeepSeek: generatedBy 'ai', modelId fra udbyderen, kun maskerede titler sendt", async () => {
  const f = install(fakeFetch([ranking()]));
  const res = await createProposal(A, { actor: { kind: "user", user: user() }, useAi: true, force: true, aiRetries: 0 });
  assert.ok(res.ok, JSON.stringify(res));
  if (!res.ok) return;
  assert.equal(res.generatedBy, "ai");
  assert.equal(res.modelId, "deepseek-chat");
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].body.response_format, { type: "json_object" });
  assert.equal(f.calls[0].raw.includes(EMAIL), false, "e-mail i en titel forlader ikke processen");
});

test("forside-forslag: DeepSeek-udfald giver deterministisk forslag med dansk besked (forsiden virker uden AI)", async () => {
  install(fakeFetch([failure(402)]));
  const res = await createProposal(A, { actor: { kind: "user", user: user() }, useAi: true, force: true, aiRetries: 0 });
  assert.ok(res.ok);
  if (res.ok) {
    assert.equal(res.generatedBy, "deterministic");
    assert.equal(res.aiFailure?.reason, "api-fejl");
  }
});

test("NL-kommando: generisk fejltekst uden nøgle; med DeepSeek logges udbyderen (uden indhold ud over kommandoen som i dag)", async () => {
  delete process.env.DEEPSEEK_API_KEY;
  const none = await interpretEditorCommand(user(), "gør griddet større", defaultLayoutModules());
  assert.ok(!none.ok);
  const failed = none as unknown as { code: string; error: string };
  assert.equal(failed.code, "ai-unavailable");
  assert.equal(failed.error, "AI er ikke konfigureret (DEEPSEEK_API_KEY eller ANTHROPIC_API_KEY mangler).");
  process.env.DEEPSEEK_API_KEY = "test-noegle-deepseek";
  const f = install(fakeFetch([jsonCompletion({ operationer: [{ op: "set_slots", moduleId: "top-grid", slots: 4 }], forklaring: "Fire i griddet." })]));
  const res = await interpretEditorCommand(user(), `gør griddet større, skriv til ${EMAIL}`, defaultLayoutModules(), { retries: 0 });
  assert.ok(res.ok, JSON.stringify(res));
  assert.equal(f.calls[0].raw.includes(EMAIL), false);
  const log = await db.frontpageDecision.findFirst({ where: { instansId: A, handling: "nl-kommando" }, orderBy: { createdAt: "desc" } });
  assert.match(log?.begrundelse ?? "", /\[udbyder: deepseek\]/);
});

test("cron: AI bruges når kun DEEPSEEK_API_KEY er sat; FRONTPAGE_AI_PROVIDER=anthropic uden nøgle giver deterministisk", async () => {
  process.env.CRON_SECRET = "test-cron-secret-0123456789abcdef";
  const req = (ip: string) => new Request(`http://test.local/api/cron/frontpage-rank?instans=${A}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, "x-forwarded-for": ip } });
  install(fakeFetch([ranking()]));
  const withAi = await (await cronGet(req("203.0.113.71"))).json();
  assert.equal(withAi.results[0].generatedBy, "ai");
  process.env.FRONTPAGE_AI_PROVIDER = "anthropic";
  const f = install(fakeFetch([ranking()]));
  const without = await (await cronGet(req("203.0.113.72"))).json();
  assert.equal(without.results[0].generatedBy, "deterministic");
  assert.equal(f.calls.length, 0);
});
