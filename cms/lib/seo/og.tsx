import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { OG_FORMATS, type OgFormat } from "./jsonld";
import { fetchWithTimeout } from "../http";
import { findUpload } from "../media-storage";

export const OG_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export function parseFormat(value: string | null): OgFormat {
  return value === "16x9" || value === "4x3" || value === "1x1" ? value : "og";
}

type CardOptions = {
  width: number;
  height: number;
  brand: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  onAccent: string;
  title: string;
  kicker?: string;
  label?: string;
  tagline?: string;
};

function clampTitle(t: string, max: number): string {
  const clean = t.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}

/** Genereret delingskort (JPEG). Indhold holdes i midterste ~80 % (sikker zone for WhatsApp/Facebook-mobil). */
export async function renderCardJpeg(o: CardOptions): Promise<Buffer> {
  const square = o.height >= o.width * 0.9;
  const titleSize = square ? 76 : o.title.length > 90 ? 52 : o.title.length > 60 ? 60 : 70;
  const title = clampTitle(o.title, square ? 110 : 120);
  const pad = Math.round(o.width * 0.075);

  const res = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: o.accentStrong,
          color: o.onAccent,
          padding: `${Math.round(o.height * 0.1)}px ${pad}px`,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, letterSpacing: 1 }}>{o.brand}</div>
          {o.label ? (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 700,
                padding: "6px 16px",
                border: `2px solid ${o.onAccent}`,
                borderRadius: 8,
                textTransform: "uppercase",
              }}
            >
              {o.label}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {o.kicker ? (
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: o.accentSoft, marginBottom: 18, textTransform: "uppercase", letterSpacing: 2 }}>
              {o.kicker}
            </div>
          ) : null}
          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 800, lineHeight: 1.12 }}>{title}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", width: 72, height: 8, background: o.accentSoft, borderRadius: 4 }} />
          <div style={{ display: "flex", fontSize: 26, color: o.accentSoft }}>{o.tagline ?? ""}</div>
        </div>
      </div>
    ),
    { width: o.width, height: o.height },
  );
  const png = Buffer.from(await res.arrayBuffer());
  return sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

const RASTER_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

/** Henter råbilledet for et cover: lokal fil under /public eller (kun tilladte værter) fjernfil. Aldrig SVG. */
export async function loadCoverBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    if (url.startsWith("/uploads/")) {
      // Redaktionens uploads ligger i UPLOAD_DIR/volume (ikke i public/): slå op via lagringslaget (T5 P3-7).
      const stored = await findUpload(decodeURIComponent(url.split("?")[0]).slice("/uploads/".length));
      if (!stored || !/^image\/(jpeg|png|webp|avif|gif)$/i.test(stored.contentType)) return null;
      return await readFile(stored.path);
    }
    if (url.startsWith("/") && !url.startsWith("//")) {
      const clean = decodeURIComponent(url.split("?")[0]);
      const ext = path.extname(clean).toLowerCase();
      if (!RASTER_EXT.has(ext)) return null;
      const publicRoot = path.resolve(process.cwd(), "public");
      const file = path.resolve(publicRoot, `.${clean}`);
      if (!file.startsWith(publicRoot + path.sep)) return null;
      return await readFile(file);
    }
    if (/^https?:\/\//i.test(url)) {
      const allowed = (process.env.SEO_OG_REMOTE_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
      const u = new URL(url);
      if (!allowed.includes(u.hostname.toLowerCase())) return null; // SSRF-værn: kun eksplicit tilladte værter
      const ext = path.extname(u.pathname).toLowerCase();
      if (ext && !RASTER_EXT.has(ext)) return null;
      {
        const r = await fetchWithTimeout(u, { timeoutMs: 4000, redirect: "error" });
        if (!r.ok) return null;
        const len = Number(r.headers.get("content-length") ?? 0);
        if (len > 15 * 1024 * 1024) return null;
        const type = r.headers.get("content-type") ?? "";
        if (!/^image\/(jpeg|png|webp|avif|gif)/i.test(type)) return null;
        return Buffer.from(await r.arrayBuffer());
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function coverToJpeg(buf: Buffer, format: OgFormat): Promise<Buffer | null> {
  const { width, height } = OG_FORMATS[format];
  try {
    return await sharp(buf, { failOn: "none" })
      .rotate()
      .resize(width, height, { fit: "cover", position: "attention" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

export function jpegResponse(data: Buffer, cacheControl: string = OG_CACHE): Response {
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
