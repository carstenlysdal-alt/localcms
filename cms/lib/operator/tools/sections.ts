import { z } from "zod";
import { db } from "../../db";
import { PERMISSIONS } from "../../permissions";
import { slugify } from "../../slug";
import { deleteCategory, saveCategory } from "@/app/redaktion/sektioner/actions";
import { MAX_ITEMS_PER_CALL } from "../policy";
import { defineTool, ToolError, type ToolCtx } from "../types";
import { formData, friendlyError, joinDa, resolveSection, text } from "./shared";

const SECTION_PERMISSIONS = [PERMISSIONS.CATEGORY_MANAGE, PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.ARTICLE_EDIT_ALL] as const;

type CategoryRow = { id: string; navn: string; slug: string; parentId: string | null; sortering: number; beskrivelse: string | null; iNavigation: boolean };

/** Opdaterer en sektion via den rigtige action (alle regler: reserverede slugs, to niveauer, AI-spærring, unik slug). */
async function updateCategory(current: CategoryRow, patch: Partial<Pick<CategoryRow, "navn" | "parentId" | "sortering">>): Promise<string | null> {
  const next = { ...current, ...patch };
  const res = await saveCategory(
    current.id,
    {},
    formData({
      navn: next.navn,
      slug: next.slug,
      beskrivelse: next.beskrivelse ?? "",
      sortering: next.sortering,
      iNavigation: next.iNavigation ? "on" : undefined,
      parentId: next.parentId ?? "",
    }),
  );
  return res.error ?? null;
}

async function loadCategory(ctx: ToolCtx, id: string): Promise<CategoryRow | null> {
  return db.category.findFirst({ where: { id, instansId: ctx.instansId }, select: { id: true, navn: true, slug: true, parentId: true, sortering: true, beskrivelse: true, iNavigation: true } });
}

export const listSections = defineTool({
  name: "list_sections",
  description: "Viser alle sektioner (kategorier) med id, slug, overordnet sektion, rækkefølge og antal artikler. Brug den før du ændrer, flytter eller sletter sektioner.",
  input: z.strictObject({}),
  category: "Sektioner",
  risk: "read",
  permissions: [PERMISSIONS.ARTICLE_CREATE, ...SECTION_PERMISSIONS],
  summarize: () => "Henter sektionerne",
  async execute(ctx) {
    const rows = await db.category.findMany({
      where: { instansId: ctx.instansId },
      orderBy: [{ sortering: "asc" }, { navn: "asc" }],
      include: { _count: { select: { articles: true, children: true } } },
    });
    const data = rows.map((r) => ({ id: r.id, navn: r.navn, slug: r.slug, overordnetId: r.parentId, sortering: r.sortering, iNavigation: r.iNavigation, artikler: r._count.articles, undersektioner: r._count.children }));
    return { ok: true, summary: `${rows.length} sektioner`, data };
  },
});

export const createSections = defineTool({
  name: "create_sections",
  description: `Opretter én eller flere sektioner på én gang (højst ${MAX_ITEMS_PER_CALL}). Slug dannes automatisk af navnet. Eksisterende sektioner springes over, så kaldet kan gentages uden dubletter. Rækkefølgen følger listen. Med 'overordnet' oprettes de som undersektioner under en eksisterende topsektion.`,
  input: z.strictObject({
    navne: z.array(text(80, 2)).min(1).max(MAX_ITEMS_PER_CALL).describe("Sektionsnavne, fx ['Nyheder','Erhverv']"),
    overordnet: text(80).optional().describe("Navn, slug eller id på en eksisterende topsektion (valgfri)"),
  }),
  category: "Sektioner",
  risk: "safe-write",
  permissions: SECTION_PERMISSIONS,
  summarize: (input) => `Opretter sektionerne ${joinDa(input.navne)}`,
  async execute(ctx, input) {
    const parent = input.overordnet ? await resolveSection(ctx, input.overordnet) : null;
    const existing = await db.category.findMany({ where: { instansId: ctx.instansId }, select: { navn: true, slug: true, parentId: true, sortering: true } });
    const known = new Set(existing.flatMap((c) => [c.slug, c.navn.toLowerCase()]));
    const siblings = existing.filter((c) => c.parentId === (parent?.id ?? null));
    let nextSort = siblings.length ? Math.max(...siblings.map((c) => c.sortering)) + 1 : 0;

    const created: { id: string; navn: string }[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    for (const navn of input.navne) {
      const slug = slugify(navn, 60);
      if (!slug || slug.length < 2) {
        failed.push(`${navn}: kan ikke danne et gyldigt slug`);
        continue;
      }
      if (known.has(slug) || known.has(navn.toLowerCase())) {
        skipped.push(navn);
        continue;
      }
      try {
        const res = await saveCategory(null, {}, formData({ navn, slug, sortering: nextSort, iNavigation: "on", beskrivelse: "", parentId: parent?.id ?? "" }));
        if (res.error) {
          failed.push(`${navn}: ${res.error}`);
          continue;
        }
        const row = await db.category.findFirst({ where: { instansId: ctx.instansId, slug }, select: { id: true } });
        if (row) created.push({ id: row.id, navn });
        known.add(slug);
        known.add(navn.toLowerCase());
        nextSort += 1;
      } catch (error) {
        failed.push(`${navn}: ${friendlyError(error)}`);
      }
    }

    const parts: string[] = [];
    if (created.length) parts.push(`Oprettede ${created.length === 1 ? "sektionen" : "sektionerne"} ${joinDa(created.map((c) => c.navn))}`);
    if (skipped.length) parts.push(`${joinDa(skipped)} fandtes allerede`);
    if (failed.length) parts.push(`Mislykkedes: ${failed.join("; ")}`);
    return {
      ok: failed.length === 0,
      summary: parts.join(". ") || "Intet at oprette",
      data: { oprettet: created, sprangetOver: skipped, fejlede: failed },
      resultIds: created.map((c) => c.id),
      undo: created.length ? { tool: "create_sections", input: { ids: created.map((c) => c.id) }, label: `Fortryd: ${created.length === 1 ? "1 sektion" : `${created.length} sektioner`} oprettet` } : null,
    };
  },
  /** Fortryd = slet de nyoprettede sektioner, men kun hvis de stadig er tomme (deleteCategory afviser ellers). */
  async undo(ctx, input) {
    const ids = Array.isArray(input.ids) ? input.ids.filter((v): v is string => typeof v === "string").slice(0, MAX_ITEMS_PER_CALL) : [];
    let removed = 0;
    const kept: string[] = [];
    for (const id of ids) {
      const row = await loadCategory(ctx, id);
      if (!row) continue; // allerede væk
      const res = await deleteCategory(id);
      if (res.error) kept.push(`${row.navn} (${res.error})`);
      else removed += 1;
    }
    if (kept.length) return { ok: false, summary: `Fortrød ${removed}. Kunne ikke fjerne: ${kept.join("; ")}` };
    return { ok: true, summary: `Fjernede ${removed} nyoprettede ${removed === 1 ? "sektion" : "sektioner"}` };
  },
});

export const renameSection = defineTool({
  name: "rename_section",
  description: "Omdøber en sektion. Sluggen (adressen) ændres ikke, så eksisterende links bliver ved med at virke.",
  input: z.strictObject({ sektion: text(120).describe("Navn, slug eller id"), nytNavn: text(80, 2) }),
  category: "Sektioner",
  risk: "safe-write",
  permissions: SECTION_PERMISSIONS,
  summarize: (input) => `Omdøber sektionen ${input.sektion} til ${input.nytNavn}`,
  async execute(ctx, input) {
    const current = await resolveSection(ctx, input.sektion);
    const error = await updateCategory(current, { navn: input.nytNavn });
    if (error) return { ok: false, summary: error };
    return { ok: true, summary: `Omdøbte sektionen ${current.navn} til ${input.nytNavn}`, resultIds: [current.id], undo: { tool: "rename_section", input: { id: current.id, navn: current.navn }, label: `Fortryd: omdøbning af ${current.navn}` } };
  },
  async undo(ctx, input) {
    const current = typeof input.id === "string" ? await loadCategory(ctx, input.id) : null;
    if (!current || typeof input.navn !== "string") return { ok: false, summary: "Sektionen findes ikke længere." };
    const error = await updateCategory(current, { navn: input.navn });
    return error ? { ok: false, summary: error } : { ok: true, summary: `Navnet er sat tilbage til ${input.navn}` };
  },
});

export const moveSection = defineTool({
  name: "move_section",
  description: "Flytter en sektion ind under en anden topsektion (undersektion), eller op på øverste niveau når 'overordnet' er tom. Der er højst to niveauer, og en sektion med undersektioner kan ikke blive undersektion.",
  input: z.strictObject({ sektion: text(120), overordnet: text(120).nullable().describe("Ny overordnet sektion, eller null for øverste niveau") }),
  category: "Sektioner",
  risk: "safe-write",
  permissions: SECTION_PERMISSIONS,
  summarize: (input) => (input.overordnet ? `Flytter sektionen ${input.sektion} under ${input.overordnet}` : `Flytter sektionen ${input.sektion} til øverste niveau`),
  async execute(ctx, input) {
    const current = await resolveSection(ctx, input.sektion);
    const parent = input.overordnet ? await resolveSection(ctx, input.overordnet) : null;
    if (parent) {
      const children = await db.category.count({ where: { instansId: ctx.instansId, parentId: current.id } });
      if (children > 0) return { ok: false, summary: `Sektionen ${current.navn} har undersektioner og kan ikke blive undersektion (højst to niveauer).` };
    }
    const error = await updateCategory(current, { parentId: parent?.id ?? null });
    if (error) return { ok: false, summary: error };
    return { ok: true, summary: parent ? `Flyttede ${current.navn} under ${parent.navn}` : `Flyttede ${current.navn} til øverste niveau`, resultIds: [current.id], undo: { tool: "move_section", input: { id: current.id, parentId: current.parentId }, label: `Fortryd: flytning af ${current.navn}` } };
  },
  async undo(ctx, input) {
    const current = typeof input.id === "string" ? await loadCategory(ctx, input.id) : null;
    if (!current) return { ok: false, summary: "Sektionen findes ikke længere." };
    const parentId = typeof input.parentId === "string" ? input.parentId : null;
    const error = await updateCategory(current, { parentId });
    return error ? { ok: false, summary: error } : { ok: true, summary: `${current.navn} er flyttet tilbage` };
  },
});

export const reorderSections = defineTool({
  name: "reorder_sections",
  description: `Sætter rækkefølgen på sektioner. Giv sektionerne i den ønskede rækkefølge (højst ${MAX_ITEMS_PER_CALL}); de får fortløbende sortering fra 0.`,
  input: z.strictObject({ raekkefoelge: z.array(text(120)).min(1).max(MAX_ITEMS_PER_CALL).describe("Navn, slug eller id, først = øverst") }),
  category: "Sektioner",
  risk: "safe-write",
  permissions: SECTION_PERMISSIONS,
  summarize: (input) => `Sætter rækkefølgen: ${joinDa(input.raekkefoelge)}`,
  async execute(ctx, input) {
    const rows: CategoryRow[] = [];
    for (const ref of input.raekkefoelge) {
      const row = await resolveSection(ctx, ref);
      if (rows.some((r) => r.id === row.id)) throw new ToolError(`Sektionen ${row.navn} står flere gange i listen.`);
      rows.push(row);
    }
    const before = rows.map((r) => ({ id: r.id, sortering: r.sortering }));
    for (const [index, row] of rows.entries()) {
      if (row.sortering === index) continue;
      const error = await updateCategory(row, { sortering: index });
      if (error) return { ok: false, summary: `${row.navn}: ${error}` };
    }
    return { ok: true, summary: `Rækkefølgen er sat: ${joinDa(rows.map((r) => r.navn))}`, resultIds: rows.map((r) => r.id), undo: { tool: "reorder_sections", input: { before }, label: "Fortryd: ny rækkefølge" } };
  },
  async undo(ctx, input) {
    const before = Array.isArray(input.before) ? (input.before as { id?: unknown; sortering?: unknown }[]) : [];
    let restored = 0;
    for (const item of before.slice(0, MAX_ITEMS_PER_CALL)) {
      if (typeof item.id !== "string" || typeof item.sortering !== "number") continue;
      const current = await loadCategory(ctx, item.id);
      if (!current) continue;
      if (!(await updateCategory(current, { sortering: item.sortering }))) restored += 1;
    }
    return { ok: true, summary: `Genskabte rækkefølgen for ${restored} sektioner` };
  },
});

export const deleteSection = defineTool({
  name: "delete_section",
  description: "Sletter en TOM sektion (uden artikler og undersektioner). Kræver brugerens bekræftelse. Sektioner med indhold slettes ikke; flyt først artiklerne.",
  input: z.strictObject({ sektion: text(120) }),
  category: "Sektioner",
  risk: "confirm",
  permissions: SECTION_PERMISSIONS,
  summarize: (input) => `Sletter sektionen ${input.sektion}`,
  async details(ctx, input) {
    const row = await resolveSection(ctx, input.sektion);
    const counts = await db.category.findFirst({ where: { id: row.id, instansId: ctx.instansId }, include: { _count: { select: { articles: true, children: true } } } });
    const lines = [`Sletter sektionen ${row.navn} (/${row.slug})`, `Artikler i sektionen: ${counts?._count.articles ?? 0}`, `Undersektioner: ${counts?._count.children ?? 0}`];
    if ((counts?._count.articles ?? 0) > 0 || (counts?._count.children ?? 0) > 0) lines.push("Sektionen har indhold og bliver derfor ikke slettet, før indholdet er flyttet.");
    lines.push("Sletningen kan ikke fortrydes.");
    return lines;
  },
  async execute(ctx, input) {
    const row = await resolveSection(ctx, input.sektion);
    const res = await deleteCategory(row.id);
    if (res.error) return { ok: false, summary: res.error };
    return { ok: true, summary: `Slettede sektionen ${row.navn}`, resultIds: [row.id] };
  },
});
