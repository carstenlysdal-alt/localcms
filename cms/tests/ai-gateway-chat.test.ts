import assert from "node:assert/strict";
import test, { after, afterEach, before, beforeEach } from "node:test";
import { db } from "../lib/db";
import { getBreaker } from "../lib/resilience";
import { createInstance, createUser, installNextMocks, session, uniq } from "./helpers/mock-session";
import { failure, fakeFetch, stalledStream, streamResponse, type FakeFetch } from "./helpers/fake-ai-fetch";

installNextMocks();

type Route = typeof import("../app/api/chat/route");
let route: Route;
let instansId = "";
const realFetch = globalThis.fetch;
const KEYS = ["DEEPSEEK_API_KEY", "ANTHROPIC_API_KEY", "AI_PROVIDER", "CHAT_AI_PROVIDER", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL"] as const;
const savedEnv: Record<string, string | undefined> = {};
const BREAKER = "ai:deepseek";

const EMAIL = "kilde.person@example.dk";
const PHONE = "+45 98 76 54 32";

before(async () => {
  for (const k of KEYS) savedEnv[k] = process.env[k];
  route = await import("../app/api/chat/route");
  instansId = (await createInstance("Chat")).id;
});

after(async () => {
  await db.chatMessage.deleteMany({ where: { instansId } });
  await db.user.deleteMany({ where: { instansId } });
  await db.instance.delete({ where: { id: instansId } });
});

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  process.env.DEEPSEEK_API_KEY = "test-noegle-deepseek";
  getBreaker(BREAKER).reset();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

async function loginAs() {
  const u = await createUser(instansId, "Ansvarshavende redaktør");
  session.userId = u.id;
  return u;
}

function post(sessionId: string, message: string, extra: Record<string, unknown> = {}, signal?: AbortSignal) {
  return new Request("https://slagelselokalt.dk/api/chat", {
    method: "POST",
    headers: { host: "slagelselokalt.dk", origin: "https://slagelselokalt.dk", "content-type": "application/json" },
    body: JSON.stringify({ sessionId, message, mode: "ask", ...extra }),
    signal,
  });
}

const install = (f: FakeFetch) => {
  globalThis.fetch = f;
  return f;
};
const sid = () => uniq("sess").replace(/[^A-Za-z0-9_-]/g, "x").padEnd(10, "x");

test("chat + deepseek: streamer ren tekst, maskerer persondata i historik/kontekst, gendanner lokalt, gemmer svaret og bevarer historik", async () => {
  const user = await loginAs();
  const f = install(
    fakeFetch([
      (call) => {
        const ph = /\[e-mail-k[0-9a-f]{7}\]/.exec(call.raw)?.[0] ?? "";
        return streamResponse(["Kontakt ", ph.slice(0, 4), ph.slice(4), " i morgen."], { splitAt: [30, 99] });
      },
      streamResponse(["Anden ", "tur."]),
    ]),
  );
  const s = sid();
  const res = await route.POST(post(s, `Hvad ved vi om ${EMAIL}?`, { context: { titel: "Cykelsti", brodtekst: `Ring til ${PHONE} for flere oplysninger. CPR 010203-1234.` } }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /^text\/plain/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(await res.text(), `Kontakt ${EMAIL} i morgen.`);

  const sent = f.calls[0];
  assert.equal(sent.url, "https://api.deepseek.com/chat/completions");
  assert.equal(sent.body.stream, true);
  assert.equal(sent.body.model, "deepseek-chat");
  assert.equal(sent.body.max_tokens, 1024);
  for (const secret of [EMAIL, "kilde.person", PHONE, "98 76 54 32", "010203-1234", user.navn]) assert.equal(sent.raw.includes(secret), false, `"${secret}" må ikke forlade processen`);
  assert.match(sent.body.messages[0].content, /journalisten/);
  assert.match(sent.body.messages[0].content, /<artikel>/, "artikelkontekst medsendes som data (maskeret)");

  const rows = await db.chatMessage.findMany({ where: { sessionId: s }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(rows.map((r) => r.role), ["user", "assistant"]);
  assert.equal(rows[1].content, `Kontakt ${EMAIL} i morgen.`, "gemt svar er gendannet (lokalt)");

  // Anden tur: historikken (maskeret) følger med og roller skifter
  const res2 = await route.POST(post(s, "Tak, og hvad så?"));
  assert.equal(await res2.text(), "Anden tur.");
  const second = f.calls[1].body.messages;
  assert.deepEqual(second.map((m) => m.role), ["system", "user", "assistant", "user"]);
  assert.equal(f.calls[1].raw.includes(EMAIL), false);
});

test("chat + deepseek: uden nøgle 503 med generisk tekst; eksplicit CHAT_AI_PROVIDER=anthropic uden Anthropic-nøgle falder ikke tilbage til DeepSeek", async () => {
  await loginAs();
  delete process.env.DEEPSEEK_API_KEY;
  const none = await route.POST(post(sid(), "Hej"));
  assert.equal(none.status, 503);
  assert.equal(((await none.json()) as { error: string }).error, "AI er ikke konfigureret (DEEPSEEK_API_KEY eller ANTHROPIC_API_KEY mangler).");

  process.env.DEEPSEEK_API_KEY = "test-noegle-deepseek";
  process.env.CHAT_AI_PROVIDER = "anthropic";
  const f = install(fakeFetch([streamResponse(["x"])]));
  const explicit = await route.POST(post(sid(), "Hej"));
  assert.equal(explicit.status, 503);
  assert.match(((await explicit.json()) as { error: string }).error, /ANTHROPIC_API_KEY mangler/);
  assert.equal(f.calls.length, 0, "ingen data sendt til DeepSeek");
});

test("chat + deepseek: 401/402/429/5xx og åben breaker besvares med dansk JSON før strømmen starter", async () => {
  await loginAs();
  const err = async (steps: Parameters<typeof fakeFetch>[0]) => {
    getBreaker(BREAKER).reset();
    install(fakeFetch(steps));
    const res = await route.POST(post(sid(), "Hej"));
    return { status: res.status, body: (await res.json()) as { error: string }, retryAfter: res.headers.get("retry-after") };
  };
  const a = await err([failure(401)]);
  assert.equal(a.status, 502);
  assert.match(a.body.error, /afviste nøglen/);
  assert.equal(JSON.stringify(a).includes("intern fejltekst"), false);
  const b = await err([failure(402)]);
  assert.equal(b.status, 502);
  assert.match(b.body.error, /saldo/);
  const c = await err([failure(429), failure(429)]);
  assert.equal(c.status, 429);
  assert.match(c.body.error, /for mange forespørgsler/);
  const d = await err([failure(500), failure(503)]);
  assert.equal(d.status, 502);
  assert.match(d.body.error, /overbelastet/);
  getBreaker(BREAKER).reset();
  install(fakeFetch([failure(500), streamResponse(["Efter genforsøg."])]));
  const retried = await route.POST(post(sid(), "Hej"));
  assert.equal(retried.status, 200, "5xx genforsøges én gang");
  assert.equal(await retried.text(), "Efter genforsøg.");

  getBreaker(BREAKER).reset();
  const f = install(fakeFetch([failure(500)]));
  await route.POST(post(sid(), "Hej")); // 2 fejl
  await route.POST(post(sid(), "Hej")); // 3. åbner
  const calls = f.calls.length;
  const open = await route.POST(post(sid(), "Hej"));
  assert.equal(open.status, 503);
  assert.equal(open.headers.get("retry-after"), "30");
  assert.equal(f.calls.length, calls);
});

test("chat + deepseek: klientens afbrydelse stopper strømmen, gemmer det modtagne og påvirker ikke breakeren", async () => {
  await loginAs();
  install(fakeFetch([(_c, signal) => stalledStream(signal, ["Første del. "])]));
  const ac = new AbortController();
  const s = sid();
  const res = await route.POST(post(s, "Hej", {}, ac.signal));
  assert.equal(res.status, 200);
  const reader = res.body!.getReader();
  const first = await reader.read();
  assert.equal(new TextDecoder().decode(first.value), "Første del. ");
  ac.abort();
  let rest = "";
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    rest += new TextDecoder().decode(r.value);
  }
  assert.equal(rest, "", "ingen fejltekst efter klient-afbrydelse");
  const saved = await db.chatMessage.findMany({ where: { sessionId: s, role: "assistant" } });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].content, "Første del. ");
  assert.equal(getBreaker(BREAKER).getState(), "closed");
});

test("chat + deepseek: samme rate limit, same-origin og størrelsesloft som før", async () => {
  await loginAs();
  install(fakeFetch([streamResponse(["ok"])]));
  const evil = new Request("https://slagelselokalt.dk/api/chat", { method: "POST", headers: { host: "slagelselokalt.dk", origin: "https://evil.test", "content-type": "application/json" }, body: "{}" });
  assert.equal((await route.POST(evil)).status, 403);
  const tooLong = await route.POST(post(sid(), "x".repeat(8001)));
  assert.equal(tooLong.status, 400);
  let last = 0;
  for (let i = 0; i < 21; i++) last = (await route.POST(post(sid(), "Hej"))).status;
  assert.equal(last, 429, "20 beskeder pr. 10 min pr. bruger");
});
