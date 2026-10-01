import { createHash } from "node:crypto";

/** Svag ETag (indholds-hash). Billig nok til feeds/sitemaps; gør at CDN/klient kan få 304 i stedet for hele filen. */
export function etagFor(body: string | Uint8Array): string {
  const hash = createHash("sha1").update(body).digest("base64url").slice(0, 27);
  return `W/"${hash}"`;
}

/** Følger RFC 9110 weak comparison: "*" eller en liste hvor mindst én værdi matcher (uden W/-præfiks). */
export function isNotModified(ifNoneMatch: string | null | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === "*") return true;
  const strip = (v: string) => v.trim().replace(/^W\//, "");
  const wanted = strip(etag);
  return ifNoneMatch.split(",").some((v) => strip(v) === wanted);
}
