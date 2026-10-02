import { db } from "../../lib/db";
import type { OperatorEvent } from "../../lib/operator/events";
import type { ToolCtx } from "../../lib/operator/types";
import { createUser, session } from "./mock-session";

type DbUser = Awaited<ReturnType<typeof createUser>>;

/** Bygger en ToolCtx ud fra en DB-bruger (som getAuthorizedUser ville gøre) og logger brugeren ind i mock-sessionen. */
export function ctxFor(user: DbUser, over: Partial<ToolCtx> = {}): ToolCtx {
  session.userId = user.id;
  return {
    user: {
      id: user.id,
      name: user.navn,
      email: user.email,
      instansId: user.instansId,
      authorId: user.authorId,
      roleName: user.role.navn,
      permissions: Array.isArray(user.role.permissions) ? (user.role.permissions as string[]) : [],
      mustChangePassword: false,
    },
    instansId: user.instansId,
    now: new Date(),
    sessionId: "op_testsession1",
    ip: null,
    deps: {},
    ...over,
  };
}

export function collect() {
  const events: OperatorEvent[] = [];
  return { events, emit: (e: OperatorEvent) => events.push(e), of: <T extends OperatorEvent["type"]>(type: T) => events.filter((e): e is Extract<OperatorEvent, { type: T }> => e.type === type) };
}

export async function cleanupInstance(instansId: string) {
  await db.operatorAction.deleteMany({ where: { instansId } });
  await db.auditLog.deleteMany({ where: { instansId } });
  await db.chatMessage.deleteMany({ where: { instansId } });
  await db.frontpageLayout.deleteMany({ where: { instansId } });
  await db.frontpageDecision.deleteMany({ where: { instansId } });
  await db.articleRevision.deleteMany({ where: { article: { instansId } } });
  await db.article.deleteMany({ where: { instansId } });
  await db.signal.deleteMany({ where: { instansId } });
  await db.topic.deleteMany({ where: { instansId } });
  await db.adCampaign.deleteMany({ where: { instansId } });
  await db.assignment.deleteMany({ where: { instansId } });
  await db.geoTag.deleteMany({ where: { instansId } });
  await db.category.deleteMany({ where: { instansId, parentId: { not: null } } });
  await db.category.deleteMany({ where: { instansId } });
  await db.user.deleteMany({ where: { instansId } });
  await db.author.deleteMany({ where: { instansId } });
  await db.instance.delete({ where: { id: instansId } }).catch(() => undefined);
}
