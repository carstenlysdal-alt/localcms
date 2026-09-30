"use client";

import { useState } from "react";
import { submitQaAnswers } from "@/app/actions/qa";
import { CheckCircle2, Send, Loader2, Edit3, ArrowLeft } from "lucide-react";

interface Question {
  id: string;
  text: string;
  type?: string;
}

interface SourceQaResponderProps {
  token: string;
  questions: Question[];
  initialAnswers: Record<string, { choice?: string; text: string }>;
  isAlreadyAnswered: boolean;
}

export function SourceQaResponder({
  token,
  questions,
  initialAnswers,
  isAlreadyAnswered,
}: SourceQaResponderProps) {
  const [answers, setAnswers] = useState<Record<string, { choice?: string; text: string }>>(initialAnswers);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [submitted, setSubmitted] = useState(isAlreadyAnswered);
  const [errorMsg, setErrorMsg] = useState("");

  const handleTextChange = (qId: string, val: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], text: val },
    }));
  };

  const handleChoiceChange = (qId: string, choice: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], choice },
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg("");

    const res = await submitQaAnswers(token, answers);
    setIsSubmitting(false);

    if (res.success) {
      setSubmitted(true);
      setIsReviewing(false);
    } else {
      setErrorMsg(res.error || "Der opstod en fejl.");
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "var(--radius-card)",
          padding: "32px",
          textAlign: "center",
        }}
      >
        <CheckCircle2 size={44} style={{ color: "#16a34a", margin: "0 auto 12px auto" }} />
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "24px", color: "#166534", margin: "0 0 8px 0" }}>
          Mange tak for dit svar!
        </h2>
        <p style={{ fontSize: "15px", color: "#14532d", maxWidth: "480px", margin: "0 auto 20px auto", lineHeight: "1.5" }}>
          Dine besvarelser er modtaget i redaktionens indbakke. Journalisten gennemgår svarene og inddrager dem i
          dækningen med respekt for dine formuleringer.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          style={{
            background: "transparent",
            border: "1px solid #86efac",
            color: "#166534",
            padding: "8px 16px",
            borderRadius: "var(--radius-pill)",
            fontSize: "13px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Opdater eller tilføj yderligere til dine svar
        </button>
      </div>
    );
  }

  if (isReviewing) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "28px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <Edit3 size={20} style={{ color: "var(--site-accent)" }} />
          <h2 style={{ margin: 0, fontSize: "20px", fontFamily: "var(--font-display)" }}>
            Gennemse dine svar før afsendelse
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "28px" }}>
          {questions.map((q, idx) => {
            const ans = answers[q.id];
            return (
              <div key={q.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
                <p style={{ fontWeight: "700", fontSize: "14px", color: "var(--ink)", margin: "0 0 6px 0" }}>
                  {idx + 1}. {q.text}
                </p>
                {ans?.choice && (
                  <span style={{ display: "inline-block", background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>
                    Valg: {ans.choice}
                  </span>
                )}
                <p style={{ fontSize: "14px", color: "var(--ink-2)", whiteSpace: "pre-wrap", margin: 0 }}>
                  {ans?.text || <em style={{ color: "var(--ink-3)" }}>Ikke besvaret</em>}
                </p>
              </div>
            );
          })}
        </div>

        {errorMsg && (
          <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "16px" }}>{errorMsg}</p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setIsReviewing(false)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 18px",
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-pill)",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={16} />
            <span>Ret i svarene</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="ai-toolbar-pill-btn"
            style={{ border: "none", cursor: "pointer", padding: "10px 24px", fontSize: "14px" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Sender svar...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Bekræft & Indsend svar</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {questions.map((q, idx) => {
        const textVal = answers[q.id]?.text || "";
        return (
          <div
            key={q.id}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-card)",
              padding: "24px",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "12px" }}>
              <span
                style={{
                  background: "var(--site-accent-soft)",
                  color: "var(--site-accent-strong)",
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "700",
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </span>
              <h3 style={{ margin: 0, fontSize: "17px", fontFamily: "var(--font-display)", color: "var(--ink)", lineHeight: "1.3" }}>
                {q.text}
              </h3>
            </div>

            <textarea
              rows={4}
              placeholder="Skriv dit svar her..."
              value={textVal}
              onChange={(e) => handleTextChange(q.id, e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                fontSize: "15px",
                lineHeight: "1.5",
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
              <span style={{ fontSize: "11px", color: "var(--ink-3)" }}>
                {textVal.length} tegn
              </span>
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
        <button
          type="button"
          onClick={() => setIsReviewing(true)}
          className="ai-toolbar-pill-btn"
          style={{ border: "none", cursor: "pointer", padding: "12px 28px", fontSize: "15px" }}
        >
          <span>Gennemse og send svar →</span>
        </button>
      </div>
    </div>
  );
}
