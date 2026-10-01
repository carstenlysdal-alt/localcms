import { getCurrentSite } from "@/lib/site";
import { jpegResponse, renderCardJpeg } from "@/lib/seo/og";

/** Standard-delingskort pr. by (1200x630 JPEG). Fallback når en side ikke har eget billede. */
export async function GET() {
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
  return jpegResponse(jpeg);
}
