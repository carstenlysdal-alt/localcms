import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";

export async function GET() {
  const site = await getCurrentSite();

  const articles = await db.article.findMany({
    where: { instansId: site.id, status: "Publiceret" },
    orderBy: { publiceretTid: "desc" },
    take: 30,
    include: {
      kategori: { include: { parent: true } },
      forfatter: true,
    },
  });

  const rssItems = articles
    .map((art) => {
      const sektionSlug = art.kategori?.parent?.slug || art.kategori?.slug || "nyheder";
      const url = `https://${site.domaene}/${sektionSlug}/${art.slug}`;
      const pubDate = (art.publiceretTid || new Date()).toUTCString();
      const description = art.manchet || "";

      return `    <item>
      <title><![CDATA[${art.titel}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${description}]]></description>
      ${art.forfatter ? `<author>${art.forfatter.navn}</author>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${site.navn}]]></title>
    <link>https://${site.domaene}</link>
    <description><![CDATA[${site.tagline || `Lokale nyheder fra ${site.kommune}`}]]></description>
    <language>da-dk</language>
    <atom:link href="https://${site.domaene}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
