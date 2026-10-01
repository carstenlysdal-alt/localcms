"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Inbox,
  Mic,
  Handshake,
  Radio,
  MessageSquare,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FilePlus,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import {
  convertQaToArticle,
  convertInterviewToArticle,
  convertSponsorBriefToArticle,
  convertMeddelerSagToArticle,
  convertSubmissionToArticle,
} from "@/app/redaktion/indbakke/actions";
import { isNewIntakeStatus } from "@/lib/validation/status";

export type IntakeItem = {
  id: string;
  channel: "qa" | "interview" | "sponsor" | "meddeler" | "submission";
  title: string;
  senderName: string;
  senderContact?: string | null;
  senderRole?: string | null;
  status: string;
  createdAt: Date | string;
  summary?: string | null;
  token?: string;
  articleId?: string | null;
  article?: {
    id: string;
    titel: string;
    slug: string;
    status: string;
  } | null;
  details?: Record<string, unknown>;
};

interface UnifiedIntakeInboxProps {
  items: IntakeItem[];
}

export function UnifiedIntakeInbox({ items }: UnifiedIntakeInboxProps) {
  const [activeChannel, setActiveChannel] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string } | null>(null);

  const channels = [
    { key: "all", label: "Alle kanaler", count: items.length },
    { key: "qa", label: "Kilde-Q&A", icon: Inbox, count: items.filter((i) => i.channel === "qa").length },
    { key: "interview", label: "AI-Interview", icon: Mic, count: items.filter((i) => i.channel === "interview").length },
    { key: "sponsor", label: "Sponsor & Briefs", icon: Handshake, count: items.filter((i) => i.channel === "sponsor").length },
    { key: "meddeler", label: "Meddeler-sager", icon: Radio, count: items.filter((i) => i.channel === "meddeler").length },
    { key: "submission", label: "Borgerindlæg", icon: MessageSquare, count: items.filter((i) => i.channel === "submission").length },
  ];

  const filteredItems = items.filter((i) => {
    if (activeChannel !== "all" && i.channel !== activeChannel) return false;
    return true;
  });

  const handleCopyLink = (token: string, channel: string) => {
    let url = "";
    if (channel === "qa") url = `${window.location.origin}/qa/${token}`;
    if (channel === "interview") url = `${window.location.origin}/interview/${token}`;
    if (channel === "sponsor") url = `${window.location.origin}/partner/${token}`;
    if (channel === "meddeler") url = `${window.location.origin}/meddeler/${token}`;

    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2500);
    }
  };

  const handleConvert = (item: IntakeItem) => {
    setLoadingItemId(item.id);
    startTransition(async () => {
      let res: { success: boolean; articleId?: string; message?: string; error?: string } = { success: false };

      if (item.channel === "qa") res = await convertQaToArticle(item.id);
      if (item.channel === "interview") res = await convertInterviewToArticle(item.id);
      if (item.channel === "sponsor") res = await convertSponsorBriefToArticle(item.id);
      if (item.channel === "meddeler") res = await convertMeddelerSagToArticle(item.id);
      if (item.channel === "submission") res = await convertSubmissionToArticle(item.id);

      setLoadingItemId(null);

      if (res.success) {
        setActionMessage({
          id: item.id,
          text: res.message || "Artikel oprettet som kladde!",
        });
      } else {
        alert(res.error || "Kunne ikke oprette artikel.");
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Kanal filter-tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid var(--color-border, #e2e8f0)", paddingBottom: "12px" }}>
        {channels.map((ch) => {
          const isActive = activeChannel === ch.key;
          const Icon = ch.icon;
          return (
            <button
              key={ch.key}
              type="button"
              onClick={() => setActiveChannel(ch.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "var(--radius-pill, 9999px)",
                fontSize: "13px",
                fontWeight: isActive ? "700" : "500",
                background: isActive ? "var(--color-primary, #9E3D1B)" : "var(--color-surface, #ffffff)",
                color: isActive ? "#ffffff" : "var(--color-text, #1e293b)",
                border: "1px solid",
                borderColor: isActive ? "transparent" : "var(--color-border, #cbd5e1)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {Icon && <Icon size={14} />}
              <span>{ch.label}</span>
              <span
                style={{
                  background: isActive ? "rgba(255, 255, 255, 0.25)" : "#f1f5f9",
                  color: isActive ? "#ffffff" : "#475569",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: "700",
                }}
              >
                {ch.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Liste over indkomne henvendelser */}
      {filteredItems.length === 0 ? (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "48px 24px", textAlign: "center" }}>
          <Inbox size={36} style={{ color: "#94a3b8", margin: "0 auto 12px auto" }} />
          <p style={{ margin: 0, fontSize: "15px", color: "#64748b" }}>Ingen henvendelser fundet i denne kanal.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredItems.map((item) => {
            const isExpanded = expandedId === item.id;
            const isConverting = loadingItemId === item.id;
            const hasArticle = !!item.articleId || !!item.article;
            const isNew = isNewIntakeStatus(item.status);

            return (
              <div
                key={`${item.channel}-${item.id}`}
                style={{
                  background: "#ffffff",
                  border: `1px solid ${isNew ? "#bfdbfe" : "#e2e8f0"}`,
                  borderRadius: "10px",
                  padding: "18px 20px",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                  transition: "box-shadow 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                  <div style={{ flex: "1 1 360px" }}>
                    {/* Badges række */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                      {/* Kanal badge */}
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          ...(item.channel === "qa" && { background: "#e0e7ff", color: "#3730a3" }),
                          ...(item.channel === "interview" && { background: "#ede9fe", color: "#5b21b6" }),
                          ...(item.channel === "sponsor" && { background: "#ecfdf5", color: "#065f46" }),
                          ...(item.channel === "meddeler" && { background: "#fef3c7", color: "#92400e" }),
                          ...(item.channel === "submission" && { background: "#f1f5f9", color: "#334155" }),
                        }}
                      >
                        {item.channel === "qa" && <Inbox size={12} />}
                        {item.channel === "interview" && <Mic size={12} />}
                        {item.channel === "sponsor" && <Handshake size={12} />}
                        {item.channel === "meddeler" && <Radio size={12} />}
                        {item.channel === "submission" && <MessageSquare size={12} />}
                        {item.channel === "qa" && "Kilde-Q&A"}
                        {item.channel === "interview" && "AI-Interview"}
                        {item.channel === "sponsor" && "Sponsor / Partner"}
                        {item.channel === "meddeler" && "Meddeler-sag"}
                        {item.channel === "submission" && "Borgerindlæg"}
                      </span>

                      {/* Status badge */}
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          background: hasArticle ? "#dcfce7" : isNew ? "#eff6ff" : "#f1f5f9",
                          color: hasArticle ? "#166534" : isNew ? "#1d4ed8" : "#475569",
                        }}
                      >
                        {hasArticle ? "Artikel oprettet" : item.status}
                      </span>

                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                        {new Date(item.createdAt).toLocaleDateString("da-DK", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <h3 style={{ margin: "0 0 6px 0", fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>
                      {item.title}
                    </h3>

                    <div style={{ fontSize: "13px", color: "#475569", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <span>Afsender: <strong>{item.senderName}</strong> {item.senderRole ? `(${item.senderRole})` : ""}</span>
                      {item.senderContact && <span>Kontakt: <a href={`mailto:${item.senderContact}`} style={{ color: "var(--color-primary, #9E3D1B)" }}>{item.senderContact}</a></span>}
                    </div>

                    {item.summary && (
                      <p style={{ margin: "8px 0 0 0", fontSize: "13.5px", color: "#334155", lineHeight: "1.4" }}>
                        {item.summary}
                      </p>
                    )}
                  </div>

                  {/* Handlingstaster */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    {/* Kopier kildelink knap */}
                    {item.token && (
                      <button
                        type="button"
                        onClick={() => handleCopyLink(item.token!, item.channel)}
                        title="Kopier det direkte link, som kilden eller partneren bruger"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 12px",
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#334155",
                          cursor: "pointer",
                        }}
                      >
                        {copiedToken === item.token ? (
                          <>
                            <Check size={13} style={{ color: "#16a34a" }} />
                            <span>Kopieret!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Kildelink</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Detalje toggle */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "6px 10px",
                        background: "transparent",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{isExpanded ? "Luk" : "Vis detaljer"}</span>
                    </button>

                    {/* Opret artikel / Åbn artikel knap */}
                    {hasArticle ? (
                      <Link
                        href={`/redaktion/artikler/${item.articleId || item.article?.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 14px",
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
                        onClick={() => handleConvert(item)}
                        disabled={isConverting}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 14px",
                          background: "var(--color-primary, #9E3D1B)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12.5px",
                          fontWeight: "700",
                          cursor: "pointer",
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                        }}
                      >
                        {isConverting ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Opretter...</span>
                          </>
                        ) : (
                          <>
                            <FilePlus size={13} />
                            <span>Opret artikel</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Succesbesked efter oprettelse */}
                {actionMessage?.id === item.id && (
                  <div style={{ marginTop: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 12px", borderRadius: "6px", fontSize: "12.5px", color: "#166534", display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 size={14} />
                    <span>{actionMessage.text}</span>
                  </div>
                )}

                {/* Udvidet detalje sektion */}
                {isExpanded && item.details && (
                  <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #f1f5f9", fontSize: "13px" }}>
                    <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", color: "#334155", lineHeight: "1.45" }}>
                        {JSON.stringify(item.details, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
