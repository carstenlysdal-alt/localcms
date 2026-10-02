import { createHash, randomBytes } from "node:crypto";
import { db } from "../db";
import { CONFIRM_TTL_MS } from "./policy";
import type { AuthorizedUser } from "../auth";
import type { Prisma } from "@prisma/client";

/**
 * Engangs-bekræftelser (confirm-politikken).
 *
 * Et token er bundet til brugeren, instansen, værktøjet og en SHA-256 af det validerede input, og udløber efter
 * CONFIRM_TTL_MS. Kun hashen af tokenet gemmes. Klienten sender KUN tokenet tilbage (aldrig input), så input kan ikke
 * ændres mellem forslag og udførelse. Forbrug sker atomisk (updateMany med betingelser), så et token kun kan bruges én gang.
 */

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function hashInput(tool: string, input: unknown): string {
  return createHash("sha256").update(`${tool}\n${canonicalJson(input)}`).digest("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return `opc_${randomBytes(32).toString("base64url")}`;
}

export interface IssuedConfirmation {
  id: string;
  token: string;
  expiresAt: Date;
}

export async function issueConfirmation(args: { user: Pick<AuthorizedUser, "id" | "instansId">; tool: string; input: unknown; sessionId: string | null; now: Date; ttlMs?: number }): Promise<IssuedConfirmation> {
  const token = newToken();
  const expiresAt = new Date(args.now.getTime() + (args.ttlMs ?? CONFIRM_TTL_MS));
  const row = await db.operatorAction.create({
    data: {
      instansId: args.user.instansId,
      userId: args.user.id,
      sessionId: args.sessionId,
      tool: args.tool,
      risk: "confirm",
      status: "pending",
      inputHash: hashInput(args.tool, args.input),
      input: JSON.parse(JSON.stringify(args.input)) as Prisma.InputJsonValue,
      tokenHash: hashToken(token),
      expiresAt,
    },
    select: { id: true },
  });
  return { id: row.id, token, expiresAt };
}

export type ConsumeResult =
  | { ok: true; row: { id: string; tool: string; input: unknown; inputHash: string; sessionId: string | null } }
  | { ok: false; reason: "ugyldig" | "brugt" | "udloebet" };

/**
 * Forbruger et token for `user`. Fremmed bruger/instans, ukendt token og forkert form giver alle "ugyldig" (ingen oplysninger
 * om hvad der findes). Tokenet er brugt efter første succes (status skifter fra pending), også hvis udførelsen derefter fejler.
 */
export async function consumeConfirmation(user: Pick<AuthorizedUser, "id" | "instansId">, token: string, now: Date): Promise<ConsumeResult> {
  if (typeof token !== "string" || !/^opc_[A-Za-z0-9_-]{20,100}$/.test(token)) return { ok: false, reason: "ugyldig" };
  const tokenHash = hashToken(token);
  const row = await db.operatorAction.findUnique({ where: { tokenHash } });
  if (!row || row.userId !== user.id || row.instansId !== user.instansId || row.risk !== "confirm") return { ok: false, reason: "ugyldig" };
  if (row.status !== "pending") return { ok: false, reason: "brugt" };
  if (!row.expiresAt || row.expiresAt.getTime() <= now.getTime()) {
    await db.operatorAction.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "expired" } });
    return { ok: false, reason: "udloebet" };
  }
  const claimed = await db.operatorAction.updateMany({
    where: { id: row.id, userId: user.id, instansId: user.instansId, status: "pending", tokenHash, expiresAt: { gt: now } },
    data: { status: "applied", usedAt: now },
  });
  if (claimed.count !== 1) return { ok: false, reason: "brugt" };
  return { ok: true, row: { id: row.id, tool: row.tool, input: row.input, inputHash: row.inputHash, sessionId: row.sessionId } };
}

export async function cancelConfirmation(user: Pick<AuthorizedUser, "id" | "instansId">, token: string): Promise<boolean> {
  if (typeof token !== "string" || !/^opc_[A-Za-z0-9_-]{20,100}$/.test(token)) return false;
  const res = await db.operatorAction.updateMany({
    where: { tokenHash: hashToken(token), userId: user.id, instansId: user.instansId, status: "pending" },
    data: { status: "cancelled", usedAt: new Date() },
  });
  return res.count === 1;
}
