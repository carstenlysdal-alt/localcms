"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { cleanText } from "@/lib/validation/text";

// Samme rettighedsmodel som sektioner (taksonomi): CATEGORY_MANAGE, med FRONTPAGE_EDIT/ARTICLE_EDIT_ALL som fallback.
const AREA_PERMISSIONS = [PERMISSIONS.CATEGORY_MANAGE, PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.ARTICLE_EDIT_ALL];

function toSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCoord(value: string | undefined, min: number, max: number) {
  if (!value) return null;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error("Ugyldig koordinat");
  return n;
}

export async function saveAreaAction(formData: FormData) {
  const user = await getAuthorizedUser(AREA_PERMISSIONS);
  if (!user) throw new Error("Ingen adgang til at administrere områder");

  const id = (formData.get("id") as string | null) || null;
  const navn = cleanText(String(formData.get("navn") ?? ""), 120);
  let slug = cleanText(String(formData.get("slug") ?? ""), 120);

  if (!navn) throw new Error("Områdenavn er påkrævet");
  slug = toSlug(slug || navn);
  if (!slug) throw new Error("Ugyldigt område-slug");

  const lat = parseCoord((formData.get("lat") as string | null)?.trim(), -90, 90);
  const lng = parseCoord((formData.get("lng") as string | null)?.trim(), -180, 180);

  if (id) {
    // Tenant-binding: kun områder i brugerens egen instans kan redigeres.
    const result = await db.geoTag.updateMany({ where: { id, instansId: user.instansId }, data: { navn, slug, lat, lng } });
    if (result.count !== 1) throw new Error("Området findes ikke");
  } else {
    await db.geoTag.create({ data: { instansId: user.instansId, navn, slug, lat, lng } });
  }

  revalidatePath("/redaktion/omraader");
  revalidatePath("/redaktion/sektioner");
  revalidatePath("/");
}

export async function deleteAreaAction(id: string) {
  const user = await getAuthorizedUser(AREA_PERMISSIONS);
  if (!user) throw new Error("Ingen adgang til at administrere områder");

  const result = await db.geoTag.deleteMany({ where: { id: String(id), instansId: user.instansId } });
  if (result.count !== 1) throw new Error("Området findes ikke");

  revalidatePath("/redaktion/omraader");
  revalidatePath("/");
}
