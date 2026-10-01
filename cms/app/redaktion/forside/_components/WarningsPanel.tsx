"use client";

import { AlertTriangle, XOctagon } from "lucide-react";
import type { Violation } from "@/lib/frontpage/types";
import { collapseEmptySlots, groupViolations, violationTitle } from "../_lib/hints";

interface Props {
  issues: string[];
  violations: Violation[];
  hints: string[];
  filled?: number;
  total?: number;
  pending?: boolean;
  moduleName?: (id: string) => string;
}

/** Advarselspanel: kvoteloft, diversitet, manglende mærkning, tomme slots, AI-assisteret i hero m.m. fra rækværkene. */
export function WarningsPanel({ issues, violations, hints, filled, total, pending, moduleName }: Props) {
  const { blokerende, advarsler } = groupViolations(collapseEmptySlots(violations, moduleName));
  const where = (v: Violation) => (v.moduleId ? ` (${moduleName?.(v.moduleId) ?? v.moduleId}${v.slotIndex !== undefined ? `, slot ${v.slotIndex + 1}` : ""})` : "");
  const none = !issues.length && !violations.length && !hints.length;
  return (
    <section className="fpe-panel" aria-labelledby="fpe-warn-h" aria-busy={pending}>
      <h3 className="fpe-h3" id="fpe-warn-h">Advarsler</h3>
      {total !== undefined && total > 0 && (
        <p className="fpe-muted">
          Med dagens artikler fyldes {filled} af {total} slots (almindelig rangering).
        </p>
      )}
      {pending && <p className="fpe-muted">Kontrollerer mod rækværkene…</p>}
      {none && !pending && <p className="fpe-muted">Ingen advarsler.</p>}
      <ul className="fpe-warn-list">
        {issues.map((t) => (
          <li key={t} className="fpe-warn fpe-warn--error">
            <XOctagon size={16} aria-hidden="true" /> <span><strong>Layoutfejl:</strong> {t}</span>
          </li>
        ))}
        {blokerende.map((v, i) => (
          <li key={`b${i}`} className="fpe-warn fpe-warn--error">
            <XOctagon size={16} aria-hidden="true" /> <span><strong>{violationTitle(v)}</strong>{where(v)}: {v.besked}</span>
          </li>
        ))}
        {advarsler.map((v, i) => (
          <li key={`a${i}`} className="fpe-warn">
            <AlertTriangle size={16} aria-hidden="true" /> <span><strong>{violationTitle(v)}</strong>{where(v)}: {v.besked}</span>
          </li>
        ))}
        {hints.map((t) => (
          <li key={t} className="fpe-warn fpe-warn--hint">
            <AlertTriangle size={16} aria-hidden="true" /> <span>{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
