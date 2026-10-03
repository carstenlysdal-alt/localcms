import { createHash } from "node:crypto";

/**
 * Dataminimering til eksterne modeludbydere (DeepSeek behandler data uden for EU/EØS — se ADR-017).
 *
 * Reglen: ingen persondata forlader processen mod en minimerende udbyder.
 *  1. Tekst (brugerbesked, historik, værktøjsresultater): e-mailadresser og telefonnumre erstattes af stabile pladsholdere
 *     ([e-mail-k3fa2c1b]); CPR-lignende numre, kontonumre og nøgler fjernes helt. Pladsholdere kan GENDANNES lokalt i
 *     værktøjsargumenter og i svarteksten til brugeren (så "opret bruger anna@…" stadig virker), men værdierne sendes aldrig.
 *  2. Felter: kontaktfelter (e-mail, telefon, afsender, adresse, kontakt …) fjernes fra al værktøjsdata, og hvert værktøj kan
 *     erklære flere (`externalLlm.dropKeys`, fx navnet på en indsender eller bruger) og et neutralt resumé.
 *
 * Navne i fri tekst (fx hvad redaktøren selv skriver) kan ikke genkendes mekanisk; det er en dokumenteret grænse.
 */

const PLACEHOLDER_RE = /\[(e-mail|telefon)-(k[0-9a-f]{7})\]/g;

// Rækkefølgen er vigtig: mest specifikke først.
const SECRET_RE = /\b(?:sk|lk)[-_][A-Za-z0-9_-]{16,}/g;
const EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ ]?\d{4}){3}(?:[ ]?\d{1,4})\b/g;
const CPR_RE = /(?<![\w.-])(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|1[0-2])\d{2}[- ]?\d{4}(?!\w)/g;
const PHONE_INTL_RE = /(?<![\w])(?:\+|00)\d{1,3}[\s.-]?(?:\d[\s.-]?){6,11}\d(?!\w)/g;
const PHONE_DK_RE = /(?<![\w.-])(?:\d{2}([ .])\d{2}\1\d{2}\1\d{2}|\d{4}[ .]\d{4}|\d{8})(?![\w])/g;

/** Tællere (kun tal) over hvad der er maskeret/fjernet; skrives i tur-auditten. */
export interface RedactionStats {
  emails: number;
  phones: number;
  cpr: number;
  secrets: number;
  droppedFields: number;
}

/** Nulstillede tællere. */
export const emptyStats = (): RedactionStats => ({ emails: 0, phones: 0, cpr: 0, secrets: 0, droppedFields: 0 });

function shortHash(value: string): string {
  return `k${createHash("sha256").update(value).digest("hex").slice(0, 7)}`;
}

/**
 * Pladsholder-lager for ÉN tur: husker originalerne, så pladsholdere kan gendannes lokalt. Pladsholderen er en hash af
 * værdien, så den er stabil på tværs af ture (historikken genmaskeres hver tur uden at nummereringen skifter).
 */
export class PiiVault {
  private readonly originals = new Map<string, string>();
  readonly stats: RedactionStats = emptyStats();

  private hold(label: "e-mail" | "telefon", value: string, normalized: string): string {
    const placeholder = `[${label}-${shortHash(`${label}:${normalized}`)}]`;
    if (!this.originals.has(placeholder)) this.originals.set(placeholder, value);
    return placeholder;
  }

  /** Maskerer persondata i en streng. */
  mask(text: string): string {
    if (!text) return text;
    let out = text;
    out = out.replace(SECRET_RE, () => {
      this.stats.secrets += 1;
      return "[hemmelighed-fjernet]";
    });
    out = out.replace(EMAIL_RE, (m) => {
      this.stats.emails += 1;
      return this.hold("e-mail", m, m.toLowerCase());
    });
    out = out.replace(IBAN_RE, () => {
      this.stats.secrets += 1;
      return "[kontonummer-fjernet]";
    });
    out = out.replace(CPR_RE, () => {
      this.stats.cpr += 1;
      return "[cpr-fjernet]";
    });
    out = out.replace(PHONE_INTL_RE, (m) => {
      this.stats.phones += 1;
      return this.hold("telefon", m, m.replace(/\D/g, ""));
    });
    out = out.replace(PHONE_DK_RE, (m) => {
      this.stats.phones += 1;
      return this.hold("telefon", m, m.replace(/\D/g, ""));
    });
    return out;
  }

  /** Gendanner kendte pladsholdere (kun lokalt: værktøjsargumenter og svartekst til brugeren). Ukendte lades urørt. */
  restore(text: string): string {
    if (!text || !text.includes("[")) return text;
    return text.replace(PLACEHOLDER_RE, (whole) => this.originals.get(whole) ?? whole);
  }

  restoreDeep<T>(value: T): T {
    if (typeof value === "string") return this.restore(value) as unknown as T;
    if (Array.isArray(value)) return value.map((v) => this.restoreDeep(v)) as unknown as T;
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = this.restoreDeep(v);
      return out as T;
    }
    return value;
  }

  /** Streaming: gendanner pladsholdere i tekstdeltaer, også når en pladsholder deles over to deltaer. */
  restorer(emit: (text: string) => void) {
    let pending = "";
    const MAX_PENDING = 40;
    return {
      push: (delta: string) => {
        let text = pending + delta;
        pending = "";
        const open = text.lastIndexOf("[");
        if (open >= 0 && text.indexOf("]", open) < 0 && text.length - open <= MAX_PENDING) {
          pending = text.slice(open);
          text = text.slice(0, open);
        }
        if (text) emit(this.restore(text));
      },
      flush: () => {
        if (pending) emit(this.restore(pending));
        pending = "";
      },
    };
  }
}

/** Tilstandsløs maske (ingen gendannelse): sidste skanse i udbyder-adapteren. */
export function maskPiiText(text: string): string {
  if (!text) return text;
  return text
    .replace(SECRET_RE, "[hemmelighed-fjernet]")
    .replace(EMAIL_RE, "[e-mail-fjernet]")
    .replace(IBAN_RE, "[kontonummer-fjernet]")
    .replace(CPR_RE, "[cpr-fjernet]")
    .replace(PHONE_INTL_RE, "[telefon-fjernet]")
    .replace(PHONE_DK_RE, "[telefon-fjernet]");
}

/** Indeholder teksten noget der ville blive maskeret? (bruges af tests og som forsvar i dybden) */
export function containsPii(text: string): boolean {
  return maskPiiText(text) !== text;
}

const norm = (key: string) => key.toLowerCase().replace(/[^a-z0-9æøå]/g, "");

/** Felter der aldrig sendes til en ekstern udbyder, uanset værktøj. */
const GENERIC_DROP = /(email|mail|epost|telefon|phone|tlf|mobil|kontakt|adresse|address|cpr|password|adgangskode|token|secret|apikey|authorization|svarlink|afsender|ipadr)/;
const EXACT_DROP = new Set(["ip", "tlf", "mobil"]);

/** Er feltnavnet et kontakt-/hemmelighedsfelt der aldrig må sendes til en ekstern udbyder? */
export function isContactKey(key: string): boolean {
  const k = norm(key);
  return EXACT_DROP.has(k) || GENERIC_DROP.test(k);
}

/** Værktøjets egen erklæring om hvad der må forlade processen (se ToolDef.externalLlm). */
export interface ExternalLlmSpec {
  /** Ekstra felter der fjernes (fx `navn` på en bruger, `uddrag` af en indsendelse). Sammenlignes uden forskel på store/små bogstaver. */
  dropKeys?: readonly string[];
  /** Erstatter resuméet når kaldet lykkedes (resuméet kan indeholde navne). Fejlresuméer maskeres kun. */
  summaryOnOk?: string;
}

/** Det mindste redactForExternalLlm skal bruge af et værktøjsresultat. */
export interface RedactableOutcome {
  ok: boolean;
  summary: string;
  data?: unknown;
}

const MAX_DEPTH = 8;

function redactValue(value: unknown, vault: PiiVault, drop: ReadonlySet<string>, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return vault.mask(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return "[afkortet]";
  if (Array.isArray(value)) return value.map((v) => redactValue(v, vault, drop, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (isContactKey(key) || drop.has(norm(key))) {
        vault.stats.droppedFields += 1;
        continue;
      }
      out[key] = redactValue(item, vault, drop, depth + 1);
    }
    return out;
  }
  return undefined;
}

/**
 * Det redigerede billede af et værktøjsresultat, som må sendes til en ekstern udbyder: kontaktfelter og værktøjets egne
 * `dropKeys` fjernes, øvrig tekst maskeres, og resuméet maskeres (eller erstattes af `summaryOnOk`).
 */
export function redactForExternalLlm(outcome: RedactableOutcome, vault: PiiVault, spec?: ExternalLlmSpec): { summary: string; data: unknown } {
  const drop = new Set((spec?.dropKeys ?? []).map(norm));
  const summary = outcome.ok && spec?.summaryOnOk ? spec.summaryOnOk : vault.mask(outcome.summary);
  return { summary, data: redactValue(outcome.data, vault, drop, 0) };
}
