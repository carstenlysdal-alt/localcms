import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { assignmentTransitions } from "@/lib/assignments";
import { getFreshSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { claimAssignment, transitionAssignment } from "../actions";
import { Page, PageHeader } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Layout";

function localInput(date: Date | null) {
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getFreshSession();
  if (!session?.user) return null;
  const { id } = await params;
  const assignment = await db.assignment.findFirst({ where: { id, instansId: session.user.instansId }, include: { assignedAuthor: true, article: true, supportAgreement: true, honorEntry: true } });
  if (!assignment) notFound();
  const manager = can(session.user, PERMISSIONS.TASK_MANAGE);
  const assigned = Boolean(session.user.authorId && assignment.assignedAuthorId === session.user.authorId);
  if (!manager && !assigned && !assignment.iPulje) {
    return (
      <Page width="narrow">
        <Card tone="warn" title="Ingen adgang" headingLevel={1}>
          <div role="alert" className="ui-stack ui-gap-md">
            <p className="ui-section-text">Opgaven er tildelt en anden bidragyder.</p>
            <div><Link className="btn btn-secondary" href="/redaktion/opgaver">Til opgaver</Link></div>
          </div>
        </Card>
      </Page>
    );
  }
  const transitions = assignmentTransitions(assignment.status, manager ? "manager" : "assigned");
  const [authors, articles, agreements, rates] = manager ? await Promise.all([
    db.author.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" }, select: { id: true, navn: true } }),
    db.article.findMany({ where: { instansId: session.user.instansId, OR: [{ assignment: null }, { assignment: { id: assignment.id } }] }, orderBy: { createdAt: "desc" }, select: { id: true, titel: true } }),
    db.supportAgreement.findMany({ where: { instansId: session.user.instansId }, orderBy: { organisationNavn: "asc" }, select: { id: true, organisationNavn: true } }),
    db.honorRate.findMany({ where: { instansId: session.user.instansId, aktiv: true }, orderBy: { leverancetype: "asc" } }),
  ]) : [[], [], [], []];
  const fmt = (d: Date) => new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(d);
  return (
    <Page>
      <Link className="btn btn-ghost btn-sm ui-back" href="/redaktion/opgaver"><ChevronLeft size={16} aria-hidden="true" /> Opgaver</Link>
      <PageHeader
        eyebrow={assignment.leverancetype}
        title={assignment.titel}
        subtitle={`${assignment.assignedAuthor?.navn ?? (assignment.iPulje ? "Opgavepulje" : "Ikke tildelt")} · ${assignment.estimeretHonorar.toLocaleString("da-DK")} kr.`}
        badge={<Badge tone="neutral" dot>{assignment.status}</Badge>}
      />
      <div className="assignment-detail-grid">
        <div>
          {manager ? (
            <AssignmentForm value={{ id: assignment.id, titel: assignment.titel, beskrivelse: assignment.beskrivelse, leverancetype: assignment.leverancetype, researchDeadline: localInput(assignment.researchDeadline), afleveringsDeadline: localInput(assignment.afleveringsDeadline), estimeretHonorar: assignment.estimeretHonorar, assignedAuthorId: assignment.assignedAuthorId ?? "", articleId: assignment.articleId ?? "", supportAgreementId: assignment.supportAgreementId ?? "", iPulje: assignment.iPulje }} authors={authors} articles={articles} agreements={agreements} rates={rates} />
          ) : (
            <Card title="Brief" as="article">
              <p className="assignment-description">{assignment.beskrivelse}</p>
              {assignment.article ? <Link className="ui-link" href={`/redaktion/artikler/${assignment.article.id}`}>Åbn artikel <ExternalLink size={13} aria-hidden="true" /></Link> : null}
            </Card>
          )}
        </div>
        <aside className="assignment-sidebar" aria-label="Opgavens detaljer">
          <Card title="Deadlines" headingLevel={3} padding="sm">
            <dl className="assignment-facts">
              <div><dt>Research</dt><dd>{assignment.researchDeadline ? fmt(assignment.researchDeadline) : "Ikke sat"}</dd></div>
              <div><dt>Aflevering</dt><dd>{fmt(assignment.afleveringsDeadline)}</dd></div>
            </dl>
          </Card>
          <Card title="Interessekonflikt" headingLevel={3} padding="sm">
            <p>{assignment.interessekonflikt || "Ikke erklæret endnu."}</p>
            {assignment.interessekonflikt ? <Badge tone={assignment.konfliktGennemgaaet ? "success" : "review"} dot>{assignment.konfliktGennemgaaet ? "Gennemgået" : "Afventer gennemgang"}</Badge> : null}
          </Card>
          {assignment.honorEntry ? (
            <Card title="Honorar" headingLevel={3} padding="sm">
              <strong className="assignment-honor">{assignment.honorEntry.beloeb.toLocaleString("da-DK")} kr.</strong>
              <Badge tone="neutral">{assignment.honorEntry.status}</Badge>
            </Card>
          ) : null}
          {assignment.iPulje && session.user.authorId && !manager ? <form action={claimAssignment.bind(null, assignment.id)}><button className="btn btn-primary btn-block">Tag opgaven</button></form> : null}
          {transitions.length > 0 ? (
            <Card title="Næste skridt" headingLevel={3} padding="sm">
              {transitions.map((target) => (
                <form action={transitionAssignment.bind(null, assignment.id, target)} key={target} className="ui-stack ui-gap-sm">
                  {target === "Afleveret" ? (
                    <Field label="Interessekonflikt" htmlFor={`conflict-${target}`} required>
                      <textarea className="input" id={`conflict-${target}`} name="interessekonflikt" required placeholder="Skriv 'Ingen' eller beskriv relationen" />
                    </Field>
                  ) : null}
                  <button className={target === "Godkendt" ? "btn btn-primary btn-block" : "btn btn-secondary btn-block"}>{target}</button>
                </form>
              ))}
            </Card>
          ) : null}
        </aside>
      </div>
    </Page>
  );
}
