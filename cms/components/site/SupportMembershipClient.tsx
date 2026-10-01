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
  Check,
  CheckCircle2,
} from "lucide-react";

interface SupportMembershipClientProps {
  siteNavn: string;
  kommuneNavn: string;
}

export function SupportMembershipClient({
  siteNavn,
  kommuneNavn,
}: SupportMembershipClientProps) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<"stotte" | "plus" | "helt">("stotte");
  const [completed, setCompleted] = useState(false);

  const plans = [
    {
      id: "stotte" as const,
      name: "Støtte",
      priceMonthly: 49,
      priceYearly: 470,
      desc: "For dig, der vil bakke op om den uafhængige lokalavis.",
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
      desc: "En ekstra håndsrækning, der finansierer undersøgende journalistik.",
    },
  ];

  const currentPrice = (p: typeof plans[0]) =>
    billing === "monthly" ? `${p.priceMonthly} kr.` : `${p.priceYearly} kr.`;

  const periodText = billing === "monthly" ? "pr. måned" : "pr. år";

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem("local2027_supporter", JSON.stringify({
        plan: selectedPlan,
        billing,
        date: new Date().toISOString(),
      }));
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
          <Heart size={18} fill="#BA4A28" color="#BA4A28" />
        </div>
      </div>

      {completed ? (
        <div className="support-success-card">
          <CheckCircle2 size={54} className="support-success-icon" />
          <h2 className="support-success-title">Velkommen som støtte for {siteNavn}!</h2>
          <p className="support-success-text">
            Tusind tak for din opbakning til {kommuneNavn}s uafhængige lokaljournalistik.
            Dit medlemskab ({plans.find((p) => p.id === selectedPlan)?.name}) er nu aktivt på denne enhed.
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
              Skift medlemskab
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Titel og manchet */}
          <div className="support-hero">
            <h1 className="support-title">Støt lokalt</h1>
            <p className="support-lead">
              Uafhængig journalistik findes, fordi lokale som dig bakker op.
              Med dit medlemskab er du med til at sikre grundig, kritisk og konstruktiv dækning af {kommuneNavn} – i dag og i morgen.
            </p>
          </div>

          {/* 4 værdipunkter med ikoner */}
          <div className="support-benefits-list">
            <div className="support-benefit-item">
              <div className="support-benefit-icon">
                <Newspaper size={18} />
              </div>
              <span className="support-benefit-text">
                Flere lokale nyheder og dybdegående historier
              </span>
            </div>

            <div className="support-benefit-item">
              <div className="support-benefit-icon">
                <Users size={18} />
              </div>
              <span className="support-benefit-text">
                Et stærkere lokalsamfund gennem oplysning og dialog
              </span>
            </div>

            <div className="support-benefit-item">
              <div className="support-benefit-icon">
                <ShieldCheck size={18} />
              </div>
              <span className="support-benefit-text">
                Uafhængig journalistik uden kommercielle dagsordener
              </span>
            </div>

            <div className="support-benefit-item">
              <div className="support-benefit-icon">
                <Sparkles size={18} />
              </div>
              <span className="support-benefit-text">
                Du investerer i {kommuneNavn} og de mennesker, der bor her
              </span>
            </div>
          </div>

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

          {/* CTA Knap & Fortrydelsesret */}
          <div className="support-action-area">
            <button
              type="button"
              onClick={handleSubscribe}
              className="support-submit-btn"
            >
              Bliv medlem nu
            </button>
            <p className="support-fineprint">
              Du kan altid opsige dit medlemskab. Ingen binding.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
