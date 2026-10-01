import type { ModuleInstance } from "@/lib/frontpage/layout-schema";
import type { FrontpageSource, SlotAssignment, Violation } from "@/lib/frontpage/types";

/** Serialiserbare datatyper mellem server (page/actions) og editorens klientkomponenter. */
export interface Perms {
  edit: boolean;
  layout: boolean;
  approve: boolean;
  ai: boolean;
}

export interface ArticleLite {
  id: string;
  titel: string;
  indholdstype: string;
  sektion: string;
  publiceretTid: string;
  breaking: boolean;
  label: { tekst: string; synlig: true };
}

export interface DraftDTO {
  id: string;
  name: string;
  version: number;
  modules: ModuleInstance[];
  updatedAt: string;
}

export interface LiveLayoutDTO {
  id: string | null;
  version: number;
  name: string;
  modules: ModuleInstance[];
  source: "live" | "standard";
}

export interface LayoutVersionDTO {
  id: string;
  version: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface SnapshotSummaryDTO {
  id: string;
  status: string;
  generatedBy: string;
  modelId: string | null;
  createdAt: string;
  godkendtAf: string | null;
  godkendtTid: string | null;
  expiresAt: string | null;
  afvistGrund: string | null;
}

export interface DecisionDTO {
  id: string;
  snapshotId: string | null;
  articleId: string | null;
  slot: string;
  handling: string;
  kilde: string;
  begrundelse: string | null;
  konfidens: number | null;
  createdAt: string;
}

export interface ProposalDetailDTO {
  summary: SnapshotSummaryDTO;
  layoutVersion: number;
  /** Layoutet er ændret siden forslaget blev lavet (forslaget kan ikke godkendes). */
  layoutStale: boolean;
  assignments: SlotAssignment[];
  warnings: Violation[];
  decisions: DecisionDTO[];
  articles: Record<string, ArticleLite>;
}

export interface LiveResolutionDTO {
  source: FrontpageSource;
  reason: string;
  repaired: number;
  snapshotId: string | null;
  layoutVersion: number;
  assignments: SlotAssignment[];
  warnings: Violation[];
  modules: ModuleInstance[];
}

export interface PinDTO {
  id: string;
  articleId: string;
  zone: string;
  position: number;
  udloebTid: string | null;
}

export interface MetricRow {
  moduleId: string;
  slotKey: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface MetricsDTO {
  days: number;
  rows: MetricRow[];
  /** Pr. modul: daglige impressions/klik (ældste først) til sparkline-søjler. */
  daily: { moduleId: string; series: { day: string; impressions: number; clicks: number }[] }[];
}

export interface QuotaDTO {
  percentage: number;
  supportedCount: number;
  totalCount: number;
  kvoteloftProcent: number;
  isExceeded: boolean;
}

export interface EditorData {
  perms: Perms;
  site: { id: string; navn: string; kommune: string };
  live: LiveLayoutDTO;
  drafts: DraftDTO[];
  versions: LayoutVersionDTO[];
  options: { sections: { value: string; label: string }[]; areas: { value: string; label: string }[] };
  snapshots: SnapshotSummaryDTO[];
  selected: ProposalDetailDTO | null;
  liveResolution: LiveResolutionDTO;
  liveArticles: Record<string, ArticleLite>;
  pool: ArticleLite[];
  decisions: DecisionDTO[];
  metrics: MetricsDTO;
  quota: QuotaDTO;
  pins: PinDTO[];
  aiConfigured: boolean;
}

export type ActionFail = { ok: false; code: string; message: string; violations?: Violation[]; details?: string[] };
export type ActionOk<T = Record<never, never>> = { ok: true } & T;
export type ActionResult<T = Record<never, never>> = ActionOk<T> | ActionFail;
