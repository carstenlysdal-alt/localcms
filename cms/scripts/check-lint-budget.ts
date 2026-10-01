/**
 * ESLint-advarselsbudget (ratchet). Budgettet står i cms/.lint-budget (ét tal).
 *   npm run lint:budget            fejl (exit 1) hvis ESLint-FEJL eller flere advarsler end budgettet
 *   npm run lint:budget -- --update   skriv nyt (lavere) budget når antallet er faldet
 * Udskriver advarsler pr. regel og de 10 værste filer. Se docs/ops/LINT-BACKLOG.md.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const budgetFile = resolve(root, ".lint-budget");
const budget = existsSync(budgetFile) ? Number(readFileSync(budgetFile, "utf8").trim()) : Number(process.env.LINT_WARNING_BUDGET ?? NaN);
if (!Number.isFinite(budget)) {
  console.error("Intet budget: opret cms/.lint-budget eller sæt LINT_WARNING_BUDGET.");
  process.exit(2);
}

const r = spawnSync("npx", ["eslint", "-f", "json", "."], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
let report: { filePath: string; messages: { severity: number; ruleId: string | null }[] }[];
try {
  report = JSON.parse(r.stdout);
} catch {
  console.error("ESLint gav ikke gyldig JSON:\n" + (r.stderr || r.stdout).slice(0, 800));
  process.exit(2);
}
let warnings = 0;
let errors = 0;
const byRule: Record<string, number> = {};
const byFile: Record<string, number> = {};
for (const f of report) {
  for (const m of f.messages) {
    if (m.severity === 2) errors++;
    else warnings++;
    const rule = m.ruleId ?? "(parse)";
    byRule[rule] = (byRule[rule] ?? 0) + 1;
    const rel = f.filePath.slice(root.length + 1);
    byFile[rel] = (byFile[rel] ?? 0) + 1;
  }
}
console.log(`ESLint: ${errors} fejl, ${warnings} advarsler (budget ${budget})`);
for (const [rule, n] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${rule}`);
console.log("Værste filer:");
for (const [file, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${String(n).padStart(4)}  ${file}`);

if (errors > 0) process.exit(1);
if (warnings > budget) {
  console.error(`\nFor mange advarsler: ${warnings} > budget ${budget}. Ret dem (eller forklar hvorfor budgettet skal op).`);
  process.exit(1);
}
if (warnings < budget) {
  if (process.argv.includes("--update")) {
    writeFileSync(budgetFile, `${warnings}\n`);
    console.log(`\nBudget sænket ${budget} -> ${warnings}.`);
  } else {
    console.log(`\nAdvarsler er under budgettet (${warnings} < ${budget}): kør 'npm run lint:budget -- --update' og commit .lint-budget.`);
  }
}
