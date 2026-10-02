"use client";

import { useMemo, useState } from "react";
import { ImageIcon, Search, TriangleAlert, X } from "lucide-react";
import type { MediaOption } from "@/lib/editor/types";

/** Billedvælger (inline panel, ikke modal): søg + miniaturer. Tastaturbetjent; Esc lukker. */
export function MediaPicker({ media, selectedId, onSelect, onClose, label = "Vælg billede" }: { media: MediaOption[]; selectedId?: string | null; onSelect: (m: MediaOption) => void; onClose: () => void; label?: string }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? media.filter((m) => `${m.filnavn ?? ""} ${m.billedtekst ?? ""} ${m.altTekst ?? ""}`.toLowerCase().includes(needle)) : media;
    return list.slice(0, 60);
  }, [media, q]);
  return (
    <div className="cms-picker" role="dialog" aria-label={label} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="cms-picker-head">
        <label className="cms-search"><Search size={16} aria-hidden="true" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søg i mediebiblioteket" aria-label="Søg i mediebiblioteket" autoFocus /></label>
        <button type="button" className="cms-icon-btn" onClick={onClose} aria-label="Luk billedvælger"><X size={18} aria-hidden="true" /></button>
      </div>
      {shown.length === 0 ? (
        <p className="cms-muted cms-picker-empty">Ingen billeder fundet. Upload under Medier.</p>
      ) : (
        <ul className="cms-picker-grid">
          {shown.map((m) => (
            <li key={m.id}>
              <button type="button" className="cms-picker-item" aria-pressed={selectedId === m.id} onClick={() => onSelect(m)} title={m.billedtekst || m.filnavn || ""}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.altTekst ?? ""} loading="lazy" />
                <span className="cms-picker-name">{m.filnavn || m.billedtekst || "Billede"}</span>
                {!m.altTekst && <span className="cms-picker-warn"><TriangleAlert size={12} aria-hidden="true" /> Mangler alt</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Feltet "Featurebillede": preview, skift, rediger (medie-biblioteket), fjern + alt-/kredit-tjek. */
export function CoverField({ media, value, onChange, label = "Featurebillede", onSuggestAlt, altSuggestion }: {
  media: MediaOption[]; value: string; onChange: (id: string) => void; label?: string; onSuggestAlt?: (m: MediaOption) => React.ReactNode; altSuggestion?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const current = media.find((m) => m.id === value) ?? null;
  return (
    <div className="cms-field">
      <span className="cms-label" id="cover-label">{label}</span>
      {current ? (
        <div className="cms-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cms-cover-img" src={current.url} alt={current.altTekst ?? ""} />
          <div className="cms-cover-body">
            <p className="cms-cover-name">{current.filnavn || current.billedtekst || "Billede"}</p>
            <ul className="cms-checks" aria-label="Billedtjek">
              <li className={current.altTekst ? "is-ok" : "is-warn"}>{current.altTekst ? "Alt-tekst findes" : "Mangler alt-tekst (tilgængelighed og SEO)"}</li>
              <li className={current.ophavsperson ? "is-ok" : "is-warn"}>{current.ophavsperson ? `Kreditering: ${current.ophavsperson}` : "Mangler kreditering (fotograf)"}</li>
            </ul>
            <div className="cms-row-actions">
              <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setOpen(true)}>Skift</button>
              <a className="cms-btn cms-btn-secondary" href="/redaktion/medier" target="_blank" rel="noopener noreferrer">Rediger i medier</a>
              <button type="button" className="cms-btn cms-btn-quiet" onClick={() => onChange("")}>Fjern</button>
              {onSuggestAlt?.(current)}
            </div>
            {altSuggestion}
          </div>
        </div>
      ) : (
        <button type="button" className="cms-dropzone" onClick={() => setOpen(true)} aria-labelledby="cover-label">
          <ImageIcon size={22} aria-hidden="true" /> <span>Vælg et billede fra mediebiblioteket</span>
        </button>
      )}
      {open && <MediaPicker media={media} selectedId={value} onClose={() => setOpen(false)} onSelect={(m) => { onChange(m.id); setOpen(false); }} />}
    </div>
  );
}
