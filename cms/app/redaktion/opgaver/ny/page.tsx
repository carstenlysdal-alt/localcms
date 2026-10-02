import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { Page, PageHeader } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";

export default async function NewAssignmentPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (!can(session.user, PERMISSIONS.TASK_MANAGE)) {
    return (
      <Page width="narrow">
        <Card tone="warn" title="Ingen adgang" headingLevel={1}>
          <div role="alert" className="ui-stack ui-gap-md">
            <p className="ui-section-text">Kun redaktionel ledelse kan oprette opgaver.</p>
            <div><Link className="btn btn-secondary" href="/redaktion/opgaver">Til opgaver</Link></div>
          </div>
        </Card>
      </Page>
    );
  }
  const [authors, articles, agreements, rates] = await Promise.all([
    db.author.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" }, select: { id: true, navn: true } }),
    db.article.findMany({ where: { instansId: session.user.instansId, assignment: null }, orderBy: { createdAt: "desc" }, select: { id: true, titel: true } }),
    db.supportAgreement.findMany({ where: { instansId: session.user.instansId }, orderBy: { organisationNavn: "asc" }, select: { id: true, organisationNavn: true } }),
    db.honorRate.findMany({ where: { instansId: session.user.instansId, aktiv: true }, orderBy: { leverancetype: "asc" } }),
  ]);
  const initialType = "Standardartikel";
  const initialFee = rates.find((rate) => rate.leverancetype === initialType)?.standard ?? 800;
  return (
    <Page width="narrow">
      <Link className="btn btn-ghost btn-sm ui-back" href="/redaktion/opgaver"><ChevronLeft size={16} aria-hidden="true" /> Opgaver</Link>
      <PageHeader title="Ny opgave" subtitle="Beskriv briefen, sæt deadlines og honorar, og tildel eller slå op i puljen." />
      <AssignmentForm value={{ id: null, titel: "", beskrivelse: "", leverancetype: initialType, researchDeadline: "", afleveringsDeadline: "", estimeretHonorar: initialFee, assignedAuthorId: "", articleId: "", supportAgreementId: "", iPulje: false }} authors={authors} articles={articles} agreements={agreements} rates={rates} />
    </Page>
  );
}
