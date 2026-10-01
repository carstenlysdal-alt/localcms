import type { ModuleConfig, ModuleInstance } from "@/lib/frontpage/layout-schema";
import { MODULE_REGISTRY } from "@/lib/frontpage/modules";
import type { ModuleTypeId } from "@/lib/frontpage/types";

/**
 * Konfigurationspanelet genereres af modulets definition (allowedConfigKeys + slots + varianter).
 * Formularværdier -> ModulePatch (config) er rene funktioner, så de kan testes uden UI.
 */
export interface Option {
  value: string;
  label: string;
}

export type FieldDef =
  | { key: string; label: string; kind: "text"; max: number; help?: string }
  | { key: string; label: string; kind: "number"; min: number; max: number; placeholder?: string; help?: string }
  | { key: string; label: string; kind: "select"; options: Option[]; help?: string }
  | { key: string; label: string; kind: "multi"; options: Option[]; help?: string };

export interface FieldContext {
  sections: Option[];
  areas: Option[];
}

export const SOURCE_TYPE_OPTIONS: Partial<Record<ModuleTypeId, Option[]>> = {
  "fra-kommunen": [
    { value: "kommune_dagsorden", label: "Kommunale dagsordener" },
    { value: "kommune_pressemeddelelse", label: "Kommunale pressemeddelelser" },
  ],
  "fra-politiet": [
    { value: "politi", label: "Politiet" },
    { value: "beredskab_112", label: "Beredskab / 112" },
  ],
};

export const AD_FORMAT_OPTIONS: Option[] = [
  { value: "NATIVE_PREMIUM", label: "Native premium" },
  { value: "NATIVE_SEKTION", label: "Native sektion" },
  { value: "IN_FEED_BANNER", label: "In-feed banner" },
  { value: "EVENT_POST", label: "Event-opslag" },
  { value: "GUIDE_PROFILE", label: "Guide-profil" },
];

export const PROMO_OPTIONS: Option[] = [
  { value: "stoet", label: "Støt journalistikken" },
  { value: "nyhedsbrev", label: "Nyhedsbrev" },
  { value: "indsend", label: "Send et tip" },
];

/** Felter (uden slots/variant/region/tilstand/synlighed, som panelet viser for alle moduler) for en modultype. */
export function configFields(type: ModuleTypeId, ctx: FieldContext): FieldDef[] {
  const def = MODULE_REGISTRY[type];
  const out: FieldDef[] = [];
  for (const key of def.allowedConfigKeys) {
    switch (key) {
      case "titel":
        out.push({ key, label: "Overskrift (valgfri)", kind: "text", max: 80, help: "Tom = modulets standardoverskrift." });
        break;
      case "sektionSlug":
        out.push({ key, label: "Sektion", kind: "select", options: [{ value: "", label: "Alle sektioner" }, ...ctx.sections] });
        break;
      case "omraadeSlug":
        out.push({ key, label: "Område", kind: "select", options: [{ value: "", label: "Besøgendes valgte område" }, ...ctx.areas] });
        break;
      case "maxAgeHours":
        out.push({ key, label: "Maks. alder (timer)", kind: "number", min: 1, max: 720, placeholder: String(def.maxAgeHours || ""), help: `Standard: ${def.maxAgeHours} t.` });
        break;
      case "promoKind":
        out.push({ key, label: "Type promo", kind: "select", options: PROMO_OPTIONS });
        break;
      case "adFormat":
        out.push({ key, label: "Annonceformat", kind: "select", options: [{ value: "", label: "Alle formater" }, ...AD_FORMAT_OPTIONS] });
        break;
      case "sourceTypes": {
        const options = SOURCE_TYPE_OPTIONS[type];
        if (options) out.push({ key, label: "Kilder", kind: "multi", options });
        break;
      }
      default:
        break; // breaks og placement redigeres i break-editoren
    }
  }
  return out;
}

export type FormValues = Record<string, string | string[]>;

export function formValuesFromModule(m: ModuleInstance): FormValues {
  const v: FormValues = {};
  const c = m.config;
  if (c.titel) v.titel = c.titel;
  if (c.sektionSlug) v.sektionSlug = c.sektionSlug;
  if (c.omraadeSlug) v.omraadeSlug = c.omraadeSlug;
  if (c.maxAgeHours !== undefined) v.maxAgeHours = String(c.maxAgeHours);
  if (c.promoKind) v.promoKind = c.promoKind;
  if (c.adFormat) v.adFormat = c.adFormat;
  if (c.sourceTypes) v.sourceTypes = [...c.sourceTypes];
  return v;
}

/**
 * Formularværdier -> config-objekt. Tomme værdier fjerner nøglen. Kun nøgler modulet tillader tages med
 * (så en forkert/gammel formularværdi aldrig kan smugle ukendte felter ind). Fejl i tal -> `errors`.
 */
export function formToConfig(type: ModuleTypeId, values: FormValues): { config: ModuleConfig; errors: Record<string, string> } {
  const allowed = new Set<string>(MODULE_REGISTRY[type].allowedConfigKeys);
  const config: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const str = (k: string) => (typeof values[k] === "string" ? (values[k] as string).trim() : "");
  if (allowed.has("titel") && str("titel")) config.titel = str("titel").slice(0, 80);
  if (allowed.has("sektionSlug") && str("sektionSlug")) config.sektionSlug = str("sektionSlug");
  if (allowed.has("omraadeSlug") && str("omraadeSlug")) config.omraadeSlug = str("omraadeSlug");
  if (allowed.has("promoKind") && str("promoKind")) config.promoKind = str("promoKind");
  if (allowed.has("adFormat") && str("adFormat")) config.adFormat = str("adFormat");
  if (allowed.has("maxAgeHours") && str("maxAgeHours")) {
    const n = Number(str("maxAgeHours"));
    if (!Number.isInteger(n) || n < 1 || n > 720) errors.maxAgeHours = "Hele timer mellem 1 og 720.";
    else config.maxAgeHours = n;
  }
  if (allowed.has("sourceTypes") && Array.isArray(values.sourceTypes) && values.sourceTypes.length) config.sourceTypes = values.sourceTypes;
  return { config: config as ModuleConfig, errors };
}
