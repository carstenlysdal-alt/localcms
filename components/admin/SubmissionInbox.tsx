"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  updateSubmissionStatus,
  convertSubmissionToArticle,
  deleteSubmission,
} from "@/app/redaktion/indbakke/actions";
import {
  Inbox,
  User,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ShieldCheck,
  Trash2,
  ArrowRight,
} from "lucide-react";

type SubmissionItem = {
  id: string;
  navn: string;
  kontakt: string;
  emne: string;
  tekst: string;
  omraadeId: string | null;
  omraade?: { id: string; navn: string } | null;
  billederUrl: unknown;
  rettighederAccepteret: boolean;
  samtykkeAccepteret: boolean;
  status: string;
  noter: string | null;
  articleId: string | null;
  article?: { id: string; titel: string; slug: string; status: string } | null;
  createdAt: Date;
};

type SubmissionInboxProps = {
  submissions: SubmissionItem[];
};

export function SubmissionInbox({ submissions }: SubmissionInboxProps) {
  const router = useRouter();
  const [filterStatus, setFilterStatus] = useState<string>("Alle");
  const [expandedId, setExpandedId] = useState<string | null>(
    submissions.length > 0 ? submissions[0].id : null
  );
  const [activeNotes, setActiveNotes] = useState<Record<string, string>>({});
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; msg: string; isError?: boolean } | null>(null);

  const filtered = submissions.filter((s) => {
    if (filterStatus === "Alle") return true;
    if (filterStatus === "Ny") return s.status === "Ny";
    if (filterStatus === "Behandles") return s.status === "Behandles";
    if (filterStatus === "ArtikelOprettet") return s.status === "ArtikelOprettet";
    if (filterStatus === "Afvist") return s.status === "Afvist";
    return true;
  });

  const countByStatus = {
    Alle: submissions.length,
    Ny: submissions.filter((s) => s.status === "Ny").length,
    Behandles: submissions.filter((s) => s.status === "Behandles").length,
    ArtikelOprettet: submissions.filter((s) => s.status === "ArtikelOprettet").length,
    Afvist: submissions.filter((s) => s.status === "Afvist").length,
  };

  async function handleStatusChange(id: string, newStatus: "Ny" | "Behandles" | "Afvist") {
    setLoadingAction(id);
    setActionMessage(null);
    const note = activeNotes[id];
    const res = await updateSubmissionStatus(id, newStatus, note);
    setLoadingAction(null);
    if (!res.success) {
      setActionMessage({ id, msg: res.error || "Fejl ved opdatering", isError: true });
    } else {
      setActionMessage({ id, msg: `Status opdateret til '${newStatus}'` });
      router.refresh();
    }
  }

  async function handleConvert(id: string) {
    setLoadingAction(`convert-${id}`);
    setActionMessage(null);
    const res = await convertSubmissionToArticle(id);
    setLoadingAction(null);
    if (!res.success) {
      setActionMessage({ id, msg: res.error || "Kunne ikke oprette artikel", isError: true });
    } else {
      setActionMessage({ id, msg: res.message || "Artikel oprettet med succes!" });
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Er du sikker på, at du vil slette denne indsendelse permanent?")) return;
    setLoadingAction(`del-${id}`);
    const res = await deleteSubmission(id);
    setLoadingAction(null);
    if (res.success) {
      router.refresh();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: "1px solid var(--color-divider)", paddingBottom: "12px" }}>
        {[
          { key: "Alle", label: "Alle forslag", count: countByStatus.Alle },
          { key: "Ny", label: "Nye", count: countByStatus.Ny },
          { key: "Behandles", label: "Under behandling", count: countByStatus.Behandles },
          { key: "ArtikelOprettet", label: "Artikel oprettet", count: countByStatus.ArtikelOprettet },
          { key: "Afvist", label: "Afviste", count: countByStatus.Afvist },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilterStatus(tab.key)}
            className={`btn btn-secondary ${filterStatus === tab.key ? "btn-primary" : ""}`}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>{tab.label}</span>
            <span
              style={{
                fontSize: "11px",
                background: filterStatus === tab.key ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.06)",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Indholdsoversigt */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--color-text-muted)" }}>
          <Inbox size={40} style={{ margin: "0 auto 12px auto", opacity: 0.4 }} />
          <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>Ingen indsendelser i denne visning</h3>
          <p style={{ fontSize: "14px" }}>Når borgere indsender forslag via /indsend, dukker de automatisk op her.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filtered.map((item) => {
            const isExpanded = expandedId === item.id;
            const billeder = Array.isArray(item.billederUrl) ? (item.billederUrl as string[]) : [];

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: "0",
                  overflow: "hidden",
                  borderLeft:
                    item.status === "Ny"
                      ? "4px solid #2563EB"
                      : item.status === "Behandles"
                      ? "4px solid #D97706"
                      : item.status === "ArtikelOprettet"
                      ? "4px solid #059669"
                      : "4px solid #9CA3AF",
                }}
              >
                {/* Header bar */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    background: isExpanded ? "rgba(0,0,0,0.02)" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "15px", color: "var(--color-text)" }}>{item.emne}</strong>
                        {item.status === "Ny" && (
                          <span className="badge" style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                            Ny
                          </span>
                        )}
                        {item.status === "Behandles" && (
                          <span className="badge" style={{ background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A" }}>
                            Under behandling
                          </span>
                        )}
                        {item.status === "ArtikelOprettet" && (
                          <span className="badge" style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}>
                            Artikel oprettet
                          </span>
                        )}
                        {item.status === "Afvist" && (
                          <span className="badge" style={{ background: "#F3F4F6", color: "#4B5563", border: "1px solid #E5E7EB" }}>
                            Afvist
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "13px", color: "var(--color-text-muted)" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <User size={13} /> {item.navn}
                        </span>
                        {item.omraade && (
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <MapPin size={13} /> {item.omraade.navn}
                          </span>
                        )}
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Calendar size={13} />{" "}
                          {new Date(item.createdAt).toLocaleDateString("da-DK", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ padding: "0 20px 20px 20px", borderTop: "1px solid var(--color-divider)", paddingTop: "16px" }}>
                    {/* Afsender- og samtykkeboks */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                        gap: "16px",
                        marginBottom: "16px",
                        background: "var(--color-bg)",
                        padding: "12px 16px",
                        borderRadius: "var(--radius-md)",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "2px" }}>Afsender & Kontakt</div>
                        <div style={{ fontSize: "14px", fontWeight: "600" }}>{item.navn}</div>
                        <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                          <a href={`mailto:${item.kontakt}`} style={{ textDecoration: "underline" }}>
                            {item.kontakt}
                          </a>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "2px" }}>Rettigheder & Samtykke</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "12px", color: "#065F46" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <ShieldCheck size={14} /> Ophavsret bekræftet af afsender
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle2 size={14} /> Samtykke til redaktionel behandling & omtale
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Fuld tekst */}
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px", fontWeight: "600" }}>
                        Indsendt tekst / tip:
                      </div>
                      <div
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid var(--color-divider)",
                          borderRadius: "var(--radius-md)",
                          padding: "16px",
                          fontSize: "14px",
                          lineHeight: "1.6",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {item.tekst}
                      </div>
                    </div>

                    {/* Medsendte billeder */}
                    {billeder.length > 0 && (
                      <div style={{ marginBottom: "16px" }}>
                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                          Medsendte billeder / links:
                        </div>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          {billeder.map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary"
                              style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                            >
                              <ImageIcon size={14} /> Se billede {idx + 1} <ExternalLink size={12} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interne noter */}
                    <div style={{ marginBottom: "20px" }}>
                      <label htmlFor={`notes-${item.id}`} style={{ display: "block", fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px", fontWeight: "600" }}>
                        Redaktionens interne noter:
                      </label>
                      <textarea
                        id={`notes-${item.id}`}
                        rows={2}
                        defaultValue={item.noter || ""}
                        placeholder="Tilføj intern kommentar (f.eks. 'Jonas ringer fredag', 'Venter på svar fra forvaltningen')..."
                        onChange={(e) => setActiveNotes({ ...activeNotes, [item.id]: e.target.value })}
                        className="input"
                        style={{ width: "100%", fontSize: "13px" }}
                      />
                    </div>

                    {/* Handlingsstatus besked */}
                    {actionMessage?.id === item.id && (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: "var(--radius-sm)",
                          marginBottom: "16px",
                          fontSize: "13px",
                          background: actionMessage.isError ? "#FEE2E2" : "#ECFDF5",
                          color: actionMessage.isError ? "#991B1B" : "#065F46",
                          border: `1px solid ${actionMessage.isError ? "#F87171" : "#34D399"}`,
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {actionMessage.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                        <span>{actionMessage.msg}</span>
                      </div>
                    )}

                    {/* Handlinger */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "12px",
                        paddingTop: "14px",
                        borderTop: "1px solid var(--color-divider)",
                      }}
                    >
                      {/* Opret artikel handling */}
                      <div>
                        {item.status === "ArtikelOprettet" && item.articleId ? (
                          <Link
                            href={`/redaktion/artikler/${item.articleId}`}
                            className="btn btn-primary"
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
                          >
                            <FileText size={14} /> Åbn artikel i editoren <ArrowRight size={13} />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleConvert(item.id)}
                            disabled={loadingAction === `convert-${item.id}`}
                            className="btn btn-primary"
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
                          >
                            <FileText size={14} />
                            {loadingAction === `convert-${item.id}`
                              ? "Opretter artikel..."
                              : "Opret artikel fra indsendelse"}
                          </button>
                        )}
                      </div>

                      {/* Statusknapper */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Sæt status:</span>
                        {item.status !== "Ny" && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.id, "Ny")}
                            disabled={loadingAction === item.id}
                            className="btn btn-secondary"
                            style={{ fontSize: "12px", padding: "4px 10px" }}
                          >
                            Ny
                          </button>
                        )}
                        {item.status !== "Behandles" && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.id, "Behandles")}
                            disabled={loadingAction === item.id}
                            className="btn btn-secondary"
                            style={{ fontSize: "12px", padding: "4px 10px" }}
                          >
                            Behandles
                          </button>
                        )}
                        {item.status !== "Afvist" && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.id, "Afvist")}
                            disabled={loadingAction === item.id}
                            className="btn btn-secondary"
                            style={{ fontSize: "12px", padding: "4px 10px", color: "#DC2626" }}
                          >
                            Afvis
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={loadingAction === `del-${item.id}`}
                          className="btn btn-secondary"
                          style={{ fontSize: "12px", padding: "4px 8px", color: "#9CA3AF" }}
                          title="Slet indsendelse permanent"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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
