import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";
import { slugCandidates } from "@/lib/seo/url";
import { OG_FORMATS } from "@/lib/seo/jsonld";
import { coverToJpeg, jpegResponse, loadCoverBuffer, renderCardJpeg } from "@/lib/seo/og";
import { guardedOgRender, ogCacheControl, ogNotFound, parseOgRequest } from "@/lib/cache/og-guard";

/**
 * /og/artikel/<slug>.jpg[?f=16x9|4x3|1x1]
 * Altid et raster-JPEG: artiklens cover (beskåret) -> ellers genereret kort. Aldrig SVG.
 */
export async function GET(request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  // Strenge parametre (slug-allowlist, kun ?f og ?v): ukendt -> 404, så CDN-nøgler ikke kan oppustes (lib/cache/og-guard.ts).
  const params = parseOgRequest(file, new URL(request.url).searchParams);
  if (!params || !params.slug) return ogNotFound();
  const { slug: slugParam, format, version } = params;
  return guardedOgRender(request, () => renderArticleCard(slugParam, format, version));
}

async function renderArticleCard(slugParam: string, format: "og" | "16x9" | "4x3" | "1x1", version: string | null): Promise<Response> {
  const site = await getCurrentSite();
  const cache = ogCacheControl(version);

  const article = await db.article.findFirst({
    where: { instansId: site.id, status: "Publiceret", slug: { in: slugCandidates(slugParam) } },
    include: { coverMedia: true, kategori: { include: { parent: true } }, geoTags: true },
  });
  if (!article) return ogNotFound();

  const raw = await loadCoverBuffer(article.coverMedia?.url);
  if (raw) {
    const jpeg = await coverToJpeg(raw, format);
    if (jpeg) return jpegResponse(jpeg, cache);
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
  return jpegResponse(jpeg, cache);
}
