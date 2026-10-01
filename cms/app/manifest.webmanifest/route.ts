import { getCurrentSite } from "@/lib/site";

export async function GET() {
  const site = await getCurrentSite();
  const manifest = {
    name: site.navn,
    short_name: site.navn,
    description: site.tagline,
    lang: "da",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: site.colors.accent,
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
