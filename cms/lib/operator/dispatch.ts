import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { TimeoutError, withTimeout } from "../resilience";
import { auditOperator } from "./audit";
import { consumeConfirmation, hashInput, issueConfirmation } from "./confirm";
import { findBlockedTool, RISK_POLICY, TOOL_TIMEOUT_MS, UNDO_TTL_MS } from "./policy";
import { ensureBuiltinTools, getTool, isPermitted } from "./registry";
import { stripSecrets } from "./sanitize";
import { friendlyError } from "./tools/shared";
import { ToolError, type AnyTool, type ToolCtx, type ToolOutcome, type UndoRecipe } from "./types";

/**
 * Fælles udførelseslag for ALLE værktøjer (indbyggede og registrerede udvidelser): blokering, rettigheder, inputvalidering,
 * risikopolitik, timeout, revisionsspor og fortryd-recepter. Loop, bekræftelses-route og undo-route går alle herigennem.
 */

export type DispatchResult =
  | { kind: "rejected"; message: string; href?: string }
  | { kind: "confirm"; token: string; expiresAt: Date; summary: string; details: string[] }
  | { kind: "result"; ok: boolean; summary: string; data?: unknown; undoId?: string; undoLabel?: string; clientSecret?: ToolOutcome["clientSecret"] };

function inputIssue(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.map(String).join(".") || "input"}: ${i.message}`)
    .join("; ");
}

/** Udfører et værktøj med timeout; alle fejl bliver til et resultat (aldrig en kastet fejl ind i løkken). */
async function runWithGuard(ctx: ToolCtx, tool: AnyTool, input: unknown): Promise<ToolOutcome> {
  try {
    const outcome = await withTimeout(() => tool.execute(ctx, input), TOOL_TIMEOUT_MS, tool.name);
    return outcome;
  } catch (error) {
    if (error instanceof TimeoutError) return { ok: false, summary: "Handlingen tog for lang tid. Kontrollér om den blev udført, før du prøver igen." };
    if (!(error instanceof ToolError)) console.error(`[operator] værktøjet ${tool.name} fejlede:`, error instanceof Error ? error.message : "ukendt fejl");
    return { ok: false, summary: friendlyError(error) };
  }
}

async function recordApplied(ctx: ToolCtx, tool: AnyTool, input: unknown, outcome: ToolOutcome, existingId?: string): Promise<string | null> {
  const undo = outcome.ok && outcome.undo && tool.undo ? outcome.undo : null;
  const result = JSON.parse(JSON.stringify(stripSecrets({ ok: outcome.ok, summary: outcome.summary, resultIds: outcome.resultIds ?? [] }))) as Prisma.InputJsonValue;
  const undoJson = undo ? (JSON.parse(JSON.stringify(undo)) as Prisma.InputJsonValue) : undefined;
  try {
    if (existingId) {
      await db.operatorAction.update({ where: { id: existingId }, data: { status: outcome.ok ? "applied" : "failed", result, undo: undoJson } });
      return undo ? existingId : null;
    }
    // Skrivende værktøjer får altid en række (revisionsspor); kun med recept bliver rækken til en Fortryd-knap.
    if (tool.risk === "read" && !undo) return null;
    const row = await db.operatorAction.create({
      data: {
        instansId: ctx.instansId,
        userId: ctx.user.id,
        sessionId: ctx.sessionId,
        tool: tool.name,
        risk: tool.risk,
        status: outcome.ok ? "applied" : "failed",
        inputHash: hashInput(tool.name, input),
        input: JSON.parse(JSON.stringify(stripSecrets(input))) as Prisma.InputJsonValue,
        usedAt: ctx.now,
        result,
        undo: undoJson,
      },
      select: { id: true },
    });
    return undo ? row.id : null;
  } catch (error) {
    console.error("[operator] kunne ikke gemme handlingen:", error instanceof Error ? error.message : "ukendt fejl");
    return null;
  }
}

function toResult(outcome: ToolOutcome, undoId: string | null, undo: UndoRecipe | null | undefined): DispatchResult {
  return { kind: "result", ok: outcome.ok, summary: outcome.summary, data: outcome.data, undoId: undoId ?? undefined, undoLabel: undoId ? undo?.label : undefined, clientSecret: outcome.clientSecret };
}

/** Modellens værktøjskald. Aldrig kastende. */
export async function dispatchTool(ctx: ToolCtx, name: string, rawInput: unknown): Promise<DispatchResult> {
  await ensureBuiltinTools();
  const blocked = findBlockedTool(name);
  if (blocked) return { kind: "rejected", message: `${blocked.label} kan ikke udføres via AI. ${blocked.why} Bed brugeren om selv at gøre det på siden ${blocked.href}.`, href: blocked.href };
  const tool = getTool(name);
  if (!tool) return { kind: "rejected", message: `Ukendt værktøj '${String(name).slice(0, 60)}'.` };
  if (!isPermitted(tool, ctx.user)) return { kind: "rejected", message: "Brugeren har ikke rettighed til denne handling." };
  const parsed = tool.input.safeParse(rawInput ?? {});
  if (!parsed.success) return { kind: "rejected", message: `Ugyldigt input: ${inputIssue(parsed.error)}` };
  const input = parsed.data;
  const inputSummary = tool.summarize(input);

  const mode = RISK_POLICY[tool.risk];
  if (mode === "confirm") {
    let details: string[] = [];
    try {
      details = tool.details ? await tool.details(ctx, input) : [inputSummary];
    } catch (error) {
      return { kind: "rejected", message: friendlyError(error, "Handlingen kan ikke forberedes.") };
    }
    const issued = await issueConfirmation({ user: ctx.user, tool: tool.name, input, sessionId: ctx.sessionId, now: ctx.now });
    return { kind: "confirm", token: issued.token, expiresAt: issued.expiresAt, summary: inputSummary, details };
  }

  const outcome = await runWithGuard(ctx, tool, input);
  const wantAudit = tool.risk !== "read" || tool.audit === true;
  if (wantAudit) await auditOperator(ctx, { tool: tool.name, risk: tool.risk, inputSummary, outcome, via: "direct" });
  const undoId = tool.risk === "safe-write" || outcome.undo ? await recordApplied(ctx, tool, input, outcome) : null;
  return toResult(outcome, undoId, outcome.undo);
}

export type ConfirmedResult = { ok: false; code: "ugyldig" | "brugt" | "udloebet" | "forbudt" | "ukendt" | "input"; message: string } | { ok: true; result: Extract<DispatchResult, { kind: "result" }> };

const CONFIRM_MESSAGES = {
  ugyldig: "Bekræftelsen er ugyldig.",
  brugt: "Bekræftelsen er allerede brugt eller annulleret.",
  udloebet: "Bekræftelsen er udløbet. Bed AI'en om at foreslå handlingen igen.",
} as const;

/** Brugerens klik på Anvend: forbrug token, genvalider alt, og udfør. */
export async function applyConfirmed(ctx: ToolCtx, token: string): Promise<ConfirmedResult> {
  await ensureBuiltinTools();
  const consumed = await consumeConfirmation(ctx.user, token, ctx.now);
  if (!consumed.ok) return { ok: false, code: consumed.reason, message: CONFIRM_MESSAGES[consumed.reason] };
  const { row } = consumed;
  const fail = async (code: "forbudt" | "ukendt" | "input", message: string): Promise<ConfirmedResult> => {
    await db.operatorAction.update({ where: { id: row.id }, data: { status: "failed", result: { ok: false, summary: message } } }).catch(() => undefined);
    return { ok: false, code, message };
  };
  const tool = getTool(row.tool);
  if (!tool || tool.risk !== "confirm" || findBlockedTool(row.tool)) return fail("ukendt", "Værktøjet findes ikke længere.");
  // Rettigheder slås op igen (ctx.user kommer fra databasen i route'en): en rolle kan være ændret siden forslaget.
  if (!isPermitted(tool, ctx.user)) return fail("forbudt", "Du har ikke længere rettighed til denne handling.");
  const parsed = tool.input.safeParse(row.input);
  if (!parsed.success) return fail("input", "Det gemte forslag er ugyldigt og udføres ikke.");
  if (hashInput(tool.name, row.input) !== row.inputHash) return fail("input", "Det gemte forslag er ændret og udføres ikke.");
  const input = parsed.data;
  const outcome = await runWithGuard(ctx, tool, input);
  await auditOperator(ctx, { tool: tool.name, risk: tool.risk, inputSummary: tool.summarize(input), outcome, via: "confirmed" });
  const undoId = await recordApplied(ctx, tool, input, outcome, row.id);
  return { ok: true, result: toResult(outcome, undoId, outcome.undo) as Extract<DispatchResult, { kind: "result" }> };
}

export type UndoResult = { ok: false; message: string } | { ok: true; summary: string; partial: boolean };

/** Brugerens klik på Fortryd. Kun ejeren, kun inden for UNDO_TTL_MS, og højst én gang (atomisk claim). */
export async function applyUndo(ctx: ToolCtx, undoId: string): Promise<UndoResult> {
  await ensureBuiltinTools();
  if (typeof undoId !== "string" || !/^[A-Za-z0-9_-]{6,40}$/.test(undoId)) return { ok: false, message: "Ugyldig fortryd." };
  const row = await db.operatorAction.findFirst({ where: { id: undoId, userId: ctx.user.id, instansId: ctx.instansId } });
  if (!row || !row.undo) return { ok: false, message: "Der er intet at fortryde." };
  if (row.status === "undone") return { ok: false, message: "Handlingen er allerede fortrudt." };
  if (row.status !== "applied") return { ok: false, message: "Handlingen kan ikke fortrydes." };
  if (ctx.now.getTime() - row.createdAt.getTime() > UNDO_TTL_MS) return { ok: false, message: "Fortryd er udløbet (24 timer)." };
  const claimed = await db.operatorAction.updateMany({ where: { id: row.id, status: "applied", userId: ctx.user.id, instansId: ctx.instansId }, data: { status: "undone" } });
  if (claimed.count !== 1) return { ok: false, message: "Handlingen er allerede fortrudt." };
  const recipe = row.undo as unknown as UndoRecipe;
  const tool = getTool(recipe.tool);
  if (!tool?.undo || !isPermitted(tool, ctx.user)) {
    await db.operatorAction.update({ where: { id: row.id }, data: { status: "applied" } });
    return { ok: false, message: "Du har ikke rettighed til at fortryde denne handling." };
  }
  let outcome: { ok: boolean; summary: string };
  try {
    outcome = await withTimeout(() => tool.undo!(ctx, recipe.input ?? {}), TOOL_TIMEOUT_MS, `${tool.name}.undo`);
  } catch (error) {
    await db.operatorAction.update({ where: { id: row.id }, data: { status: "applied" } }).catch(() => undefined);
    return { ok: false, message: friendlyError(error, "Fortryd mislykkedes.") };
  }
  await auditOperator(ctx, { tool: tool.name, risk: tool.risk, inputSummary: recipe.label, outcome: { ...outcome, resultIds: [] }, via: "undo" });
  if (!outcome.ok) await db.operatorAction.update({ where: { id: row.id }, data: { result: { ok: false, summary: outcome.summary.slice(0, 500) } } }).catch(() => undefined);
  return { ok: true, summary: outcome.summary, partial: !outcome.ok };
}
