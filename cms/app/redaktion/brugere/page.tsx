import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { NoAccess } from "@/components/admin/no-access";
import { UserAdmin, type RoleOption, type UserRow } from "@/components/admin/user-admin";

const ACTION_LABELS: Record<string, string> = {
  "user.create": "Oprettede bruger",
  "user.reset_password": "Nulstillede adgangskode for",
  "user.change_role": "Ændrede rolle for",
  "user.deactivate": "Deaktiverede",
  "user.reactivate": "Aktiverede",
  "password.change": "Skiftede egen adgangskode",
  "user.reset_password_cli": "Nulstillede adgangskode (driftsværktøj) for",
};

const fmt = (d: Date) => d.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Copenhagen" });

export default async function BrugerePage() {
  const actor = await getAuthorizedUser(PERMISSIONS.USERS_MANAGE);
  if (!actor) return <NoAccess area="brugeradministration" />;

  // Kun den aktuelle instans (instansId fra DB-rækken for den indloggede bruger, aldrig fra URL/klient).
  const [users, roles, audit] = await Promise.all([
    db.user.findMany({ where: { instansId: actor.instansId }, include: { role: true }, orderBy: [{ deaktiveretTid: "asc" }, { navn: "asc" }] }),
    db.role.findMany({ orderBy: { navn: "asc" } }),
    db.auditLog.findMany({ where: { instansId: actor.instansId }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  const own = new Set(actor.permissions);
  const withinReach = (perms: unknown) => (Array.isArray(perms) ? (perms as string[]) : []).every((p) => own.has(p));

  const roleOptions: RoleOption[] = roles.filter((r) => withinReach(r.permissions)).map((r) => ({ id: r.id, navn: r.navn }));
  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    navn: u.navn,
    email: u.email,
    roleId: u.roleId,
    roleName: u.role.navn,
    isSelf: u.id === actor.id,
    manageable: withinReach(u.role.permissions),
    deactivated: Boolean(u.deaktiveretTid),
    mustChange: u.mustChangePassword,
    createdLabel: fmt(u.createdAt),
  }));

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <h1>Brugere</h1>
          <p className="text-muted">Opret brugere, skift roller og udsted midlertidige adgangskoder. Kun brugere i denne redaktion vises.</p>
        </div>
      </div>
      <UserAdmin users={rows} roles={roleOptions} />
      <section aria-labelledby="audit-heading" style={{ marginTop: "var(--space-8)" }}>
        <h2 className="section-label" id="audit-heading">Seneste handlinger</h2>
        <div className="table-wrap">
          <table className="table users-table">
            <caption className="sr-only">Seneste administrative handlinger i denne redaktion</caption>
            <thead><tr><th scope="col">Tidspunkt</th><th scope="col">Udført af</th><th scope="col">Handling</th></tr></thead>
            <tbody>
              {audit.map((entry) => {
                const detail = entry.detail && typeof entry.detail === "object" && !Array.isArray(entry.detail) ? (entry.detail as Record<string, unknown>) : {};
                const extra = detail.fromRole && detail.toRole ? ` (${String(detail.fromRole)} → ${String(detail.toRole)})` : detail.role ? ` (${String(detail.role)})` : "";
                const label = ACTION_LABELS[entry.action] ?? entry.action;
                const target = entry.targetId === entry.actorId ? "" : entry.targetLabel ? ` ${entry.targetLabel}` : "";
                return (
                  <tr key={entry.id}>
                    <td>{fmt(entry.createdAt)}</td>
                    <td>{entry.actorLabel ?? "Driftsværktøj"}</td>
                    <td>{label}{target}{extra}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!audit.length && <div className="empty-state">Ingen handlinger registreret endnu.</div>}
        </div>
      </section>
    </main>
  );
}
