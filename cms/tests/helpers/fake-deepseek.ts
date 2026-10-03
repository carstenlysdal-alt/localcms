import type { ModelRequest } from "../../lib/operator/llm/types";

/**
 * Falsk DeepSeek (ingen netværk): bygger SSE-strømme i OpenAI-formatet og en `fetch` der afspiller dem.
 * Alle forespørgsler gemmes (url, headers, parsed body), så tests kan bevise hvad der forlader processen.
 */
export interface RecordedCall {
  url: string;
  headers: Record<string, string>;
  body: { model: string; messages: Array<Record<string, unknown>>; tools?: unknown[]; tool_choice?: string; temperature: number; max_tokens: number; stream: boolean };
  raw: string;
}

const enc = new TextEncoder();

/** Én SSE-linje. */
export const data = (obj: unknown) => `data: ${typeof obj === "string" ? obj : JSON.stringify(obj)}\n\n`;
export const DONE = "data: [DONE]\n\n";

export const delta = (d: Record<string, unknown>, finish: string | null = null) => data({ id: "c1", model: "deepseek-chat", choices: [{ index: 0, delta: d, finish_reason: finish }] });

/** Tekststrøm: ét delta pr. del, så afslutning. */
export function textStream(parts: string[], finish = "stop"): string {
  return delta({ role: "assistant", content: "" }) + parts.map((p) => delta({ content: p })).join("") + delta({}, finish) + DONE;
}

export interface FakeCall {
  id?: string;
  name: string;
  args: string;
}

/** Værktøjskald-strøm: id+navn i første chunk, argumenterne delt i bidder af `chunk` tegn (kan dele midt i JSON). */
export function toolCallStream(calls: FakeCall[], opts: { chunk?: number; text?: string; finish?: string | null } = {}): string {
  const chunk = opts.chunk ?? 7;
  let out = delta({ role: "assistant", content: opts.text ?? null });
  const pieces: string[][] = calls.map((c) => {
    const parts: string[] = [];
    for (let i = 0; i < c.args.length; i += chunk) parts.push(c.args.slice(i, i + chunk));
    return parts.length ? parts : [""];
  });
  // Første chunk pr. kald: id, type, navn og tom argumentstreng (som DeepSeek/OpenAI).
  calls.forEach((c, index) => {
    out += delta({ tool_calls: [{ index, id: c.id ?? `call_${index}`, type: "function", function: { name: c.name, arguments: "" } }] });
  });
  const max = Math.max(...pieces.map((p) => p.length));
  for (let i = 0; i < max; i++) {
    pieces.forEach((p, index) => {
      if (i < p.length) out += delta({ tool_calls: [{ index, function: { arguments: p[i] } }] });
    });
  }
  return out + delta({}, opts.finish === undefined ? "tool_calls" : opts.finish) + DONE;
}

/** Response med en SSE-krop delt ved de angivne tegnpositioner (tester at linjer kan deles midt i en chunk). */
export function sseResponse(body: string, splitAt: number[] = [], init: ResponseInit = {}): Response {
  const cuts = [0, ...splitAt.filter((n) => n > 0 && n < body.length).sort((a, b) => a - b), body.length];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < cuts.length - 1; i++) controller.enqueue(enc.encode(body.slice(cuts[i], cuts[i + 1])));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" }, ...init });
}

export const status = (code: number, headers: Record<string, string> = {}) => new Response(JSON.stringify({ error: { message: "nej" } }), { status: code, headers: { "content-type": "application/json", ...headers } });

/** En strøm der sender `first` og derefter hænger, til signalet afbrydes. */
export function stalledResponse(signal: AbortSignal, first = ""): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (first) controller.enqueue(enc.encode(first));
      signal.addEventListener("abort", () => controller.error(new DOMException("afbrudt", "AbortError")), { once: true });
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

export type FetchStep = Response | ((call: RecordedCall, signal: AbortSignal) => Response | Promise<Response>);

/** fetch der afspiller trin i rækkefølge (sidste gentages). Gemmer alle kald. */
export function fakeFetch(steps: FetchStep[]): typeof fetch & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = String(init?.body ?? "");
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) headers[k.toLowerCase()] = v;
    const call: RecordedCall = { url: String(input), headers, body: JSON.parse(raw), raw };
    calls.push(call);
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    const signal = init?.signal ?? new AbortController().signal;
    if (typeof step === "function") return step(call, signal);
    // En Response kan kun læses én gang: klon, så sidste trin kan gentages.
    return step.clone();
  }) as typeof fetch & { calls: RecordedCall[] };
  fn.calls = calls;
  return fn;
}

/** fetch der aldrig svarer, men afviser ved abort (som den rigtige). */
export const hangingFetch = (): typeof fetch & { calls: RecordedCall[] } =>
  fakeFetch([
    (_call, signal) =>
      new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("afbrudt", "AbortError")), { once: true });
      }),
  ]);

export const request = (over: Partial<ModelRequest> = {}): ModelRequest => ({
  system: [{ text: "SYSTEMPROMPT", cache: true }, { text: "KONTEKST" }],
  messages: [{ role: "user", content: "Hej" }],
  tools: [],
  maxTokens: 1500,
  signal: new AbortController().signal,
  ...over,
});

export const SECTION_TOOL = {
  name: "create_sections",
  description: "Opretter sektioner.",
  input_schema: { type: "object" as const, properties: { navne: { type: "array", items: { type: "string" } } }, required: ["navne"], additionalProperties: false },
};
