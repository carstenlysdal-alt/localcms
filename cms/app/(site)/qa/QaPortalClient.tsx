"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicQaInquiry } from "@/app/actions/qa";
import { ArrowRight, KeyRound, MessageSquarePlus, Loader2 } from "lucide-react";

export function QaPortalClient({ siteNavn }: { siteNavn: string }) {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInquiryForm, setShowInquiryForm] = useState(false);

  // Formular state
  const [kildeNavn, setKildeNavn] = useState("");
  const [kildeKontakt, setKildeKontakt] = useState("");
  const [kildeRolle, setKildeRolle] = useState("");
  const [emne, setEmne] = useState("");
  const [baggrund, setBaggrund] = useState("");
  const [udtalelse, setUdtalelse] = useState("");

  const handleTokenJump = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = tokenInput.trim();
    if (cleanToken) {
      router.push(`/qa/${cleanToken}`);
    }
  };

  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kildeNavn || !kildeKontakt || !emne) return;

    setIsSubmitting(true);
    const res = await createPublicQaInquiry({
      kildeNavn,
      kildeKontakt,
      kildeRolle,
      emne,
      baggrund,
      udtalelse,
    });

    setIsSubmitting(false);

    if (res.success && res.token) {
      router.push(`/qa/${res.token}`);
    } else {
      alert(res.error || "Der opstod en fejl. Prøv igen.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* 1. Direkte token indtastning */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "24px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <KeyRound size={22} style={{ color: "var(--site-accent)" }} />
          <h2 style={{ margin: 0, fontSize: "19px", fontFamily: "var(--font-display)" }}>
            Har du modtaget en kode eller et link fra journalisten?
          </h2>
        </div>
        <p style={{ fontSize: "14px", color: "var(--ink-2)", marginBottom: "16px", lineHeight: "1.4" }}>
          Indtast kilde-koden eller tokenet herunder for at gå direkte til din personlige svarside:
        </p>

        <form onSubmit={handleTokenJump} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="F.eks. cly9..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            style={{
              flex: "1 1 240px",
              padding: "10px 14px",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              fontSize: "15px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!tokenInput.trim()}
            className="ai-toolbar-pill-btn"
            style={{ border: "none", cursor: "pointer", fontSize: "14px", padding: "10px 20px" }}
          >
            <span>Åbn svarside</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>

      {/* 2. Opret kildeforespørgsel / indsend udtalelse */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "24px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <MessageSquarePlus size={22} style={{ color: "var(--site-accent)" }} />
              <h2 style={{ margin: 0, fontSize: "19px", fontFamily: "var(--font-display)" }}>
                Vil du udtale dig eller sende et kilde-input?
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--ink-2)" }}>
              Repræsentant for forening, virksomhed eller beredskab? Indsend dit emne og udtalelse her.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowInquiryForm(!showInquiryForm)}
            style={{
              padding: "8px 16px",
              background: showInquiryForm ? "var(--paper)" : "var(--site-accent-soft)",
              color: "var(--site-accent-strong)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-pill)",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {showInquiryForm ? "Luk formular" : "Start kildehenvendelse ↓"}
          </button>
        </div>

        {showInquiryForm && (
          <form onSubmit={handleCreateInquiry} style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                  Dit fulde navn *
                </label>
                <input
                  type="text"
                  required
                  placeholder="F.eks. Lene Hansen"
                  value={kildeNavn}
                  onChange={(e) => setKildeNavn(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                  E-mail eller telefon *
                </label>
                <input
                  type="text"
                  required
                  placeholder="F.eks. lene@forening.dk"
                  value={kildeKontakt}
                  onChange={(e) => setKildeKontakt(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                  Rolle eller organisation
                </label>
                <input
                  type="text"
                  placeholder="F.eks. Formand for det lokale børneteater"
                  value={kildeRolle}
                  onChange={(e) => setKildeRolle(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Hvad drejer din henvendelse sig om? (Emne) *
              </label>
              <input
                type="text"
                required
                placeholder="F.eks. Renovering af det lokale klubhus og nye åbningstider"
                value={emne}
                onChange={(e) => setEmne(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Din skriftlige udtalelse (valgfri nu, kan også udfyldes bagefter)
              </label>
              <textarea
                rows={4}
                placeholder="Skriv dine vigtigste pointer og citater her..."
                value={udtalelse}
                onChange={(e) => setUdtalelse(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px", fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="ai-toolbar-pill-btn"
                style={{ border: "none", cursor: "pointer", fontSize: "14px", padding: "10px 24px" }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Opretter...</span>
                  </>
                ) : (
                  <>
                    <span>Gå til min kilde-svarside</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
