import { normalizeHistory, type ChatTurn } from "../chat";
import { CircuitOpenError, TimeoutError, withTimeout } from "../resilience";
import { cleanText } from "../validation/text";
import { dispatchTool } from "./dispatch";
import { auditOperatorTurn } from "./audit";
import type { OperatorEvent } from "./events";
import { isLlmError } from "./llm/errors";
import type { ModelContentBlock, ModelMessage, ModelToolResultBlock, OperatorModelClient, ProviderId } from "./llm/types";
import { MAX_MODEL_TOKENS, MAX_TOOL_CALLS_PER_TURN, TURN_TIMEOUT_MS } from "./policy";
import { buildDynamicContext, OPERATOR_PROMPT, OPERATOR_PROMPT_VERSION } from "./prompt";
import { ensureBuiltinTools, getTool, toAnthropicTools, toolsFor } from "./registry";
import { PiiVault, redactForExternalLlm } from "./redact";
import { wrapAsData } from "./sanitize";
import type { ToolCtx } from "./types";

export interface TurnOptions {
  client: OperatorModelClient;
  ctx: ToolCtx;
  history: ChatTurn[];
  message: string;
  emit: (event: OperatorEvent) => void;
  signal?: AbortSignal;
  /** Aktiv udbyder: skrives i done-hændelsen og revisionssporet (aldrig indhold). */
  providerId?: ProviderId;
  /** Dataminimering (maskering af persondata før noget sendes). Standard: til for deepseek, ellers fra. */
  minimiseData?: boolean;
  /** Test-hooks. */
  clock?: () => number;
  maxToolCalls?: number;
  turnMs?: number;
}

export interface TurnResult {
  /** Al assistenttekst i turen (gemmes i ChatMessage). */
  text: string;
  toolCalls: number;
  failed: boolean;
}

function describeCall(name: string, input: unknown): string {
  const tool = getTool(name);
  if (!tool) return `Kalder ${cleanText(name, 40)}`;
  const parsed = tool.input.safeParse(input ?? {});
  if (!parsed.success) return `Kalder ${tool.name}`;
  try {
    return tool.summarize(parsed.data).slice(0, 300);
  } catch {
    return `Kalder ${tool.name}`;
  }
}

/**
 * Værktøjsløkken: model → værktøjskald → resultat → model … Højst `maxToolCalls` værktøjskald og `turnMs` i alt pr. tur.
 * Fejl i ét værktøj afbryder ikke samtalen (modellen får fejlen som resultat). Alt værktøjsoutput går til modellen som DATA.
 */
export async function runOperatorTurn(opts: TurnOptions): Promise<TurnResult> {
  const { client, emit } = opts;
  const providerId = opts.providerId;
  const minimise = opts.minimiseData ?? providerId === "deepseek";
  const ctx: ToolCtx = providerId ? { ...opts.ctx, provider: providerId } : opts.ctx;
  // Pladsholder-lager for denne tur: persondata i samtale og værktøjsresultater maskeres, før noget sendes til en ekstern udbyder.
  const vault = minimise ? new PiiVault() : null;
  const clock = opts.clock ?? Date.now;
  const maxCalls = opts.maxToolCalls ?? MAX_TOOL_CALLS_PER_TURN;
  const turnMs = opts.turnMs ?? TURN_TIMEOUT_MS;
  const started = clock();
  await ensureBuiltinTools();

  const tools = toolsFor(ctx.user);
  const schemas = toAnthropicTools(tools);
  const system = [
    { text: OPERATOR_PROMPT, cache: true },
    { text: buildDynamicContext({ userName: vault ? "redaktøren" : cleanText(ctx.user.name, 80), roleName: cleanText(ctx.user.roleName, 60), today: ctx.now.toISOString().slice(0, 10), toolNames: tools.map((t) => t.name) }) },
  ];
  const messages: ModelMessage[] = normalizeHistory([...opts.history, { role: "user", content: opts.message }]).map((t) => ({ role: t.role, content: vault ? vault.mask(t.content) : t.content }));

  let text = "";
  let toolCalls = 0;
  let failed = false;
  const finish = async (): Promise<TurnResult> => {
    if (vault && providerId) await auditOperatorTurn(ctx, { provider: providerId, toolCalls, failed, stats: vault.stats });
    emit({ type: "done", promptVersion: OPERATOR_PROMPT_VERSION, toolCalls, ...(providerId ? { provider: providerId } : {}) });
    return { text, toolCalls, failed };
  };
  const say = (delta: string) => {
    if (!delta) return;
    text += delta;
    emit({ type: "text", delta });
  };

  for (let round = 0; ; round++) {
    const remaining = turnMs - (clock() - started);
    if (remaining <= 0 || opts.signal?.aborted) {
      emit({ type: "error", message: "Svaret tog for lang tid. Det du har set indtil nu er udført; prøv igen for resten." });
      failed = true;
      return finish();
    }
    let streamed = false;
    let separator = round > 0 && text.length > 0;
    const restorer = vault ? vault.restorer(say) : null;
    let response;
    try {
      response = await withTimeout(
        (signal) => {
          return client({
            system,
            messages,
            tools: schemas,
            maxTokens: MAX_MODEL_TOKENS,
            signal: opts.signal ? AbortSignal.any([signal, opts.signal]) : signal,
            onTextDelta: (delta) => {
              streamed = true;
              if (separator) {
                separator = false;
                say("\n\n");
              }
              if (restorer) restorer.push(delta);
              else say(delta);
            },
          });
        },
        remaining,
        "modelkald",
      );
    } catch (error) {
      failed = true;
      restorer?.flush();
      if (isLlmError(error)) emit({ type: "error", message: error.userMessage.slice(0, 400) });
      else if (error instanceof CircuitOpenError) emit({ type: "error", message: "AI-tjenesten er midlertidigt utilgængelig. Prøv igen om lidt." });
      else if (error instanceof TimeoutError) emit({ type: "error", message: "Svaret tog for lang tid. Prøv igen." });
      else {
        console.error("[operator] modelfejl:", error instanceof Error ? error.name : "ukendt");
        emit({ type: "error", message: "AI-tjenesten svarede med en fejl. Prøv igen om lidt." });
      }
      return finish();
    }

    restorer?.flush();
    if (!streamed) {
      const rawText = response.content.filter((b): b is Extract<ModelContentBlock, { type: "text" }> => b.type === "text").map((b) => b.text).join("");
      const joined = vault ? vault.restore(rawText) : rawText;
      if (joined) say(separator ? `\n\n${joined}` : joined);
    }
    const uses = response.content.filter((b): b is Extract<ModelContentBlock, { type: "tool_use" }> => b.type === "tool_use");
    if (response.stopReason === "max_tokens") say("\n\n[Svaret blev afkortet.]");
    if (response.stopReason === "content_filter") say("\n\n[Svaret blev stoppet af udbyderens indholdsfilter. Prøv at formulere opgaven anderledes.]");
    if (!uses.length || response.stopReason !== "tool_use") return finish();

    messages.push({ role: "assistant", content: response.content });
    const results: ModelToolResultBlock[] = [];
    let capped = false;
    for (const use of uses) {
      if (toolCalls >= maxCalls) {
        capped = true;
        results.push({ type: "tool_result", tool_use_id: use.id, content: "Loftet for handlinger i ét svar er nået. Udfør ikke flere.", is_error: true });
        continue;
      }
      toolCalls += 1;
      if (use.invalidArguments !== undefined) {
        // Modellen leverede argumenter der ikke er gyldig JSON: intet udføres, og modellen får en tydelig fejl.
        emit({ type: "tool_call", id: use.id, name: use.name.slice(0, 80), summary: `Kalder ${cleanText(use.name, 40)}` });
        emit({ type: "tool_result", id: use.id, name: use.name.slice(0, 80), ok: false, summary: "Værktøjskaldet havde ugyldige argumenter og blev ikke udført." });
        results.push({ type: "tool_result", tool_use_id: use.id, content: "Værktøjskaldet havde ugyldige argumenter (ikke gyldig JSON). Intet er udført. Kald værktøjet igen med gyldig JSON efter værktøjets skema.", is_error: true });
        continue;
      }
      // Pladsholdere (e-mail/telefon) gendannes KUN lokalt, før værktøjet udføres; modellen ser aldrig værdierne.
      const input = vault ? vault.restoreDeep(use.input) : use.input;
      emit({ type: "tool_call", id: use.id, name: use.name.slice(0, 80), summary: describeCall(use.name, input) });
      const res = await dispatchTool(ctx, use.name, input);
      if (res.kind === "rejected") {
        emit({ type: "tool_result", id: use.id, name: use.name.slice(0, 80), ok: false, summary: res.message.slice(0, 500) });
        results.push({ type: "tool_result", tool_use_id: use.id, content: vault ? vault.mask(res.message) : res.message, is_error: true });
      } else if (res.kind === "confirm") {
        emit({ type: "confirm_required", token: res.token, tool: use.name.slice(0, 80), summary: res.summary, details: res.details.slice(0, 30), risk: "confirm", expiresAt: res.expiresAt.toISOString() });
        results.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify({ status: "afventer-bekræftelse", besked: "Brugeren ser nu et bekræftelseskort med knappen Anvend. Intet er udført endnu. Beskriv kort hvad der vil ske, og vent." }) });
      } else {
        emit({ type: "tool_result", id: use.id, name: use.name.slice(0, 80), ok: res.ok, summary: res.summary.slice(0, 500) });
        if (res.undoId) emit({ type: "undo", undoId: res.undoId, label: res.undoLabel ?? "Fortryd" });
        // Eksterne udbydere får kun det redigerede billede (kontaktfelter væk, tekst maskeret) — FØR afkortning og pakning.
        const view = vault ? redactForExternalLlm({ ok: res.ok, summary: res.summary, data: res.data }, vault, getTool(use.name)?.externalLlm) : { summary: res.summary, data: res.data };
        results.push({ type: "tool_result", tool_use_id: use.id, content: wrapAsData(use.name, { ok: res.ok, resultat: view.summary, data: view.data }), is_error: !res.ok });
      }
    }
    messages.push({ role: "user", content: results });
    if (capped) {
      say(`${text ? "\n\n" : ""}Jeg har nået grænsen på ${maxCalls} handlinger i ét svar. Bed mig fortsætte, hvis der er mere.`);
      return finish();
    }
  }
}
