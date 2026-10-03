import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Grep-vagt for netværksadgang (ét login, flere byer). Den aktive by er TENANTEN overalt: alt server-kode skal læse
 * `user.instansId` fra de DB-friske hjælpere (getAuthorizedUser/getFreshSession/getSessionState), som returnerer den aktive
 * by. Hjemmeinstansen (`homeInstansId`), den rå JWT og adgangstabellen må kun røres de få steder, der er listet her.
 * Nyt sted der har brug for det: tilføj filen bevidst herunder (og forklar hvorfor i PR'en).
 */
const ROOT = path.resolve(__dirname, "..");
const DIRS = ["app", "lib", "components", "scripts"];
const EXT = /\.(ts|tsx|mjs)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(full);
  }
  return out;
}
const files = [...DIRS.flatMap((d) => walk(path.join(ROOT, d))), path.join(ROOT, "proxy.ts"), path.join(ROOT, "types/next-auth.d.ts")];
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join("/");
const src = new Map(files.map((f) => [rel(f), readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")]));
const filesMatching = (re: RegExp) => [...src].filter(([, text]) => re.test(text)).map(([f]) => f).sort();

test("hjemmeinstansen (homeInstansId) læses kun hvor det er bevidst tilladt", () => {
  const allowed = [
    "app/redaktion/artikler/alle-byer/page.tsx", // "Alle byer": brugerens byer (server-side)
    "app/redaktion/metrikker/alle-byer/page.tsx", // "Alle byer": brugerens byer (server-side)
    "app/redaktion/brugere/network-actions.ts", // udførerens egne byer (rækkevidde)
    "app/redaktion/brugere/page.tsx", // udførerens byer til adgangsvalg
    "app/redaktion/instans-actions.ts", // switchInstance: hvilke byer må vælges
    "lib/auth.ts", // sætter feltet
    "lib/instance-access.ts", // resolveActiveInstance(homeInstansId)
    "lib/shell-cities.ts", // skifterens byliste
    "types/next-auth.d.ts",
  ];
  assert.deepEqual(filesMatching(/\bhomeInstansId\b/), allowed.sort());
});

test("rå auth()/JWT-claims bruges kun i lib/auth.ts og login-siden — al anden kode bruger de DB-friske hjælpere", () => {
  assert.deepEqual(filesMatching(/(?<![A-Za-z_.])auth\(\)/), ["app/login/page.tsx", "lib/auth.ts"]);
  assert.deepEqual(filesMatching(/\btoken\.(instansId|activeInstansId)\b/), ["lib/auth.ts"]);
  assert.deepEqual(filesMatching(/\bsession\.user\.(instansId|activeInstansId)\b/).filter((f) => f !== "lib/auth.ts" && !f.startsWith("app/redaktion/")), [], "kun getFreshSession-sessioner uden for lib/auth.ts");
  // Sider i app/redaktion bruger session.user.instansId fra getFreshSession — aldrig fra den rå auth().
  for (const [file, text] of src) {
    if (file.startsWith("app/redaktion/") && /session\.user\.instansId/.test(text)) assert.match(text, /getFreshSession\(\)/, `${file}: session.user.instansId skal komme fra getFreshSession`);
  }
});

test("den aktive by skiftes kun via updateSession i switchInstance (ingen anden skriver claimen)", () => {
  assert.deepEqual(filesMatching(/\bupdateSession\s*\(/), ["app/redaktion/instans-actions.ts"]);
  assert.deepEqual(filesMatching(/\bunstable_update\b/), ["lib/auth.ts"]);
  assert.deepEqual(filesMatching(/\bactiveInstansId\b/).filter((f) => !["lib/auth.ts", "types/next-auth.d.ts", "app/redaktion/instans-actions.ts", "components/admin/user-admin.tsx", "app/redaktion/brugere/page.tsx"].includes(f)), []);
});

test("adgangstabellen (UserInstanceAccess) røres kun af lib/instance-access, grant-access, brugeradministrationen og layoutet", () => {
  assert.deepEqual(filesMatching(/\buserInstanceAccess\b/), [
    "app/redaktion/brugere/network-actions.ts",
    "app/redaktion/brugere/page.tsx",
    "lib/instance-access.ts",
    "scripts/grant-access.ts",
  ]);
});

test("ingen opslag af en brugers instans direkte fra db.user (ville være hjemmet, ikke den aktive by) uden for lib/auth og brugeradministrationen", () => {
  // Driftsscripts (scripts/) arbejder på e-mail uden session og er undtaget.
  const server = (f: string) => !f.startsWith("scripts/") && f !== "lib/auth.ts";
  assert.deepEqual(filesMatching(/db\.user\.(findUnique|findFirst|findUniqueOrThrow)\b[^;]*\binstansId\s*:\s*true/).filter(server), []);
  assert.deepEqual(filesMatching(/user\.findUnique\([^;]*select:\s*\{[^}]*\binstansId\b/).filter((f) => !f.startsWith("scripts/")), ["lib/auth.ts"]);
});

test("netværksadgang er aldrig tilgængelig for AI-operatøren eller offentlige ruter", () => {
  for (const [file, text] of src) {
    if (file.startsWith("lib/operator/") || file.startsWith("components/operator/") || file.startsWith("app/api/")) {
      assert.doesNotMatch(text, /network-actions|instance-access|instans-actions|setUserInstanceAccessAction|applyAccessChange|switchInstance/, `${file} må ikke røre netværksadgang`);
    }
  }
});

test("alle tre DB-friske hjælpere returnerer den aktive by (de eneste der konstruerer AuthorizedUser)", () => {
  const auth = src.get("lib/auth.ts")!;
  assert.match(auth, /instansId:\s*resolved\.instansId/);
  assert.equal((auth.match(/const authorized: AuthorizedUser/g) ?? []).length, 1, "ét sted bygger brugeren; getAuthorizedUser/getFreshSession går gennem getSessionState");
  assert.match(auth, /const state = await getSessionState\(\)/);
});
