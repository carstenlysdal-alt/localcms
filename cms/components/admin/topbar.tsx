"use client";

import { useRouter } from "next/navigation";
import { Bot, Menu } from "lucide-react";
import { useShell } from "./shell-frame";

/** Hamburger (kun mobil): åbner sidebaren som drawer. */
export function MobileMenuButton() {
  const { openDrawer, drawerOpen } = useShell();
  return (
    <button type="button" className="shell-iconbtn shell-menubtn" onClick={openDrawer} aria-label="Åbn menu" aria-expanded={drawerOpen} aria-controls="shell-sidebar">
      <Menu size={20} aria-hidden="true" />
    </button>
  );
}

/** Hændelsen AI-operatør-panelet lytter på. Panelet kalder `event.preventDefault()` for at melde "jeg tog den". */
export const OPERATOR_OPEN_EVENT = "cms:operator-open";

/**
 * AI-operatør-knap i topbaren. Sender `cms:operator-open` (cancelable). Hvis intet panel er monteret (ingen kalder
 * preventDefault), åbner knappen i stedet den fulde chat-side. Tastaturgenvejen (Cmd/Ctrl+K) ejes af panelet selv.
 */
export function AiOperatorButton({ hasPanel }: { hasPanel: boolean }) {
  const router = useRouter();
  function open() {
    const evt = new CustomEvent(OPERATOR_OPEN_EVENT, { cancelable: true });
    const unhandled = window.dispatchEvent(evt);
    if (unhandled) router.push("/redaktion/chat");
  }
  return (
    <button type="button" className="shell-aibtn" onClick={open} aria-haspopup={hasPanel ? "dialog" : undefined}>
      <Bot size={18} aria-hidden="true" />
      <span className="shell-aibtn-text">AI-operatør</span>
      {hasPanel ? <kbd className="shell-kbd" aria-label="genvej Command K eller Control K">⌘K</kbd> : null}
    </button>
  );
}
