import { z } from "zod";
import { cleanText, isSafePublicUrl } from "./text";

/**
 * Zod-skemaer til offentlige (ikke-loggede) indtagsflader.
 * Alle tekstfelter går gennem cleanText: HTML fjernes, kontroltegn fjernes, længde kappes.
 * Råt input begrænses først (RAW_FACTOR) så en 10 MB-streng aldrig når transformeren.
 */

const RAW_FACTOR = 3;

export function plain(max: number, min = 0) {
  return z
    .string()
    .max(max * RAW_FACTOR, `Teksten må højst være ${max} tegn.`)
    .transform((value) => cleanText(value, max))
    .pipe(z.string().min(min, min > 0 ? `Skal være mindst ${min} tegn.` : undefined).max(max));
}

export function longText(max: number, min = 0) {
  return z
    .string()
    .max(max * RAW_FACTOR, `Teksten må højst være ${max} tegn.`)
    .transform((value) => cleanText(value, max, { multiline: true }))
    .pipe(z.string().min(min, min > 0 ? `Skal være mindst ${min} tegn.` : undefined).max(max));
}

export const emailSchema = z
  .string()
  .max(320)
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.string().email("Angiv en gyldig e-mailadresse.").max(254));

export const phoneSchema = z
  .string()
  .max(40)
  .transform((value) => value.replace(/[^\d+]/g, ""))
  .pipe(z.string().regex(/^\+?\d{6,15}$/, "Angiv et gyldigt telefonnummer."));

/** E-mail ELLER telefonnummer (indsend-formularens "kontakt"). */
export const contactSchema = z
  .string()
  .max(320)
  .transform((value) => cleanText(value, 254))
  .pipe(
    z.string().refine(
      (value) => emailSchema.safeParse(value).success || phoneSchema.safeParse(value).success,
      "Angiv en gyldig e-mailadresse eller et telefonnummer.",
    ),
  );

export const optionalPlain = (max: number) => z.union([plain(max), z.null()]).optional().transform((v) => (v ? v : undefined));
export const optionalLong = (max: number) => z.union([longText(max), z.null()]).optional().transform((v) => (v ? v : undefined));
export const optionalPhone = z
  .union([phoneSchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : undefined));

/** Honeypot: skjult felt der skal være tomt. Bots udfylder det. */
export const honeypotSchema = z.string().max(500).optional().nullable();

export const SPONSOR_FORMATS = ["Sponsoreret artikel", "Fyrtårnspartnerskab", "Native Tema", "native_artikel", "fokus_interview", "virksomhedsportraet"] as const;

export const sponsorBriefInput = z.object({
  partnerNavn: plain(120, 2),
  kontaktNavn: plain(120, 2),
  kontaktEmail: emailSchema,
  kontaktTelefon: optionalPhone,
  kampagnePeriode: optionalPlain(120),
  format: z.enum(SPONSOR_FORMATS).optional(),
  formaal: plain(300, 0),
  budskab: longText(4000, 3),
  citater: optionalLong(4000),
  fakta: optionalLong(4000),
  links: optionalLong(2000),
  website: honeypotSchema,
});

export const partnerReviewInput = z.object({
  approval: z.enum(["godkendt", "korrektioner"]),
  comment: optionalLong(3000),
});

export const publicQaInquiryInput = z.object({
  kildeNavn: plain(120, 2),
  kildeKontakt: contactSchema,
  kildeRolle: optionalPlain(120),
  emne: plain(200, 3),
  baggrund: optionalLong(4000),
  udtalelse: optionalLong(6000),
  website: honeypotSchema,
});

export const publicInterviewInput = z.object({
  kildeNavn: plain(120, 2),
  kildeKontakt: contactSchema,
  kildeRolle: optionalPlain(120),
  emne: plain(200, 3),
  tema: optionalPlain(200),
  website: honeypotSchema,
});

export const journalistQaInput = z.object({
  titel: plain(200, 3),
  emne: plain(200, 3),
  baggrund: optionalLong(4000),
  deadline: z.union([z.string().max(40), z.null()]).optional().transform((v) => (v && !Number.isNaN(new Date(v).getTime()) ? v : undefined)),
  kildeNavn: plain(120, 2),
  kildeKontakt: contactSchema,
  kildeRolle: optionalPlain(120),
  spoergsmaal: z.array(z.string().max(1000)).max(25).transform((list) => list.map((q) => cleanText(q, 500)).filter(Boolean)),
});

const MAX_ANSWERS = 50;

export const qaAnswersInput = z
  .record(
    z.string().max(64),
    z.object({ choice: optionalPlain(200), text: longText(6000) }),
  )
  .refine((answers) => Object.keys(answers).length > 0 && Object.keys(answers).length <= MAX_ANSWERS, "Ugyldigt antal svar.");

export const interviewAnswersInput = z
  .record(
    z.string().max(64),
    z.object({
      text: longText(8000),
      audioUrl: z
        .union([z.string().max(2048), z.null()])
        .optional()
        .transform((v) => (v && isSafePublicUrl(v) ? v : undefined)),
    }),
  )
  .refine((answers) => Object.keys(answers).length > 0 && Object.keys(answers).length <= MAX_ANSWERS, "Ugyldigt antal svar.");

export const MEDDELER_CATEGORIES = ["tip", "sport", "arrangement", "haendelse", "andet"] as const;

export const meddelerRegisterInput = z.object({
  navn: plain(120, 2),
  kontakt: emailSchema,
  phone: optionalPhone,
  organisation: optionalPlain(160),
  kategori: z.enum(MEDDELER_CATEGORIES).catch("tip"),
  omraader: optionalPlain(200),
  website: honeypotSchema,
});

export const meddelerSagInput = z.object({
  titel: plain(200, 3),
  kategori: z.enum(MEDDELER_CATEGORIES).optional().catch(undefined),
  tekst: longText(8000, 10),
  tidspunkt: optionalPlain(120),
  sted: optionalPlain(200),
  resultat: optionalPlain(300),
});

export const meddelerTipInput = z.object({
  token: z.string().max(128).optional(),
  category: z.enum(MEDDELER_CATEGORIES).catch("tip"),
  name: plain(120, 2),
  email: emailSchema,
  phone: optionalPhone,
  organisation: optionalPlain(160),
  what: plain(300, 3),
  who: optionalPlain(300),
  basis: optionalPlain(500),
  where: optionalPlain(200),
  when: optionalPlain(120),
  text: optionalLong(8000),
  audioTranscript: optionalLong(10000),
  photos: z
    .array(
      z.object({
        name: plain(200),
        url: z.string().max(2048).optional().transform((v) => (v && isSafePublicUrl(v) ? v : undefined)),
        credit: plain(200),
      }),
    )
    .max(10)
    .optional()
    .default([]),
  contactOk: z.boolean().optional(),
  consent: z.literal(true, "Samtykke er påkrævet."),
  website: honeypotSchema,
});

export const meddelerFollowUpInput = z.object({
  questionText: plain(500, 1),
  answerText: longText(6000, 1),
});

export function firstIssue(error: z.ZodError, fallback = "Kontrollér de udfyldte felter."): string {
  return error.issues[0]?.message || fallback;
}
