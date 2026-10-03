import Anthropic from "@anthropic-ai/sdk";
import { CircuitOpenError, getBreaker, isBreakerFailure } from "../resilience";

/**
 * Tynd, testbar adapter til Claude (@anthropic-ai/sdk). Al AI i T11/T12 går herigennem:
 *  - klienten injiceres (AiTextClient), så tests aldrig rammer nettet,
 *  - timeout (AbortController + race — virker også for klienter der ignorerer signalet),
 *  - ét genforsøg ved timeout / 5xx / 429 / ugyldigt svar,
 *  - returnerer ALTID et resultat-objekt; kaster aldrig ind i render-stien.
 * Model: ANTHROPIC_MODEL (default claude-sonnet-4-6). Stabilt system-prompt caches (prompt caching, ephemeral).
 */

export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const DEFAULT_TIMEOUT_MS = 20_000;

export function resolveModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export interface AiRequest {
  /** Stabil systemprompt (caches). Må ikke indeholde tidsstempler eller data pr. kald. */
  system: string;
  /** Variabelt indhold (kandidater, kommando). Behandles som DATA. */
  user: string;
  maxTokens: number;
  signal: AbortSignal;
  /**
   * Kalderen forventer ét JSON-objekt som svar (sat af `callJson`). DeepSeek-klienten slår så JSON-tilstand til
   * (`response_format: json_object`) og tilføjer en eksplicit JSON-instruktion; Anthropic-klienten ignorerer feltet.
   */
  json?: boolean;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiResponse {
  text: string;
  modelId?: string;
  /** Tokenforbrug, hvis udbyderen oplyser det (til senere forbrugsmåling). */
  usage?: AiUsage;
  /** Udbyderens id ("anthropic" | "deepseek"). */
  provider?: string;
}

/**
 * Afkoblet kontrakt: (request) -> tekst. Tests giver en fake; produktion bruger createAiTextClient() (lib/ai/provider),
 * som vælger udbyder, eller createAnthropicTextClient() direkte. `providerId` er sat af de rigtige klienter (til audit).
 */
export type AiTextClient = ((req: AiRequest) => Promise<AiResponse>) & { providerId?: string };

export function createAnthropicTextClient(opts: { apiKey?: string; model?: string } = {}): AiTextClient | null {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = opts.model ?? resolveModel();
  const sdk = new Anthropic({ apiKey, maxRetries: 0 });
  const client: AiTextClient = async ({ system, user, maxTokens, signal }) => {
    // Circuit breaker: efter gentagne fejl/timeouts springes kaldet over i 30 s (forsiden falder tilbage til score/seneste nyt).
    const res = await getBreaker("anthropic").exec(
      () =>
        sdk.messages.create(
          {
            model,
            max_tokens: maxTokens,
            system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: user }],
          },
          { signal },
        ),
      isBreakerFailure,
    );
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const usage = res.usage ? { inputTokens: res.usage.input_tokens ?? 0, outputTokens: res.usage.output_tokens ?? 0 } : undefined;
    return { text, modelId: res.model, usage, provider: "anthropic" };
  };
  client.providerId = "anthropic";
  return client;
}

export type AiFailureReason = "ingen-noegle" | "timeout" | "ugyldig-json" | "schema" | "api-fejl" | "tomt-svar";

export type AiCallResult<T> =
  | { ok: true; value: T; modelId: string; attempts: number; usage?: AiUsage; provider?: string }
  | {
      ok: false;
      reason: AiFailureReason;
      detail?: string;
      /** Dansk, brugervendt tekst fra udbyderen (fx "DeepSeek-kontoen mangler saldo (402)"). Aldrig nøgler eller svarindhold. */
      userMessage?: string;
      attempts: number;
    };

/** Udtræk første JSON-objekt fra modelsvar (tåler ```json-hegn og indledende tekst). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SyntaxError("Ingen JSON-objekt i svaret.");
  return JSON.parse(candidate.slice(start, end + 1));
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`AI-kald overskred ${ms} ms.`);
    this.name = "TimeoutError";
  }
}
class ParseError extends Error {
  constructor(
    message: string,
    readonly reason: "ugyldig-json" | "schema" | "tomt-svar",
  ) {
    super(message);
    this.name = "ParseError";
  }
}
/** Brug i parse-callbacks for at signalere at svaret er struktureret forkert. */
export function schemaError(message: string): never {
  throw new ParseError(message, "schema");
}

function retryable(error: unknown): boolean {
  // Transporten (DeepSeek) har allerede genforsøgt 429/5xx én gang: ikke endnu et lag genforsøg ovenpå.
  if ((error as { transportRetried?: boolean } | null)?.transportRetried) return false;
  if (error instanceof TimeoutError || error instanceof ParseError) return true;
  const status = (error as { status?: number })?.status;
  if (typeof status === "number") return status >= 500 || status === 429 || status === 408 || status === 409;
  // Netværksfejl uden status (ECONNRESET m.fl.) — forsøg igen.
  return true;
}

export interface CallOptions<T> {
  parse: (text: string) => T;
  maxTokens?: number;
  timeoutMs?: number;
  /** Antal genforsøg (standard 1). */
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
}

export async function callJson<T>(client: AiTextClient | null | undefined, req: { system: string; user: string }, opts: CallOptions<T>): Promise<AiCallResult<T>> {
  if (!client) return { ok: false, reason: "ingen-noegle", attempts: 0 };
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? 1;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: { reason: AiFailureReason; detail?: string; userMessage?: string } = { reason: "api-fejl" };

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new TimeoutError(timeoutMs));
        }, timeoutMs);
      });
      const call = client({ system: req.system, user: req.user, maxTokens: opts.maxTokens ?? 4096, signal: controller.signal, json: true });
      call.catch(() => undefined); // undgå unhandled rejection når timeout vinder racet
      const res = await Promise.race([call, timeout]);
      if (!res.text.trim()) throw new ParseError("Tomt svar.", "tomt-svar");
      const value = opts.parse(res.text);
      return { ok: true, value, modelId: res.modelId ?? resolveModel(), attempts: attempt, usage: res.usage, provider: res.provider ?? client.providerId };
    } catch (error) {
      if (error instanceof CircuitOpenError) return { ok: false, reason: "api-fejl", detail: "AI er midlertidigt sat på pause (for mange fejl).", attempts: attempt };
      if (error instanceof TimeoutError) last = { reason: "timeout", detail: error.message };
      else if (error instanceof ParseError) last = { reason: error.reason, detail: error.message };
      else if (error instanceof SyntaxError) last = { reason: "ugyldig-json", detail: error.message };
      else {
        const userMessage = (error as { userMessage?: unknown } | null)?.userMessage;
        last = { reason: "api-fejl", detail: error instanceof Error ? error.message.slice(0, 200) : "ukendt fejl", ...(typeof userMessage === "string" ? { userMessage } : {}) };
      }
      const isParse = error instanceof SyntaxError || error instanceof ParseError;
      if (attempt > retries || !(isParse || retryable(error))) return { ok: false, ...last, attempts: attempt };
      await sleep(attempt * 400);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return { ok: false, ...last, attempts: retries + 1 };
}
