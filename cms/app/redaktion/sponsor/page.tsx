import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ExternalLink, Handshake } from "lucide-react";
import { SponsorListClient } from "./SponsorListClient";
import { Page, PageHeader } from "@/components/ui/Page";
import { NoAccess } from "@/components/admin/no-access";
import { PAGE_PERMISSIONS } from "@/lib/redaktion-access";

export default async function RedaktionSponsorPage() {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.sponsor]);
  if (!user) return <NoAccess area="sponsor- og partnerindhold" />;

  const briefs = await db.sponsorBrief.findMany({
    where: { instansId: user.instansId },
    include: {
      article: { select: { id: true, titel: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <Page>
      <PageHeader
        icon={<Handshake size={22} />}
        title="Sponsor og partnerindhold"
        subtitle="Styrk det lokale erhvervsliv med mærket partnerindhold. Modtag partnerbriefs, opret udkast med påkrævet deklaration og send citater til faktatjek."
        actions={
          <a href="/sponsor" target="_blank" rel="noreferrer" className="btn btn-secondary">
            Se offentlig partnerportal <ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (åbner i ny fane)</span>
          </a>
        }
      />
      <SponsorListClient briefs={briefs} />
    </Page>
  );
}
