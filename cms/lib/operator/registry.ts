import { z } from "zod";
import { can, type Permission, type PermissionUser } from "../permissions";
import { BLOCKED_TOOLS, findBlockedTool } from "./policy";
import { defineTool, type AnyTool } from "./types";

/**
 * ÉT register for AI-operatørens værktøjer.
 *
 * Orkestreringen (loop, route, confirm, undo) kender kun dette API: `registerTool`, `getTool`, `listTools`,
 * `toolsFor`, `toAnthropicTools`. Et nyt modul (fx LocalRating eller redaktions-editoren) tilføjer værktøjer ved at kalde
 * `registerTool()` fra sin egen fil og importere den fil i `extensions.ts`. Derefter gælder samme politik (risikoniveau),
 * samme rettighedstjek, samme revisionsspor og samme Fortryd/bekræftelse som for de indbyggede værktøjer.
 */

const NAME_RE = /^[a-z][a-z0-9_]{2,59}$/;
const RISKS = ["read", "safe-write", "confirm"] as const;

const registry = new Map<string, AnyTool>();

export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryError";
  }
}

/** Validerer og registrerer et værktøj. Returnerer en funktion der afregistrerer det igen (bruges i tests). */
export function registerTool(tool: AnyTool): () => void {
  if (!NAME_RE.test(tool.name)) throw new RegistryError(`Ugyldigt værktøjsnavn '${tool.name}' (små bogstaver, tal og _).`);
  if (findBlockedTool(tool.name)) throw new RegistryError(`'${tool.name}' er blokeret og kan ikke registreres som værktøj.`);
  if (registry.has(tool.name)) throw new RegistryError(`Værktøjet '${tool.name}' er allerede registreret.`);
  if (!(RISKS as readonly string[]).includes(tool.risk)) throw new RegistryError(`Ukendt risikoniveau '${String(tool.risk)}' for '${tool.name}'. 'blocked' registreres aldrig.`);
  if (!tool.description.trim()) throw new RegistryError(`Værktøjet '${tool.name}' mangler en beskrivelse.`);
  if (!tool.category.trim()) throw new RegistryError(`Værktøjet '${tool.name}' mangler en kategori.`);
  if (!tool.permissions.length) throw new RegistryError(`Værktøjet '${tool.name}' skal kræve mindst én rettighed.`);
  if (tool.risk === "safe-write" && !tool.undo) {
    // Tilladt (ikke alt kan fortrydes), men så må værktøjet ikke returnere en undo-recept; det håndhæves i dispatch.
  }
  registry.set(tool.name, tool);
  return () => {
    if (registry.get(tool.name) === tool) registry.delete(tool.name);
  };
}

export function getTool(name: string): AnyTool | null {
  return registry.get(name) ?? null;
}

export function listTools(): AnyTool[] {
  return [...registry.values()];
}

export function isPermitted(tool: AnyTool, user: PermissionUser | null | undefined): boolean {
  return tool.permissions.some((p) => can(user, p as Permission)) && (tool.alsoRequires ?? []).every((p) => can(user, p as Permission));
}

/** Værktøjer brugeren har rettigheder til. Kun disse sendes til modellen (mindste privilegium). */
export function toolsFor(user: PermissionUser | null | undefined): AnyTool[] {
  return listTools().filter((t) => isPermitted(t, user));
}

export interface AnthropicToolSchema {
  name: string;
  description: string;
  input_schema: { type: "object"; properties?: Record<string, unknown>; required?: string[]; additionalProperties?: boolean };
}

/** zod → JSON schema til Anthropic `tools`. */
export function toAnthropicTools(tools: readonly AnyTool[]): AnthropicToolSchema[] {
  return tools.map((tool) => {
    const schema = z.toJSONSchema(tool.input, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
    delete schema.$schema;
    return {
      name: tool.name,
      description: `${tool.description}${tool.risk === "confirm" ? " [Kræver brugerens bekræftelse]" : ""}`,
      input_schema: { ...(schema as AnthropicToolSchema["input_schema"]), type: "object" },
    };
  });
}

/** Gruppér værktøjer efter kategori til hjælp og UI. */
export function groupByCategory(tools: readonly AnyTool[]): { category: string; tools: AnyTool[] }[] {
  const map = new Map<string, AnyTool[]>();
  for (const t of tools) map.set(t.category, [...(map.get(t.category) ?? []), t]);
  return [...map.entries()].map(([category, list]) => ({ category, tools: list }));
}

// ── help ────────────────────────────────────────────────────────────────────

const RISK_LABEL: Record<AnyTool["risk"], string> = { read: "læser", "safe-write": "udføres direkte (kan fortrydes)", confirm: "kræver din bekræftelse" };

const help = defineTool({
  name: "help",
  description: "Forklarer hvad operatøren kan for den aktuelle bruger (grupperet efter område), og hvad der bevidst er blokeret.",
  input: z.strictObject({}),
  category: "Hjælp",
  risk: "read",
  permissions: ["operator.use"],
  summarize: () => "Forklarer hvad operatøren kan",
  async execute(ctx) {
    const groups = groupByCategory(toolsFor(ctx.user).filter((t) => t.name !== "help"));
    return {
      ok: true,
      summary: `${groups.reduce((n, g) => n + g.tools.length, 0)} værktøjer i ${groups.length} områder`,
      data: {
        kan: groups.map((g) => ({ omraade: g.category, vaerktoejer: g.tools.map((t) => ({ navn: t.name, hvad: t.description.slice(0, 160), niveau: RISK_LABEL[t.risk] })) })),
        blokeret: BLOCKED_TOOLS.map((b) => ({ hvad: b.label, hvorfor: b.why, side: b.href })),
        princip: "Du kan kun bede om det, du selv har lov til i systemet.",
        udbyder: ctx.provider
          ? { navn: ctx.provider === "deepseek" ? "DeepSeek" : "Claude (Anthropic)", persondata: ctx.provider === "deepseek" ? "Persondata (e-mail, telefon, CPR, kontaktfelter) maskeres eller udelades, før noget sendes til DeepSeek. Navne i brugerens egne beskeder kan ikke genkendes automatisk." : "Almindelig behandling hos Anthropic." }
          : null,
      },
    };
  },
});

let builtinsLoaded = false;

/** Registrerer de indbyggede værktøjer og eventuelle udvidelser (extensions.ts). Idempotent. */
export async function ensureBuiltinTools(): Promise<void> {
  if (builtinsLoaded) return;
  builtinsLoaded = true;
  const modules = await Promise.all([import("./tools/sections"), import("./tools/areas"), import("./tools/articles"), import("./tools/signals"), import("./tools/creation"), import("./tools/admin"), import("./tools/frontpage")]);
  registerTool(help);
  for (const mod of modules) {
    for (const value of Object.values(mod)) {
      if (value && typeof value === "object" && "name" in value && "execute" in value && "input" in value) {
        const tool = value as AnyTool;
        if (!registry.has(tool.name)) registerTool(tool);
      }
    }
  }
  await import("./extensions");
}
