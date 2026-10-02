import { db } from "../db";
import { writeAudit } from "../audit";
import { OPERATOR_PROMPT_VERSION } from "./prompt";
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
      },
      ip: ctx.ip ?? null,
    });
  } catch (error) {
    // Revisionsspor må aldrig vælte en allerede udført handling, men fejlen skal kunne ses.
    console.error("[operator] kunne ikke skrive AuditLog:", error instanceof Error ? error.message : "ukendt fejl");
  }
}
