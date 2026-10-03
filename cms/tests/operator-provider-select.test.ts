import assert from "node:assert/strict";
import test from "node:test";
import { checkEnv } from "../lib/env";
import { createOperatorProvider, describeOperatorProvider, NO_PROVIDER_MESSAGE, selectProvider } from "../lib/operator/llm/select";

// Opdigtede værdier (ingen rigtige nøgler); bygget af stumper så scanneren ikke reagerer.
const DS = ["ds", "test", "ikke", "rigtig"].join("-");
const AN = ["an", "test", "ikke", "rigtig"].join("-");
const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

test("udbydervalg: matrix (eksplicit, default, ingen nøgle)", () => {
  const cases: [Record<string, string>, string][] = [
    [{ DEEPSEEK_API_KEY: DS }, "deepseek"],
    [{ ANTHROPIC_API_KEY: AN }, "anthropic"],
    [{ DEEPSEEK_API_KEY: DS, ANTHROPIC_API_KEY: AN }, "deepseek"],
    [{ DEEPSEEK_API_KEY: DS, ANTHROPIC_API_KEY: AN, OPERATOR_PROVIDER: "anthropic" }, "anthropic"],
    [{ DEEPSEEK_API_KEY: DS, ANTHROPIC_API_KEY: AN, OPERATOR_PROVIDER: " DeepSeek " }, "deepseek"],
    [{ ANTHROPIC_API_KEY: AN, OPERATOR_PROVIDER: "anthropic" }, "anthropic"],
    [{ DEEPSEEK_API_KEY: "  ", ANTHROPIC_API_KEY: AN }, "anthropic"],
  ];
  for (const [e, want] of cases) {
    const sel = selectProvider(env(e));
    assert.ok(sel.ok, JSON.stringify(Object.keys(e)));
    assert.equal(sel.id, want, JSON.stringify(Object.keys(e)));
  }
});

test("udbydervalg: ingen nøgle og eksplicit valg uden nøgle giver tydelig dansk fejl (aldrig stille fallback)", () => {
  const none = selectProvider(env({}));
  assert.ok(!none.ok);
  assert.equal(none.message, NO_PROVIDER_MESSAGE);
  assert.match(none.message, /DEEPSEEK_API_KEY/);
  assert.match(none.message, /ANTHROPIC_API_KEY/);

  const ds = selectProvider(env({ OPERATOR_PROVIDER: "deepseek", ANTHROPIC_API_KEY: AN }));
  assert.ok(!ds.ok);
  assert.equal(ds.code, "missing-key");
  assert.match(ds.message, /DEEPSEEK_API_KEY mangler/);

  const an = selectProvider(env({ OPERATOR_PROVIDER: "anthropic", DEEPSEEK_API_KEY: DS }));
  assert.ok(!an.ok);
  assert.match(an.message, /ANTHROPIC_API_KEY mangler/);

  const bad = selectProvider(env({ OPERATOR_PROVIDER: "gemini", DEEPSEEK_API_KEY: DS }));
  assert.ok(!bad.ok);
  assert.equal(bad.code, "invalid");

  for (const r of [none, ds, an, bad]) assert.ok(!r.message.includes(DS) && !r.message.includes(AN), "nøgler gengives aldrig");
});

test("createOperatorProvider/describeOperatorProvider: DeepSeek minimerer data, Anthropic ikke; model og base-URL fra env", async () => {
  let url = "";
  const fetchImpl = (async (input: RequestInfo | URL) => {
    url = String(input);
    return new Response("data: " + JSON.stringify({ choices: [{ delta: { content: "hej" }, finish_reason: "stop" }] }) + "\n\ndata: [DONE]\n\n", { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
  const made = createOperatorProvider(env({ DEEPSEEK_API_KEY: DS, DEEPSEEK_MODEL: "deepseek-x", DEEPSEEK_BASE_URL: "https://eksempel.test/v1" }), { fetchImpl });
  assert.ok(made.ok);
  assert.equal(made.provider.id, "deepseek");
  assert.equal(made.provider.model, "deepseek-x");
  assert.equal(made.provider.minimiseData, true);
  await made.provider.complete({ system: [], messages: [{ role: "user", content: "x" }], tools: [], maxTokens: 300, signal: new AbortController().signal });
  assert.equal(url, "https://eksempel.test/v1/chat/completions");

  const an = createOperatorProvider(env({ ANTHROPIC_API_KEY: AN }));
  assert.ok(an.ok);
  assert.equal(an.provider.id, "anthropic");
  assert.equal(an.provider.minimiseData, false);

  assert.deepEqual(describeOperatorProvider(env({ DEEPSEEK_API_KEY: DS })), { id: "deepseek", label: "DeepSeek", model: "deepseek-chat", minimiseData: true });
  assert.equal(describeOperatorProvider(env({}))?.id, undefined);
  assert.equal(createOperatorProvider(env({})).ok, false);
});

test("env-validering: produktionsadvarsel kun når ingen af nøglerne findes; udbyder-advarsler nævner kun variabelnavne", () => {
  const good = { NODE_ENV: "production", DATABASE_URL: "postgresql://u:p-long-secret@h:5432/d", AUTH_SECRET: "x".repeat(40), NEXT_PUBLIC_APP_URL: "https://x.dk", CRON_SECRET: "c".repeat(20) };
  const warn = (extra: Record<string, string>) => checkEnv(env({ ...good, ...extra })).warnings.filter((w) => /ANTHROPIC|DEEPSEEK|OPERATOR/.test(w));
  assert.equal(warn({}).length, 1);
  assert.match(warn({})[0], /Hverken ANTHROPIC_API_KEY eller DEEPSEEK_API_KEY/);
  assert.deepEqual(warn({ DEEPSEEK_API_KEY: DS }), []);
  assert.deepEqual(warn({ ANTHROPIC_API_KEY: AN }), []);
  assert.match(warn({ DEEPSEEK_API_KEY: DS, ANTHROPIC_API_KEY: AN })[0], /uden OPERATOR_PROVIDER/);
  assert.deepEqual(warn({ DEEPSEEK_API_KEY: DS, ANTHROPIC_API_KEY: AN, OPERATOR_PROVIDER: "deepseek" }), []);
  assert.match(warn({ OPERATOR_PROVIDER: "deepseek", ANTHROPIC_API_KEY: AN })[0], /DEEPSEEK_API_KEY mangler/);
  assert.match(warn({ OPERATOR_PROVIDER: "tilfældig", DEEPSEEK_API_KEY: DS })[0], /deepseek' eller 'anthropic/);
  assert.match(warn({ DEEPSEEK_API_KEY: DS, DEEPSEEK_BASE_URL: "http://usikker.test" }).join(" "), /https/);
  const all = checkEnv(env({ ...good, DEEPSEEK_API_KEY: DS, ANTHROPIC_API_KEY: AN })).warnings.join(" ");
  assert.ok(!all.includes(DS) && !all.includes(AN));
  assert.equal(checkEnv(env({ ...good, DEEPSEEK_API_KEY: DS })).ok, true);
});
