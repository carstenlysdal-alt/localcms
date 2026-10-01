import { ImageResponse } from "next/og";
import { getCurrentSite } from "@/lib/site";
import { OG_CACHE } from "@/lib/seo/og";

const SIZES: Record<string, number> = { "180.png": 180, "192.png": 192, "512.png": 512 };

/** Genererede app-ikoner pr. by (apple-touch-icon 180, manifest 192/512). Monogram på byens accentfarve. */
export async function GET(_req: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const size = SIZES[file];
  if (!size) return new Response("Not found", { status: 404 });
  const site = await getCurrentSite();
  const letter = (site.kommune || site.navn).trim().charAt(0).toUpperCase();
  const res = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: site.colors.accent,
          color: site.colors.onAccent,
          fontSize: Math.round(size * 0.62),
          fontWeight: 800,
        }}
      >
        {letter}
      </div>
    ),
    { width: size, height: size },
  );
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", OG_CACHE);
  return new Response(res.body, { headers });
}
