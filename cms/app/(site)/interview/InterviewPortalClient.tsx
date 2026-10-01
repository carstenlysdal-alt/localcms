"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicInterview } from "@/app/actions/interview";
import { ArrowRight, KeyRound, Mic, Loader2 } from "lucide-react";

export function InterviewPortalClient({ siteNavn }: { siteNavn: string }) {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");
  const [showStartForm, setShowStartForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [kildeNavn, setKildeNavn] = useState("");
  const [kildeKontakt, setKildeKontakt] = useState("");
  const [kildeRolle, setKildeRolle] = useState("");
  const [emne, setEmne] = useState("");
  const [tema, setTema] = useState("Lokal ildsjæl");

  const handleTokenJump = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tokenInput.trim();
    if (clean) {
      router.push(`/interview/${clean}`);
    }
  };

  const handleStartInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kildeNavn || !kildeKontakt || !emne) return;

    setIsSubmitting(true);
    const res = await createPublicInterview({
      kildeNavn,
      kildeKontakt,
      kildeRolle,
      emne,
      tema,
    });

    setIsSubmitting(false);

    if (res.success && res.token) {
      router.push(`/interview/${res.token}`);
    } else {
      alert(res.error || "Der opstod en fejl.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* 1. Resume token */}
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
          <KeyRound size={22} style={{ color: "#7c3aed" }} />
          <h2 style={{ margin: 0, fontSize: "19px", fontFamily: "var(--font-display)" }}>
            Har du modtaget et personligt interview-link?
          </h2>
        </div>
        <p style={{ fontSize: "14px", color: "var(--ink-2)", marginBottom: "16px", lineHeight: "1.4" }}>
          Indtast dit token her for at åbne eller genoptage dit igangværende interview:
        </p>

        <form onSubmit={handleTokenJump} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="F.eks. int-9..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            style={{
              flex: "1 1 240px",
              padding: "10px 14px",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              fontSize: "15px",
            }}
          />
          <button
            type="submit"
            disabled={!tokenInput.trim()}
            style={{
              background: "#6d28d9",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--radius-pill)",
              padding: "10px 22px",
              fontWeight: "600",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>Åbn interview</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>

      {/* 2. Start et guidet interview */}
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
              <Mic size={22} style={{ color: "#7c3aed" }} />
              <h2 style={{ margin: 0, fontSize: "19px", fontFamily: "var(--font-display)" }}>
                Start et guidet kildeinterview nu
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--ink-2)" }}>
              Vælg dit emne og gennemfør 4 hurtige spørgsmål med stemmeoptagelse eller tekst.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowStartForm(!showStartForm)}
            style={{
              padding: "8px 16px",
              background: showStartForm ? "var(--paper)" : "#ede9fe",
              color: "#5b21b6",
              border: "1px solid #ddd6fe",
              borderRadius: "var(--radius-pill)",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {showStartForm ? "Luk formular" : "Start nyt interview ↓"}
          </button>
        </div>

        {showStartForm && (
          <form onSubmit={handleStartInterview} style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                  Dit fulde navn *
                </label>
                <input
                  type="text"
                  required
                  placeholder="F.eks. Anders Jensen"
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
                  placeholder="F.eks. anders@firma.dk"
                  value={kildeKontakt}
                  onChange={(e) => setKildeKontakt(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                  Din rolle eller organisation
                </label>
                <input
                  type="text"
                  placeholder="F.eks. Butiksejer eller Kasserer i spejderne"
                  value={kildeRolle}
                  onChange={(e) => setKildeRolle(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                  Fokusområde / Tema
                </label>
                <select
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--surface)" }}
                >
                  <option value="Lokal ildsjæl">Lokal ildsjæl & Foreningsliv</option>
                  <option value="Lokalt erhverv">Lokalt erhverv & Detailhandel</option>
                  <option value="Kultur & Kunst">Kultur, Musik & Teater</option>
                  <option value="Beredskab & Tryghed">Tryghed, Miljø & Beredskab</option>
                  <option value="Borgerforslag">Borgerinitiativ & Byudvikling</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                  Hvad vil du interviewes om? *
                </label>
                <input
                  type="text"
                  required
                  placeholder="F.eks. Vores nye tiltag for unge i hallen"
                  value={emne}
                  onChange={(e) => setEmne(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: "#6d28d9",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "var(--radius-pill)",
                  padding: "10px 24px",
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
                    <span>Starter interview...</span>
                  </>
                ) : (
                  <>
                    <span>Start mit interview nu</span>
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
