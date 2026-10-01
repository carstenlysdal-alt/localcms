import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { findUpload } from "@/lib/media-storage";

/**
 * Serverer uploadede filer (/uploads/<uuid>.<ext>) fra den konfigurerede lagring (public/uploads lokalt, Railway Volume i produktion).
 * Next.js serverer ikke filer, der tilføjes til public/ efter build — derfor denne rute.
 *
 *  - Content-Type kommer fra den hvidlistede endelse (aldrig fra klienten) + X-Content-Type-Options: nosniff
 *  - Filnavne er uuid'er og indholdet uforanderligt -> cache i et år (immutable), ETag/If-None-Match -> 304
 *  - Range-forespørgsler understøttes (Safari kræver det til video/lyd)
 *  - CSP default-src 'none'; sandbox som sikkerhedsbælte hvis en fil alligevel åbnes som dokument
 */
export const dynamic = "force-dynamic";

function headers(contentType: string, extra: Record<string, string> = {}) {
  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Accept-Ranges": "bytes",
    ...extra,
  };
}

function parseRange(header: string, size: number): { start: number; end: number } | "invalid" | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return header.startsWith("bytes=") ? "invalid" : null;
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return "invalid";
  return { start, end };
}

async function serve(request: Request, ctx: { params: Promise<{ name: string }> }, withBody: boolean) {
  const { name } = await ctx.params;
  const file = await findUpload(name);
  if (!file) return new Response("Ikke fundet", { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

  const etag = `"${file.size.toString(16)}-${Math.floor(file.mtimeMs).toString(16)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  }

  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, file.size) : null;
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}`, "X-Content-Type-Options": "nosniff" } });
  }

  const start = range ? range.start : 0;
  const end = range ? range.end : file.size - 1;
  const length = file.size === 0 ? 0 : end - start + 1;
  const base = headers(file.contentType, { ETag: etag, "Content-Length": String(length) });
  const status = range ? 206 : 200;
  const responseHeaders = range ? { ...base, "Content-Range": `bytes ${start}-${end}/${file.size}` } : base;
  if (!withBody || length === 0) return new Response(null, { status, headers: responseHeaders });

  const stream = Readable.toWeb(createReadStream(file.path, { start, end })) as ReadableStream;
  return new Response(stream, { status, headers: responseHeaders });
}

export function GET(request: Request, ctx: { params: Promise<{ name: string }> }) {
  return serve(request, ctx, true);
}

export function HEAD(request: Request, ctx: { params: Promise<{ name: string }> }) {
  return serve(request, ctx, false);
}
