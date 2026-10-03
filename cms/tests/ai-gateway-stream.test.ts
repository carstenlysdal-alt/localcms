import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { openDeepseekChatStream } from "../lib/ai/provider/deepseek-stream";
import { isLlmError } from "../lib/operator/llm/errors";
import { CircuitOpenError, getBreaker } from "../lib/resilience";
import { failure, fakeFetch, stalledStream, streamResponse } from "./helpers/fake-ai-fetch";

const BREAKER = "ai:deepseek";
const noSleep = async () => undefined;
beforeEach(() => getBreaker(BREAKER).reset());

const base = (f: ReturnType<typeof fakeFetch>, over: Partial<Parameters<typeof openDeepseekChatStream>[0]> = {}) => ({
  apiKey: "test-noegle",
  system: "Du er en assistent.",
  messages: [{ role: "user" as const, content: "Hej" }],
  maxTokens: 1024,
  signal: new AbortController().signal,
  fetchImpl: f,
  sleep: noSleep,
  ...over,
});

async function collect(chunks: AsyncGenerator<string>) {
  let out = "";
  for await (const c of chunks) out += c;
  return out;
}

test("chat-strøm: SSE-deltaer bliver til ren tekst; linjer må deles midt i en chunk", async () => {
  const f = fakeFetch([streamResponse(["Hej ", "med ", "dig", " – æøå!"], { splitAt: [7, 45, 130, 131, 260] })]);
  const s = await openDeepseekChatStream(base(f));
  assert.equal(await collect(s.chunks), "Hej med dig – æøå!");
  const call = f.calls[0];
  assert.equal(call.url, "https://api.deepseek.com/chat/completions");
  assert.equal(call.headers.authorization, "Bearer test-noegle");
  assert.equal(call.body.stream, true);
  assert.equal(call.body.model, "deepseek-chat");
  assert.equal(call.body.max_tokens, 1024);
  assert.deepEqual(call.body.messages.map((m) => m.role), ["system", "user"]);
  assert.equal(getBreaker(BREAKER).getState(), "closed");
});

test("chat-strøm: historik og system maskeres; pladsholdere gendannes i svaret, også delt over to deltaer", async () => {
  const email = "peter.jensen@example.dk";
  const phone = "20 30 40 50";
  const f = fakeFetch([
    (call) => {
      const ph = /\[e-mail-k[0-9a-f]{7}\]/.exec(call.raw)?.[0] ?? "";
      assert.ok(ph);
      return streamResponse(["Skriv til ", ph.slice(0, 5), ph.slice(5, 14), ph.slice(14), " nu."]);
    },
  ]);
  const s = await openDeepseekChatStream(
    base(f, {
      system: `Kontekst: kontakt ${email}. CPR 010203-1234.`,
      messages: [
        { role: "user", content: `Min kollega er ${email}, tlf ${phone}` },
        { role: "assistant", content: "Forstået." },
        { role: "user", content: "Hvem skal jeg skrive til?" },
      ],
    }),
  );
  assert.equal(await collect(s.chunks), `Skriv til ${email} nu.`);
  const raw = f.calls[0].raw;
  for (const secret of [email, "peter.jensen", phone, "20304050", "010203-1234", "010203"]) assert.equal(raw.includes(secret), false, secret);
  assert.deepEqual(f.calls[0].body.messages.map((m) => m.role), ["system", "user", "assistant", "user"]);
});

test("chat-strøm: 401/402 giver dansk LlmError uden genforsøg; 429/5xx genforsøges én gang", async () => {
  for (const [status, re] of [[401, /afviste nøglen/], [402, /saldo/]] as const) {
    const f = fakeFetch([failure(status)]);
    await assert.rejects(
      () => openDeepseekChatStream(base(f)),
      (e: unknown) => isLlmError(e) && re.test(e.userMessage) && e.status === status,
    );
    assert.equal(f.calls.length, 1);
  }
  const ok = fakeFetch([failure(429, { "retry-after": "1" }), streamResponse(["Efter genforsøg"])]);
  assert.equal(await collect((await openDeepseekChatStream(base(ok))).chunks), "Efter genforsøg");
  assert.equal(ok.calls.length, 2);
  getBreaker(BREAKER).reset();
  const bad = fakeFetch([failure(503)]);
  await assert.rejects(
    () => openDeepseekChatStream(base(bad)),
    (e: unknown) => isLlmError(e) && /overbelastet \(503\)/.test(e.userMessage),
  );
  assert.equal(bad.calls.length, 2, "højst ét genforsøg");
  getBreaker(BREAKER).reset();
  const limited = fakeFetch([failure(429)]);
  await assert.rejects(
    () => openDeepseekChatStream(base(limited)),
    (e: unknown) => isLlmError(e) && e.kind === "rate_limit" && /429/.test(e.userMessage),
  );
});

test("chat-strøm: breaker 'ai:deepseek' åbner efter gentagne 5xx og afviser uden netværkskald", async () => {
  const f = fakeFetch([failure(500)]);
  await assert.rejects(() => openDeepseekChatStream(base(f))); // 2 fejl
  await assert.rejects(() => openDeepseekChatStream(base(f))); // 3. fejl åbner
  assert.equal(getBreaker(BREAKER).getState(), "open");
  const before = f.calls.length;
  await assert.rejects(() => openDeepseekChatStream(base(f)), (e: unknown) => e instanceof CircuitOpenError);
  assert.equal(f.calls.length, before);
});

test("chat-strøm: afbrydelse stopper strømmen uden breaker-fejl; idle-timeout og afbrudt forbindelse giver LlmError", async () => {
  const ac = new AbortController();
  const f = fakeFetch([(_c, signal) => stalledStream(signal, ["Første "])]);
  const s = await openDeepseekChatStream(base(f, { signal: ac.signal }));
  const it = s.chunks[Symbol.asyncIterator]();
  assert.equal((await it.next()).value, "Første ");
  ac.abort();
  await assert.rejects(() => it.next(), (e: unknown) => isLlmError(e) && e.kind === "aborted");
  assert.equal(getBreaker(BREAKER).getState(), "closed", "klient-afbrydelse er ikke et udbyder-udfald");

  const idle = fakeFetch([(_c, signal) => stalledStream(signal, ["x"])]);
  const s2 = await openDeepseekChatStream(base(idle, { timeouts: { idleMs: 30 } }));
  await assert.rejects(() => collect(s2.chunks), (e: unknown) => isLlmError(e) && e.kind === "timeout");

  getBreaker(BREAKER).reset();
  const cut = fakeFetch([streamResponse(["halv"], { finish: null, done: false })]);
  const s3 = await openDeepseekChatStream(base(cut));
  await assert.rejects(() => collect(s3.chunks), (e: unknown) => isLlmError(e) && e.kind === "network");

  const pre = new AbortController();
  pre.abort();
  await assert.rejects(() => openDeepseekChatStream(base(fakeFetch([streamResponse(["a"])]), { signal: pre.signal })), (e: unknown) => isLlmError(e) && e.kind === "aborted");
});
