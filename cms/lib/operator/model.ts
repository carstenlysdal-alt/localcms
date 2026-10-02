import Anthropic from "@anthropic-ai/sdk";
import { resolveModel } from "../frontpage/ai-client";
import { CircuitOpenError, getBreaker, isBreakerFailure } from "../resilience";
import type { AnthropicToolSchema } from "./registry";

/** Afkoblet model-kontrakt: tests giver en falsk klient (ingen netværk); produktion bruger createAnthropicOperatorClient(). */
export type ModelContentBlock = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };
export type ModelToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type ModelMessage = { role: "user" | "assistant"; content: string | (ModelContentBlock | ModelToolResultBlock)[] };

export interface ModelRequest {
  system: { text: string; cache?: boolean }[];
  messages: ModelMessage[];
  tools: AnthropicToolSchema[];
  maxTokens: number;
  signal: AbortSignal;
  onTextDelta?: (delta: string) => void;
}

export interface ModelResponse {
  content: ModelContentBlock[];
  stopReason: string;
  modelId?: string;
}

export type OperatorModelClient = (req: ModelRequest) => Promise<ModelResponse>;

function retryable(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (typeof status === "number") return status >= 500 || status === 429 || status === 408 || status === 409;
  return error instanceof Error && !/abort/i.test(error.name);
}

export function createAnthropicOperatorClient(opts: { apiKey?: string; model?: string } = {}): OperatorModelClient | null {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = opts.model ?? resolveModel();
  const sdk = new Anthropic({ apiKey, maxRetries: 0 });
  return async (req) => {
    const breaker = getBreaker("anthropic");
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (!breaker.tryAcquire()) throw new CircuitOpenError("anthropic");
      let streamed = false;
      try {
        const stream = sdk.messages.stream(
          {
            model,
            max_tokens: req.maxTokens,
            system: req.system.map((s) => ({ type: "text" as const, text: s.text, ...(s.cache ? { cache_control: { type: "ephemeral" as const } } : {}) })),
            messages: req.messages as unknown as Anthropic.MessageParam[],
            tools: req.tools as unknown as Anthropic.Tool[],
          },
          { signal: req.signal },
        );
        stream.on("text", (delta) => {
          streamed = true;
          req.onTextDelta?.(delta);
        });
        const final = await stream.finalMessage();
        breaker.recordSuccess();
        const content: ModelContentBlock[] = [];
        for (const block of final.content) {
          if (block.type === "text") content.push({ type: "text", text: block.text });
          else if (block.type === "tool_use") content.push({ type: "tool_use", id: block.id, name: block.name, input: block.input });
        }
        return { content, stopReason: final.stop_reason ?? "end_turn", modelId: final.model };
      } catch (error) {
        if (!req.signal.aborted && isBreakerFailure(error)) breaker.recordFailure(error);
        else breaker.recordSuccess();
        if (attempt === 2 || streamed || req.signal.aborted || !retryable(error)) throw error;
      }
    }
    throw new Error("Modelkald mislykkedes.");
  };
}
