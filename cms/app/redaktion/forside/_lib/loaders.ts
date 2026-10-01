import { db } from "@/lib/db";
import { calculateSupportedContentQuota } from "@/lib/frontpage-governance";
import { labelFor } from "@/lib/frontpage/guardrails";
import { createAnthropicTextClient } from "@/lib/frontpage/ai-client";
import { getModuleDef } from "@/lib/frontpage/modules";
import { getSlotMetrics, getSnapshot, listLayoutVersions, listLayouts, listSnapshots, loadCandidates, resolveFrontpageForRender, type FrontpageUser } from "@/lib/frontpage/service";
import { parseModules } from "@/lib/frontpage/layout-schema";
import { defaultLayoutModules } from "@/lib/frontpage/templates";
import { can, PERMISSIONS } from "@/lib/permissions";
import type {
  ArticleLite,
  DecisionDTO,
  EditorData,
  MetricsDTO,
  Perms,
  ProposalDetailDTO,
  SnapshotSummaryDTO,
} from "./dto";

/** Serverside datahentning til editoren. instansId kommer ALTID fra brugeren. */
export const permsOf = (user: FrontpageUser): Perms => ({
  edit: can(user, PERMISSIONS.FRONTPAGE_EDIT),
  layout: can(user, PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE),
  approve: can(user, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE),
  ai: can(user, PERMISSIONS.FRONTPAGE_AI_USE),
});

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function loadArticleLites(instansId: string, ids: readonly string[]): Promise<Record<string, ArticleLite>> {
  const unique = [...new Set(ids)].slice(0, 400);
  if (!unique.length) return {};
  const rows = await db.article.findMany({
    where: { id: { in: unique }, instansId },
    select: { id: true, titel: true, indholdstype: true, marking: true, publiceretTid: true, breaking: true, kategori: { select: { navn: true, parent: { select: { navn: true } } } } },
  });
  return Object.fromEntries(
    rows.map((a) => {
      const m = a.marking && typeof a.marking === "object" ? (a.marking as { labelTekst?: unknown }) : null;
      return [
        a.id,
        {
          id: a.id,
          titel: a.titel,
          indholdstype: a.indholdstype,
          sektion: a.kategori?.parent?.navn ?? a.kategori?.navn ?? "Nyheder",
          publiceretTid: (a.publiceretTid ?? new Date(0)).toISOString(),
          breaking: a.breaking,
          label: labelFor({ indholdstype: a.indholdstype, maerkningTekst: typeof m?.labelTekst === "string" ? m.labelTekst : null }),
        } satisfies ArticleLite,
      ];
    }),
  );
}

function summaryOf(r: { id: string; status: string; generatedBy: string; modelId: string | null; createdAt: Date; godkendtAf: string | null; godkendtTid: Date | null; expiresAt: Date | null; afvistGrund: string | null }): SnapshotSummaryDTO {
  return { id: r.id, status: r.status, generatedBy: r.generatedBy, modelId: r.modelId, createdAt: r.createdAt.toISOString(), godkendtAf: r.godkendtAf, godkendtTid: iso(r.godkendtTid), expiresAt: iso(r.expiresAt), afvistGrund: r.afvistGrund };
}

const decisionDto = (d: { id: string; snapshotId: string | null; articleId: string | null; slot: string; handling: string; kilde: string; begrundelse: string | null; konfidens: number | null; createdAt: Date }): DecisionDTO => ({
  id: d.id, snapshotId: d.snapshotId, articleId: d.articleId, slot: d.slot, handling: d.handling, kilde: d.kilde, begrundelse: d.begrundelse, konfidens: d.konfidens, createdAt: d.createdAt.toISOString(),
});

export async function loadProposalDetail(user: FrontpageUser, snapshotId: string, live?: { id: string | null; version: number }): Promise<ProposalDetailDTO | null> {
  const res = await getSnapshot(user, snapshotId);
  if (!res) return null;
  const { snapshot, items, decisions } = res;
  const layout = live ?? (await resolveFrontpageForRender(user.instansId)).layout;
  const articles = await loadArticleLites(user.instansId, [...items.assignments.map((a) => a.articleId), ...decisions.map((d) => d.articleId).filter((x): x is string => Boolean(x))]);
  return {
    summary: summaryOf(snapshot),
    layoutVersion: items.layoutVersion,
    layoutStale: snapshot.layoutId !== layout.id || items.layoutVersion !== layout.version,
    assignments: items.assignments,
    warnings: items.warnings,
    decisions: decisions.map(decisionDto),
    articles,
  };
}

export async function loadMetrics(user: FrontpageUser, days: number): Promise<MetricsDTO> {
  const d = [7, 14, 30].includes(days) ? days : 7;
  const rows = await getSlotMetrics(user, { days: d });
  const since = new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
  const raw = can(user, PERMISSIONS.FRONTPAGE_EDIT) ? await db.frontpageSlotMetric.findMany({ where: { instansId: user.instansId, day: { gte: since } }, select: { moduleId: true, day: true, impressions: true, clicks: true } }) : [];
  const byModule = new Map<string, Map<string, { impressions: number; clicks: number }>>();
  for (const r of raw) {
    const m = byModule.get(r.moduleId) ?? new Map();
    const cur = m.get(r.day) ?? { impressions: 0, clicks: 0 };
    cur.impressions += r.impressions;
    cur.clicks += r.clicks;
    m.set(r.day, cur);
    byModule.set(r.moduleId, m);
  }
  const daysList: string[] = [];
  for (let i = d - 1; i >= 0; i--) daysList.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  return {
    days: d,
    rows,
    daily: [...byModule.entries()].map(([moduleId, m]) => ({ moduleId, series: daysList.map((day) => ({ day, ...(m.get(day) ?? { impressions: 0, clicks: 0 }) })) })).sort((a, b) => a.moduleId.localeCompare(b.moduleId)),
  };
}

export async function loadEditorData(user: FrontpageUser, site: { id: string; navn: string; kommune: string }): Promise<EditorData> {
  const perms = permsOf(user);
  const [layouts, versions, snapshots, render, candidates, decisionRows, categories, areas, quota, pinRows] = await Promise.all([
    listLayouts(user),
    listLayoutVersions(user),
    listSnapshots(user, { take: 30 }),
    resolveFrontpageForRender(user.instansId),
    loadCandidates(user.instansId, { limit: 60 }),
    db.frontpageDecision.findMany({ where: { instansId: user.instansId }, orderBy: { createdAt: "desc" }, take: 150 }),
    db.category.findMany({ where: { instansId: user.instansId, parentId: null }, orderBy: { sortering: "asc" }, select: { slug: true, navn: true } }),
    db.geoTag.findMany({ where: { instansId: user.instansId }, orderBy: { navn: "asc" }, select: { slug: true, navn: true } }),
    calculateSupportedContentQuota(user.instansId),
    db.frontpagePlacement.findMany({ where: { instansId: user.instansId, OR: [{ udloebTid: null }, { udloebTid: { gt: new Date() } }] }, orderBy: [{ zone: "asc" }, { position: "asc" }] }),
  ]);

  const liveParsed = layouts.live ? parseModules(layouts.live.modules) : null;
  const live = {
    id: render.layout.id,
    version: render.layout.version,
    name: render.layout.name,
    modules: render.layout.modules ?? (liveParsed?.ok ? liveParsed.value : defaultLayoutModules()),
    source: render.layout.source,
  };
  const drafts = layouts.drafts.flatMap((d) => {
    const p = parseModules(d.modules);
    return p.ok ? [{ id: d.id, name: d.name, version: d.version, modules: p.value, updatedAt: d.updatedAt.toISOString() }] : [];
  });

  const forslag = snapshots.find((s) => s.status === "forslag") ?? snapshots[0];
  const selected = forslag ? await loadProposalDetail(user, forslag.id, render.layout) : null;
  const liveAssign = render.resolved.assignments;
  const liveArticles = await loadArticleLites(user.instansId, [...liveAssign.map((a) => a.articleId), ...candidates.slice(0, 40).map((c) => c.id), ...decisionRows.map((d) => d.articleId).filter((x): x is string => Boolean(x)), ...pinRows.map((p) => p.articleId)]);

  const pool = candidates.slice(0, 40).map((c) => liveArticles[c.id]).filter((x): x is ArticleLite => Boolean(x));

  return {
    perms,
    site,
    live,
    drafts,
    versions: versions.map((v) => ({ id: v.id, version: v.version, note: v.note, createdBy: v.createdBy, createdAt: v.createdAt.toISOString() })),
    options: {
      sections: categories.map((c) => ({ value: c.slug, label: c.navn })),
      areas: areas.flatMap((a) => (a.slug ? [{ value: a.slug as string, label: a.navn }] : [])),
    },
    snapshots: snapshots.map(summaryOf),
    selected,
    liveResolution: {
      source: render.resolved.source,
      reason: render.resolved.reason,
      repaired: render.resolved.repaired,
      snapshotId: render.resolved.snapshotId,
      layoutVersion: render.resolved.layoutVersion,
      assignments: liveAssign,
      warnings: render.resolved.warnings,
      modules: render.resolved.modules,
    },
    liveArticles,
    pool,
    decisions: decisionRows.map(decisionDto),
    metrics: await loadMetrics(user, 7),
    quota: { percentage: quota.percentage, supportedCount: quota.supportedCount, totalCount: quota.totalCount, kvoteloftProcent: quota.kvoteloftProcent, isExceeded: quota.isExceeded },
    pins: pinRows.map((p) => ({ id: p.id, articleId: p.articleId, zone: p.zone, position: p.position, udloebTid: iso(p.udloebTid) })),
    aiConfigured: Boolean(createAnthropicTextClient()),
  };
}

export const moduleLabelOf = (type: string) => getModuleDef(type)?.label ?? type;
