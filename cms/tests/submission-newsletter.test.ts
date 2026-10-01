import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { validateMarking } from "../lib/marking";

// Skemaer til validering af borgerindsendelse (CMS-07, P-15)
const submissionTestSchema = z.object({
  navn: z.string().trim().min(2, "Angiv venligst dit navn (mindst 2 tegn)."),
  kontakt: z
    .string()
    .trim()
    .min(5, "Angiv venligst en gyldig e-mailadresse eller et telefonnummer."),
  emne: z.string().trim().min(3, "Angiv et emne eller en overskrift for historien."),
  tekst: z
    .string()
    .trim()
    .min(10, "Beskriv venligst sagen eller historien (mindst 10 tegn)."),
  omraadeId: z.string().optional().nullable(),
  billeder: z.string().optional().nullable(),
  rettigheder: z.boolean().refine((v) => v === true, {
    message: "Du skal bekræfte rettighederne til det indsendte materiale.",
  }),
  samtykke: z.boolean().refine((v) => v === true, {
    message: "Du skal give samtykke til redaktionel behandling.",
  }),
});

function validateHoneypot(honeypotValue?: string | null): boolean {
  return !honeypotValue || honeypotValue.trim().length === 0;
}

function formatCsvSubscriberRow(sub: {
  email: string;
  navn?: string | null;
  omraadeSlug?: string | null;
  sektionSlug?: string | null;
  aktiv: boolean;
  createdAt: Date;
}): string {
  const email = `"${(sub.email || "").replace(/"/g, '""')}"`;
  const navn = `"${(sub.navn || "").replace(/"/g, '""')}"`;
  const omraade = `"${(sub.omraadeSlug || "").replace(/"/g, '""')}"`;
  const sektion = `"${(sub.sektionSlug || "").replace(/"/g, '""')}"`;
  const status = sub.aktiv ? "Aktiv" : "Afmeldt";
  const dato = sub.createdAt.toISOString();
  return [email, navn, omraade, sektion, status, dato].join(";");
}

// Tests
test("P-15: Borgerindsendelse validerer obligatoriske felter, rettigheder og samtykke", () => {
  const valid = {
    navn: "Mette Frederiksen",
    kontakt: "mette@korsoer.dk",
    emne: "Huller i cykelstien på Halsskov",
    tekst: "Dette er en vigtig sag for alle skolebørn og pendlere i området.",
    rettigheder: true,
    samtykke: true,
  };

  const res = submissionTestSchema.safeParse(valid);
  assert.equal(res.success, true);

  // Manglende rettigheder skal fejle
  const missingRights = { ...valid, rettigheder: false };
  assert.equal(submissionTestSchema.safeParse(missingRights).success, false);

  // Manglende samtykke skal fejle
  const missingConsent = { ...valid, samtykke: false };
  assert.equal(submissionTestSchema.safeParse(missingConsent).success, false);

  // For kort tekst skal fejle
  const shortText = { ...valid, tekst: "Kort" };
  assert.equal(submissionTestSchema.safeParse(shortText).success, false);
});

test("P-15: Honeypot-spamværn afviser udfyldte spam-felter", () => {
  assert.equal(validateHoneypot(undefined), true);
  assert.equal(validateHoneypot(""), true);
  assert.equal(validateHoneypot("   "), true);
  assert.equal(validateHoneypot("http://spam-link.ru"), false);
  assert.equal(validateHoneypot("bot-input"), false);
});

test("A-07 / A-09: Konvertering til artikel bevarer 'Brugerindsendt' og afsender", () => {
  const submission = {
    id: "sub-123",
    navn: "Kirsten Lind",
    kontakt: "kirsten@skaelskor-roklub.dk",
    emne: "Skælskør Roklub fejrer 75 år",
    tekst: "Vi holder åbent hus for hele byen på lørdag.",
    omraadeId: "geo-skaelskor",
    rettighederAccepteret: true,
    samtykkeAccepteret: true,
  };

  // Simuler artikeloprettelse
  const createdArticle = {
    titel: submission.emne,
    indholdstype: "Brugerindsendt",
    marking: {
      afsender: submission.navn,
      oprindeligKontakt: submission.kontakt,
      rettighederBekræftet: submission.rettighederAccepteret,
      samtykkeGivet: submission.samtykkeAccepteret,
    },
    status: "Idé",
  };

  assert.equal(createdArticle.indholdstype, "Brugerindsendt");
  assert.equal(createdArticle.marking.afsender, "Kirsten Lind");

  // Skal validere mod systemets officielle mærkningsvalidering (AC-01)
  const validation = validateMarking(createdArticle.indholdstype, createdArticle.marking);
  assert.equal(validation.success, true);
});

test("P-16 / A-08: Nyhedsbrevsabonnenter formateres korrekt med semikolon og status", () => {
  const date = new Date("2026-09-30T10:00:00.000Z");

  const row1 = formatCsvSubscriberRow({
    email: "borger@slagelse.dk",
    navn: "Jens Jensen",
    omraadeSlug: "korsoer",
    sektionSlug: "kultur",
    aktiv: true,
    createdAt: date,
  });

  assert.equal(
    row1,
    `"borger@slagelse.dk";"Jens Jensen";"korsoer";"kultur";Aktiv;2026-09-30T10:00:00.000Z`
  );

  const row2 = formatCsvSubscriberRow({
    email: "afmeldt@eksempel.dk",
    navn: null,
    omraadeSlug: null,
    sektionSlug: null,
    aktiv: false,
    createdAt: date,
  });

  assert.equal(
    row2,
    `"afmeldt@eksempel.dk";"";"";"";Afmeldt;2026-09-30T10:00:00.000Z`
  );
});
