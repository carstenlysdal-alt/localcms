/**
 * Falsk DeepSeek-fetch til gateway-tests (ingen netværk): afspiller svar i rækkefølge og gemmer alle udgående kald, så
 * tests kan bevise præcis hvad der forlader processen. Selvstændig — afhænger ikke af operatørens tests/helpers/fake-deepseek.ts.
 */
export interface SentCall {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature: number;
    max_tokens: number;
    stream: boolean;
    response_format?: { type: string };
  };
  raw: string;
}

export type Step = Response | ((call: SentCall, signal: AbortSignal) => Response | Promise<Response>);
export type FakeFetch = typeof fetch & { calls: SentCall[] };

/** En ikke-streamet Chat Completions-respons med `content` som svartekst. */
export const completion = (content: string | null, extra: { usage?: { prompt_tokens: number; completion_tokens: number }; model?: string; finish?: string } = {}) =>
  new Response(
    JSON.stringify({
      id: "cmpl-1",
      model: extra.model ?? "deepseek-chat",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: extra.finish ?? "stop" }],
      usage: extra.usage ?? { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

export const jsonCompletion = (value: unknown) => completion(JSON.stringify(value));

export const failure = (status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { message: "intern fejltekst der aldrig må vises" } }), { status, headers: { "content-type": "application/json", ...headers } });

const enc = new TextEncoder();
const sse = (obj: unknown) => `data: ${typeof obj === "string" ? obj : JSON.stringify(obj)}\n\n`;

/** SSE-strøm med tekstdeltaer. `splitAt` deler den rå krop midt i en linje (som et rigtigt netværk). */
export function streamResponse(parts: string[], opts: { splitAt?: number[]; finish?: string | null; done?: boolean } = {}): Response {
  let body = sse({ model: "deepseek-chat", choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] });
  for (const p of parts) body += sse({ model: "deepseek-chat", choices: [{ index: 0, delta: { content: p }, finish_reason: null }] });
  if (opts.finish !== null) body += sse({ choices: [{ index: 0, delta: {}, finish_reason: opts.finish ?? "stop" }] });
  if (opts.done !== false) body += "data: [DONE]\n\n";
  const cuts = [0, ...(opts.splitAt ?? []).filter((n) => n > 0 && n < body.length).sort((a, b) => a - b), body.length];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < cuts.length - 1; i++) controller.enqueue(enc.encode(body.slice(cuts[i], cuts[i + 1])));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** Sender `first` og hænger så, til signalet afbrydes (så afviser læsningen, som en rigtig fetch). */
export function stalledStream(signal: AbortSignal, parts: string[] = []): Response {
  let body = "";
  for (const p of parts) body += sse({ choices: [{ index: 0, delta: { content: p }, finish_reason: null }] });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (body) controller.enqueue(enc.encode(body));
      signal.addEventListener("abort", () => controller.error(new DOMException("afbrudt", "AbortError")), { once: true });
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** fetch der afspiller trin i rækkefølge (sidste gentages). Gemmer alle kald. */
export function fakeFetch(steps: Step[]): FakeFetch {
  const calls: SentCall[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = String(init?.body ?? "");
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) headers[k.toLowerCase()] = v;
    const call: SentCall = { url: String(input), headers, body: JSON.parse(raw), raw };
    calls.push(call);
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    const signal = init?.signal ?? new AbortController().signal;
    if (typeof step === "function") return step(call, signal);
    return step.clone();
  }) as FakeFetch;
  fn.calls = calls;
  return fn;
}

/** fetch der aldrig svarer, men afviser ved abort. */
export const hangingFetch = (): FakeFetch =>
  fakeFetch([
    (_call, signal) =>
      new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("afbrudt", "AbortError")), { once: true });
      }),
  ]);

/** Gør et objekt til NodeJS.ProcessEnv uden at TypeScript kræver NODE_ENV m.fl. */
export const envOf = (o: Record<string, string | undefined>) => o as unknown as NodeJS.ProcessEnv;
