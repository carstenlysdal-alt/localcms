"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Copy, KeyRound, UserCheck, UserPlus, UserX } from "lucide-react";
import {
  changeRoleAction,
  createUserAction,
  deactivateUserAction,
  reactivateUserAction,
  resetPasswordAction,
  type UserAdminResult,
} from "@/app/redaktion/brugere/actions";

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
};

type Secret = { name: string; email: string; password: string };

export function UserAdmin({ users, roles }: { users: UserRow[]; roles: RoleOption[] }) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [copied, setCopied] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<NonNullable<UserAdminResult["fieldErrors"]>>({});
  const [roleDraft, setRoleDraft] = useState<Record<string, string>>({});
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

  function confirmThen(question: string, task: () => Promise<UserAdminResult>) {
    if (window.confirm(question)) run(task);
  }

  return (
    <div className="stack">
      <div aria-live="polite" aria-atomic="true">
        {notice && (
          <p className={notice.ok ? "notice-success" : "error-text"} role={notice.ok ? "status" : "alert"} style={notice.ok ? undefined : { padding: "var(--space-2) 0", fontWeight: 600 }}>
            {notice.text}
          </p>
        )}
      </div>

      {secret && (
        <div className="card secret-card" ref={secretRef} tabIndex={-1} role="region" aria-label="Midlertidig adgangskode">
          <div className="card-kicker">Vises kun nu</div>
          <h2 className="card-title">Midlertidig adgangskode til {secret.name}</h2>
          <p className="card-body" style={{ flex: "none" }}>
            Giv adgangskoden til {secret.email} på en sikker måde. Den kan ikke vises igen, og brugeren skal vælge en ny ved første login.
          </p>
          <code className="secret-value" aria-label="Midlertidig adgangskode">{secret.password}</code>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={copySecret}><Copy size={14} aria-hidden="true" /> Kopiér adgangskode</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setSecret(null); setCopied(false); }}>Jeg har gemt den – skjul</button>
            <span className="help-text" role="status">{copied ? "Kopieret til udklipsholderen." : ""}</span>
          </div>
        </div>
      )}

      <div className="users-grid">
        <div className="table-wrap">
          <table className="table users-table">
            <caption className="sr-only">Brugere i denne redaktion</caption>
            <thead>
              <tr><th scope="col">Bruger</th><th scope="col">Rolle</th><th scope="col">Status</th><th scope="col">Handlinger</th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const draft = roleDraft[u.id] ?? u.roleId;
                return (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.navn}</strong>{u.isSelf && <span className="text-muted"> (dig)</span>}
                      <small className="table-subtitle">{u.email}</small>
                    </td>
                    <td>{u.roleName}</td>
                    <td>
                      {u.deactivated ? <span className="tag tag-neutral">Deaktiveret</span> : u.mustChange ? <span className="tag tag-warn">Skal skifte kode</span> : <span className="tag tag-success">Aktiv</span>}
                    </td>
                    <td>
                      {!u.manageable ? (
                        <span className="text-muted">Har flere rettigheder end dig</span>
                      ) : (
                        <div className="user-actions">
                          <select
                            className="input"
                            aria-label={`Rolle for ${u.navn}`}
                            value={draft}
                            onChange={(e) => setRoleDraft((d) => ({ ...d, [u.id]: e.target.value }))}
                            disabled={pending}
                          >
                            {!roles.some((r) => r.id === u.roleId) && <option value={u.roleId}>{u.roleName}</option>}
                            {roles.map((r) => <option key={r.id} value={r.id}>{r.navn}</option>)}
                          </select>
                          <button type="button" className="btn btn-secondary btn-sm" disabled={pending || draft === u.roleId} onClick={() => run(() => changeRoleAction(u.id, draft), () => setRoleDraft((d) => { const { [u.id]: _removed, ...rest } = d; return rest; }))}>
                            Gem rolle<span className="sr-only"> for {u.navn}</span>
                          </button>
                          {!u.isSelf && !u.deactivated && (
                            <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => confirmThen(`Nulstil adgangskoden for ${u.navn}? Vedkommende logges ud overalt og får en ny midlertidig adgangskode.`, () => resetPasswordAction(u.id))}>
                              <KeyRound size={13} aria-hidden="true" /> Nulstil adgangskode<span className="sr-only"> for {u.navn}</span>
                            </button>
                          )}
                          {!u.isSelf && (u.deactivated ? (
                            <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => reactivateUserAction(u.id))}>
                              <UserCheck size={13} aria-hidden="true" /> Aktivér<span className="sr-only"> {u.navn}</span>
                            </button>
                          ) : (
                            <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => confirmThen(`Deaktivér ${u.navn}? Vedkommende kan ikke logge ind, og eksisterende sessioner afvises.`, () => deactivateUserAction(u.id))}>
                              <UserX size={13} aria-hidden="true" /> Deaktivér<span className="sr-only"> {u.navn}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!users.length && <div className="empty-state">Ingen brugere endnu.</div>}
        </div>

        <form
          ref={formRef}
          className="card elev-sm account-card"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(() => createUserAction(data), () => formRef.current?.reset());
          }}
        >
          <div className="card-kicker">Ny bruger</div>
          <h2 className="card-title">Opret bruger</h2>
          <div className="field">
            <label htmlFor="nu-navn">Navn</label>
            <input className="input" id="nu-navn" name="navn" autoComplete="off" required maxLength={120} aria-invalid={fieldErrors.navn ? true : undefined} aria-describedby={fieldErrors.navn ? "nu-navn-fejl" : undefined} />
            {fieldErrors.navn && <p className="error-text" id="nu-navn-fejl">{fieldErrors.navn}</p>}
          </div>
          <div className="field">
            <label htmlFor="nu-email">E-mail</label>
            <input className="input" id="nu-email" name="email" type="email" autoComplete="off" required maxLength={254} aria-invalid={fieldErrors.email ? true : undefined} aria-describedby={fieldErrors.email ? "nu-email-fejl" : undefined} />
            {fieldErrors.email && <p className="error-text" id="nu-email-fejl">{fieldErrors.email}</p>}
          </div>
          <div className="field">
            <label htmlFor="nu-rolle">Rolle</label>
            <select className="input" id="nu-rolle" name="roleId" required defaultValue="" aria-invalid={fieldErrors.roleId ? true : undefined} aria-describedby={fieldErrors.roleId ? "nu-rolle-fejl" : undefined}>
              <option value="" disabled>Vælg rolle…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.navn}</option>)}
            </select>
            {fieldErrors.roleId && <p className="error-text" id="nu-rolle-fejl">{fieldErrors.roleId}</p>}
          </div>
          <button className="btn btn-primary" type="submit" disabled={pending}><UserPlus size={14} aria-hidden="true" /> {pending ? "Arbejder…" : "Opret og vis adgangskode"}</button>
          <p className="help-text">Systemet laver en midlertidig adgangskode, som vises én gang. Brugeren skal vælge en ny ved første login.</p>
        </form>
      </div>
    </div>
  );
}
