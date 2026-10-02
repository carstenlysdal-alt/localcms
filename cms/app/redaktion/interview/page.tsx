import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Mic, ExternalLink } from "lucide-react";
import { InterviewListClient } from "./InterviewListClient";
import { Page, PageHeader } from "@/components/ui/Page";
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
    <Page>
      <PageHeader
        icon={<Mic size={22} />}
        title="AI-kildeinterview"
        subtitle="Interaktive kildeinterviews med tale- eller tekstsvar. Gennemførte interviews transskriberes og klargøres til artikelkladde."
        actions={
          <a href="/interview" target="_blank" rel="noreferrer" className="btn btn-secondary">
            Se offentlig interviewportal <ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (åbner i ny fane)</span>
          </a>
        }
      />
      <InterviewListClient
        interviews={interviews.map((i) => ({
          ...i,
          // Kildekontakt og portal-link kræver SOURCE_VIEW_CONFIDENTIAL.
          token: showSources ? i.token : "",
          kildeKontakt: showSources ? i.kildeKontakt : i.kildeKontakt ? HIDDEN_CONTACT : "",
        }))}
      />
    </Page>
  );
}
