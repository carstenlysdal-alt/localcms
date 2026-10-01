import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";

export const NEWSLETTER_RATE_LIMIT = { limit: 5, windowMs: 10 * 60_000 } as const;

const slugField = z
  .string()
  .trim()
  .max(80)
  .regex(/^[a-z0-9-]*$/, "Ugyldig værdi.")
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const newsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "E-mailadressen er for lang.")
    .email("Indtast venligst en gyldig e-mailadresse."),
  navn: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  omraadeSlug: slugField,
  sektionSlug: slugField,
  samtykke: z.boolean().refine((v) => v === true, {
    message: "Du skal acceptere betingelserne for at modtage nyhedsbrevet.",
  }),
  /** Honeypot: skjult felt som kun robotter udfylder. */
  website: z.string().optional().nullable(),
});

export type NewsletterInput = z.input<typeof newsletterSchema>;

export type SubscribeResult =
  | { success: true; message: string }
  | { success: false; error: string };

/** Læser nyhedsbrevsfelter fra FormData på samme måde for server action og API-rute. */
export function newsletterInputFromFormData(formData: FormData): NewsletterInput {
  const get = (k: string) => formData.get(k)?.toString() ?? null;
  const samtykke = get("samtykke");
  return {
    email: get("email") ?? "",
    navn: get("navn"),
    omraadeSlug: (get("omraadeSlug") ?? "").toLowerCase() || null,
    sektionSlug: (get("sektionSlug") ?? "").toLowerCase() || null,
    samtykke: samtykke === "on" || samtykke === "true",
    website: get("website"),
  };
}

/**
 * Fælles kerne: validerer, rate-limiter pr. IP, afviser honeypot, dedupe'r pr. (instans, e-mail)
 * og gemmer/genaktiverer NewsletterSubscriber for netop denne by.
 */
export async function subscribeToNewsletterCore(args: {
  input: NewsletterInput;
  instansId: string;
  siteNavn: string;
  ip: string;
}): Promise<SubscribeResult> {
  const { input, instansId, siteNavn, ip } = args;

  const limited = await rateLimit({
    bucket: "newsletter-subscribe",
    key: ip,
    limit: NEWSLETTER_RATE_LIMIT.limit,
    windowMs: NEWSLETTER_RATE_LIMIT.windowMs,
    failMode: "closed",
  });
  if (!limited.ok) {
    return { success: false, error: "For mange forsøg. Vent et par minutter og prøv igen." };
  }

  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Udfyld venligst de påkrævede felter." };
  }
  const { email, navn, omraadeSlug, sektionSlug, website } = parsed.data;

  // Honeypot udfyldt: lad som om det lykkedes, men gem intet.
  if (website && website.trim().length > 0) {
    return { success: true, message: "Tak for din tilmelding!" };
  }

  const existing = await db.newsletterSubscriber.findFirst({ where: { instansId, email } });

  if (existing) {
    if (existing.aktiv) {
      return { success: true, message: `Du er allerede tilmeldt ${siteNavn}s nyhedsbrev.` };
    }
    await db.newsletterSubscriber.update({
      where: { id: existing.id },
      data: {
        aktiv: true,
        afmeldtTid: null,
        bekraeftetTid: new Date(),
        navn: navn || existing.navn,
        omraadeSlug: omraadeSlug || existing.omraadeSlug,
        sektionSlug: sektionSlug || existing.sektionSlug,
      },
    });
    return { success: true, message: `Velkommen tilbage! Vi har genaktiveret din tilmelding til ${siteNavn}.` };
  }

  try {
    await db.newsletterSubscriber.create({
      data: { email, navn, omraadeSlug, sektionSlug, aktiv: true, bekraeftetTid: new Date(), instansId },
    });
  } catch (error) {
    // Race: samme e-mail oprettet samtidig (unik [instansId, email]) behandles som allerede tilmeldt.
    const code = (error as { code?: string }).code;
    if (code !== "P2002") throw error;
  }
  return { success: true, message: `Tak for din tilmelding! Vi sender det vigtigste lokale overblik til ${email}.` };
}
