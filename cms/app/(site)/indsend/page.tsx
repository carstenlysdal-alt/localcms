import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { SubmissionForm } from "@/components/site/SubmissionForm";
import { MessageSquarePlus, ShieldCheck, Mail } from "lucide-react";

import { ThreeStepSubmissionWizard } from "@/components/site/ThreeStepSubmissionWizard";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Indsend historie — ${site.navn}`,
    description: `Har du en historie, et tip, et arrangement eller et opslag til ${site.navn}? Vi lytter til vores læsere i ${site.kommune}.`,
  };
}

export default async function SubmissionPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = await getCurrentSite();
  const query = searchParams ? await searchParams : {};
  const kategoriParam = typeof query.kategori === "string" ? query.kategori : "tip";

  const areas = await db.geoTag.findMany({
    where: { instansId: site.id },
    orderBy: { navn: "asc" },
    select: { id: true, navn: true },
  });

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "640px" }}>
        <ThreeStepSubmissionWizard
          siteNavn={site.navn}
          kommuneNavn={site.kommune}
          areas={areas}
          initialCategory={kategoriParam}
        />
      </div>
    </div>
  );
}

