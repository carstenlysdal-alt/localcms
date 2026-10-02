import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { createNdjsonParser, encodeEvent, operatorEventSchema, type OperatorEvent } from "../lib/operator/events";
import { initialState, plainTranscript, reduce, type State } from "../components/operator/reducer";
import { Markdown, parseBlocks } from "../components/operator/markdown";
import { readEventStream } from "../components/operator/stream";
import { collectTranscript, getSpeechRecognition, mergeDictation, speechErrorMessage, SPEECH_UNSUPPORTED } from "../components/operator/speech";

const apply = (state: State, ...events: OperatorEvent[]) => events.reduce((s, event) => reduce(s, { type: "event", event }), state);

test("NDJSON-parser: delte chunks, tomme/ugyldige linjer og afsluttende linje uden linjeskift", () => {
  const p = createNdjsonParser();
  const line = encodeEvent({ type: "text", delta: "hej æøå" });
  const out = [...p.push(line.slice(0, 9)), ...p.push(line.slice(9) + "\n\n{ikke json}\n" + JSON.stringify({ type: "ukendt" }) + "\n"), ...p.push(JSON.stringify({ type: "done", promptVersion: "v", toolCalls: 0 })), ...p.flush()];
  assert.deepEqual(out.map((e) => e.type), ["text", "done"]);
  assert.equal((out[0] as { delta: string }).delta, "hej æøå");
  assert.equal(p.invalidCount, 2);
  assert.equal(operatorEventSchema.safeParse({ type: "confirm_required", token: "kort", tool: "x", summary: "s", details: [], risk: "confirm", expiresAt: "x" }).success, false);
});

test("readEventStream: læser en ReadableStream i vilkårlige bidder (også midt i et tegn)", async () => {
  const bytes = new TextEncoder().encode(encodeEvent({ type: "text", delta: "blå ø" }) + encodeEvent({ type: "done", promptVersion: "v", toolCalls: 1 }));
  const body = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < bytes.length; i += 5) c.enqueue(bytes.slice(i, i + 5)); c.close(); } });
  const got: OperatorEvent[] = [];
  const res = await readEventStream(body, (e) => got.push(e));
  assert.deepEqual(got.map((e) => e.type), ["text", "done"]);
  assert.equal((got[0] as { delta: string }).delta, "blå ø");
  assert.equal(res.invalid, 0);
});

test("reducer: tekst streames ind i ét svar; værktøjskald, resultat, bekræftelse, fortryd og færdig", () => {
  let s = reduce(initialState, { type: "send", text: "Opret sektionen Sport" });
  assert.equal(s.streaming, true);
  s = apply(s, { type: "text", delta: "Jeg " }, { type: "text", delta: "opretter." });
  assert.equal(s.items.filter((i) => i.kind === "assistant").length, 1);
  s = apply(s, { type: "tool_call", id: "t1", name: "create_sections", summary: "Opretter Sport" });
  assert.equal(s.items.find((i) => i.kind === "assistant" && i.streaming), undefined, "svaret afsluttes når et værktøj kaldes");
  s = apply(s, { type: "tool_result", id: "t1", name: "create_sections", ok: true, summary: "Oprettede sektionen Sport" }, { type: "undo", undoId: "u1abcdef", label: "Fortryd" }, { type: "text", delta: "Færdig." }, { type: "done", promptVersion: "v", toolCalls: 1 });
  assert.equal(s.streaming, false);
  const kinds = s.items.map((i) => i.kind);
  assert.deepEqual(kinds, ["user", "assistant", "tool", "undo", "assistant"]);
  assert.equal(s.items[2].kind === "tool" && s.items[2].status, "ok");
  assert.equal(plainTranscript(s.items), "Jeg opretter.\n\nFærdig.");

  s = apply(s, { type: "confirm_required", token: "opc_" + "a".repeat(40), tool: "delete_section", summary: "Sletter Sport", details: ["x"], risk: "confirm", expiresAt: new Date().toISOString() });
  const token = "opc_" + "a".repeat(40);
  s = reduce(s, { type: "confirm_start", token });
  assert.equal(s.items.at(-1)?.kind === "confirm" && s.items.at(-1)!.kind === "confirm" && (s.items.at(-1) as { status: string }).status, "applying");
  s = reduce(s, { type: "confirm_done", token, status: "applied", message: "Slettet", secret: { label: "Kode", value: "abc" }, undo: { undoId: "u2abcdef", label: "Fortryd 2" } });
  const card = s.items.find((i) => i.kind === "confirm");
  assert.ok(card && card.kind === "confirm" && card.secret?.value === "abc");
  assert.equal(s.items.at(-1)?.kind, "undo");
  s = reduce(s, { type: "dismiss_secret", token });
  assert.equal((s.items.find((i) => i.kind === "confirm") as { secret: unknown }).secret, null);
  s = reduce(s, { type: "undo_start", undoId: "u1abcdef" });
  s = reduce(s, { type: "undo_done", undoId: "u1abcdef", ok: true, message: "Fjernet" });
  const u = s.items.find((i) => i.kind === "undo" && i.undoId === "u1abcdef");
  assert.equal(u && u.kind === "undo" && u.status, "done");
});

test("reducer: fejl giver Prøv igen uden dublet, afbrudt stream lukker åbne værktøjer, annullering", () => {
  let s = reduce(initialState, { type: "send", text: "hej" });
  s = reduce(s, { type: "fail", message: "Netværksfejl" });
  assert.equal(s.streaming, false);
  assert.equal(s.items.find((i) => i.kind === "user" && i.status === "error") !== undefined, true);
  const err = s.items.find((i) => i.kind === "error");
  assert.ok(err && err.kind === "error" && err.retryText === "hej");
  s = reduce(s, { type: "send", text: "hej", retry: true });
  assert.equal(s.items.filter((i) => i.kind === "user").length, 1, "genforsøg erstatter den mislykkede besked");
  assert.equal(s.items.some((i) => i.kind === "error"), false);
  s = apply(s, { type: "tool_call", id: "t9", name: "x", summary: "arbejder" });
  s = reduce(s, { type: "abort" });
  assert.equal(s.streaming, false);
  assert.equal(s.items.find((i) => i.kind === "tool")?.kind === "tool" && (s.items.find((i) => i.kind === "tool") as { status: string }).status, "error");
  s = apply(reduce(s, { type: "send", text: "igen" }), { type: "error", message: "Modellen svarede ikke" });
  assert.equal(s.items.at(-1)?.kind, "error");
  assert.equal(s.streaming, false);
});

test("markdown: sikker rendering (ingen HTML, farlige links droppes), ufærdig kodeblok midt i stream", () => {
  const html = renderToStaticMarkup(createElement(Markdown, { text: "Hej **fed** og `kode`\n\n- et\n- to\n\n[ok](https://x.dk) [ondt](javascript:alert(1)) <script>alert(1)</script>" }));
  assert.match(html, /<strong>fed<\/strong>/);
  assert.match(html, /<li>et<\/li>/);
  assert.match(html, /href="https:\/\/x\.dk" target="_blank" rel="noopener noreferrer"/);
  assert.ok(!/href="javascript/.test(html));
  assert.ok(!html.includes("<script>"), "rå HTML escapes");
  const open = parseBlocks("Her er kode:\n```ts\nconst a = 1;\n");
  assert.deepEqual(open.map((b) => b.type), ["p", "code"]);
  assert.match(renderToStaticMarkup(createElement(Markdown, { text: "```\nlinje\n" })), /<pre[^>]*><code>linje<\/code><\/pre>/);
});

test("tale: browser-understøttelse, fejltekster på dansk, transskription og sammenlægning", () => {
  assert.equal(getSpeechRecognition(undefined), null);
  assert.equal(getSpeechRecognition({}), null);
  class Fake {}
  assert.equal(getSpeechRecognition({ webkitSpeechRecognition: Fake as never }), Fake);
  assert.match(SPEECH_UNSUPPORTED, /understøttes ikke/);
  assert.match(speechErrorMessage("not-allowed"), /Mikrofonen er blokeret/);
  assert.match(speechErrorMessage("no-speech"), /ikke noget/);
  assert.equal(speechErrorMessage("aborted"), "");
  const res = [Object.assign([{ transcript: "opret sektionen " }], { isFinal: true }), Object.assign([{ transcript: "sport" }], { isFinal: false })];
  assert.deepEqual(collectTranscript(res), { final: "opret sektionen", interim: "sport" });
  assert.equal(mergeDictation("Hej", "opret sport"), "Hej opret sport");
  assert.equal(mergeDictation("", "opret sport"), "opret sport");
  assert.equal(mergeDictation("Hej ", ""), "Hej ");
});
