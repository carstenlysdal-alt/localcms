import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Inter, Newsreader } from "next/font/google";
import "@/styles/site.css";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseBlocks } from "@/lib/blocks/schema";
import { parseSiteColors } from "@/lib/site";
import { articlePreviewDecision, ID_PATTERN } from "@/lib/editor/preview-access";
import { ArticlePreviewView } from "@/components/editor/article-preview-view";

export const metadata: Metadata = { title: "Forhåndsvisning af artikel", robots: { index: false, follow: false, nocache: true } };
export const dynamic = "force-dynamic";

const newsreader = Newsreader({ variable: "--font-serif", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap" });
const inter = Inter({ variable: "--font-sans", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap" });

/**
 * Forhåndsvisning af en KLADDE som den ser ud på det offentlige site (samme blok-renderer og klassenavne).
 * Kræver login + ret til at redigere artiklen; egen instans; noindex; ingen måling og intet JSON-LD.
 */
export default async function ArticlePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthorizedUser();
  if (!ID_PATTERN.test(id)) notFound();
  const article = user
    ? await db.article.findFirst({
        where: { id, instansId: user.instansId },
        include: { forfatter: true, coverMedia: true, kategori: { include: { parent: true } }, tags: true, geoTags: true },
      })
    : null;
  const decision = articlePreviewDecision(user, article);
  if (!decision.allow) {
    if (decision.reason === "login") redirect("/login");
    notFound();
  }
  if (!article || !user) notFound();
  const instance = await db.instance.findUnique({ where: { id: user.instansId } });
  const colors = parseSiteColors(instance?.farver);
  // Farver sættes via <style> (ikke inline style); værdierne er redaktør-konfigureret hex fra instansen.
  const safe = (v: string) => (/^#[0-9a-fA-F]{3,8}$/.test(v) ? v : "#9E3D1B");
  const themeCss = `.cms-preview-site{--site-accent:${safe(colors.accent)};--site-accent-strong:${safe(colors.accentStrong)};--site-accent-soft:${safe(colors.accentSoft)};--site-on-accent:${safe(colors.onAccent)}}`;

  return (
    <>
      <style>{`.sidebar{display:none!important}.app-shell{display:block}.app-content{padding-bottom:0}${themeCss}`}</style>
      <div className={`site-wrapper cms-preview-site ${newsreader.variable} ${inter.variable}`}>
        <p className="fp-preview-banner" role="status">
          Forhåndsvisning af kladde · {article.status} · ikke offentlig, ingen måling
        </p>
        <ArticlePreviewView
          article={{
            titel: article.titel,
            manchet: article.manchet,
            indholdstype: article.indholdstype,
            marking: (article.marking as Record<string, unknown> | null) ?? null,
            blocks: parseBlocks(article.blocks),
            forfatter: article.forfatter,
            cover: article.coverMedia,
            sektion: article.kategori?.parent?.navn ?? article.kategori?.navn ?? "Nyheder",
            omraade: article.geoTags[0]?.navn ?? instance?.navn ?? "",
            tags: article.tags.map((t) => t.navn),
            geo: article.geoTags.map((g) => g.navn),
            publiceretTid: article.publiceretTid,
            opdateretTid: article.opdateretTid,
          }}
        />
      </div>
    </>
  );
}
