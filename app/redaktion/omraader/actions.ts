"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function saveAreaAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Ikke logget ind");

  const id = formData.get("id") as string | null;
  const navn = (formData.get("navn") as string)?.trim();
  let slug = (formData.get("slug") as string)?.trim();
  const latStr = (formData.get("lat") as string)?.trim();
  const lngStr = (formData.get("lng") as string)?.trim();

  if (!navn) throw new Error("Områdenavn er påkrævet");

  if (!slug) {
    slug = navn
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "oe")
      .replace(/å/g, "aa")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const lat = latStr ? parseFloat(latStr) : null;
  const lng = lngStr ? parseFloat(lngStr) : null;

  if (id) {
    await db.geoTag.update({
      where: { id },
      data: { navn, slug, lat, lng },
    });
  } else {
    await db.geoTag.create({
      data: {
        instansId: session.user.instansId,
        navn,
        slug,
        lat,
        lng,
      },
    });
  }

  revalidatePath("/redaktion/omraader");
  revalidatePath("/redaktion/sektioner");
  revalidatePath("/");
}

export async function deleteAreaAction(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Ikke logget ind");

  await db.geoTag.delete({
    where: { id },
  });

  revalidatePath("/redaktion/omraader");
  revalidatePath("/");
}
