import { z } from "zod";
import { db } from "../../db";
import { AREA_PERMISSIONS } from "../../redaktion-access";
import { slugify } from "../../slug";
import { deleteAreaAction, saveAreaAction } from "@/app/redaktion/omraader/actions";
import { MAX_ITEMS_PER_CALL } from "../policy";
import { defineTool, ToolError, type ToolCtx } from "../types";
import { formData, friendlyError, joinDa, resolveArea, text } from "./shared";

async function usage(ctx: ToolCtx, id: string) {
  const row = await db.geoTag.findFirst({ where: { id, instansId: ctx.instansId }, include: { _count: { select: { articles: true, submissions: true, signals: true } } } });
  return row ? { row, used: row._count.articles + row._count.submissions + row._count.signals } : null;
}

export const listAreas = defineTool({
  name: "list_areas",
  description: "Viser alle områder (geotags) med id, slug og antal artikler. Brug den før du omdøber eller sletter områder.",
  input: z.strictObject({}),
  category: "Områder",
  risk: "read",
  permissions: [...AREA_PERMISSIONS, "article.create"],
  summarize: () => "Henter områderne",
  async execute(ctx) {
    const rows = await db.geoTag.findMany({ where: { instansId: ctx.instansId }, orderBy: { navn: "asc" }, include: { _count: { select: { articles: true, signals: true } } } });
    return { ok: true, summary: `${rows.length} områder`, data: rows.map((r) => ({ id: r.id, navn: r.navn, slug: r.slug, artikler: r._count.articles, signaler: r._count.signals })) };
  },
});

export const createAreas = defineTool({
  name: "create_areas",
  description: `Opretter ét eller flere områder (geotags, fx byer og bydele) på én gang (højst ${MAX_ITEMS_PER_CALL}). Eksisterende områder springes over. Koordinater kan sættes bagefter på siden Områder.`,
  input: z.strictObject({ navne: z.array(text(120, 2)).min(1).max(MAX_ITEMS_PER_CALL) }),
  category: "Områder",
  risk: "safe-write",
  permissions: AREA_PERMISSIONS,
  summarize: (input) => `Opretter områderne ${joinDa(input.navne)}`,
  async execute(ctx, input) {
    const existing = await db.geoTag.findMany({ where: { instansId: ctx.instansId }, select: { navn: true, slug: true } });
    const known = new Set(existing.flatMap((a) => [a.slug, a.navn.toLowerCase()]));
    const created: { id: string; navn: string }[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    for (const navn of input.navne) {
      const slug = slugify(navn, 80);
      if (!slug) {
        failed.push(`${navn}: ugyldigt navn`);
        continue;
      }
      if (known.has(slug) || known.has(navn.toLowerCase())) {
        skipped.push(navn);
        continue;
      }
      try {
        await saveAreaAction(formData({ navn, slug }));
        const row = await db.geoTag.findFirst({ where: { instansId: ctx.instansId, slug }, select: { id: true } });
        if (row) created.push({ id: row.id, navn });
        known.add(slug);
        known.add(navn.toLowerCase());
      } catch (error) {
        failed.push(`${navn}: ${friendlyError(error)}`);
      }
    }
    const parts: string[] = [];
    if (created.length) parts.push(`Oprettede ${created.length === 1 ? "området" : "områderne"} ${joinDa(created.map((c) => c.navn))}`);
    if (skipped.length) parts.push(`${joinDa(skipped)} fandtes allerede`);
    if (failed.length) parts.push(`Mislykkedes: ${failed.join("; ")}`);
    return {
      ok: failed.length === 0,
      summary: parts.join(". ") || "Intet at oprette",
      data: { oprettet: created, sprangetOver: skipped, fejlede: failed },
      resultIds: created.map((c) => c.id),
      undo: created.length ? { tool: "create_areas", input: { ids: created.map((c) => c.id) }, label: `Fortryd: ${created.length === 1 ? "1 område" : `${created.length} områder`} oprettet` } : null,
    };
  },
  /** Fortryd fjerner kun nyoprettede områder, der ikke er taget i brug. */
  async undo(ctx, input) {
    const ids = Array.isArray(input.ids) ? input.ids.filter((v): v is string => typeof v === "string").slice(0, MAX_ITEMS_PER_CALL) : [];
    let removed = 0;
    const kept: string[] = [];
    for (const id of ids) {
      const u = await usage(ctx, id);
      if (!u) continue;
      if (u.used > 0) {
        kept.push(`${u.row.navn} (er i brug)`);
        continue;
      }
      try {
        await deleteAreaAction(id);
        removed += 1;
      } catch (error) {
        kept.push(`${u.row.navn} (${friendlyError(error)})`);
      }
    }
    return kept.length ? { ok: false, summary: `Fortrød ${removed}. Kunne ikke fjerne: ${kept.join("; ")}` } : { ok: true, summary: `Fjernede ${removed} nyoprettede områder` };
  },
});

export const renameArea = defineTool({
  name: "rename_area",
  description: "Omdøber et område. Sluggen (adressen) ændres ikke.",
  input: z.strictObject({ omraade: text(120).describe("Navn, slug eller id"), nytNavn: text(120, 2) }),
  category: "Områder",
  risk: "safe-write",
  permissions: AREA_PERMISSIONS,
  summarize: (input) => `Omdøber området ${input.omraade} til ${input.nytNavn}`,
  async execute(ctx, input) {
    const area = await resolveArea(ctx, input.omraade);
    try {
      await saveAreaAction(formData({ id: area.id, navn: input.nytNavn, slug: area.slug, lat: area.lat ?? "", lng: area.lng ?? "" }));
    } catch (error) {
      return { ok: false, summary: friendlyError(error) };
    }
    return { ok: true, summary: `Omdøbte området ${area.navn} til ${input.nytNavn}`, resultIds: [area.id], undo: { tool: "rename_area", input: { id: area.id, navn: area.navn }, label: `Fortryd: omdøbning af ${area.navn}` } };
  },
  async undo(ctx, input) {
    const area = typeof input.id === "string" ? await db.geoTag.findFirst({ where: { id: input.id, instansId: ctx.instansId } }) : null;
    if (!area || typeof input.navn !== "string") return { ok: false, summary: "Området findes ikke længere." };
    try {
      await saveAreaAction(formData({ id: area.id, navn: input.navn, slug: area.slug, lat: area.lat ?? "", lng: area.lng ?? "" }));
    } catch (error) {
      return { ok: false, summary: friendlyError(error) };
    }
    return { ok: true, summary: `Navnet er sat tilbage til ${input.navn}` };
  },
});

export const deleteArea = defineTool({
  name: "delete_area",
  description: "Sletter et område, der ikke bruges af artikler, signaler eller indsendelser. Kræver brugerens bekræftelse.",
  input: z.strictObject({ omraade: text(120) }),
  category: "Områder",
  risk: "confirm",
  permissions: AREA_PERMISSIONS,
  summarize: (input) => `Sletter området ${input.omraade}`,
  async details(ctx, input) {
    const area = await resolveArea(ctx, input.omraade);
    const u = await usage(ctx, area.id);
    const lines = [`Sletter området ${area.navn} (/${area.slug})`, `Brugt af ${u?.row._count.articles ?? 0} artikler, ${u?.row._count.signals ?? 0} signaler og ${u?.row._count.submissions ?? 0} indsendelser.`];
    if ((u?.used ?? 0) > 0) lines.push("Området er i brug og bliver ikke slettet, før brugen er fjernet.");
    lines.push("Sletningen kan ikke fortrydes.");
    return lines;
  },
  async execute(ctx, input) {
    const area = await resolveArea(ctx, input.omraade);
    const u = await usage(ctx, area.id);
    if (!u) throw new ToolError("Området findes ikke.");
    if (u.used > 0) return { ok: false, summary: `Området ${area.navn} er i brug (${u.used}) og kan ikke slettes.` };
    try {
      await deleteAreaAction(area.id);
    } catch (error) {
      return { ok: false, summary: friendlyError(error) };
    }
    return { ok: true, summary: `Slettede området ${area.navn}`, resultIds: [area.id] };
  },
});
