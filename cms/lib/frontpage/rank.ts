import {
  calculateArticleScore,
  type ArticleDistributionInput,
  type DistributionScoreResult,
} from "../distribution-engine";
import type { Candidate } from "./types";

/**
 * Deterministisk ranker (lag 1). Genbruger lib/distribution-engine (score = redaktionel basis + tidshenfald +
 * velocity + daypart + geo). Rent: samme input + samme `now` giver altid samme rækkefølge (ties brydes på
 * publiceringstid, derefter id).
 */

export interface RankedCandidate {
  candidate: Candidate;
  score: number;
  /** Score normaliseret til 0..1 inden for kandidatmængden (bruges til at blande med AI-prioritet). */
  norm: number;
  detail: DistributionScoreResult;
}

/** Klokkeslæt i Europe/Copenhagen — gør daypart-bonussen uafhængig af serverens tidszone. */
export function copenhagenHour(now: Date): number {
  const h = new Intl.DateTimeFormat("da-DK", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Copenhagen" }).format(now);
  return Number.parseInt(h, 10) % 24;
}

export function toDistributionInput(c: Candidate): ArticleDistributionInput {
  return {
    id: c.id,
    titel: c.titel,
    publiceretTid: c.publiceretTid ? new Date(c.publiceretTid) : new Date(0),
    indholdstype: c.indholdstype as ArticleDistributionInput["indholdstype"],
    breaking: c.breaking,
    pinned: c.pinned,
    sektionSlug: c.sektionSlug,
    omraadeSlug: c.omraadeSlug ?? null,
    kategoriNavn: c.kategoriNavn ?? undefined,
    visninger: c.visninger,
    laesninger: c.laesninger,
    totalLaesetidSek: c.totalLaesetidSek,
  };
}

export function rankCandidates(candidates: readonly Candidate[], options: { now?: Date; hour?: number } = {}): RankedCandidate[] {
  const now = options.now ?? new Date();
  const hour = options.hour ?? copenhagenHour(now);
  const scored = candidates.map((candidate) => {
    const detail = calculateArticleScore(toDistributionInput(candidate), { now, currentHour: hour });
    return { candidate, score: detail.totalScore, detail };
  });
  const max = scored.reduce((m, s) => Math.max(m, s.score), 0);
  const min = scored.reduce((m, s) => Math.min(m, s.score), Number.POSITIVE_INFINITY);
  const span = max - min;
  return scored
    .map((s) => ({ ...s, norm: span > 0 ? (s.score - min) / span : 0.5 }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.candidate.publiceretTid ?? 0).getTime() - new Date(a.candidate.publiceretTid ?? 0).getTime() ||
        (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0),
    );
}

/** Kronologisk rækkefølge (nyeste først, id som tie-break) — bruges af seneste-nyt og nødfallback. */
export function sortChronological<T extends { publiceretTid: Date | null; id: string }>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.publiceretTid ?? 0).getTime() - new Date(a.publiceretTid ?? 0).getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** 0..1 -> prioritet 1..5. */
export function priorityFromNorm(norm: number): number {
  if (norm >= 0.8) return 5;
  if (norm >= 0.6) return 4;
  if (norm >= 0.4) return 3;
  if (norm >= 0.2) return 2;
  return 1;
}

export function describeScore(r: RankedCandidate): string {
  const d = r.detail;
  return `Deterministisk score ${d.totalScore} (basis ${d.baseEditorialScore}, friskhed ${d.decayMultiplier}, læsning ${d.velocityScore}${d.daypartBonus ? `, dagsdel +${d.daypartBonus}` : ""}${d.geoBonus ? `, område +${d.geoBonus}` : ""}).`;
}
