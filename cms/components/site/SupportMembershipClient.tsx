"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Heart,
  Newspaper,
  Users,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Coins,
  BadgePercent,
} from "lucide-react";

interface SupportMembershipClientProps {
  siteNavn: string;
  kommuneNavn: string;
}

export function SupportMembershipClient({
  siteNavn,
  kommuneNavn,
}: SupportMembershipClientProps) {
  // Støttetype: "fast" (faste pakker) vs "valgfri" (valgfrit beløb)
  const [supportType, setSupportType] = useState<"fast" | "valgfri">("fast");
  
  // Faste pakker
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<"stotte" | "plus" | "helt">("plus");

  // Valgfrit beløb
  const [customFrequency, setCustomFrequency] = useState<"monthly" | "once">("monthly");
  const [customAmount, setCustomAmount] = useState<number>(50);
  const [customInput, setCustomInput] = useState<string>("50");

  const [completed, setCompleted] = useState(false);

  const plans = [
    {
      id: "stotte" as const,
      name: "Støtte",
      priceMonthly: 49,
      priceYearly: 470,
      desc: "For dig, der vil bakke op om lokalavisen i hverdagen.",
    },
    {
      id: "plus" as const,
      name: "Plus",
      priceMonthly: 79,
      priceYearly: 758,
      badge: "Mest populær",
      desc: "Fuld adgang til alle dybdegående artikler, podcasts og arkiv.",
    },
    {
      id: "helt" as const,
      name: "Lokal helt",
      priceMonthly: 129,
      priceYearly: 1238,
      desc: "En ekstra håndsrækning, der finansierer grundig lokal dækning.",
    },
  ];

  const quickAmounts = [25, 50, 100, 200, 500];

  const currentPrice = (p: typeof plans[0]) =>
    billing === "monthly" ? `${p.priceMonthly} kr.` : `${p.priceYearly} kr.`;

  const periodText = billing === "monthly" ? "pr. måned" : "pr. år";

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(
        "local2027_supporter",
        JSON.stringify({
          type: supportType,
          plan: supportType === "fast" ? selectedPlan : "valgfri",
          amount: supportType === "fast" ? (billing === "monthly" ? plans.find(p => p.id === selectedPlan)?.priceMonthly : plans.find(p => p.id === selectedPlan)?.priceYearly) : customAmount,
          billing: supportType === "fast" ? billing : customFrequency,
          date: new Date().toISOString(),
        })
      );
    } catch {}
    setCompleted(true);
  };

  return (
    <div className="support-mock-container">
      {/* Top bar med Tilbage, brand og Hjerte */}
      <div className="support-mock-topbar">
        <Link href="/" className="support-back-btn">
          <ArrowLeft size={16} />
          <span>Tilbage</span>
        </Link>
        <span className="support-brand-name">{siteNavn}</span>
        <div className="support-heart-badge">
          <Heart size={18} fill="var(--site-accent)" color="var(--site-accent)" />
        </div>
      </div>

      {completed ? (
        <div className="support-success-card">
          <CheckCircle2 size={54} className="support-success-icon" style={{ color: "var(--site-accent)" }} />
          <h2 className="support-success-title">Velkommen som støtte for {siteNavn}!</h2>
          <p className="support-success-text">
            Tusind tak for din opbakning til {kommuneNavn}s lokaljournalistik.
            {supportType === "fast" ? (
              <> Dit medlemskab (<strong>{plans.find((p) => p.id === selectedPlan)?.name}</strong>) er nu aktivt.</>
            ) : (
              <> Dit valgfrie bidrag på <strong>{customAmount} kr.</strong> ({customFrequency === "monthly" ? "månedligt" : "engangsbeløb"}) er registreret.</>
            )}
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "24px" }}>
            <Link href="/" className="support-submit-btn" style={{ textDecoration: "none", display: "inline-block" }}>
              Gå til forsiden
            </Link>
            <button
              type="button"
              onClick={() => setCompleted(false)}
              className="support-secondary-btn"
            >
              Tilpas støtte
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Titel og manchet */}
          <div className="support-hero">
            <h1 className="support-title">Støt lokaljournalistikken</h1>
            <p className="support-lead">
              Lokalavisen skabes og finansieres i tæt samspil med lokalsamfundet.
              Med dit bidrag er du med til at sikre en stærk, levende og nærværende dækning af {kommuneNavn}.
            </p>
          </div>

          {/* Vælg støttemodel: Fast pris vs Valgfrit beløb */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              background: "var(--paper)",
              padding: "4px",
              borderRadius: "14px",
              marginBottom: "24px",
              border: "1px solid var(--line)",
            }}
          >
            <button
              type="button"
              onClick={() => setSupportType("fast")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "none",
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
                background: supportType === "fast" ? "var(--surface)" : "transparent",
                color: supportType === "fast" ? "var(--ink)" : "var(--ink-3)",
                boxShadow: supportType === "fast" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <BadgePercent size={16} style={{ color: "var(--site-accent)" }} />
              <span>Fast støttepakke</span>
            </button>

            <button
              type="button"
              onClick={() => setSupportType("valgfri")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "none",
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
                background: supportType === "valgfri" ? "var(--surface)" : "transparent",
                color: supportType === "valgfri" ? "var(--ink)" : "var(--ink-3)",
                boxShadow: supportType === "valgfri" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <Coins size={16} style={{ color: "var(--site-accent)" }} />
              <span>Valgfrit beløb</span>
            </button>
          </div>

          {/* Værdipunkter */}
          <div className="support-benefits-list">
            <div className="support-benefit-item">
              <div className="support-benefit-icon">
                <Newspaper size={18} />
              </div>
              <span className="support-benefit-text">
                Flere lokale historier, interviews og dækning fra din bydel
              </span>
            </div>

            <div className="support-benefit-item">
              <div className="support-benefit-icon">
                <Users size={18} />
              </div>
              <span className="support-benefit-text">
                Plads til borgerindlæg, foreningsliv og lokale initiativer
              </span>
            </div>

            <div className="support-benefit-item">
              <div className="support-benefit-icon">
                <ShieldCheck size={18} />
              </div>
              <span className="support-benefit-text">
                Gennemsigtig journalistik forpligtet på de presseetiske regler
              </span>
            </div>

            <div className="support-benefit-item">
              <div className="support-benefit-icon">
                <Sparkles size={18} />
              </div>
              <span className="support-benefit-text">
                Du investerer direkte i fællesskabet i {kommuneNavn}
              </span>
            </div>
          </div>

          {/* HVIS FAST PAKKE */}
          {supportType === "fast" && (
            <>
              {/* Toggle: Månedligt / Årligt */}
              <div className="support-billing-toggle-wrapper">
                <div className="support-billing-toggle">
                  <button
                    type="button"
                    className={`support-toggle-btn ${billing === "monthly" ? "is-active" : ""}`}
                    onClick={() => setBilling("monthly")}
                  >
                    Månedligt
                  </button>
                  <button
                    type="button"
                    className={`support-toggle-btn ${billing === "yearly" ? "is-active" : ""}`}
                    onClick={() => setBilling("yearly")}
                  >
                    <span>Årligt</span>
                    <span className="support-save-badge">Spar 20%</span>
                  </button>
                </div>
              </div>

              {/* 3 Priskort */}
              <div className="support-plans-grid">
                {plans.map((plan) => {
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`support-plan-card ${isSelected ? "is-selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setSelectedPlan(plan.id);
                        }
                      }}
                    >
                      <div className="support-plan-header">
                        <span className="support-plan-name">{plan.name}</span>
                        <div className={`support-radio ${isSelected ? "is-checked" : ""}`}>
                          {isSelected && <div className="support-radio-inner" />}
                        </div>
                      </div>

                      <div className="support-plan-pricing">
                        <span className="support-plan-amount">{currentPrice(plan)}</span>
                        <span className="support-plan-period">{periodText}</span>
                      </div>

                      <p className="support-plan-desc">{plan.desc}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* HVIS VALGFRIT BELØB */}
          {supportType === "valgfri" && (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "18px",
                padding: "24px 20px",
                marginBottom: "24px",
              }}
            >
              {/* Vælg Månedligt eller Engangsbeløb */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <button
                  type="button"
                  onClick={() => setCustomFrequency("monthly")}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: "10px",
                    border: customFrequency === "monthly" ? "2px solid var(--site-accent)" : "1px solid var(--line)",
                    background: customFrequency === "monthly" ? "var(--site-accent-soft)" : "var(--paper)",
                    color: customFrequency === "monthly" ? "var(--site-accent)" : "var(--ink)",
                    fontWeight: "700",
                    fontSize: "13.5px",
                    cursor: "pointer",
                  }}
                >
                  Månedligt bidrag
                </button>
                <button
                  type="button"
                  onClick={() => setCustomFrequency("once")}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: "10px",
                    border: customFrequency === "once" ? "2px solid var(--site-accent)" : "1px solid var(--line)",
                    background: customFrequency === "once" ? "var(--site-accent-soft)" : "var(--paper)",
                    color: customFrequency === "once" ? "var(--site-accent)" : "var(--ink)",
                    fontWeight: "700",
                    fontSize: "13.5px",
                    cursor: "pointer",
                  }}
                >
                  Engangsbeløb
                </button>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <span style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--ink-2)", display: "block", marginBottom: "10px" }}>
                  Vælg et beløb:
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                  {quickAmounts.map((amt) => {
                    const isSelected = customAmount === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setCustomAmount(amt);
                          setCustomInput(amt.toString());
                        }}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "9999px",
                          border: isSelected ? "2px solid var(--site-accent)" : "1px solid var(--line)",
                          background: isSelected ? "var(--site-accent)" : "var(--paper)",
                          color: isSelected ? "#ffffff" : "var(--ink)",
                          fontWeight: "700",
                          fontSize: "13.5px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {amt} kr.
                      </button>
                    );
                  })}
                </div>

                <label style={{ display: "block", fontSize: "12.5px", color: "var(--ink-3)", marginBottom: "6px" }}>
                  Eller indtast et valgfrit beløb:
                </label>
                <div style={{ position: "relative", maxWidth: "220px" }}>
                  <input
                    type="number"
                    min="10"
                    max="100000"
                    value={customInput}
                    onChange={(e) => {
                      setCustomInput(e.target.value);
                      const parsed = parseInt(e.target.value, 10);
                      if (!isNaN(parsed) && parsed > 0) {
                        setCustomAmount(parsed);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 42px 10px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid var(--line)",
                      fontSize: "16px",
                      fontWeight: "700",
                      color: "var(--ink)",
                      background: "var(--paper)",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "13.5px",
                      fontWeight: "700",
                      color: "var(--ink-3)",
                    }}
                  >
                    kr.
                  </span>
                </div>
              </div>

              <p style={{ fontSize: "12.5px", color: "var(--ink-3)", margin: 0 }}>
                Hver en krone går ubeskåret til at styrke lokaljournalistikken i {kommuneNavn}.
              </p>
            </div>
          )}

          {/* CTA Knap */}
          <div className="support-action-area">
            <button
              type="button"
              onClick={handleSubscribe}
              className="support-submit-btn"
            >
              {supportType === "fast"
                ? `Støt med ${plans.find((p) => p.id === selectedPlan)?.name} (${currentPrice(plans.find((p) => p.id === selectedPlan)!)})`
                : `Støt med ${customAmount} kr. ${customFrequency === "monthly" ? "pr. måned" : "(engang)"}`}
            </button>
            <p className="support-fineprint">
              Ingen binding. Du kan til enhver tid stoppe eller ændre din støtte.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

