import type { ModelRequest, ModelResponse, OperatorModelClient } from "../../lib/operator/model";

/** Falsk model-klient (ingen netværk): afspiller en manuskript-liste og gemmer alle forespørgsler. */
export type Step = ModelResponse | ((req: ModelRequest, call: number) => ModelResponse | Promise<ModelResponse>);

export function scripted(steps: Step[]): OperatorModelClient & { calls: ModelRequest[] } {
  const calls: ModelRequest[] = [];
  const fn = (async (req: ModelRequest) => {
    calls.push(JSON.parse(JSON.stringify({ ...req, signal: undefined, onTextDelta: undefined })) as ModelRequest);
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    const res = typeof step === "function" ? await step(req, calls.length) : step;
    for (const block of res.content) if (block.type === "text") req.onTextDelta?.(block.text);
    return res;
  }) as OperatorModelClient & { calls: ModelRequest[] };
  fn.calls = calls;
  return fn;
}

let n = 0;
export const toolUse = (name: string, input: unknown, id = `tu_${++n}`): ModelResponse => ({ content: [{ type: "tool_use", id, name, input }], stopReason: "tool_use" });
export const toolUses = (...uses: [string, unknown][]): ModelResponse => ({ content: uses.map(([name, input]) => ({ type: "tool_use" as const, id: `tu_${++n}`, name, input })), stopReason: "tool_use" });
export const say = (text: string): ModelResponse => ({ content: [{ type: "text", text }], stopReason: "end_turn" });
