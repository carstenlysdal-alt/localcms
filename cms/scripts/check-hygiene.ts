/**
 * `npm run hygiene` — rapport (exit 0) over kodehygiejne. Ændrer ingenting.
 *   1) knip: ubrugte filer, afhængigheder og eksports (konfiguration: knip.json)
 *   2) dublerede slugify-implementationer (alt skal bruge lib/slug.ts)
 *   3) kendt kandidat: components/site/WeekendCalendar.tsx
 * `--strict` giver exit 1 hvis der er dublerede slugify-implementationer eller ubrugte filer (til evt. CI-ratchet).
 * `--json` udskriver kun tællinger.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(__dirname, "..");
const strict = process.argv.includes("--strict");
const asJson = process.argv.includes("--json");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".next") || name === "public") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

// --- 2) dublerede slugify-implementationer ---------------------------------------------------------------
// Signatur: en lokal funktion der både laver .toLowerCase() og erstatter /[^a-z0-9]+/ med "-".
const SLUG_FILE = "lib/slug.ts";
const duplicates: string[] = [];
for (const file of walk(root)) {
  const rel = relative(root, file);
  if (rel === SLUG_FILE || rel.startsWith("tests/") || rel.startsWith("scripts/check-")) continue;
  const text = readFileSync(file, "utf8");
  const re = /(?:function\s+(\w*[sS]lug\w*)\s*\(|const\s+(\w*[sS]lug\w*)\s*=\s*(?:\(|async))/g;
  for (const m of text.matchAll(re)) {
    const body = text.slice(m.index!, m.index! + 600);
    if (/\[\^a-z0-9\]\+/.test(body) && /toLowerCase\(\)/.test(body)) {
      const line = text.slice(0, m.index).split("\n").length;
      duplicates.push(`${rel}:${line}  ${m[1] ?? m[2]}`);
    }
  }
  // Inline-varianter uden egen funktion (kun hvis filen ikke importerer lib/slug)
  if (/\.replace\(\/\[\^a-z0-9\]\+\/g,\s*"-"\)/.test(text) && !/lib\/slug|\.\/slug|\.\.\/slug/.test(text) && !duplicates.some((d) => d.startsWith(rel + ":"))) {
    duplicates.push(`${rel}  (inline slug-regex uden import fra lib/slug)`);
  }
}

// --- 1) knip ----------------------------------------------------------------------------------------------
const knip = spawnSync("npx", ["knip", "--no-progress", "--no-exit-code", "--reporter", "json"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
type KnipIssue = { file: string; files?: unknown[]; dependencies?: { name: string }[]; devDependencies?: { name: string }[]; exports?: { name: string; line?: number }[]; types?: { name: string }[]; unlisted?: { name: string }[] };
let issues: KnipIssue[] = [];
try {
  const parsed = JSON.parse(knip.stdout) as { issues?: KnipIssue[] };
  issues = parsed.issues ?? [];
} catch {
  console.error("knip leverede ikke gyldig JSON:\n" + (knip.stderr || knip.stdout).slice(0, 500));
}
const unusedFiles = issues.filter((i) => (i.files?.length ?? 0) > 0).map((i) => i.file);
const unusedDeps = [...new Set(issues.flatMap((i) => [...(i.dependencies ?? []), ...(i.devDependencies ?? [])].map((d) => d.name)))];
const unlisted = [...new Set(issues.flatMap((i) => (i.unlisted ?? []).map((d) => `${d.name} (${i.file})`)))];
const unusedExports = issues.flatMap((i) => (i.exports ?? []).map((e) => `${i.file}:${e.line ?? "?"}  ${e.name}`));

const summary = { unusedFiles: unusedFiles.length, unusedDependencies: unusedDeps.length, unlistedDependencies: unlisted.length, unusedExports: unusedExports.length, duplicateSlugify: duplicates.length };
if (asJson) {
  console.log(JSON.stringify(summary));
} else {
  const section = (title: string, items: string[]) => {
    console.log(`\n== ${title} (${items.length}) ==`);
    for (const i of items.slice(0, 200)) console.log("  " + i);
  };
  section("Dublerede slugify-implementationer (brug lib/slug.ts)", duplicates);
  section("Ubrugte filer", unusedFiles);
  section("Ubrugte afhængigheder", unusedDeps);
  section("Ulistede afhængigheder", unlisted);
  section("Ubrugte eksports", unusedExports);
  console.log(`\nHygiejne: ${JSON.stringify(summary)}`);
  console.log("Rapport only (exit 0). Se docs/ops/LINT-BACKLOG.md for håndtering.");
}
if (strict && (duplicates.length || unusedFiles.length)) process.exit(1);
