import { Prisma } from "@prisma/client";
import { db } from "../db";
import { normalizeUrl } from "../validation/text";
import type { IngestGeo, IngestItemResult } from "./schema";
import { signalInputSchema } from "./schema";
import type { z } from "zod";

type ParsedSignal = z.output<typeof signalInputSchema>;

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slå en geo-angivelse op i instansens GeoTags (slug -> navn -> postnr i slug/navn). Aldrig på tværs af instanser. */
export async function resolveGeo(instansId: string, geo: IngestGeo | undefined): Promise<{ omraadeId: string | null; omraadeTekst: string | null }> {
  if (!geo) return { omraadeId: null, omraadeTekst: null };
  const candidates = typeof geo === "string" ? [geo] : [geo.omraade, geo.by, geo.kommune].filter((v): v is string => Boolean(v));
  const postnr = typeof geo === "string" ? (/^\d{4}$/.test(geo) ? geo : undefined) : geo.postnr;
  const tags = await db.geoTag.findMany({ where: { instansId }, select: { id: true, navn: true, slug: true } });

  for (const candidate of candidates) {
    const slug = slugify(candidate);
    const hit = tags.find((t) => t.slug === slug) ?? tags.find((t) => t.navn.toLowerCase() === candidate.toLowerCase());
    if (hit) return { omraadeId: hit.id, omraadeTekst: null };
  }
  if (postnr) {
    const hit = tags.find((t) => t.slug === postnr || t.navn.includes(postnr));
    if (hit) return { omraadeId: hit.id, omraadeTekst: null };
  }
  const hint = [...candidates, postnr].filter(Boolean).join(" / ");
  return { omraadeId: null, omraadeTekst: hint ? hint.slice(0, 200) : null };
}

/**
 * Idempotent upsert af ét signal for en given instans.
 *  1. (instansId, externalId) findes  -> opdatér hvis indholdet er ændret (version+1), ellers "duplicate"
 *  2. normaliseret kildeUrl findes    -> "duplicate" (intet overskrives; mangler rækken externalId, knyttes den)
 *  3. ellers opret.
 * Signaler er altid `maskinindsamlet`, `breaking=false`, `notable=false` — agenter kan ikke eskalere til breaking.
 */
export async function upsertSignal(instansId: string, ingestKeyId: string, input: ParsedSignal): Promise<IngestItemResult> {
  const kildeUrlNorm = normalizeUrl(input.kildeUrl);
  const brodtekst = input.braedtekst ?? input["brødtekst"] ?? null;
  const geo = await resolveGeo(instansId, input.geo);
  const kildeTidspunkt = input.publishedAt ? new Date(input.publishedAt) : null;

  const data = {
    overskrift: input.overskrift,
    brødtekst: brodtekst,
    kilde: input.kilde,
    kildeUrl: input.kildeUrl,
    sourceType: input.sourceType,
    omraadeId: geo.omraadeId,
    omraadeTekst: geo.omraadeTekst,
    kildeTidspunkt,
  };

  const byExternal = await db.signal.findUnique({ where: { instansId_externalId: { instansId, externalId: input.externalId } } });
  if (byExternal) {
    const changed =
      byExternal.overskrift !== data.overskrift ||
      (byExternal.brødtekst ?? null) !== data.brødtekst ||
      byExternal.kilde !== data.kilde ||
      byExternal.sourceType !== data.sourceType ||
      byExternal.omraadeId !== data.omraadeId ||
      (byExternal.kildeUrl ?? null) !== data.kildeUrl;
    if (!changed) return { status: "duplicate", id: byExternal.id, externalId: input.externalId, duplicateOf: "externalId" };
    // kildeUrlNorm opdateres kun hvis den ikke kolliderer med en anden række.
    let nextNorm = byExternal.kildeUrlNorm;
    if (kildeUrlNorm && kildeUrlNorm !== byExternal.kildeUrlNorm) {
      const clash = await db.signal.findUnique({ where: { instansId_kildeUrlNorm: { instansId, kildeUrlNorm } }, select: { id: true } });
      if (!clash) nextNorm = kildeUrlNorm;
    }
    const updated = await db.signal.update({ where: { id: byExternal.id }, data: { ...data, kildeUrlNorm: nextNorm, version: { increment: 1 }, ingestKeyId } });
    return { status: "updated", id: updated.id, externalId: input.externalId };
  }

  if (kildeUrlNorm) {
    const byUrl = await db.signal.findUnique({ where: { instansId_kildeUrlNorm: { instansId, kildeUrlNorm } } });
    if (byUrl) {
      if (!byUrl.externalId) await db.signal.update({ where: { id: byUrl.id }, data: { externalId: input.externalId } }).catch(() => {});
      return { status: "duplicate", id: byUrl.id, externalId: input.externalId, duplicateOf: "kildeUrl" };
    }
  }

  try {
    const created = await db.signal.create({
      data: { ...data, instansId, externalId: input.externalId, kildeUrlNorm, maskinindsamlet: true, notable: false, breaking: false, ingestKeyId },
    });
    return { status: "created", id: created.id, externalId: input.externalId };
  } catch (error) {
    // Race: samtidig request nåede først -> behandl som duplikat.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing =
        (await db.signal.findUnique({ where: { instansId_externalId: { instansId, externalId: input.externalId } } })) ??
        (kildeUrlNorm ? await db.signal.findUnique({ where: { instansId_kildeUrlNorm: { instansId, kildeUrlNorm } } }) : null);
      return { status: "duplicate", id: existing?.id, externalId: input.externalId, duplicateOf: existing?.externalId === input.externalId ? "externalId" : "kildeUrl" };
    }
    throw error;
  }
}
