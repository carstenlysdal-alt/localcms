import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { MemoryRateLimitStore, setRateLimitStore } from "../lib/ratelimit";
import { createDeepseekProvider } from "../lib/operator/llm/deepseek";
import { createNdjsonParser, type OperatorEvent } from "../lib/operator/events";
import { cleanupInstance } from "./helpers/operator-fixtures";
import { fakeFetch, sseResponse, textStream, toolCallStream } from "./helpers/fake-deepseek";
import { createInstance, createUser, installNextMocks, session } from "./helpers/mock-session";

installNextMocks();
setRateLimitStore(new MemoryRateLimitStore());

let inst = "";
let editor: Awaited<ReturnType<typeof createUser>>;
let runtime: typeof import("../lib/operator/runtime");
let op: typeof import("../app/api/operator/route");
const HOST = "slagelselokalt.dk";
const req = (body: unknown) => new Request(`https://${HOST}/api/operator`, { method: "POST", headers: { host: HOST, origin: `https://${HOST}`, "content-type": "application/json" }, body: JSON.stringify(body) });
const saved = { ds: process.env.DEEPSEEK_API_KEY, an: process.env.ANTHROPIC_API_KEY, pr: process.env.OPERATOR_PROVIDER };

before(async () => {
  runtime = await import("../lib/operator/runtime");
  op = await import("../app/api/operator/route");
  inst = (await createInstance("DsRoute")).id;
  editor = await createUser(inst, "Ansvarshavende redaktør");
  session.userId = editor.id;
});

after(async () => {
  runtime.setOperatorRuntimeForTests(null);
  for (const [k, v] of [["DEEPSEEK_API_KEY", saved.ds], ["ANTHROPIC_API_KEY", saved.an], ["OPERATOR_PROVIDER", saved.pr]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  await cleanupInstance(inst);
});

test("/api/operator: uden nogen nøgle svarer ruten 503 på dansk med begge variabelnavne (ingen override)", async () => {
  runtime.setOperatorRuntimeForTests(null);
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPERATOR_PROVIDER;
  const res = await op.POST(req({ sessionId: "op_dsroute000001", message: "Hej" }));
  assert.equal(res.status, 503);
  const { error } = (await res.json()) as { error: string };
  assert.match(error, /DEEPSEEK_API_KEY/);
  assert.match(error, /ANTHROPIC_API_KEY/);
  assert.equal(runtime.getOperatorProviderInfo(), null);

  process.env.OPERATOR_PROVIDER = "deepseek";
  process.env.ANTHROPIC_API_KEY = ["an", "test", "ikke", "rigtig"].join("-");
  const res2 = await op.POST(req({ sessionId: "op_dsroute000001", message: "Hej" }));
  assert.equal(res2.status, 503, "eksplicit deepseek uden nøgle falder ikke tilbage til Anthropic");
  assert.match(((await res2.json()) as { error: string }).error, /DEEPSEEK_API_KEY mangler/);
  delete process.env.OPERATOR_PROVIDER;
  delete process.env.ANTHROPIC_API_KEY;
});

test("/api/operator på DeepSeek: NDJSON med done.provider, samtalen gemmes, persondata sendes ikke, udbyderen vises i info", async () => {
  const f = fakeFetch([sseResponse(toolCallStream([{ id: "c1", name: "create_sections", args: JSON.stringify({ navne: ["Nyheder", "Sport"] }) }])), sseResponse(textStream(["Færdig: to sektioner."]))]);
  const provider = createDeepseekProvider({ apiKey: ["ds", "test", "ikke", "rigtig"].join("-"), fetchImpl: f, sleep: async () => undefined });
  runtime.setOperatorRuntimeForTests({ providerObject: provider, deps: {} });
  assert.deepEqual(runtime.getOperatorProviderInfo(), { id: "deepseek", label: "DeepSeek", model: "deepseek-chat", minimiseData: true });

  const res = await op.POST(req({ sessionId: "op_dsroute000002", message: "Opret Nyheder og Sport, svar til chef@firma.dk" }));
  assert.equal(res.status, 200);
  const parser = createNdjsonParser();
  const events: OperatorEvent[] = [...parser.push(await res.text()), ...parser.flush()];
  assert.deepEqual(events.map((e) => e.type), ["tool_call", "tool_result", "undo", "text", "done"]);
  assert.equal((events.at(-1) as { provider?: string }).provider, "deepseek");
  assert.equal(await db.category.count({ where: { instansId: inst } }), 2);
  assert.ok(!f.calls.map((c) => c.raw).join("").includes("chef@firma.dk"));
  const msgs = await db.chatMessage.findMany({ where: { sessionId: "op_dsroute000002" }, orderBy: { createdAt: "asc" } });
  assert.equal(msgs[0].content, "Opret Nyheder og Sport, svar til chef@firma.dk", "den gemte samtale er brugerens egen tekst");
  assert.equal(msgs[1].content, "Færdig: to sektioner.");
});
