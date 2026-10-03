import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { CircuitOpenError, getBreaker } from "../lib/resilience";
import { createDeepseekProvider, parseToolArguments, resolveDeepseekBaseUrl, resolveDeepseekModel } from "../lib/operator/llm/deepseek";
import { LlmError } from "../lib/operator/llm/errors";
import { DONE, FakeCall, SECTION_TOOL, data, delta, fakeFetch, hangingFetch, request, sseResponse, stalledResponse, status, textStream, toolCallStream } from "./helpers/fake-deepseek";

// Nøglen er en opdigtet testværdi bygget af stumper (ingen rigtig nøgle, og scanneren melder ikke).
const KEY = ["test", "key", "ikke", "rigtig"].join("-");
const noSleep = async () => undefined;
const make = (fetchImpl: typeof fetch, over: Partial<Parameters<typeof createDeepseekProvider>[0]> = {}) => createDeepseekProvider({ apiKey: KEY, fetchImpl, sleep: noSleep, ...over });

beforeEach(() => {
  getBreaker("operator:deepseek").reset();
  getBreaker("anthropic").reset();
});

async function rejects(promise: Promise<unknown>): Promise<LlmError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof LlmError, `forventede LlmError, fik ${String(error)}`);
    return error;
  }
  assert.fail("forventede en fejl");
}

test("deepseek: tekstdeltaer streames i rækkefølge, forespørgslen er OpenAI-formateret (url, model, temperatur 0.2, stream, system først)", async () => {
  const f = fakeFetch([sseResponse(textStream(["Hej ", "med ", "dig"]))]);
  const got: string[] = [];
  const res = await make(f).stream(request({ onTextDelta: (d) => got.push(d), tools: [SECTION_TOOL] }));
  assert.deepEqual(got, ["Hej ", "med ", "dig"]);
  assert.deepEqual(res.content, [{ type: "text", text: "Hej med dig" }]);
  assert.equal(res.stopReason, "end_turn");
  assert.equal(res.modelId, "deepseek-chat");

  const call = f.calls[0];
  assert.equal(call.url, "https://api.deepseek.com/chat/completions");
  assert.equal(call.headers["authorization"], `Bearer ${KEY}`);
  assert.equal(call.body.model, "deepseek-chat");
  assert.equal(call.body.temperature, 0.2);
  assert.equal(call.body.stream, true);
  assert.equal(call.body.max_tokens, 1500);
  assert.equal(call.body.tool_choice, "auto");
  assert.deepEqual(call.body.messages[0], { role: "system", content: "SYSTEMPROMPT\n\nKONTEKST" });
  assert.deepEqual(call.body.messages[1], { role: "user", content: "Hej" });
  assert.deepEqual(call.body.tools, [{ type: "function", function: { name: "create_sections", description: "Opretter sektioner.", parameters: SECTION_TOOL.input_schema } }]);
});

test("deepseek: base-URL og model kan sættes (env-hjælpere), afsluttende skråstreg fjernes, tomt = default", async () => {
  assert.equal(resolveDeepseekModel({ DEEPSEEK_MODEL: " deepseek-reasoner " } as unknown as NodeJS.ProcessEnv), "deepseek-reasoner");
  assert.equal(resolveDeepseekModel({} as unknown as NodeJS.ProcessEnv), "deepseek-chat");
  assert.equal(resolveDeepseekBaseUrl({ DEEPSEEK_BASE_URL: "https://proxy.example/v1/" } as unknown as NodeJS.ProcessEnv), "https://proxy.example/v1");
  const f = fakeFetch([sseResponse(textStream(["ok"]))]);
  await make(f, { baseUrl: "https://proxy.example/v1/", model: "m-1" }).complete(request());
  assert.equal(f.calls[0].url, "https://proxy.example/v1/chat/completions");
  assert.equal(f.calls[0].body.model, "m-1");
  assert.equal(f.calls[0].body.tools, undefined, "ingen tools-felt uden værktøjer");
});

test("deepseek: værktøjskald hvor argumenterne er delt over mange chunks (også midt i JSON/UTF-8-tegn) samles", async () => {
  const args = JSON.stringify({ navne: ["Nyheder", "Erhverv", "Sport", "Kultur", "Foreningsliv", "Debat", "Æbleskiver og Østers"] });
  const body = toolCallStream([{ id: "call_a", name: "create_sections", args }], { chunk: 5 });
  // Skær også selve SSE-bytes midt i en linje.
  const res = await make(fakeFetch([sseResponse(body, [11, 57, 101, 333, 1000])])).stream(request({ tools: [SECTION_TOOL] }));
  assert.equal(res.stopReason, "tool_use");
  assert.deepEqual(res.content, [{ type: "tool_use", id: "call_a", name: "create_sections", input: JSON.parse(args) }]);
});

test("deepseek: flere værktøjskald (parallelle, indeks 0..2) holdes adskilt og i rækkefølge; tekst før kald bevares", async () => {
  const calls: FakeCall[] = [
    { id: "c0", name: "list_sections", args: "{}" },
    { id: "c1", name: "create_sections", args: JSON.stringify({ navne: ["A"] }) },
    { id: "c2", name: "list_areas", args: JSON.stringify({ antal: 3 }) },
  ];
  const res = await make(fakeFetch([sseResponse(toolCallStream(calls, { chunk: 4, text: "Jeg kigger." }))])).stream(request());
  assert.deepEqual(res.content.map((b) => (b.type === "text" ? b.text : `${b.name}:${b.id}`)), ["Jeg kigger.", "list_sections:c0", "create_sections:c1", "list_areas:c2"]);
  const inputs = res.content.filter((b) => b.type === "tool_use").map((b) => (b as { input: unknown }).input);
  assert.deepEqual(inputs, [{}, { navne: ["A"] }, { antal: 3 }]);
});

test("deepseek: manglende id/index får genererede id'er; dublerede id'er gøres unikke", async () => {
  const body =
    delta({ tool_calls: [{ index: 0, function: { name: "list_sections", arguments: "{}" } }] }) +
    delta({ tool_calls: [{ index: 1, id: "x", function: { name: "list_areas", arguments: "{}" } }] }) +
    delta({ tool_calls: [{ index: 2, id: "x", function: { name: "list_topics", arguments: "{}" } }] }) +
    delta({}, "tool_calls") +
    DONE;
  const res = await make(fakeFetch([sseResponse(body)])).stream(request());
  const ids = res.content.map((b) => (b as { id: string }).id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(res.content.length, 3);
});

test("deepseek: ugyldig/tom/hegnet JSON i argumenter", async () => {
  assert.deepEqual(parseToolArguments(""), { ok: true, value: {} });
  assert.deepEqual(parseToolArguments("  "), { ok: true, value: {} });
  assert.deepEqual(parseToolArguments('```json\n{"a":1}\n```'), { ok: true, value: { a: 1 } });
  assert.deepEqual(parseToolArguments(JSON.stringify(JSON.stringify({ a: 1 }))), { ok: true, value: { a: 1 } }, "dobbelt-kodet JSON");
  assert.equal(parseToolArguments("[1,2]").ok, false, "kun objekter");
  assert.equal(parseToolArguments("null").ok, false);
  assert.deepEqual(parseToolArguments('{"navne": ["A", '), { ok: false, raw: '{"navne": ["A", ' });

  const bad = await make(fakeFetch([sseResponse(toolCallStream([{ id: "b1", name: "create_sections", args: '{"navne": ["A", ' }]))])).stream(request());
  const block = bad.content[0] as { type: string; invalidArguments?: string; input: unknown };
  assert.equal(bad.stopReason, "tool_use");
  assert.equal(block.invalidArguments, '{"navne": ["A", ');
  assert.deepEqual(block.input, {});

  const empty = await make(fakeFetch([sseResponse(toolCallStream([{ id: "e1", name: "help", args: "" }]))])).stream(request());
  assert.deepEqual(empty.content, [{ type: "tool_use", id: "e1", name: "help", input: {} }]);
});

test("deepseek: finish_reason-varianter (stop, tool_calls, length, content_filter, stop med værktøjskald, insufficient_system_resource)", async () => {
  const run = (body: string) => make(fakeFetch([sseResponse(body)])).stream(request());
  assert.equal((await run(textStream(["a"], "stop"))).stopReason, "end_turn");
  assert.equal((await run(textStream(["a"], "length"))).stopReason, "max_tokens");
  assert.equal((await run(textStream(["a"], "content_filter"))).stopReason, "content_filter");
  assert.equal((await run(toolCallStream([{ name: "help", args: "{}" }], { finish: "stop" }))).stopReason, "tool_use", "stop med værktøjskald behandles som tool_use");
  assert.equal((await run(toolCallStream([{ name: "help", args: "{}" }], { finish: "length" }))).stopReason, "max_tokens", "afkortede kald udføres ikke");
  assert.equal((await run(textStream(["a"], "ukendt_grund"))).stopReason, "end_turn");
  const err = await rejects(run(textStream([""], "insufficient_system_resource")));
  assert.equal(err.status, 503);
});

test("deepseek: SSE-detaljer: kommentarer, CRLF, ikke-JSON-linjer, reasoning_content og [DONE] uden finish_reason", async () => {
  const body = ": keep-alive\r\n\r\n" + `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "tænker" } }] })}\r\n\r\n` + "data: ikke json\r\n\r\n" + `data: ${JSON.stringify({ choices: [{ delta: { content: "Svar" } }] })}\r\n\r\n` + "data: [DONE]\r\n\r\n";
  const got: string[] = [];
  const res = await make(fakeFetch([sseResponse(body, [5, 40])])).stream(request({ onTextDelta: (d) => got.push(d) }));
  assert.deepEqual(got, ["Svar"], "reasoning_content sendes aldrig videre");
  assert.equal(res.content[0].type === "text" && res.content[0].text, "Svar");
  assert.equal(res.stopReason, "end_turn");
});

test("deepseek: afkortet strøm (ingen finish_reason, ingen [DONE]) er en fejl; ikke-streamet JSON-svar understøttes", async () => {
  const err = await rejects(make(fakeFetch([sseResponse(delta({ content: "halv" }))])).stream(request()));
  assert.equal(err.kind, "network");
  const json = JSON.stringify({ model: "deepseek-chat", choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "j1", type: "function", function: { name: "help", arguments: "{}" } }] }, finish_reason: "tool_calls" }] });
  const res = await make(fakeFetch([new Response(json, { status: 200, headers: { "content-type": "application/json" } })])).complete(request());
  assert.deepEqual(res.content, [{ type: "tool_use", id: "j1", name: "help", input: {} }]);
  assert.equal(res.stopReason, "tool_use");
});

test("deepseek: en fejl midt i strømmen (error-objekt) afbryder med dansk besked", async () => {
  const err = await rejects(make(fakeFetch([sseResponse(delta({ content: "a" }) + data({ error: { message: "intern" } }) + DONE)])).stream(request()));
  assert.equal(err.kind, "server");
  assert.match(err.userMessage, /DeepSeek/);
});

test("deepseek: tilbage-sendte værktøjskald og resultater (assistent tool_calls -> role:tool), fejl markeres, ugyldige args sendes som {}", async () => {
  const f = fakeFetch([sseResponse(textStream(["Færdig."]))]);
  await make(f).stream(
    request({
      messages: [
        { role: "user", content: "Opret sektioner" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "Jeg gør det." },
            { type: "tool_use", id: "t1", name: "create_sections", input: { navne: ["A"] } },
            { type: "tool_use", id: "t2", name: "help", input: {}, invalidArguments: "{kaput" },
          ],
        },
        {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "t1", content: "ok-data" },
            { type: "tool_result", tool_use_id: "t2", content: "ugyldigt", is_error: true },
          ],
        },
      ],
    }),
  );
  const m = f.calls[0].body.messages;
  assert.deepEqual(m[2], {
    role: "assistant",
    content: "Jeg gør det.",
    tool_calls: [
      { id: "t1", type: "function", function: { name: "create_sections", arguments: '{"navne":["A"]}' } },
      { id: "t2", type: "function", function: { name: "help", arguments: "{}" } },
    ],
  });
  assert.deepEqual(m[3], { role: "tool", tool_call_id: "t1", content: "ok-data" });
  assert.deepEqual(m[4], { role: "tool", tool_call_id: "t2", content: "FEJL: ugyldigt" });
  assert.equal(m.length, 5);
});

test("deepseek: udgående sidste skanse maskerer e-mail/telefon/CPR i ALT der sendes, også ved direkte brug af adapteren", async () => {
  const f = fakeFetch([sseResponse(textStream(["ok"]))]);
  await make(f).stream(
    request({
      system: [{ text: "Kontakt admin@example.org" }],
      messages: [
        { role: "user", content: "Ring til +45 12 34 56 78 eller 12345678, cpr 010190-1234, mail anna@firma.dk" },
        { role: "assistant", content: [{ type: "tool_use", id: "t", name: "create_user", input: { email: "bo@firma.dk" } }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "kontakt bo@firma.dk" }] },
      ],
    }),
  );
  const raw = f.calls[0].raw;
  for (const secret of ["admin@example.org", "12 34 56 78", "12345678", "010190", "anna@firma.dk", "bo@firma.dk"]) assert.ok(!raw.includes(secret), `lækkede ${secret}`);
});

test("deepseek: HTTP-fejl giver danske beskeder; 401/402/400 genforsøges ikke, 429/5xx højst én gang", async () => {
  const cases: [number, RegExp, "auth" | "billing" | "rate_limit" | "server" | "bad_request"][] = [
    [401, /afviste nøglen \(401\)/, "auth"],
    [402, /mangler saldo \(402\)/, "billing"],
    [429, /for mange forespørgsler lige nu \(429\)/, "rate_limit"],
    [500, /fejl eller er overbelastet \(500\)/, "server"],
    [503, /overbelastet \(503\)/, "server"],
    [400, /afviste forespørgslen \(400\)/, "bad_request"],
  ];
  for (const [code, re, kind] of cases) {
    getBreaker("operator:deepseek").reset();
    const f = fakeFetch([status(code)]);
    const err = await rejects(make(f).stream(request()));
    assert.equal(err.kind, kind);
    assert.equal(err.status, code);
    assert.match(err.userMessage, re);
    assert.ok(!err.userMessage.includes(KEY) && !err.message.includes(KEY), "nøglen indgår aldrig i fejl");
    const retried = code === 429 || code >= 500;
    assert.equal(f.calls.length, retried ? 2 : 1, `status ${code}: antal kald`);
  }
});

test("deepseek: 429 og derefter 200 lykkes efter ét genforsøg (Retry-After respekteres op til 2 s)", async () => {
  const waits: number[] = [];
  const f = fakeFetch([status(429, { "retry-after": "30" }), sseResponse(textStream(["tilbage"]))]);
  const res = await make(f, { sleep: async (ms) => void waits.push(ms) }).stream(request());
  assert.equal(f.calls.length, 2);
  assert.deepEqual(waits, [2000]);
  assert.equal(res.content[0].type === "text" && res.content[0].text, "tilbage");
  assert.equal(getBreaker("operator:deepseek").getState(), "closed");
});

test("deepseek: intet genforsøg når tekst allerede er streamet til brugeren", async () => {
  const f = fakeFetch([sseResponse(delta({ content: "begyndt" }) + data({ error: { message: "x" } }))]);
  const got: string[] = [];
  await rejects(make(f).stream(request({ onTextDelta: (d) => got.push(d) })));
  assert.equal(f.calls.length, 1);
  assert.deepEqual(got, ["begyndt"]);
});

test("deepseek: timeout (intet svar), idle-timeout midt i strømmen og total-timeout giver timeout-fejl uden genforsøg", async () => {
  const hang = hangingFetch();
  const e1 = await rejects(make(hang, { timeouts: { connectMs: 25 } }).stream(request()));
  assert.equal(e1.kind, "timeout");
  assert.match(e1.userMessage, /svarede ikke i tide/);
  assert.equal(hang.calls.length, 1, "timeout genforsøges ikke");

  const e2 = await rejects(make(fakeFetch([(_c, signal) => stalledResponse(signal, delta({ content: "start" }))]), { timeouts: { idleMs: 25 } }).stream(request()));
  assert.equal(e2.kind, "timeout");

  const e3 = await rejects(make(hangingFetch(), { timeouts: { connectMs: 10_000, totalMs: 25 } }).stream(request()));
  assert.equal(e3.kind, "timeout");
});

test("deepseek: abort fra kalderen (før og under) giver 'aborted' og åbner ikke breakeren", async () => {
  const ac = new AbortController();
  const hang = hangingFetch();
  const p = make(hang).stream(request({ signal: ac.signal }));
  setTimeout(() => ac.abort(), 10);
  const e = await rejects(p);
  assert.equal(e.kind, "aborted");
  const pre = new AbortController();
  pre.abort();
  assert.equal((await rejects(make(fakeFetch([sseResponse(textStream(["x"]))])).stream(request({ signal: pre.signal })))).kind, "aborted");
  for (let i = 0; i < 4; i++) {
    const a = new AbortController();
    a.abort();
    await rejects(make(fakeFetch([status(500)])).stream(request({ signal: a.signal })));
  }
  assert.equal(getBreaker("operator:deepseek").getState(), "closed");
});

test("deepseek: netværksfejl (fetch kaster) giver dansk network-fejl", async () => {
  const f = fakeFetch([() => Promise.reject(new TypeError("fetch failed"))]);
  const e = await rejects(make(f).stream(request()));
  assert.equal(e.kind, "network");
  assert.match(e.userMessage, /forbindelse til DeepSeek/);
  assert.equal(f.calls.length, 1);
});

test("breaker pr. udbyder: DeepSeek-fejl åbner 'operator:deepseek' (efter 3) men ikke 'anthropic'; 4xx tæller ikke; åben breaker afviser uden kald", async () => {
  const ds = getBreaker("operator:deepseek");
  const f = fakeFetch([status(500)]);
  const provider = make(f);
  await rejects(provider.stream(request())); // 2 forsøg = 2 fejl
  assert.equal(ds.getState(), "closed");
  await assert.rejects(provider.stream(request()), CircuitOpenError); // 3. fejl åbner; genforsøget afvises af den åbne breaker
  assert.equal(ds.getState(), "open");
  assert.equal(getBreaker("anthropic").getState(), "closed", "Anthropics breaker er uberørt");
  const before = f.calls.length;
  await assert.rejects(provider.stream(request()), CircuitOpenError);
  assert.equal(f.calls.length, before, "ingen netværkskald når breakeren er åben");

  ds.reset();
  for (let i = 0; i < 5; i++) await rejects(make(fakeFetch([status(402)])).stream(request()));
  assert.equal(ds.getState(), "closed", "402/401 er ikke nedbrud");
});

test("deepseek: max_tokens begrænses til udbyderens loft og gulv", async () => {
  const f = fakeFetch([sseResponse(textStream(["x"]))]);
  await make(f).stream(request({ maxTokens: 100_000 }));
  await make(f).stream(request({ maxTokens: 10 }));
  assert.equal(f.calls[0].body.max_tokens, 8192);
  assert.equal(f.calls[1].body.max_tokens, 256);
});
