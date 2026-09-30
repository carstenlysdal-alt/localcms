"use client";

import { useState } from "react";
import Link from "next/link";
import { Handshake, Copy, Check, FilePlus, ExternalLink } from "lucide-react";
import { convertSponsorBriefToArticle } from "@/app/redaktion/indbakke/actions";

interface SponsorItem {
  id: string;
  token: string;
  partnerNavn: string;
  kontaktNavn: string;
  kontaktEmail: string;
  format: string;
  status: string;
  createdAt: Date;
  articleId: string | null;
  article?: { id: string; titel: string; status: string } | null;
}

export function SponsorListClient({ briefs }: { briefs: SponsorItem[] }) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/partner/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleConvert = async (briefId: string) => {
    setConvertingId(briefId);
    const res = await convertSponsorBriefToArticle(briefId);
    setConvertingId(null);
    if (!res.success) {
      alert(res.error || "Kunne ikke oprette artikel.");
    }
  };

  if (briefs.length === 0) {
    return (
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "48px", textAlign: "center" }}>
        <Handshake size={40} style={{ color: "#94a3b8", margin: "0 auto 12px auto" }} />
        <h3 style={{ margin: "0 0 6px 0", fontSize: "18px" }}>Ingen partner-briefs endnu</h3>
        <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
          Virksomheder kan indsende briefs via <Link href="/sponsor" style={{ color: "#065f46" }}>/sponsor</Link>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {briefs.map((brief) => {
        const hasArticle = !!brief.articleId || !!brief.article;
        return (
          <div
            key={brief.id}
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
                    background: brief.status === "Godkendt" ? "#dcfce7" : brief.status === "ArtikelOprettet" ? "#ecfdf5" : "#fef3c7",
                    color: brief.status === "Godkendt" ? "#166534" : brief.status === "ArtikelOprettet" ? "#065f46" : "#92400e",
                  }}
                >
                  {brief.status === "ArtikelOprettet" ? "Artikel oprettet" : brief.status}
                </span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                  {new Date(brief.createdAt).toLocaleDateString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", color: "#0f172a" }}>
                {brief.partnerNavn} <span style={{ fontSize: "13px", fontWeight: "400", color: "#64748b" }}>({brief.format})</span>
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#475569" }}>
                Kontakt: <strong>{brief.kontaktNavn}</strong> ({brief.kontaktEmail})
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => handleCopyLink(brief.token)}
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
                {copiedToken === brief.token ? <Check size={14} style={{ color: "#16a34a" }} /> : <Copy size={14} />}
                <span>{copiedToken === brief.token ? "Kopieret!" : "Kopier partnerlink"}</span>
              </button>

              {hasArticle ? (
                <Link
                  href={`/redaktion/artikler/${brief.articleId || brief.article?.id}`}
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
                  <span>Åbn partnerartikel</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => handleConvert(brief.id)}
                  disabled={convertingId === brief.id}
                  className="btn btn-primary"
                  style={{ fontSize: "12.5px", padding: "7px 14px", background: "#065f46", borderColor: "#047857" }}
                >
                  <FilePlus size={13} />
                  <span>{convertingId === brief.id ? "Opretter..." : "Opret partnerartikel"}</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
