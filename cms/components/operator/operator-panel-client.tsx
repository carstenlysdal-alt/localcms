"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import type { CapabilityGroup } from "@/lib/operator/capabilities";
import type { ProviderInfo } from "@/lib/operator/llm/types";
import { OperatorSurface, ProviderNotice } from "./operator-surface";
import "./operator.css";

/** Flydende AI-operatør på alle /redaktion-sider. Åbnes med knappen eller Cmd/Ctrl+K; Esc lukker. */
export function OperatorPanelClient({ capabilities, roleName, provider = null }: { capabilities: CapabilityGroup[]; roleName: string; provider?: ProviderInfo | null }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  const onFullPage = path.startsWith("/redaktion/operator");

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen((v) => {
          if (v) triggerRef.current?.focus();
          return false;
        });
      }
    }
    // Topbarens AI-operatør-knap sender cms:operator-open; preventDefault melder "panelet tog den" (ellers åbnes fuld side).
    function onOpenEvent(e: Event) {
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("cms:operator-open", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cms:operator-open", onOpenEvent);
    };
  }, []);

  if (onFullPage) return null;

  return (
    <>
      <button ref={triggerRef} type="button" className="op-fab" onClick={() => setOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={open} aria-controls="op-panel" aria-keyshortcuts="Control+K Meta+K" hidden={open}>
        <Sparkles size={18} aria-hidden="true" /> AI-operatør <kbd className="op-kbd" aria-hidden="true">⌘K</kbd>
      </button>
      <section id="op-panel" className="op-panel" role="dialog" aria-modal="false" aria-label="AI-operatør" hidden={!open}>
        <header className="op-panel-head">
          <h2><Sparkles size={16} aria-hidden="true" /> AI-operatør</h2>
          <button type="button" className="op-icon-btn" onClick={close} aria-label="Luk AI-operatøren">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <ProviderNotice provider={provider} />
        <OperatorSurface capabilities={capabilities} roleName={roleName} provider={provider} variant="panel" active={open} />
      </section>
    </>
  );
}
