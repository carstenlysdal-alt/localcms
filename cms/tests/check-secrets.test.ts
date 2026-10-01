import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { scanFiles, scanText } from "../scripts/check-secrets";

// Fixtures bygges af stumper, så testfilen selv ikke ligner en hemmelighed for scanneren/gitleaks.
const rules = (text: string) => scanText("x.txt", text).map((f) => f.rule);
const aws = "AK" + "IA" + "ABCDEFGHIJKLMNOP";
const anthropic = "sk-" + "ant-" + "api03-abcdefghijklmnopqrstuvwx";
const ghp = "gh" + "p_" + "a".repeat(36);
const pem = "-----BEGIN " + "RSA PRIVATE KEY-----";

test("secrets: AWS-, Anthropic-, GitHub-nøgler og private nøgleblokke findes", () => {
  assert.deepEqual(rules(`key = ${aws}`), ["aws-access-key"]);
  assert.deepEqual(rules(`ANTHROPIC=${anthropic}`), ["anthropic-key"]);
  assert.deepEqual(rules(`token: ${ghp}`), ["github-token"]);
  assert.deepEqual(rules(pem), ["private-key"]);
  assert.deepEqual(rules("lk_" + "A".repeat(30)), ["ingest-key"]);
});

test("secrets: database-URL med adgangskode findes, pladsholdere og tomme ignoreres", () => {
  assert.deepEqual(rules("DATABASE_URL=" + "postgres://" + "admin:" + "hunter2hunter2" + "@db.example.com/x"), ["db-url-password"]);
  assert.deepEqual(rules("postgres://" + "user:pass" + "@host/db"), ["db-url-password"]);
  assert.deepEqual(rules("postgresql://user:password@localhost:5432/lysdals_cms"), [], "dokumenteret pladsholder");
  assert.deepEqual(rules("postgresql://offline:offline@localhost:5432/offline"), [], "bruger = adgangskode (lokal dummy)");
  assert.deepEqual(rules("postgresql://localhost:5432/db"), []);
  assert.deepEqual(rules("redis://:<password>@host"), []);
});

test("secrets: AUTH_SECRET=<værdi> findes, men ikke tomme værdier, kode og placeholders", () => {
  assert.deepEqual(rules("AUTH_SECRET=" + "abcdEFGH1234abcdEFGH1234abcdEFGH"), ["env-secret-assignment"]);
  assert.deepEqual(rules('export CRON_SECRET="' + "abcdEFGH1234abcdEF" + '"'), ["env-secret-assignment"]);
  assert.deepEqual(rules('const x = { AUTH_SECRET: "' + "abcdEFGH1234abcdEFGH1234" + '" }'), ["env-secret-assignment"]);
  assert.deepEqual(rules('AUTH_SECRET=""'), []);
  assert.deepEqual(rules("AUTH_SECRET="), []);
  assert.deepEqual(rules("AUTH_SECRET=<generate-me>"), []);
  assert.deepEqual(rules('AUTH_SECRET="changeme-please"'), []);
  assert.deepEqual(rules("process.env.AUTH_SECRET = saved.secret;"), []);
  assert.deepEqual(rules("  AUTH_SECRET: requiredText(\"AUTH_SECRET\", 32),"), []);
  assert.deepEqual(rules("# AUTH_SECRET=$(openssl rand -base64 32)"), []);
});

test("secrets: svage regler (db-url/env-tildeling) springes over i tests/, stærke ikke", () => {
  const weak = "postgres://" + "admin:" + "hunter2hunter2" + "@db.example.com/x";
  assert.deepEqual(scanText("cms/tests/x.test.ts", weak), []);
  assert.deepEqual(scanText("cms/lib/x.ts", weak).map((f) => f.rule), ["db-url-password"]);
  assert.deepEqual(scanText("cms/tests/x.test.ts", aws).map((f) => f.rule), ["aws-access-key"]);
});

test("secrets: secret-scan:ignore på linjen undertrykker fund; fund angiver fil og linje men aldrig værdien", () => {
  assert.deepEqual(rules(`${aws} # secret-scan:ignore`), []);
  const f = scanText("a/b.ts", `ok\n${aws}\n`);
  assert.equal(f.length, 1);
  assert.equal(f[0].file, "a/b.ts");
  assert.equal(f[0].line, 2);
  assert.equal(JSON.stringify(f).includes(aws), false);
});

test("secrets: scanFiles springer binære og store filer samt lockfiles over", () => {
  const dir = mkdtempSync(join(tmpdir(), "secscan-"));
  try {
    writeFileSync(join(dir, "ok.txt"), "hej");
    writeFileSync(join(dir, "bad.env"), `X=${aws}\n`);
    writeFileSync(join(dir, "bin.dat"), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(aws)]));
    writeFileSync(join(dir, "package-lock.json"), aws);
    const res = scanFiles(dir, ["ok.txt", "bad.env", "bin.dat", "package-lock.json", "findes-ikke.txt"]);
    assert.deepEqual(res.map((r) => r.file), ["bad.env"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
