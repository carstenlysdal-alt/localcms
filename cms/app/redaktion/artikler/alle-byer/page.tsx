import Link from "next/link";
import { redirect } from "next/navigation";
import { Newspaper } from "lucide-react";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessibleInstanceIds } from "@/lib/instance-access";
import { searchOr } from "@/lib/search";
import { loadNavCities, switchableCount } from "@/lib/shell-cities";
import { ALL_STATUSES, buildWhere, parseListParams, type ListTab } from "@/lib/editor/list-query";
import { Page, PageHeader } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { CityLabel } from "@/components/ui/CityDot";
import { DataTable, type DataTableColumn, type DataTableRow } from "@/components/ui/DataTable";
import { Notice } from "@/components/ui/Layout";
import { CityOpenLink, CityTabs } from "@/components/admin/city-switcher";

export const metadata = { title: "Artikler i alle byer — Redaktion" };

const TABS: ListTab[] = ["Alle", "Planlagt", "Publiceret", "Kladder"];
const MAX_ROWS = 200;
const fmt = (d: Date) => d.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Copenhagen" });

/**
 * "Alle byer": skrivebeskyttet samlet artikelliste for de byer brugeren har adgang til. Byerne afgøres UDELUKKENDE på serveren
 * (hjem + adgangsrækker i databasen) — aldrig af URL eller klient. En artikel åbnes i sin egen by: er den ikke aktiv, skiftes
 * byen først (serveren tjekker adgangen igen), og artiklen åbnes bagefter i den almindelige redigering.
 */
export default async function AllCitiesArticlesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthorizedUser();
  if (!user) return null;
  const ids = await accessibleInstanceIds(user.id, user.homeInstansId);
  if (ids.length < 2) redirect("/redaktion/artikler");

  const p = parseListParams(await searchParams);
  const [cities, instances] = await Promise.all([loadNavCities(user), db.instance.findMany({ where: { id: { in: ids } }, select: { id: true, navn: true } })]);
  const cityOf = new Map(instances.map((i) => [i.id, i.navn.replace(/Lokalt$/i, "")]));
  // Samme filtre som den almindelige liste, men (kun) over brugerens egne byer. Forfatter-filteret er pr. by og udelades her.
  const where = { ...buildWhere({ ...p, forfatter: "" }, user.instansId, (fields, q) => searchOr(fields, q)), instansId: { in: ids } };
  const rows = await db.article.findMany({
    where,
    select: { id: true, titel: true, status: true, opdateretTid: true, instansId: true, breaking: true, forfatter: { select: { navn: true } } },
    orderBy: { opdateretTid: p.sort },
    take: MAX_ROWS,
  });

  const tabHref = (tab: ListTab) => {
    const q = new URLSearchParams();
    if (tab !== "Alle") q.set("tab", tab);
    if (p.q) q.set("q", p.q);
    const s = q.toString();
    return `/redaktion/artikler/alle-byer${s ? `?${s}` : ""}`;
  };
  const columns: DataTableColumn[] = [
    { key: "by", header: "By", sortable: true },
    { key: "titel", header: "Artikel", sortable: true },
    { key: "status", header: "Status", sortable: true, hideOnMobile: true },
    { key: "forfatter", header: "Forfatter", hideOnMobile: true },
    { key: "opdateret", header: "Opdateret", sortable: true, hideOnMobile: true },
  ];
  const tableRows: DataTableRow[] = rows.map((a) => {
    const city = cityOf.get(a.instansId) ?? "Ukendt by";
    return {
      id: a.id,
      sort: { by: city, titel: a.titel, status: a.status, opdateret: a.opdateretTid.getTime() },
      cells: {
        by: <CityLabel city={city} />,
        titel: (
          <div className="ui-stack">
            <CityOpenLink instansId={a.instansId} current={a.instansId === user.instansId} href={`/redaktion/artikler?id=${encodeURIComponent(a.id)}`}>{a.titel}</CityOpenLink>
            {a.instansId !== user.instansId ? <span className="ui-small ui-muted">Skifter til {city} og åbner artiklen</span> : null}
          </div>
        ),
        status: <Badge tone={a.status === "Publiceret" ? "success" : "neutral"}>{a.status}</Badge>,
        forfatter: a.forfatter?.navn ?? <span className="ui-muted">–</span>,
        opdateret: fmt(a.opdateretTid),
      },
    };
  });

  return (
    <Page width="wide">
      <PageHeader icon={<Newspaper size={22} />} title="Artikler i alle byer" subtitle={`Samlet overblik over ${ids.length} byer. Listen er skrivebeskyttet — du redigerer i én by ad gangen.`} />
      <CityTabs cities={cities} label="By" allHref={switchableCount(cities) > 1 ? "/redaktion/artikler/alle-byer" : null} allActive />
      <nav className="ui-tablist ui-linktabs" aria-label="Artikelvisninger">
        {TABS.map((t) => <Link key={t} className="ui-tab" aria-current={p.tab === t ? "page" : undefined} href={tabHref(t)}>{t}</Link>)}
      </nav>
      <form className="ui-row" action="/redaktion/artikler/alle-byer" method="get">
        {p.tab !== "Alle" && <input type="hidden" name="tab" value={p.tab} />}
        <label className="sr-only" htmlFor="ab-q">Søg på titel</label>
        <input className="input" id="ab-q" name="q" defaultValue={p.q} placeholder="Søg på titel" />
        <select className="input" name="status" defaultValue={p.status} aria-label="Status">
          <option value="">Alle statusser</option>
          {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-secondary" type="submit">Filtrér</button>
      </form>
      {rows.length === MAX_ROWS ? <Notice tone="info">Viser de seneste {MAX_ROWS} artikler. Brug søgning eller filtre for at indsnævre.</Notice> : null}
      <DataTable caption="Artikler på tværs af dine byer" columns={columns} rows={tableRows} defaultSort={{ key: "opdateret", direction: p.sort }} emptyTitle="Ingen artikler i denne visning" />
    </Page>
  );
}
