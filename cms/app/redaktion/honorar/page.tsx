import { CheckCircle, Clock, Download, Hash, WalletCards } from "lucide-react";
import { getFreshSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { approveHonor } from "./actions";
import { Page, PageHeader } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Grid } from "@/components/ui/Layout";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, type DataTableColumn, type DataTableRow } from "@/components/ui/DataTable";

const COLUMNS: DataTableColumn[] = [
  { key: "opgave", header: "Opgave og artikel", sortable: true },
  { key: "modtager", header: "Modtager", sortable: true, hideOnMobile: true },
  { key: "oprettet", header: "Oprettet", sortable: true, hideOnMobile: true },
  { key: "status", header: "Status", sortable: true },
  { key: "beloeb", header: "Beløb", sortable: true, align: "right" },
  { key: "handling", header: "Handling", srOnlyHeader: true, align: "right" },
];

export default async function HonorPage() {
  const session = await getFreshSession();
  if (!session?.user) return null;
  const viewAll = can(session.user, PERMISSIONS.HONORAR_VIEW);
  const viewOwn = can(session.user, PERMISSIONS.HONOR_VIEW_OWN) && session.user.authorId;
  if (!viewAll && !viewOwn) {
    return (
      <Page width="narrow">
        <Card tone="warn" title="Ingen adgang" headingLevel={1}>
          <p role="alert" className="ui-section-text">Din rolle har ikke adgang til honorardata.</p>
        </Card>
      </Page>
    );
  }
  const entries = await db.honorEntry.findMany({ where: { instansId: session.user.instansId, ...(!viewAll ? { authorId: session.user.authorId! } : {}) }, include: { author: true, article: true, assignment: true, approvedBy: true }, orderBy: { generatedAt: "desc" } });
  const pending = entries.filter((item) => item.status === "Afventer").reduce((sum, item) => sum + item.beloeb, 0);
  const approved = entries.filter((item) => item.status !== "Afventer").reduce((sum, item) => sum + item.beloeb, 0);
  const canManage = can(session.user, PERMISSIONS.HONOR_MANAGE);

  const rows: DataTableRow[] = entries.map((entry) => ({
    id: entry.id,
    sort: { opgave: entry.assignment.titel, modtager: entry.author.navn, oprettet: entry.generatedAt.getTime(), status: entry.status, beloeb: entry.beloeb },
    cells: {
      opgave: <div className="ui-stack"><strong>{entry.assignment.titel}</strong><span className="ui-small ui-muted">{entry.article.titel}</span></div>,
      modtager: entry.author.navn,
      oprettet: new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(entry.generatedAt),
      status: <Badge tone={entry.status === "Godkendt" ? "success" : "review"} dot>{entry.status}</Badge>,
      beloeb: <strong>{entry.beloeb.toLocaleString("da-DK")} kr.</strong>,
      handling: canManage && entry.status === "Afventer" ? <form action={approveHonor.bind(null, entry.id)} className="ui-inline-form"><button className="btn btn-primary btn-sm">Godkend</button></form> : null,
    },
  }));

  return (
    <Page>
      <PageHeader
        icon={<WalletCards size={22} />}
        title="Honorar"
        subtitle={viewAll ? "Samlet fakturagrundlag" : "Dine honorarer"}
        actions={viewAll ? <a className="btn btn-secondary" href="/api/honorar/export" download><Download size={16} aria-hidden="true" /> Eksportér CSV</a> : undefined}
      />
      <Grid cols={3}>
        <StatCard label="Afventer godkendelse" icon={<Clock size={16} />} value={`${pending.toLocaleString("da-DK")} kr.`} />
        <StatCard label="Godkendt / eksporteret" icon={<CheckCircle size={16} />} value={`${approved.toLocaleString("da-DK")} kr.`} />
        <StatCard label="Antal posteringer" icon={<Hash size={16} />} value={entries.length.toLocaleString("da-DK")} />
      </Grid>
      <div className="page-section">
        <DataTable
          caption="Honorarposteringer"
          columns={COLUMNS}
          rows={rows}
          defaultSort={{ key: "oprettet", direction: "desc" }}
          emptyTitle="Ingen honorarposteringer endnu"
          emptyDescription="De oprettes automatisk ved publicering af en koblet opgave."
        />
      </div>
    </Page>
  );
}
