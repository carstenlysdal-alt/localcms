import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveAreaAction, deleteAreaAction } from "./actions";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { NoAccess } from "@/components/admin/no-access";
import { PAGE_PERMISSIONS } from "@/lib/redaktion-access";
import { Page, PageHeader } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, Split } from "@/components/ui/Layout";
import { DataTable, type DataTableColumn, type DataTableRow } from "@/components/ui/DataTable";
import { ConfirmSubmit } from "@/components/ui/Dialog";

const COLUMNS: DataTableColumn[] = [
  { key: "navn", header: "Område", sortable: true },
  { key: "slug", header: "Slug", sortable: true, hideOnMobile: true },
  { key: "koordinater", header: "Koordinater", hideOnMobile: true },
  { key: "artikler", header: "Artikler", sortable: true, align: "right" },
  { key: "handling", header: "Handling", srOnlyHeader: true, align: "right" },
];

export default async function OmraaderAdminPage() {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.omraader]);
  if (!user) return <NoAccess area="områdeadministration" />;

  const areas = await db.geoTag.findMany({
    where: { instansId: user.instansId },
    include: { _count: { select: { articles: true } } },
    orderBy: { navn: "asc" },
  });

  const rows: DataTableRow[] = areas.map((area) => ({
    id: area.id,
    sort: { navn: area.navn, slug: area.slug, artikler: area._count.articles },
    cells: {
      navn: <span className="ui-row ui-gap-sm ui-nowrap"><MapPin size={16} aria-hidden="true" className="cat-icon" /><strong>{area.navn}</strong></span>,
      slug: <code className="ui-code">{area.slug}</code>,
      koordinater: area.lat && area.lng ? <span className="ui-muted ui-small">{area.lat.toFixed(4)}, {area.lng.toFixed(4)}</span> : <span className="ui-muted">—</span>,
      artikler: <Badge tone="neutral">{area._count.articles} stk.</Badge>,
      handling: (
        <form action={deleteAreaAction.bind(null, area.id)} className="ui-inline-form">
          <ConfirmSubmit
            className="btn btn-secondary btn-sm cat-delete"
            title="Slet området?"
            message={`Området "${area.navn}" slettes. Artikler der er tilknyttet beholder deres indhold, men mister geografien.`}
            confirmLabel="Slet område"
            aria-label={`Slet ${area.navn}`}
            triggerTitle="Slet område"
          >
            <Trash2 size={14} aria-hidden="true" />
          </ConfirmSubmit>
        </form>
      ),
    },
  }));

  return (
    <Page>
      <PageHeader
        title="Områder"
        subtitle="Delområder og geografi i kommunen. Bruges til filtrering, sektioner og geografisk placering."
      />
      <Split
        asideWidth="md"
        main={
          <DataTable
            caption="Områder"
            columns={COLUMNS}
            rows={rows}
            defaultSort={{ key: "navn", direction: "asc" }}
            emptyTitle="Ingen områder oprettet endnu"
            emptyDescription="Opret det første delområde i formularen."
          />
        }
        aside={
          <Card title="Opret nyt delområde" icon={<Plus size={18} />}>
            <form action={saveAreaAction} className="ui-stack ui-gap-md">
              <Field label="Områdenavn" htmlFor="area-navn" required>
                <input id="area-navn" name="navn" type="text" placeholder="fx Korsør eller Vemmelev" required className="input" />
              </Field>
              <Field label="Slug (URL-sti)" htmlFor="area-slug" hint="Udfyldes automatisk ud fra navnet, hvis feltet er tomt.">
                <input id="area-slug" name="slug" type="text" placeholder="fx korsoer" className="input" aria-describedby="area-slug-hint" />
              </Field>
              <div className="ui-form-grid">
                <Field label="Breddegrad (lat)" htmlFor="area-lat">
                  <input id="area-lat" name="lat" type="number" step="any" placeholder="55.3292" className="input" />
                </Field>
                <Field label="Længdegrad (lng)" htmlFor="area-lng">
                  <input id="area-lng" name="lng" type="number" step="any" placeholder="11.1378" className="input" />
                </Field>
              </div>
              <div><button type="submit" className="btn btn-primary"><MapPin size={16} aria-hidden="true" /> Gem område</button></div>
            </form>
          </Card>
        }
      />
    </Page>
  );
}
