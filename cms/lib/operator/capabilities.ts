import type { AuthorizedUser } from "./../auth";
import { ensureBuiltinTools, groupByCategory, toolsFor } from "./registry";
import type { Risk } from "./policy";

export interface CapabilityGroup {
  category: string;
  tools: { name: string; risk: Risk; hint: string }[];
}

/** Hvad brugeren kan bede AI om = de registrerede værktøjer brugerens rettigheder dækker. Serialiserbar til klienten. */
export async function getCapabilities(user: Pick<AuthorizedUser, "permissions">): Promise<CapabilityGroup[]> {
  await ensureBuiltinTools();
  return groupByCategory(toolsFor(user).filter((t) => t.name !== "help")).map((g) => ({
    category: g.category,
    tools: g.tools.map((t) => ({ name: t.name, risk: t.risk, hint: t.description.split(/(?<=\.)\s/)[0].slice(0, 160) })),
  }));
}
