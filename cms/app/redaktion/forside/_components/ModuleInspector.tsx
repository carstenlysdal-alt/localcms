"use client";

import { useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { effectiveVariant, type ModuleInstance } from "@/lib/frontpage/layout-schema";
import { MODULE_REGISTRY } from "@/lib/frontpage/modules";
import type { Variant } from "@/lib/frontpage/types";
import { configFields, formToConfig, formValuesFromModule, type FieldContext, type FormValues } from "../_lib/config-fields";
import { BREAK_TYPES, breaksOf, type BreakType, type ModulePatch, type OpResult } from "../_lib/layout-ops";
import { getTemplateOptionLabel } from "./ModuleLibrary";

interface Props {
  module: ModuleInstance;
  modules: ModuleInstance[];
  fieldCtx: FieldContext;
  canEdit: boolean;
  onPatch: (id: string, patch: ModulePatch) => OpResult;
  onAddBreak: (hostId: string, type: BreakType, afterSlot: number, repeatEvery?: number) => OpResult;
  onRemoveBreak: (hostId: string, breakId: string) => void;
  onUpdateBreak: (hostId: string, breakId: string, patch: { afterSlot?: number; repeatEvery?: number | null }) => OpResult;
  onChangeBreakType: (hostId: string, breakId: string, type: BreakType) => OpResult;
}

const REGION_LABEL = { full: "Fuld bredde", main: "Hovedspalte (sammen med en sidespalte)", sidebar: "Sidespalte" } as const;

/** Konfigurationspanel genereret af modulets definition (slots, varianter, config-nøgler). Ændringer anvendes med "Anvend". */
export function ModuleInspector(p: Props) {
  const { module: m } = p;
  // Remount ved skift af modul/indhold så formularen altid afspejler layoutet (undo/redo).
  return <InspectorForm key={`${m.id}:${JSON.stringify(m)}`} {...p} />;
}

function InspectorForm({ module: m, modules, fieldCtx, canEdit, onPatch, onAddBreak, onRemoveBreak, onUpdateBreak, onChangeBreakType }: Props) {
  const def = MODULE_REGISTRY[m.type];
  const fields = configFields(m.type, fieldCtx);
  const [slots, setSlots] = useState(String(m.slots));
  const [variant, setVariant] = useState<Variant>(effectiveVariant(m));
  const [region, setRegion] = useState(m.region);
  const [visible, setVisible] = useState(m.visible);
  const [mode, setMode] = useState(m.mode);
  const [values, setValues] = useState<FormValues>(formValuesFromModule(m));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [brk, setBrk] = useState<{ type: BreakType; afterSlot: string; repeat: string }>({ type: "ad-break", afterSlot: "2", repeat: "" });
  const [brkError, setBrkError] = useState<string | null>(null);
  const inlineBreak = def.isBreak && m.config.placement === "inline";
  const nSlots = Number(slots);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const { config, errors: formErrors } = formToConfig(m.type, values);
    const errs = { ...formErrors };
    if (!Number.isInteger(nSlots) || nSlots < def.slots.min || nSlots > def.slots.max) errs.slots = `${def.slots.min}–${def.slots.max} slots.`;
    setErrors(errs);
    setGeneral(null);
    if (Object.keys(errs).length) return;
    const res = onPatch(m.id, { slots: nSlots, variant: variant === def.defaultVariant && !m.variant ? undefined : variant, region, visible, mode, config });
    if (!res.ok) setGeneral(res.error);
  };

  const setVal = (k: string, v: string | string[]) => setValues((cur) => ({ ...cur, [k]: v }));
  const id = (k: string) => `fpe-insp-${m.id}-${k}`;

  return (
    <div className="fpe-inspector">
      <h3 className="fpe-h3">{def.label}</h3>
      <p className="fpe-muted">{def.beskrivelse}</p>
      <details className="fpe-rules">
        <summary>Regler for dette modul</summary>
        <ul>
          {def.renderRules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>

      <form onSubmit={apply} className="fpe-form" aria-label={`Indstillinger for ${def.label}`}>
        {general && (
          <p className="fpe-error" role="alert">
            {general}
          </p>
        )}
        <div className="fpe-field">
          <label htmlFor={id("slots")}>Antal slots ({def.slots.min}–{def.slots.max})</label>
          <input id={id("slots")} className="fpe-input" type="number" min={def.slots.min} max={def.slots.max} value={slots} onChange={(e) => setSlots(e.target.value)} disabled={!canEdit || def.slots.min === def.slots.max} aria-invalid={Boolean(errors.slots)} aria-describedby={errors.slots ? id("slots-err") : undefined} />
          {errors.slots && <span className="fpe-error" id={id("slots-err")}>{errors.slots}</span>}
        </div>

        <div className="fpe-field">
          <label htmlFor={id("variant")}>Visning (variant)</label>
          <select id={id("variant")} className="fpe-input" value={variant} onChange={(e) => setVariant(e.target.value as Variant)} disabled={!canEdit || def.variants.length === 1}>
            {def.variants.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {!inlineBreak && (
          <div className="fpe-field">
            <label htmlFor={id("region")}>Placering på siden</label>
            <select id={id("region")} className="fpe-input" value={region} onChange={(e) => setRegion(e.target.value as ModuleInstance["region"])} disabled={!canEdit}>
              {(["full", "main", "sidebar"] as const).map((r) => (
                <option key={r} value={r}>
                  {REGION_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="fpe-field fpe-field--check">
          <input id={id("visible")} type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} disabled={!canEdit} />
          <label htmlFor={id("visible")}>Vis på forsiden</label>
        </div>

        <fieldset className="fpe-fieldset" disabled={!canEdit}>
          <legend>Tilstand</legend>
          <label className="fpe-radio">
            <input type="radio" name={id("mode")} checked={mode === "forslag"} onChange={() => setMode("forslag")} /> <span><strong>Forslag</strong> (standard): AI foreslår, en redaktør godkender, før noget går live.</span>
          </label>
          <label className="fpe-radio">
            <input type="radio" name={id("mode")} checked={mode === "auto"} onChange={() => setMode("auto")} /> <span><strong>Auto</strong>: publicering uden godkendelse.</span>
          </label>
          {mode === "auto" && (
            <p className="fpe-warning" role="note">
              <AlertTriangle size={16} aria-hidden="true" /> Auto er endnu ikke aktivt. Valget gemmes, men der findes ingen automatisk publicering: forsiden kræver stadig, at en redaktør godkender et forslag. Rækværkene gælder uændret.
            </p>
          )}
        </fieldset>

        {fields.map((f) => (
          <div className="fpe-field" key={f.key}>
            {f.kind === "multi" ? (
              <fieldset className="fpe-fieldset">
                <legend>{f.label}</legend>
                {f.options.map((o) => {
                  const cur = (values[f.key] as string[] | undefined) ?? [];
                  return (
                    <label key={o.value} className="fpe-radio">
                      <input type="checkbox" checked={cur.includes(o.value)} onChange={(e) => setVal(f.key, e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value))} disabled={!canEdit} /> {o.label}
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <>
                <label htmlFor={id(f.key)}>{f.label}</label>
                {f.kind === "select" ? (
                  <select id={id(f.key)} className="fpe-input" value={(values[f.key] as string) ?? ""} onChange={(e) => setVal(f.key, e.target.value)} disabled={!canEdit}>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input id={id(f.key)} className="fpe-input" type={f.kind === "number" ? "number" : "text"} min={f.kind === "number" ? f.min : undefined} max={f.kind === "number" ? f.max : undefined} maxLength={f.kind === "text" ? f.max : undefined} placeholder={f.kind === "number" ? f.placeholder : undefined} value={(values[f.key] as string) ?? ""} onChange={(e) => setVal(f.key, e.target.value)} disabled={!canEdit} aria-invalid={Boolean(errors[f.key])} aria-describedby={errors[f.key] ? id(`${f.key}-err`) : undefined} />
                )}
                {f.help && <span className="fpe-help">{f.help}</span>}
                {errors[f.key] && <span className="fpe-error" id={id(`${f.key}-err`)}>{errors[f.key]}</span>}
              </>
            )}
          </div>
        ))}

        {canEdit && (
          <button type="submit" className="fpe-btn">
            Anvend ændringer
          </button>
        )}
        <p className="fpe-help">Mærkning af artikler kan ikke slås fra eller ændres her: den udledes altid af artiklen.</p>
      </form>

      {def.breakHost && (
        <section className="fpe-breaks" aria-labelledby={id("breaks-h")}>
          <h4 className="fpe-h4" id={id("breaks-h")}>Break-punkter</h4>
          <p className="fpe-help">Indsæt en annonce, sponsoreret boks, partner-boks eller egen promo efter slot N.</p>
          <ul className="fpe-break-list">
            {breaksOf(modules, m).map(({ ref, module: b }) => (
              <BreakRow key={b.id} host={m} breakModule={b} afterSlot={ref.afterSlot} repeatEvery={ref.repeatEvery} canEdit={canEdit} onUpdate={onUpdateBreak} onRemove={onRemoveBreak} onChangeType={onChangeBreakType} />
            ))}
            {breaksOf(modules, m).length === 0 && <li className="fpe-empty">Ingen break-punkter.</li>}
          </ul>
          {canEdit && (
            <form
              className="fpe-break-add"
              onSubmit={(e) => {
                e.preventDefault();
                const res = onAddBreak(m.id, brk.type, Number(brk.afterSlot), brk.repeat && m.type === "seneste-nyt" ? Number(brk.repeat) : undefined);
                setBrkError(res.ok ? null : res.error);
              }}
            >
              <div className="fpe-field">
                <label htmlFor={id("brk-type")}>Type</label>
                <select id={id("brk-type")} className="fpe-input" value={brk.type} onChange={(e) => setBrk({ ...brk, type: e.target.value as BreakType })}>
                  {BREAK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {getTemplateOptionLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fpe-field">
                <label htmlFor={id("brk-after")}>Efter slot nr. (1–{m.slots})</label>
                <input id={id("brk-after")} className="fpe-input" type="number" min={1} max={m.slots} value={brk.afterSlot} onChange={(e) => setBrk({ ...brk, afterSlot: e.target.value })} />
              </div>
              {m.type === "seneste-nyt" && (
                <div className="fpe-field">
                  <label htmlFor={id("brk-rep")}>Gentag hver N. slot (valgfri)</label>
                  <input id={id("brk-rep")} className="fpe-input" type="number" min={2} max={20} value={brk.repeat} onChange={(e) => setBrk({ ...brk, repeat: e.target.value })} />
                </div>
              )}
              <button type="submit" className="fpe-btn fpe-btn--small">
                <Plus size={15} aria-hidden="true" /> Tilføj break
              </button>
              {brkError && <p className="fpe-error" role="alert">{brkError}</p>}
            </form>
          )}
        </section>
      )}
      {def.isBreak && !inlineBreak && <p className="fpe-help">Dette break står som egen række. Vil du indsætte et break midt i en liste eller et grid, så tilføj det som break-punkt på modulet (fx Top-grid eller Seneste nyt).</p>}
    </div>
  );
}

function BreakRow({ host, breakModule, afterSlot, repeatEvery, canEdit, onUpdate, onRemove, onChangeType }: { host: ModuleInstance; breakModule: ModuleInstance; afterSlot: number; repeatEvery?: number; canEdit: boolean; onUpdate: Props["onUpdateBreak"]; onRemove: Props["onRemoveBreak"]; onChangeType: Props["onChangeBreakType"] }) {
  const [err, setErr] = useState<string | null>(null);
  const [after, setAfter] = useState(String(afterSlot));
  const [rep, setRep] = useState(repeatEvery ? String(repeatEvery) : "");
  const name = getTemplateOptionLabel(breakModule.type);
  return (
    <li className="fpe-break-row">
      <div className="fpe-break-row-head">
        <label className="sr-only" htmlFor={`bt-${breakModule.id}`}>Type for break {breakModule.id}</label>
        <select id={`bt-${breakModule.id}`} className="fpe-input" value={breakModule.type} onChange={(e) => { const r = onChangeType(host.id, breakModule.id, e.target.value as BreakType); setErr(r.ok ? null : r.error); }} disabled={!canEdit}>
          {BREAK_TYPES.map((t) => (
            <option key={t} value={t}>{getTemplateOptionLabel(t)}</option>
          ))}
        </select>
        {canEdit && (
          <button type="button" className="fpe-iconbtn fpe-iconbtn--danger" onClick={() => onRemove(host.id, breakModule.id)} aria-label={`Fjern break ${name} efter slot ${afterSlot}`}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="fpe-break-row-fields">
        <label htmlFor={`ba-${breakModule.id}`}>Efter slot</label>
        <input id={`ba-${breakModule.id}`} className="fpe-input fpe-input--narrow" type="number" min={1} max={host.slots} value={after} onChange={(e) => setAfter(e.target.value)} onBlur={() => { if (Number(after) !== afterSlot) { const r = onUpdate(host.id, breakModule.id, { afterSlot: Number(after) }); setErr(r.ok ? null : r.error); if (!r.ok) setAfter(String(afterSlot)); } }} disabled={!canEdit} />
        {host.type === "seneste-nyt" && (
          <>
            <label htmlFor={`br-${breakModule.id}`}>Gentag hver</label>
            <input id={`br-${breakModule.id}`} className="fpe-input fpe-input--narrow" type="number" min={2} max={20} value={rep} placeholder="–" onChange={(e) => setRep(e.target.value)} onBlur={() => { const next = rep ? Number(rep) : null; if ((next ?? undefined) !== repeatEvery) { const r = onUpdate(host.id, breakModule.id, { repeatEvery: next }); setErr(r.ok ? null : r.error); if (!r.ok) setRep(repeatEvery ? String(repeatEvery) : ""); } }} disabled={!canEdit} />
          </>
        )}
      </div>
      {err && <p className="fpe-error" role="alert">{err}</p>}
    </li>
  );
}
