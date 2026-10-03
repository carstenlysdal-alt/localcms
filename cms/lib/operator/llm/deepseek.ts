import { CircuitOpenError, getBreaker, isBreakerFailure } from "../../resilience";
import { errorFromStatus, LlmError } from "./errors";
import { maskPiiText } from "../redact";
import type { LlmProvider, ModelContentBlock, ModelMessage, ModelRequest, ModelResponse, ModelToolResultBlock } from "./types";

/**
 * DeepSeek-adapter (OpenAI-kompatibel Chat Completions med function calling), kun via fetch — ingen ny afhængighed.
 * POST ${DEEPSEEK_BASE_URL ?? https://api.deepseek.com}/chat/completions, model DEEPSEEK_MODEL ?? deepseek-chat.
 *
 * Persondata maskeres FØR kaldet af loopet (redact.ts); adapteren har desuden en sidste, tilstandsløs maske over alt
 * udgående tekst, så intet kan slippe forbi hvis adapteren bruges direkte.
 */
export const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";
export const DEEPSEEK_TEMPERATURE = 0.2;
const MAX_TOKENS_FLOOR = 256;
const MAX_TOKENS_CEILING = 8192;
const BREAKER_NAME = "operator:deepseek";

/** Indstillinger til createDeepseekProvider (nøglen læses af kalderen fra miljøet, aldrig fra DB). */
export interface DeepseekOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  /** Test-hooks (ingen netværk): */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Tid til svarhoved (connectMs), mellem to dele af strømmen (idleMs) og i alt (totalMs). */
  timeouts?: { connectMs?: number; idleMs?: number; totalMs?: number };
}

/** DEEPSEEK_MODEL eller "deepseek-chat". */
export function resolveDeepseekModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.DEEPSEEK_MODEL?.trim() || DEEPSEEK_DEFAULT_MODEL;
}

/** DEEPSEEK_BASE_URL eller https://api.deepseek.com (uden afsluttende skråstreg). */
export function resolveDeepseekBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_DEFAULT_BASE_URL).replace(/\/+$/, "");
}

// ── Oversættelse til/fra OpenAI-formatet ───────────────────────────────────

interface OaiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
type OaiMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OaiToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

function isResult(block: ModelContentBlock | ModelToolResultBlock): block is ModelToolResultBlock {
  return block.type === "tool_result";
}

/**
 * Oversætter systemblokke + neutrale beskeder til OpenAI-formatet (assistent tool_calls, role:"tool"-resultater).
 * `filter` anvendes på al udgående tekst (fx maskPiiText).
 */
export function toOpenAiMessages(system: ModelRequest["system"], messages: ModelMessage[], filter: (s: string) => string = (s) => s): OaiMessage[] {
  const out: OaiMessage[] = [];
  const systemText = system.map((s) => s.text).filter(Boolean).join("\n\n");
  if (systemText) out.push({ role: "system", content: filter(systemText) });
  for (const message of messages) {
    if (typeof message.content === "string") {
      out.push({ role: message.role, content: filter(message.content) } as OaiMessage);
      continue;
    }
    if (message.role === "assistant") {
      const text = message.content.filter((b): b is Extract<ModelContentBlock, { type: "text" }> => b.type === "text").map((b) => b.text).join("");
      const calls = message.content.filter((b): b is Extract<ModelContentBlock, { type: "tool_use" }> => b.type === "tool_use");
      const entry: Extract<OaiMessage, { role: "assistant" }> = { role: "assistant", content: text ? filter(text) : null };
      if (calls.length) {
        entry.tool_calls = calls.map((c) => ({
          id: c.id,
          type: "function" as const,
          // Ugyldige argumenter sendes ikke tilbage (udbyderen kan afvise ugyldig JSON i historikken): resultatet fortæller fejlen.
          function: { name: c.name || "ukendt", arguments: filter(c.invalidArguments !== undefined ? "{}" : JSON.stringify(c.input ?? {})) },
        }));
      }
      out.push(entry);
      continue;
    }
    // Bruger-tur med værktøjsresultater: ét role:"tool"-svar pr. kald, så evt. tekst bagefter.
    const texts: string[] = [];
    for (const block of message.content) {
      if (isResult(block)) out.push({ role: "tool", tool_call_id: block.tool_use_id, content: filter(block.is_error ? `FEJL: ${block.content}` : block.content) });
      else if (block.type === "text") texts.push(block.text);
    }
    if (texts.length) out.push({ role: "user", content: filter(texts.join("\n")) });
  }
  return out;
}

/** Neutrale værktøjsskemaer -> OpenAI `tools` (function calling). */
export function toOpenAiTools(tools: ModelRequest["tools"]) {
  return tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.input_schema } }));
}

/** Parser modellens argumenter: tom -> {}, ```json-hegn og dobbelt-kodet JSON tåles; alt andet er ugyldigt. */
export function parseToolArguments(raw: string): { ok: true; value: Record<string, unknown> } | { ok: false; raw: string } {
  let text = raw.trim();
  if (!text) return { ok: true, value: {} };
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fenced) text = fenced[1].trim();
  for (let i = 0; i < 2; i++) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === "string") {
        text = parsed.trim();
        if (!text) return { ok: true, value: {} };
        continue;
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { ok: true, value: parsed as Record<string, unknown> };
      break;
    } catch {
      break;
    }
  }
  return { ok: false, raw: raw.slice(0, 200) };
}

interface PartialCall {
  id: string;
  name: string;
  args: string;
}

/** Samler en (streamet eller samlet) Chat Completions-respons: tekst, værktøjskald fra `tool_calls`-deltaer og finish_reason. */
export class CompletionAccumulator {
  text = "";
  finish: string | null = null;
  modelId: string | undefined;
  private readonly calls = new Map<number, PartialCall>();
  private lastIndex = -1;

  constructor(private readonly onText?: (delta: string) => void) {}

  get hasToolCalls() {
    return this.calls.size > 0;
  }

  push(chunk: unknown): void {
    if (!chunk || typeof chunk !== "object") return;
    const obj = chunk as Record<string, unknown>;
    if (obj.error) throw new LlmError("deepseek", "server", "DeepSeek sendte en fejl midt i svaret. Prøv igen om lidt.");
    if (typeof obj.model === "string") this.modelId = obj.model;
    const choice = Array.isArray(obj.choices) ? (obj.choices[0] as Record<string, unknown> | undefined) : undefined;
    if (!choice) return;
    // Streamet: delta. Ikke-streamet: message.
    const delta = (choice.delta ?? choice.message) as Record<string, unknown> | undefined;
    if (delta) {
      if (typeof delta.content === "string" && delta.content) {
        this.text += delta.content;
        this.onText?.(delta.content);
      }
      // reasoning_content (deepseek-reasoner) bruges ikke og videregives aldrig.
      if (Array.isArray(delta.tool_calls)) for (const tc of delta.tool_calls) this.pushToolCall(tc as Record<string, unknown>);
    }
    if (typeof choice.finish_reason === "string") this.finish = choice.finish_reason;
  }

  private pushToolCall(tc: Record<string, unknown>) {
    const fn = (tc.function ?? {}) as Record<string, unknown>;
    const id = typeof tc.id === "string" ? tc.id : "";
    let index: number;
    if (typeof tc.index === "number" && Number.isInteger(tc.index) && tc.index >= 0) index = tc.index;
    else if (id && !this.hasId(id)) index = this.calls.size;
    else index = Math.max(this.lastIndex, 0);
    this.lastIndex = index;
    const cur = this.calls.get(index) ?? { id: "", name: "", args: "" };
    if (id && !cur.id) cur.id = id;
    if (typeof fn.name === "string" && fn.name && !cur.name) cur.name = fn.name;
    if (typeof fn.arguments === "string") cur.args += fn.arguments;
    this.calls.set(index, cur);
  }

  private hasId(id: string) {
    for (const c of this.calls.values()) if (c.id === id) return true;
    return false;
  }

  toResponse(): ModelResponse {
    const content: ModelContentBlock[] = [];
    if (this.text) content.push({ type: "text", text: this.text });
    const used = new Set<string>();
    let n = 0;
    for (const [, call] of [...this.calls.entries()].sort((a, b) => a[0] - b[0])) {
      n += 1;
      let id = call.id || `call_${n}`;
      while (used.has(id)) id = `${id}_${n}`;
      used.add(id);
      const parsed = parseToolArguments(call.args);
      const block: Extract<ModelContentBlock, { type: "tool_use" }> = { type: "tool_use", id, name: call.name.trim() || "ukendt", input: parsed.ok ? parsed.value : {} };
      if (!parsed.ok) block.invalidArguments = parsed.raw;
      content.push(block);
    }
    const reason = this.finish;
    if (reason === "insufficient_system_resource") throw errorFromStatus("deepseek", 503);
    let stopReason: ModelResponse["stopReason"] = "end_turn";
    if (reason === "length") stopReason = "max_tokens";
    else if (reason === "content_filter") stopReason = "content_filter";
    else if (reason === "tool_calls" || (this.calls.size > 0 && (reason === "stop" || reason === null))) stopReason = "tool_use";
    return { content, stopReason, modelId: this.modelId };
  }
}

/** Læser en SSE-strøm linje for linje; kalder onData pr. `data:`-linje. Returnerer true hvis `[DONE]` blev set. */
export async function readSse(body: ReadableStream<Uint8Array>, onData: (data: string) => void, onActivity: () => void): Promise<boolean> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  const handleLine = (raw: string) => {
    const line = raw.replace(/\r$/, "");
    if (!line.startsWith("data:")) return; // kommentarer (": keep-alive") og andre felter ignoreres
    const data = line.slice(5).trim();
    if (!data) return;
    if (data === "[DONE]") done = true;
    else onData(data);
  };
  try {
    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      onActivity();
      buffer += decoder.decode(value, { stream: true });
      let at: number;
      while ((at = buffer.indexOf("\n")) >= 0) {
        handleLine(buffer.slice(0, at));
        buffer = buffer.slice(at + 1);
      }
      if (buffer.length > 2_000_000) throw new LlmError("deepseek", "invalid_response", "DeepSeek sendte et ugyldigt svar. Prøv igen.");
    }
    buffer += decoder.decode();
    if (buffer) handleLine(buffer);
  } finally {
    reader.releaseLock?.();
  }
  return done;
}

// ── Adapteren ──────────────────────────────────────────────────────────────

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Opretter DeepSeek-udbyderen (OpenAI-kompatibel Chat Completions). `fetchImpl`/`sleep`/`timeouts` er test-hooks. */
export function createDeepseekProvider(opts: DeepseekOptions): LlmProvider {
  const model = opts.model?.trim() || DEEPSEEK_DEFAULT_MODEL;
  const baseUrl = (opts.baseUrl?.trim() || DEEPSEEK_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const connectMs = opts.timeouts?.connectMs ?? 25_000;
  const idleMs = opts.timeouts?.idleMs ?? 20_000;
  const totalMs = opts.timeouts?.totalMs ?? 55_000;
  const temperature = opts.temperature ?? DEEPSEEK_TEMPERATURE;

  async function once(req: ModelRequest, state: { emitted: boolean }): Promise<ModelResponse> {
    const body = {
      model,
      messages: toOpenAiMessages(req.system, req.messages, maskPiiText),
      temperature,
      max_tokens: Math.min(MAX_TOKENS_CEILING, Math.max(MAX_TOKENS_FLOOR, Math.floor(req.maxTokens))),
      stream: true,
      ...(req.tools.length ? { tools: toOpenAiTools(req.tools), tool_choice: "auto" } : {}),
    };

    const controller = new AbortController();
    let reason: "caller" | "connect" | "idle" | "total" | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const arm = (ms: number, why: "connect" | "idle") => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        reason = why;
        controller.abort();
      }, ms);
    };
    const onCaller = () => {
      reason = "caller";
      controller.abort();
    };
    if (req.signal.aborted) throw new LlmError("deepseek", "aborted", "Afbrudt.");
    req.signal.addEventListener("abort", onCaller, { once: true });
    const totalTimer = setTimeout(() => {
      reason = "total";
      controller.abort();
    }, totalMs);
    arm(connectMs, "connect");

    const fail = (error: unknown): never => {
      if (error instanceof LlmError) throw error;
      if (reason === "caller") throw new LlmError("deepseek", "aborted", "Afbrudt.");
      if (reason) throw new LlmError("deepseek", "timeout", "DeepSeek svarede ikke i tide. Prøv igen om lidt.");
      throw new LlmError("deepseek", "network", "Kunne ikke få forbindelse til DeepSeek. Prøv igen om lidt.");
    };

    try {
      let res: Response;
      try {
        res = await doFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: `Bearer ${opts.apiKey}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        return fail(error);
      }
      if (!res.ok) {
        // Fire-and-forget: afvent ikke annulleringen (en delt/tee'et krop kan ellers hænge).
        void res.body?.cancel().catch(() => undefined);
        const err = errorFromStatus("deepseek", res.status);
        const retryAfter = Number(res.headers?.get?.("retry-after"));
        (err as LlmError & { retryAfterMs?: number }).retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(2_000, retryAfter * 1000) : undefined;
        throw err;
      }

      const acc = new CompletionAccumulator((delta) => {
        state.emitted = true;
        req.onTextDelta?.(delta);
      });
      try {
        const contentType = res.headers?.get?.("content-type") ?? "";
        if (/application\/json/i.test(contentType) || !res.body) {
          // Ikke-streamet svar (fx fra en proxy): samme parser.
          acc.push(JSON.parse(await res.text()));
          if (acc.finish === null) acc.finish = "stop";
        } else {
          arm(idleMs, "idle");
          const sawDone = await readSse(
            res.body,
            (data) => {
              let json: unknown;
              try {
                json = JSON.parse(data);
              } catch {
                return; // en beskadiget linje: spring over (afsluttes af finish_reason/[DONE])
              }
              acc.push(json);
            },
            () => arm(idleMs, "idle"),
          );
          if (acc.finish === null && !sawDone) throw new LlmError("deepseek", "network", "Forbindelsen til DeepSeek blev afbrudt midt i svaret. Prøv igen.");
        }
      } catch (error) {
        return fail(error);
      }
      return acc.toResponse();
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
      clearTimeout(totalTimer);
      req.signal.removeEventListener("abort", onCaller);
    }
  }

  async function stream(req: ModelRequest): Promise<ModelResponse> {
    const breaker = getBreaker(BREAKER_NAME);
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (!breaker.tryAcquire()) throw new CircuitOpenError(BREAKER_NAME);
      const state = { emitted: false };
      try {
        const response = await once(req, state);
        breaker.recordSuccess();
        return response;
      } catch (error) {
        if (!req.signal.aborted && isBreakerFailure(error)) breaker.recordFailure(error);
        else breaker.recordSuccess();
        // Kun 429 og 5xx genforsøges, højst én gang, og kun hvis intet er streamet til brugeren endnu.
        const status = (error as { status?: number } | null)?.status;
        const retry = attempt === 1 && !state.emitted && !req.signal.aborted && typeof status === "number" && (status === 429 || status >= 500);
        if (!retry) throw error;
        await sleep((error as { retryAfterMs?: number }).retryAfterMs ?? 600);
        if (req.signal.aborted) throw new LlmError("deepseek", "aborted", "Afbrudt.");
      }
    }
    throw new LlmError("deepseek", "server", "DeepSeek svarede ikke. Prøv igen om lidt.");
  }

  return {
    id: "deepseek",
    label: "DeepSeek",
    model,
    minimiseData: true,
    stream,
    complete: (req) => stream({ ...req, onTextDelta: undefined }),
  };
}
