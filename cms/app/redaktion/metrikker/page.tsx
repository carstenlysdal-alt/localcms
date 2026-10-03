import Link from "next/link";
import { Activity, BarChart3, BookOpen, CheckCircle2, Clock, Eye, Flame, Megaphone, Newspaper, ShieldAlert, Sparkles, UserPlus } from "lucide-react";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getNetworkLinks } from "@/lib/site";
import { networkHref } from "@/lib/network-sites";
import { distributeArticles, type ArticleDistributionInput } from "@/lib/distribution-engine";
import { NoAccess } from "@/components/admin/no-access";
import { PAGE_PERMISSIONS } from "@/lib/redaktion-access";
import { Page, PageHeader } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CityDot } from "@/components/ui/CityDot";
import { DataTable, type DataTableColumn, type DataTableRow } from "@/components/ui/DataTable";
import { Grid, Notice } from "@/components/ui/Layout";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { SegmentedLinks } from "@/components/ui/SegmentedLinks";
import { StatCard } from "@/components/ui/StatCard";
import { Bars, Donut, Heatmap, LineArea, Sparkline } from "@/components/charts";
import {
  HOURS, RANGES, WEEKDAYS, avgReadSeconds, bucketByDay, countBy, dayKey, formatDuration, inRange, parseRange, pctDelta,
  periodBounds, periodDays, ratio, shortDay, sumMetrics, weekdayHourMatrix,
} from "./_lib/aggregate";

export const metadata = { title: "Analytics — Redaktion" };

const pct = (n: number, digits = 1) => `${n.toLocaleString("da-DK", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
const nr = (n: number) => n.toLocaleString("da-DK");

/** Hvad der mangler for at tallet kan vises (ærlige "kobles til"-kort). */
const MISSING = {
  unikke: "Kræver at hver besøgende kan genkendes uden cookies (fx en dagligt roterende hash). Sporingen tæller i dag kun visninger og læsninger.",
  konverteringer: "Kræver at tilmeldinger, støtteaftaler og indsendelser knyttes til den artikel eller kilde, de kom fra.",
  nyhedsbrevCtr: "Kræver at nyhedsbrevet sendes fra systemet og at klik på links registreres. Der findes ingen afsendelses- eller klikdata endnu.",
  kilder: "Kræver at henvisningskilde (søgning, sociale medier, direkte, nyhedsbrev) gemmes ved hver visning. Det registreres ikke i dag.",
  enhed: "Kræver at enhedstype (mobil, tablet, computer) gemmes ved hver visning. Det registreres ikke i dag.",
  timer: "Kræver visninger gemt pr. time. I dag lægges visningerne kun sammen pr. artikel, uden tidspunkt.",
} as const;

function Unavailable({ title, reason }: { title: string; reason: string }) {
  return (
    <Card tone="muted" title={title} headingLevel={3}>
      <p className="ui-unavailable-title">Kobles til når sporing er slået til</p>
      <p className="ui-section-text">{reason}</p>
    </Card>
  );
}

export default async function MetrikkerPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.metrikker]);
  if (!user) return <NoAccess area="metrikker" />;

  const params = (await searchParams) ?? {};
  const range = parseRange(params.dage);
  const now = new Date();
  const period = periodBounds(now, range);
  const days = periodDays(period);
  const instansId = user.instansId;

  const [instance, network, publishedAll, cohortArticles, slotRows, subscribers, statusCounts, campaigns] = await Promise.all([
    db.instance.findUnique({ where: { id: instansId }, select: { domaene: true, navn: true } }),
    getNetworkLinks().catch(() => []),
    // Til den algoritmiske placering (uændret): alle publicerede artikler med måling.
    db.article.findMany({
      where: { instansId, status: "Publiceret" },
      include: { metric: true, kategori: { include: { parent: true } }, forfatter: true, geoTags: true },
      orderBy: { publiceretTid: "desc" },
    }),
    // Artikler publiceret i denne og forrige periode (til KPI, delta, søjler, varmekort).
    db.article.findMany({
      where: { instansId, status: "Publiceret", publiceretTid: { gte: period.prevStart, lte: period.end } },
      select: { id: true, titel: true, publiceretTid: true, indholdstype: true, kategori: { select: { navn: true, parent: { select: { navn: true } } } }, metric: { select: { visninger: true, laesninger: true, totalLaesetidSek: true } } },
    }),
    db.frontpageSlotMetric.findMany({ where: { instansId, day: { gte: dayKey(period.prevStart) } }, select: { day: true, moduleId: true, impressions: true, clicks: true } }),
    db.newsletterSubscriber.findMany({ where: { instansId }, select: { createdAt: true, aktiv: true } }),
    db.article.groupBy({ by: ["status"], where: { instansId }, _count: { _all: true } }),
    db.adCampaign.findMany({ where: { instansId }, select: { status: true, pris: true, visninger: true, klik: true, createdAt: true } }),
  ]);

  // ── Periodens artikler (kohorte) ─────────────────────────────────────────
  const metricOf = (a: (typeof cohortArticles)[number]) => a.metric ?? { visninger: 0, laesninger: 0, totalLaesetidSek: 0 };
  const cur = cohortArticles.filter((a) => a.publiceretTid && inRange(a.publiceretTid, period.start));
  const prev = cohortArticles.filter((a) => a.publiceretTid && inRange(a.publiceretTid, period.prevStart, period.start));
  const curM = sumMetrics(cur.map(metricOf));
  const prevM = sumMetrics(prev.map(metricOf));
  const engagement = ratio(curM.laesninger, curM.visninger);
  const prevEngagement = ratio(prevM.laesninger, prevM.visninger);
  const readSec = avgReadSeconds(curM);
  const prevReadSec = avgReadSeconds(prevM);

  // ── Forside (rigtige daglige data) ───────────────────────────────────────
  const slotCur = slotRows.filter((r) => r.day >= dayKey(period.start));
  const slotPrev = slotRows.filter((r) => r.day < dayKey(period.start));
  const impPerDay = bucketByDay(slotCur, days, (r) => r.day, (r) => r.impressions);
  const clickPerDay = bucketByDay(slotCur, days, (r) => r.day, (r) => r.clicks);
  const ctrPerDay = impPerDay.map((imp, i) => (imp > 0 ? Math.round((clickPerDay[i] / imp) * 1000) / 10 : null));
  const impCur = impPerDay.reduce((a, b) => a + b, 0);
  const clickCur = clickPerDay.reduce((a, b) => a + b, 0);
  const impPrev = slotPrev.reduce((a, r) => a + r.impressions, 0);
  const clickPrev = slotPrev.reduce((a, r) => a + r.clicks, 0);
  const frontCtr = ratio(clickCur, impCur);
  const frontCtrPrev = ratio(clickPrev, impPrev);
  const labels = days.map(shortDay);
  const modules = (() => {
    const map = new Map<string, { imp: number; clk: number }>();
    for (const r of slotCur) {
      const e = map.get(r.moduleId) ?? { imp: 0, clk: 0 };
      e.imp += r.impressions;
      e.clk += r.clicks;
      map.set(r.moduleId, e);
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.imp - a.imp).slice(0, 8);
  })();

  // ── Nyhedsbrev ───────────────────────────────────────────────────────────
  const newSubsCur = subscribers.filter((s) => inRange(s.createdAt, period.start)).length;
  const newSubsPrev = subscribers.filter((s) => inRange(s.createdAt, period.prevStart, period.start)).length;
  const subsPerDay = bucketByDay(subscribers.filter((s) => inRange(s.createdAt, period.start)), days, (s) => dayKey(s.createdAt), () => 1);
  const activeSubs = subscribers.filter((s) => s.aktiv).length;

  // ── Annoncer (kumulative tal pr. kampagne; ingen daglige data) ───────────
  const adsActive = campaigns.filter((c) => c.status === "Aktiv").length;
  const adViews = campaigns.reduce((a, c) => a + c.visninger, 0);
  const adClicks = campaigns.reduce((a, c) => a + c.klik, 0);
  const adCtr = ratio(adClicks, adViews);

  // ── Artikler pr. sektion (stablet pr. indholdstype) og status ────────────
  const sectionOf = (a: (typeof cohortArticles)[number]) => a.kategori?.parent?.navn ?? a.kategori?.navn ?? "Uden sektion";
  const sections = countBy(cur, sectionOf).slice(0, 8).map((s) => s.key);
  const types = countBy(cur, (a) => a.indholdstype).map((t) => t.key);
  const heat = weekdayHourMatrix(cur.flatMap((a) => (a.publiceretTid ? [a.publiceretTid] : [])));
  const statusSlices = statusCounts.map((s) => ({ id: s.status, label: s.status, value: s._count._all })).sort((a, b) => b.value - a.value);
  const drafts = statusCounts.filter((s) => ["Idé", "Udkast", "Godkendelse"].includes(s.status)).reduce((a, s) => a + s._count._all, 0);
  const planned = statusCounts.find((s) => s.status === "Planlagt")?._count._all ?? 0;

  // ── Mest læste (kohorte) ─────────────────────────────────────────────────
  const topRows: DataTableRow[] = [...cur]
    .sort((a, b) => metricOf(b).visninger - metricOf(a).visninger)
    .slice(0, 10)
    .map((a) => {
      const m = metricOf(a);
      return {
        id: a.id,
        sort: { titel: a.titel, visninger: m.visninger, laesninger: m.laesninger, engagement: ratio(m.laesninger, m.visninger) ?? 0, laesetid: avgReadSeconds(m) ?? 0 },
        cells: {
          titel: <div className="ui-stack"><Link className="article-title-link" href={`/redaktion/artikler/${a.id}`}>{a.titel}</Link><span className="ui-small ui-muted">{sectionOf(a)}</span></div>,
          visninger: <strong>{nr(m.visninger)}</strong>,
          laesninger: nr(m.laesninger),
          engagement: m.visninger > 0 ? pct((m.laesninger / m.visninger) * 100, 0) : "–",
          laesetid: formatDuration(avgReadSeconds(m)),
        },
      };
    });
  const topColumns: DataTableColumn[] = [
    { key: "titel", header: "Artikel", sortable: true },
    { key: "visninger", header: "Visninger", sortable: true, align: "right" },
    { key: "laesninger", header: "Læsninger", sortable: true, align: "right", hideOnMobile: true },
    { key: "engagement", header: "Engagement", sortable: true, align: "right" },
    { key: "laesetid", header: "Gns. læsetid", sortable: true, align: "right", hideOnMobile: true },
  ];

  // ── Algoritmisk forsideplacering (eksisterende simulering, uændret logik) ─
  const distributionInputs: ArticleDistributionInput[] = publishedAll.map((art) => ({
    id: art.id,
    titel: art.titel,
    publiceretTid: art.publiceretTid ?? art.createdAt,
    indholdstype: art.indholdstype as ArticleDistributionInput["indholdstype"],
    breaking: art.breaking,
    pinned: art.pinned,
    sektionSlug: art.kategori?.parent?.slug || art.kategori?.slug || "nyheder",
    omraadeSlug: art.geoTags?.[0]?.slug || null,
    visninger: art.metric?.visninger ?? 0,
    laesninger: art.metric?.laesninger ?? 0,
    totalLaesetidSek: art.metric?.totalLaesetidSek ?? 0,
    kategoriNavn: art.kategori?.navn || "Generelt",
    omraadeNavn: art.geoTags?.[0]?.navn || null,
    forfatterNavn: art.forfatter?.navn || "Redaktionen",
  }));
  const distribution = distributeArticles(distributionInputs, 25);
  const currentHour = new Date().getHours();
  const rankedRows: DataTableRow[] = distribution.ranked.map((art) => {
    const res = art.scoreResult;
    const readPct = art.visninger > 0 ? Math.round((art.laesninger / art.visninger) * 100) : 0;
    const avgSec = art.laesninger > 0 ? Math.round(art.totalLaesetidSek / art.laesninger) : 0;
    return {
      id: art.id,
      sort: { titel: art.titel, type: art.indholdstype, visninger: art.visninger, laesninger: art.laesninger, laesetid: avgSec, score: res.totalScore },
      cells: {
        titel: <div className="ui-stack"><strong>{art.titel}</strong><span className="ui-small ui-muted">{art.kategoriNavn} · {art.forfatterNavn}</span></div>,
        omraade: art.omraadeNavn ? <Badge tone="neutral">{art.omraadeNavn}</Badge> : <span className="ui-muted">–</span>,
        type: <Badge tone={art.indholdstype === "Sponsoreret" || art.indholdstype === "Partner" ? "review" : "neutral"}>{art.indholdstype}</Badge>,
        visninger: <strong>{nr(art.visninger)}</strong>,
        laesninger: <div className="ui-stack"><span>{nr(art.laesninger)}</span><span className="ui-small ui-muted">{readPct} % gennemført</span></div>,
        laesetid: <div className="ui-stack"><span>{formatDuration(avgSec)}</span><span className="ui-small ui-muted">gns. opmærksomhed</span></div>,
        score: (
          <div className="ui-stack">
            <span><Badge tone={res.totalScore > 100 ? "success" : "neutral"} icon={<Flame size={12} />}>{res.totalScore}</Badge></span>
            <span className="ui-small ui-muted">decay {Math.round(res.decayMultiplier * 100)} %{res.daypartBonus > 0 ? ` · +${res.daypartBonus} daypart` : ""}</span>
          </div>
        ),
        handling: <Link href={`/redaktion/artikler/${art.id}`} className="btn btn-secondary btn-sm">Redigér</Link>,
      },
    };
  });
  const rankedColumns: DataTableColumn[] = [
    { key: "titel", header: "Artikel og sektion", sortable: true },
    { key: "omraade", header: "Område", hideOnMobile: true },
    { key: "type", header: "Type", sortable: true, hideOnMobile: true },
    { key: "visninger", header: "Visninger", sortable: true, align: "right" },
    { key: "laesninger", header: "Læsninger", sortable: true, align: "right", hideOnMobile: true },
    { key: "laesetid", header: "Læsetid", sortable: true, align: "right", hideOnMobile: true },
    { key: "score", header: "Fordelingsscore", sortable: true, align: "right" },
    { key: "handling", header: "Handling", srOnlyHeader: true, align: "right" },
  ];

  // ── By-faner (data er pr. instans) ───────────────────────────────────────
  const rangeQuery = range === 28 ? "" : `?dage=${range}`;
  const cityTabs = network.map((site) => {
    const current = Boolean(instance && (site.domaene === instance.domaene.toLowerCase() || site.navn === instance.navn));
    return {
      // På en delt preview-adresse (site.previewBy) findes de andre byers domæner ikke: link til byens offentlige forside i stedet.
      href: current ? `/redaktion/metrikker${rangeQuery}` : site.previewBy ? networkHref(site) : `${site.origin}/redaktion/metrikker${rangeQuery}`,
      label: site.by,
      active: current,
      lead: <CityDot city={site.by} />,
    };
  });
  const cityName = network.find((s) => instance && (s.domaene === instance.domaene.toLowerCase() || s.navn === instance.navn))?.by ?? instance?.navn ?? "denne redaktion";

  const vsLabel = `mod forrige ${range} dage`;
  const hasAnyData = cur.length > 0 || impCur > 0 || newSubsCur > 0;

  return (
    <Page width="wide">
      <PageHeader
        icon={<BarChart3 size={22} />}
        title="Analytics"
        subtitle={`Læseradfærd, forside og nyhedsbrev for ${cityName}. Alle tal er rigtige målinger; det der endnu ikke måles, er markeret.`}
        badge={<Badge tone="success" icon={<CheckCircle2 size={12} />}>Cookiefri first-party</Badge>}
        actions={
          <SegmentedLinks
            label="Periode"
            items={RANGES.map((r) => ({ href: `/redaktion/metrikker${r === 28 ? "" : `?dage=${r}`}`, label: `${r} dage`, active: r === range }))}
          />
        }
      />

      {cityTabs.length > 0 ? <LinkTabs label="By" items={cityTabs} /> : null}

      <Notice tone="info" className="analytics-note">
        Tallene gælder kun {cityName}: hver by har sin egen måling. Netværkstotalen (&quot;Alle&quot;) er ikke bygget, fordi den kræver en samlet netværksrolle uden for byens egen adgang. Visninger, læsninger og læsetid er totaler på de artikler, der er publiceret i perioden.
      </Notice>

      {!hasAnyData ? <Notice tone="warn" title="Ingen målinger i perioden">Der er ikke publiceret artikler, vist forsideelementer eller tilmeldinger i de seneste {range} dage. Vælg en længere periode.</Notice> : null}

      <h2 className="ui-section-heading">Læsere</h2>
      <Grid cols={3}>
        <StatCard label="Sidevisninger" icon={<Eye size={16} />} value={nr(curM.visninger)} delta={pctDelta(curM.visninger, prevM.visninger) === null ? undefined : { value: pctDelta(curM.visninger, prevM.visninger) as number, label: vsLabel }} hint={`På ${nr(cur.length)} artikler publiceret i perioden`} />
        <StatCard label="Unikke læsere" unavailable={MISSING.unikke} />
        <StatCard label="Gns. læsetid" icon={<Clock size={16} />} value={readSec === null ? undefined : formatDuration(readSec)} empty={readSec === null ? "Ingen læsninger endnu" : undefined} delta={readSec !== null && prevReadSec ? { value: pctDelta(readSec, prevReadSec) ?? 0, label: vsLabel } : undefined} hint="Pr. læsning (scroll over 70 % eller mere end 30 s)" />
        <StatCard label="Konverteringer" unavailable={MISSING.konverteringer} />
        <StatCard label="Nyhedsbrev-CTR" unavailable={MISSING.nyhedsbrevCtr} />
        <StatCard label="Engagement" icon={<BookOpen size={16} />} value={engagement === null ? undefined : pct(engagement * 100)} empty={engagement === null ? "Ingen visninger endnu" : undefined} delta={engagement !== null && prevEngagement ? { value: pctDelta(engagement, prevEngagement) ?? 0, label: vsLabel } : undefined} hint="Læsninger i forhold til visninger" />
      </Grid>

      <h2 className="ui-section-heading">Redaktion, forside og vækst</h2>
      <Grid cols={4}>
        <StatCard label="Artikler publiceret" icon={<Newspaper size={16} />} value={nr(cur.length)} delta={pctDelta(cur.length, prev.length) === null ? undefined : { value: pctDelta(cur.length, prev.length) as number, label: vsLabel }} hint={`${nr(drafts)} i arbejde · ${nr(planned)} planlagt`} />
        <StatCard
          label="Forside-CTR"
          icon={<Activity size={16} />}
          value={frontCtr === null ? undefined : pct(frontCtr * 100, 2)}
          empty={frontCtr === null ? "Ingen forsidevisninger målt i perioden" : undefined}
          delta={frontCtr !== null && frontCtrPrev ? { value: pctDelta(frontCtr, frontCtrPrev) ?? 0, label: vsLabel } : undefined}
          hint={frontCtr === null ? undefined : `${nr(clickCur)} klik på ${nr(impCur)} eksponeringer`}
          chart={frontCtr === null ? undefined : <Sparkline values={ctrPerDay.map((v) => v ?? 0)} label="Forsidens klikrate pr. dag i perioden" tone={1} />}
        />
        <StatCard
          label="Nye abonnenter"
          icon={<UserPlus size={16} />}
          value={nr(newSubsCur)}
          delta={pctDelta(newSubsCur, newSubsPrev) === null ? undefined : { value: pctDelta(newSubsCur, newSubsPrev) as number, label: vsLabel }}
          hint={`${nr(activeSubs)} aktive modtagere i alt`}
          chart={newSubsCur > 0 ? <Sparkline values={subsPerDay} label="Nye nyhedsbrevsabonnenter pr. dag i perioden" tone={5} /> : undefined}
        />
        <StatCard label="Annoncer" icon={<Megaphone size={16} />} value={`${nr(adsActive)} aktive`} hint={adCtr === null ? `${nr(campaigns.length)} kampagner i alt` : `CTR ${pct(adCtr * 100, 2)} i alt (${nr(adClicks)} klik på ${nr(adViews)} visninger)`} />
      </Grid>

      <h2 className="ui-section-heading">Udvikling</h2>
      <Grid cols={2}>
        <LineArea title="Forsideeksponeringer pr. dag" description={`Hvor mange gange et forsideelement blev vist, de seneste ${range} dage.`} categories={labels} series={[{ id: "imp", label: "Eksponeringer", values: impPerDay }]} emptyText="Ingen forsidevisninger målt i perioden." />
        <LineArea title="Forsidens klikrate pr. dag" description="Klik i forhold til eksponeringer. Dage uden eksponeringer er udeladt." categories={labels} series={[{ id: "ctr", label: "Klikrate", values: ctrPerDay }]} valueKind="percent" emptyText="Ingen klik målt i perioden." />
        <Bars
          title="Artikler pr. sektion"
          description="Publiceret i perioden, fordelt på indholdstype."
          categories={sections}
          orientation="horizontal"
          mode="stacked"
          series={types.map((t) => ({ id: t, label: t, values: sections.map((s) => cur.filter((a) => sectionOf(a) === s && a.indholdstype === t).length) }))}
          emptyText="Ingen artikler publiceret i perioden."
        />
        <Donut title="Artikler efter status" description="Alle artikler i redaktionen lige nu." slices={statusSlices} centerLabel="artikler" emptyText="Der er ingen artikler endnu." />
        <Heatmap title="Hvornår publiceres der?" description="Artikler publiceret i perioden, efter ugedag og time (dansk tid)." rows={[...WEEKDAYS]} cols={HOURS} values={heat} unit="artikler" emptyText="Ingen artikler publiceret i perioden." />
        <Bars
          title="Forside: eksponeringer og klik pr. modul"
          description="De mest viste moduler i perioden."
          categories={modules.map((m) => m.id)}
          orientation="horizontal"
          mode="grouped"
          series={[{ id: "imp", label: "Eksponeringer", values: modules.map((m) => m.imp) }, { id: "clk", label: "Klik", values: modules.map((m) => m.clk) }]}
          emptyText="Ingen forsidemoduler målt i perioden."
        />
      </Grid>

      <h2 className="ui-section-heading">Mangler stadig at blive målt</h2>
      <Grid cols={3}>
        <Unavailable title="Trafikkilder" reason={MISSING.kilder} />
        <Unavailable title="Enhedstype" reason={MISSING.enhed} />
        <Unavailable title="Aktive timer (læsere)" reason={MISSING.timer} />
      </Grid>

      <h2 className="ui-section-heading">Mest læste</h2>
      <DataTable
        caption={`Mest læste artikler publiceret de seneste ${range} dage`}
        columns={topColumns}
        rows={topRows}
        defaultSort={{ key: "visninger", direction: "desc" }}
        emptyTitle="Ingen artikler publiceret i perioden"
        emptyDescription="Vælg en længere periode for at se flere artikler."
      />

      <Card
        className="analytics-dist"
        title="Algoritmisk forsideplacering (live simulering)"
        icon={<Sparkles size={18} />}
        description={`Beregnet ud fra redaktionelt veto, decay, læser-velocity og døgnrytme (kl. ${currentHour}:00).`}
        actions={distribution.quotaAlert ? <Badge tone="danger" icon={<ShieldAlert size={12} />}>Kvoteloft overskredet</Badge> : <Badge tone="neutral" icon={<ShieldAlert size={12} />}>Kvoteloft {distribution.commercialRatioPercent} % af 25 %</Badge>}
      >
        <div className="analytics-top">
          <div className="analytics-top-main">
            <p className="ui-eyebrow">Nr. 1 automatisk tophistorie</p>
            {distribution.topArticle ? (
              <>
                <h3 className="analytics-top-title">{distribution.topArticle.titel}</h3>
                <div className="ui-row ui-gap-sm">
                  <Badge tone="neutral">{distribution.topArticle.sektionSlug}</Badge>
                  {distribution.topArticle.omraadeSlug ? <Badge tone="neutral">{distribution.topArticle.omraadeSlug}</Badge> : null}
                  <Badge tone="success">Score {distribution.topArticle.scoreResult.totalScore}</Badge>
                </div>
              </>
            ) : (
              <p className="ui-muted">Ingen artikler kvalificeret.</p>
            )}
          </div>
          <div className="analytics-top-side">
            <p className="ui-eyebrow">Nr. 2 til 4</p>
            <ol className="ui-list-reset analytics-secondary">
              {distribution.secondaryArticles.map((art, idx) => (
                <li key={art.id}>
                  <span className="analytics-secondary-title">{idx + 2}. {art.titel}</span>
                  <span className="ui-row ui-gap-sm ui-nowrap"><Badge tone="neutral">{art.sektionSlug}</Badge><Badge tone="success">{art.scoreResult.totalScore}</Badge></span>
                </li>
              ))}
              {distribution.secondaryArticles.length === 0 ? <li className="ui-muted">Ingen sekundære historier.</li> : null}
            </ol>
          </div>
        </div>
      </Card>

      <h2 className="ui-section-heading">Fordelingsscore pr. artikel</h2>
      <DataTable
        caption="Alle publicerede artikler med fordelingsscore"
        columns={rankedColumns}
        rows={rankedRows}
        defaultSort={{ key: "score", direction: "desc" }}
        emptyTitle="Ingen publicerede artikler fundet"
      />
    </Page>
  );
}
