import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateArticleScore, ArticleDistributionInput } from "@/lib/distribution-engine";

export async function POST(req: Request) {
  try {
    let body: {
      articleId?: string;
      isNewView?: boolean;
      secondsSpent?: number;
      reached75?: boolean;
    };

    // sendBeacon kan sende som text eller json
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const text = await req.text();
      body = JSON.parse(text);
    }

    const { articleId, isNewView, secondsSpent = 0, reached75 = false } = body;

    if (!articleId || typeof articleId !== "string") {
      return NextResponse.json({ error: "Mangler articleId" }, { status: 400 });
    }

    // Slå artikel op
    const article = await db.article.findUnique({
      where: { id: articleId },
      include: {
        kategori: { include: { parent: true } },
        geoTags: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: "Artikel ikke fundet" }, { status: 404 });
    }

    // Find eller opret ArticleMetric
    let metric = await db.articleMetric.findUnique({
      where: { articleId },
    });

    const newViews = (metric?.visninger ?? 0) + (isNewView ? 1 : 0);
    const newSeconds = (metric?.totalLaesetidSek ?? 0) + Math.min(300, Math.max(0, secondsSpent));
    const newReadings = (metric?.laesninger ?? 0) + (reached75 ? 1 : 0);

    const sektionSlug = article.kategori?.parent?.slug || article.kategori?.slug || "nyheder";
    const omraadeSlug = article.geoTags?.[0]?.slug || null;

    // Genberegn score
    const scoreResult = calculateArticleScore({
      id: article.id,
      titel: article.titel,
      publiceretTid: article.publiceretTid ?? article.createdAt,
      indholdstype: article.indholdstype as ArticleDistributionInput["indholdstype"],
      breaking: article.breaking,
      pinned: article.pinned,
      sektionSlug,
      omraadeSlug,
      visninger: newViews,
      laesninger: Math.min(newViews, newReadings),
      totalLaesetidSek: newSeconds,
    });

    metric = await db.articleMetric.upsert({
      where: { articleId },
      update: {
        visninger: newViews,
        totalLaesetidSek: newSeconds,
        laesninger: Math.min(newViews, newReadings),
        score: scoreResult.totalScore,
      },
      create: {
        articleId,
        instansId: article.instansId,
        visninger: Math.max(1, newViews),
        totalLaesetidSek: newSeconds,
        laesninger: newReadings,
        score: scoreResult.totalScore,
      },
    });

    return NextResponse.json({
      success: true,
      score: metric.score,
      visninger: metric.visninger,
    });
  } catch (error) {
    console.error("Fejl ved metrik-opdatering:", error);
    return NextResponse.json({ error: "Intern fejl" }, { status: 500 });
  }
}
