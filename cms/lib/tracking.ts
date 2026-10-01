import { createHash } from "node:crypto";
import { db } from "./db";
import { calculateArticleScore, type ArticleDistributionInput } from "./distribution-engine";
import { firstSeen, rateLimit } from "./ratelimit";
import { isNonHumanForTracking } from "./bot/detect";

/**
 * Serverlogik bag /api/ads/track og /api/metrics/track.
 * Adskilt fra route-handlerne, så tenant-isolation og dedupe kan testes uden HTTP.
 *
 * Forsvar (alle i lib/ratelimit — proces-lokal; se noten dér om Redis/Postgres i produktion):
 *   - kampagne/artikel SKAL tilhøre den aktuelle sites instans (aldrig kryds-by)
 *   - kampagnen skal være Aktiv og inden for start/slut-dato; maksVisninger respekteres
 *   - dedupe pr. besøgende (hash af IP + UA + dag): 1 visning/30 min, 1 klik/10 min pr. kampagne/artikel
 *   - tid pr. kald kappes (120 s) og antal kald pr. besøgende/artikel/time begrænses
 *   - åbenlyse bots/crawlere/preview-fetchers ignoreres (besvares som succes, tælles ikke)
 */

const BOT_PATTERN = /(bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|embedly|preview|monitor|uptime|curl\/|wget|python-requests|python-urllib|httpclient|okhttp|go-http-client|libwww|scrapy|axios\/|node-fetch|java\/|postman|insomnia)/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.length < 10) return true;
  return BOT_PATTERN.test(userAgent) || isNonHumanForTracking(userAgent); // lib/bot/detect.ts: søge-/AI-/skraber-/headless-klasser
}

/** Anonym besøgsnøgle: roterer dagligt, kan ikke føres tilbage til IP/UA, gemmes kun i hukommelse. */
export function visitorKey(ip: string, userAgent: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}|${userAgent}|${day}`).digest("hex").slice(0, 24);
}

export const IMPRESSION_WINDOW_MS = 30 * 60_000;
export const CLICK_WINDOW_MS = 10 * 60_000;
export const MAX_SECONDS_PER_CALL = 120;
export const MAX_METRIC_CALLS_PER_HOUR = 40;

export type TrackResult = { counted: boolean; reason?: string };

export async function recordAdEvent(input: {
  siteId: string;
  campaignId: string;
  type: "impression" | "click";
  visitor: string;
  now?: Date;
}): Promise<TrackResult | { notFound: true }> {
  const now = input.now ?? new Date();
  const campaign = await db.adCampaign.findFirst({
    where: {
      id: input.campaignId,
      instansId: input.siteId, // tenant-binding
      status: "Aktiv",
      startDato: { lte: now },
      slutDato: { gte: now },
    },
    select: { id: true, visninger: true, maksVisninger: true },
  });
  if (!campaign) return { notFound: true };

  if (input.type === "impression") {
    if (campaign.maksVisninger != null && campaign.visninger >= campaign.maksVisninger) return { counted: false, reason: "cap" };
    if (!(await firstSeen(`ad-imp:${campaign.id}`, input.visitor, IMPRESSION_WINDOW_MS, now.getTime()))) return { counted: false, reason: "duplicate" };
    await db.adCampaign.updateMany({ where: { id: campaign.id, instansId: input.siteId }, data: { visninger: { increment: 1 } } });
    return { counted: true };
  }

  if (!(await firstSeen(`ad-click:${campaign.id}`, input.visitor, CLICK_WINDOW_MS, now.getTime()))) return { counted: false, reason: "duplicate" };
  await db.adCampaign.updateMany({ where: { id: campaign.id, instansId: input.siteId }, data: { klik: { increment: 1 } } });
  return { counted: true };
}

export async function recordMetricEvent(input: {
  siteId: string;
  articleId: string;
  isNewView: boolean;
  secondsSpent: number;
  reached75: boolean;
  visitor: string;
  now?: Date;
}): Promise<{ notFound: true } | { counted: boolean; score?: number; visninger?: number; reason?: string }> {
  const now = input.now ?? new Date();
  const article = await db.article.findFirst({
    where: { id: input.articleId, instansId: input.siteId, status: "Publiceret" }, // tenant-binding + kun offentlige artikler
    include: { kategori: { include: { parent: true } }, geoTags: true },
  });
  if (!article) return { notFound: true };

  const calls = await rateLimit({
    bucket: "metric-calls",
    key: `${article.id}:${input.visitor}`,
    limit: MAX_METRIC_CALLS_PER_HOUR,
    windowMs: 60 * 60_000,
    now: now.getTime(),
  });
  if (!calls.ok) return { counted: false, reason: "rate" };

  const addView = input.isNewView && (await firstSeen(`view:${article.id}`, input.visitor, IMPRESSION_WINDOW_MS, now.getTime()));
  const addRead = input.reached75 && (await firstSeen(`read:${article.id}`, input.visitor, 24 * 60 * 60_000, now.getTime()));
  const seconds = Math.min(MAX_SECONDS_PER_CALL, Math.max(0, Math.floor(input.secondsSpent)));
  if (!addView && !addRead && seconds === 0) return { counted: false, reason: "duplicate" };

  const metric = await db.articleMetric.upsert({
    where: { articleId: article.id },
    update: {
      visninger: { increment: addView ? 1 : 0 },
      laesninger: { increment: addRead ? 1 : 0 },
      totalLaesetidSek: { increment: seconds },
    },
    create: {
      articleId: article.id,
      instansId: article.instansId,
      visninger: addView ? 1 : 0,
      laesninger: addRead ? 1 : 0,
      totalLaesetidSek: seconds,
    },
  });

  const laesninger = Math.min(metric.visninger, metric.laesninger);
  const sektionSlug = article.kategori?.parent?.slug || article.kategori?.slug || "nyheder";
  const score = calculateArticleScore({
    id: article.id,
    titel: article.titel,
    publiceretTid: article.publiceretTid ?? article.createdAt,
    indholdstype: article.indholdstype as ArticleDistributionInput["indholdstype"],
    breaking: article.breaking,
    pinned: article.pinned,
    sektionSlug,
    omraadeSlug: article.geoTags?.[0]?.slug || null,
    visninger: metric.visninger,
    laesninger,
    totalLaesetidSek: metric.totalLaesetidSek,
  }).totalScore;
  await db.articleMetric.update({ where: { articleId: article.id }, data: { laesninger, score } });

  return { counted: true, score, visninger: metric.visninger };
}
