import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { NoAccess } from "@/components/admin/no-access";

export default async function KontoPage() {
  const user = await getAuthorizedUser();
  if (!user) return <NoAccess area="din konto" />;
  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordChangedAt: true } });
  const changed = row?.passwordChangedAt;

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <h1>Min konto</h1>
          <p className="text-muted">Du er logget ind som {user.name} ({user.email}) med rollen {user.roleName}.</p>
        </div>
      </div>
      <div className="account-grid">
        <ChangePasswordForm email={user.email} name={user.name} />
        <aside className="account-side" aria-label="Om din adgangskode">
          <h2 className="section-label">Sådan virker det</h2>
          <ul className="account-notes">
            <li>Når du skifter adgangskode, bliver du logget ud på alle andre enheder.</li>
            <li>Efter 5 forkerte forsøg på den nuværende adgangskode låses kodeskiftet i 15 minutter.</li>
            <li>Har du glemt adgangskoden, kan en administrator udstede en ny midlertidig.</li>
          </ul>
          <p className="help-text">{changed ? `Sidst skiftet: ${changed.toLocaleString("da-DK", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Copenhagen" })}.` : "Adgangskoden er ikke skiftet via CMS'et endnu."}</p>
        </aside>
      </div>
    </main>
  );
}
