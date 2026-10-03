import { NoAccess } from "@/components/admin/no-access";
import { OperatorSurface, ProviderNotice } from "@/components/operator/operator-surface";
import { getAuthorizedUser } from "@/lib/auth";
import { getCapabilities } from "@/lib/operator/capabilities";
import { getOperatorProviderInfo } from "@/lib/operator/runtime";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "AI-operatør" };

/** Fuld side for AI-operatøren. Samme komponent som den flydende knap (Cmd/Ctrl+K) på de øvrige sider. */
export default async function OperatorPage() {
  const user = await getAuthorizedUser(PERMISSIONS.OPERATOR_USE);
  if (!user) return <NoAccess area="AI-operatøren" />;
  const capabilities = await getCapabilities(user);
  const provider = getOperatorProviderInfo();
  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <h1>AI-operatør</h1>
          <p className="text-muted">Skriv eller tal en opgave, og systemet udfører den med dine rettigheder. Publicering, afsendelse og betaling gør du altid selv.</p>
          <ProviderNotice provider={provider} />
        </div>
      </div>
      <OperatorSurface capabilities={capabilities} roleName={user.roleName} provider={provider} variant="page" />
    </main>
  );
}
