import type { Metadata } from "next";
import { Newsreader, Inter } from "next/font/google";
import "@/styles/site.css";
import { getCurrentSite, getNetworkLinks } from "@/lib/site";
import { getSiteNavigation } from "@/lib/site-queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { BottomNav } from "@/components/site/BottomNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/site/JsonLd";
import { buildSiteMetadata } from "@/lib/seo/meta";
import { resolveSeoConfig } from "@/lib/seo/config";
import { siteGraph } from "@/lib/seo/jsonld";
import { siteBase } from "@/lib/seo/url";

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  const base = siteBase(site);
  const meta = await buildSiteMetadata(site);
  return {
    ...meta,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/favicon.ico" }, { url: "/icons/192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: `${base}/icons/180.png`, sizes: "180x180", type: "image/png" }],
    },
    other: { "theme-color": site.colors.accent },
  };
}

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = await getCurrentSite();
  const { categories, areas } = await getSiteNavigation(site.id);
  const networkLinks = await getNetworkLinks();
  // Stier der findes på alle byer (sektioner/undersektioner) – bevares når man skifter by.
  const sectionPaths = categories.flatMap((c) => [
    `/${c.slug}`,
    ...c.children.map((sub) => `/${c.slug}/${sub.slug}`),
  ]);

  // Netværkslinks fra instans
  const netvaerk = Array.isArray(site.netvaerk)
    ? (site.netvaerk as Array<{ navn: string; domaene: string; by: string }>)
    : [];

  const styleVariables = {
    "--site-accent": site.colors.accent,
    "--site-accent-strong": site.colors.accentStrong,
    "--site-accent-soft": site.colors.accentSoft,
    "--site-on-accent": site.colors.onAccent,
  } as React.CSSProperties;

  return (
    <div
      className={`site-wrapper ${newsreader.variable} ${inter.variable}`}
      style={styleVariables}
    >
      {/* Entitet: NewsMediaOrganization + WebSite (SearchAction). Samme @id'er refereres fra artikler/sider. */}
      <JsonLd data={siteGraph(site, resolveSeoConfig(site), siteBase(site))} />
      <SiteHeader
        siteNavn={site.navn}
        tagline={site.tagline}
        categories={categories.map((c) => ({ id: c.id, navn: c.navn, slug: c.slug }))}
        networkSites={networkLinks}
        currentDomaene={site.domaene}
        sectionPaths={sectionPaths}
      />

      <main id="hovedindhold" className="site-main-content">
        {children}
      </main>

      <BottomNav
        categories={categories.map((c) => ({
          id: c.id,
          navn: c.navn,
          slug: c.slug,
          children: c.children.map((sub) => ({ id: sub.id, navn: sub.navn, slug: sub.slug })),
        }))}
        areas={areas.map((a) => ({ id: a.id, navn: a.navn, slug: a.slug }))}
        siteNavn={site.navn}
        networkSites={networkLinks}
        currentDomaene={site.domaene}
        sectionPaths={sectionPaths}
      />

      <SiteFooter
        siteNavn={site.navn}
        tagline={site.tagline}
        categories={categories.map((c) => ({ id: c.id, navn: c.navn, slug: c.slug }))}
        netvaerk={netvaerk}
      />
    </div>
  );
}
