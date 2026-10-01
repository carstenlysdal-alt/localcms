"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitCitizenProposal, type SubmissionActionResult } from "@/app/(site)/indsend/actions";
import { Send, CheckCircle2, AlertCircle, Shield } from "lucide-react";

type AreaOption = {
  id: string;
  navn: string;
};

type SubmissionFormProps = {
  areas: AreaOption[];
  siteNavn: string;
  siteKommune: string;
};

export function SubmissionForm({ areas, siteNavn, siteKommune }: SubmissionFormProps) {
  const [state, formAction, isPending] = useActionState<SubmissionActionResult | null, FormData>(
    submitCitizenProposal,
    null
  );

  if (state?.success) {
    return (
      <div className="site-form-success-card" role="status" aria-live="polite">
        <div className="site-form-success-icon">
          <CheckCircle2 size={32} />
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "24px", margin: "0 0 12px 0" }}>
          Tak for dit bidrag!
        </h2>
        <p style={{ fontSize: "16px", color: "var(--ink-2)", maxWidth: "540px", margin: "0 auto 24px auto", lineHeight: "1.5" }}>
          {state.message}
        </p>
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            padding: "16px 20px",
            borderRadius: "6px",
            maxWidth: "500px",
            margin: "0 auto 28px auto",
            fontSize: "14px",
            color: "var(--ink-2)",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "6px", color: "var(--ink)" }}>
            <Shield size={16} style={{ color: "var(--site-accent)" }} />
            Hvad sker der nu?
          </div>
          Vores journalister vurderer henvendelsen ud fra mediets redaktionelle principper. Hvis vi arbejder videre med historien, kontakter vi dig via de opgivne kontaktoplysninger.
        </div>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" className="site-pill is-active">
            Tilbage til forsiden
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="site-pill"
          >
            Indsend endnu et tip
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="site-form-card" noValidate>
      {/* Spam-sikring: Skjult honeypot-felt */}
      <input
        type="text"
        name="_hp_website"
        tabIndex={-1}
        autoComplete="off"
        style={{ position: "absolute", left: "-9999px", opacity: 0 }}
        aria-hidden="true"
      />

      {state?.error && (
        <div className="site-form-alert-error" role="alert">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{state.error}</span>
        </div>
      )}

      {/* Afsender-oplysninger */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
        <div className="site-form-group">
          <label htmlFor="navn" className="site-form-label">
            Dit fulde navn <span className="req">*</span>
          </label>
          <input
            id="navn"
            name="navn"
            type="text"
            required
            placeholder="Fx Mette Frederiksen"
            className="site-input"
          />
          <span className="site-form-hint">
            Navnet vises som afsender/kilde, hvis indlægget publiceres.
          </span>
        </div>

        <div className="site-form-group">
          <label htmlFor="kontakt" className="site-form-label">
            Kontakt (e-mail eller telefon) <span className="req">*</span>
          </label>
          <input
            id="kontakt"
            name="kontakt"
            type="text"
            required
            placeholder="Fx mette@eksempel.dk eller 12 34 56 78"
            className="site-input"
          />
          <span className="site-form-hint">
            Kun til redaktionens brug, hvis vi har opfølgende spørgsmål.
          </span>
        </div>
      </div>

      {/* Emne & Geografi */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
        <div className="site-form-group">
          <label htmlFor="emne" className="site-form-label">
            Emne eller overskrift <span className="req">*</span>
          </label>
          <input
            id="emne"
            name="emne"
            type="text"
            required
            placeholder="Hvad handler sagen eller historien om?"
            className="site-input"
          />
        </div>

        <div className="site-form-group">
          <label htmlFor="omraadeId" className="site-form-label">
            Lokalområde i {siteKommune}
          </label>
          <select id="omraadeId" name="omraadeId" className="site-select" defaultValue="">
            <option value="">Hele kommunen / Intet specifikt område</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.navn}
              </option>
            ))}
          </select>
          <span className="site-form-hint">
            Hjælper os med at placere historien i den rette lokaldækning.
          </span>
        </div>
      </div>

      {/* Beskrivelse / Tekst */}
      <div className="site-form-group">
        <label htmlFor="tekst" className="site-form-label">
          Beskrivelse, tip eller debattekst <span className="req">*</span>
        </label>
        <textarea
          id="tekst"
          name="tekst"
          required
          rows={6}
          placeholder="Beskriv hvad der er sket, hvem der er involveret, og hvorfor det er vigtigt for lokalsamfundet..."
          className="site-textarea"
        />
        <span className="site-form-hint">
          Skriv gerne med dine egne ord. Redaktionen læser korrektur og faktatjekker altid før publicering.
        </span>
      </div>

      {/* Billeder / Dokumentation */}
      <div className="site-form-group">
        <label htmlFor="billeder" className="site-form-label">
          Billeder eller dokumentation (valgfrit)
        </label>
        <input
          id="billeder"
          name="billeder"
          type="text"
          placeholder="Indsæt webadresse til billede eller drev (f.eks. Dropbox, iCloud eller Google Drive)"
          className="site-input"
        />
        <span className="site-form-hint">
          Har du billeder på computeren eller telefonen, kan du også sende dem direkte på e-mail til redaktionen.
        </span>
      </div>

      {/* Rettigheder og Samtykke */}
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "6px",
          padding: "18px 20px",
          marginTop: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Shield size={18} style={{ color: "var(--site-accent)" }} />
          <strong style={{ fontFamily: "var(--font-display)", fontSize: "14px", color: "var(--ink)" }}>
            Rettigheder og samtykke (Presseetik & ophavsret)
          </strong>
        </div>

        <label className="site-checkbox-group">
          <input
            type="checkbox"
            name="rettigheder"
            required
            className="site-checkbox"
          />
          <span className="site-checkbox-text">
            <strong>Ophavsret:</strong> Jeg bekræfter, at jeg selv har taget eventuelle medsendte billeder eller har fornøden tilladelse fra fotografen, og at det indsendte materiale ikke krænker andres rettigheder. <span style={{ color: "var(--site-accent)" }}>*</span>
          </span>
        </label>

        <label className="site-checkbox-group">
          <input
            type="checkbox"
            name="samtykke"
            required
            className="site-checkbox"
          />
          <span className="site-checkbox-text">
            <strong>Samtykke:</strong> Jeg giver samtykke til, at redaktionen på {siteNavn} må kontakte mig, behandle oplysningerne og evt. publicere historien/læserbrevet med mit navn som afsender. <span style={{ color: "var(--site-accent)" }}>*</span>
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
            <>Sender dit forslag...</>
          ) : (
            <>
              <Send size={16} /> Send til redaktionen
            </>
          )}
        </button>
      </div>
    </form>
  );
}
