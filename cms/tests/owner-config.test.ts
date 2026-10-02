import assert from "node:assert/strict";
import test from "node:test";
import { resolveOwnerConfig } from "../lib/owner-config";

const site = (sideTekster?: unknown) => ({ domaene: "naestvedlokalt.dk", sideTekster });
const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

test("T6 nr. 30-31: uden konfiguration er alle ejer-afhængige udsagn tomme/neutrale (ingen gætterier)", () => {
  const c = resolveOwnerConfig(site(), env({}));
  assert.equal(c.ansvarshavendeRedaktoer, undefined);
  assert.equal(c.pressenaevnetTilmeldt, false);
  assert.equal(c.privatliv.godkendt, false);
  for (const v of Object.values({ ...c.privatliv, godkendt: undefined })) assert.equal(v, undefined);
});

test("OWNER_CONFIG (env) og Instance.sideTekster.ejer kan udfylde felterne; env vinder; kun domænets og '*'", () => {
  const e = env({
    OWNER_CONFIG: JSON.stringify({
      "*": { pressenaevnetTilmeldt: true },
      "naestvedlokalt.dk": { ansvarshavendeRedaktoer: "Eksempel Redaktør", privatliv: { dataansvarlig: "CVR 00000000", godkendt: true } },
      "holbaeklokalt.dk": { ansvarshavendeRedaktoer: "Anden Redaktør" },
    }),
  });
  const c = resolveOwnerConfig(site(), e);
  assert.equal(c.ansvarshavendeRedaktoer, "Eksempel Redaktør");
  assert.equal(c.pressenaevnetTilmeldt, true);
  assert.equal(c.privatliv.dataansvarlig, "CVR 00000000");
  assert.equal(c.privatliv.godkendt, true);

  const db = resolveOwnerConfig(site({ ejer: { ansvarshavendeRedaktoer: "Fra Databasen", privatliv: { leverandoerer: "Eksempel Hosting" } } }), env({}));
  assert.equal(db.ansvarshavendeRedaktoer, "Fra Databasen");
  assert.equal(db.privatliv.leverandoerer, "Eksempel Hosting");
  const merged = resolveOwnerConfig(site({ ejer: { ansvarshavendeRedaktoer: "Fra Databasen" } }), e);
  assert.equal(merged.ansvarshavendeRedaktoer, "Eksempel Redaktør", "env har højeste prioritet");
});

test("kun et udtrykkeligt true tæller som tilmeldt/godkendt; ugyldig JSON og forkerte typer ignoreres", () => {
  assert.equal(resolveOwnerConfig(site({ ejer: { pressenaevnetTilmeldt: "true", privatliv: { godkendt: "ja" } } }), env({})).pressenaevnetTilmeldt, false);
  assert.equal(resolveOwnerConfig(site({ ejer: { privatliv: { godkendt: "ja" } } }), env({})).privatliv.godkendt, false);
  assert.equal(resolveOwnerConfig(site(), env({ OWNER_CONFIG: "{ikke json" })).pressenaevnetTilmeldt, false);
  assert.equal(resolveOwnerConfig(site({ ejer: { ansvarshavendeRedaktoer: 42 } }), env({})).ansvarshavendeRedaktoer, undefined);
  assert.equal(resolveOwnerConfig({ domaene: "www.naestvedlokalt.dk" }, env({ OWNER_CONFIG: JSON.stringify({ "naestvedlokalt.dk": { ansvarshavendeRedaktoer: "X Y" } }) })).ansvarshavendeRedaktoer, "X Y", "www normaliseres");
});
