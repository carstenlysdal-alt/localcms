import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Mic, ExternalLink, Copy } from "lucide-react";
import { InterviewListClient } from "./InterviewListClient";
import { NoAccess } from "@/components/admin/no-access";
import { PAGE_PERMISSIONS, canViewSourceDetails, HIDDEN_CONTACT } from "@/lib/redaktion-access";

export default async function RedaktionInterviewPage() {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.interview]);
  if (!user) return <NoAccess area="kildeinterviews" />;
  const showSources = canViewSourceDetails(user);

  const interviews = await db.interviewSession.findMany({
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
            <Mic size={26} style={{ color: "#7c3aed" }} />
            <h1 style={{ margin: 0 }}>AI Kildeinterview</h1>
          </div>
          <p className="text-muted" style={{ marginTop: "4px" }}>
            Interaktive kildeinterviews med tale- eller tekstsvar. Gennemførte interviews transskriberes og klargøres til artikelkladde.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <a href="/interview" target="_blank" rel="noreferrer" className="btn btn-secondary">
            Se offentlig interviewportal ↗
          </a>
        </div>
      </div>

      <InterviewListClient
        interviews={interviews.map((i) => ({
          ...i,
          // Kildekontakt og portal-link kræver SOURCE_VIEW_CONFIDENTIAL.
          token: showSources ? i.token : "",
          kildeKontakt: showSources ? i.kildeKontakt : i.kildeKontakt ? HIDDEN_CONTACT : "",
        }))}
      />
    </main>
  );
}
