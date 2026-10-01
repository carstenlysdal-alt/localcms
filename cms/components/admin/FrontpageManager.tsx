"use client";

import { useState } from "react";
import { pinArticleToZoneAction, removePlacementAction } from "@/app/redaktion/forside/actions";
import { Pin, Trash2, Clock, Sparkles, ShieldAlert, CheckCircle2 } from "lucide-react";

interface ArticleOption {
  id: string;
  titel: string;
  indholdstype: string;
  sektionNavn: string;
}

interface PlacementItem {
  id: string;
  zone: string;
  position: number;
  udloebTid: Date | null;
  article: {
    id: string;
    titel: string;
    indholdstype: string;
    sektionNavn: string;
  };
}

interface FrontpageManagerProps {
  placements: PlacementItem[];
  availableArticles: ArticleOption[];
  algorithmicTop: {
    tophistorie: { id: string; titel: string; score: number } | null;
    sekundaere: Array<{ id: string; titel: string; score: number }>;
  };
  quota: {
    percentage: number;
    supportedCount: number;
    totalCount: number;
    kvoteloftProcent: number;
    isExceeded: boolean;
  };
}

export function FrontpageManager({
  placements,
  availableArticles,
  algorithmicTop,
  quota,
}: FrontpageManagerProps) {
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [selectedZone, setSelectedZone] = useState("top-hoved");
  const [durationHours, setDurationHours] = useState("48");
  const [searchFilter, setSearchFilter] = useState("");

  const pinnedHoved = placements.find((p) => p.zone === "top-hoved");
  const pinnedSekundaere = placements.filter((p) => p.zone === "top-sekundaer");

  const filteredArticles = availableArticles.filter((a) =>
    a.titel.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const formatRemainingTime = (date: Date | null) => {
    if (!date) return "Permanent (ingen udløbstid)";
    const d = new Date(date);
    return `Udløber ${d.toLocaleDateString("da-DK", { day: "numeric", month: "short" })} kl. ${d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Kvoteloft-advarsel (A-04) */}
      <div
        style={{
          padding: "16px 20px",
          borderRadius: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: quota.isExceeded ? "#FEF2F2" : "#F0FDF4",
          border: `1px solid ${quota.isExceeded ? "#F87171" : "#86EFAC"}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {quota.isExceeded ? (
            <ShieldAlert size={24} style={{ color: "#DC2626" }} />
          ) : (
            <CheckCircle2 size={24} style={{ color: "#16A34A" }} />
          )}
          <div>
            <strong style={{ fontSize: "1rem", color: quota.isExceeded ? "#991B1B" : "#166534" }}>
              Kvoteloft for støtte- og sponsoreret indhold: {quota.percentage}% / {quota.kvoteloftProcent}%
            </strong>
            <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: quota.isExceeded ? "#B91C1C" : "#15803D" }}>
              {quota.supportedCount} ud af {quota.totalCount} artikler de seneste 7 dage er kommercielt mærket.
              {quota.isExceeded
                ? " Loftet er overskredet! Redaktionen advares, og nyt kommercielt indhold må ikke prioriteres i topzonen."
                : " Niveauet er sundt og under mediets uafhængighedsgrænse."}
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Zoneoversigt til venstre, Fastgør-panel til højre */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "24px" }}>
        {/* Venstre spalte: Zoner på forsiden */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Zone 1: Hovedhistorie */}
          <div className="card" style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                Zone 1: Hovedhistorie (Top 1)
              </span>
              {pinnedHoved ? (
                <span className="tag tag-warn" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Pin size={12} /> Manuelt Fastgjort
                </span>
              ) : (
                <span className="tag tag-success" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Sparkles size={12} /> Dynamisk Algoritme
                </span>
              )}
            </div>

            {pinnedHoved ? (
              <div style={{ padding: "14px", background: "#fef3c7", borderRadius: "8px", border: "1px solid #fde68a" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 6px" }}>
                  {pinnedHoved.article.titel}
                </h3>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.8rem", color: "#92400e" }}>
                    <Clock size={14} />
                    <span>{formatRemainingTime(pinnedHoved.udloebTid)}</span>
                  </div>
                  <form action={removePlacementAction.bind(null, pinnedHoved.id)}>
                    <button
                      type="submit"
                      className="btn btn-secondary"
                      style={{ fontSize: "0.8rem", padding: "4px 8px", color: "#b91c1c" }}
                      title="Frigiv zone til algoritmen"
                    >
                      <Trash2 size={13} style={{ marginRight: "4px" }} /> Frigiv zone
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                <p style={{ margin: "0 0 4px", fontSize: "0.85rem", color: "#64748b" }}>
                  Ingen manuel fastgørelse. Algoritmen udvælger automatisk:
                </p>
                <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
                  {algorithmicTop.tophistorie ? algorithmicTop.tophistorie.titel : "Ingen kandidat"}
                </h4>
                {algorithmicTop.tophistorie && (
                  <span className="tag tag-success" style={{ marginTop: "6px", fontSize: "0.75rem", fontWeight: 700 }}>
                    Score: {algorithmicTop.tophistorie.score}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Zone 2: Sekundære tophistorier */}
          <div className="card" style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                Zone 2: Sekundære tophistorier (Top 2 & 3)
              </span>
              <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                {pinnedSekundaere.length} fastgjort / 2 pladser
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {pinnedSekundaere.map((p, idx) => (
                <div key={p.id} style={{ padding: "10px 14px", background: "#fef3c7", borderRadius: "8px", border: "1px solid #fde68a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#92400e" }}>Plads {idx + 2} (Fastgjort)</span>
                    <h4 style={{ margin: "2px 0 0", fontSize: "0.95rem", fontWeight: 700 }}>{p.article.titel}</h4>
                    <small style={{ color: "#92400e" }}>{formatRemainingTime(p.udloebTid)}</small>
                  </div>
                  <form action={removePlacementAction.bind(null, p.id)}>
                    <button type="submit" className="btn btn-secondary" style={{ padding: "4px 8px", color: "#b91c1c" }}>
                      <Trash2 size={13} />
                    </button>
                  </form>
                </div>
              ))}

              {/* Supplerende algoritmiske anbefalinger */}
              {Array.from({ length: Math.max(0, 2 - pinnedSekundaere.length) }).map((_, i) => {
                const alg = algorithmicTop.sekundaere[i];
                return (
                  <div key={i} style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Plads {pinnedSekundaere.length + i + 2} (Dynamisk)</span>
                    <h4 style={{ margin: "2px 0 0", fontSize: "0.95rem", fontWeight: 600 }}>
                      {alg ? alg.titel : "Ingen artikel"}
                    </h4>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Højre spalte: Fastgør artikel panel */}
        <div className="card" style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "10px", height: "fit-content" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Pin size={18} style={{ color: "#BF6415" }} />
            Fastgør Artikel til Forsiden
          </h3>

          <form action={pinArticleToZoneAction} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                Vælg Zone
              </label>
              <select
                name="zone"
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="input"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
              >
                <option value="top-hoved">Zone 1: Hovedhistorie (Top 1)</option>
                <option value="top-sekundaer">Zone 2: Sekundær tophistorie (Top 2-3)</option>
                <option value="omraade">Zone 3: Fremhævet Områdeartikel</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                Automatisk Udløb (A-03)
              </label>
              <select
                name="durationHours"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="input"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
              >
                <option value="12">12 timer (Hurtig nyhed / Dagens overblik)</option>
                <option value="24">24 timer (1 døgn)</option>
                <option value="48">48 timer (Standard)</option>
                <option value="168">7 dage (Ugens tema / Weekend)</option>
                <option value="0">Permanent (Indtil manuel fjernelse)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                Søg og Vælg Artikel *
              </label>
              <input
                type="text"
                placeholder="Filtrér artikler..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="input"
                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #ccc", marginBottom: "8px" }}
              />
              <select
                name="articleId"
                value={selectedArticleId}
                onChange={(e) => setSelectedArticleId(e.target.value)}
                required
                className="input"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", maxHeight: "160px" }}
                size={6}
              >
                {filteredArticles.map((art) => (
                  <option key={art.id} value={art.id}>
                    [{art.sektionNavn}] {art.titel} {art.indholdstype !== "Uafhængig" ? `(${art.indholdstype})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!selectedArticleId}
              className="btn btn-primary"
              style={{ padding: "10px", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
            >
              <Pin size={16} /> Fastgør på Forsiden
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
