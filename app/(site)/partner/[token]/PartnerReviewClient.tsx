"use client";

import { useState } from "react";
import { submitPartnerReview } from "@/app/actions/sponsor";
import { CheckCircle2, AlertCircle, FileCheck, Send, Loader2 } from "lucide-react";

interface PartnerReviewClientProps {
  token: string;
  brief: {
    status: string;
    partnerNavn: string;
  };
  briefData: Record<string, string>;
  quotes: string[];
  linkedArticle?: {
    id: string;
    titel: string;
    manchet?: string | null;
    slug: string;
    status: string;
  } | null;
}

export function PartnerReviewClient({
  token,
  brief,
  briefData,
  quotes,
  linkedArticle,
}: PartnerReviewClientProps) {
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewDone, setReviewDone] = useState(brief.status === "Godkendt");
  const [responseType, setResponseType] = useState<"godkendt" | "korrektioner">("godkendt");

  const handleReviewSubmit = async (approval: "godkendt" | "korrektioner") => {
    setIsSubmitting(true);
    setResponseType(approval);

    const res = await submitPartnerReview(token, approval, comment);
    setIsSubmitting(false);

    if (res.success) {
      setReviewDone(true);
    } else {
      alert(res.error || "Der opstod en fejl.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Brief oversigt */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "24px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h2 style={{ fontSize: "18px", fontFamily: "var(--font-display)", margin: "0 0 14px 0", color: "var(--ink)" }}>
          Oversigt over modtaget brief
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px" }}>
          <div>
            <strong style={{ display: "block", color: "var(--ink)", marginBottom: "2px" }}>Nøglebudskaber:</strong>
            <p style={{ margin: 0, color: "var(--ink-2)", lineHeight: "1.4" }}>{briefData.budskab || "Ingen budskaber angivet."}</p>
          </div>

          {briefData.formaal && (
            <div>
              <strong style={{ display: "block", color: "var(--ink)", marginBottom: "2px" }}>Formål:</strong>
              <p style={{ margin: 0, color: "var(--ink-2)" }}>{briefData.formaal}</p>
            </div>
          )}

          {quotes.length > 0 && (
            <div>
              <strong style={{ display: "block", color: "var(--ink)", marginBottom: "4px" }}>Godkendte citatforslag:</strong>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--ink-2)" }}>
                {quotes.map((q, idx) => (
                  <li key={idx} style={{ marginBottom: "4px" }}>&quot;{q}&quot;</li>
                ))}
              </ul>
            </div>
          )}

          {briefData.fakta && (
            <div>
              <strong style={{ display: "block", color: "var(--ink)", marginBottom: "2px" }}>Fakta & nøgletal:</strong>
              <p style={{ margin: 0, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>{briefData.fakta}</p>
            </div>
          )}
        </div>
      </div>

      {/* Faktatjek & artikelstatus */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "24px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <FileCheck size={20} style={{ color: "#065f46" }} />
          <h2 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-display)" }}>
            Faktatjek og citatgodkendelse
          </h2>
        </div>

        {linkedArticle ? (
          <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "18px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>
              Udkast til partnerartikel (Status: {linkedArticle.status})
            </span>
            <h3 style={{ fontSize: "17px", color: "#0f172a", margin: "6px 0 4px 0" }}>{linkedArticle.titel}</h3>
            {linkedArticle.manchet && (
              <p style={{ fontSize: "13.5px", color: "#475569", margin: 0 }}>{linkedArticle.manchet}</p>
            )}
          </div>
        ) : (
          <p style={{ fontSize: "14px", color: "var(--ink-2)", marginBottom: "18px" }}>
            Redaktionen er i gang med at forfatte artiklen ud fra jeres brief. Så snart udkastet er klar,
            kan I godkende citater og faktuelle oplysninger her på siden.
          </p>
        )}

        {reviewDone ? (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "16px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle2 size={24} style={{ color: "#16a34a" }} />
            <div>
              <strong style={{ color: "#166534", fontSize: "14px", display: "block" }}>
                {responseType === "godkendt" ? "Citater og fakta er godkendt!" : "Rettelser sendt til redaktionen"}
              </strong>
              <span style={{ color: "#14532d", fontSize: "13px" }}>
                Redaktionen er underrettet og færdiggør publiceringen.
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Kommentar eller rettelse til fakta/citater (valgfri):
              </label>
              <textarea
                rows={3}
                placeholder="F.eks. rettelse af årstal, titel eller præcisering af citat..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{ width: "100%", padding: "10px", border: "1px solid var(--line)", borderRadius: "6px", fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleReviewSubmit("korrektioner")}
                disabled={isSubmitting}
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  padding: "9px 18px",
                  borderRadius: "var(--radius-pill)",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Anmod om faktuelle rettelser
              </button>

              <button
                type="button"
                onClick={() => handleReviewSubmit("godkendt")}
                disabled={isSubmitting}
                style={{
                  background: "#065f46",
                  color: "#ffffff",
                  border: "none",
                  padding: "9px 22px",
                  borderRadius: "var(--radius-pill)",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Gemmer...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Godkend citater & fakta</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
