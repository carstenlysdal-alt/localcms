import { CircuitOpenError, getBreaker, isBreakerFailure } from "../../resilience";
import type { AiRequest, AiResponse, AiTextClient } from "../../frontpage/ai-client";
import { errorFromStatus, LlmError } from "../../operator/llm/errors";
import { PiiVault } from "../../operator/redact";

/**
 * DeepSeek som teksttransport for editor-AI, forside-AI og andre `AiTextClient`-kald (samme signatur som den
 * Anthropic-baserede klient). Ren `fetch` mod ${DEEPSEEK_BASE_URL ?? https://api.deepseek.com}/chat/completions.
 *
 *  - JSON-tilstand (`response_format: json_object`) når kalderen beder om JSON (`req.json`, sat af callJson), samt en
 *    eksplicit JSON-instruktion i brugerbeskeden (DeepSeek kræver ordet "JSON" i prompten).
 *  - Persondata: ALT udgående indhold (system + bruger) maskeres med PiiVault før kaldet (e-mail/telefon -> pladsholdere,
 *    CPR/IBAN/nøgler fjernes); pladsholdere gendannes lokalt i det returnerede svar. Se ADR-017.
 *  - Timeouts (kalderens signal + egen samlet timeout), ét genforsøg ved 429/5xx, breaker `ai:deepseek`, danske fejltekster.
 *  - `usage` (tokens) læses og returneres.
 */
export const DEEPSEEK_TEXT_BREAKER = "ai:deepseek";
export const DEEPSEEK_TEXT_TEMPERATURE = 0.2;
export const DEEPSEEK_DEFAULT_BASE = "https://api.deepseek.com";
export const DEEPSEEK_DEFAULT_MODEL_ID = "deepseek-chat";
/** Tilføjes til brugerbeskeden i JSON-tilstand (kun DeepSeek). */
export const DEEPSEEK_JSON_SUFFIX = "\n\nSvar kun med gyldig JSON (ét JSON-objekt), uden markdown og uden tekst uden for JSON.";

const MAX_TOKENS_FLOOR = 256;
const MAX_TOKENS_CEILING = 8192;

export interface DeepseekTextOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  /** Samlet tid pr. forsøg (ud over kalderens signal). Standard 60 s. */
  timeoutMs?: number;
  /** Test-hooks (ingen netværk): */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function resolveDeepseekTextModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.DEEPSEEK_MODEL?.trim() || DEEPSEEK_DEFAULT_MODEL_ID;
}

export function resolveDeepseekTextBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_DEFAULT_BASE).replace(/\/+$/, "");
}

export const clampMaxTokens = (n: number) => Math.min(MAX_TOKENS_CEILING, Math.max(MAX_TOKENS_FLOOR, Math.floor(Number.isFinite(n) ? n : 1024)));

/** Maskerer udgående tekst og returnerer chat-beskeder + vault til gendannelse. Delt af text- og stream-transporten. */
export function maskedMessages(system: string, user: string, json: boolean) {
  const vault = new PiiVault();
  const messages = [
    { role: "system" as const, content: vault.mask(system) },
    { role: "user" as const, content: vault.mask(user) + (json ? DEEPSEEK_JSON_SUFFIX : "") },
  ];
  return { vault, messages };
}

/** Sætter `retry-after` (højst 2 s) på fejlen, så genforsøget kan vente. */
function withRetryAfter(error: LlmError, res: Response): LlmError {
  const retryAfter = Number(res.headers?.get?.("retry-after"));
  (error as LlmError & { retryAfterMs?: number }).retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(2_000, retryAfter * 1000) : undefined;
  return error;
}

export function createDeepseekTextClient(opts: DeepseekTextOptions): AiTextClient {
  const model = opts.model?.trim() || DEEPSEEK_DEFAULT_MODEL_ID;
  const url = `${(opts.baseUrl?.trim() || DEEPSEEK_DEFAULT_BASE).replace(/\/+$/, "")}/chat/completions`;
  const sleep = opts.sleep ?? defaultSleep;
  const totalMs = opts.timeoutMs ?? 60_000;
  const temperature = opts.temperature ?? DEEPSEEK_TEXT_TEMPERATURE;

  async function once(body: string, signal: AbortSignal, vault: PiiVault): Promise<AiResponse> {
    const controller = new AbortController();
    let reason: "caller" | "timeout" | null = null;
    const onCaller = () => {
      reason = "caller";
      controller.abort();
    };
    if (signal.aborted) throw new LlmError("deepseek", "aborted", "Afbrudt.");
    signal.addEventListener("abort", onCaller, { once: true });
    const timer = setTimeout(() => {
      reason = "timeout";
      controller.abort();
    }, totalMs);
    const fail = (error: unknown): never => {
      if (error instanceof LlmError) throw error;
      if (reason === "caller") throw new LlmError("deepseek", "aborted", "Afbrudt.");
      if (reason === "timeout") throw new LlmError("deepseek", "timeout", "DeepSeek svarede ikke i tide. Prøv igen om lidt.");
      throw new LlmError("deepseek", "network", "Kunne ikke få forbindelse til DeepSeek. Prøv igen om lidt.");
    };
    try {
      let res: Response;
      try {
        const doFetch = opts.fetchImpl ?? globalThis.fetch;
        res = await doFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${opts.apiKey}` },
          body,
          signal: controller.signal,
        });
      } catch (error) {
        return fail(error);
      }
      if (!res.ok) {
        void Promise.resolve(res.body?.cancel()).catch(() => undefined); // afventes ikke: frigiver forbindelsen uden at risikere at hænge
        throw withRetryAfter(errorFromStatus("deepseek", res.status), res);
      }
      let json: unknown;
      try {
        json = JSON.parse(await res.text());
      } catch (error) {
        if (reason) return fail(error);
        throw new LlmError("deepseek", "invalid_response", "DeepSeek sendte et ugyldigt svar. Prøv igen.");
      }
      const obj = (json ?? {}) as { model?: unknown; choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }; error?: unknown };
      if (obj.error) throw new LlmError("deepseek", "server", "DeepSeek sendte en fejl. Prøv igen om lidt.");
      const content = obj.choices?.[0]?.message?.content;
      const text = typeof content === "string" ? vault.restore(content) : "";
      const usage = obj.usage ? { inputTokens: Number(obj.usage.prompt_tokens) || 0, outputTokens: Number(obj.usage.completion_tokens) || 0 } : undefined;
      return { text, modelId: typeof obj.model === "string" ? obj.model : model, usage, provider: "deepseek" };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onCaller);
    }
  }

  const client: AiTextClient = async (req: AiRequest) => {
    const { vault, messages } = maskedMessages(req.system, req.user, Boolean(req.json));
    const body = JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: clampMaxTokens(req.maxTokens),
      stream: false,
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
    });
    const breaker = getBreaker(DEEPSEEK_TEXT_BREAKER);
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (!breaker.tryAcquire()) throw new CircuitOpenError(DEEPSEEK_TEXT_BREAKER);
      try {
        const response = await once(body, req.signal, vault);
        breaker.recordSuccess();
        return response;
      } catch (error) {
        // Kalderens timeout (callJson afbryder signalet) tæller som fejl; 4xx (undtagen 408/429) gør ikke.
        if (isBreakerFailure(error)) breaker.recordFailure(error);
        else breaker.recordSuccess();
        const status = (error as { status?: number } | null)?.status;
        const transient = typeof status === "number" && (status === 429 || status >= 500);
        if (transient && attempt === 2) (error as { transportRetried?: boolean }).transportRetried = true;
        if (!(transient && attempt === 1) || req.signal.aborted) throw error;
        await sleep((error as { retryAfterMs?: number }).retryAfterMs ?? 600);
        if (req.signal.aborted) throw new LlmError("deepseek", "aborted", "Afbrudt.");
      }
    }
    throw new LlmError("deepseek", "server", "DeepSeek svarede ikke. Prøv igen om lidt.");
  };
  client.providerId = "deepseek";
  return client;
}
