import { getCurrentSite } from "@/lib/site";
import { jpegResponse, renderCardJpeg } from "@/lib/seo/og";
import { guardedOgRender, ogCacheControl, ogNotFound, parseOgRequest } from "@/lib/cache/og-guard";

/** Standard-delingskort pr. by (1200x630 JPEG). Fallback når en side ikke har eget billede. Kun ?v=<version> tilladt. */
export async function GET(request: Request) {
  const params = parseOgRequest(null, new URL(request.url).searchParams);
  if (!params || params.format !== "og") return ogNotFound();
  return guardedOgRender(request, async () => {
    const site = await getCurrentSite();
    const jpeg = await renderCardJpeg({
      width: 1200,
      height: 630,
      brand: site.navn,
      accent: site.colors.accent,
      accentStrong: site.colors.accentStrong,
      accentSoft: site.colors.accentSoft,
      onAccent: site.colors.onAccent,
      title: site.tagline,
      kicker: `Lokale nyheder · ${site.kommune}`,
    });
    return jpegResponse(jpeg, ogCacheControl(params.version));
  });
}
