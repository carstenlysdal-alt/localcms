import { createAiTextClient } from "../ai/provider";
import { createOperatorProvider, describeOperatorProvider } from "./llm/select";
import { providerInfo, type LlmProvider, type OperatorModelClient, type ProviderId, type ProviderInfo } from "./llm/types";
import type { ToolDeps } from "./types";

/**
 * Indgang for rutehandlerne til model og afhængigheder. Tests kan erstatte klienterne (ingen netværk);
 * i produktion vælges udbyderen af OPERATOR_PROVIDER / DEEPSEEK_API_KEY / ANTHROPIC_API_KEY (se llm/select.ts).
 * Rutefiler må ikke eksportere andet end HTTP-handlere, så injektionspunktet ligger her.
 */
let override: { client?: OperatorModelClient | null; provider?: ProviderId; providerObject?: LlmProvider | null; deps?: ToolDeps } | null = null;

export function setOperatorRuntimeForTests(next: { client?: OperatorModelClient | null; provider?: ProviderId; providerObject?: LlmProvider | null; deps?: ToolDeps } | null) {
  override = next;
}

export type ProviderResolution = { ok: true; provider: LlmProvider } | { ok: false; status: 503; message: string };

/** Den aktive udbyder, eller en dansk 503-besked der nævner begge nøgle-variabler. */
export function resolveOperatorProvider(): ProviderResolution {
  if (override && override.providerObject !== undefined) {
    return override.providerObject ? { ok: true, provider: override.providerObject } : { ok: false, status: 503, message: "AI-operatøren er ikke konfigureret: sæt DEEPSEEK_API_KEY eller ANTHROPIC_API_KEY som variabel i Railway." };
  }
  if (override && override.client !== undefined) {
    const client = override.client;
    if (!client) return { ok: false, status: 503, message: "AI-operatøren er ikke konfigureret: sæt DEEPSEEK_API_KEY eller ANTHROPIC_API_KEY som variabel i Railway." };
    const id = override.provider ?? "anthropic";
    return { ok: true, provider: { id, label: id === "deepseek" ? "DeepSeek" : "Claude (Anthropic)", model: "test", minimiseData: id === "deepseek", stream: client, complete: (req) => client({ ...req, onTextDelta: undefined }) } };
  }
  const created = createOperatorProvider();
  return created.ok ? created : { ok: false, status: 503, message: created.message };
}

/** Til UI og hjælp: hvilken udbyder er aktiv (eller null). Ingen nøgler. */
export function getOperatorProviderInfo(): ProviderInfo | null {
  if (override && (override.providerObject !== undefined || override.client !== undefined)) {
    const res = resolveOperatorProvider();
    return res.ok ? providerInfo(res.provider) : null;
  }
  return describeOperatorProvider();
}

export function getToolDeps(): ToolDeps {
  if (override?.deps) return override.deps;
  return { frontpageClient: createAiTextClient({ task: "frontpage" }) };
}
