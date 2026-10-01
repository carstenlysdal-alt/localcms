import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";
import { serveFeed } from "@/lib/seo/feed-data";
import { unknownHostResponse } from "@/lib/seo/xml-response";

export async function GET(_request: Request, context: { params: Promise<{ sektion: string }> }) {
  const { sektion } = await context.params;
  const site = await getCurrentSite();
  const blocked = await unknownHostResponse(site.domaene);
  if (blocked) return blocked;

  const section = await db.category.findFirst({
    where: { instansId: site.id, slug: sektion, parentId: null },
    include: { children: true },
  });
  if (!section) return new Response("Sektion findes ikke", { status: 404 });

  return serveFeed(site, {
    categoryIds: [section.id, ...section.children.map((c) => c.id)],
    title: `${section.navn} – ${site.navn}`,
    linkPath: `/${section.slug}`,
    selfPath: `/${section.slug}/feed.xml`,
    description: section.beskrivelse || `Nyheder om ${section.navn.toLowerCase()} i ${site.kommune}`,
  });
}
