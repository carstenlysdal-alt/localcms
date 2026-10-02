import { db } from "@/lib/db";

/** Statusværdier der tæller som "ny" i indbakken (kanoniske + ældre skrivemåder; samme sæt som isNewIntakeStatus). */
const NEW_STATUSES = ["Ny", "Modtaget", "NY", "MODTAGET", "Sendt", "AFVENTER_SVAR", "AFVENTER", "Oprettet", "OPRETTET", "BriefIndsendt", "BRIEFMODTAGET", "BRIEFINDSENDT"];

/** Antal nye henvendelser i indbakken (til tæller-badge). Fejl giver 0 — navigationen må aldrig vælte siden. */
export async function countNewIntake(instansId: string, includePartners: boolean): Promise<number> {
  const where = { instansId, status: { in: NEW_STATUSES } };
  try {
    const counts = await Promise.all([
      db.sourceQA.count({ where }),
      db.interviewSession.count({ where }),
      db.meddelerSag.count({ where }),
      db.submission.count({ where }),
      includePartners ? db.sponsorBrief.count({ where }) : Promise.resolve(0),
    ]);
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}
