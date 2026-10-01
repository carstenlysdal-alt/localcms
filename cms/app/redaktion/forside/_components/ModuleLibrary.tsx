"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { ModuleInstance } from "@/lib/frontpage/layout-schema";
import { MODULE_LIST } from "@/lib/frontpage/modules";
import { TEMPLATES, type TemplateDef } from "@/lib/frontpage/templates";
import type { ModuleTypeId } from "@/lib/frontpage/types";
import { Badge } from "./ui";

interface Props {
  modules: ModuleInstance[];
  canEdit: boolean;
  onAdd: (type: ModuleTypeId) => void;
  onApplyTemplate: (templateId: string, params: Record<string, string | number>) => void;
}

export function ModuleLibrary({ modules, canEdit, onAdd, onApplyTemplate }: Props) {
  const [q, setQ] = useState("");
  const list = useMemo(() => MODULE_LIST.filter((d) => `${d.label} ${d.beskrivelse}`.toLowerCase().includes(q.trim().toLowerCase())), [q]);
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of modules) c.set(m.type, (c.get(m.type) ?? 0) + 1);
    return c;
  }, [modules]);
  const templates = TEMPLATES.filter((t) => `${t.navn} ${t.beskrivelse}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="fpe-library">
      <div className="fpe-search">
        <Search size={16} aria-hidden="true" />
        <label className="sr-only" htmlFor="fpe-lib-search">
          Søg i modul- og skabelonbiblioteket
        </label>
        <input id="fpe-lib-search" className="fpe-input" type="search" placeholder="Søg modul eller skabelon" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <h3 className="fpe-h3">Moduler</h3>
      <ul className="fpe-lib-list">
        {list.map((d) => {
          const used = counts.get(d.id) ?? 0;
          const full = used >= d.maxInstances;
          return (
            <li key={d.id} className="fpe-lib-item">
              <div className="fpe-lib-text">
                <strong>{d.label}</strong>
                <span className="fpe-lib-desc">{d.beskrivelse}</span>
                <span className="fpe-lib-meta">
                  {d.slots.min === d.slots.max ? `${d.slots.min} slot` : `${d.slots.min}–${d.slots.max} slots`} · {used}/{d.maxInstances} brugt
                  {d.kind === "dynamisk" && <> · <Badge>Dynamisk</Badge></>}
                  {d.isBreak && <> · <Badge tone="accent">Break</Badge></>}
                </span>
              </div>
              <button type="button" className="fpe-btn fpe-btn--small" onClick={() => onAdd(d.id)} disabled={!canEdit || full} title={full ? `Højst ${d.maxInstances} ${d.label} i ét layout` : undefined} aria-label={`Tilføj ${d.label} til layoutet`}>
                <Plus size={15} aria-hidden="true" /> Tilføj
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="fpe-empty">Ingen moduler matcher søgningen.</li>}
      </ul>

      <h3 className="fpe-h3">Skabeloner</h3>
      <ul className="fpe-lib-list">
        {templates.map((t) => (
          <TemplateItem key={t.id} template={t} canEdit={canEdit} onApply={onApplyTemplate} />
        ))}
        {templates.length === 0 && <li className="fpe-empty">Ingen skabeloner matcher søgningen.</li>}
      </ul>
    </div>
  );
}

function TemplateItem({ template: t, canEdit, onApply }: { template: TemplateDef; canEdit: boolean; onApply: Props["onApplyTemplate"] }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(t.params.map((p) => [p.key, String(p.default)])));
  const params = () => {
    const out: Record<string, string | number> = {};
    for (const p of t.params) out[p.key] = p.type === "number" ? Number(values[p.key]) : values[p.key];
    return out;
  };
  return (
    <li className="fpe-lib-item fpe-lib-item--col">
      <div className="fpe-lib-row">
        <div className="fpe-lib-text">
          <strong>{t.navn}</strong>
          <span className="fpe-lib-desc">{t.beskrivelse}</span>
        </div>
        <button type="button" className="fpe-btn fpe-btn--small fpe-btn--ghost" onClick={() => (t.params.length ? setOpen((o) => !o) : onApply(t.id, {}))} disabled={!canEdit} aria-expanded={t.params.length ? open : undefined} aria-label={`Anvend skabelonen ${t.navn}`}>
          Anvend…
        </button>
      </div>
      {open && t.params.length > 0 && (
        <form
          className="fpe-template-form"
          onSubmit={(e) => {
            e.preventDefault();
            onApply(t.id, params());
          }}
        >
          {t.params.map((p) => (
            <div className="fpe-field" key={p.key}>
              <label htmlFor={`tpl-${t.id}-${p.key}`}>{p.label}</label>
              {p.type === "enum" ? (
                <select id={`tpl-${t.id}-${p.key}`} className="fpe-input" value={values[p.key]} onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}>
                  {p.options.map((o) => (
                    <option key={o} value={o}>
                      {getTemplateOptionLabel(o)}
                    </option>
                  ))}
                </select>
              ) : (
                <input id={`tpl-${t.id}-${p.key}`} className="fpe-input" type={p.type === "number" ? "number" : "text"} min={p.type === "number" ? p.min : undefined} max={p.type === "number" ? p.max : undefined} value={values[p.key]} onChange={(e) => setValues({ ...values, [p.key]: e.target.value })} />
              )}
            </div>
          ))}
          <button type="submit" className="fpe-btn fpe-btn--small">
            Fortsæt…
          </button>
        </form>
      )}
    </li>
  );
}

const OPTION_LABELS: Record<string, string> = { "ad-break": "Annonce", "sponsoreret-break": "Sponsoreret boks", "partner-break": "Partner-boks", "egen-promo": "Egen promo" };
export const getTemplateOptionLabel = (o: string) => OPTION_LABELS[o] ?? o;
