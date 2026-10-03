import { db } from "../db";
import { writeAudit } from "../audit";
import { OPERATOR_PROMPT_VERSION } from "./prompt";
import type { RedactionStats } from "./redact";
import type { ToolCtx, ToolOutcome } from "./types";

/**
 * Revisionsspor for hver handling operatøren udfører: action "ai-operator.<værktøj>", udførende bruger, værktøj,
 * input-resumé (fra tool.summarize — uden følsomme felter) og resultat-id'er. ALDRIG adgangskoder, tokens eller nøgler.
 */
export async function auditOperator(
  ctx: ToolCtx,
  entry: { tool: string; risk: string; inputSummary: string; outcome: Pick<ToolOutcome, "ok" | "summary" | "resultIds">; via?: "direct" | "confirmed" | "undo" },
): Promise<void> {
  const ids = entry.outcome.resultIds ?? [];
  try {
    await writeAudit(db, {
      instansId: ctx.instansId,
      actorId: ctx.user.id,
      actorLabel: ctx.user.email,
      action: `ai-operator.${entry.via === "undo" ? "undo." : ""}${entry.tool}`,
      targetId: ids[0] ?? null,
      targetLabel: entry.outcome.summary.slice(0, 160),
      detail: {
        via: "ai-operator",
        tool: entry.tool,
        risk: entry.risk,
        mode: entry.via ?? "direct",
        ok: entry.outcome.ok,
        input: entry.inputSummary.slice(0, 300),
        resultIds: ids.slice(0, 30).join(",").slice(0, 600),
        resultCount: ids.length,
        promptVersion: OPERATOR_PROMPT_VERSION,
        provider: ctx.provider ?? null,
      },
      ip: ctx.ip ?? null,
    });
  } catch (error) {
    // Revisionsspor må aldrig vælte en allerede udført handling, men fejlen skal kunne ses.
    console.error("[operator] kunne ikke skrive AuditLog:", error instanceof Error ? error.message : "ukendt fejl");
  }
}

/**
 * Én revisionspost pr. tur når en EKSTERN udbyder (DeepSeek) har været brugt: hvem, hvilken udbyder, hvor mange kald og
 * hvor meget der blev maskeret/fjernet (kun tal). Aldrig besked, svar eller maskerede værdier.
 */
export async function auditOperatorTurn(ctx: ToolCtx, entry: { provider: string; toolCalls: number; failed: boolean; stats: RedactionStats }): Promise<void> {
  try {
    await writeAudit(db, {
      instansId: ctx.instansId,
      actorId: ctx.user.id,
      actorLabel: ctx.user.email,
      action: "ai-operator.turn",
      targetId: null,
      targetLabel: `AI-operatør via ${entry.provider}`,
      detail: {
        via: "ai-operator",
        provider: entry.provider,
        promptVersion: OPERATOR_PROMPT_VERSION,
        toolCalls: entry.toolCalls,
        failed: entry.failed,
        maskedEmails: entry.stats.emails,
        maskedPhones: entry.stats.phones,
        removedCpr: entry.stats.cpr,
        removedSecrets: entry.stats.secrets,
        droppedFields: entry.stats.droppedFields,
      },
      ip: ctx.ip ?? null,
    });
  } catch (error) {
    console.error("[operator] kunne ikke skrive AuditLog (tur):", error instanceof Error ? error.message : "ukendt fejl");
  }
}
