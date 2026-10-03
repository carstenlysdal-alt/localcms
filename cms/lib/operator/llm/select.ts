import { resolveModel } from "../../frontpage/ai-client";
import { createAnthropicProvider } from "./anthropic";
import { createDeepseekProvider, resolveDeepseekBaseUrl, resolveDeepseekModel } from "./deepseek";
import type { LlmProvider, ProviderId, ProviderInfo } from "./types";

/**
 * Valg af modeludbyder for AI-operatøren (kun operatøren; forside-ranker, editor-AI og chat bruger fortsat Anthropic).
 *
 *   OPERATOR_PROVIDER=deepseek|anthropic   eksplicit valg
 *   (ikke sat)                              deepseek hvis DEEPSEEK_API_KEY er sat, ellers anthropic hvis ANTHROPIC_API_KEY er sat
 *
 * Et eksplicit valg falder ALDRIG stille tilbage til den anden udbyder (dataene må ikke flyttes til en anden udbyder i det
 * skjulte, jf. ADR-007): mangler nøglen til den valgte udbyder, svarer operatøren 503 med en tydelig besked.
 * Nøgler læses kun fra miljøvariabler (Railway); de gengives aldrig.
 */
export type ProviderSelection =
  | { ok: true; id: ProviderId; source: "explicit" | "default-deepseek" | "default-anthropic" }
  | { ok: false; code: "none" | "missing-key" | "invalid"; message: string };

const set = (v: string | undefined) => Boolean(v && v.trim());

export const NO_PROVIDER_MESSAGE = "AI-operatøren er ikke konfigureret: sæt DEEPSEEK_API_KEY eller ANTHROPIC_API_KEY (og evt. OPERATOR_PROVIDER=deepseek|anthropic) som variabel i Railway.";

export function selectProvider(env: NodeJS.ProcessEnv = process.env): ProviderSelection {
  const explicit = env.OPERATOR_PROVIDER?.trim().toLowerCase();
  if (explicit) {
    if (explicit !== "deepseek" && explicit !== "anthropic") {
      return { ok: false, code: "invalid", message: "AI-operatøren er ikke konfigureret: OPERATOR_PROVIDER skal være 'deepseek' eller 'anthropic'." };
    }
    const keyName = explicit === "deepseek" ? "DEEPSEEK_API_KEY" : "ANTHROPIC_API_KEY";
    if (!set(env[keyName])) {
      return { ok: false, code: "missing-key", message: `AI-operatøren er sat til ${explicit} (OPERATOR_PROVIDER), men ${keyName} mangler. Sæt nøglen i Railway, eller skift OPERATOR_PROVIDER (DEEPSEEK_API_KEY eller ANTHROPIC_API_KEY).` };
    }
    return { ok: true, id: explicit, source: "explicit" };
  }
  if (set(env.DEEPSEEK_API_KEY)) return { ok: true, id: "deepseek", source: "default-deepseek" };
  if (set(env.ANTHROPIC_API_KEY)) return { ok: true, id: "anthropic", source: "default-anthropic" };
  return { ok: false, code: "none", message: NO_PROVIDER_MESSAGE };
}

/** Opretter udbyderen ud fra miljøet. Test-hook: `fetchImpl` gør DeepSeek-udbyderen netværksfri. */
export function createOperatorProvider(env: NodeJS.ProcessEnv = process.env, hooks: { fetchImpl?: typeof fetch } = {}): { ok: true; provider: LlmProvider } | { ok: false; message: string } {
  const sel = selectProvider(env);
  if (!sel.ok) return { ok: false, message: sel.message };
  if (sel.id === "deepseek") {
    return { ok: true, provider: createDeepseekProvider({ apiKey: env.DEEPSEEK_API_KEY!.trim(), model: resolveDeepseekModel(env), baseUrl: resolveDeepseekBaseUrl(env), fetchImpl: hooks.fetchImpl }) };
  }
  const provider = createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY!.trim() });
  return provider ? { ok: true, provider } : { ok: false, message: sel.source === "explicit" ? "ANTHROPIC_API_KEY mangler." : "AI-operatøren kunne ikke startes." };
}

/** Let beskrivelse af den valgte udbyder (uden at oprette klienter): bruges af UI og hjælp. */
export function describeOperatorProvider(env: NodeJS.ProcessEnv = process.env): ProviderInfo | null {
  const sel = selectProvider(env);
  if (!sel.ok) return null;
  return sel.id === "deepseek"
    ? { id: "deepseek", label: "DeepSeek", model: resolveDeepseekModel(env), minimiseData: true }
    : { id: "anthropic", label: "Claude (Anthropic)", model: resolveModel(), minimiseData: false };
}
