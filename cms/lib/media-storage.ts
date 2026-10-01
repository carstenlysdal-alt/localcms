import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export async function optimizeImage(input: Buffer) {
  const { data, info } = await sharp(input, { failOn: "warning", limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, size: info.size, mimeType: "image/webp" as const };
}

// ── Lagringsadapter for uploads ─────────────────────────────────────────────
//
//   local   (dev)        public/uploads i projektmappen. Forsvinder ved redeploy på Railway — kun til udvikling.
//   volume  (Railway)    UPLOAD_DIR (eller $RAILWAY_VOLUME_MOUNT_PATH/uploads) på en persistent Railway Volume.
//   s3      IKKE implementeret: ingen S3-SDK er en afhængighed. Opfølgning (se docs/ops/RAILWAY-SETUP.md).
//
// Valg: UPLOAD_STORAGE=local|volume. Uden UPLOAD_STORAGE vælges `volume` hvis UPLOAD_DIR eller en Railway Volume findes,
// ellers `local`. Offentlige URL'er er altid /uploads/<uuid>.<ext> og serves af app/uploads/[name]/route.ts.

export type StorageDriver = "local" | "volume";
export type StorageConfig = { driver: StorageDriver; root: string };

export function getStorageConfig(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): StorageConfig {
  const requested = env.UPLOAD_STORAGE?.trim().toLowerCase();
  if (requested && requested !== "local" && requested !== "volume") {
    throw new Error(`UPLOAD_STORAGE=${requested} understøttes ikke (brug local eller volume; S3 er ikke implementeret).`);
  }
  const volumeMount = env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  const explicitDir = env.UPLOAD_DIR?.trim();
  const volumeDir = explicitDir || (volumeMount ? path.join(volumeMount, "uploads") : "");
  const driver: StorageDriver = requested === "local" ? "local" : requested === "volume" || volumeDir ? "volume" : "local";
  if (driver === "volume") {
    if (!volumeDir) throw new Error("UPLOAD_STORAGE=volume kræver UPLOAD_DIR (eller en Railway Volume med RAILWAY_VOLUME_MOUNT_PATH).");
    if (!path.isAbsolute(volumeDir)) throw new Error("UPLOAD_DIR skal være en absolut sti.");
    return { driver, root: path.resolve(volumeDir) };
  }
  return { driver, root: path.resolve(cwd, "public", "uploads") };
}

/** Kun filnavne vi selv genererer: uuid + hvidlistet endelse. Forhindrer path traversal og skjulte filer. */
export const UPLOAD_NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|wav|ogg|mp3|mp4|webm|pdf)$/;

export const UPLOAD_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  wav: "audio/wav",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
};

export function isValidUploadName(name: string): boolean {
  return UPLOAD_NAME_RE.test(name);
}

export function uploadContentType(name: string): string | null {
  const ext = name.split(".").pop() ?? "";
  return isValidUploadName(name) ? (UPLOAD_CONTENT_TYPES[ext] ?? null) : null;
}

/** Gem en upload. Afviser alt andet end uuid-navne. Eksisterende filer overskrives aldrig (flag wx). */
export async function saveUpload(name: string, data: Uint8Array, config: StorageConfig = getStorageConfig()): Promise<{ url: string }> {
  if (!isValidUploadName(name)) throw new Error("Ugyldigt upload-filnavn.");
  await mkdir(config.root, { recursive: true });
  await writeFile(path.join(config.root, name), data, { flag: "wx" });
  return { url: `/uploads/${name}` };
}

export type StoredUpload = { path: string; size: number; mtimeMs: number; contentType: string };

/** Slå en upload op (til serving). null hvis navnet er ugyldigt eller filen ikke findes. */
export async function findUpload(name: string, config: StorageConfig = getStorageConfig()): Promise<StoredUpload | null> {
  const contentType = uploadContentType(name);
  if (!contentType) return null;
  const file = path.join(config.root, name);
  try {
    const info = await stat(file);
    if (!info.isFile()) return null;
    return { path: file, size: info.size, mtimeMs: info.mtimeMs, contentType };
  } catch {
    return null;
  }
}
