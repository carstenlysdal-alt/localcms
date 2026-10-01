import { z } from "zod";

/**
 * Miljøvalidering ved serverstart (kaldes fra instrumentation.ts -> register()).
 *
 * I produktion stopper manglende/ugyldige påkrævede variabler opstarten. Fejlbeskeder nævner KUN variabelnavne og
 * regler — aldrig værdier (hemmeligheder må ikke ende i logs). Uden for produktion (dev/test) kaster vi aldrig.
 *
 * Påkrævet i produktion: DATABASE_URL, AUTH_SECRET (>= 32 tegn), NEXT_PUBLIC_APP_URL (http/https-URL), CRON_SECRET (>= 16).
 * Kun advarsel: REDIS_URL, AUTH_TRUST_HOST/AUTH_URL, DATABASE_URL ikke postgres, uploads på flygtigt filsystem.
 * Valgfri: ANTHROPIC_API_KEY m.fl.
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
  AUTH_TRUST_HOST: optionalText,
  AUTH_URL: optionalText,
  UPLOAD_DIR: optionalText,
  UPLOAD_STORAGE: optionalText,
  RAILWAY_VOLUME_MOUNT_PATH: optionalText,
});

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
  if (!opt.ANTHROPIC_API_KEY) warnings.push("ANTHROPIC_API_KEY mangler — AI-assistent og AI-forslag til forsiden er slået fra (valgfri)");

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
    for (const w of report.warnings) console.warn(`[env] ADVARSEL: ${w}`);
  }
  if (!report.ok) {
    const err = new EnvError(report);
    console.error(`[env] FEJL: ${err.message}`);
    throw err;
  }
  return report;
}
