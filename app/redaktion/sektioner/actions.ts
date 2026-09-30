"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { isReservedSlug, validateCategoryNesting } from "@/lib/taxonomy";

export type CategoryActionState = {
  error?: string;
  success?: string;
};

const categorySchema = z.object({
  navn: z.string().trim().min(2, "Navnet skal være mindst 2 tegn."),
  slug: z
    .string()
    .trim()
    .min(2, "Slug skal være mindst 2 tegn.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug må kun indeholde små bogstaver, tal og bindestreger."),
  beskrivelse: z.string().trim().optional(),
  sortering: z.coerce.number().int().min(0).default(0),
  iNavigation: z.boolean().default(true),
  parentId: z.string().trim().optional().nullable(),
});

export async function saveCategory(
  categoryId: string | null,
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const session = await auth();
  if (
    !session?.user ||
    (!can(session.user, PERMISSIONS.CATEGORY_MANAGE) &&
      !can(session.user, PERMISSIONS.FRONTPAGE_EDIT) &&
      !can(session.user, PERMISSIONS.ARTICLE_EDIT_ALL))
  ) {
    return { error: "Du har ikke rettigheder til at administrere sektioner." };
  }

  const rawParentId = formData.get("parentId");
  const parentId = typeof rawParentId === "string" && rawParentId.trim() ? rawParentId.trim() : null;

  const parsed = categorySchema.safeParse({
    navn: formData.get("navn"),
    slug: formData.get("slug"),
    beskrivelse: formData.get("beskrivelse"),
    sortering: formData.get("sortering") || 0,
    iNavigation: formData.get("iNavigation") === "on" || formData.get("iNavigation") === "true",
    parentId,
  });

  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(". ");
    return { error: msg };
  }

  const { navn, slug, beskrivelse, sortering, iNavigation } = parsed.data;

  // 1. Reserveret slug tjek
  if (isReservedSlug(slug)) {
    return { error: `Sluggen '${slug}' er reserveret til systemruter og kan ikke benyttes.` };
  }

  // 2. To-niveau validering
  if (parentId) {
    if (categoryId && parentId === categoryId) {
      return { error: "En sektion kan ikke være sin egen overkategori." };
    }

    const parentCat = await db.category.findFirst({
      where: { id: parentId, instansId: session.user.instansId },
    });

    if (!parentCat) {
      return { error: "Den valgte overordnede sektion findes ikke." };
    }

    const nestingCheck = validateCategoryNesting(parentCat);
    if (!nestingCheck.valid) {
      return { error: nestingCheck.error ?? "Maksimalt to niveauer er tilladt." };
    }
  }

  // 3. Unik slug pr. instans
  const existing = await db.category.findFirst({
    where: {
      instansId: session.user.instansId,
      slug,
      ...(categoryId ? { id: { not: categoryId } } : {}),
    },
  });

  if (existing) {
    return { error: `Der findes allerede en sektion med sluggen '${slug}'.` };
  }

  try {
    if (categoryId) {
      await db.category.update({
        where: { id: categoryId, instansId: session.user.instansId },
        data: {
          navn,
          slug,
          beskrivelse: beskrivelse || null,
          sortering,
          iNavigation,
          parentId,
        },
      });
    } else {
      await db.category.create({
        data: {
          navn,
          slug,
          beskrivelse: beskrivelse || null,
          sortering,
          iNavigation,
          parentId,
          instansId: session.user.instansId,
        },
      });
    }

    revalidatePath("/redaktion/sektioner");
    revalidatePath("/");
    return { success: categoryId ? "Sektionen er opdateret." : "Sektionen er oprettet." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Kunne ikke gemme sektionen." };
  }
}

export async function deleteCategory(categoryId: string): Promise<CategoryActionState> {
  const session = await auth();
  if (
    !session?.user ||
    (!can(session.user, PERMISSIONS.CATEGORY_MANAGE) &&
      !can(session.user, PERMISSIONS.FRONTPAGE_EDIT) &&
      !can(session.user, PERMISSIONS.ARTICLE_EDIT_ALL))
  ) {
    return { error: "Du har ikke rettigheder til at slette sektioner." };
  }

  const category = await db.category.findFirst({
    where: { id: categoryId, instansId: session.user.instansId },
    include: {
      _count: {
        select: { articles: true, children: true },
      },
    },
  });

  if (!category) {
    return { error: "Sektionen findes ikke." };
  }

  if (category._count.children > 0) {
    return {
      error: `Sektionen kan ikke slettes, da den har ${category._count.children} undersektioner. Slet eller flyt disse først.`,
    };
  }

  if (category._count.articles > 0) {
    return {
      error: `Sektionen kan ikke slettes, da der er ${category._count.articles} tilknyttede artikler. Flyt artiklerne til en anden sektion først.`,
    };
  }

  try {
    await db.category.delete({
      where: { id: categoryId, instansId: session.user.instansId },
    });

    revalidatePath("/redaktion/sektioner");
    revalidatePath("/");
    return { success: "Sektionen er slettet." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Kunne ikke slette sektionen." };
  }
}
