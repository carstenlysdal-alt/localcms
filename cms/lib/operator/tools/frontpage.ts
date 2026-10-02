import { z } from "zod";
import { db } from "../../db";
import { applyOps, opSchema } from "../../frontpage/nl-commands";
import { createProposal, getActiveLayout, interpretEditorCommand, saveDraftLayout } from "../../frontpage/service";
import { PERMISSIONS } from "../../permissions";
import { defineTool, ToolError } from "../types";
import { text } from "./shared";

const EDIT = [PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE] as const;

/** Fastgørelser af enkeltartikler sker i forsideeditoren; her ændres kun layoutet (kladden). */
const LAYOUT_OPS = opSchema.options.filter((o) => {
  const op = (o.shape as { op: { value: string } }).op.value;
  return op !== "pin_article" && op !== "unpin_article";
});
const layoutOpSchema = z.discriminatedUnion("op", LAYOUT_OPS as unknown as [(typeof LAYOUT_OPS)[number], ...(typeof LAYOUT_OPS)[number][]]);

export const getFrontpageStatus = defineTool({
  name: "get_frontpage_status",
  description: "Viser forsidens aktuelle layout (modultyper og slots) og status på det seneste AI-forslag. Ændrer intet.",
  input: z.strictObject({}),
  category: "Forside",
  risk: "read",
  permissions: EDIT,
  summarize: () => "Henter forsidens status",
  async execute(ctx) {
    const layout = await getActiveLayout(ctx.instansId);
    const snapshot = await db.frontpageSnapshot.findFirst({ where: { instansId: ctx.instansId }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, generatedBy: true, createdAt: true } });
    return { ok: true, summary: `Layout '${layout.name}' (${layout.source}), ${layout.modules.length} moduler`, data: { layout: { navn: layout.name, version: layout.version, kilde: layout.source, moduler: layout.modules.map((m) => ({ id: m.id, type: m.type, slots: m.slots, variant: m.variant ?? null })) }, seneste_forslag: snapshot } };
  },
});

export const proposeFrontpageChanges = defineTool({
  name: "propose_frontpage_changes",
  description: "Oversætter en dansk ønsketekst om forsidens opbygning til konkrete layoutoperationer (FORSLAG; ændrer intet). Brug resultatets 'operationer' i save_frontpage_draft, hvis brugeren vil gemme dem som kladde. Kræver både frontpage.ai.use og frontpage.layout.manage.",
  input: z.strictObject({ oensket: text(500, 3) }),
  category: "Forside",
  risk: "read",
  permissions: [PERMISSIONS.FRONTPAGE_AI_USE],
  alsoRequires: [PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE],
  summarize: (input) => `Foreslår forsideændringer: ${input.oensket.slice(0, 80)}`,
  async execute(ctx, input) {
    const layout = await getActiveLayout(ctx.instansId);
    const res = await interpretEditorCommand(ctx.user, input.oensket, layout.modules, { client: ctx.deps.frontpageClient });
    if (!res.ok) return { ok: false, summary: "error" in res ? res.error : `Forslaget mislykkedes (${res.reason}).` };
    const ops = res.ops.filter((o) => o.op !== "pin_article" && o.op !== "unpin_article");
    return { ok: true, summary: `${ops.length} foreslåede operationer${res.afklaring ? ` – afklaring: ${res.afklaring}` : ""}`, data: { operationer: ops, forklaring: res.forklaring, afklaring: res.afklaring, afvist: res.rejected.length } };
  },
});

export const saveFrontpageDraft = defineTool({
  name: "save_frontpage_draft",
  description: "Anvender layoutoperationer (fra propose_frontpage_changes) på en NY layout-KLADDE. Kladden publiceres ikke; redaktøren gennemser og publicerer selv i Forsidestyring. Kræver brugerens bekræftelse.",
  input: z.strictObject({ navn: text(80).optional(), operationer: z.array(layoutOpSchema).min(1).max(12) }),
  category: "Forside",
  risk: "confirm",
  permissions: [PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE],
  summarize: (input) => `Gemmer ${input.operationer.length} layoutændring(er) som forside-kladde`,
  async details(ctx, input) {
    const layout = await getActiveLayout(ctx.instansId);
    const res = applyOps(layout.modules, input.operationer, { candidateIds: new Set() });
    if (!res.applied.length) throw new ToolError(`Ingen af operationerne kan anvendes: ${res.rejected.map((r) => r.reason).slice(0, 3).join("; ")}`);
    return [`Udgangspunkt: ${layout.name} (${layout.source})`, ...res.applied.map((o) => `• ${o.op}`), ...res.rejected.map((r) => `• Afvist: ${r.reason}`), "Gemmes som kladde. Forsiden publiceres ikke."];
  },
  async execute(ctx, input) {
    const layout = await getActiveLayout(ctx.instansId);
    const res = applyOps(layout.modules, input.operationer, { candidateIds: new Set() });
    if (!res.applied.length) return { ok: false, summary: `Ingen operationer kunne anvendes: ${res.rejected.map((r) => r.reason).slice(0, 3).join("; ")}` };
    const saved = await saveDraftLayout(ctx.user, { name: input.navn ?? `AI-forslag ${ctx.now.toISOString().slice(0, 16).replace("T", " ")}`, modules: res.modules });
    if (!saved.ok) return { ok: false, summary: saved.error };
    return { ok: true, summary: `Gemte kladden (${res.applied.length} operationer). Gennemse og publicér i Forsidestyring`, resultIds: [saved.draftId] };
  },
});

export const createFrontpageProposal = defineTool({
  name: "create_frontpage_proposal",
  description: "Beder forsidens motor om et nyt FORSLAG til hvilke artikler der placeres hvor. Forslaget publiceres aldrig; redaktøren godkender i Forsidestyring. Det nyeste forslag erstatter det forrige. Kræver brugerens bekræftelse.",
  input: z.strictObject({ brugAi: z.boolean().optional().describe("Standard: sand, hvis brugeren har frontpage.ai.use") }),
  category: "Forside",
  risk: "confirm",
  permissions: [PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE],
  summarize: () => "Opretter et nyt forside-forslag",
  details: () => ["Beregner et nyt forslag til forsidens placeringer.", "Et eksisterende ikke-godkendt forslag markeres som udløbet.", "Forslaget er ikke synligt for læserne, før du godkender det i Forsidestyring."],
  async execute(ctx, input) {
    const wantAi = (input.brugAi ?? true) && ctx.user.permissions.includes(PERMISSIONS.FRONTPAGE_AI_USE);
    const res = await createProposal(ctx.instansId, { actor: { kind: "user", user: ctx.user }, useAi: wantAi, aiClient: ctx.deps.frontpageClient });
    if (!res.ok) return { ok: false, summary: res.error };
    return { ok: true, summary: `Forslaget er oprettet (${res.assignmentCount} placeringer, ${res.generatedBy === "ai" ? "AI-rangeret" : "deterministisk"}). Godkend det i Forsidestyring`, resultIds: [res.snapshotId] };
  },
});
