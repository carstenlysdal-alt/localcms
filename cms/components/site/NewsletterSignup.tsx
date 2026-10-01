"use client";

import { useState } from "react";
import { Mail, Check, AlertCircle } from "lucide-react";
import { subscribeToNewsletter } from "@/app/(site)/nyhedsbrev/actions";

type NewsletterSignupProps = {
  siteNavn: string;
  sektion?: string;
  omraade?: string;
};

export function NewsletterSignup({ siteNavn, sektion, omraade }: NewsletterSignupProps) {
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

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("samtykke", "true");
      if (sektion) formData.set("sektionSlug", sektion.toLowerCase());
      if (omraade) formData.set("omraadeSlug", omraade.toLowerCase());

      const res = await subscribeToNewsletter(null, formData);
      if (res.success) {
        setStatus("success");
        setMessage(res.message);
        setEmail("");
        setSamtykke(false);
      } else {
        setStatus("error");
        setMessage(res.error);
      }
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
