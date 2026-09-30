import type { Metadata } from "next";
import { Bricolage_Grotesque, Literata } from "next/font/google";
import "@/styles/site.css";
import { getCurrentSite } from "@/lib/site";
import { getSiteNavigation } from "@/lib/site-queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { BottomNav } from "@/components/site/BottomNav";
import { SiteFooter } from "@/components/site/SiteFooter";

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const literata = Literata({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    metadataBase: new URL(`https://${site.domaene}`),
    title: {
      default: `${site.navn} — Lokaljournalistik`,
      template: `%s · ${site.navn}`,
    },
    description: site.tagline || `Uafhængigt lokalt nyhedsmedie for ${site.kommune}.`,
  };
}

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = await getCurrentSite();
  const { categories, areas } = await getSiteNavigation(site.id);

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
      className={`site-wrapper ${bricolage.variable} ${literata.variable}`}
      style={styleVariables}
    >
      <SiteHeader
        siteNavn={site.navn}
        tagline={site.tagline}
        categories={categories.map((c) => ({ id: c.id, navn: c.navn, slug: c.slug }))}
        netvaerk={netvaerk}
        currentDomaene={site.domaene}
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
