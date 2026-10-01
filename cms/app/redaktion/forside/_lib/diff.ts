import type { SlotAssignment } from "@/lib/frontpage/types";

/** Sammenligning forslag mod den nuværende forside, pr. slot. Rent. */
export type DiffStatus = "uaendret" | "ny" | "aendret" | "flyttet" | "fjernet";

export interface SlotDiff {
  moduleId: string;
  slotIndex: number;
  status: DiffStatus;
  liveArticleId?: string;
  proposedArticleId?: string;
}

export function diffAssignments(live: readonly SlotAssignment[], proposed: readonly SlotAssignment[]): SlotDiff[] {
  const key = (a: { moduleId: string; slotIndex: number }) => `${a.moduleId}:${a.slotIndex}`;
  const liveBySlot = new Map(live.map((a) => [key(a), a]));
  const propBySlot = new Map(proposed.map((a) => [key(a), a]));
  const liveSlotOfArticle = new Map(live.map((a) => [a.articleId, key(a)]));
  const out: SlotDiff[] = [];
  for (const p of proposed) {
    const l = liveBySlot.get(key(p));
    let status: DiffStatus;
    if (!l) status = liveSlotOfArticle.has(p.articleId) ? "flyttet" : "ny";
    else if (l.articleId === p.articleId) status = "uaendret";
    else status = liveSlotOfArticle.has(p.articleId) ? "flyttet" : "aendret";
    out.push({ moduleId: p.moduleId, slotIndex: p.slotIndex, status, liveArticleId: l?.articleId, proposedArticleId: p.articleId });
  }
  for (const l of live) if (!propBySlot.has(key(l))) out.push({ moduleId: l.moduleId, slotIndex: l.slotIndex, status: "fjernet", liveArticleId: l.articleId });
  return out;
}

export const diffSummary = (d: readonly SlotDiff[]) => ({
  uaendret: d.filter((x) => x.status === "uaendret").length,
  ny: d.filter((x) => x.status === "ny").length,
  aendret: d.filter((x) => x.status === "aendret" || x.status === "flyttet").length,
  fjernet: d.filter((x) => x.status === "fjernet").length,
});
