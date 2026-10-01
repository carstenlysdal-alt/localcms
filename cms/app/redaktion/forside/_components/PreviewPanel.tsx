"use client";

import { useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";

const WIDTHS = [375, 768, 1440] as const;
const HEIGHTS: Record<number, number> = { 375: 760, 768: 900, 1440: 900 };

interface Props {
  draftId: string | null;
  version: number | null;
  dirty: boolean;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
}

/** Live preview i iframe ved 375/768/1440 px. Viser den GEMTE kladde (preview-ruten læser fra databasen). */
export function PreviewPanel({ draftId, version, dirty, canSave, saving, onSave }: Props) {
  const [width, setWidth] = useState<number>(375);
  const [source, setSource] = useState<"draft" | "live">("draft");
  const box = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = Math.min(1, avail / width);
  const height = HEIGHTS[width];
  const useDraft = source === "draft" && draftId;
  const src = useDraft ? `/redaktion/forside/preview?draft=${draftId}&v=${version ?? 0}` : "/redaktion/forside/preview?draft=live";

  return (
    <section className="fpe-panel fpe-preview" aria-labelledby="fpe-preview-h">
      <div className="fpe-panel-head">
        <h3 className="fpe-h3" id="fpe-preview-h">Forhåndsvisning</h3>
        <div className="fpe-seg" role="radiogroup" aria-label="Bredde">
          {WIDTHS.map((w) => (
            <label key={w} className={`fpe-seg-opt${width === w ? " is-on" : ""}`}>
              <input type="radio" name="fpe-pw" checked={width === w} onChange={() => setWidth(w)} /> {w} px
            </label>
          ))}
        </div>
        <div className="fpe-seg" role="radiogroup" aria-label="Hvad skal vises">
          <label className={`fpe-seg-opt${source === "draft" ? " is-on" : ""}`}>
            <input type="radio" name="fpe-ps" checked={source === "draft"} onChange={() => setSource("draft")} /> Kladde
          </label>
          <label className={`fpe-seg-opt${source === "live" ? " is-on" : ""}`}>
            <input type="radio" name="fpe-ps" checked={source === "live"} onChange={() => setSource("live")} /> Live
          </label>
        </div>
      </div>
      {source === "draft" && (dirty || !draftId) && (
        <p className="fpe-notice fpe-notice--info" role="status">
          {draftId ? "Forhåndsvisningen viser den gemte kladde. Du har ugemte ændringer." : "Gem kladden for at se en forhåndsvisning."}
          {canSave && (
            <button type="button" className="fpe-btn fpe-btn--small" onClick={onSave} disabled={saving}>
              <Save size={15} aria-hidden="true" /> {saving ? "Gemmer…" : "Gem og opdatér"}
            </button>
          )}
        </p>
      )}
      <div ref={box} className="fpe-preview-box" style={{ height: (source === "draft" && !draftId ? 120 : height) * scale }}>
        {source === "draft" && !draftId ? (
          <p className="fpe-empty">Ingen forhåndsvisning endnu.</p>
        ) : (
          <iframe key={src} title={`Forhåndsvisning af forsiden ved ${width} pixel`} src={src} loading="lazy" style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }} />
        )}
      </div>
      <p className="fpe-help">Forhåndsvisningen bruger sitets rigtige CSS, dagens artikler og almindelig rangering. Intet her er live, og der måles ikke.</p>
    </section>
  );
}
