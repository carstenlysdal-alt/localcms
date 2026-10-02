/** Editorens formtilstand (klient) og omsætning til FormData for saveArticle/saveDraftAction. Ren logik, testbar. */
import type { Block } from "@/lib/blocks/schema";
import type { ArticleMetaForm } from "@/lib/article-meta";
import { AI_USE_NONE } from "@/lib/marking";
import type { ArticleEditorValue } from "./types";

export type FormState = {
  titel: string;
  manchet: string;
  slug: string;
  blocks: Block[];
  indholdstype: string;
  kategoriId: string;
  forfatterId: string;
  coverMediaId: string;
  tagIds: string[];
  geoTagIds: string[];
  seoTitel: string;
  seoBeskrivelse: string;
  sprog: string;
  pinned: boolean;
  breaking: boolean;
  /** ISO (UTC) eller "". */
  planlagtTid: string;
  /** Inkl. evt. "Ingen". */
  aiBrug: string[];
  markingSponsor: string;
  markingLabel: string;
  markingAftaleId: string;
  markingAfsender: string;
  markingKilder: string;
  kildeVerificeret: boolean;
  meta: ArticleMetaForm;
};

type MarkingLike = Record<string, unknown>;
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

export function initialFormState(a: ArticleEditorValue): FormState {
  const m = (a.marking ?? {}) as MarkingLike;
  const type = a.indholdstype;
  return {
    titel: a.titel,
    manchet: a.manchet,
    slug: a.slug,
    blocks: a.blocks,
    indholdstype: a.indholdstype,
    kategoriId: a.kategoriId,
    forfatterId: a.forfatterId,
    coverMediaId: a.coverMediaId,
    tagIds: a.tagIds,
    geoTagIds: a.geoTagIds,
    seoTitel: a.seoTitel,
    seoBeskrivelse: a.seoBeskrivelse,
    sprog: a.sprog,
    pinned: a.pinned,
    breaking: a.breaking,
    planlagtTid: a.planlagtTid,
    aiBrug: a.aiBrug,
    markingSponsor: str(m.sponsor),
    markingLabel: str(m.labelTekst, type === "Partner" ? "Finansieret af" : type === "Sponsoreret" ? "ANNONCE" : ""),
    markingAftaleId: str(m.aftaleId),
    markingAfsender: str(m.afsender),
    markingKilder: Array.isArray(m.kilder) ? (m.kilder as unknown[]).filter((k): k is string => typeof k === "string").join("\n") : "",
    kildeVerificeret: m.uverificeretKilde === false,
    meta: a.meta,
  };
}

export type BuildOptions = { baseVersion?: number | null; targetStatus?: string | null; slugAuto?: boolean };

export function toFormData(f: FormState, opts: BuildOptions = {}): FormData {
  const fd = new FormData();
  const set = (k: string, v: string) => fd.append(k, v);
  set("titel", f.titel);
  set("manchet", f.manchet);
  set("slug", f.slug);
  set("indholdstype", f.indholdstype);
  set("kategoriId", f.kategoriId);
  set("forfatterId", f.forfatterId);
  set("coverMediaId", f.coverMediaId);
  set("seoTitel", f.seoTitel);
  set("seoBeskrivelse", f.seoBeskrivelse);
  set("sprog", f.sprog);
  set("blocks", JSON.stringify(f.blocks));
  set("planlagtTid", f.planlagtTid);
  set("meta", JSON.stringify(f.meta));
  for (const v of f.aiBrug) set("aiBrug", v);
  for (const v of f.tagIds) set("tagIds", v);
  for (const v of f.geoTagIds) set("geoTagIds", v);
  if (f.pinned) set("pinned", "on");
  if (f.breaking) set("breaking", "on");
  if (f.kildeVerificeret) set("kildeVerificeret", "on");
  if (f.indholdstype === "Partner" || f.indholdstype === "Sponsoreret") {
    set("markingSponsor", f.markingSponsor);
    set("markingLabel", f.markingLabel);
    if (f.indholdstype === "Partner") set("markingAftaleId", f.markingAftaleId);
  }
  if (f.indholdstype === "Brugerindsendt" || f.indholdstype === "PR") set("markingAfsender", f.markingAfsender);
  if (f.indholdstype === "AI-assisteret") set("markingKilder", f.markingKilder);
  if (typeof opts.baseVersion === "number" && opts.baseVersion > 0) set("baseVersion", String(opts.baseVersion));
  if (opts.targetStatus) set("targetStatus", opts.targetStatus);
  if (opts.slugAuto) set("slugAuto", "1");
  return fd;
}

/** Stabil signatur af felter der gemmes — til "har noget ændret sig?" (dirty). */
export function formSignature(f: FormState): string {
  return JSON.stringify(f);
}

export { AI_USE_NONE };
