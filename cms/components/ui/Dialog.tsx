"use client";

import { useCallback, useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Knapper i bunden. */
  footer?: ReactNode;
  /** `sheet` = panel fra højre (fuld skærm på mobil). */
  variant?: "dialog" | "sheet";
  size?: "sm" | "md" | "lg";
  /** Må lukkes med klik på baggrunden (default true). Sæt false for destruktive bekræftelser med uafsluttet input. */
  dismissible?: boolean;
  className?: string;
};

/**
 * Modal på native `<dialog>` + `showModal()`: browseren fanger fokus (resten af siden er inert), lukker på Esc og
 * giver fokus tilbage til det element der åbnede den. Titlen er `aria-labelledby`, beskrivelsen `aria-describedby`.
 * `onClose` kaldes ved Esc, luk-knap og baggrundsklik — styr `open` i forælderen.
 */
export function Dialog({ open, onClose, title, description, children, footer, variant = "dialog", size = "md", dismissible = true, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // Esc udløser `cancel`: vi styrer lukningen selv, så forælderens state og dialogen aldrig kommer ud af trit.
  const onCancel = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  }, [onClose]);

  function onBackdropClick(e: MouseEvent<HTMLDialogElement>) {
    if (dismissible && e.target === ref.current) onClose();
  }

  return (
    <dialog
      ref={ref}
      className={cn("ui-dialog", `ui-dialog-${variant}`, `ui-dialog-${size}`, className)}
      aria-labelledby={`${uid}-title`}
      aria-describedby={description ? `${uid}-desc` : undefined}
      onCancel={onCancel}
      onClose={() => { if (open) onClose(); }}
      onClick={onBackdropClick}
    >
      <div className="ui-dialog-panel">
        <header className="ui-dialog-head">
          <h2 id={`${uid}-title`} className="ui-dialog-title">{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Luk">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {description ? <p id={`${uid}-desc`} className="ui-dialog-desc">{description}</p> : null}
        {open ? <div className="ui-dialog-body">{children}</div> : null}
        {footer ? <footer className="ui-dialog-foot">{footer}</footer> : null}
      </div>
    </dialog>
  );
}

/** Sheet = Dialog som sidepanel. */
export function Sheet(props: Omit<DialogProps, "variant">) {
  return <Dialog {...props} variant="sheet" />;
}

export type ConfirmSubmitProps = {
  /** Knappens indhold (ikon + tekst). */
  children: ReactNode;
  /** Dialogens titel, fx "Slet sektionen?". */
  title: string;
  /** Forklaring af konsekvensen. */
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Udløsende knaps udseende. */
  className?: string;
  /** `danger` (default) giver rød bekræft-knap. */
  tone?: "danger" | "primary";
  disabled?: boolean;
  /** Tilgængeligt navn når knappen kun er et ikon. */
  "aria-label"?: string;
  triggerTitle?: string;
};

/**
 * Erstatning for `window.confirm`: knap der åbner en bekræftelses-dialog og først derefter indsender sin formular
 * (`form.requestSubmit()`), så server actions bevares uændret. Brug i stedet for en almindelig submit-knap ved destruktive handlinger.
 */
export function ConfirmSubmit({ children, title, message, confirmLabel = "Slet", cancelLabel = "Annullér", className, tone = "danger", disabled, triggerTitle, ...rest }: ConfirmSubmitProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  function confirm() {
    setOpen(false);
    trigger.current?.form?.requestSubmit();
  }

  return (
    <>
      <button ref={trigger} type="button" className={className ?? "btn btn-secondary"} disabled={disabled} title={triggerTitle} aria-label={rest["aria-label"]} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {children}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>{cancelLabel}</button>
            <button type="button" className={cn("btn", tone === "danger" ? "btn-danger" : "btn-primary")} onClick={confirm}>{confirmLabel}</button>
          </>
        }
      >
        <p className="ui-dialog-message">{message}</p>
      </Dialog>
    </>
  );
}
