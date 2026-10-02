import { createAnthropicTextClient } from "../frontpage/ai-client";
import { createAnthropicOperatorClient, type OperatorModelClient } from "./model";
import type { ToolDeps } from "./types";

/**
 * Indgang for rutehandlerne til model og afhængigheder. Tests kan erstatte klienterne (ingen netværk);
 * i produktion bruges ANTHROPIC_API_KEY / ANTHROPIC_MODEL. Rutefiler må ikke eksportere andet end HTTP-handlere,
 * så injektionspunktet ligger her.
 */
let override: { client?: OperatorModelClient | null; deps?: ToolDeps } | null = null;

export function setOperatorRuntimeForTests(next: { client?: OperatorModelClient | null; deps?: ToolDeps } | null) {
  override = next;
}

export function getOperatorClient(): OperatorModelClient | null {
  if (override && override.client !== undefined) return override.client;
  return createAnthropicOperatorClient();
}

export function getToolDeps(): ToolDeps {
  if (override?.deps) return override.deps;
  return { frontpageClient: createAnthropicTextClient() };
}
