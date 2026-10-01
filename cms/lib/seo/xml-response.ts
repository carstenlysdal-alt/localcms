import { getHostStatus } from "./host";

export const XML_CACHE = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
export const NEWS_CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

export function xmlResponse(body: string, cache = XML_CACHE, contentType = "application/xml; charset=utf-8"): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Ukendt vært (kun relevant i produktion): ingen sitemaps/feeds. */
export async function unknownHostResponse(siteDomain: string): Promise<Response | null> {
  const host = await getHostStatus(siteDomain);
  if (host.known) return null;
  return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
}
