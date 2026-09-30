"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerMeddeler } from "@/app/actions/meddeler";
import { Radio, ArrowRight, Loader2, KeyRound, Check } from "lucide-react";

export function MeddelerPortalClient({ kommuneNavn }: { kommuneNavn: string }) {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");
  const [storedToken, setStoredToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formular felter
  const [navn, setNavn] = useState("");
  const [kontakt, setKontakt] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [kategori, setKategori] = useState("Sport");
  const [omraader, setOmraader] = useState(kommuneNavn);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("local2027_meddeler_token");
      if (saved) setStoredToken(saved);
    } catch {
      // Intet i private mode
    }
  }, []);

  const handleTokenJump = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tokenInput.trim();
    if (clean) {
      try {
        localStorage.setItem("local2027_meddeler_token", clean);
      } catch {}
      router.push(`/meddeler/${clean}`);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navn || !kontakt || !kategori) return;

    setIsSubmitting(true);
    const res = await registerMeddeler({
      navn,
      kontakt,
      phone,
      organisation,
      kategori,
      omraader,
    });
    setIsSubmitting(false);

    if (res.success && res.token) {
      try {
        localStorage.setItem("local2027_meddeler_token", res.token);
      } catch {}
      router.push(`/meddeler/${res.token}`);
    } else {
      alert(res.error || "Der opstod en fejl under tilmeldingen.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Gemt token genvej */}
      {storedToken && (
        <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "var(--radius-card)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <strong style={{ color: "#92400e", fontSize: "14px", display: "block" }}>
              Velkommen tilbage! Vi har fundet din meddelerprofil på denne enhed.
            </strong>
            <span style={{ fontSize: "12.5px", color: "#b45309" }}>Klik for at gå direkte til dit personlige indberetningspanel.</span>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/meddeler/${storedToken}`)}
            style={{
              background: "#d97706",
              color: "#ffffff",
              border: "none",
              padding: "8px 18px",
              borderRadius: "var(--radius-pill)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Åbn mit panel →
          </button>
        </div>
      )}

      {/* 1. Direkte token indtastning */}
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
          <KeyRound size={18} style={{ color: "#d97706" }} />
          <h2 style={{ margin: 0, fontSize: "16px", fontFamily: "var(--font-display)" }}>
            Er du allerede oprettet som meddeler?
          </h2>
        </div>
        <form onSubmit={handleTokenJump} style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
          <input
            type="text"
            placeholder="Indtast din personlige meddeler-kode..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            style={{ flex: "1 1 220px", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "14px" }}
          />
          <button
            type="submit"
            disabled={!tokenInput.trim()}
            style={{
              background: "#d97706",
              color: "#ffffff",
              border: "none",
              padding: "9px 18px",
              borderRadius: "var(--radius-pill)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Log ind →
          </button>
        </form>
      </div>

      {/* 2. Tilmeldingsformular */}
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
          <Radio size={22} style={{ color: "#d97706" }} />
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontFamily: "var(--font-display)" }}>
              Tilmeld dig som lokal meddeler
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", color: "var(--ink-2)" }}>
              Det tager 30 sekunder. Du får straks et personligt link og kan indsende sager direkte til journalisterne.
            </p>
          </div>
        </div>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Dit navn *
              </label>
              <input
                type="text"
                required
                placeholder="F.eks. Peter Madsen"
                value={navn}
                onChange={(e) => setNavn(e.target.value)}
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
                placeholder="F.eks. peter@boldklub.dk"
                value={kontakt}
                onChange={(e) => setKontakt(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Mobilnummer (til hastebeskeder)
              </label>
              <input
                type="tel"
                placeholder="F.eks. +45 30 40 50 60"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Kategori *
              </label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--surface)" }}
              >
                <option value="Sport">Sport (fodbold, håndbold, motorsport m.m.)</option>
                <option value="Foreningsliv">Foreningsliv & Kultur</option>
                <option value="Beredskab">Beredskab, Vej & Trafik</option>
                <option value="Bylaug">Landsbyer, Opland & Bylaug</option>
                <option value="Lokalpolitik">Lokalråd & Borgerinitiativer</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Klub, forening eller organisation (valgfri)
              </label>
              <input
                type="text"
                placeholder="F.eks. Korsør Svømmeklub eller Slots Bjergby Bylaug"
                value={organisation}
                onChange={(e) => setOrganisation(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Geografisk dækningsområde
              </label>
              <input
                type="text"
                placeholder="F.eks. Skælskør, Dalmose eller hele kommunen"
                value={omraader}
                onChange={(e) => setOmraader(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: "#d97706",
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
                  <span>Opretter profil...</span>
                </>
              ) : (
                <>
                  <span>Tilmeld & gå til meddelerpanel</span>
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
