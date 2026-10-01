import { getCurrentSite } from "@/lib/site";
import { serveFeed } from "@/lib/seo/feed-data";
import { unknownHostResponse } from "@/lib/seo/xml-response";

export async function GET() {
  const site = await getCurrentSite();
  const blocked = await unknownHostResponse(site.domaene);
  if (blocked) return blocked;
  return serveFeed(site, { selfPath: "/feed.xml", description: site.tagline || `Lokale nyheder fra ${site.kommune}` });
}
