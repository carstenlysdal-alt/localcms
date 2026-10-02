/** Filtre og URL-hjælp til artikellisten (rent, testbart). */
import type { Prisma } from "@prisma/client";

export const LIST_TABS = ["Alle", "Planlagt", "Publiceret", "Kladder", "Meninger", "Debat"] as const;
export type ListTab = (typeof LIST_TABS)[number];

/** Statusser der regnes som kladder (alt før Planlagt/Publiceret, ekskl. Afvist/Arkiveret). */
export const DRAFT_STATUSES = ["Idé", "Indsendt", "Vurdering", "Godkendt", "Tildelt", "Research", "Udkast", "Redigering", "Faktatjek", "Juridisk kontrol", "SEO", "Medievalg", "Godkendelse"] as const;
export const ALL_STATUSES = [...DRAFT_STATUSES, "Planlagt", "Publiceret", "Distribueret", "Opdateret", "Arkiveret", "Afvist"] as const;

export type ListParams = {
  tab: ListTab;
  q: string;
  status: string;
  forfatter: string;
  type: string;
  sort: "asc" | "desc";
  view: "liste" | "gitter";
  breaking: boolean;
  pinned: boolean;
  sponsored: boolean;
  id: string;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseListParams(raw: Raw): ListParams {
  const tab = LIST_TABS.includes(one(raw.tab) as ListTab) ? (one(raw.tab) as ListTab) : "Alle";
  const id = one(raw.id) ?? "";
  return {
    tab,
    q: (one(raw.q) ?? "").trim().slice(0, 100),
    status: (ALL_STATUSES as readonly string[]).includes(one(raw.status) ?? "") ? one(raw.status)! : "",
    forfatter: /^[A-Za-z0-9_-]{1,40}$/.test(one(raw.forfatter) ?? "") ? one(raw.forfatter)! : "",
    type: (one(raw.type) ?? "").slice(0, 30),
    sort: one(raw.sort) === "aeldste" ? "asc" : "desc",
    view: one(raw.view) === "gitter" ? "gitter" : "liste",
    breaking: one(raw.breaking) === "1",
    pinned: one(raw.pinned) === "1",
    sponsored: one(raw.sponsored) === "1",
    id: /^[A-Za-z0-9_-]{8,40}$/.test(id) ? id : "",
  };
}

export function buildWhere(p: ListParams, instansId: string, searchOr: (fields: string[], q: string) => Prisma.ArticleWhereInput[]): Prisma.ArticleWhereInput {
  const tabStatus =
    p.tab === "Publiceret" ? { status: "Publiceret" } : p.tab === "Planlagt" ? { status: "Planlagt" } : p.tab === "Kladder" ? { status: { in: [...DRAFT_STATUSES] } } : {};
  return {
    instansId,
    ...(p.q ? { OR: searchOr(["titel"], p.q) } : {}),
    ...(p.status ? { status: p.status } : tabStatus),
    ...(p.forfatter ? { forfatterId: p.forfatter } : {}),
    ...(p.type ? { indholdstype: p.type } : p.sponsored ? { indholdstype: "Sponsoreret" } : p.tab === "Debat" ? { kategori: { slug: "debat" } } : p.tab === "Meninger" ? { indholdstype: "Brugerindsendt" } : {}),
    ...(p.breaking ? { breaking: true } : {}),
    ...(p.pinned ? { pinned: true } : {}),
  };
}

/** URL til listen med ændrede parametre (tom værdi fjerner parameteren). `id` bevares kun hvis det udtrykkeligt angives. */
export function listHref(p: ListParams, extra: Record<string, string | null | undefined> = {}): string {
  const q = new URLSearchParams();
  if (p.tab !== "Alle") q.set("tab", p.tab);
  if (p.q) q.set("q", p.q);
  if (p.status) q.set("status", p.status);
  if (p.forfatter) q.set("forfatter", p.forfatter);
  if (p.type) q.set("type", p.type);
  if (p.sort === "asc") q.set("sort", "aeldste");
  if (p.view === "gitter") q.set("view", "gitter");
  if (p.breaking) q.set("breaking", "1");
  if (p.pinned) q.set("pinned", "1");
  if (p.sponsored) q.set("sponsored", "1");
  for (const [k, v] of Object.entries(extra)) { if (v) q.set(k, v); else q.delete(k); }
  const s = q.toString();
  return `/redaktion/artikler${s ? `?${s}` : ""}`;
}
