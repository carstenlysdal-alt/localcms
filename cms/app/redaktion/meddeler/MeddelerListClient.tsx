"use client";

import { useState } from "react";
import Link from "next/link";
import { Radio, Users, Copy, Check, FilePlus, ExternalLink } from "lucide-react";
import { convertMeddelerSagToArticle } from "@/app/redaktion/indbakke/actions";

interface MeddelerItem {
  id: string;
  token: string;
  navn: string;
  kontakt: string;
  phone: string | null;
  organisation: string | null;
  kategori: string;
  omraader: string | null;
  createdAt: Date;
  _count: { sager: number };
}

interface SagItem {
  id: string;
  titel: string;
  kategori: string;
  status: string;
  tekst: string;
  createdAt: Date;
  articleId: string | null;
  article?: { id: string; titel: string; status: string } | null;
  meddeler: {
    navn: string;
    organisation: string | null;
    kontakt: string;
  };
}

interface MeddelerListClientProps {
  meddelere: MeddelerItem[];
  sager: SagItem[];
}

export function MeddelerListClient({ meddelere, sager }: MeddelerListClientProps) {
  const [activeTab, setActiveTab] = useState<"sager" | "profiler">("sager");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/meddeler/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleConvert = async (sagId: string) => {
    setConvertingId(sagId);
    const res = await convertMeddelerSagToArticle(sagId);
    setConvertingId(null);
    if (!res.success) {
      alert(res.error || "Kunne ikke oprette artikel.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("sager")}
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius-pill)",
            fontSize: "13px",
            fontWeight: activeTab === "sager" ? "700" : "500",
            background: activeTab === "sager" ? "#d97706" : "#ffffff",
            color: activeTab === "sager" ? "#ffffff" : "#1e293b",
            border: "1px solid",
            borderColor: activeTab === "sager" ? "transparent" : "#cbd5e1",
            cursor: "pointer",
          }}
        >
          Indberettede sager ({sager.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("profiler")}
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius-pill)",
            fontSize: "13px",
            fontWeight: activeTab === "profiler" ? "700" : "500",
            background: activeTab === "profiler" ? "#d97706" : "#ffffff",
            color: activeTab === "profiler" ? "#ffffff" : "#1e293b",
            border: "1px solid",
            borderColor: activeTab === "profiler" ? "transparent" : "#cbd5e1",
            cursor: "pointer",
          }}
        >
          Registrerede meddelere ({meddelere.length})
        </button>
      </div>

      {activeTab === "sager" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {sager.length === 0 ? (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "48px", textAlign: "center" }}>
              <Radio size={40} style={{ color: "#94a3b8", margin: "0 auto 12px auto" }} />
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>Ingen sager indberettet endnu.</p>
            </div>
          ) : (
            sager.map((sag) => {
              const hasArticle = !!sag.articleId || !!sag.article;
              return (
                <div
                  key={sag.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div style={{ flex: "1 1 360px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
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
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                        {new Date(sag.createdAt).toLocaleDateString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", color: "#0f172a" }}>{sag.titel}</h3>
                    <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#475569" }}>
                      Fra meddeler: <strong>{sag.meddeler.navn}</strong> {sag.meddeler.organisation ? `(${sag.meddeler.organisation})` : ""} · {sag.kategori}
                    </p>
                    <p style={{ margin: 0, fontSize: "13.5px", color: "#334155", lineHeight: "1.4" }}>
                      {sag.tekst.length > 150 ? `${sag.tekst.slice(0, 150)}...` : sag.tekst}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {hasArticle ? (
                      <Link
                        href={`/redaktion/artikler/${sag.articleId || sag.article?.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "7px 14px",
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          color: "#166534",
                          borderRadius: "6px",
                          fontSize: "12.5px",
                          fontWeight: "700",
                          textDecoration: "none",
                        }}
                      >
                        <ExternalLink size={13} />
                        <span>Åbn artikelkladde</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleConvert(sag.id)}
                        disabled={convertingId === sag.id}
                        className="btn btn-primary"
                        style={{ fontSize: "12.5px", padding: "7px 14px", background: "#d97706", borderColor: "#b45309" }}
                      >
                        <FilePlus size={13} />
                        <span>{convertingId === sag.id ? "Opretter..." : "Opret artikel"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "profiler" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {meddelere.length === 0 ? (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "48px", textAlign: "center" }}>
              <Users size={40} style={{ color: "#94a3b8", margin: "0 auto 12px auto" }} />
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>Ingen meddelere tilmeldt endnu.</p>
            </div>
          ) : (
            meddelere.map((m) => (
              <div
                key={m.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#0f172a" }}>
                    {m.navn} <span style={{ fontSize: "12px", fontWeight: "600", color: "#b45309", background: "#fef3c7", padding: "2px 8px", borderRadius: "9999px" }}>{m.kategori}</span>
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>
                    {m.organisation ? `${m.organisation} · ` : ""}{m.kontakt} {m.phone ? `· ${m.phone}` : ""} · Område: {m.omraader || "Alle"}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>{m._count.sager} sager indsendt</span>
                  {m.token && (
<button
                    type="button"
                    onClick={() => handleCopyLink(m.token)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {copiedToken === m.token ? <Check size={14} style={{ color: "#16a34a" }} /> : <Copy size={14} />}
                    <span>{copiedToken === m.token ? "Kopieret!" : "Kopier panel-link"}</span>
                  </button>
)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
