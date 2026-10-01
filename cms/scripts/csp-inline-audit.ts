/**
 * Lister ALLE <script>-tags i det renderede HTML af ~10 sider og tjekker at hver inline-script har samme nonce som
 * CSP-headeren (forudsætning for at skifte fra Report-Only til håndhævet CSP).
 *
 *   npx tsx scripts/csp-inline-audit.ts [--base http://127.0.0.1:3000] [--host naestvedlokalt.localhost:3000]
 *                                       [--paths /,/nyheder,...] [--origin-secret x] [--verbose]
 *
 * Standard-stier hentes fra sitet selv (forside + sektioner + en artikel + emne/område/forfatter hvis de findes) og
 * suppleres med faste sider (/soeg, /nyhedsbrev, /indsend, /om-mediet, /priser, /kalender). Afslutter med 1 ved fund
 * af script uden nonce (undtagen type=application/ld+json, som er data og ikke udføres).
 * Kør desuden med CSP_REPORT_ONLY=1 og se /api/csp-report-logs for overtrædelser i et rigtigt flow.
 */
import { request } from "./check-headers-lib";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

type ScriptTag = { attrs: string; inline: boolean; nonce: string | null; type: string | null; src: string | null; size: number };

export function extractScripts(html: string): ScriptTag[] {
  const out: ScriptTag[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const get = (n: string) => new RegExp(`\\b${n}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attrs);
    const pick = (r: RegExpExecArray | null) => (r ? (r[1] ?? r[2] ?? r[3] ?? "") : null);
    const src = pick(get("src"));
    out.push({ attrs: attrs.trim(), inline: !src, nonce: pick(get("nonce")), type: pick(get("type")), src, size: m[2].length });
  }
  return out;
}

async function main() {
  const base = arg("base", "http://127.0.0.1:3000")!;
  const port = new URL(base).port || "3000";
  const host = arg("host", `naestvedlokalt.localhost:${port}`)!;
  const secret = arg("origin-secret");
  const verbose = process.argv.includes("--verbose");
  const extra: Record<string, string> = secret ? { "x-origin-secret": secret } : {};

  let paths = arg("paths")?.split(",").filter(Boolean);
  if (!paths) {
    const home = await request(base, "/", host, extra);
    const links = [...home.body.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]);
    const uniq = [...new Set(links)].filter((l) => !/\.(css|js|ico|png|jpg|webp|svg|xml|txt|webmanifest)$/.test(l) && !l.startsWith("/_next") && !l.startsWith("/api") && !l.startsWith("/redaktion"));
    const article = uniq.find((l) => l.split("/").length === 3 && !/^\/(emne|omraade|forfatter)\//.test(l));
    const pick = (prefix: string) => uniq.find((l) => l.startsWith(prefix));
    paths = ["/", ...uniq.filter((l) => l.split("/").length === 2).slice(0, 3), ...(article ? [article] : []), pick("/emne/"), pick("/omraade/"), pick("/forfatter/"), "/soeg?q=test", "/nyhedsbrev", "/indsend", "/om-mediet", "/priser", "/kalender"].filter((p): p is string => Boolean(p));
    paths = [...new Set(paths)].slice(0, 14);
  }

  let bad = 0;
  let total = 0;
  console.log(`CSP inline-script-audit — Host: ${host}\n`);
  for (const path of paths) {
    const res = await request(base, path, host, extra);
    const csp = String(res.headers["content-security-policy"] ?? res.headers["content-security-policy-report-only"] ?? "");
    const headerNonce = /'nonce-([^']+)'/.exec(csp)?.[1] ?? null;
    const scripts = extractScripts(res.body);
    const inline = scripts.filter((s) => s.inline);
    const executableInline = inline.filter((s) => !s.type || /javascript|module/i.test(s.type));
    const jsonLd = inline.filter((s) => s.type && /ld\+json|json/i.test(s.type));
    const missing = executableInline.filter((s) => s.nonce !== headerNonce || !s.nonce);
    const externalMissing = scripts.filter((s) => !s.inline && s.nonce !== headerNonce);
    total += scripts.length;
    console.log(`${path}  [${res.status}]  scripts=${scripts.length} (inline kørbare=${executableInline.length}, JSON-LD=${jsonLd.length}, eksterne=${scripts.length - inline.length})  header-nonce=${headerNonce ? "ja" : "NEJ"}`);
    if (res.status !== 200) continue;
    if (!headerNonce) {
      bad++;
      console.log("   FEJL: ingen nonce i CSP-headeren");
    }
    for (const s of missing) {
      bad++;
      console.log(`   FEJL: inline <script> uden/forkert nonce (${s.size} B): <script ${s.attrs.slice(0, 120)}>`);
    }
    for (const s of externalMissing) {
      // Eksterne scripts uden nonce er OK med 'strict-dynamic' kun hvis de er indsat af et nonce'et script; statiske tags skal have nonce.
      bad++;
      console.log(`   FEJL: eksternt <script src> uden nonce: ${s.src}`);
    }
    if (verbose) for (const s of scripts) console.log(`     - ${s.inline ? "inline" : "src=" + s.src} type=${s.type ?? "-"} nonce=${s.nonce ? "ja" : "nej"} ${s.size}B`);
  }
  console.log(`\n${paths.length} sider, ${total} script-tags, ${bad} fund`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error("csp-inline-audit fejlede:", e instanceof Error ? e.message : e);
  process.exit(2);
});
