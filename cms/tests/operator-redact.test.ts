import assert from "node:assert/strict";
import test from "node:test";
import { containsPii, isContactKey, maskPiiText, PiiVault, redactForExternalLlm } from "../lib/operator/redact";

test("maskering: e-mail og telefon (flere formater) bliver til stabile pladsholdere; CPR, konto og nøgler fjernes", () => {
  const v = new PiiVault();
  const text = "Mail anna.hansen@firma.dk eller Anna.Hansen@firma.dk, ring +45 12 34 56 78, 12345678, 12 34 56 78 eller 1234 5678. CPR 010190-1234 og 0101901234. DK50 0040 0440 1162 43. Nøgle " + ["sk", "abcdefghijklmnopqrstuvwxyz012345"].join("-");
  const out = v.mask(text);
  for (const leak of ["anna.hansen@", "Anna.Hansen@", "12 34 56 78", "12345678", "1234 5678", "010190", "0101901234", "0040 0440", "abcdefghijklmnop"]) assert.ok(!out.includes(leak), `lækkede ${leak}`);
  assert.ok(!containsPii(out), "intet at maskere i det maskerede");
  const emails = out.match(/\[e-mail-k[0-9a-f]{7}\]/g) ?? [];
  assert.equal(emails.length, 2);
  assert.equal(emails[0], emails[1], "samme adresse (uanset store/små bogstaver) = samme pladsholder");
  assert.equal(v.stats.emails, 2);
  assert.ok(v.stats.phones >= 4);
  assert.equal(v.stats.cpr, 2);
});

test("maskering: almindelige tal, datoer og id'er røres ikke", () => {
  const v = new PiiVault();
  const safe = "Artikel cm1234567890abcdef, opdateret 2026-10-03T12:00:00.000Z, 1759500000000, version 1.2.3, 1500 visninger, 6 sektioner, id-12345678";
  assert.equal(v.mask(safe), safe);
});

test("gendannelse: pladsholdere kan gendannes lokalt (argumenter og stream), ukendte og CPR gendannes aldrig", () => {
  const v = new PiiVault();
  const masked = v.mask("Opret bruger anna@firma.dk, tlf 12 34 56 78, cpr 010190-1234");
  const mail = /\[e-mail-k[0-9a-f]{7}\]/.exec(masked)![0];
  assert.deepEqual(v.restoreDeep({ email: mail, liste: [mail], n: 3, nested: { x: `kontakt ${mail}` } }), { email: "anna@firma.dk", liste: ["anna@firma.dk"], n: 3, nested: { x: "kontakt anna@firma.dk" } });
  assert.equal(v.restore("[e-mail-kdeadbee]"), "[e-mail-kdeadbee]");
  assert.ok(masked.includes("[cpr-fjernet]") && !v.restore(masked).includes("010190"));

  // pladsholder delt over to deltaer
  const out: string[] = [];
  const r = v.restorer((t) => out.push(t));
  const cut = 6;
  r.push(`Oprettet ${mail.slice(0, cut)}`);
  r.push(`${mail.slice(cut)} nu. [ikke en pladsholder`);
  r.flush();
  assert.equal(out.join(""), "Oprettet anna@firma.dk nu. [ikke en pladsholder");
  assert.ok(out.every((s) => !s.includes("[e-mail-")));
});

test("pladsholderen er stabil på tværs af ture (hash), så historik genmaskeres uden at nummereringen skifter", () => {
  assert.equal(new PiiVault().mask("a@b.dk"), new PiiVault().mask("a@b.dk"));
  assert.notEqual(new PiiVault().mask("a@b.dk"), new PiiVault().mask("c@b.dk"));
});

test("redactForExternalLlm: kontaktfelter fjernes generelt, værktøjets dropKeys og resumé respekteres, tekst maskeres", () => {
  const v = new PiiVault();
  const inbox = redactForExternalLlm(
    {
      ok: true,
      summary: "2 indsendelser",
      data: [
        { id: "s1", emne: "Hul i vejen, ring 12 34 56 78", afsender: "Pia Privat", kontakt: "pia@privat.dk", email: "pia@privat.dk", telefon: "12345678", status: "Ny", uddrag: "Skriv til pia@privat.dk", modtaget: new Date("2026-10-01T10:00:00Z") },
        { id: "s2", emne: "Trafik", navn: "Per", status: "Ny", kildeKontakt: "x", adresse: "Vej 1", ipAdresse: "1.2.3.4" },
      ],
    },
    v,
    { dropKeys: ["afsender", "navn", "uddrag"] },
  );
  const json = JSON.stringify(inbox);
  for (const leak of ["Pia", "pia@", "12345678", "12 34 56 78", "Per", "Vej 1", "1.2.3.4", "Skriv til"]) assert.ok(!json.includes(leak), `lækkede ${leak}`);
  assert.match(json, /"id":"s1"/);
  assert.match(json, /"status":"Ny"/);
  assert.match(json, /2026-10-01/);
  assert.ok(v.stats.droppedFields >= 9);

  const created = redactForExternalLlm({ ok: true, summary: "Oprettede brugeren Anna Hansen (Støtte)", data: undefined }, new PiiVault(), { summaryOnOk: "Brugeren er oprettet." });
  assert.equal(created.summary, "Brugeren er oprettet.");
  const failed = redactForExternalLlm({ ok: false, summary: "Fejl for anna@firma.dk" }, new PiiVault(), { summaryOnOk: "Brugeren er oprettet." });
  assert.ok(!failed.summary.includes("anna@"), "fejlresumé maskeres i stedet");
});

test("isContactKey/maskPiiText", () => {
  for (const k of ["email", "E-mail", "kontaktEmail", "kildeKontakt", "telefon", "phone", "afsender", "adresse", "ip", "password", "tempPassword", "token", "apiKey"]) assert.ok(isContactKey(k), k);
  for (const k of ["id", "titel", "status", "navn", "emne", "visninger", "sektion"]) assert.ok(!isContactKey(k), k);
  assert.equal(maskPiiText("a@b.dk 12345678"), "[e-mail-fjernet] [telefon-fjernet]");
});
