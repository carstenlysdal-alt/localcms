/**
 * `npm test` — kører node:test mod throwaway SQLite-databaser.
 *
 *  1. Bygger (én gang, cachet pr. schema/seed-hash) en skabelon-database med
 *     `prisma db push` + `prisma/seed.ts` i os.tmpdir().
 *  2. Starter `node --test` med tests/helpers/isolated-db.mjs som preload, så
 *     hver testfil får sin egen kopi (test-<pid>.db) og DATABASE_URL peger dér.
 *  3. Sletter kørslens mappe bagefter (også ved fejl/afbrydelse).
 *
 * prisma/dev.db røres aldrig. Brug `npm run test:dev-db` for den gamle adfærd.
 *
 * Brug:  npm test                      (alle tests/*.test.ts)
 *        npm test -- tests/site.test.ts (udvalgte filer)
 * Env:   CMS_TEST_TMPDIR  flyt tmp-mappen (default os.tmpdir())
 *        CMS_TEST_REBUILD=1  tving ny skabelon
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..");
const tmpBase = join(process.env.CMS_TEST_TMPDIR || tmpdir(), "cms-tests");
mkdirSync(tmpBase, { recursive: true });

const HASH_INPUTS = [
  "prisma/schema.prisma",
  "prisma/seed.ts",
  "prisma/network-seed-data.ts",
  "lib/slug.ts",
  "lib/default-roles.ts",
  "lib/permissions.ts",
];

function templateHash(): string {
  const h = createHash("sha256");
  for (const f of HASH_INPUTS) {
    const p = join(root, f);
    h.update(f).update(existsSync(p) ? readFileSync(p) : "missing");
  }
  return h.digest("hex").slice(0, 16);
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv, label: string) {
  const r = spawnSync(cmd, args, { cwd: root, env, encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`\n[test-runner] ${label} fejlede (exit ${r.status})\n${r.stdout}\n${r.stderr}`);
    process.exit(r.status ?? 1);
  }
}

function ensureTemplate(): string {
  const template = join(tmpBase, `template-${templateHash()}.db`);
  if (existsSync(template) && !process.env.CMS_TEST_REBUILD) return template;

  const started = Date.now();
  // Bygges i privat fil og flyttes atomisk på plads, så samtidige kørsler aldrig
  // ser en halv skabelon (de bygger i værste fald hver sin og den sidste vinder).
  const building = join(tmpBase, `building-${process.pid}.db`);
  rmSync(building, { force: true });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: `file:${building}`,
    SEED_DEMO_PASSWORD: randomBytes(18).toString("base64url"),
    NODE_ENV: "development",
  };
  console.log("[test-runner] bygger skabelon-database (kun ved ændret schema/seed)...");
  const prismaBin = require.resolve("prisma/build/index.js");
  run(process.execPath, [prismaBin, "db", "push", "--skip-generate", "--accept-data-loss"], env, "prisma db push");
  run(process.execPath, ["--import", "tsx", "prisma/seed.ts"], env, "prisma/seed.ts");
  renameSync(building, template);
  for (const s of ["-journal", "-wal", "-shm"]) rmSync(building + s, { force: true });
  console.log(`[test-runner] skabelon klar: ${template} (${((Date.now() - started) / 1000).toFixed(1)} s)`);

  // Ryd forældede skabeloner (>7 dage) og forladte kørsler (>1 døgn).
  const now = Date.now();
  for (const name of readdirSync(tmpBase)) {
    const p = join(tmpBase, name);
    try {
      const age = now - statSync(p).mtimeMs;
      if (name.startsWith("template-") && p !== template && age > 7 * 86_400_000) rmSync(p, { force: true });
      if (name.startsWith("run-") && age > 86_400_000) rmSync(p, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  return template;
}

function testFiles(args: string[]): string[] {
  if (args.length) return args;
  return readdirSync(join(root, "tests"))
    .filter((f) => f.endsWith(".test.ts"))
    .sort()
    .map((f) => `tests/${f}`);
}

const template = ensureTemplate();
const runDir = join(tmpBase, `run-${process.pid}-${Date.now().toString(36)}`);
mkdirSync(runDir, { recursive: true });

let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  rmSync(runDir, { recursive: true, force: true });
}

const child = spawn(
  process.execPath,
  ["--import", "tsx", "--import", join(root, "tests/helpers/isolated-db.mjs"), "--experimental-test-module-mocks", "--test", ...testFiles(process.argv.slice(2))],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, CMS_TEST_TEMPLATE: template, CMS_TEST_RUN_DIR: runDir },
  },
);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    child.kill(sig);
  });
}
child.on("exit", (code, signal) => {
  cleanup();
  process.exit(code ?? (signal ? 1 : 0));
});
