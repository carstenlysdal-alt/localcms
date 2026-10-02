import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db";
import { cleanText } from "../../validation/text";
import { ToolError, type ToolCtx } from "../types";

/** Tekstfelt: renses med cleanText (al HTML væk) og valideres bagefter. Skemaet i JSON er afrundet til max*4 tegn. */
export const text = (max: number, min = 1) =>
  z
    .string()
    .max(max * 4)
    .transform((value) => cleanText(value, max))
    .pipe(z.string().min(min, min <= 1 ? "Må ikke være tom." : `Skal være mindst ${min} tegn.`));

export const multilineText = (max: number, min = 1) =>
  z
    .string()
    .max(max * 4)
    .transform((value) => cleanText(value, max, { multiline: true }))
    .pipe(z.string().min(min, "Må ikke være tom."));

/** Id'er er cuid'er fra værktøjsresultater; formen begrænses, så der ikke kan smugles andet ind. */
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{6,40}$/, "Ugyldigt id.");

export function formData(fields: Record<string, string | string[] | number | boolean | null | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) fd.append(key, v);
    else fd.append(key, String(value));
  }
  return fd;
}

/** Gør en fejl fra en action/service til en dansk tekst uden tekniske detaljer. */
export function friendlyError(error: unknown, fallback = "Handlingen mislykkedes."): string {
  if (error instanceof ToolError) return error.message;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "Der findes allerede en post med de oplysninger.";
    return fallback;
  }
  if (error instanceof Error && error.message && error.message.length < 200 && !/prisma|invalid `|\n|at /i.test(error.message)) return error.message;
  return fallback;
}

/** Slår en sektion op i brugerens instans på id, slug eller (case-ufølsomt) navn. Flertydig = fejl. */
export async function resolveSection(ctx: ToolCtx, ref: string) {
  const needle = cleanText(ref, 120);
  if (!needle) throw new ToolError("Angiv en sektion.");
  const rows = await db.category.findMany({
    where: { instansId: ctx.instansId },
    select: { id: true, navn: true, slug: true, parentId: true, sortering: true, beskrivelse: true, iNavigation: true },
  });
  const lower = needle.toLowerCase();
  const byId = rows.filter((r) => r.id === needle);
  if (byId.length === 1) return byId[0];
  const bySlug = rows.filter((r) => r.slug === lower);
  if (bySlug.length === 1) return bySlug[0];
  const byName = rows.filter((r) => r.navn.toLowerCase() === lower);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) throw new ToolError(`Flere sektioner hedder '${needle}'. Brug sektionens id fra list_sections.`);
  throw new ToolError(`Sektionen '${needle}' findes ikke. Brug list_sections for at se de eksisterende.`);
}

export async function resolveArea(ctx: ToolCtx, ref: string) {
  const needle = cleanText(ref, 120);
  if (!needle) throw new ToolError("Angiv et område.");
  const rows = await db.geoTag.findMany({ where: { instansId: ctx.instansId }, select: { id: true, navn: true, slug: true, lat: true, lng: true } });
  const lower = needle.toLowerCase();
  const hit = rows.find((r) => r.id === needle) ?? rows.find((r) => r.slug === lower) ?? rows.find((r) => r.navn.toLowerCase() === lower);
  if (!hit) throw new ToolError(`Området '${needle}' findes ikke. Brug list_areas for at se de eksisterende.`);
  return hit;
}

/** Pæn liste til resumé: "A, B og C". */
export function joinDa(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} og ${items[items.length - 1]}`;
}
