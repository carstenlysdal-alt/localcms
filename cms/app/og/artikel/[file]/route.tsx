import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";
import { slugCandidates } from "@/lib/seo/url";
import { OG_FORMATS } from "@/lib/seo/jsonld";
import { coverToJpeg, jpegResponse, loadCoverBuffer, parseFormat, renderCardJpeg } from "@/lib/seo/og";

/**
 * /og/artikel/<slug>.jpg[?f=16x9|4x3|1x1]
 * Altid et raster-JPEG: artiklens cover (beskåret) -> ellers genereret kort. Aldrig SVG.
 */
export async function GET(request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const slugParam = file.replace(/\.(jpe?g|png)$/i, "");
  const format = parseFormat(new URL(request.url).searchParams.get("f"));
  const site = await getCurrentSite();

  const article = await db.article.findFirst({
    where: { instansId: site.id, status: "Publiceret", slug: { in: slugCandidates(slugParam) } },
    include: { coverMedia: true, kategori: { include: { parent: true } }, geoTags: true },
  });
  if (!article) return new Response("Not found", { status: 404 });

  const raw = await loadCoverBuffer(article.coverMedia?.url);
  if (raw) {
    const jpeg = await coverToJpeg(raw, format);
    if (jpeg) return jpegResponse(jpeg);
  }

  const { width, height } = OG_FORMATS[format];
  const sektion = article.kategori?.parent?.navn ?? article.kategori?.navn ?? "Nyheder";
  const label =
    article.indholdstype === "Sponsoreret" ? "Annonce"
    : article.indholdstype === "Partner" ? "Partnerindhold"
    : article.indholdstype === "PR" ? "Pressemeddelelse"
    : article.indholdstype === "Brugerindsendt" ? "Indsendt"
    : article.indholdstype === "AI-assisteret" ? "AI-assisteret"
    : undefined;
  const jpeg = await renderCardJpeg({
    width,
    height,
    brand: site.navn,
    accent: site.colors.accent,
    accentStrong: site.colors.accentStrong,
    accentSoft: site.colors.accentSoft,
    onAccent: site.colors.onAccent,
    title: article.titel,
    kicker: [sektion, article.geoTags[0]?.navn].filter(Boolean).join(" · "),
    label,
    tagline: site.kommune,
  });
  return jpegResponse(jpeg);
}
