"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { changePasswordAction, type ChangePasswordState } from "@/app/redaktion/konto/actions";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "@/lib/password-policy";

type Props = {
  email: string;
  name: string;
  /** Tvungen første-login-visning: vis forklaring og ingen "annullér". */
  forced?: boolean;
};

export function ChangePasswordForm({ email, name, forced = false }: Props) {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePasswordAction, {});
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const uid = useId();
  const ids = { current: `${uid}-current`, next: `${uid}-next`, confirm: `${uid}-confirm` };
  const strength = passwordStrength(next, { email, name, current });
  const type = visible ? "text" : "password";
  const mismatch = confirm.length > 0 && next !== confirm;
  const errors = state.errors ?? {};

  // Efter succes tømmes felterne (React gemmer aldrig adgangskoder i handlingens tilstand).
  const [handled, setHandled] = useState<ChangePasswordState | null>(null);
  if (state.ok && handled !== state) {
    setHandled(state);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  function fieldProps(key: "current" | "next" | "confirm", extraDescribedBy?: string) {
    const hasError = Boolean(errors[key]?.length);
    const describedBy = [hasError ? `${ids[key]}-error` : null, extraDescribedBy].filter(Boolean).join(" ") || undefined;
    return { "aria-invalid": hasError || undefined, "aria-describedby": describedBy };
  }

  return (
    <form action={action} className="card elev-sm account-card" noValidate>
      <div className="card-kicker">{forced ? "Første login" : "Sikkerhed"}</div>
      <h2 className="card-title">{forced ? "Vælg en ny adgangskode" : "Skift adgangskode"}</h2>
      {forced && (
        <p className="card-body" style={{ flex: "none" }}>
          Du er logget ind med en midlertidig adgangskode. Vælg en ny, som kun du kender, før du kan bruge redaktionen.
        </p>
      )}

      {state.ok && state.message && (
        <p className="notice-success" role="status">
          {state.message} {state.relogin && <Link href="/login">Gå til log ind</Link>}
        </p>
      )}
      {!state.ok && state.message && <p className="error-text" role="alert">{state.message}</p>}

      <div className="field">
        <label htmlFor={ids.current}>Nuværende adgangskode</label>
        <input className="input" id={ids.current} name="current" type={type} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required maxLength={200} {...fieldProps("current")} />
        {errors.current?.map((m) => <p key={m} className="error-text" id={`${ids.current}-error`}>{m}</p>)}
      </div>

      <div className="field">
        <label htmlFor={ids.next}>Ny adgangskode</label>
        <input className="input" id={ids.next} name="next" type={type} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required maxLength={200} {...fieldProps("next", `${ids.next}-hint`)} />
        <div className="pw-strength" id={`${ids.next}-hint`}>
          <div className="pw-strength-bar" aria-hidden="true">
            {[1, 2, 3].map((n) => <span key={n} className={strength.score >= n ? `pw-strength-seg pw-strength-${strength.score}` : "pw-strength-seg"} />)}
          </div>
          <p className="help-text" aria-live="polite">
            {strength.label ? <strong>{strength.label}. </strong> : null}{strength.hint}
          </p>
        </div>
        {errors.next && (
          <ul className="error-text pw-errors" id={`${ids.next}-error`}>
            {errors.next.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}
      </div>

      <div className="field">
        <label htmlFor={ids.confirm}>Gentag ny adgangskode</label>
        <input className="input" id={ids.confirm} name="confirm" type={type} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required maxLength={200} {...fieldProps("confirm")} aria-invalid={mismatch || Boolean(errors.confirm) || undefined} />
        {mismatch && !errors.confirm && <p className="help-text" aria-live="polite">De to adgangskoder er ikke ens endnu.</p>}
        {errors.confirm?.map((m) => <p key={m} className="error-text" id={`${ids.confirm}-error`}>{m}</p>)}
      </div>

      <div className="row">
        <button type="button" className="btn btn-secondary" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
          {visible ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          {visible ? "Skjul adgangskoder" : "Vis adgangskoder"}
        </button>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          <KeyRound size={14} aria-hidden="true" /> {pending ? "Skifter…" : "Skift adgangskode"}
        </button>
      </div>
      <p className="help-text">Mindst {MIN_PASSWORD_LENGTH} tegn. Må ikke være din e-mail, dit navn eller en almindelig adgangskode.</p>
    </form>
  );
}
