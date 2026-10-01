import type { ModuleInstance } from "@/lib/frontpage/layout-schema";
import { MODULE_REGISTRY } from "@/lib/frontpage/modules";
import type { FrontpageOp } from "@/lib/frontpage/nl-commands";
import { getTemplate } from "@/lib/frontpage/templates";

/** Operationer fra AI (naturligt sprog / foreslå layout) som læsbare danske sætninger. Rent. */
const mLabel = (type: string) => MODULE_REGISTRY[type as keyof typeof MODULE_REGISTRY]?.label ?? type;

export function describeOp(op: FrontpageOp, modules: readonly ModuleInstance[], titles: Record<string, string> = {}): string {
  const mod = (id: string) => {
    const m = modules.find((x) => x.id === id);
    return m ? `${mLabel(m.type)} (${id})` : `'${id}'`;
  };
  const art = (id: string) => (titles[id] ? `"${titles[id]}"` : `artikel ${id.slice(0, 8)}`);
  switch (op.op) {
    case "add_module":
      return `Tilføj modulet ${mLabel(op.moduleType)}${op.afterModuleId === null ? " øverst" : op.afterModuleId ? ` efter ${mod(op.afterModuleId)}` : " nederst"}${op.slots ? ` med ${op.slots} slots` : ""}.`;
    case "remove_module":
      return `Fjern ${mod(op.moduleId)}.`;
    case "move_module":
      return `Flyt ${mod(op.moduleId)} ${op.afterModuleId === null ? "øverst" : `efter ${mod(op.afterModuleId)}`}.`;
    case "set_slots":
      return `Sæt antal slots i ${mod(op.moduleId)} til ${op.slots}.`;
    case "set_variant":
      return `Vis ${mod(op.moduleId)} som '${op.variant}'.`;
    case "set_config": {
      const keys = Object.keys(op.config).join(", ");
      return `Ændr indstillinger (${keys || "ingen"}) i ${mod(op.moduleId)}.`;
    }
    case "add_break":
      return `Læg et ${mLabel(op.breakType)}-break efter slot ${op.afterSlot} i ${mod(op.hostModuleId)}${op.repeatEvery ? `, gentaget hver ${op.repeatEvery}. slot` : ""}.`;
    case "remove_break":
      return `Fjern break ${op.breakModuleId} fra ${mod(op.hostModuleId)}.`;
    case "apply_template": {
      const t = getTemplate(op.templateId);
      return `${op.mode === "replace" ? "Erstat layoutet med" : "Tilføj"} skabelonen '${t?.navn ?? op.templateId}'.`;
    }
    case "pin_article":
      return `Fastgør ${art(op.articleId)} i ${mod(op.moduleId)}, slot ${op.slotIndex + 1} (48 timer).`;
    case "unpin_article":
      return `Fjern fastgørelse af ${art(op.articleId)}.`;
  }
}
