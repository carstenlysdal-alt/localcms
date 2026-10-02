import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { SponsorListClient } from "./SponsorListClient";
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
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Handshake size={26} style={{ color: "#065f46" }} />
            <h1 style={{ margin: 0 }}>Sponsor- & Partnerindhold</h1>
          </div>
          <p className="text-muted" style={{ marginTop: "4px" }}>
            Styrk det lokale erhvervsliv med mærket partnerindhold. Modtag partnerbriefs, opret udkast med påkrævet deklaration og send citater til faktatjek.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <a href="/sponsor" target="_blank" rel="noreferrer" className="btn btn-secondary">
            Se offentlig partnerportal ↗
          </a>
        </div>
      </div>

      <SponsorListClient briefs={briefs} />
    </main>
  );
}
