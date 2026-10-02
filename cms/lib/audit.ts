import type { Prisma, PrismaClient } from "@prisma/client";

type Writer = Pick<PrismaClient, "auditLog"> | Pick<Prisma.TransactionClient, "auditLog">;

export type AuditEntry = {
  instansId: string;
  actorId?: string | null;
  actorLabel?: string | null;
  action: string;
  targetId?: string | null;
  targetLabel?: string | null;
  /** Små, ikke-hemmelige nøgler (fx fra/til-rolle). ALDRIG adgangskoder, hashes eller tokens. */
  detail?: Record<string, string | number | boolean | null>;
  ip?: string | null;
};

export async function writeAudit(client: Writer, entry: AuditEntry): Promise<void> {
  await client.auditLog.create({
    data: {
      instansId: entry.instansId,
      actorId: entry.actorId ?? null,
      actorLabel: entry.actorLabel ?? null,
      action: entry.action,
      targetId: entry.targetId ?? null,
      targetLabel: entry.targetLabel ?? null,
      detail: entry.detail ?? undefined,
      ip: entry.ip && entry.ip !== "unknown" ? entry.ip : null,
    },
  });
}
