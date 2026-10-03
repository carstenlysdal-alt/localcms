/**
 * Valg af AI-udbyder for editor-AI, chat og forside-AI (operatøren har sin egen, jf. lib/operator/llm/select.ts).
 *
 *   <OPGAVE>_AI_PROVIDER=deepseek|anthropic   (EDITOR_AI_PROVIDER, CHAT_AI_PROVIDER, FRONTPAGE_AI_PROVIDER)  pr. opgave
 *   AI_PROVIDER=deepseek|anthropic            fælles valg for alle opgaver
 *   (ikke sat)                                 deepseek hvis DEEPSEEK_API_KEY er sat, ellers anthropic hvis ANTHROPIC_API_KEY er sat, ellers ingen AI
 *
 * Et eksplicit valg falder ALDRIG stille tilbage til den anden udbyder (data må ikke flyttes til en anden udbyder i det
 * skjulte, jf. ADR-007/ADR-017): mangler nøglen til den valgte udbyder, er AI slået fra for opgaven med en tydelig årsag.
 * Nøgler læses kun fra miljøvariabler (Railway); de gengives aldrig.
 */
export type AiTask = "editor" | "chat" | "frontpage";
export type AiProviderId = "anthropic" | "deepseek";

export const AI_TASKS: readonly AiTask[] = ["editor", "chat", "frontpage"];
export const TASK_ENV: Record<AiTask, string> = { editor: "EDITOR_AI_PROVIDER", chat: "CHAT_AI_PROVIDER", frontpage: "FRONTPAGE_AI_PROVIDER" };

/** Fælles, generisk fejltekst når der ingen AI-udbyder er (chat, forside, editor). Nævner kun variabelnavne. */
export const NO_AI_MESSAGE = "AI er ikke konfigureret (DEEPSEEK_API_KEY eller ANTHROPIC_API_KEY mangler)";

export type AiProviderSelection =
  | { ok: true; id: AiProviderId; source: "task" | "global" | "default-deepseek" | "default-anthropic" }
  | { ok: false; code: "none" | "missing-key" | "invalid"; message: string };

const set = (v: string | undefined) => Boolean(v && v.trim());

export function selectAiProvider(task: AiTask, env: NodeJS.ProcessEnv = process.env): AiProviderSelection {
  const taskVar = TASK_ENV[task];
  const fromTask = env[taskVar]?.trim().toLowerCase();
  const fromGlobal = env.AI_PROVIDER?.trim().toLowerCase();
  const explicit = fromTask || fromGlobal;
  if (explicit) {
    const varName = fromTask ? taskVar : "AI_PROVIDER";
    if (explicit !== "deepseek" && explicit !== "anthropic") {
      return { ok: false, code: "invalid", message: `AI er ikke konfigureret: ${varName} skal være 'deepseek' eller 'anthropic'.` };
    }
    const keyName = explicit === "deepseek" ? "DEEPSEEK_API_KEY" : "ANTHROPIC_API_KEY";
    if (!set(env[keyName])) {
      return { ok: false, code: "missing-key", message: `AI er sat til ${explicit} (${varName}), men ${keyName} mangler. Sæt nøglen i Railway, eller skift ${varName}.` };
    }
    return { ok: true, id: explicit, source: fromTask ? "task" : "global" };
  }
  if (set(env.DEEPSEEK_API_KEY)) return { ok: true, id: "deepseek", source: "default-deepseek" };
  if (set(env.ANTHROPIC_API_KEY)) return { ok: true, id: "anthropic", source: "default-anthropic" };
  return { ok: false, code: "none", message: `${NO_AI_MESSAGE}.` };
}

/** Brugervendt fejltekst for en mislykket udbydervalg: den generiske tekst når der slet ingen nøgle er, ellers den specifikke. */
export function noAiMessage(selection: Extract<AiProviderSelection, { ok: false }>): string {
  return selection.code === "none" ? `${NO_AI_MESSAGE}.` : selection.message;
}

/** Er der en brugbar AI-udbyder til opgaven? (til UI-flag og cron; opretter ingen klient) */
export function isAiConfigured(task: AiTask, env: NodeJS.ProcessEnv = process.env): boolean {
  return selectAiProvider(task, env).ok;
}

/** Navnet på den aktive udbyder (til audit/visning) eller null. */
export function activeAiProvider(task: AiTask, env: NodeJS.ProcessEnv = process.env): AiProviderId | null {
  const sel = selectAiProvider(task, env);
  return sel.ok ? sel.id : null;
}
