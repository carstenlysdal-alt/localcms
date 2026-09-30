"use client";

import { useState, useEffect } from "react";
import { submitInterviewAnswers } from "@/app/actions/interview";
import { Mic, MicOff, CheckCircle2, ChevronRight, ChevronLeft, Send, Loader2, Sparkles } from "lucide-react";

interface Question {
  id: string;
  text: string;
}

interface InterviewRunnerProps {
  token: string;
  questions: Question[];
  initialAnswers: Record<string, { text: string; audioUrl?: string }>;
  isCompleted: boolean;
}

export function InterviewRunner({
  token,
  questions,
  initialAnswers,
  isCompleted,
}: InterviewRunnerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { text: string }>>(initialAnswers);
  const [finalComment, setFinalComment] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(isCompleted);
  const [followUp, setFollowUp] = useState<string | null>(null);

  const currentQ = questions[currentStep];

  // Speech recognition setup hvis browseren understøtter det
  const [recognition, setRecognition] = useState<unknown | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .SpeechRecognition ||
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const rec = new (SpeechRecognition as new () => {
            continuous: boolean;
            interimResults: boolean;
            lang: string;
            onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void;
            onerror: () => void;
            onend: () => void;
            start: () => void;
            stop: () => void;
          })();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = "da-DK";

          rec.onresult = (event: { results: Array<Array<{ transcript: string }>> }) => {
            const transcript = Array.from(event.results)
              .map((r) => r[0].transcript)
              .join(" ");

            if (currentQ) {
              setAnswers((prev) => ({
                ...prev,
                [currentQ.id]: {
                  text: (prev[currentQ.id]?.text ? `${prev[currentQ.id].text} ` : "") + transcript,
                },
              }));
            }
          };

          rec.onend = () => setIsRecording(false);
          rec.onerror = () => setIsRecording(false);

          setRecognition(rec);
        } catch {
          // Ikke kritisk hvis browser nægter
        }
      }
    }
  }, [currentQ]);

  const toggleRecording = () => {
    if (!recognition) {
      alert("Tale-til-tekst er ikke understøttet i din nuværende browser. Du kan skrive dit svar direkte.");
      return;
    }

    const rec = recognition as { start: () => void; stop: () => void };
    if (isRecording) {
      rec.stop();
      setIsRecording(false);
    } else {
      try {
        rec.start();
        setIsRecording(true);
      } catch {
        setIsRecording(false);
      }
    }
  };

  const handleNext = () => {
    // Generer et dynamisk opfølgende spørgsmål på trin 1 hvis der er skrevet svar
    if (currentStep === 1 && answers[currentQ?.id]?.text?.length > 40 && !followUp) {
      setFollowUp("Vil du uddybe: Hvad er den største barriere for at nå i mål med dette?");
    }
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    const res = await submitInterviewAnswers(token, answers, finalComment);
    setIsSubmitting(false);

    if (res.success) {
      setCompleted(true);
    } else {
      alert(res.error || "Der opstod en fejl under afsendelsen.");
    }
  };

  if (completed) {
    return (
      <div
        style={{
          background: "#f5f3ff",
          border: "1px solid #ddd6fe",
          borderRadius: "var(--radius-card)",
          padding: "36px",
          textAlign: "center",
        }}
      >
        <CheckCircle2 size={46} style={{ color: "#7c3aed", margin: "0 auto 12px auto" }} />
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", color: "#5b21b6", margin: "0 0 10px 0" }}>
          Kildeinterviewet er modtaget!
        </h2>
        <p style={{ fontSize: "15px", color: "#4c1d95", maxWidth: "500px", margin: "0 auto 20px auto", lineHeight: "1.5" }}>
          Tusind tak for dine udtalelser og din tid. Redaktionen har modtaget interviewet, transskriberingen og
          dine citater. Vi kontakter dig forud for publicering, hvis der er spørgsmål eller citattjek.
        </p>
        <button
          type="button"
          onClick={() => setCompleted(false)}
          style={{
            background: "transparent",
            border: "1px solid #c4b5fd",
            color: "#6d28d9",
            padding: "8px 18px",
            borderRadius: "var(--radius-pill)",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Se eller rediger dine svar
        </button>
      </div>
    );
  }

  const isLastQuestion = currentStep === questions.length - 1;
  const currentAnswerText = answers[currentQ?.id]?.text || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Step indikator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", color: "var(--ink-3)" }}>
        <span>
          Spørgsmål <strong>{currentStep + 1}</strong> af <strong>{questions.length}</strong>
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          {questions.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: "28px",
                height: "4px",
                borderRadius: "2px",
                background: idx === currentStep ? "#7c3aed" : idx < currentStep ? "#c4b5fd" : "var(--line)",
                transition: "all 0.2s ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* Spørgsmålskort */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "28px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "20px", color: "var(--ink)", margin: "0 0 16px 0", lineHeight: "1.35" }}>
          {currentQ?.text}
        </h2>

        {/* Stemmeoptager og tekstfelt */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "12px", alignItems: "center" }}>
          <button
            type="button"
            onClick={toggleRecording}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              background: isRecording ? "#fee2e2" : "#ede9fe",
              color: isRecording ? "#b91c1c" : "#5b21b6",
              border: `1px solid ${isRecording ? "#fca5a5" : "#ddd6fe"}`,
              borderRadius: "var(--radius-pill)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            {isRecording ? (
              <>
                <MicOff size={16} />
                <span>Optager... Klik for at stoppe</span>
              </>
            ) : (
              <>
                <Mic size={16} />
                <span>Indtal svar med mikrofon</span>
              </>
            )}
          </button>
          {isRecording && (
            <span style={{ fontSize: "12px", color: "#b91c1c", animation: "pulse 1.5s infinite" }}>
              ● Lytter til din stemme...
            </span>
          )}
        </div>

        <textarea
          rows={6}
          placeholder="Skriv eller indtal dit svar her..."
          value={currentAnswerText}
          onChange={(e) =>
            setAnswers((prev) => ({
              ...prev,
              [currentQ.id]: { text: e.target.value },
            }))
          }
          style={{
            width: "100%",
            padding: "14px",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            fontSize: "15px",
            lineHeight: "1.5",
            fontFamily: "inherit",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />

        {/* Opfølgende AI-spørgsmål hvis det triggers */}
        {followUp && currentStep === 1 && (
          <div
            style={{
              marginTop: "16px",
              padding: "14px",
              background: "#faf5ff",
              border: "1px solid #e9d5ff",
              borderRadius: "8px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <Sparkles size={18} style={{ color: "#9333ea", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#7e22ce" }}>
                AI-opfølgning til din pointe
              </span>
              <p style={{ fontSize: "13.5px", color: "#581c87", margin: "2px 0 0 0" }}>{followUp}</p>
            </div>
          </div>
        )}

        {/* Sidste trin har også en boks til afsluttende bemærkninger */}
        {isLastQuestion && (
          <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid var(--line)" }}>
            <label style={{ display: "block", fontSize: "13.5px", fontWeight: "600", marginBottom: "6px" }}>
              Er der andet, redaktionen bør vide eller undersøge? (Valgfri)
            </label>
            <input
              type="text"
              placeholder="F.eks. referencer, dokumenter eller andre kilder..."
              value={finalComment}
              onChange={(e) => setFinalComment(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
            />
          </div>
        )}
      </div>

      {/* Navigationsknapper */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentStep === 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 16px",
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-pill)",
            fontSize: "14px",
            cursor: currentStep === 0 ? "not-allowed" : "pointer",
            opacity: currentStep === 0 ? 0.5 : 1,
          }}
        >
          <ChevronLeft size={16} />
          <span>Forrige spørgsmål</span>
        </button>

        {!isLastQuestion ? (
          <button
            type="button"
            onClick={handleNext}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 22px",
              background: "#6d28d9",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--radius-pill)",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            <span>Næste spørgsmål</span>
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            disabled={isSubmitting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "11px 26px",
              background: "#6d28d9",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--radius-pill)",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Afslutter interview...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Afslut & Afsend interview</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
