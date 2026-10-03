import { z } from "zod";
import { parsePreviewHosts } from "./preview";

/**
 * Miljøvalidering ved serverstart (kaldes fra instrumentation.ts -> register()).
 *
 * I produktion stopper manglende/ugyldige påkrævede variabler opstarten. Fejlbeskeder nævner KUN variabelnavne og
 * regler — aldrig værdier (hemmeligheder må ikke ende i logs). Uden for produktion (dev/test) kaster vi aldrig.
 *
 * Påkrævet i produktion: DATABASE_URL, AUTH_SECRET (>= 32 tegn), NEXT_PUBLIC_APP_URL (http/https-URL), CRON_SECRET (>= 16).
 * FEJL i produktion (T5 P2-2): TRUST_CLOUDFLARE=1 uden ORIGIN_SECRET (så kan enhver, der rammer Railway-origin direkte,
 * forfalske CF-Connecting-IP og omgå rate limit/lockout/bans), og ORIGIN_SECRET kortere end 24 tegn.
 * Kun advarsel: REDIS_URL, AUTH_TRUST_HOST/AUTH_URL, DATABASE_URL ikke postgres, uploads på flygtigt filsystem,
 * ORIGIN_SECRET mangler, TURNSTILE_SECRET_KEY mangler, TRUST_FORWARDED_HOST slået til, delt IP-bucket bag Cloudflare.
 * PREVIEW_HOSTS (valgfri): kommaseparerede hostnavne, hvor byen vælges med ?by=<by> (kun mens ejeren ikke har egne domæner, fx Railway-adressen;
 * fjernes når domænerne er koblet på). Advarsel hvis en post er et rigtigt by-domæne (den ignoreres) eller ikke et gyldigt hostnavn.
 * Valgfri: ANTHROPIC_API_KEY, DEEPSEEK_API_KEY (+ DEEPSEEK_MODEL, DEEPSEEK_BASE_URL, OPERATOR_PROVIDER) m.fl.
 * AI-operatøren bruger DeepSeek hvis DEEPSEEK_API_KEY er sat, ellers Anthropic (se lib/operator/llm/select.ts).
 * Editor-AI, chat og forside-AI vælger udbyder via AI_PROVIDER / EDITOR_AI_PROVIDER / CHAT_AI_PROVIDER / FRONTPAGE_AI_PROVIDER
 * (samme regel; se lib/ai/provider/select.ts).
 */

/** Tom streng og kun-mellemrum behandles som "ikke sat" (.env.example har tomme pladsholdere). */
const optionalText = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional());
const httpUrl = (name: string) =>
  z.string({ error: `${name} mangler` }).refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, `${name} skal være en http(s)-URL`);

const requiredText = (name: string, min = 1) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string({ error: `${name} mangler` }).min(min, `${name} skal være mindst ${min} tegn`),
  );

const productionSchema = z.object({
  DATABASE_URL: requiredText("DATABASE_URL"),
  AUTH_SECRET: requiredText("AUTH_SECRET", 32),
  NEXT_PUBLIC_APP_URL: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), httpUrl("NEXT_PUBLIC_APP_URL")),
  CRON_SECRET: requiredText("CRON_SECRET", 16),
});

const optionalSchema = z.object({
  REDIS_URL: optionalText,
  ANTHROPIC_API_KEY: optionalText,
  DEEPSEEK_API_KEY: optionalText,
  DEEPSEEK_MODEL: optionalText,
  DEEPSEEK_BASE_URL: optionalText,
  OPERATOR_PROVIDER: optionalText,
  AI_PROVIDER: optionalText,
  EDITOR_AI_PROVIDER: optionalText,
  CHAT_AI_PROVIDER: optionalText,
  FRONTPAGE_AI_PROVIDER: optionalText,
  AUTH_TRUST_HOST: optionalText,
  AUTH_URL: optionalText,
  UPLOAD_DIR: optionalText,
  UPLOAD_STORAGE: optionalText,
  RAILWAY_VOLUME_MOUNT_PATH: optionalText,
  ORIGIN_SECRET: optionalText,
  TRUST_CLOUDFLARE: optionalText,
  TRUST_FORWARDED_HOST: optionalText,
  TRUSTED_PROXY_HOPS: optionalText,
  TURNSTILE_SECRET_KEY: optionalText,
  PREVIEW_HOSTS: optionalText,
  FALLBACK_SITE_DOMAIN: optionalText,
});

const isOn = (v: string | undefined) => v === "1" || v?.toLowerCase() === "true";

export type EnvReport = {
  ok: boolean;
  production: boolean;
  /** Variabler der mangler helt (kun navne). */
  missing: string[];
  /** Variabler der er sat, men ugyldige (navn + regel, aldrig værdi). */
  invalid: string[];
  warnings: string[];
};

export function checkEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const production = env.NODE_ENV === "production";
  const missing: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];

  const parsed = productionSchema.safeParse(env);
  const opt = optionalSchema.parse(env);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = String(issue.path[0]);
      const rawValue = env[name];
      const isMissing = rawValue === undefined || rawValue.trim() === "";
      (isMissing ? missing : invalid).push(isMissing ? name : issue.message);
    }
  }

  // Uden for produktion (dev/test) kaster vi aldrig og holder støjen nede: kun manglende AUTH_SECRET nævnes.
  if (!production) {
    if (missing.includes("AUTH_SECRET")) warnings.push("AUTH_SECRET mangler — login virker ikke (se .env.example)");
    return { ok: true, production, missing: [], invalid: [], warnings };
  }

  const db = env.DATABASE_URL?.trim() ?? "";
  if (production && db && !/^postgres(ql)?:\/\//i.test(db)) {
    warnings.push("DATABASE_URL er ikke en postgresql://-URL — produktion forventer PostgreSQL (Railway)");
  }
  if (!opt.REDIS_URL) {
    warnings.push("REDIS_URL mangler — rate limits og login-lockout er proces-lokale (ok med én replika, ikke ved flere)");
  } else if (!/^rediss?:\/\//i.test(opt.REDIS_URL)) {
    warnings.push("REDIS_URL skal starte med redis:// eller rediss://");
  }
  if (production && !opt.AUTH_TRUST_HOST && !opt.AUTH_URL) {
    warnings.push("AUTH_TRUST_HOST er ikke sat — login fejler bag Railways proxy (sæt AUTH_TRUST_HOST=true)");
  }
  const volume = opt.UPLOAD_DIR || opt.RAILWAY_VOLUME_MOUNT_PATH;
  if (production && opt.UPLOAD_STORAGE !== "volume" && !volume) {
    warnings.push("Uploads gemmes på det flygtige filsystem — monter en Railway Volume og sæt UPLOAD_DIR (uploads forsvinder ved redeploy)");
  }

  // Kant og tillid (T5 P2-2). TRUST_CLOUDFLARE uden aktiv origin-lås gør CF-Connecting-IP forfalskbar -> startfejl.
  const originSecret = opt.ORIGIN_SECRET?.trim();
  if (isOn(opt.TRUST_CLOUDFLARE) && !originSecret) {
    invalid.push("TRUST_CLOUDFLARE=1 kræver ORIGIN_SECRET (origin-lås), ellers kan klient-IP forfalskes og rate limit/lockout omgås");
  }
  if (originSecret && originSecret.length < 24) invalid.push("ORIGIN_SECRET skal være mindst 24 tegn");
  if (!originSecret) {
    warnings.push("ORIGIN_SECRET mangler — origin kan nås uden om Cloudflare (ingen origin-lås); sæt den og en Transform Rule der tilføjer x-origin-secret");
  } else if (!isOn(opt.TRUST_CLOUDFLARE) && !(Number.parseInt(opt.TRUSTED_PROXY_HOPS ?? "1", 10) >= 2)) {
    warnings.push("Origin-lås er aktiv (Cloudflare foran), men hverken TRUST_CLOUDFLARE=1 eller TRUSTED_PROXY_HOPS=2 er sat — alle besøgende bag samme Cloudflare-PoP deler rate-limit-bucket");
  }
  if (isOn(opt.TRUST_FORWARDED_HOST)) {
    warnings.push("TRUST_FORWARDED_HOST=1 — X-Forwarded-Host bruges til tenant-valg; kanten SKAL overskrive/tilføje headeren, ellers kan klienten vælge by (cache poisoning)");
  }
  // Preview-værter (lib/preview.ts): by-vælger via ?by= på en delt adresse. Kun til test/staging, før de rigtige domæner er koblet på.
  if (opt.PREVIEW_HOSTS) {
    const preview = parsePreviewHosts(opt.PREVIEW_HOSTS);
    for (const entry of preview.cityDomainConflicts) {
      warnings.push(`PREVIEW_HOSTS indeholder et rigtigt by-domæne (${entry}) — posten ignoreres. Preview-værter må kun være delte adresser som *.up.railway.app, aldrig byernes egne domæner`);
    }
    for (const entry of preview.invalid) {
      warnings.push(`PREVIEW_HOSTS indeholder en ugyldig post (${entry}) — brug kun hostnavne (fx lysdalcms-production.up.railway.app), uden https://, sti, port eller wildcard`);
    }
    if (preview.hosts.length > 0) {
      warnings.push(
        `PREVIEW_HOSTS er sat (${preview.hosts.length} vært) — alle seks byer kan ses via ?by=<by> på ${preview.hosts.length === 1 ? "den" : "de"} adresse(r); sitet er noindex dér. Fjern PREVIEW_HOSTS (og FALLBACK_SITE_DOMAIN), når de rigtige domæner er koblet på`,
      );
    }
  }
  if (!opt.TURNSTILE_SECRET_KEY) {
    warnings.push("TURNSTILE_SECRET_KEY mangler — formularer har kun honeypot og rate limit (Turnstile er slået fra)");
  }
  if (!opt.ANTHROPIC_API_KEY && !opt.DEEPSEEK_API_KEY) {
    warnings.push("Hverken ANTHROPIC_API_KEY eller DEEPSEEK_API_KEY er sat — AI-operatør, AI-assistent og AI-forslag til forsiden er slået fra (valgfri)");
  }
  // AI-operatørens udbyder (kun navne i beskederne, aldrig værdier).
  const operatorProvider = opt.OPERATOR_PROVIDER?.trim().toLowerCase();
  if (operatorProvider && operatorProvider !== "deepseek" && operatorProvider !== "anthropic") {
    warnings.push("OPERATOR_PROVIDER skal være 'deepseek' eller 'anthropic' — AI-operatøren er slået fra indtil det er rettet");
  } else if (operatorProvider === "deepseek" && !opt.DEEPSEEK_API_KEY) {
    warnings.push("OPERATOR_PROVIDER=deepseek, men DEEPSEEK_API_KEY mangler — AI-operatøren er slået fra");
  } else if (operatorProvider === "anthropic" && !opt.ANTHROPIC_API_KEY) {
    warnings.push("OPERATOR_PROVIDER=anthropic, men ANTHROPIC_API_KEY mangler — AI-operatøren er slået fra");
  } else if (!operatorProvider && opt.DEEPSEEK_API_KEY && opt.ANTHROPIC_API_KEY) {
    warnings.push("Både DEEPSEEK_API_KEY og ANTHROPIC_API_KEY er sat uden OPERATOR_PROVIDER — AI-operatøren bruger DeepSeek (persondata maskeres); sæt OPERATOR_PROVIDER=anthropic for at bruge Claude");
  }
  // Fælles AI-gateway (editor-AI, chat, forside-AI): AI_PROVIDER og override pr. opgave (lib/ai/provider/select.ts).
  for (const [name, value, what] of [
    ["AI_PROVIDER", opt.AI_PROVIDER, "editor-AI, chat og forside-AI"],
    ["EDITOR_AI_PROVIDER", opt.EDITOR_AI_PROVIDER, "editor-AI"],
    ["CHAT_AI_PROVIDER", opt.CHAT_AI_PROVIDER, "AI-chatten"],
    ["FRONTPAGE_AI_PROVIDER", opt.FRONTPAGE_AI_PROVIDER, "forside-AI"],
  ] as const) {
    const provider = value?.trim().toLowerCase();
    if (!provider) continue;
    if (provider !== "deepseek" && provider !== "anthropic") {
      warnings.push(`${name} skal være 'deepseek' eller 'anthropic' — ${what} er slået fra indtil det er rettet`);
    } else if (provider === "deepseek" && !opt.DEEPSEEK_API_KEY) {
      warnings.push(`${name}=deepseek, men DEEPSEEK_API_KEY mangler — ${what} er slået fra`);
    } else if (provider === "anthropic" && !opt.ANTHROPIC_API_KEY) {
      warnings.push(`${name}=anthropic, men ANTHROPIC_API_KEY mangler — ${what} er slået fra`);
    }
  }
  if (opt.DEEPSEEK_BASE_URL && !/^https:\/\//i.test(opt.DEEPSEEK_BASE_URL)) {
    warnings.push("DEEPSEEK_BASE_URL bør være en https://-URL (ellers sendes AI-trafikken ukrypteret eller til en forkert vært)");
  }

  return { ok: missing.length === 0 && invalid.length === 0, production, missing, invalid, warnings };
}

export class EnvError extends Error {
  constructor(public readonly report: EnvReport) {
    const parts: string[] = [];
    if (report.missing.length) parts.push(`Manglende miljøvariabler: ${report.missing.join(", ")}`);
    if (report.invalid.length) parts.push(`Ugyldige miljøvariabler: ${report.invalid.join("; ")}`);
    super(parts.join(". "));
    this.name = "EnvError";
  }
}

let logged = false;

/** Validér og log advarsler (én gang). Kaster EnvError i produktion ved fejl. */
export function assertEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const report = checkEnv(env);
  if (!logged) {
    logged = true;
    for (const w of report.warnings) console.log(`[env] ADVARSEL: ${w}`);
  }
  if (!report.ok) {
    const err = new EnvError(report);
    console.error(`[env] FEJL: ${err.message}`);
    throw err;
  }
  return report;
}
