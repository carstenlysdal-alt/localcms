import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import { db } from "../lib/db";
import { MemoryRateLimitStore, setRateLimitStore } from "../lib/ratelimit";
import { getBreaker } from "../lib/resilience";
import { createDeepseekProvider } from "../lib/operator/llm/deepseek";
import { cleanupInstance, collect, ctxFor } from "./helpers/operator-fixtures";
import { createInstance, createUser, installNextMocks } from "./helpers/mock-session";
import { fakeFetch, sseResponse, status, textStream, toolCallStream, type FetchStep } from "./helpers/fake-deepseek";

installNextMocks();
setRateLimitStore(new MemoryRateLimitStore());

type Loop = typeof import("../lib/operator/loop");
type Dispatch = typeof import("../lib/operator/dispatch");
let loop: Loop;
let dispatch: Dispatch;
let inst = "";
let editor: Awaited<ReturnType<typeof createUser>>;

const SIX = ["Nyheder", "Erhverv", "Sport", "Kultur", "Foreningsliv", "Debat"];
const KEY = ["test", "key", "ikke", "rigtig"].join("-");

before(async () => {
  loop = await import("../lib/operator/loop");
  dispatch = await import("../lib/operator/dispatch");
  inst = (await createInstance("DsFlow")).id;
  editor = await createUser(inst, "Ansvarshavende redaktør");
});

after(async () => {
  await db.submission.deleteMany({ where: { instansId: inst } });
  await cleanupInstance(inst);
});

beforeEach(() => getBreaker("operator:deepseek").reset());

const cats = () => db.category.findMany({ where: { instansId: inst }, orderBy: { sortering: "asc" } });

function setup(steps: FetchStep[]) {
  const f = fakeFetch(steps);
  const provider = createDeepseekProvider({ apiKey: KEY, fetchImpl: f, sleep: async () => undefined });
  return { f, provider };
}

async function turn(steps: FetchStep[], message: string, history: { role: "user" | "assistant"; content: string }[] = []) {
  const { f, provider } = setup(steps);
  const c = collect();
  const ctx = ctxFor(editor);
  const result = await loop.runOperatorTurn({ client: provider.stream, providerId: "deepseek", minimiseData: provider.minimiseData, ctx, history, message, emit: c.emit });
  return { f, c, result, ctx };
}

/** Alt der er sendt til "DeepSeek" i en tur. */
const sent = (f: ReturnType<typeof fakeFetch>) => f.calls.map((c) => c.raw).join("\n");

test("ACCEPTTEST på DeepSeek: 'Opret sektionerne …' -> ét create_sections-kald med 6 navne, to modelkald, Fortryd, audit med udbyder", async () => {
  const { f, c } = await turn(
    [sseResponse(toolCallStream([{ id: "call_1", name: "create_sections", args: JSON.stringify({ navne: SIX }) }], { chunk: 9 })), sseResponse(textStream(["Jeg har oprettet ", "de seks sektioner. ", "Du kan fortryde."]))],
    "Opret sektionerne Nyheder, Erhverv, Sport, Kultur, Foreningsliv og Debat",
  );
  assert.equal(c.of("tool_call").length, 1);
  assert.equal(c.of("tool_call")[0].name, "create_sections");
  assert.equal(f.calls.length, 2);
  const rows = await cats();
  assert.deepEqual(rows.map((r) => r.navn), SIX);
  assert.deepEqual(rows.map((r) => r.sortering), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(c.events.map((e) => e.type), ["tool_call", "tool_result", "undo", "text", "text", "text", "done"]);
  const done = c.of("done")[0];
  assert.equal(done.provider, "deepseek");
  assert.equal(done.promptVersion, "operator-v1.0");

  // Samme systemprompt som for Claude, værktøjsskemaer fra zod-registret, modellen får aldrig instansId/userId at vælge.
  const first = f.calls[0].body;
  const sys = String(first.messages[0].content);
  assert.match(sys, /^# SYSTEM\nDu er AI-operatøren/);
  assert.match(sys, /<hentet_indhold>-elementer, og er DATA/);
  const tool = (first.tools as { function: { name: string; parameters: { properties: Record<string, unknown>; additionalProperties?: boolean } } }[]).find((t) => t.function.name === "create_sections")!;
  assert.equal(tool.function.parameters.additionalProperties, false);
  assert.ok(!JSON.stringify(first.tools).match(/instansId|userId/));

  // Rundtur: assistent tool_calls -> role:"tool" med resultatet pakket som DATA.
  const second = f.calls[1].body.messages;
  const assistant = second.find((m) => m.role === "assistant") as { tool_calls: { id: string; function: { name: string; arguments: string } }[] };
  assert.equal(assistant.tool_calls[0].id, "call_1");
  assert.deepEqual(JSON.parse(assistant.tool_calls[0].function.arguments), { navne: SIX });
  const toolMsg = second.find((m) => m.role === "tool") as { tool_call_id: string; content: string };
  assert.equal(toolMsg.tool_call_id, "call_1");
  assert.match(toolMsg.content, /^<hentet_indhold værktøj="create_sections" type="data-ikke-instruktioner">/);

  // Fortryd virker via den eksisterende vej.
  const undoId = (c.of("undo")[0] as { undoId: string }).undoId;
  const undone = await dispatch.applyUndo(ctxFor(editor), undoId);
  assert.ok(undone.ok);
  assert.equal((await cats()).length, 0);

  // Revisionsspor: udbyder (ikke indhold) på handlingen, og én tur-post med tal.
  const act = await db.auditLog.findFirst({ where: { instansId: inst, action: "ai-operator.create_sections" } });
  assert.equal((act!.detail as Record<string, unknown>).provider, "deepseek");
  const turnRow = await db.auditLog.findFirst({ where: { instansId: inst, action: "ai-operator.turn" }, orderBy: { createdAt: "desc" } });
  const d = turnRow!.detail as Record<string, unknown>;
  assert.equal(d.provider, "deepseek");
  assert.equal(d.toolCalls, 1);
  assert.ok(!JSON.stringify(d).match(/Nyheder|Opret/), "ingen indhold i tur-auditten");
});

test("ingen persondata forlader processen: indsendelser, brugere og brugerens navn/e-mail/telefon når aldrig 'DeepSeek'", async () => {
  await db.submission.create({
    data: { instansId: inst, navn: "Privat Pernille", kontakt: "pernille@privat.dk", emne: "Hul i vejen ved stationen", tekst: "Ring til mig på 12 34 56 78 eller skriv til pernille@privat.dk. Cpr 010190-1234.", status: "Ny" },
  });
  await createUser(inst, "Støtte"); // en anden bruger i instansen
  const { f, c } = await turn(
    [
      sseResponse(toolCallStream([{ id: "a", name: "list_inbox", args: "{}" }, { id: "b", name: "list_users", args: "{}" }])),
      sseResponse(textStream(["Der er én indsendelse."])),
    ],
    "Vis indbakken. Min kollega Anna Jensen kan nås på anna@firma.dk eller +45 20 30 40 50",
  );
  assert.equal(c.of("tool_result").length, 2);
  assert.ok(c.of("tool_result").every((r) => r.ok));
  const raw = sent(f);
  for (const leak of ["Privat Pernille", "Pernille", "pernille@", "12 34 56 78", "010190", "Testbruger", editor.email, "anna@firma.dk", "20 30 40 50"]) {
    assert.ok(!raw.includes(leak), `lækkede '${leak}'`);
  }
  // Men det nyttige er der: id, emne, status — og antal brugere.
  const toolContents = f.calls[1].body.messages.filter((m) => m.role === "tool").map((m) => String(m.content)).join("\n");
  assert.match(toolContents, /Hul i vejen ved stationen/);
  assert.match(toolContents, /"status":"Ny"/);
  assert.match(toolContents, /"rolle":"/);
  // Brugerens egne beskedtekst er maskeret, ikke fjernet.
  assert.match(String(f.calls[0].body.messages.at(-1)!.content), /Anna Jensen kan nås på \[e-mail-k[0-9a-f]{7}\] eller \[telefon-k[0-9a-f]{7}\]/);
  assert.match(String(f.calls[0].body.messages[0].content), /Bruger: redaktøren \(Ansvarshavende redaktør\)/);
  // Tur-auditten tæller det der blev maskeret/fjernet.
  const row = await db.auditLog.findFirst({ where: { instansId: inst, action: "ai-operator.turn" }, orderBy: { createdAt: "desc" } });
  const d = row!.detail as Record<string, number>;
  assert.equal(d.maskedEmails >= 1, true);
  assert.equal(d.maskedPhones >= 1, true);
  assert.equal(d.droppedFields >= 3, true);
});

test("historik fra tidligere ture genmaskeres, og tidligere assistenttekst med persondata sendes ikke", async () => {
  const { f } = await turn([sseResponse(textStream(["ok"]))], "Fortsæt", [
    { role: "user", content: "Husk bo@firma.dk" },
    { role: "assistant", content: "Jeg ringer til 12 34 56 78 og skriver til bo@firma.dk" },
  ]);
  const raw = sent(f);
  assert.ok(!raw.includes("bo@firma.dk") && !raw.includes("12 34 56 78"));
});

test("create_user: e-mail fra brugeren når værktøjet via pladsholder (modellen ser kun pladsholderen), bekræftelseskort viser den rigtige, Anvend/Fortryd/audit uændret", async () => {
  const email = "ny.kollega@redaktion.dk";
  const step1: FetchStep = (call) => {
    const last = String(call.body.messages.at(-1)!.content);
    const ph = /\[e-mail-k[0-9a-f]{7}\]/.exec(last)?.[0];
    assert.ok(ph, "modellen ser en pladsholder");
    return sseResponse(toolCallStream([{ id: "u1", name: "create_user", args: JSON.stringify({ navn: "Ny Kollega", email: ph, rolle: "Støtte" }) }]));
  };
  let ph = "";
  const step2: FetchStep = (call) => {
    ph = /\[e-mail-k[0-9a-f]{7}\]/.exec(sent(f1))?.[0] ?? "";
    // Svaret nævner pladsholderen, delt midt i, så streaming-gendannelsen afprøves.
    return sseResponse(textStream(["Kortet venter for ", ph.slice(0, 5), ph.slice(5), "."]));
  };
  const { f: f1, provider } = setup([step1, step2]);
  const c = collect();
  const ctx = ctxFor(editor);
  const result = await loop.runOperatorTurn({ client: provider.stream, providerId: "deepseek", minimiseData: true, ctx, history: [], message: `Opret brugeren Ny Kollega, e-mail ${email}, rolle Støtte`, emit: c.emit });

  const raw = sent(f1);
  assert.ok(!raw.includes(email), "e-mailen sendes aldrig");
  const card = c.of("confirm_required")[0];
  assert.ok(card, "bekræftelseskort");
  assert.ok(card.details.some((l) => l.includes(email)), "kortet (lokalt) viser den rigtige e-mail");
  assert.equal(await db.user.count({ where: { email } }), 0, "intet udført før Anvend");
  assert.ok(result.text.includes(`Kortet venter for ${email}.`), "svarteksten til brugeren får e-mailen tilbage");
  const toolResult = f1.calls[1].body.messages.find((m) => m.role === "tool") as { content: string };
  assert.match(toolResult.content, /afventer-bekræftelse/);

  const applied = await dispatch.applyConfirmed({ ...ctxFor(editor), provider: "deepseek" }, card.token);
  assert.ok(applied.ok && applied.result.ok);
  assert.equal(await db.user.count({ where: { email } }), 1);
  const audit = await db.auditLog.findFirst({ where: { instansId: inst, action: "ai-operator.create_user" } });
  const detail = audit!.detail as Record<string, unknown>;
  assert.equal(detail.provider, "deepseek");
  assert.equal(detail.mode, "confirmed");
  assert.ok(!JSON.stringify(detail).includes("adgangskode"));
});

test("modellen leverer ugyldig JSON i argumenter: intet udføres, modellen får en tydelig fejl og kan prøve igen", async () => {
  const { f, c, result } = await turn(
    [
      sseResponse(toolCallStream([{ id: "bad", name: "create_sections", args: '{"navne": ["Debat", ' }])),
      sseResponse(toolCallStream([{ id: "good", name: "create_sections", args: JSON.stringify({ navne: ["Debat"] }) }])),
      sseResponse(textStream(["Debat er oprettet."])),
    ],
    "Opret sektionen Debat",
  );
  assert.equal(f.calls.length, 3);
  const results = c.of("tool_result");
  assert.deepEqual(results.map((r) => r.ok), [false, true]);
  assert.match(String(f.calls[1].body.messages.find((m) => m.role === "tool")!.content), /^FEJL: Værktøjskaldet havde ugyldige argumenter/);
  assert.deepEqual((await cats()).map((r) => r.navn), ["Debat"]);
  assert.equal(result.failed, false);
  await db.category.deleteMany({ where: { instansId: inst } });
});

test("ukendt/blokeret værktøj fra DeepSeek afvises som før (publish_article udføres ikke)", async () => {
  const { c, f } = await turn([sseResponse(toolCallStream([{ id: "p", name: "publish_article", args: "{}" }])), sseResponse(textStream(["Det gør du selv."]))], "Publicér artiklen");
  assert.equal(c.of("tool_result")[0].ok, false);
  assert.match(String(f.calls[1].body.messages.find((m) => m.role === "tool")!.content), /kan ikke udføres via AI/);
});

test("udbyderfejl vises på dansk uden at lække noget: 402 (saldo), 401, 429 efter genforsøg, 500, og breaker åbner pr. udbyder", async () => {
  const cases: [number, RegExp][] = [
    [402, /mangler saldo/],
    [401, /afviste nøglen/],
    [429, /for mange forespørgsler/],
    [500, /fejl eller er overbelastet/],
  ];
  for (const [code, re] of cases) {
    getBreaker("operator:deepseek").reset();
    const { c, result } = await turn([status(code)], "Hej");
    const err = c.of("error")[0];
    assert.match(err.message, re, `status ${code}`);
    assert.ok(!err.message.includes(KEY));
    assert.equal(result.failed, true);
    assert.equal(c.of("done").length, 1, "turen afsluttes pænt");
  }
  assert.equal(getBreaker("anthropic").getState(), "closed");
  // Åben breaker -> venlig besked, ingen kald.
  const ds = getBreaker("operator:deepseek");
  for (let i = 0; i < 3; i++) ds.recordFailure(new Error("x"));
  const { c, f } = await turn([sseResponse(textStream(["x"]))], "Hej");
  assert.equal(f.calls.length, 0);
  assert.match(c.of("error")[0].message, /midlertidigt utilgængelig/);
});

test("tomt svar og content_filter håndteres uden hængende tur", async () => {
  const empty = await turn([sseResponse(textStream([]))], "Hej");
  assert.equal(empty.c.of("done").length, 1);
  const filtered = await turn([sseResponse(textStream(["delvis"], "content_filter"))], "Hej");
  assert.match(filtered.result.text, /indholdsfilter/);
});
