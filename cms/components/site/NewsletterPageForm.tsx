"use client";

import { useActionState } from "react";
import Link from "next/link";
import { subscribeToNewsletter, type SubscribeActionResult } from "@/app/(site)/nyhedsbrev/actions";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";

type AreaOption = {
  slug: string;
  navn: string;
};

type SectionOption = {
  slug: string;
  navn: string;
};

type NewsletterPageFormProps = {
  siteNavn: string;
  siteKommune: string;
  areas: AreaOption[];
  sections: SectionOption[];
};

export function NewsletterPageForm({
  siteNavn,
  siteKommune,
  areas,
  sections,
}: NewsletterPageFormProps) {
  const [state, formAction, isPending] = useActionState<SubscribeActionResult | null, FormData>(
    subscribeToNewsletter,
    null
  );

  if (state?.success) {
    return (
      <div className="site-form-success-card" role="status" aria-live="polite">
        <div className="site-form-success-icon">
          <CheckCircle2 size={32} />
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "24px", margin: "0 0 12px 0" }}>
          Velkommen til!
        </h2>
        <p style={{ fontSize: "16px", color: "var(--ink-2)", maxWidth: "520px", margin: "0 auto 24px auto", lineHeight: "1.5" }}>
          {state.message}
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Link href="/" className="site-pill is-active">
            Gå til forsiden
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="site-form-card" noValidate>
      {/* Honeypot mod spam-robotter: skjult for brugere */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Lad dette felt være tomt
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {state?.error && (
        <div className="site-form-alert-error" role="alert">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{state.error}</span>
        </div>
      )}

      {/* Grundlæggende oplysninger */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
        <div className="site-form-group">
          <label htmlFor="email" className="site-form-label">
            Din e-mailadresse <span className="req">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="f.eks. navn@eksempel.dk"
            className="site-input"
          />
          <span className="site-form-hint">
            Vi videregiver aldrig din e-mail til tredjepart.
          </span>
        </div>

        <div className="site-form-group">
          <label htmlFor="navn" className="site-form-label">
            Dit navn (valgfrit)
          </label>
          <input
            id="navn"
            name="navn"
            type="text"
            placeholder="f.eks. Mette Frederiksen"
            className="site-input"
          />
          <span className="site-form-hint">
            Bruges til at personliggøre hilsenen i dit nyhedsbrev.
          </span>
        </div>
      </div>

      {/* Lokale præferencer */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
        <div className="site-form-group">
          <label htmlFor="omraadeSlug" className="site-form-label">
            Primært lokalområde
          </label>
          <select id="omraadeSlug" name="omraadeSlug" className="site-select" defaultValue="">
            <option value="">Hele {siteKommune} (Anbefalet)</option>
            {areas.map((area) => (
              <option key={area.slug} value={area.slug}>
                {area.navn}
              </option>
            ))}
          </select>
          <span className="site-form-hint">
            Giver dig særlig fokus på historier fra dit nærområde.
          </span>
        </div>

        <div className="site-form-group">
          <label htmlFor="sektionSlug" className="site-form-label">
            Særligt interesseområde
          </label>
          <select id="sektionSlug" name="sektionSlug" className="site-select" defaultValue="">
            <option value="">Alle sektioner (Blandet lokaloverblik)</option>
            {sections.map((sec) => (
              <option key={sec.slug} value={sec.slug}>
                {sec.navn}
              </option>
            ))}
          </select>
          <span className="site-form-hint">
            Prioriterer denne sektion øverst i nyhedsoversigten.
          </span>
        </div>
      </div>

      {/* Samtykke */}
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "6px",
          padding: "16px 20px",
          marginTop: "16px",
        }}
      >
        <label className="site-checkbox-group" style={{ margin: 0 }}>
          <input
            type="checkbox"
            name="samtykke"
            required
            className="site-checkbox"
          />
          <span className="site-checkbox-text">
            Ja tak, jeg vil gerne modtage {siteNavn}s lokale nyhedsbrev på e-mail. Jeg er indforstået med, at jeg til enhver tid kan framelde mig med ét enkelt klik via linket i bunden af hver e-mail. <span style={{ color: "var(--site-accent)" }}>*</span>
          </span>
        </label>
      </div>

      {/* Handlinger */}
      <div className="site-form-actions">
        <button
          type="submit"
          disabled={isPending}
          className="site-submit-btn"
        >
          {isPending ? (
            <>Tilmelder...</>
          ) : (
            <>
              <Mail size={16} /> Tilmeld nyhedsbrev
            </>
          )}
        </button>
      </div>
    </form>
  );
}
