/**
 * `npm run audit:prod` — npm audit (kun produktionsafhængigheder) med allowlist for kendte fund.
 *
 * Allowlist = pakker hvis fund er dokumenteret som kendt i cms/HANDOFF.md ("Next 16.2.12's egne indlejrede PostCSS/Sharp").
 * Allowlistede fund tæller IKKE som fejl, men udskrives altid — og hvis npm ved, at en ikke-major rettelse findes,
 * står der "RETTELSE FINDES", så en allowlist aldrig skjuler en tilgængelig opgradering.
 * Exit 1 ved høj/kritisk i ikke-allowlistede pakker. CI kører den først non-blocking (continue-on-error).
 * Aldrig `npm audit fix --force` (foreslår nedgradering til Next 9).
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ALLOWLIST: Record<string, string> = {
  next: "kendt, jf. HANDOFF.md (indlejret PostCSS/Sharp) — opgradér Next når rettet version er stabil",
  postcss: "indlejret i Next, jf. HANDOFF.md",
  sharp: "libvips-fund; direkte afhængighed er 0.35.3, resten ligger i Next, jf. HANDOFF.md",
};

type Via = string | { title?: string; url?: string; severity?: string };
type Vuln = { name: string; severity: string; isDirect: boolean; via: Via[]; fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean } };

const root = resolve(__dirname, "..");
const r = spawnSync("npm", ["audit", "--omit=dev", "--json"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
let report: { vulnerabilities?: Record<string, Vuln>; metadata?: { vulnerabilities: Record<string, number> } };
try {
  report = JSON.parse(r.stdout);
} catch {
  console.error("npm audit gav ikke gyldig JSON (netværk?):\n" + (r.stderr || r.stdout).slice(0, 500));
  process.exit(2);
}
const vulns = Object.values(report.vulnerabilities ?? {}).filter((v) => v.severity === "high" || v.severity === "critical");
console.log(`npm audit (prod): ${JSON.stringify(report.metadata?.vulnerabilities)}`);

let blocking = 0;
for (const v of vulns.sort((a, b) => a.name.localeCompare(b.name))) {
  const allowed = ALLOWLIST[v.name];
  const titles = v.via.map((x) => (typeof x === "string" ? x : x.title)).filter(Boolean).slice(0, 2).join(" | ");
  const fix = v.fixAvailable && typeof v.fixAvailable === "object" ? `${v.fixAvailable.name}@${v.fixAvailable.version}${v.fixAvailable.isSemVerMajor ? " (MAJOR)" : ""}` : v.fixAvailable ? "ja" : "nej";
  const upgradeHint = v.fixAvailable && typeof v.fixAvailable === "object" && !v.fixAvailable.isSemVerMajor ? "  <-- RETTELSE FINDES (ikke-major)" : "";
  console.log(`${allowed ? "ALLOW" : "FEJL "} ${v.severity.padEnd(8)} ${v.name}  fix: ${fix}${upgradeHint}\n        ${titles.slice(0, 160)}${allowed ? `\n        allowlist: ${allowed}` : ""}`);
  if (!allowed) blocking++;
}
if (blocking) {
  console.error(`\n${blocking} høj/kritisk(e) fund uden for allowlisten.`);
  process.exit(1);
}
console.log("\nIngen blokerende fund uden for allowlisten.");
