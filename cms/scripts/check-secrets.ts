/**
 * Hemmelighedsscan (regex) over filer i git: sporede + usporede, ikke-ignorerede.
 * Ingen netværk, ingen afhængigheder. Udskriver aldrig selve værdien (kun fil:linje + regelnavn).
 *
 *   npm run secrets                      # hele repoet (cached + others, respekterer .gitignore)
 *   tsx scripts/check-secrets.ts a b c   # kun de angivne filer (bruges af lint-staged)
 *
 * Undtagelser: sæt `secret-scan:ignore` på linjen (fx i dokumentation med et bevidst eksempel).
 * Exit 1 ved fund. CI kører desuden gitleaks over historikken (se docs/ops/CI.md).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export interface SecretRule {
  id: string;
  description: string;
  re: RegExp;
  /** Returnerer true hvis fundet er en pladsholder/eksempel og skal ignoreres. */
  allow?: (match: RegExpExecArray) => boolean;
  /** Svage heuristikker (bogstavelig værdi ved et navn) springes over i tests/, hvor opdigtede fixtures er normale. */
  skipInTests?: boolean;
}

const PLACEHOLDER = /^(?:password|passwd|\*+|x+|<.*>|\$.*|\{.*|your.*|change.?me.*|example.*|secret|placeholder.*|dummy.*|test.*|\.\.\.+|…)$/i;

const SECRET_NAMES = "(?:AUTH_SECRET|NEXTAUTH_SECRET|CRON_SECRET|ANTHROPIC_API_KEY|DEEPSEEK_API_KEY|SEED_DEMO_PASSWORD|REDIS_PASSWORD|S3_SECRET_ACCESS_KEY|TURNSTILE_SECRET_KEY)";

export const RULES: SecretRule[] = [
  { id: "aws-access-key", description: "AWS access key id", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: "anthropic-key", description: "Anthropic API-nøgle (sk-ant-…)", re: /\bsk-ant-[A-Za-z0-9_-]{16,}/ },
  { id: "github-token", description: "GitHub token (ghp_/gho_/ghs_/ghu_/ghr_/github_pat_)", re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/ },
  { id: "slack-token", description: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { id: "ingest-key", description: "Agent-indtagsnøgle (lk_…) i klartekst", re: /\blk_[A-Za-z0-9_-]{24,}\b/ },
  { id: "private-key", description: "Privat nøgleblok", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/ },
  {
    id: "db-url-password",
    skipInTests: true,
    description: "Database-/cache-URL med brugernavn:adgangskode@",
    re: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|amqps?):\/\/([^\s:@/'"`<>$]+):([^\s@/'"`]+)@/i,
    allow: (m) => PLACEHOLDER.test(m[2]) || m[2] === m[1],
  },
  {
    id: "env-secret-assignment",
    skipInTests: true,
    description: "AUTH_SECRET/CRON_SECRET/ANTHROPIC_API_KEY/… sat til en bogstavelig værdi",
    // 1) env-fil-stil:  [export ]NAVN=værdi  (hele linjen)  2) kode/yaml/json:  NAVN = "bogstavelig" eller NAVN: "bogstavelig"
    re: new RegExp(
      "(?:^\\s*(?:export\\s+)?" + SECRET_NAMES + "=[\"']?([^\\s\"'#`]{8,})[\"']?\\s*(?:#.*)?$)|(?:\\b" + SECRET_NAMES + "\\s*[=:]\\s*[\"']([^\"'`\\s]{8,})[\"'])",
    ),
    allow: (m) => {
      const v = m[1] ?? m[2] ?? "";
      return PLACEHOLDER.test(v) || /^(?:process\.env|env\.|\$|<|\[|\(|openssl)/.test(v);
    },
  },
];

export interface Finding {
  file: string;
  line: number;
  rule: string;
  description: string;
}

export function scanText(file: string, text: string): Finding[] {
  const out: Finding[] = [];
  const lines = text.split(/\r?\n/);
  const inTests = /(^|\/)(tests?|e2e|__tests__)\//.test(file);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 20_000 || line.includes("secret-scan:ignore")) continue;
    for (const rule of RULES) {
      if (inTests && rule.skipInTests) continue;
      const m = rule.re.exec(line);
      if (!m) continue;
      if (rule.allow?.(m)) continue;
      out.push({ file, line: i + 1, rule: rule.id, description: rule.description });
    }
  }
  return out;
}

const SKIP_NAMES = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig\.tsbuildinfo)$/;
const SKIP_EXT = /\.(png|jpe?g|gif|webp|avif|ico|pdf|zip|gz|woff2?|ttf|otf|mp[34]|webm|ogg|wav|db|sqlite|node)$/i;

export function scanFiles(root: string, files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const rel of files) {
    if (SKIP_NAMES.test(rel) || SKIP_EXT.test(rel)) continue;
    const abs = join(root, rel);
    let size: number;
    try {
      const st = statSync(abs);
      if (!st.isFile()) continue;
      size = st.size;
    } catch {
      continue; // slettet i working tree
    }
    if (size > 8_000_000) continue;
    const buf = readFileSync(abs);
    if (buf.subarray(0, 8000).includes(0)) continue; // binær
    findings.push(...scanText(rel, buf.toString("utf8")));
  }
  return findings;
}

export function gitRoot(cwd = process.cwd()): string {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
}

export function listCandidateFiles(root: string): string[] {
  const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return [...new Set(out.split("\0").filter(Boolean))];
}

function main() {
  const root = gitRoot();
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  // Argumenter (fra lint-staged) er absolutte eller relative til cwd -> normalisér til repo-relative.
  const files = args.length
    ? args.map((a) => resolve(a).slice(root.length + 1))
    : listCandidateFiles(root);
  const findings = scanFiles(root, files);
  if (findings.length) {
    console.error(`\nHemmelighedsscan: ${findings.length} mistænkelige fund (værdier vises ikke):`);
    for (const f of findings) console.error(`  ${f.file}:${f.line}  [${f.rule}] ${f.description}`);
    console.error("\nFjern hemmeligheden (og roter den hvis den har været committet). Bevidst eksempel: tilføj 'secret-scan:ignore' på linjen.");
    process.exit(1);
  }
  console.log(`Hemmelighedsscan: ${files.length} filer, ingen fund.`);
}

if (require.main === module) main();
