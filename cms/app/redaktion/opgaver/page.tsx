import Link from "next/link";
import { BriefcaseBusiness, Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { searchOr } from "@/lib/search";
import { claimAssignment } from "./actions";
import { Page, PageHeader } from "@/components/ui/Page";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/ui/FilterBar";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { SearchField } from "@/components/ui/SearchField";

function deadlineClass(deadline: Date, status: string) {
  if (["Godkendt", "Annulleret"].includes(status)) return "";
  const hours = (deadline.getTime() - Date.now()) / 3_600_000;
  return hours < 0 ? "deadline-overdue" : hours <= 48 ? "deadline-soon" : "";
}

const STATUSES = ["Åben", "Tildelt", "I gang", "Afleveret", "Godkendt", "Annulleret"];
const STATUS_TONE: Record<string, BadgeTone> = { Åben: "info", Tildelt: "planned", "I gang": "review", Afleveret: "draft", Godkendt: "success", Annulleret: "neutral" };

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const viewAll = can(session.user, PERMISSIONS.TASK_VIEW_ALL);
  const where: Prisma.AssignmentWhereInput = {
    instansId: session.user.instansId,
    ...(status ? { status } : {}),
    AND: [
      ...(query ? [{ OR: searchOr<Prisma.AssignmentWhereInput>(["titel", "beskrivelse"], query) }] : []),
      ...(!viewAll ? [{ OR: [{ assignedAuthorId: session.user.authorId ?? "__none__" }, { iPulje: true, status: "Åben" }] }] : []),
    ],
  };
  const assignments = await db.assignment.findMany({ where, include: { assignedAuthor: true, article: true }, orderBy: { afleveringsDeadline: "asc" } });
  const canManage = can(session.user, PERMISSIONS.TASK_MANAGE);

  const href = (s: string) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (s) p.set("status", s);
    const q = p.toString();
    return `/redaktion/opgaver${q ? `?${q}` : ""}`;
  };

  return (
    <Page>
      <PageHeader
        icon={<BriefcaseBusiness size={22} />}
        title="Opgaver"
        subtitle={`${assignments.length} ${assignments.length === 1 ? "opgave" : "opgaver"} i den aktuelle visning`}
        actions={canManage ? <Link className="btn btn-primary" href="/redaktion/opgaver/ny"><Plus size={16} aria-hidden="true" /> Ny opgave</Link> : undefined}
      />
      <LinkTabs label="Opgavestatus" items={[{ href: href(""), label: "Alle", active: !status }, ...STATUSES.map((s) => ({ href: href(s), label: s, active: status === s }))]} />
      <FilterBar label="Søg i opgaver" submitLabel="Søg" resetHref={query ? href(status) : undefined}>
        <SearchField label="Søg i opgaver" defaultValue={query} placeholder="Søg i opgaver" />
        {status ? <input type="hidden" name="status" value={status} /> : null}
      </FilterBar>
      {assignments.length ? (
        <div className="assignment-list">
          {assignments.map((item) => (
            <article className="assignment-row" key={item.id}>
              <div className="assignment-icon"><BriefcaseBusiness size={20} aria-hidden="true" /></div>
              <div>
                <span className="eyebrow">{item.leverancetype}</span>
                <Link href={`/redaktion/opgaver/${item.id}`}><strong>{item.titel}</strong></Link>
                <small>{item.assignedAuthor?.navn ?? (item.iPulje ? "Opgavepulje" : "Ikke tildelt")} · {item.article?.titel ?? "Ingen artikel"}</small>
              </div>
              <span className={`assignment-deadline ${deadlineClass(item.afleveringsDeadline, item.status)}`}>
                <small>Aflevering</small>
                {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(item.afleveringsDeadline)}
              </span>
              <Badge tone={STATUS_TONE[item.status] ?? "neutral"} dot>{item.status}</Badge>
              <strong className="assignment-fee">{item.estimeretHonorar.toLocaleString("da-DK")} kr.</strong>
              {item.iPulje && session.user.authorId && !canManage ? (
                <form action={claimAssignment.bind(null, item.id)}><button className="btn btn-primary btn-sm">Tag opgave</button></form>
              ) : (
                <Link className="btn btn-secondary btn-sm" href={`/redaktion/opgaver/${item.id}`}>Åbn</Link>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={<BriefcaseBusiness size={22} />} title="Ingen opgaver matcher filtrene" description="Prøv en anden status eller søgning." />
      )}
    </Page>
  );
}
