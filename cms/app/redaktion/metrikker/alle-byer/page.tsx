import { redirect } from "next/navigation";
import { BarChart3, BookOpen, Eye, Newspaper, UserPlus } from "lucide-react";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessibleInstanceIds } from "@/lib/instance-access";
import { loadNavCities, switchableCount } from "@/lib/shell-cities";
import { PAGE_PERMISSIONS } from "@/lib/redaktion-access";
import { NoAccess } from "@/components/admin/no-access";
import { CityTabs } from "@/components/admin/city-switcher";
import { Page, PageHeader } from "@/components/ui/Page";
import { CityLabel } from "@/components/ui/CityDot";
import { DataTable, type DataTableColumn, type DataTableRow } from "@/components/ui/DataTable";
import { Grid, Notice } from "@/components/ui/Layout";
import { SegmentedLinks } from "@/components/ui/SegmentedLinks";
import { StatCard } from "@/components/ui/StatCard";
import { Bars } from "@/components/charts";
import { RANGES, inRange, parseRange, pctDelta, periodBounds, ratio, sumMetrics } from "../_lib/aggregate";

export const metadata = { title: "Analytics i alle byer — Redaktion" };

const nr = (n: number) => n.toLocaleString("da-DK");
const pct = (n: number) => `${n.toLocaleString("da-DK", { maximumFractionDigits: 0 })} %`;

/**
 * Analytics "Alle byer": samlede totaler og et søjlediagram pr. by for de byer brugeren har adgang til. Skrivebeskyttet og
 * afgrænset på serveren (hjem + adgangsrækker i databasen, aldrig fra URL/klient). Samme målemetode som byens egen Analytics:
 * totaler på artikler publiceret i perioden. Detaljer (forside, nyhedsbrev, annoncer) ses pr. by ved at vælge byen.
 */
export default async function AllCitiesMetricsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.metrikker]);
  if (!user) return <NoAccess area="metrikker" />;
  const ids = await accessibleInstanceIds(user.id, user.homeInstansId);
  if (ids.length < 2) redirect("/redaktion/metrikker");

  const range = parseRange(((await searchParams) ?? {}).dage);
  const period = periodBounds(new Date(), range);
  const [cities, instances, articles, subs] = await Promise.all([
    loadNavCities(user),
    db.instance.findMany({ where: { id: { in: ids } }, select: { id: true, navn: true } }),
    db.article.findMany({
      where: { instansId: { in: ids }, status: "Publiceret", publiceretTid: { gte: period.prevStart, lte: period.end } },
      select: { instansId: true, publiceretTid: true, metric: { select: { visninger: true, laesninger: true, totalLaesetidSek: true } } },
    }),
    db.newsletterSubscriber.groupBy({ by: ["instansId"], where: { instansId: { in: ids }, aktiv: true }, _count: { _all: true } }),
  ]);
  const zero = { visninger: 0, laesninger: 0, totalLaesetidSek: 0 };
  const metricOf = (a: (typeof articles)[number]) => a.metric ?? zero;
  const cur = articles.filter((a) => a.publiceretTid && inRange(a.publiceretTid, period.start));
  const prev = articles.filter((a) => a.publiceretTid && inRange(a.publiceretTid, period.prevStart, period.start));
  const subsOf = new Map(subs.map((s) => [s.instansId, s._count._all]));

  const perCity = instances
    .map((i) => {
      const mine = cur.filter((a) => a.instansId === i.id);
      const m = sumMetrics(mine.map(metricOf));
      return { id: i.id, by: i.navn.replace(/Lokalt$/i, ""), artikler: mine.length, visninger: m.visninger, laesninger: m.laesninger, abonnenter: subsOf.get(i.id) ?? 0 };
    })
    .sort((a, b) => b.visninger - a.visninger || a.by.localeCompare(b.by, "da"));

  const curM = sumMetrics(cur.map(metricOf));
  const prevM = sumMetrics(prev.map(metricOf));
  const vsLabel = `mod forrige ${range} dage`;
  const dViews = pctDelta(curM.visninger, prevM.visninger);
  const totalSubs = perCity.reduce((a, c) => a + c.abonnenter, 0);

  const columns: DataTableColumn[] = [
    { key: "by", header: "By", sortable: true },
    { key: "artikler", header: "Artikler", sortable: true, align: "right" },
    { key: "visninger", header: "Visninger", sortable: true, align: "right" },
    { key: "laesninger", header: "Læsninger", sortable: true, align: "right", hideOnMobile: true },
    { key: "engagement", header: "Engagement", sortable: true, align: "right", hideOnMobile: true },
    { key: "abonnenter", header: "Aktive abonnenter", sortable: true, align: "right", hideOnMobile: true },
  ];
  const rows: DataTableRow[] = perCity.map((c) => {
    const eng = ratio(c.laesninger, c.visninger);
    return {
      id: c.id,
      sort: { by: c.by, artikler: c.artikler, visninger: c.visninger, laesninger: c.laesninger, engagement: eng ?? 0, abonnenter: c.abonnenter },
      cells: { by: <CityLabel city={c.by} />, artikler: nr(c.artikler), visninger: <strong>{nr(c.visninger)}</strong>, laesninger: nr(c.laesninger), engagement: eng === null ? "–" : pct(eng * 100), abonnenter: nr(c.abonnenter) },
    };
  });

  return (
    <Page width="wide">
      <PageHeader
        icon={<BarChart3 size={22} />}
        title="Analytics i alle byer"
        subtitle={`Samlede tal for ${perCity.length} byer, du har adgang til. Skrivebeskyttet — vælg en by for detaljer.`}
        actions={<SegmentedLinks label="Periode" items={RANGES.map((r) => ({ href: `/redaktion/metrikker/alle-byer${r === 28 ? "" : `?dage=${r}`}`, label: `${r} dage`, active: r === range }))} />}
      />
      <CityTabs cities={cities} label="By" allHref={switchableCount(cities) > 1 ? "/redaktion/metrikker/alle-byer" : null} allActive />
      <Notice tone="info" className="analytics-note">
        Totalerne omfatter kun de byer, du har adgang til. Visninger og læsninger er totaler på de artikler, der er publiceret i perioden.
      </Notice>
      <Grid cols={4}>
        <StatCard label="Sidevisninger" icon={<Eye size={16} />} value={nr(curM.visninger)} delta={dViews === null ? undefined : { value: dViews, label: vsLabel }} hint={`På ${nr(cur.length)} artikler`} />
        <StatCard label="Læsninger" icon={<BookOpen size={16} />} value={nr(curM.laesninger)} delta={pctDelta(curM.laesninger, prevM.laesninger) === null ? undefined : { value: pctDelta(curM.laesninger, prevM.laesninger) as number, label: vsLabel }} />
        <StatCard label="Artikler publiceret" icon={<Newspaper size={16} />} value={nr(cur.length)} delta={pctDelta(cur.length, prev.length) === null ? undefined : { value: pctDelta(cur.length, prev.length) as number, label: vsLabel }} />
        <StatCard label="Aktive abonnenter" icon={<UserPlus size={16} />} value={nr(totalSubs)} hint="Nyhedsbrev, alle dine byer" />
      </Grid>
      <Bars
        title="Sidevisninger pr. by"
        description="Artikler publiceret i perioden."
        categories={perCity.map((c) => c.by)}
        orientation="horizontal"
        series={[{ id: "visninger", label: "Visninger", values: perCity.map((c) => c.visninger) }]}
        emptyText="Ingen målinger i perioden."
      />
      <DataTable caption="Nøgletal pr. by" columns={columns} rows={rows} defaultSort={{ key: "visninger", direction: "desc" }} emptyTitle="Ingen byer" />
    </Page>
  );
}
