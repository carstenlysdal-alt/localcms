import { createAnthropicTextClient, type AiTextClient } from "../../frontpage/ai-client";
import { createDeepseekTextClient, resolveDeepseekTextBaseUrl, resolveDeepseekTextModel } from "./deepseek-text";
import { selectAiProvider, type AiTask } from "./select";

/**
 * Fælles AI-gateway: ÉN indgang til tekst-AI for editor, chat og forside (operatøren har sin egen i lib/operator/llm).
 *
 *   createAiTextClient({ task: "editor" | "chat" | "frontpage" }) -> AiTextClient | null
 *
 * Returnerer samme `AiTextClient`-signatur som før, så ranker, NL-kommandoer og editor-AI kun skifter klientoprettelse.
 * Udbyder: <OPGAVE>_AI_PROVIDER, ellers AI_PROVIDER, ellers deepseek hvis DEEPSEEK_API_KEY, ellers anthropic hvis
 * ANTHROPIC_API_KEY, ellers null (AI slået fra). Se select.ts. `hooks` er test-hooks (ingen netværk).
 */
export function createAiTextClient(
  opts: { task: AiTask },
  hooks: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; timeoutMs?: number } = {},
): AiTextClient | null {
  const env = hooks.env ?? process.env;
  const sel = selectAiProvider(opts.task, env);
  if (!sel.ok) return null;
  if (sel.id === "deepseek") {
    return createDeepseekTextClient({
      apiKey: env.DEEPSEEK_API_KEY!.trim(),
      model: resolveDeepseekTextModel(env),
      baseUrl: resolveDeepseekTextBaseUrl(env),
      fetchImpl: hooks.fetchImpl,
      sleep: hooks.sleep,
      timeoutMs: hooks.timeoutMs,
    });
  }
  return createAnthropicTextClient({ apiKey: env.ANTHROPIC_API_KEY!.trim() });
}

export { selectAiProvider, isAiConfigured, activeAiProvider, noAiMessage, NO_AI_MESSAGE, AI_TASKS, TASK_ENV } from "./select";
export type { AiTask, AiProviderId, AiProviderSelection } from "./select";
