"use client";

import { useActionState, useTransition } from "react";
import { AlertCircle, Plus, Trash2, Check } from "lucide-react";
import {
  addArticleCorrection,
  deleteArticleCorrection,
  type CorrectionActionState,
} from "@/app/redaktion/artikler/actions";

interface CorrectionItem {
  id: string;
  tekst: string;
  dato: Date | string;
}

export function ArticleCorrections({
  articleId,
  corrections,
  canRemove = false,
}: {
  articleId: string;
  corrections: CorrectionItem[];
  /** Kun redaktører (publicering/redigér alle) må fjerne en rettelse; håndhæves igen i serveren. */
  canRemove?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const action = addArticleCorrection.bind(null, articleId);
  const [state, formAction, pending] = useActionState<CorrectionActionState, FormData>(action, {});

  const handleDelete = (correctionId: string) => {
    if (!confirm("Er du sikker på, at du vil fjerne denne rettelse fra den offentlige log? Fjernelsen registreres med dit navn og tidspunkt.")) return;
    startTransition(async () => {
      await deleteArticleCorrection(correctionId, articleId);
    });
  };

  return (
    <div
      style={{
        marginTop: "32px",
        padding: "24px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <AlertCircle size={18} style={{ color: "var(--color-accent-600)" }} />
        <h2 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>
          Rettelser og præciseringer (A-05 & P-13)
        </h2>
      </div>
      <p style={{ fontSize: "13px", color: "var(--color-neutral-600)", margin: "0 0 16px 0" }}>
        Faktuelle rettelser vises synligt øverst i artiklen og logges automatisk i mediets offentlige rettelsesarkiv.
      </p>

      {state.error && (
        <div className="dialog inline-dialog" style={{ marginBottom: "16px", borderColor: "var(--color-error-400)" }}>
          <div style={{ color: "var(--color-error-600)", fontSize: "13px" }}>{state.error}</div>
        </div>
      )}

      {state.success && (
        <div className="notice-success" style={{ marginBottom: "16px", fontSize: "13px" }}>
          <Check size={14} /> {state.success}
        </div>
      )}

      {/* Eksisterende rettelser */}
      {corrections.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          {corrections.map((corr) => {
            const d = new Date(corr.dato);
            const dateStr = d.toLocaleDateString("da-DK", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={corr.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "12px",
                  background: "var(--color-neutral-50)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "13px",
                }}
              >
                <div>
                  <div style={{ fontWeight: "600", color: "var(--color-neutral-800)", marginBottom: "2px" }}>
                    {dateStr}:
                  </div>
                  <div style={{ color: "var(--color-neutral-700)", lineHeight: "1.4" }}>
                    {corr.tekst}
                  </div>
                </div>
                {canRemove && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="Fjern rettelse fra den offentlige log"
                    aria-label="Fjern rettelse fra den offentlige log"
                    disabled={isPending}
                    onClick={() => handleDelete(corr.id)}
                    style={{ color: "var(--color-error-600)", padding: "4px 8px", marginLeft: "12px" }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ fontSize: "13px", color: "var(--color-neutral-500)", fontStyle: "italic", marginBottom: "20px" }}>
          Ingen rettelser tilføjet denne artikel endnu.
        </p>
      )}

      {/* Formular til at tilføje rettelse */}
      <form action={formAction} style={{ borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 12px 0" }}>
          Tilføj ny rettelse eller præcisering
        </h3>

        <div className="field" style={{ marginBottom: "12px" }}>
          <label htmlFor="tekst" style={{ fontSize: "12px", fontWeight: "500" }}>
            Hvad er rettet?
          </label>
          <textarea
            id="tekst"
            name="tekst"
            className="input"
            rows={2}
            required
            placeholder="Beskriv præcist hvad der var fejlagtigt og hvad der er berigtiget..."
          />
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <p className="help-text" style={{ margin: 0, flex: "1 1 auto" }}>
            Rettelsen tidsstemples automatisk og kan ikke bagdateres.
          </p>

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={pending}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px" }}
          >
            <Plus size={14} /> {pending ? "Tilføjer…" : "Tilføj rettelse"}
          </button>
        </div>
      </form>
    </div>
  );
}
