import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../lib/db";
import { isReservedSlug } from "../lib/taxonomy";
import * as inboxActions from "../app/redaktion/indbakke/actions";

test("Indbakke-actions eksporterer de fire konverteringer", () => {
  for (const name of ["convertQaToArticle", "convertInterviewToArticle", "convertSponsorBriefToArticle", "convertMeddelerSagToArticle"]) {
    assert.equal(typeof (inboxActions as Record<string, unknown>)[name], "function", name);
  }
});

test("Reserverede ruter indeholder alle 5 AI Library værktøjer", () => {
  assert.equal(isReservedSlug("qa"), true);
  assert.equal(isReservedSlug("interview"), true);
  assert.equal(isReservedSlug("sponsor"), true);
  assert.equal(isReservedSlug("partner"), true);
  assert.equal(isReservedSlug("meddeler"), true);
  assert.equal(isReservedSlug("indsend"), true);
});

test("SourceQA data model oprettes og understøtter spørgsmål og svar", async () => {
  const instance = await db.instance.findFirst();
  assert.ok(instance, "En instans skal eksistere i databasen");

  const qa = await db.sourceQA.create({
    data: {
      titel: "Test Q&A om lokal infrastruktur",
      emne: "Ny omfartsvej",
      kildeNavn: "Lise Nørgaard",
      kildeKontakt: "lise@kommune.dk",
      kildeRolle: "Teknisk direktør",
      status: "AFVENTER_SVAR",
      spoergsmaal: [
        { id: "q1", text: "Hvornår forventes vejen færdig?", type: "text" },
      ],
      svar: {
        q1: { text: "Forventet indvielse primo 2028." },
      },
      instansId: instance.id,
    },
  });

  assert.ok(qa.id);
  assert.ok(qa.token);
  assert.equal(qa.kildeNavn, "Lise Nørgaard");
  assert.equal(qa.status, "AFVENTER_SVAR");

  // Ryd op
  await db.sourceQA.delete({ where: { id: qa.id } });
});

test("InterviewSession data model understøtter tale, transskription og citater", async () => {
  const instance = await db.instance.findFirst();
  assert.ok(instance);

  const interview = await db.interviewSession.create({
    data: {
      titel: "Interview med formand for lokalrådet",
      emne: "Borgerbudgettering",
      formaal: "Lokal stemme",
      kildeNavn: "Jens Jensen",
      kildeKontakt: "jens@lokalraad.dk",
      kildeRolle: "Formand",
      status: "GENNEMFOERT",
      spoergsmaal: [
        { id: "i1", text: "Hvad er den vigtigste prioritet i år?" },
      ],
      svar: {
        i1: { text: "Vi vil etablere et grønt samlingspunkt for byens unge." },
      },
      citater: ["Vi vil etablere et grønt samlingspunkt."],
      transskription: "Spørgsmål: Hvad er den vigtigste prioritet i år?\nSvar: Vi vil etablere et grønt samlingspunkt for byens unge.",
      instansId: instance.id,
    },
  });

  assert.ok(interview.id);
  assert.equal(interview.status, "GENNEMFOERT");
  assert.ok(interview.transskription?.includes("grønt samlingspunkt"));

  // Ryd op
  await db.interviewSession.delete({ where: { id: interview.id } });
});

test("SponsorBrief data model gemmer partneroplysninger, brief og reviewItems", async () => {
  const instance = await db.instance.findFirst();
  assert.ok(instance);

  const brief = await db.sponsorBrief.create({
    data: {
      partnerNavn: "Lokal Sparekasse",
      kontaktNavn: "Mette Møller",
      kontaktEmail: "mette@sparekasse.dk",
      format: "native_artikel",
      status: "BriefModtaget",
      briefData: {
        budskab: "Ny fond støtter lokale idrætsforeninger",
      },
      citater: ["Vi ønsker at give tilbage til lokalområdet"],
      instansId: instance.id,
    },
  });

  assert.ok(brief.id);
  assert.ok(brief.token);
  assert.equal(brief.partnerNavn, "Lokal Sparekasse");

  // Ryd op
  await db.sponsorBrief.delete({ where: { id: brief.id } });
});

test("MeddelerProfile og MeddelerSag opretter relation og bevarer historik", async () => {
  const instance = await db.instance.findFirst();
  assert.ok(instance);

  const profile = await db.meddelerProfile.create({
    data: {
      navn: "Thomas Brolin",
      kontakt: "thomas@fodboldklub.dk",
      organisation: "Slagelse B&I Ungdom",
      kategori: "Sport",
      instansId: instance.id,
    },
  });

  assert.ok(profile.id);
  assert.ok(profile.token);

  const sag = await db.meddelerSag.create({
    data: {
      meddelerId: profile.id,
      titel: "U17 vandt pokalfinalen efter straffespark",
      kategori: "Sport",
      tekst: "En forrygende afslutning sikrede pokalen i overværelse af 300 tilskuere.",
      instansId: instance.id,
    },
  });

  assert.ok(sag.id);
  assert.equal(sag.meddelerId, profile.id);

  // Ryd op
  await db.meddelerSag.delete({ where: { id: sag.id } });
  await db.meddelerProfile.delete({ where: { id: profile.id } });
});
