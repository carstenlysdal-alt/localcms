"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSponsorBrief } from "@/app/actions/sponsor";
import { Handshake, ArrowRight, Loader2, KeyRound } from "lucide-react";

export function SponsorBriefForm({ siteNavn }: { siteNavn: string }) {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formular felter
  const [partnerNavn, setPartnerNavn] = useState("");
  const [kontaktNavn, setKontaktNavn] = useState("");
  const [kontaktEmail, setKontaktEmail] = useState("");
  const [kontaktTelefon, setKontaktTelefon] = useState("");
  const [format, setFormat] = useState("Sponsoreret artikel");
  const [formaal, setFormaal] = useState("");
  const [budskab, setBudskab] = useState("");
  const [citater, setCitater] = useState("");
  const [fakta, setFakta] = useState("");

  const handleTokenJump = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      router.push(`/partner/${tokenInput.trim()}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerNavn || !kontaktNavn || !kontaktEmail || !budskab) return;

    setIsSubmitting(true);
    const res = await createSponsorBrief({
      partnerNavn,
      kontaktNavn,
      kontaktEmail,
      kontaktTelefon,
      format,
      formaal,
      budskab,
      citater,
      fakta,
    });
    setIsSubmitting(false);

    if (res.success && res.token) {
      router.push(`/partner/${res.token}`);
    } else {
      alert(res.error || "Der opstod en fejl.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* 1. Direkte adgang til eksisterende brief */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "20px 24px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <KeyRound size={18} style={{ color: "#065f46" }} />
          <h2 style={{ margin: 0, fontSize: "16px", fontFamily: "var(--font-display)" }}>
            Er du allerede partner og har modtaget et link eller en kode?
          </h2>
        </div>
        <form onSubmit={handleTokenJump} style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
          <input
            type="text"
            placeholder="Indtast partner-kode..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            style={{ flex: "1 1 220px", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "14px" }}
          />
          <button
            type="submit"
            disabled={!tokenInput.trim()}
            style={{
              background: "#065f46",
              color: "#ffffff",
              border: "none",
              padding: "9px 18px",
              borderRadius: "var(--radius-pill)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Åbn partnerportal →
          </button>
        </form>
      </div>

      {/* 2. Indsend partner-brief */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "28px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <Handshake size={22} style={{ color: "#065f46" }} />
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontFamily: "var(--font-display)" }}>
              Indsend et nyt partner-brief til redaktionen
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", color: "var(--ink-2)" }}>
              Udfyld nedenstående oplysninger. Vi kontakter dig for at aftale vinkel og faktatjek.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Virksomhed / Organisation *
              </label>
              <input
                type="text"
                required
                placeholder="F.eks. firmaets navn"
                value={partnerNavn}
                onChange={(e) => setPartnerNavn(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Kontaktperson *
              </label>
              <input
                type="text"
                required
                placeholder="F.eks. Henrik Nielsen"
                value={kontaktNavn}
                onChange={(e) => setKontaktNavn(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                E-mailadresse *
              </label>
              <input
                type="email"
                required
                placeholder="F.eks. henrik@energi.dk"
                value={kontaktEmail}
                onChange={(e) => setKontaktEmail(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Telefonnummer (valgfri)
              </label>
              <input
                type="tel"
                placeholder="F.eks. +45 20 12 34 56"
                value={kontaktTelefon}
                onChange={(e) => setKontaktTelefon(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Ønsket format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--surface)" }}
              >
                <option value="Sponsoreret artikel">Sponsoreret artikel (dybdegående profil)</option>
                <option value="Fyrtårnspartnerskab">Fyrtårnspartnerskab (helårig pakke)</option>
                <option value="Native Tema">Temaartikel (Erhverv, Grøn omstilling m.m.)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Overordnet formål med artiklen
              </label>
              <input
                type="text"
                placeholder="F.eks. Rekruttering af lærlinge eller jubilæum"
                value={formaal}
                onChange={(e) => setFormaal(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
              Nøglebudskaber og vinkel *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Beskriv de vigtigste budskaber, I gerne vil have formidlet..."
              value={budskab}
              onChange={(e) => setBudskab(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "6px", fontFamily: "inherit" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Foreslåede citater fra jer
              </label>
              <textarea
                rows={3}
                placeholder="Hvad vil ledelsen eller nøglepersoner sige? (Ét citat pr. linje)"
                value={citater}
                onChange={(e) => setCitater(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "6px", fontFamily: "inherit" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Fakta, tal og milepæle
              </label>
              <textarea
                rows={3}
                placeholder="Antal medarbejdere, grundlæggelsesår, vigtige certifikater..."
                value={fakta}
                onChange={(e) => setFakta(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "6px", fontFamily: "inherit" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: "#065f46",
                color: "#ffffff",
                border: "none",
                borderRadius: "var(--radius-pill)",
                padding: "11px 26px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Sender brief...</span>
                </>
              ) : (
                <>
                  <span>Indsend brief & åbn partnerpanel</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
