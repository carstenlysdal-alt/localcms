/**
 * Idempotent rettelse af demodata i en EKSISTERENDE database (T6 nr. 28-29): erstatter rigtige varemærker/organisationer med
 * tydelige pladsholdere ("Eksempel Partner A"), fjerner opdigtede citater og opdigtede kilde-URL'er, og omskriver
 * udfyldningstekster der påstod research ("Redaktionen har talt med …"). Svarer til ændringerne i prisma/seed.ts og
 * prisma/network-seed-data.ts, så en database der blev seedet før kan bringes på linje uden at nulstille den.
 *
 * Kør:   npx tsx scripts/fix-demo-data.ts            (tør-kørsel: --dry)
 * Tager KUN demodata: rør aldrig en produktionsdatabase. Tag en sikkerhedskopi af prisma/dev.db først.
 */
import { PrismaClient, Prisma } from "@prisma/client";

try { process.loadEnvFile?.(".env"); } catch { /* valgfri */ }

export const TEXT_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["Sparekassen Sjælland-Fyn uddeler 250.000 kroner til lokale ungeprojekter", "Eksempel Partner A støtter lokale ungeprojekter (demodata)"],
  ["Finansieret af Sparekassen Sjælland-Fyn", "Finansieret af Eksempel Partner A"],
  ["Sparekassen Sjælland-Fyn", "Eksempel Partner A"],
  ["erhverv@spks.dk", "kontakt@eksempel-partner-a.example"],
  ["Klaus Mortensen", "Eksempel Kontaktperson"],
  ["Vestsjællands Bilcenter åbner topmoderne lade- og servicecenter for elbiler", "Eksempel Partner B åbner lade- og servicecenter for elbiler (demodata)"],
  ["vestsjaellands-bilcenter-udvider-med-nyt-elbilvaerksted", "eksempel-partner-b-udvider-med-nyt-elbilvaerksted"],
  ["Vestsjællands Bilcenter", "Eksempel Partner B"],
  ["salg@vestbil.dk", "kontakt@eksempel-partner-b.example"],
  ["Harboe Fonden - Støtte til lokalsport", "Eksempel Fond - Støtte til lokalsport"],
  ["Harboe Bryggeri A/S", "Eksempel Partner C"],
  ["Søg Harboe Fonden til jeres", "Søg Eksempel Fond til jeres"],
  ["https://harboe.com/fond", "https://eksempel-partner-c.example/fond"],
  ["Slagelse Vin & Madkultur", "Eksempel Partner D"],
  ["https://slagelse-vin.dk", "https://eksempel-partner-d.example"],
  ["Munkholm Erhvervspark A/S", "Eksempel Partner E"],
  ["Munkholm Erhvervspark - Iværksætterhub", "Eksempel Partner E - Iværksætterhub"],
  ["https://munkholm-erhverv.dk", "https://eksempel-partner-e.example"],
  ["Pressemeddelelse: Region Sjælland inviterer til borgermøde om Slagelse Sygehus", "Pressemeddelelse: Eksempel Region inviterer til borgermøde om sygehusplaner (demodata)"],
  ["region-sjaelland-indkalder-til-borgermoede-om-fremtidens-sygehuse", "eksempel-region-indkalder-til-borgermoede-om-sygehuse"],
  ["Region Sjælland Presseenhed", "Eksempel Region Presseenhed"],
  ["oplyser Region Sjælland.", "oplyser Eksempel Region."],
  ["Pressemeddelelse: Korsør Teaterforening tildeles 800.000 kr. fra Realdania", "Pressemeddelelse: Korsør Teaterforening tildeles et eksempelbeløb fra Eksempel Fond (demodata)"],
  ["teaterforening-modtager-realdania-stoette-til-renovering", "teaterforening-modtager-stoette-fra-eksempel-fond"],
  ["https://slagelse.dk/politik/dagsordener-og-referater/byraad/2026-09-28", "https://example.com/eksempel/byraad-dagsorden"],
  ["https://politi.dk/midt-og-vestsjaellands-politi/doegnrapporter/2026-09-29", "https://example.com/eksempel/doegnrapport"],
  ["https://udbud.dk/bekendtgoerelser/2026-slagelse-idraet-09", "https://example.com/eksempel/udbud"],
  ["https://dmi.dk/danmark/vestsjaelland-regionaludsigt-2026", "https://example.com/eksempel/vejrudsigt"],
  ["Referat godkendt af Slagelse Byrådssekretariat 29. september 2026", "Eksempelreference (demodata)"],
  ["Flere lokale aktører har udtalt sig positivt om initiativet. Redaktionen har talt med berørte parter, der understreger betydningen af gennemskuelighed og lokal forankring.", "Dette afsnit er udfyldningstekst i demodata. Indholdet er opdigtet og bygger ikke på research eller rigtige kilder."],
  ["Vi har arbejdet målrettet på at finde en balanceret løsning for hele kommunen.", "Dette er et eksempelcitat til demonstration og stammer ikke fra en rigtig person."],
  ["Kommunal talsmand", "Eksempel Talsperson (fiktiv)"],
  ["https://slagelse.dk/presse/udtalelser-2026", "https://example.com/eksempel/udtalelse"],
  ["Vi arbejder hver dag for at skabe de bedste rammer for vores lokalsamfund og fællesskab.", "Dette er et eksempelcitat til demonstration og stammer ikke fra en rigtig person."],
  ["roskilde-festival-donerer-15-millioner-til-lokale-kultur-og-ungdomsprojekter", "eksempel-festival-donerer-overskud-til-lokale-kultur-og-ungdomsprojekter"],
  ["Roskilde Festival uddeler 15 millioner i overskud: 'Frivilligheden er vores hjerteblod'", "Eksempel Festival deler overskud ud til lokale foreninger (demodata)"],
  ["Over 40 lokale foreninger og sociale initiativer modtager støtte fra festivalens fond i år.", "Eksempel: Lokale foreninger og sociale initiativer kan modtage støtte fra en festivals fond. Alle tal og navne er opdigtede."],
  ["Kultur- og musikjournalist med dækning af Musicon, Roskilde Festival og fjordlivet.", "Kultur- og musikjournalist med dækning af Musicon, byens festivaler og fjordlivet."],
];

/** Regex-erstatninger for tekst med variable dele (udfyldningsafsnit pr. by, lokale talspersoner). */
export const REGEX_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Redaktionen på [^<]*? har talt med kilder i [^<]*?, som understreger, at initiativet kan få mærkbar betydning for områdets fremtid\./g, "Dette afsnit er udfyldningstekst i demodata. Indholdet er opdigtet og bygger ikke på research eller rigtige kilder."],
  [/Lokal talsperson, [^"\\]+/g, "Eksempel Talsperson (fiktiv)"],
  [/https:\/\/[a-z0-9.-]+\/om-mediet\/kontakt(?=")/g, "https://example.com/eksempel/udtalelse"],
];

export function applyReplacements(input: string): string {
  let out = input;
  for (const [from, to] of TEXT_REPLACEMENTS) out = out.split(from).join(to);
  for (const [re, to] of REGEX_REPLACEMENTS) out = out.replace(re, to);
  return out;
}

const json = (v: unknown) => JSON.stringify(v);

/** Retter demodata i `db`. Returnerer antal rækker der blev (eller ville blive) rettet. Idempotent. */
export async function fixDemoData(db: PrismaClient, dry = false): Promise<number> {
  let changed = 0;
  const note = (kind: string, id: string) => {
    changed++;
    console.log(`${dry ? "[dry] " : ""}${kind}: ${id}`);
  };
  for (const a of await db.article.findMany({ select: { id: true, titel: true, manchet: true, slug: true, blocks: true, marking: true, provenance: true, aiBrug: true } })) {
    const next = {
      titel: applyReplacements(a.titel),
      manchet: a.manchet ? applyReplacements(a.manchet) : a.manchet,
      slug: applyReplacements(a.slug),
      blocks: JSON.parse(applyReplacements(json(a.blocks))) as Prisma.InputJsonValue,
      marking: a.marking === null ? null : (JSON.parse(applyReplacements(json(a.marking))) as Prisma.InputJsonValue),
      provenance: a.provenance === null ? null : (JSON.parse(applyReplacements(json(a.provenance))) as Prisma.InputJsonValue),
    };
    const dirty =
      next.titel !== a.titel || next.manchet !== a.manchet || next.slug !== a.slug ||
      json(next.blocks) !== json(a.blocks) || json(next.marking) !== json(a.marking) || json(next.provenance) !== json(a.provenance);
    if (!dirty) continue;
    if (next.slug !== a.slug && (await db.article.findUnique({ where: { slug: next.slug } }))) next.slug = a.slug; // ingen kollision
    note("Article", `${a.slug} -> ${next.slug}`);
    if (!dry) {
      await db.article.update({
        where: { id: a.id },
        data: { titel: next.titel, manchet: next.manchet, slug: next.slug, blocks: next.blocks, marking: next.marking ?? Prisma.JsonNull, provenance: next.provenance ?? Prisma.JsonNull },
      });
    }
  }

  for (const o of await db.organization.findMany()) {
    const navn = applyReplacements(o.navn);
    const kontakt = o.kontakt ? applyReplacements(o.kontakt) : o.kontakt;
    if (navn === o.navn && kontakt === o.kontakt) continue;
    note("Organization", o.id);
    if (!dry) await db.organization.update({ where: { id: o.id }, data: { navn, kontakt } });
  }
  for (const s of await db.supportAgreement.findMany()) {
    const organisationNavn = applyReplacements(s.organisationNavn);
    const kontaktperson = s.kontaktperson ? applyReplacements(s.kontaktperson) : s.kontaktperson;
    if (organisationNavn === s.organisationNavn && kontaktperson === s.kontaktperson) continue;
    note("SupportAgreement", s.id);
    if (!dry) await db.supportAgreement.update({ where: { id: s.id }, data: { organisationNavn, kontaktperson } });
  }
  for (const c of await db.adCampaign.findMany()) {
    const titel = applyReplacements(c.titel);
    const annoncoer = applyReplacements(c.annoncoer);
    const kreativData = JSON.parse(applyReplacements(json(c.kreativData))) as Prisma.InputJsonValue;
    if (titel === c.titel && annoncoer === c.annoncoer && json(kreativData) === json(c.kreativData)) continue;
    note("AdCampaign", c.id);
    if (!dry) await db.adCampaign.update({ where: { id: c.id }, data: { titel, annoncoer, kreativData } });
  }
  for (const a of await db.author.findMany({ select: { id: true, bio: true } })) {
    const bio = a.bio ? applyReplacements(a.bio) : a.bio;
    if (bio === a.bio) continue;
    note("Author", a.id);
    if (!dry) await db.author.update({ where: { id: a.id }, data: { bio } });
  }
  return changed;
}

async function main() {
  const dry = process.argv.includes("--dry");
  const db = new PrismaClient();
  try {
    const changed = await fixDemoData(db, dry);
    console.log(`${dry ? "Tør-kørsel: " : ""}${changed} rækker ${dry ? "ville blive " : ""}rettet.`);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1]?.endsWith("fix-demo-data.ts")) void main();
