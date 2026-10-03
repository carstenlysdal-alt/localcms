"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Copy, Globe2, KeyRound, UserCheck, UserPlus, UserX } from "lucide-react";
import {
  changeRoleAction,
  createUserAction,
  deactivateUserAction,
  reactivateUserAction,
  resetPasswordAction,
  type UserAdminResult,
} from "@/app/redaktion/brugere/actions";
import { setUserInstanceAccessAction } from "@/app/redaktion/brugere/network-actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { DataTable, type DataTableColumn, type DataTableRow } from "@/components/ui/DataTable";
import { Field, Notice } from "@/components/ui/Layout";

export type RoleOption = { id: string; navn: string };
export type UserRow = {
  id: string;
  navn: string;
  email: string;
  roleId: string;
  roleName: string;
  isSelf: boolean;
  manageable: boolean;
  deactivated: boolean;
  mustChange: boolean;
  createdLabel: string;
  /** Ekstra byer (ud over hjemmebyen) brugeren har adgang til — instans-id'er. */
  extraAccess: string[];
};
export type InstanceOption = { id: string; navn: string; key: string };

type Secret = { name: string; email: string; password: string };

export function UserAdmin({
  users,
  roles,
  instances = [],
  canManageNetwork = false,
  activeInstansId = "",
}: {
  users: UserRow[];
  roles: RoleOption[];
  /** De byer udføreren selv har adgang til (de eneste der kan gives/fjernes). */
  instances?: InstanceOption[];
  canManageNetwork?: boolean;
  /** Den aktive by = alle viste brugeres hjemmeby. */
  activeInstansId?: string;
}) {
  const [accessFor, setAccessFor] = useState<{ user: UserRow; selected: string[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [copied, setCopied] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<NonNullable<UserAdminResult["fieldErrors"]>>({});
  const [roleDraft, setRoleDraft] = useState<Record<string, string>>({});
  const [confirmAsk, setConfirmAsk] = useState<{ question: string; label: string; task: () => Promise<UserAdminResult> } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const secretRef = useRef<HTMLDivElement>(null);

  // Flyt fokus til den midlertidige adgangskode, så skærmlæsere og tastatur lander ved den (efter at panelet er renderet).
  useEffect(() => {
    if (secret) secretRef.current?.focus();
  }, [secret]);

  function handle(result: UserAdminResult) {
    setNotice({ ok: result.ok, text: result.message });
    setFieldErrors(result.fieldErrors ?? {});
    if (result.ok && result.tempPassword) {
      setSecret({ name: result.name ?? "", email: result.email ?? "", password: result.tempPassword });
      setCopied(false);
    }
    return result;
  }

  function run(task: () => Promise<UserAdminResult>, onOk?: () => void) {
    startTransition(async () => {
      try {
        const result = handle(await task());
        if (result.ok) onOk?.();
      } catch {
        setNotice({ ok: false, text: "Handlingen mislykkedes. Prøv igen." });
      }
    });
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.password);
      setCopied(true);
    } catch {
      setNotice({ ok: false, text: "Kunne ikke kopiere automatisk. Markér adgangskoden, og kopiér den manuelt." });
    }
  }

  function confirmThen(question: string, label: string, task: () => Promise<UserAdminResult>) {
    setConfirmAsk({ question, label, task });
  }

  const columns: DataTableColumn[] = [
    { key: "bruger", header: "Bruger", sortable: true },
    { key: "rolle", header: "Rolle", sortable: true, hideOnMobile: true },
    { key: "status", header: "Status", sortable: true },
    { key: "handling", header: "Handlinger" },
  ];

  const rows: DataTableRow[] = users.map((u) => {
    const draft = roleDraft[u.id] ?? u.roleId;
    return {
      id: u.id,
      sort: { bruger: u.navn, rolle: u.roleName, status: u.deactivated ? 2 : u.mustChange ? 1 : 0 },
      cells: {
        bruger: (
          <div className="ui-stack">
            <strong>{u.navn}{u.isSelf ? <span className="ui-muted"> (dig)</span> : null}</strong>
            <span className="ui-small ui-muted">{u.email}</span>
            {u.extraAccess.length > 0 ? <span className="ui-small ui-muted">Har også adgang til: {u.extraAccess.map((id) => instances.find((i) => i.id === id)?.navn ?? "en anden by").join(", ")}</span> : null}
          </div>
        ),
        rolle: u.roleName,
        status: u.deactivated ? <Badge tone="neutral" dot>Deaktiveret</Badge> : u.mustChange ? <Badge tone="review" dot>Skal skifte kode</Badge> : <Badge tone="success" dot>Aktiv</Badge>,
        handling: !u.manageable ? (
          <span className="ui-muted ui-small">Har flere rettigheder end dig</span>
        ) : (
          <div className="user-actions">
            <select className="input" aria-label={`Rolle for ${u.navn}`} value={draft} onChange={(e) => setRoleDraft((d) => ({ ...d, [u.id]: e.target.value }))} disabled={pending}>
              {!roles.some((r) => r.id === u.roleId) && <option value={u.roleId}>{u.roleName}</option>}
              {roles.map((r) => <option key={r.id} value={r.id}>{r.navn}</option>)}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" disabled={pending || draft === u.roleId} onClick={() => run(() => changeRoleAction(u.id, draft), () => setRoleDraft((d) => { const { [u.id]: _removed, ...rest } = d; return rest; }))}>
              Gem rolle<span className="sr-only"> for {u.navn}</span>
            </button>
            {!u.isSelf && !u.deactivated && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => confirmThen(`Nulstil adgangskoden for ${u.navn}? Vedkommende logges ud overalt og får en ny midlertidig adgangskode.`, "Nulstil adgangskode", () => resetPasswordAction(u.id))}>
                <KeyRound size={14} aria-hidden="true" /> Nulstil adgangskode<span className="sr-only"> for {u.navn}</span>
              </button>
            )}
            {canManageNetwork && !u.isSelf && !u.deactivated && instances.length > 1 && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => setAccessFor({ user: u, selected: u.extraAccess })}>
                <Globe2 size={14} aria-hidden="true" /> Byer<span className="sr-only"> for {u.navn}</span>
              </button>
            )}
            {!u.isSelf && (u.deactivated ? (
              <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => reactivateUserAction(u.id))}>
                <UserCheck size={14} aria-hidden="true" /> Aktivér<span className="sr-only"> {u.navn}</span>
              </button>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm cat-delete" disabled={pending} onClick={() => confirmThen(`Deaktivér ${u.navn}? Vedkommende kan ikke logge ind, og eksisterende sessioner afvises.`, "Deaktivér", () => deactivateUserAction(u.id))}>
                <UserX size={14} aria-hidden="true" /> Deaktivér<span className="sr-only"> {u.navn}</span>
              </button>
            ))}
          </div>
        ),
      },
    };
  });

  return (
    <div className="ui-stack ui-gap-md">
      <div aria-live="polite" aria-atomic="true">
        {notice ? <Notice tone={notice.ok ? "success" : "danger"}>{notice.text}</Notice> : null}
      </div>

      {secret && (
        <div className="card secret-card" ref={secretRef} tabIndex={-1} role="region" aria-label="Midlertidig adgangskode">
          <div className="card-kicker">Vises kun nu</div>
          <h2 className="card-title">Midlertidig adgangskode til {secret.name}</h2>
          <p className="card-body card-body-fixed">
            Giv adgangskoden til {secret.email} på en sikker måde. Den kan ikke vises igen, og brugeren skal vælge en ny ved første login.
          </p>
          <code className="secret-value" aria-label="Midlertidig adgangskode">{secret.password}</code>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={copySecret}><Copy size={14} aria-hidden="true" /> Kopiér adgangskode</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setSecret(null); setCopied(false); }}>Jeg har gemt den, skjul</button>
            <span className="help-text" role="status">{copied ? "Kopieret til udklipsholderen." : ""}</span>
          </div>
        </div>
      )}

      <div className="users-grid">
        <DataTable caption="Brugere i denne redaktion" columns={columns} rows={rows} defaultSort={{ key: "bruger", direction: "asc" }} emptyTitle="Ingen brugere endnu" />

        <Card as="div" title="Opret bruger" headingLevel={2} className="account-card">
          <form
            ref={formRef}
            className="ui-stack ui-gap-md"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              run(() => createUserAction(data), () => formRef.current?.reset());
            }}
          >
            <Field label="Navn" htmlFor="nu-navn" required error={fieldErrors.navn}>
              <input className="input" id="nu-navn" name="navn" autoComplete="off" required maxLength={120} aria-invalid={fieldErrors.navn ? true : undefined} aria-describedby={fieldErrors.navn ? "nu-navn-error" : undefined} />
            </Field>
            <Field label="E-mail" htmlFor="nu-email" required error={fieldErrors.email}>
              <input className="input" id="nu-email" name="email" type="email" autoComplete="off" required maxLength={254} aria-invalid={fieldErrors.email ? true : undefined} aria-describedby={fieldErrors.email ? "nu-email-error" : undefined} />
            </Field>
            <Field label="Rolle" htmlFor="nu-rolle" required error={fieldErrors.roleId}>
              <select className="input" id="nu-rolle" name="roleId" required defaultValue="" aria-invalid={fieldErrors.roleId ? true : undefined} aria-describedby={fieldErrors.roleId ? "nu-rolle-error" : undefined}>
                <option value="" disabled>Vælg rolle…</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.navn}</option>)}
              </select>
            </Field>
            <div><button className="btn btn-primary" type="submit" disabled={pending}><UserPlus size={14} aria-hidden="true" /> {pending ? "Arbejder…" : "Opret og vis adgangskode"}</button></div>
            <p className="help-text">Systemet laver en midlertidig adgangskode, som vises én gang. Brugeren skal vælge en ny ved første login.</p>
          </form>
        </Card>
      </div>

      <Dialog
        open={accessFor !== null}
        onClose={() => setAccessFor(null)}
        title={accessFor ? `Adgang til byer for ${accessFor.user.navn}` : "Adgang til byer"}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAccessFor(null)}>Annullér</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => {
                const ask = accessFor;
                setAccessFor(null);
                if (ask) run(async () => {
                  const res = await setUserInstanceAccessAction(ask.user.id, ask.selected);
                  return { ok: res.ok, message: res.message };
                });
              }}
            >
              Gem adgang
            </button>
          </>
        }
      >
        <p className="ui-dialog-message">Brugerens rolle gælder i alle valgte byer. Du kan kun give eller fjerne adgang til byer, du selv har adgang til. Hjemmebyen kan ikke fjernes.</p>
        <fieldset className="ui-stack">
          <legend className="sr-only">Byer</legend>
          {instances.map((i) => {
            const home = i.id === activeInstansId;
            const checked = home || (accessFor?.selected.includes(i.id) ?? false);
            return (
              <label key={i.id} className="user-access-option">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={home}
                  onChange={(e) => setAccessFor((cur) => (cur ? { ...cur, selected: e.target.checked ? [...cur.selected, i.id] : cur.selected.filter((x) => x !== i.id) } : cur))}
                />
                <span>{i.navn}{home ? " (hjemby)" : ""}</span>
              </label>
            );
          })}
        </fieldset>
      </Dialog>

      <Dialog
        open={confirmAsk !== null}
        onClose={() => setConfirmAsk(null)}
        title="Bekræft handling"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmAsk(null)}>Annullér</button>
            <button type="button" className="btn btn-danger" onClick={() => { const ask = confirmAsk; setConfirmAsk(null); if (ask) run(ask.task); }}>{confirmAsk?.label}</button>
          </>
        }
      >
        <p className="ui-dialog-message">{confirmAsk?.question}</p>
      </Dialog>
    </div>
  );
}
