import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdGeneratorForm } from "@/components/admin/AdGeneratorForm";
import { toggleCampaignStatusAction, deleteCampaignAction } from "./actions";
import { Banknote, Eye, Megaphone, MousePointerClick, Trash2 } from "lucide-react";
import { NoAccess } from "@/components/admin/no-access";
import { AD_MANAGE_PERMISSIONS, PAGE_PERMISSIONS } from "@/lib/redaktion-access";
import { can } from "@/lib/permissions";
import { Page, PageHeader } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { Grid } from "@/components/ui/Layout";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, type DataTableColumn, type DataTableRow } from "@/components/ui/DataTable";
import { ConfirmSubmit } from "@/components/ui/Dialog";

const COLUMNS: DataTableColumn[] = [
  { key: "kampagne", header: "Kampagne og annoncør", sortable: true },
  { key: "format", header: "Format og placering", hideOnMobile: true },
  { key: "periode", header: "Periode", sortable: true, hideOnMobile: true },
  { key: "pris", header: "Pris", sortable: true, align: "right" },
  { key: "visninger", header: "Visninger / klik", sortable: true, align: "right", hideOnMobile: true },
  { key: "ctr", header: "CTR", sortable: true, align: "right" },
  { key: "status", header: "Status", sortable: true },
  { key: "handling", header: "Handlinger", srOnlyHeader: true, align: "right" },
];

const dayMonth = (d: Date) => d.toLocaleDateString("da-DK", { day: "numeric", month: "short" });

export default async function AnnoncerPage() {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.annoncer]);
  if (!user) return <NoAccess area="annoncer og kampagner" />;
  // SUPPORT_READ giver kun læseadgang; ændringer kræver ADS_MANAGE/SUPPORT_MANAGE (og håndhæves igen i actions).
  const canManage = AD_MANAGE_PERMISSIONS.some((p) => can(user, p));

  const instansId = user.instansId;

  const campaigns = await db.adCampaign.findMany({
    where: { instansId },
    orderBy: { createdAt: "desc" },
  });

  const aktiveCount = campaigns.filter((c) => c.status === "Aktiv").length;
  const totalOmsaetning = campaigns.reduce((acc, c) => acc + c.pris, 0);
  const totalVisninger = campaigns.reduce((acc, c) => acc + c.visninger, 0);
  const totalKlik = campaigns.reduce((acc, c) => acc + c.klik, 0);
  const samletCtr = totalVisninger > 0 ? ((totalKlik / totalVisninger) * 100).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;

  const rows: DataTableRow[] = campaigns.map((camp) => {
    const ctr = camp.visninger > 0 ? (camp.klik / camp.visninger) * 100 : 0;
    const isAktiv = camp.status === "Aktiv";
    const formatLabel = camp.format === "IN_FEED_BANNER" ? "In-feed display" : camp.format === "EVENT_POST" ? "Event post" : "Native premium";
    return {
      id: camp.id,
      sort: { kampagne: camp.titel, periode: camp.startDato.getTime(), pris: camp.pris, visninger: camp.visninger, ctr, status: camp.status },
      cells: {
        kampagne: (
          <div className="ui-stack">
            <strong>{camp.titel}</strong>
            <span className="ui-small ui-muted">{camp.annoncoer}</span>
          </div>
        ),
        format: (
          <div className="ui-stack">
            <span><Badge tone="neutral">{formatLabel}</Badge></span>
            <span className="ui-small ui-muted">Zone: {camp.placeringZone}</span>
          </div>
        ),
        periode: <span className="ui-small">{dayMonth(camp.startDato)} – {dayMonth(camp.slutDato)}</span>,
        pris: <strong>{camp.pris.toLocaleString("da-DK")} kr.</strong>,
        visninger: (
          <div className="ui-stack">
            <span><strong>{camp.visninger.toLocaleString("da-DK")}</strong> visninger</span>
            <span className="ui-small ui-muted">{camp.klik.toLocaleString("da-DK")} klik</span>
          </div>
        ),
        ctr: <Badge tone="success">{ctr.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</Badge>,
        status: <Badge tone={isAktiv ? "success" : "review"} dot>{camp.status}</Badge>,
        handling: canManage ? (
          <div className="ui-actions ui-justify-end">
            <form action={toggleCampaignStatusAction.bind(null, camp.id, camp.status)} className="ui-inline-form">
              <button type="submit" className="btn btn-secondary btn-sm">{isAktiv ? "Pause" : "Aktivér"}</button>
            </form>
            <form action={deleteCampaignAction.bind(null, camp.id)} className="ui-inline-form">
              <ConfirmSubmit
                className="btn btn-secondary btn-sm cat-delete"
                title="Slet kampagnen?"
                message={`Kampagnen "${camp.titel}" slettes permanent og forsvinder fra sitet.`}
                confirmLabel="Slet kampagne"
                aria-label={`Slet ${camp.titel}`}
                triggerTitle="Slet kampagne"
              >
                <Trash2 size={14} aria-hidden="true" />
              </ConfirmSubmit>
            </form>
          </div>
        ) : (
          <span className="ui-muted ui-small">Kun visning</span>
        ),
      },
    };
  });

  return (
    <Page>
      <PageHeader title="Annoncer" icon={<Megaphone size={22} />} subtitle="First-party native annoncering, in-feed display og event-posts på sitet." />

      <Grid cols={4}>
        <StatCard label="Samlet kampagnepris" icon={<Banknote size={16} />} value={`${totalOmsaetning.toLocaleString("da-DK")} kr.`} hint="Sum af aftalte priser" />
        <StatCard label="Aktive kampagner" icon={<Megaphone size={16} />} value={aktiveCount.toLocaleString("da-DK")} hint={`${campaigns.length} kampagner i alt`} />
        <StatCard label="Samlede visninger" icon={<Eye size={16} />} value={totalVisninger.toLocaleString("da-DK")} />
        <StatCard label="Gennemsnitlig CTR" icon={<MousePointerClick size={16} />} value={samletCtr ? `${samletCtr} %` : undefined} empty={samletCtr ? undefined : "Ingen visninger endnu"} hint={`${totalKlik.toLocaleString("da-DK")} klik`} />
      </Grid>

      <div className="page-section">
        {canManage && <AdGeneratorForm />}
        <DataTable
          caption="Kampagner"
          columns={COLUMNS}
          rows={rows}
          emptyTitle="Ingen kampagner oprettet endnu"
          emptyDescription={canManage ? "Brug generatoren ovenfor til at oprette din første annonce." : "Der er ikke oprettet kampagner endnu."}
        />
      </div>
    </Page>
  );
}
