"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { Msg } from "../_lib/messages";

export function Notice({ msg, onClose }: { msg: Msg | null; onClose?: () => void }) {
  if (!msg) return null;
  const Icon = msg.tone === "ok" ? CheckCircle2 : msg.tone === "warn" ? AlertTriangle : msg.tone === "error" ? XCircle : Info;
  return (
    <div className={`fpe-notice fpe-notice--${msg.tone}`} role={msg.tone === "error" ? "alert" : "status"}>
      <Icon size={18} aria-hidden="true" />
      <p>{msg.text}</p>
      {onClose && (
        <button type="button" className="fpe-notice-close" onClick={onClose} aria-label="Luk besked">
          ×
        </button>
      )}
    </div>
  );
}

/** Modal på native <dialog>: fokusfælde, Esc og tilbageføring af fokus leveres af browseren. */
export function Dialog({ open, title, onClose, children, actions, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; actions: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`fpe-dialog${wide ? " fpe-dialog--wide" : ""}`} aria-labelledby="fpe-dialog-title" onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      {open && (
        <div className="fpe-dialog-inner">
          <h2 id="fpe-dialog-title" className="fpe-dialog-title">
            {title}
          </h2>
          <div className="fpe-dialog-body">{children}</div>
          <div className="fpe-dialog-actions">{actions}</div>
        </div>
      )}
    </dialog>
  );
}

export function Badge({ tone = "neutral", children, title }: { tone?: "neutral" | "ok" | "warn" | "error" | "ai" | "accent"; children: ReactNode; title?: string }) {
  return (
    <span className={`fpe-badge fpe-badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" }).format(new Date(iso)) : "–";
