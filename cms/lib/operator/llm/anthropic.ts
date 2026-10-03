import Anthropic from "@anthropic-ai/sdk";
import { resolveModel } from "../../frontpage/ai-client";
import { CircuitOpenError, getBreaker, isBreakerFailure } from "../../resilience";
import type { LlmProvider, ModelContentBlock, ModelRequest, OperatorModelClient } from "./types";

function retryable(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (typeof status === "number") return status >= 500 || status === 429 || status === 408 || status === 409;
  return error instanceof Error && !/abort/i.test(error.name);
}

/**
 * Anthropic-adapter (uændret adfærd): SDK-streaming, cache_control på den stabile systemblok, ét genforsøg før tekst er
 * streamet, og den DELTE breaker "anthropic" (samme upstream som forsiden og chatten).
 */
export function createAnthropicOperatorClient(opts: { apiKey?: string; model?: string } = {}): OperatorModelClient | null {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = opts.model ?? resolveModel();
  const sdk = new Anthropic({ apiKey, maxRetries: 0 });
  return async (req: ModelRequest) => {
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

export function createAnthropicProvider(opts: { apiKey?: string; model?: string } = {}): LlmProvider | null {
  const model = opts.model ?? resolveModel();
  const client = createAnthropicOperatorClient({ ...opts, model });
  if (!client) return null;
  return {
    id: "anthropic",
    label: "Claude (Anthropic)",
    model,
    minimiseData: false,
    stream: client,
    complete: (req) => client({ ...req, onTextDelta: undefined }),
  };
}
