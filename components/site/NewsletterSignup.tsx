"use client";

import { useState } from "react";
import { Mail, Check, AlertCircle } from "lucide-react";

type NewsletterSignupProps = {
  siteNavn: string;
  sektion?: string;
};

export function NewsletterSignup({ siteNavn, sektion }: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [samtykke, setSamtykke] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!samtykke) {
      setStatus("error");
      setMessage("Du skal acceptere betingelserne for at modtage nyhedsbrevet.");
      return;
    }

    setStatus("loading");
    setMessage("");

    // Simpel tilmelding (lagres eller simuleres sikkert)
    try {
      // I en fremtidig fase kan dette kalde en API route eller server action
      await new Promise((r) => setTimeout(r, 400));
      setStatus("success");
      setMessage(
        `Tak for din tilmelding! Vi har sendt en bekræftelse til ${email}. Du kan altid afmelde dig med ét klik.`
      );
      setEmail("");
      setSamtykke(false);
    } catch {
      setStatus("error");
      setMessage("Der opstod en fejl ved tilmelding. Prøv venligst igen senere.");
    }
  }

  return (
    <section className="site-newsletter-box" aria-labelledby="newsletter-heading">
      <div className="site-newsletter-content">
        <div className="site-newsletter-header">
          <div className="site-newsletter-icon-wrap">
            <Mail size={24} />
          </div>
          <div>
            <h3 id="newsletter-heading" className="site-newsletter-title">
              {sektion ? `Få nyt om ${sektion} direkte i din indbakke` : `Følg med i ${siteNavn}`}
            </h3>
            <p className="site-newsletter-desc">
              Modtag dagens vigtigste lokale historier, analyser og debatindlæg. Ingen reklamebannere
              – kun reel lokaljournalistik.
            </p>
          </div>
        </div>

        {status === "success" ? (
          <div className="site-newsletter-success" role="status" aria-live="polite">
            <Check size={20} />
            <p>{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="site-newsletter-form">
            <div className="site-newsletter-input-group">
              <label htmlFor="newsletter-email" className="sr-only">
                Din e-mailadresse
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                placeholder="Indtast din e-mailadresse..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="site-newsletter-input"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="site-btn site-btn-primary site-newsletter-btn"
              >
                {status === "loading" ? "Tilmelder..." : "Tilmeld"}
              </button>
            </div>

            <label className="site-newsletter-consent">
              <input
                type="checkbox"
                required
                checked={samtykke}
                onChange={(e) => setSamtykke(e.target.checked)}
                className="site-newsletter-checkbox"
              />
              <span>
                Ja tak, jeg accepterer at modtage nyhedsbrevet fra {siteNavn}. Jeg kan afmelde mig til
                enhver tid.
              </span>
            </label>

            {status === "error" && (
              <div className="site-newsletter-error" role="alert" aria-live="polite">
                <AlertCircle size={16} />
                <span>{message}</span>
              </div>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
