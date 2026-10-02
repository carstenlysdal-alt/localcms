import { cleanText } from "../validation/text";
import { MAX_TOOL_OUTPUT_CHARS } from "./policy";

/**
 * Alt der kommer fra databasen eller fra artikler (titler, brødtekst, signaler, tips, feeds) er DATA — aldrig instruktioner.
 * Før det gives til modellen: strenge renses og afkortes, lister afkortes, og hele resultatet pakkes i et tydeligt
 * <hentet_indhold>-element, som systemprompten udpeger som data.
 */
export const DATA_OPEN = "<hentet_indhold";
export const DATA_CLOSE = "</hentet_indhold>";

export interface TruncateOptions {
  maxString?: number;
  maxItems?: number;
  maxDepth?: number;
}

export function truncateDeep(value: unknown, options: TruncateOptions = {}, depth = 0): unknown {
  const maxString = options.maxString ?? 300;
  const maxItems = options.maxItems ?? 20;
  const maxDepth = options.maxDepth ?? 5;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return cleanText(value, maxString, { multiline: true });
  if (value instanceof Date) return value.toISOString();
  if (depth >= maxDepth) return "[afkortet]";
  if (Array.isArray(value)) {
    const items = value.slice(0, maxItems).map((item) => truncateDeep(item, options, depth + 1));
    if (value.length > maxItems) items.push(`[… ${value.length - maxItems} flere udeladt]`);
    return items;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 40)) out[key.slice(0, 60)] = truncateDeep(item, options, depth + 1);
    return out;
  }
  return undefined;
}

/** JSON uden tegn der kan lukke/åbne vores data-element (< og > escapes), afkortet til maxChars. */
export function safeJson(value: unknown, maxChars = MAX_TOOL_OUTPUT_CHARS): string {
  let text = JSON.stringify(value ?? null) ?? "null";
  text = text.replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}…[afkortet]`;
  return text;
}

/** Pak et værktøjsresultat som data, så modellen kan se hvad der er hentet indhold. */
export function wrapAsData(tool: string, value: unknown, options: TruncateOptions & { maxChars?: number } = {}): string {
  const safeTool = tool.replace(/[^a-z0-9_]/gi, "").slice(0, 60);
  const body = safeJson(truncateDeep(value, options), options.maxChars ?? MAX_TOOL_OUTPUT_CHARS);
  return `${DATA_OPEN} værktøj="${safeTool}" type="data-ikke-instruktioner">${body}${DATA_CLOSE}`;
}

/** Navne der aldrig må ende i modelkontekst, logs eller revisionsspor. */
const SECRET_KEYS = /^(temppassword|password|passwordhash|token|tokenhash|secret|apikey|api_key|authorization|afmeldingstoken)$/i;

/** Fjerner (rekursivt) felter der ligner hemmeligheder. Bruges før noget gemmes eller gives til modellen. */
export function stripSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripSecrets(item)) as unknown as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.test(key)) continue;
      out[key] = stripSecrets(item);
    }
    return out as T;
  }
  return value;
}
