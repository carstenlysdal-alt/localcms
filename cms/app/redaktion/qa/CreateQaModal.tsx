"use client";

import { useState } from "react";
import { createJournalistQa } from "@/app/actions/qa";
import { Plus, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Notice } from "@/components/ui/Layout";

const DEFAULT_QUESTIONS = [
  "Hvad er din kommentar til sagen?",
  "Hvilke konsekvenser har det for lokalsamfundet?",
  "Hvad sker der fremadrettet?",
];

export function CreateQaModal() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [titel, setTitel] = useState("");
  const [emne, setEmne] = useState("");
  const [kildeNavn, setKildeNavn] = useState("");
  const [kildeKontakt, setKildeKontakt] = useState("");
  const [kildeRolle, setKildeRolle] = useState("");
  const [baggrund, setBaggrund] = useState("");
  const [deadline, setDeadline] = useState("");
  const [questions, setQuestions] = useState<string[]>(DEFAULT_QUESTIONS);

  const handleAddQuestion = () => setQuestions([...questions, ""]);
  const handleQuestionChange = (index: number, val: string) => {
    const updated = [...questions];
    updated[index] = val;
    setQuestions(updated);
  };
  const handleRemoveQuestion = (index: number) => setQuestions(questions.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titel || !emne || !kildeNavn || !kildeKontakt) return;

    setIsSubmitting(true);
    setError(null);
    const res = await createJournalistQa({ titel, emne, baggrund, deadline, kildeNavn, kildeKontakt, kildeRolle, spoergsmaal: questions });
    setIsSubmitting(false);

    if (res.success) {
      setOpen(false);
      setTitel("");
      setEmne("");
      setKildeNavn("");
      setKildeKontakt("");
    } else {
      setError(res.error || "Der opstod en fejl.");
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary" aria-haspopup="dialog">
        <Plus size={16} aria-hidden="true" /> Opret ny kilde-Q&A
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Opret ny kilde-Q&A" size="lg">
        <form onSubmit={handleSubmit} className="ui-stack ui-gap-md">
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Field label="Titel / arbejdsnavn" htmlFor="qa-titel" required>
            <input id="qa-titel" className="input" type="text" required placeholder="F.eks. Q&A med borgmesteren om budgetforlig" value={titel} onChange={(e) => setTitel(e.target.value)} />
          </Field>
          <Field label="Emne" htmlFor="qa-emne" required>
            <input id="qa-emne" className="input" type="text" required placeholder="F.eks. Skattelettelser og besparelser i ældreplejen" value={emne} onChange={(e) => setEmne(e.target.value)} />
          </Field>
          <div className="ui-form-grid">
            <Field label="Kildens navn" htmlFor="qa-kilde" required>
              <input id="qa-kilde" className="input" type="text" required placeholder="F.eks. Knud Vincents" value={kildeNavn} onChange={(e) => setKildeNavn(e.target.value)} />
            </Field>
            <Field label="Kildens e-mail eller telefon" htmlFor="qa-kontakt" required>
              <input id="qa-kontakt" className="input" type="text" required placeholder="F.eks. knud@kommune.dk" value={kildeKontakt} onChange={(e) => setKildeKontakt(e.target.value)} />
            </Field>
          </div>
          <div className="ui-form-grid">
            <Field label="Kildens rolle / titel" htmlFor="qa-rolle">
              <input id="qa-rolle" className="input" type="text" placeholder="F.eks. Borgmester" value={kildeRolle} onChange={(e) => setKildeRolle(e.target.value)} />
            </Field>
            <Field label="Deadline (valgfri)" htmlFor="qa-deadline">
              <input id="qa-deadline" className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
          </div>
          <Field label="Baggrund / kontekst til kilden" htmlFor="qa-baggrund">
            <textarea id="qa-baggrund" className="input" rows={2} placeholder="Kort forklaring til kilden om artiklens vinkel…" value={baggrund} onChange={(e) => setBaggrund(e.target.value)} />
          </Field>

          <fieldset className="qa-questions">
            <legend className="field-label">Spørgsmål til kilden ({questions.length})</legend>
            {questions.map((q, idx) => (
              <div key={idx} className="qa-question">
                <label className="sr-only" htmlFor={`qa-q-${idx}`}>Spørgsmål {idx + 1}</label>
                <input id={`qa-q-${idx}`} className="input" type="text" value={q} onChange={(e) => handleQuestionChange(idx, e.target.value)} placeholder={`Spørgsmål ${idx + 1}`} />
                {questions.length > 1 ? (
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => handleRemoveQuestion(idx)} aria-label={`Fjern spørgsmål ${idx + 1}`}>
                    <X size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ))}
            <div><button type="button" className="btn btn-ghost btn-sm" onClick={handleAddQuestion}><Plus size={14} aria-hidden="true" /> Tilføj spørgsmål</button></div>
          </fieldset>

          <div className="ui-dialog-foot">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">Annullér</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">{isSubmitting ? "Opretter…" : "Opret og generér link"}</button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
