import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { MemoryRateLimitStore, rateLimit, setRateLimitStore } from "../lib/ratelimit";
import { RATE_LIMIT } from "../lib/operator/policy";
import { createNdjsonParser, type OperatorEvent } from "../lib/operator/events";
import { cleanupInstance } from "./helpers/operator-fixtures";
import { say, scripted, toolUse } from "./helpers/fake-operator-model";
import { createInstance, createUser, installNextMocks, session } from "./helpers/mock-session";

installNextMocks();
setRateLimitStore(new MemoryRateLimitStore());

let inst = "";
let editor: Awaited<ReturnType<typeof createUser>>;
let editor2: Awaited<ReturnType<typeof createUser>>;
let freelancer: Awaited<ReturnType<typeof createUser>>;
let runtime: typeof import("../lib/operator/runtime");
let op: typeof import("../app/api/operator/route");
let confirmRoute: typeof import("../app/api/operator/confirm/route");
let undoRoute: typeof import("../app/api/operator/undo/route");

const HOST = "slagelselokalt.dk";
const SESSION = "op_routesession01";
const req = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://${HOST}${path}`, { method: "POST", headers: { host: HOST, origin: `https://${HOST}`, "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const as = (u: { id: string } | null) => { session.userId = u?.id ?? null; };

async function events(res: Response): Promise<OperatorEvent[]> {
  const parser = createNdjsonParser();
  const text = await res.text();
  return [...parser.push(text), ...parser.flush()];
}

before(async () => {
  runtime = await import("../lib/operator/runtime");
  op = await import("../app/api/operator/route");
  confirmRoute = await import("../app/api/operator/confirm/route");
  undoRoute = await import("../app/api/operator/undo/route");
  inst = (await createInstance("OpR")).id;
  editor = await createUser(inst, "Ansvarshavende redaktør");
  editor2 = await createUser(inst, "Ansvarshavende redaktør");
  freelancer = await createUser(inst, "Freelancejournalist");
});

after(async () => {
  runtime.setOperatorRuntimeForTests(null);
  delete process.env.ANTHROPIC_API_KEY;
  await cleanupInstance(inst);
});

test("/api/operator: afviser fremmed origin (403), ikke-JSON (415), anonym (401) og bruger uden operator.use (401)", async () => {
  runtime.setOperatorRuntimeForTests({ client: scripted([say("hej")]), deps: {} });
  as(editor);
  assert.equal((await op.POST(req("/api/operator", { sessionId: SESSION, message: "x" }, { origin: "https://evil.test", "sec-fetch-site": "cross-site" }))).status, 403);
  assert.equal((await op.POST(req("/api/operator", { sessionId: SESSION, message: "x" }, { origin: "https://evil.test", "x-forwarded-host": "evil.test" }))).status, 403);
  assert.equal((await op.POST(req("/api/operator", "{}", { "content-type": "text/plain" }))).status, 415);
  as(null);
  assert.equal((await op.POST(req("/api/operator", { sessionId: SESSION, message: "x" }))).status, 401);
  as(freelancer);
  assert.equal((await op.POST(req("/api/operator", { sessionId: SESSION, message: "x" }))).status, 401, "Freelancejournalist har ikke operator.use");
});

test("/api/operator: 503 uden nøgle, 400 ved dårlig body, 413 ved for stor body", async () => {
  as(editor);
  runtime.setOperatorRuntimeForTests({ client: null });
  const noKey = await op.POST(req("/api/operator", { sessionId: SESSION, message: "x" }));
  assert.equal(noKey.status, 503);
  assert.match(((await noKey.json()) as { error: string }).error, /ANTHROPIC_API_KEY/);
  runtime.setOperatorRuntimeForTests({ client: scripted([say("hej")]), deps: {} });
  assert.equal((await op.POST(req("/api/operator", { sessionId: "ugyldigt id!", message: "x" }))).status, 400);
  assert.equal((await op.POST(req("/api/operator", { sessionId: "chat-abcdefgh", message: "x" }))).status, 400, "kun op_-sessioner");
  assert.equal((await op.POST(req("/api/operator", { sessionId: SESSION, message: "   " }))).status, 400);
  assert.equal((await op.POST(req("/api/operator", "ikke json"))).status, 400);
  assert.equal((await op.POST(req("/api/operator", { sessionId: SESSION, message: "x".repeat(40_000) }))).status, 413);
});

test("/api/operator: streamer NDJSON, gemmer samtalen, og afslører ingen nøgle", async () => {
  process.env.ANTHROPIC_API_KEY = ["sk", "ant", "api03", "TOPSECRET", "VALUE"].join("-"); // opbygget, så secret-scan ikke melder en falsk nøgle
  const client = scripted([toolUse("create_sections", { navne: ["Nyheder", "Sport"] }), say("Færdig: to sektioner.")]);
  runtime.setOperatorRuntimeForTests({ client, deps: {} });
  as(editor);
  const res = await op.POST(req("/api/operator", { sessionId: SESSION, message: "Opret sektionerne Nyheder og Sport" }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/x-ndjson/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.clone().text();
  assert.ok(!body.includes("TOPSECRET"), "nøglen vises aldrig");
  assert.ok(body.trim().split("\n").every((l) => { JSON.parse(l); return true; }), "hver linje er JSON");
  const evs = await events(res);
  assert.deepEqual(evs.map((e) => e.type), ["tool_call", "tool_result", "undo", "text", "done"]);
  assert.equal(await db.category.count({ where: { instansId: inst } }), 2);
  const msgs = await db.chatMessage.findMany({ where: { sessionId: SESSION }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(msgs.map((m) => m.role), ["user", "assistant"]);
  assert.equal(msgs[1].content, "Færdig: to sektioner.");
  assert.ok(!JSON.stringify(msgs).includes("TOPSECRET"));
  assert.ok(!JSON.stringify(client.calls).includes("TOPSECRET"), "nøglen sendes ikke i prompten");

  // Fortryd-route
  const undoId = (evs.find((e) => e.type === "undo") as { undoId: string }).undoId;
  as(editor2);
  assert.equal((await undoRoute.POST(req("/api/operator/undo", { undoId }))).status, 409, "andres handling kan ikke fortrydes");
  as(editor);
  assert.equal((await undoRoute.POST(req("/api/operator/undo", { undoId }, { origin: "https://evil.test" }))).status, 403);
  const ok = await undoRoute.POST(req("/api/operator/undo", { undoId }));
  assert.equal(ok.status, 200);
  assert.equal(await db.category.count({ where: { instansId: inst } }), 0);
  assert.equal((await undoRoute.POST(req("/api/operator/undo", { undoId }))).status, 409, "kun én gang");

  // samtalen tilhører brugeren: en anden bruger får 404 på samme sessionId
  as(editor2);
  runtime.setOperatorRuntimeForTests({ client: scripted([say("x")]), deps: {} });
  assert.equal((await op.POST(req("/api/operator", { sessionId: SESSION, message: "snyd" }))).status, 404);
});

test("/api/operator/confirm: Anvend udfører, Annullér udfører intet, fremmed bruger/forfalsket token afvises, secret kun i svaret", async () => {
  as(editor);
  runtime.setOperatorRuntimeForTests({ client: scripted([toolUse("create_user", { navn: "Rute Bruger", email: "rute.bruger@test.local", rolle: "Støtte" }), say("Venter på dig.")]), deps: {} });
  const res = await op.POST(req("/api/operator", { sessionId: "op_confirmsession1", message: "Opret en bruger" }));
  const card = (await events(res)).find((e) => e.type === "confirm_required") as Extract<OperatorEvent, { type: "confirm_required" }>;
  assert.ok(card);
  assert.equal(await db.user.count({ where: { email: "rute.bruger@test.local" } }), 0);

  as(editor2);
  assert.equal((await confirmRoute.POST(req("/api/operator/confirm", { token: card.token }))).status, 404, "anden bruger");
  as(editor);
  assert.equal((await confirmRoute.POST(req("/api/operator/confirm", { token: card.token }, { origin: "https://evil.test" }))).status, 403);
  assert.equal((await confirmRoute.POST(req("/api/operator/confirm", { token: "opc_forfalsket-token-1234567890" }))).status, 404);
  assert.equal((await confirmRoute.POST(req("/api/operator/confirm", { token: card.token, action: "slet-alt" }))).status, 400);

  const applied = await confirmRoute.POST(req("/api/operator/confirm", { token: card.token }));
  assert.equal(applied.status, 200);
  const body = (await applied.json()) as { ok: boolean; secret: { value: string } | null };
  assert.equal(body.ok, true);
  assert.ok(body.secret?.value);
  assert.equal(await db.user.count({ where: { email: "rute.bruger@test.local" } }), 1);
  assert.equal((await confirmRoute.POST(req("/api/operator/confirm", { token: card.token }))).status, 404, "genbrug afvises");

  // annullér
  runtime.setOperatorRuntimeForTests({ client: scripted([toolUse("create_user", { navn: "Aldrig", email: "aldrig@test.local", rolle: "Støtte" }), say("ok")]), deps: {} });
  const res2 = await op.POST(req("/api/operator", { sessionId: "op_confirmsession1", message: "Og en til" }));
  const card2 = (await events(res2)).find((e) => e.type === "confirm_required") as Extract<OperatorEvent, { type: "confirm_required" }>;
  const cancelled = await confirmRoute.POST(req("/api/operator/confirm", { token: card2.token, action: "cancel" }));
  assert.equal(cancelled.status, 200);
  assert.equal((await confirmRoute.POST(req("/api/operator/confirm", { token: card2.token }))).status, 404);
  assert.equal(await db.user.count({ where: { email: "aldrig@test.local" } }), 0);
});

test("rate limit: efter loftet svarer /api/operator 429 med Retry-After og kalder ikke modellen", async () => {
  const client = scripted([say("ok")]);
  runtime.setOperatorRuntimeForTests({ client, deps: {} });
  as(editor2);
  for (let i = 0; i < RATE_LIMIT.limit; i++) await rateLimit({ ...RATE_LIMIT, key: editor2.id });
  const res = await op.POST(req("/api/operator", { sessionId: "op_ratelimit001", message: "x" }));
  assert.equal(res.status, 429);
  assert.ok(res.headers.get("retry-after"));
  assert.equal(client.calls.length, 0);
});
