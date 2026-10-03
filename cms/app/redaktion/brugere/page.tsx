import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { listAccessibleInstances } from "@/lib/instance-access";
import { NoAccess } from "@/components/admin/no-access";
import { UserAdmin, type RoleOption, type UserRow } from "@/components/admin/user-admin";
import { Users } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/Page";
import { DataTable, type DataTableRow } from "@/components/ui/DataTable";

const ACTION_LABELS: Record<string, string> = {
  "user.create": "Oprettede bruger",
  "user.reset_password": "Nulstillede adgangskode for",
  "user.change_role": "Ændrede rolle for",
  "user.deactivate": "Deaktiverede",
  "user.reactivate": "Aktiverede",
  "password.change": "Skiftede egen adgangskode",
  "user.reset_password_cli": "Nulstillede adgangskode (driftsværktøj) for",
  "user.access_grant": "Gav adgang til denne by til",
  "user.access_revoke": "Fjernede adgang til denne by for",
  "instance.switch": "Skiftede til denne by",
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

  // Netværksadgang: kun med network.manage (users.manage alene giver den ikke). Udførerens egne byer er de eneste valgbare.
  const canManageNetwork = can(actor, PERMISSIONS.NETWORK_MANAGE);
  const [instances, accessRows] = canManageNetwork
    ? await Promise.all([
        listAccessibleInstances(actor.id, actor.homeInstansId),
        db.userInstanceAccess.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { userId: true, instansId: true } }),
      ])
    : [[], []];
  const accessByUser = new Map<string, string[]>();
  for (const row of accessRows) accessByUser.set(row.userId, [...(accessByUser.get(row.userId) ?? []), row.instansId]);

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
    extraAccess: accessByUser.get(u.id) ?? [],
  }));

  const auditRows: DataTableRow[] = audit.map((entry) => {
    const detail = entry.detail && typeof entry.detail === "object" && !Array.isArray(entry.detail) ? (entry.detail as Record<string, unknown>) : {};
    const extra = detail.fromRole && detail.toRole ? ` (${String(detail.fromRole)} → ${String(detail.toRole)})` : detail.role ? ` (${String(detail.role)})` : "";
    const label = ACTION_LABELS[entry.action] ?? entry.action;
    const target = entry.targetId === entry.actorId ? "" : entry.targetLabel ? ` ${entry.targetLabel}` : "";
    return {
      id: entry.id,
      sort: { tid: entry.createdAt.getTime() },
      cells: { tid: fmt(entry.createdAt), af: entry.actorLabel ?? "Driftsværktøj", handling: `${label}${target}${extra}` },
    };
  });

  return (
    <Page>
      <PageHeader
        icon={<Users size={22} />}
        title="Brugere"
        subtitle="Opret brugere, skift roller og udsted midlertidige adgangskoder. Kun brugere i denne redaktion vises."
      />
      <UserAdmin users={rows} roles={roleOptions} instances={instances.map((i) => ({ id: i.id, navn: i.navn.replace(/Lokalt$/i, ""), key: i.key }))} canManageNetwork={canManageNetwork} activeInstansId={actor.instansId} />
      <section aria-labelledby="audit-heading" className="page-section">
        <h2 className="ui-section-title" id="audit-heading">Seneste handlinger</h2>
        <DataTable
          caption="Seneste administrative handlinger i denne redaktion"
          columns={[
            { key: "tid", header: "Tidspunkt", sortable: true },
            { key: "af", header: "Udført af" },
            { key: "handling", header: "Handling" },
          ]}
          rows={auditRows}
          defaultSort={{ key: "tid", direction: "desc" }}
          emptyTitle="Ingen handlinger registreret endnu"
        />
      </section>
    </Page>
  );
}
