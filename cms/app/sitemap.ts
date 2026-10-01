import type { MetadataRoute } from "next";
import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getCurrentSite();
  const baseUrl = `https://${site.domaene}`;

  // 1. Statiske og faste transparens-sider
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/soeg`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/om-mediet`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/om-mediet/redaktionelle-principper`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/om-mediet/rettelser`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/om-mediet/kontakt`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/bliv-stoette`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  // 2. Sektioner og undersektioner
  const categories = await db.category.findMany({
    where: { instansId: site.id },
    include: { parent: true },
  });

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => {
    const path = cat.parent ? `/${cat.parent.slug}/${cat.slug}` : `/${cat.slug}`;
    return {
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: cat.parent ? 0.75 : 0.85,
    };
  });

  // 3. Områder
  const areas = await db.geoTag.findMany({
    where: { instansId: site.id },
  });

  const areaRoutes: MetadataRoute.Sitemap = areas.map((area) => ({
    url: `${baseUrl}/omraade/${area.slug || area.id}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.7,
  }));

  // 4. Forfattere
  const authors = await db.author.findMany({
    where: { instansId: site.id, slug: { not: null } },
  });

  const authorRoutes: MetadataRoute.Sitemap = authors.map((author) => ({
    url: `${baseUrl}/forfatter/${author.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // 5. Publicerede artikler
  const articles = await db.article.findMany({
    where: { instansId: site.id, status: "Publiceret" },
    select: {
      slug: true,
      opdateretTid: true,
      kategori: {
        select: {
          slug: true,
          parent: { select: { slug: true } },
        },
      },
    },
    orderBy: { publiceretTid: "desc" },
    take: 1000,
  });

  const articleRoutes: MetadataRoute.Sitemap = articles.map((art) => {
    const sektionSlug = art.kategori?.parent?.slug || art.kategori?.slug || "nyheder";
    return {
      url: `${baseUrl}/${sektionSlug}/${art.slug}`,
      lastModified: art.opdateretTid,
      changeFrequency: "weekly",
      priority: 0.8,
    };
  });

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...areaRoutes,
    ...authorRoutes,
    ...articleRoutes,
  ];
}
