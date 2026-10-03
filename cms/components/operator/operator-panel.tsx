import type { AuthorizedUser } from "@/lib/auth";
import { getCapabilities } from "@/lib/operator/capabilities";
import { getOperatorProviderInfo } from "@/lib/operator/runtime";
import { can, PERMISSIONS } from "@/lib/permissions";
import { OperatorPanelClient } from "./operator-panel-client";

/** Server-wrapper: mountes ÉN gang i app/redaktion/layout.tsx. Viser intet for brugere uden operator.use. */
export async function OperatorPanel({ user }: { user: AuthorizedUser }) {
  if (!can(user, PERMISSIONS.OPERATOR_USE)) return null;
  const capabilities = await getCapabilities(user);
  return <OperatorPanelClient capabilities={capabilities} roleName={user.roleName} provider={getOperatorProviderInfo()} />;
}
