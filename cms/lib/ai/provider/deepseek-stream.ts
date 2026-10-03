import { CircuitOpenError, getBreaker, isBreakerFailure } from "../../resilience";
import { errorFromStatus, LlmError } from "../../operator/llm/errors";
import { PiiVault } from "../../operator/redact";
import { clampMaxTokens, DEEPSEEK_DEFAULT_BASE, DEEPSEEK_DEFAULT_MODEL_ID, DEEPSEEK_TEXT_BREAKER, DEEPSEEK_TEXT_TEMPERATURE } from "./deepseek-text";

/**
 * DeepSeek-streaming til chatten (/api/chat): chat completions med `stream: true`, parset som SSE til rene tekstbidder.
 * Samme dataminimering som teksttransporten: system + historik maskeres med PiiVault før kaldet, og pladsholdere
 * gendannes lokalt i de streamede bidder (også når en pladsholder deles over to bidder). Breaker `ai:deepseek`.
 *
 * `openDeepseekChatStream` forbinder og kontrollerer HTTP-status FØR noget streames (så ruten kan svare 429/502/503 med
 * dansk tekst) og genforsøger ét gang ved 429/5xx. Selve strømmen er en AsyncGenerator af tekst.
 */
export interface DeepseekChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface DeepseekStreamOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  system: string;
  messages: DeepseekChatTurn[];
  maxTokens: number;
  /** Klientens afbrydelse (req.signal). */
  signal: AbortSignal;
  temperature?: number;
  /** Tid til svarhoved, mellem to dele af strømmen og i alt. */
  timeouts?: { connectMs?: number; idleMs?: number; totalMs?: number };
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface DeepseekChatStream {
  chunks: AsyncGenerator<string, void, void>;
  /** Afbryder forbindelsen (idempotent). */
  abort(): void;
  model: string;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function* sseData(body: ReadableStream<Uint8Array>, onActivity: () => void): AsyncGenerator<string, boolean, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      onActivity();
      buffer += decoder.decode(value, { stream: true });
      let at: number;
      while ((at = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, at).replace(/\r$/, "");
        buffer = buffer.slice(at + 1);
        if (!line.startsWith("data:")) continue; // ": keep-alive" og andre felter ignoreres
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === "[DONE]") return true;
        yield data;
      }
      if (buffer.length > 2_000_000) throw new LlmError("deepseek", "invalid_response", "DeepSeek sendte et ugyldigt svar. Prøv igen.");
    }
    buffer += decoder.decode();
    const last = buffer.replace(/\r$/, "");
    if (last.startsWith("data:")) {
      const data = last.slice(5).trim();
      if (data === "[DONE]") return true;
      if (data) yield data;
    }
    return false;
  } finally {
    try {
      reader.releaseLock?.();
    } catch {
      /* ignorer */
    }
  }
}

export async function openDeepseekChatStream(opts: DeepseekStreamOptions): Promise<DeepseekChatStream> {
  const model = opts.model?.trim() || DEEPSEEK_DEFAULT_MODEL_ID;
  const url = `${(opts.baseUrl?.trim() || DEEPSEEK_DEFAULT_BASE).replace(/\/+$/, "")}/chat/completions`;
  const sleep = opts.sleep ?? defaultSleep;
  const connectMs = opts.timeouts?.connectMs ?? 30_000;
  const idleMs = opts.timeouts?.idleMs ?? 30_000;
  const totalMs = opts.timeouts?.totalMs ?? 90_000;

  const vault = new PiiVault();
  const body = JSON.stringify({
    model,
    messages: [{ role: "system", content: vault.mask(opts.system) }, ...opts.messages.map((m) => ({ role: m.role, content: vault.mask(m.content) }))],
    temperature: opts.temperature ?? DEEPSEEK_TEXT_TEMPERATURE,
    max_tokens: clampMaxTokens(opts.maxTokens),
    stream: true,
  });

  if (opts.signal.aborted) throw new LlmError("deepseek", "aborted", "Afbrudt.");
  const breaker = getBreaker(DEEPSEEK_TEXT_BREAKER);
  const controller = new AbortController();
  let reason: "caller" | "connect" | "idle" | "total" | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const totalTimer = setTimeout(() => {
    reason = "total";
    controller.abort();
  }, totalMs);
  let settled = false;
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
  const cleanup = () => {
    if (idleTimer) clearTimeout(idleTimer);
    clearTimeout(totalTimer);
    opts.signal.removeEventListener("abort", onCaller);
  };
  /** Frigiver breakeren præcis én gang pr. åbnet strøm. */
  const settle = (error?: unknown) => {
    if (settled) return;
    settled = true;
    if (error !== undefined && !opts.signal.aborted && isBreakerFailure(error)) breaker.recordFailure(error);
    else breaker.recordSuccess();
  };
  const fail = (error: unknown): never => {
    if (error instanceof LlmError) throw error;
    if (reason === "caller") throw new LlmError("deepseek", "aborted", "Afbrudt.");
    if (reason) throw new LlmError("deepseek", "timeout", "DeepSeek svarede ikke i tide. Prøv igen om lidt.");
    throw new LlmError("deepseek", "network", "Kunne ikke få forbindelse til DeepSeek. Prøv igen om lidt.");
  };

  opts.signal.addEventListener("abort", onCaller, { once: true });

  let res: Response | null = null;
  try {
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (!breaker.tryAcquire()) throw new CircuitOpenError(DEEPSEEK_TEXT_BREAKER);
      arm(connectMs, "connect");
      try {
        let r: Response;
        try {
          const doFetch = opts.fetchImpl ?? globalThis.fetch;
          r = await doFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: `Bearer ${opts.apiKey}` },
            body,
            signal: controller.signal,
          });
        } catch (error) {
          return fail(error);
        }
        if (!r.ok) {
          void Promise.resolve(r.body?.cancel()).catch(() => undefined); // afventes ikke: frigiver forbindelsen uden at risikere at hænge
          const err = errorFromStatus("deepseek", r.status);
          const retryAfter = Number(r.headers?.get?.("retry-after"));
          (err as LlmError & { retryAfterMs?: number }).retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(2_000, retryAfter * 1000) : undefined;
          throw err;
        }
        res = r;
        break;
      } catch (error) {
        if (!opts.signal.aborted && isBreakerFailure(error)) breaker.recordFailure(error);
        else breaker.recordSuccess();
        const status = (error as { status?: number } | null)?.status;
        const retry = attempt === 1 && !opts.signal.aborted && typeof status === "number" && (status === 429 || status >= 500);
        if (!retry) throw error;
        await sleep((error as { retryAfterMs?: number }).retryAfterMs ?? 600);
        if (opts.signal.aborted) throw new LlmError("deepseek", "aborted", "Afbrudt.");
      }
    }
  } catch (error) {
    cleanup();
    throw error;
  }
  if (!res) {
    cleanup();
    throw new LlmError("deepseek", "server", "DeepSeek svarede ikke. Prøv igen om lidt.");
  }
  const response = res;

  async function* chunks(): AsyncGenerator<string, void, void> {
    const queue: string[] = [];
    const restorer = vault.restorer((t) => queue.push(t));
    const flushQueue = function* () {
      while (queue.length) yield queue.shift() as string;
    };
    let finish: string | null = null;
    const handle = (json: unknown) => {
      const obj = (json ?? {}) as { error?: unknown; choices?: Array<{ delta?: { content?: unknown }; message?: { content?: unknown }; finish_reason?: unknown }> };
      if (obj.error) throw new LlmError("deepseek", "server", "DeepSeek sendte en fejl midt i svaret. Prøv igen om lidt.");
      const choice = obj.choices?.[0];
      if (!choice) return;
      const content = choice.delta?.content ?? choice.message?.content;
      if (typeof content === "string" && content) restorer.push(content);
      if (typeof choice.finish_reason === "string") finish = choice.finish_reason;
    };
    try {
      const contentType = response.headers?.get?.("content-type") ?? "";
      if (/application\/json/i.test(contentType) || !response.body) {
        // Ikke-streamet svar (fx fra en proxy): samme felter.
        try {
          handle(JSON.parse(await response.text()));
        } catch (error) {
          if (error instanceof LlmError) throw error;
          if (reason) return fail(error);
          throw new LlmError("deepseek", "invalid_response", "DeepSeek sendte et ugyldigt svar. Prøv igen.");
        }
        finish ??= "stop";
        restorer.flush();
        yield* flushQueue();
      } else {
        arm(idleMs, "idle");
        const iterator = sseData(response.body, () => arm(idleMs, "idle"));
        let sawDone = false;
        try {
          for (;;) {
            const next = await iterator.next();
            if (next.done) {
              sawDone = next.value === true;
              break;
            }
            let json: unknown;
            try {
              json = JSON.parse(next.value);
            } catch {
              continue; // en beskadiget linje springes over
            }
            handle(json);
            yield* flushQueue();
          }
        } catch (error) {
          return fail(error);
        }
        restorer.flush();
        yield* flushQueue();
        if (finish === null && !sawDone) throw new LlmError("deepseek", "network", "Forbindelsen til DeepSeek blev afbrudt midt i svaret. Prøv igen.");
      }
      settle();
    } catch (error) {
      settle(error);
      throw error;
    } finally {
      settle(); // fx forbruger stoppede tidligt (return()): frigiv et evt. prøvekald
      cleanup();
    }
  }

  return {
    model,
    chunks: chunks(),
    abort: () => {
      if (!reason) reason = "caller";
      controller.abort();
      settle();
      cleanup();
    },
  };
}
