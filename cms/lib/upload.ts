import type { MediaType } from "./media";

/**
 * Filtype-bestemmelse ud fra FILINDHOLD (magic bytes) — klientens `file.type`/filendelse stoles aldrig på.
 * Kun hvidlistede binære formater accepteres. SVG, HTML, XML, scripts og eksekverbare filer afvises
 * automatisk, fordi de ikke matcher nogen signatur (og eksplicit afvises med tydelig fejl).
 */
export type DetectedUpload = { type: MediaType; extension: string; mime: string };

export const UPLOAD_LIMITS: Record<MediaType, number> = {
  billede: 10 * 1024 * 1024,
  dokument: 10 * 1024 * 1024,
  lyd: 10 * 1024 * 1024,
  video: 10 * 1024 * 1024, // Server Actions-bodyloft er 12 MB (next.config.ts) — større video lægges som ekstern URL
};

const ascii = (buf: Uint8Array, start: number, end: number) => String.fromCharCode(...buf.subarray(start, end));

export function detectUpload(buf: Uint8Array): DetectedUpload | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: "billede", extension: "jpg", mime: "image/jpeg" };
  if (ascii(buf, 0, 8) === "\x89PNG\r\n\x1a\n") return { type: "billede", extension: "png", mime: "image/png" };
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return { type: "billede", extension: "webp", mime: "image/webp" };
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WAVE") return { type: "lyd", extension: "wav", mime: "audio/wav" };
  if (ascii(buf, 0, 4) === "OggS") return { type: "lyd", extension: "ogg", mime: "audio/ogg" };
  if (ascii(buf, 0, 3) === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0 && (buf[1] & 0x06) !== 0)) return { type: "lyd", extension: "mp3", mime: "audio/mpeg" };
  if (ascii(buf, 4, 8) === "ftyp") return { type: "video", extension: "mp4", mime: "video/mp4" };
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3 && ascii(buf, 0, Math.min(buf.length, 64)).includes("webm")) {
    return { type: "video", extension: "webm", mime: "video/webm" };
  }
  if (ascii(buf, 0, 5) === "%PDF-") return { type: "dokument", extension: "pdf", mime: "application/pdf" };
  return null;
}

/** Tekstbaserede/aktive formater, som skal afvises med en tydelig fejlbesked. */
export function looksLikeActiveContent(buf: Uint8Array): boolean {
  const head = ascii(buf, 0, Math.min(buf.length, 2048)).toLowerCase();
  const trimmed = head.replace(/^[\s﻿]+/, "");
  if (trimmed.startsWith("<") || trimmed.startsWith("#!") || trimmed.startsWith("mz") || trimmed.startsWith("\x7felf")) return true;
  return /<svg|<html|<script|<!doctype|<\?xml|<iframe|javascript:/.test(head);
}

/** PDF med aktivt indhold (JavaScript, Launch, indlejrede filer) afvises. Grov skanning af hele filen. */
export function pdfHasActiveContent(buf: Uint8Array): boolean {
  const text = Buffer.from(buf).toString("latin1");
  return /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA)\b/.test(text) || /\/OpenAction/.test(text) || /\/AA\s*<</.test(text);
}

export function validateUploadBuffer(buf: Uint8Array): { ok: true; detected: DetectedUpload } | { ok: false; error: string } {
  if (looksLikeActiveContent(buf)) return { ok: false, error: "Filen ser ud til at indeholde aktivt indhold (SVG/HTML/script/program) og afvises." };
  const detected = detectUpload(buf);
  if (!detected) return { ok: false, error: "Filtypen understøttes ikke. Brug JPG, PNG, WebP, MP4, WebM, MP3, WAV, OGG eller PDF." };
  if (buf.length > UPLOAD_LIMITS[detected.type]) {
    return { ok: false, error: `Filen må højst fylde ${Math.round(UPLOAD_LIMITS[detected.type] / 1024 / 1024)} MB.` };
  }
  if (detected.type === "dokument" && pdfHasActiveContent(buf)) return { ok: false, error: "PDF'en indeholder aktivt indhold (JavaScript/indlejrede filer) og afvises." };
  return { ok: true, detected };
}
