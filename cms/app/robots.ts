import type { MetadataRoute } from "next";
import { getCurrentSite } from "@/lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getCurrentSite();
  const baseUrl = `https://${site.domaene}`;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/redaktion/", "/api/", "/login"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
