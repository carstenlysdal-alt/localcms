import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";
import { serveFeed } from "@/lib/seo/feed-data";
import { unknownHostResponse } from "@/lib/seo/xml-response";

/** Feed for en undersektion: /nyheder/politik/feed.xml */
export async function GET(_request: Request, context: { params: Promise<{ sektion: string; slug: string }> }) {
  const { sektion, slug } = await context.params;
  const site = await getCurrentSite();
  const blocked = await unknownHostResponse(site.domaene);
  if (blocked) return blocked;

  const sub = await db.category.findFirst({
    where: { instansId: site.id, slug, parent: { slug: sektion, instansId: site.id } },
    include: { parent: true },
  });
  if (!sub || !sub.parent) return new Response("Undersektion findes ikke", { status: 404 });

  return serveFeed(site, {
    categoryIds: [sub.id],
    title: `${sub.navn} – ${sub.parent.navn} – ${site.navn}`,
    linkPath: `/${sub.parent.slug}/${sub.slug}`,
    selfPath: `/${sub.parent.slug}/${sub.slug}/feed.xml`,
    description: sub.beskrivelse || `Nyheder om ${sub.navn.toLowerCase()} i ${site.kommune}`,
  });
}
