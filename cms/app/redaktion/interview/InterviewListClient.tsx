"use client";

import { useState } from "react";
import Link from "next/link";
import { Mic, Copy, Check, FilePlus, ExternalLink } from "lucide-react";
import { convertInterviewToArticle } from "@/app/redaktion/indbakke/actions";

interface InterviewItem {
  id: string;
  token: string;
  titel: string;
  emne: string;
  kildeNavn: string;
  kildeKontakt: string;
  kildeRolle: string | null;
  status: string;
  createdAt: Date;
  articleId: string | null;
  article?: { id: string; titel: string; status: string } | null;
}

export function InterviewListClient({ interviews }: { interviews: InterviewItem[] }) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/interview/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleConvert = async (interviewId: string) => {
    setConvertingId(interviewId);
    const res = await convertInterviewToArticle(interviewId);
    setConvertingId(null);
    if (!res.success) {
      alert(res.error || "Kunne ikke oprette artikel.");
    }
  };

  if (interviews.length === 0) {
    return (
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "48px", textAlign: "center" }}>
        <Mic size={40} style={{ color: "#94a3b8", margin: "0 auto 12px auto" }} />
        <h3 style={{ margin: "0 0 6px 0", fontSize: "18px" }}>Ingen AI-interviews endnu</h3>
        <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
          Kilder kan starte et interview via den offentlige portal på <Link href="/interview" style={{ color: "#7c3aed" }}>/interview</Link>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {interviews.map((item) => {
        const hasArticle = !!item.articleId || !!item.article;
        return (
          <div
            key={item.id}
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
                    background: item.status === "GENNEMFOERT" ? "#ede9fe" : item.status === "ArtikelOprettet" ? "#dcfce7" : "#fef3c7",
                    color: item.status === "GENNEMFOERT" ? "#5b21b6" : item.status === "ArtikelOprettet" ? "#166534" : "#92400e",
                  }}
                >
                  {item.status === "ArtikelOprettet" ? "Artikel oprettet" : item.status}
                </span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                  {new Date(item.createdAt).toLocaleDateString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", color: "#0f172a" }}>{item.titel}</h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#475569" }}>
                Kilde: <strong>{item.kildeNavn}</strong> {item.kildeRolle ? `(${item.kildeRolle})` : ""} · {item.kildeKontakt}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => handleCopyLink(item.token)}
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
                {copiedToken === item.token ? <Check size={14} style={{ color: "#16a34a" }} /> : <Copy size={14} />}
                <span>{copiedToken === item.token ? "Kopieret!" : "Kopier kildelink"}</span>
              </button>

              {hasArticle ? (
                <Link
                  href={`/redaktion/artikler/${item.articleId || item.article?.id}`}
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
                  onClick={() => handleConvert(item.id)}
                  disabled={convertingId === item.id}
                  className="btn btn-primary"
                  style={{ fontSize: "12.5px", padding: "7px 14px", background: "#7c3aed", borderColor: "#6d28d9" }}
                >
                  <FilePlus size={13} />
                  <span>{convertingId === item.id ? "Opretter..." : "Opret artikel"}</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
