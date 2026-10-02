import { db } from "@/lib/db";
import { COMMERCIAL_TYPES } from "@/lib/frontpage/types";

/** Instansens standardloft (samme som Instance.kvoteloftProcent i schemaet). */
export const DEFAULT_KVOTELOFT_PROCENT = 25;

export interface QuotaStatus {
  percentage: number;
  supportedCount: number;
  totalCount: number;
  kvoteloftProcent: number;
  isExceeded: boolean;
}

/**
 * Beregner støttefinansieret andel af publicerede artikler de seneste 7 dage (A-04, CMS-04).
 * Kvoteloftet sikrer mediets redaktionelle uafhængighed (typisk maks 20-25%).
 * "Støttefinansieret" = indholdstyperne i COMMERCIAL_TYPES (Partner, Sponsoreret, PR, Annonce) — samme definition som
 * forsidens rækværk (lib/frontpage/guardrails.ts). Annoncekampagner i ad-break-moduler tælles dér (adBreakAllowance).
 */
export async function calculateSupportedContentQuota(instansId: string): Promise<QuotaStatus> {
  const instance = await db.instance.findUnique({
    where: { id: instansId },
    select: { kvoteloftProcent: true },
  });

  const kvoteloftProcent = instance?.kvoteloftProcent ?? DEFAULT_KVOTELOFT_PROCENT;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalCount, supportedCount] = await Promise.all([
    db.article.count({
      where: {
        instansId,
        status: "Publiceret",
        publiceretTid: { gte: sevenDaysAgo },
      },
    }),
    db.article.count({
      where: {
        instansId,
        status: "Publiceret",
        publiceretTid: { gte: sevenDaysAgo },
        indholdstype: { in: [...COMMERCIAL_TYPES] },
      },
    }),
  ]);

  const percentage = totalCount > 0 ? Math.round((supportedCount / totalCount) * 100) : 0;
  const isExceeded = percentage >= kvoteloftProcent;

  return {
    percentage,
    supportedCount,
    totalCount,
    kvoteloftProcent,
    isExceeded,
  };
}

/**
 * Henter aktive forsideplaceringer (A-03, Del 4 §4).
 * Placeringer hvor udløbstid er overskredet frasorteres automatisk,
 * så zoner falder tilbage til standard redaktionel regel.
 */
export async function getActiveFrontpagePlacements(instansId: string) {
  const now = new Date();

  return db.frontpagePlacement.findMany({
    where: {
      instansId,
      OR: [{ udloebTid: null }, { udloebTid: { gt: now } }],
    },
    include: {
      article: {
        include: {
          coverMedia: true,
          forfatter: true,
          kategori: { include: { parent: true } },
          geoTags: true,
        },
      },
    },
    orderBy: [{ zone: "asc" }, { position: "asc" }, { createdAt: "desc" }],
  });
}
