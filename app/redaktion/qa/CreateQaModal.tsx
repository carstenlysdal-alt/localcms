"use client";

import { useState } from "react";
import { createJournalistQa } from "@/app/actions/qa";
import { Plus, X, Loader2 } from "lucide-react";

export function CreateQaModal() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [titel, setTitel] = useState("");
  const [emne, setEmne] = useState("");
  const [kildeNavn, setKildeNavn] = useState("");
  const [kildeKontakt, setKildeKontakt] = useState("");
  const [kildeRolle, setKildeRolle] = useState("");
  const [baggrund, setBaggrund] = useState("");
  const [deadline, setDeadline] = useState("");
  const [questions, setQuestions] = useState<string[]>([
    "Hvad er din kommentar til sagen?",
    "Hvilke konsekvenser har det for lokalsamfundet?",
    "Hvad sker der fremadrettet?",
  ]);

  const handleAddQuestion = () => {
    setQuestions([...questions, ""]);
  };

  const handleQuestionChange = (index: number, val: string) => {
    const updated = [...questions];
    updated[index] = val;
    setQuestions(updated);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titel || !emne || !kildeNavn || !kildeKontakt) return;

    setIsSubmitting(true);
    const res = await createJournalistQa({
      titel,
      emne,
      baggrund,
      deadline,
      kildeNavn,
      kildeKontakt,
      kildeRolle,
      spoergsmaal: questions,
    });
    setIsSubmitting(false);

    if (res.success) {
      setOpen(false);
      setTitel("");
      setEmne("");
      setKildeNavn("");
      setKildeKontakt("");
    } else {
      alert(res.error || "Der opstod en fejl.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary"
        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
      >
        <Plus size={16} /> Opret ny Kilde-Q&A
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "20px" }}>Opret ny Kilde-Q&A</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>Titel / Arbejdsnavn *</label>
                <input
                  type="text"
                  required
                  placeholder="F.eks. Q&A med borgmesteren om budgetforlig"
                  value={titel}
                  onChange={(e) => setTitel(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>Emne *</label>
                <input
                  type="text"
                  required
                  placeholder="F.eks. Skattelettelser og besparelser i ældreplejen"
                  value={emne}
                  onChange={(e) => setEmne(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>Kildens navn *</label>
                  <input
                    type="text"
                    required
                    placeholder="F.eks. Knud Vincents"
                    value={kildeNavn}
                    onChange={(e) => setKildeNavn(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>Kildens e-mail/telefon *</label>
                  <input
                    type="text"
                    required
                    placeholder="F.eks. knud@kommune.dk"
                    value={kildeKontakt}
                    onChange={(e) => setKildeKontakt(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>Kildens rolle / titel</label>
                  <input
                    type="text"
                    placeholder="F.eks. Borgmester"
                    value={kildeRolle}
                    onChange={(e) => setKildeRolle(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>Deadline (valgfri)</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>Baggrund / Kontekst til kilden</label>
                <textarea
                  rows={2}
                  placeholder="Kort forklaring til kilden om artiklens vinkel..."
                  value={baggrund}
                  onChange={(e) => setBaggrund(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontFamily: "inherit" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "600" }}>Spørgsmål til kilden ({questions.length})</label>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    style={{ background: "none", border: "none", color: "var(--color-primary, #9E3D1B)", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                  >
                    + Tilføj spørgsmål
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {questions.map((q, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => handleQuestionChange(idx, e.target.value)}
                        placeholder={`Spørgsmål ${idx + 1}`}
                        style={{ flex: 1, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px" }}
                      />
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(idx)}
                          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "0 4px" }}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-secondary"
                >
                  Annuller
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? "Opretter..." : "Opret & generer link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
