/**
 * FormData -> ArticleSaveInput (formularen i editoren og de gamle felter). Ren funktion uden Next/Prisma.
 * Felter der mangler i formularen betyder "uændret" for planlagtTid og meta.
 */
import { parseMetaField } from "./article-meta";
import type { ArticleSaveInput } from "./article-save";

function jsonFromForm(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string") return null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

function strings(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((v): v is string => typeof v === "string");
}

function text(formData: FormData, name: string): string | undefined {
  const v = formData.get(name);
  return typeof v === "string" ? v : undefined;
}

export function baseVersionFromFormData(formData: FormData): number | null {
  const v = formData.get("baseVersion");
  if (typeof v !== "string" || !v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function articleInputFromFormData(formData: FormData): { ok: true; input: ArticleSaveInput } | { ok: false; error: string } {
  const meta = parseMetaField(formData.get("meta"));
  if (!meta.ok) return { ok: false, error: meta.error };

  let planlagtTid: Date | null | undefined;
  const rawPlan = formData.get("planlagtTid");
  if (typeof rawPlan === "string") {
    if (rawPlan.trim() === "") planlagtTid = null;
    else {
      const d = new Date(rawPlan);
      if (Number.isNaN(d.getTime())) return { ok: false, error: "Udgivelsestidspunktet er ugyldigt." };
      planlagtTid = d;
    }
  }

  return {
    ok: true,
    input: {
      titel: text(formData, "titel") ?? "",
      manchet: text(formData, "manchet"),
      slug: text(formData, "slug"),
      slugAuto: formData.get("slugAuto") === "1",
      indholdstype: text(formData, "indholdstype") ?? "",
      kategoriId: text(formData, "kategoriId"),
      forfatterId: text(formData, "forfatterId"),
      coverMediaId: text(formData, "coverMediaId"),
      seoTitel: text(formData, "seoTitel"),
      seoBeskrivelse: text(formData, "seoBeskrivelse"),
      sprog: text(formData, "sprog") ?? "",
      blocks: jsonFromForm(formData.get("blocks")),
      aiBrug: strings(formData, "aiBrug"),
      marking: {
        sponsor: text(formData, "markingSponsor"),
        label: text(formData, "markingLabel"),
        aftaleId: text(formData, "markingAftaleId"),
        afsender: text(formData, "markingAfsender"),
        kilder: text(formData, "markingKilder"),
        kildeVerificeret: formData.get("kildeVerificeret") === "on",
      },
      pinned: formData.get("pinned") === "on",
      breaking: formData.get("breaking") === "on",
      tagIds: strings(formData, "tagIds"),
      geoTagIds: strings(formData, "geoTagIds"),
      planlagtTid,
      meta: meta.value,
    },
  };
}
