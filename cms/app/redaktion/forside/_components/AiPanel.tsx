"use client";

import { useState, useTransition } from "react";
import { Check, Sparkles, X } from "lucide-react";
import type { ModuleInstance } from "@/lib/frontpage/layout-schema";
import { applyOps } from "@/lib/frontpage/nl-commands";
import { applyPinsAction, interpretCommandAction, logAiDecisionAction, type CommandPreview } from "../editor-actions";
import { describeOp } from "../_lib/describe-ops";
import type { Msg } from "../_lib/messages";
import { Notice } from "./ui";

interface Props {
  modules: ModuleInstance[];
  canUse: boolean;
  canPin: boolean;
  aiConfigured: boolean;
  onApply: (modules: ModuleInstance[], summary: string) => void;
}

const EXAMPLE = "Sæt den vigtigste politiske sag i toppen og læg en sponsoreret boks efter tredje historie";

/** AI-hjælp i editoren: foreslå layout + naturligt-sprog-kommando. Altid kun forslag: redaktøren ser en diff og skal bekræfte. */
export function AiPanel({ modules, canUse, canPin, aiConfigured, onApply }: Props) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<(CommandPreview & { kind: "foreslaa-layout" | "nl-kommando"; text: string }) | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [pending, start] = useTransition();

  const run = (kind: "foreslaa-layout" | "nl-kommando") => {
    setMsg(null);
    setPreview(null);
    start(async () => {
      const res = await interpretCommandAction({ text: kind === "nl-kommando" ? text : "Foreslå layout", modules, purpose: kind === "foreslaa-layout" ? "suggest-layout" : "command" });
      if (!res.ok) {
        setMsg({ tone: res.code === "ai-unavailable" || res.code === "rate-limited" ? "warn" : "error", text: res.message });
        return;
      }
      const { ok: _ok, ...rest } = res;
      void _ok;
      setPreview({ ...rest, kind, text });
    });
  };

  const apply = () => {
    if (!preview) return;
    const result = applyOps(modules, preview.ops, { candidateIds: new Set(preview.candidateIds) });
    const layoutOps = result.applied.filter((o) => o.op !== "pin_article" && o.op !== "unpin_article");
    const summary = `${layoutOps.length} layoutændring(er)${result.pins.length ? `, ${result.pins.length} fastgørelse(r)` : ""}`;
    start(async () => {
      let pinNote = "";
      if (result.pins.length && canPin) {
        const typeOf = (id: string) => result.modules.find((m) => m.id === id)?.type;
        const pins = result.pins.flatMap((p) => {
          const t = p.moduleId ? typeOf(p.moduleId) : p.moduleType;
          return t && p.slotIndex !== undefined ? [{ articleId: p.articleId, moduleType: t, slotIndex: p.slotIndex }] : t ? [{ articleId: p.articleId, moduleType: t, slotIndex: 0 }] : [];
        });
        const r = pins.length ? await applyPinsAction({ pins }) : null;
        if (r) pinNote = r.ok ? ` ${r.created} artikel(er) fastgjort i 48 timer${r.skipped.length ? `; sprunget over: ${r.skipped.join(" ")}` : ""}.` : ` Fastgørelse mislykkedes: ${r.message}`;
      } else if (result.pins.length) pinNote = " Fastgørelser kræver rettigheden til forsidestyring og blev ikke udført.";
      if (layoutOps.length) onApply(result.modules, summary);
      void logAiDecisionAction({ kind: preview.kind, outcome: "anvendt", summary });
      setMsg({ tone: result.rejected.length ? "warn" : "ok", text: `Anvendt i kladden (kan fortrydes): ${summary}.${result.rejected.length ? ` ${result.rejected.length} ændring(er) blev afvist af layoutreglerne: ${result.rejected.map((r) => r.reason).join(" ")}` : ""}${pinNote}` });
      setPreview(null);
    });
  };

  const discard = () => {
    if (preview) void logAiDecisionAction({ kind: preview.kind, outcome: "kasseret", summary: `${preview.ops.length} operation(er)` });
    setPreview(null);
    setMsg({ tone: "info", text: "Forslaget er kasseret. Intet er ændret." });
  };

  if (!canUse) {
    return (
      <section className="fpe-panel" aria-labelledby="fpe-ai-h">
        <h3 className="fpe-h3" id="fpe-ai-h"><Sparkles size={16} aria-hidden="true" /> AI-hjælp</h3>
        <p className="fpe-muted">Din rolle har ikke rettighed til AI-hjælp i forsideeditoren. Resten af editoren virker som normalt.</p>
      </section>
    );
  }

  return (
    <section className="fpe-panel" aria-labelledby="fpe-ai-h">
      <h3 className="fpe-h3" id="fpe-ai-h"><Sparkles size={16} aria-hidden="true" /> AI-hjælp</h3>
      <p className="fpe-muted">AI foreslår kun. Du ser alle ændringer som en liste og skal selv trykke Anvend. Intet publiceres, og alle AI-handlinger logges.</p>
      {!aiConfigured && <p className="fpe-notice fpe-notice--warn" role="note">AI er ikke sat op i dette miljø (API-nøgle mangler). Du kan stadig redigere forsiden uden AI.</p>}
      <div className="fpe-field">
        <label htmlFor="fpe-nl">Skriv hvad der skal ændres</label>
        <textarea id="fpe-nl" className="fpe-input" rows={3} maxLength={500} placeholder={EXAMPLE} value={text} onChange={(e) => setText(e.target.value)} disabled={pending} />
        <span className="fpe-help">{text.length}/500 tegn. Eksempel: &quot;{EXAMPLE}&quot;</span>
      </div>
      <div className="fpe-row">
        <button type="button" className="fpe-btn" onClick={() => run("nl-kommando")} disabled={pending || !text.trim() || !aiConfigured}>
          {pending ? "Tænker…" : "Vis forslag til ændringer"}
        </button>
        <button type="button" className="fpe-btn fpe-btn--ghost" onClick={() => run("foreslaa-layout")} disabled={pending || !aiConfigured}>
          Foreslå layout ud fra dagens artikler
        </button>
      </div>
      <Notice msg={msg} onClose={() => setMsg(null)} />
      {preview && (
        <div className="fpe-ai-preview" aria-live="polite">
          <h4 className="fpe-h4">Foreslåede ændringer</h4>
          {preview.forklaring && <p className="fpe-muted">{preview.forklaring}</p>}
          {preview.afklaring && <p className="fpe-notice fpe-notice--info" role="note">AI spørger: {preview.afklaring}</p>}
          {preview.ops.length === 0 ? (
            <p className="fpe-empty">AI foreslog ingen ændringer, der kan udføres.</p>
          ) : (
            <ol className="fpe-op-list">
              {preview.ops.map((o, i) => (
                <li key={i}>{describeOp(o, modules, preview.titles)}</li>
              ))}
            </ol>
          )}
          {preview.rejected.length > 0 && (
            <details className="fpe-rules" open>
              <summary>{preview.rejected.length} forslag afvist af hvidlisten</summary>
              <ul>
                {preview.rejected.map((r, i) => (
                  <li key={i}>{r.reason}</li>
                ))}
              </ul>
            </details>
          )}
          {preview.ops.some((o) => o.op === "pin_article" || o.op === "unpin_article") && <p className="fpe-help">Fastgørelser påvirker forslaget til forsiden (48 timer), ikke layoutet. De udføres kun, hvis du har rettigheden til forsidestyring.</p>}
          <div className="fpe-row">
            <button type="button" className="fpe-btn" onClick={apply} disabled={pending || preview.ops.length === 0}>
              <Check size={16} aria-hidden="true" /> Anvend i kladden
            </button>
            <button type="button" className="fpe-btn fpe-btn--ghost" onClick={discard} disabled={pending}>
              <X size={16} aria-hidden="true" /> Kassér
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
