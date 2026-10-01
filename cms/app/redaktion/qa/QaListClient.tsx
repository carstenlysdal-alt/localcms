"use client";

import { useState } from "react";
import Link from "next/link";
import { Inbox, Copy, Check, FilePlus, ExternalLink } from "lucide-react";
import { convertQaToArticle } from "@/app/redaktion/indbakke/actions";

interface QAItem {
  id: string;
  token: string;
  titel: string;
  emne: string;
  kildeNavn: string | null;
  kildeKontakt: string | null;
  kildeRolle: string | null;
  status: string;
  createdAt: Date;
  articleId: string | null;
  article?: { id: string; titel: string; status: string } | null;
}

export function QaListClient({ qas }: { qas: QAItem[] }) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/qa/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleConvert = async (qaId: string) => {
    setConvertingId(qaId);
    const res = await convertQaToArticle(qaId);
    setConvertingId(null);
    if (!res.success) {
      alert(res.error || "Kunne ikke oprette artikel.");
    }
  };

  if (qas.length === 0) {
    return (
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "48px", textAlign: "center" }}>
        <Inbox size={40} style={{ color: "#94a3b8", margin: "0 auto 12px auto" }} />
        <h3 style={{ margin: "0 0 6px 0", fontSize: "18px" }}>Ingen Kilde-Q&A endnu</h3>
        <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
          Klik på knappen ovenfor for at oprette den første Q&A-session til en kilde.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {qas.map((qa) => {
        const hasArticle = !!qa.articleId || !!qa.article;
        return (
          <div
            key={qa.id}
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
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    background: qa.status === "BESVARET" ? "#dcfce7" : qa.status === "ArtikelOprettet" ? "#e0e7ff" : "#fef3c7",
                    color: qa.status === "BESVARET" ? "#166534" : qa.status === "ArtikelOprettet" ? "#3730a3" : "#92400e",
                  }}
                >
                  {qa.status === "ArtikelOprettet" ? "Artikel oprettet" : qa.status}
                </span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                  {new Date(qa.createdAt).toLocaleDateString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", color: "#0f172a" }}>{qa.titel}</h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#475569" }}>
                Kilde: <strong>{qa.kildeNavn || "Ikke angivet"}</strong> {qa.kildeRolle ? `(${qa.kildeRolle})` : ""} · {qa.kildeKontakt || ""}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => handleCopyLink(qa.token)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                {copiedToken === qa.token ? <Check size={14} style={{ color: "#16a34a" }} /> : <Copy size={14} />}
                <span>{copiedToken === qa.token ? "Kopieret!" : "Kopier kildelink"}</span>
              </button>

              {hasArticle ? (
                <Link
                  href={`/redaktion/artikler/${qa.articleId || qa.article?.id}`}
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
                  onClick={() => handleConvert(qa.id)}
                  disabled={convertingId === qa.id}
                  className="btn btn-primary"
                  style={{ fontSize: "12.5px", padding: "7px 14px" }}
                >
                  <FilePlus size={13} />
                  <span>{convertingId === qa.id ? "Opretter..." : "Opret artikel"}</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
