"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { charCount } from "@/lib/editor/format";

/** Accordion: knap + panel (aria-expanded/aria-controls). Lokal version med `cms-accordion`-klasser så design-agenten kan samle den. */
export function Accordion({ title, summary, badge, defaultOpen = false, children }: { title: string; summary?: string; badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="cms-accordion" data-open={open}>
      <h3 className="cms-accordion-heading">
        <button type="button" className="cms-accordion-trigger" aria-expanded={open} aria-controls={`${id}-panel`} id={`${id}-btn`} onClick={() => setOpen((v) => !v)}>
          <span className="cms-accordion-title">{title}</span>
          {summary && <span className="cms-accordion-summary">{summary}</span>}
          {badge}
          <ChevronDown size={18} aria-hidden="true" className="cms-accordion-chevron" />
        </button>
      </h3>
      <div className="cms-accordion-panel" id={`${id}-panel`} role="region" aria-labelledby={`${id}-btn`} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

export function CharCounter({ text, max, id }: { text: string; max: number; id?: string }) {
  const c = charCount(text, max);
  return (
    <span id={id} className={`cms-counter${c.over ? " is-over" : c.near ? " is-near" : ""}`} aria-label={`${c.label} tegn${c.over ? " — grænsen er overskredet" : ""}`}>
      {c.label}
    </span>
  );
}

/** Lille AI-mærke (cyan). Bruges sparsomt: kun ved forslag/AI-resultater. */
export function AiChip({ children = "AI" }: { children?: React.ReactNode }) {
  return <span className="cms-ai-chip"><Sparkles size={12} aria-hidden="true" /> {children}</span>;
}

export function SuggestButton({ label = "Foreslå", loading, disabled, reason, onClick, title }: { label?: string; loading?: boolean; disabled?: boolean; reason?: string | null; onClick: () => void; title?: string }) {
  const blocked = Boolean(disabled || reason);
  return (
    <button type="button" className="cms-btn cms-btn-ai" onClick={onClick} disabled={loading || blocked} title={reason ?? title} aria-busy={loading || undefined}>
      {loading ? <Loader2 size={14} className="cms-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
      <span>{loading ? "Tænker…" : label}</span>
    </button>
  );
}

export type SaveState =
  | { kind: "idle"; savedAt: Date | null }
  | { kind: "dirty"; savedAt: Date | null }
  | { kind: "saving" }
  | { kind: "saved"; savedAt: Date; auto: boolean }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "off"; message: string };

import { formatSavedAt } from "@/lib/editor/format";

export function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry?: () => void }) {
  let text = "";
  let tone = "muted";
  let icon: React.ReactNode = null;
  switch (state.kind) {
    case "idle":
      text = state.savedAt ? `Sidst gemt ${formatSavedAt(state.savedAt)}` : "Endnu ikke gemt";
      break;
    case "dirty":
      text = "Ændringer gemmes om lidt…";
      break;
    case "saving":
      text = "Gemmer…";
      icon = <Loader2 size={14} className="cms-spin" aria-hidden="true" />;
      break;
    case "saved":
      text = `Sidst gemt ${formatSavedAt(state.savedAt)} · ${state.auto ? "Automatisk gemt" : "Gemt"}`;
      tone = "ok";
      icon = <Check size={14} aria-hidden="true" />;
      break;
    case "error":
      text = state.message;
      tone = "error";
      icon = <TriangleAlert size={14} aria-hidden="true" />;
      break;
    case "conflict":
      text = state.message;
      tone = "error";
      icon = <TriangleAlert size={14} aria-hidden="true" />;
      break;
    case "off":
      text = state.message;
      break;
  }
  return (
    <p className={`cms-save-indicator is-${tone}`} role="status" aria-live="polite">
      {icon}
      <span>{text}</span>
      {state.kind === "error" && onRetry && <button type="button" className="cms-link-btn" onClick={onRetry}>Prøv igen</button>}
    </p>
  );
}
