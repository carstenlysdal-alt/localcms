"use client";

import { useState } from "react";
import { submitMeddelerSag } from "@/app/actions/meddeler";
import { Radio, Send, CheckCircle2, Clock, FileText, ArrowRight, Loader2 } from "lucide-react";

interface Sag {
  id: string;
  titel: string;
  kategori: string;
  status: string;
  tekst: string;
  createdAt: Date | string;
  article?: {
    id: string;
    titel: string;
    slug: string;
    status: string;
  } | null;
}

interface MeddelerDashboardClientProps {
  token: string;
  profile: {
    id: string;
    navn: string;
    kategori: string;
    omraader?: string | null;
    sager: Sag[];
  };
}

export function MeddelerDashboardClient({ token, profile }: MeddelerDashboardClientProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  // Formular
  const [titel, setTitel] = useState("");
  const [tekst, setTekst] = useState("");
  const [sted, setSted] = useState(profile.omraader || "");
  const [tidspunkt, setTidspunkt] = useState("");
  const [resultat, setResultat] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titel || !tekst) return;

    setIsSubmitting(true);
    const res = await submitMeddelerSag(token, {
      titel,
      tekst,
      sted,
      tidspunkt,
      resultat,
      kategori: profile.kategori,
    });
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg(true);
      setTitel("");
      setTekst("");
      setTidspunkt("");
      setResultat("");
    } else {
      alert(res.error || "Der opstod en fejl.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* 1. Opret ny sag / tip */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "24px 28px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <Radio size={20} style={{ color: "#d97706" }} />
          <h2 style={{ margin: 0, fontSize: "20px", fontFamily: "var(--font-display)" }}>
            Indsend ny sag eller rapport til redaktionen
          </h2>
        </div>

        {successMsg && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "14px 18px", borderRadius: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle2 size={20} style={{ color: "#16a34a" }} />
            <div>
              <strong style={{ color: "#166534", fontSize: "14px", display: "block" }}>
                Sagen er modtaget i redaktionen!
              </strong>
              <span style={{ fontSize: "12.5px", color: "#14532d" }}>
                Vores journalister gennemgår informationerne og kan oprette en artikel ud fra rapporten.
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
              Overskrift / Hvad er sket? *
            </label>
            <input
              type="text"
              required
              placeholder="F.eks. Slagelse BK vandt 3-1 i topopgør mod Næstved"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "15px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Sted / Lokation
              </label>
              <input
                type="text"
                placeholder="F.eks. Harboe Arena eller Antvorskov Skole"
                value={sted}
                onChange={(e) => setSted(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Tidspunkt
              </label>
              <input
                type="text"
                placeholder="F.eks. Lørdag kl. 14:00"
                value={tidspunkt}
                onChange={(e) => setTidspunkt(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Resultat / Nøgledata (hvis sport/møde)
              </label>
              <input
                type="text"
                placeholder="F.eks. 3-1 (pause 1-0), 450 tilskuere"
                value={resultat}
                onChange={(e) => setResultat(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
              Detaljeret beretning, referat eller tip *
            </label>
            <textarea
              rows={5}
              required
              placeholder="Beskriv forløbet, målscorere, vigtige beslutninger eller baggrund..."
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              style={{ width: "100%", padding: "12px", border: "1px solid var(--line)", borderRadius: "6px", fontFamily: "inherit" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: "#d97706",
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
                  <span>Sender sag...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Indberet sag til redaktionen</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Historik over tidligere sager */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "24px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontFamily: "var(--font-display)" }}>
          Dine tidligere indberetninger ({profile.sager.length})
        </h2>

        {profile.sager.length === 0 ? (
          <p style={{ fontSize: "14px", color: "var(--ink-3)", fontStyle: "italic", margin: 0 }}>
            Du har endnu ikke indsendt sager fra denne profil. Brug formularen ovenfor til din første sag.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {profile.sager.map((sag) => (
              <div
                key={sag.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  background: "var(--paper)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "6px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "var(--ink)" }}>{sag.titel}</h3>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      background: sag.status === "ArtikelOprettet" ? "#dcfce7" : "#fef3c7",
                      color: sag.status === "ArtikelOprettet" ? "#166534" : "#92400e",
                    }}
                  >
                    {sag.status === "ArtikelOprettet" ? "Artikel oprettet" : sag.status}
                  </span>
                </div>
                <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
                  {sag.tekst.length > 180 ? `${sag.tekst.slice(0, 180)}...` : sag.tekst}
                </p>
                <div style={{ fontSize: "11px", color: "var(--ink-3)" }}>
                  Indberettet: {new Date(sag.createdAt).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
