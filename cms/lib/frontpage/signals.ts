import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { effectiveMaxAgeHours } from "./guardrails";
import type { ModuleInstance } from "./layout-schema";

/** Standard-kildetyper pr. signalmodul (config.sourceTypes overstyrer). */
export const DEFAULT_SIGNAL_SOURCES: Record<string, string[]> = {
  "fra-kommunen": ["kommune_dagsorden", "kommune_pressemeddelelse"],
  "fra-politiet": ["politi", "beredskab_112"],
};

/**
 * Hvilke signaler må vises offentligt i et signalmodul (T5 P1-3 / T7 §5)?
 *  - kun maskinindsamlede signaler en redaktør har GODKENDT (godkendtTid sat) — et nyt/ændret signal er ugodkendt;
 *  - kun de kildetyper modulet er sat op til (politi/112 aldrig uden godkendelse);
 *  - kun inden for modulets aldersgrænse (config.maxAgeHours, ellers 72 t for kommunen/24 t for politiet) målt på
 *    kildens tidspunkt (ellers modtagetidspunktet);
 *  - kun det område modulet er låst til (config.omraadeSlug), hvis angivet.
 * Alt afgrænses til instansen.
 */
export function publicSignalWhere(instansId: string, module: Pick<ModuleInstance, "type" | "config">, now: Date = new Date()): Prisma.SignalWhereInput {
  const types = module.config.sourceTypes?.length ? module.config.sourceTypes : (DEFAULT_SIGNAL_SOURCES[module.type] ?? []);
  const hours = effectiveMaxAgeHours(module as ModuleInstance);
  const since = new Date(now.getTime() - hours * 3_600_000);
  return {
    instansId,
    maskinindsamlet: true,
    godkendtTid: { not: null },
    sourceType: { in: types },
    OR: [{ kildeTidspunkt: { gte: since } }, { kildeTidspunkt: null, createdAt: { gte: since } }],
    ...(module.config.omraadeSlug ? { omraade: { slug: module.config.omraadeSlug, instansId } } : {}),
  };
}

export async function loadPublicSignals(instansId: string, module: Pick<ModuleInstance, "type" | "config" | "slots">, now: Date = new Date()) {
  return db.signal.findMany({
    where: publicSignalWhere(instansId, module, now),
    orderBy: [{ kildeTidspunkt: "desc" }, { createdAt: "desc" }],
    take: module.slots,
  });
}
