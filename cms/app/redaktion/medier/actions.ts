"use server";

import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mediaMetadataSchema, parseRightsExpiry, validateRequiredImageMetadata } from "@/lib/media";
import { optimizeImage } from "@/lib/media-storage";
import { PERMISSIONS } from "@/lib/permissions";
import { validateUploadBuffer } from "@/lib/upload";
import { isHttpUrl, safeFilename } from "@/lib/validation/text";
import { rateLimit } from "@/lib/ratelimit";

export type MediaFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]> };

const externalSchema = z.string().max(2048).refine(isHttpUrl, "Angiv en gyldig URL med http eller https.");

function metadataFrom(formData: FormData, forcedType?: string) {
  return mediaMetadataSchema.safeParse({
    filtype: forcedType ?? formData.get("filtype"),
    altTekst: formData.get("altTekst") || undefined,
    billedtekst: formData.get("billedtekst") || undefined,
    ophavsperson: formData.get("ophavsperson") || undefined,
    rettighedsstatus: formData.get("rettighedsstatus") || undefined,
    licensType: formData.get("licensType") || undefined,
    rettighedsUdlob: formData.get("rettighedsUdlob") || undefined,
  });
}

async function requireMediaManager() {
  // Server-side autorisation (rettighed slås op i databasen) — uafhængig af proxy.ts.
  return getAuthorizedUser(PERMISSIONS.MEDIA_MANAGE);
}

export async function createMedia(_: MediaFormState, formData: FormData): Promise<MediaFormState> {
  const user = await requireMediaManager();
  if (!user) return { error: "Du har ikke adgang til at tilføje medier." };
  const source = formData.get("source");
  let url: string;
  let filnavn: string | null = null;
  let mimeType: string | null = null;
  let stoerrelse: number | null = null;
  let bredde: number | null = null;
  let hoejde: number | null = null;
  let kildeType = "Ekstern";
  let forcedType: string | undefined;

  if (source === "upload") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Vælg en fil, der skal uploades." };
    const limited = await rateLimit({ bucket: "media-upload", key: user.id, limit: 30, windowMs: 10 * 60_000 });
    if (!limited.ok) return { error: "For mange uploads på kort tid. Vent lidt og prøv igen." };
    // Hård øvre grænse før filen læses i hukommelsen; typespecifikke grænser håndhæves i validateUploadBuffer.
    if (file.size > 10 * 1024 * 1024) return { error: "Filen må højst fylde 10 MB." };
    const input = Buffer.from(await file.arrayBuffer());
    // Filtypen afgøres af filindholdet (magic bytes), ikke af klientens MIME-type eller filendelse.
    const checked = validateUploadBuffer(input);
    if (!checked.ok) return { error: checked.error };
    const allowed = checked.detected;
    const earlyMetadata = metadataFrom(formData, allowed.type);
    if (!earlyMetadata.success) return { error: "Kontrollér mediets metadata.", fieldErrors: earlyMetadata.error.flatten().fieldErrors };
    const earlyImageError = validateRequiredImageMetadata(allowed.type, earlyMetadata.data);
    if (earlyImageError) return { error: earlyImageError };
    // Filnavnet på disk er altid et uuid + fast endelse — brugerens filnavn bruges aldrig i stien.
    const id = randomUUID();
    const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
    await mkdir(uploadRoot, { recursive: true });
    if (allowed.type === "billede") {
      try {
        // Genkodning til WebP fjerner EXIF/GPS og eventuelt skjult indhold (polyglot-filer).
        const optimized = await optimizeImage(input);
        await writeFile(path.join(uploadRoot, `${id}.webp`), optimized.data, { flag: "wx" });
        url = `/uploads/${id}.webp`;
        mimeType = optimized.mimeType;
        stoerrelse = optimized.size;
        bredde = optimized.width;
        hoejde = optimized.height;
      } catch {
        return { error: "Billedfilen kunne ikke valideres eller optimeres." };
      }
    } else {
      const storedName = `${id}.${allowed.extension}`;
      await writeFile(path.join(uploadRoot, storedName), input, { flag: "wx" });
      url = `/uploads/${storedName}`;
      mimeType = allowed.mime;
      stoerrelse = input.length;
    }
    filnavn = safeFilename(file.name);
    forcedType = allowed.type;
    kildeType = "Lokal";
  } else {
    const parsedUrl = externalSchema.safeParse(formData.get("url"));
    if (!parsedUrl.success) return { error: parsedUrl.error.issues[0]?.message };
    url = parsedUrl.data;
    filnavn = safeFilename(new URL(url).pathname, "ekstern-fil");
  }

  const metadata = metadataFrom(formData, forcedType);
  if (!metadata.success) return { error: "Kontrollér mediets metadata.", fieldErrors: metadata.error.flatten().fieldErrors };
  const imageError = validateRequiredImageMetadata(metadata.data.filtype, metadata.data);
  if (imageError) return { error: imageError };
  const media = await db.media.create({ data: {
    ...metadata.data,
    altTekst: metadata.data.altTekst || null,
    billedtekst: metadata.data.billedtekst || null,
    ophavsperson: metadata.data.ophavsperson || null,
    rettighedsstatus: metadata.data.rettighedsstatus || null,
    licensType: metadata.data.licensType || null,
    rettighedsUdlob: parseRightsExpiry(metadata.data.rettighedsUdlob),
    url, filnavn, mimeType, stoerrelse, bredde, hoejde, kildeType,
    instansId: user.instansId,
  } });
  revalidatePath("/redaktion/medier");
  redirect(`/redaktion/medier/${media.id}?created=1`);
}

export async function updateMedia(mediaId: string, _: MediaFormState, formData: FormData): Promise<MediaFormState> {
  const user = await requireMediaManager();
  if (!user) return { error: "Du har ikke adgang til at redigere medier." };
  const existing = await db.media.findFirst({ where: { id: mediaId, instansId: user.instansId } });
  if (!existing) return { error: "Mediet findes ikke." };
  const metadata = metadataFrom(formData, existing.filtype);
  if (!metadata.success) return { error: "Kontrollér mediets metadata.", fieldErrors: metadata.error.flatten().fieldErrors };
  const imageError = validateRequiredImageMetadata(existing.filtype, metadata.data);
  if (imageError) return { error: imageError };
  await db.media.update({ where: { id: existing.id }, data: {
    altTekst: metadata.data.altTekst || null,
    billedtekst: metadata.data.billedtekst || null,
    ophavsperson: metadata.data.ophavsperson || null,
    rettighedsstatus: metadata.data.rettighedsstatus || null,
    licensType: metadata.data.licensType || null,
    rettighedsUdlob: parseRightsExpiry(metadata.data.rettighedsUdlob),
  } });
  revalidatePath("/redaktion/medier");
  revalidatePath(`/redaktion/medier/${existing.id}`);
  return { success: "Mediets metadata er gemt." };
}
