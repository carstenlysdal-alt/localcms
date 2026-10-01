import { headers } from "next/headers";
import { etagFor, isNotModified } from "../cache/etag";
import { getHostStatus } from "./host";

export const XML_CACHE = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
export const NEWS_CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

/**
 * XML/tekst-svar med delt cache (s-maxage + stale-while-revalidate) og ETag: sender klienten/CDN'en
 * If-None-Match og indholdet er uændret, svares 304 uden body.
 */
export async function xmlResponse(body: string, cache = XML_CACHE, contentType = "application/xml; charset=utf-8"): Promise<Response> {
  const etag = etagFor(body);
  const baseHeaders: Record<string, string> = {
    "Cache-Control": cache,
    ETag: etag,
    Vary: "Host",
    "X-Content-Type-Options": "nosniff",
  };
  let ifNoneMatch: string | null = null;
  try {
    ifNoneMatch = (await headers()).get("if-none-match");
  } catch {
    ifNoneMatch = null; // uden for request-kontekst (test)
  }
  if (isNotModified(ifNoneMatch, etag)) return new Response(null, { status: 304, headers: baseHeaders });
  return new Response(body, { headers: { "Content-Type": contentType, ...baseHeaders } });
}

/** Ukendt vært (kun relevant i produktion): ingen sitemaps/feeds. */
export async function unknownHostResponse(siteDomain: string): Promise<Response | null> {
  const host = await getHostStatus(siteDomain);
  if (host.known) return null;
  return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
}
