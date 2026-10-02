"use client";

import { Check, X } from "lucide-react";
import { PLATFORM_SPECS, SOCIAL_PLATFORMS, postLength, type SocialPlatform } from "@/lib/article-meta";
import type { AiEntry, AiOk } from "./use-editorial-ai";
import type { EditorialTask, TaskResult } from "@/lib/ai/editorial-schemas";
import { AiChip } from "./primitives";

export type SuggestionActions = {
  applyTitle: (titel: string) => void;
  applyManchet: (manchet: string) => void;
  applySlug: (slug: string) => void;
  applySeo: (v: { seoTitel: string; seoBeskrivelse: string }) => void;
  applyOg: (v: TaskResult["og"]) => void;
  applySocial: (platform: SocialPlatform, v: { tekst: string; hashtags: string[] }) => void;
  applyTags: (names: string[]) => void;
  applyGeo: (names: string[]) => void;
  applySummary: (v: TaskResult["summary"]) => void;
  applyTime: (hhmm: string) => void;
};

function Row({ children }: { children: React.ReactNode }) {
  return <li className="cms-suggestion-row">{children}</li>;
}
function Apply({ onClick, label = "Anvend" }: { onClick: () => void; label?: string }) {
  return <button type="button" className="cms-btn cms-btn-primary-soft" onClick={onClick}><Check size={14} aria-hidden="true" /> {label}</button>;
}

/** Viser et AI-forslag som "Anvend/Kassér"-chips. Intet ændres før redaktøren klikker Anvend. */
export function SuggestionTray({ task, entry, onDismiss, actions }: { task: EditorialTask; entry: AiEntry | undefined; onDismiss: () => void; actions: SuggestionActions }) {
  if (!entry) return null;
  if (entry.status === "loading") return <div className="cms-suggestion" aria-busy="true"><AiChip>AI</AiChip> <span className="cms-muted">Henter forslag…</span></div>;
  if (entry.status === "error") {
    return (
      <div className="cms-suggestion is-error" role="alert">
        <span>{entry.error}</span>
        <button type="button" className="cms-icon-btn" onClick={onDismiss} aria-label="Luk besked"><X size={16} aria-hidden="true" /></button>
      </div>
    );
  }
  const r = entry.response;
  return (
    <div className="cms-suggestion" role="group" aria-label={`AI-forslag: ${task}`}>
      <div className="cms-suggestion-head">
        <AiChip>AI-forslag — ikke anvendt</AiChip>
        <button type="button" className="cms-btn cms-btn-quiet" onClick={onDismiss}><X size={14} aria-hidden="true" /> Kassér</button>
      </div>
      <SuggestionBody task={task} r={r} actions={actions} />
    </div>
  );
}

function SuggestionBody({ task, r, actions }: { task: EditorialTask; r: AiOk; actions: SuggestionActions }) {
  switch (task) {
    case "headlines": {
      const s = r.suggestion as TaskResult["headlines"];
      return (
        <ul className="cms-suggestion-list">
          {s.varianter.map((v, i) => (
            <Row key={i}><div className="cms-suggestion-text"><strong>{v.titel}</strong>{v.begrundelse && <small className="cms-muted">{v.begrundelse}</small>}<small className="cms-muted">{Array.from(v.titel).length} tegn</small></div><Apply onClick={() => actions.applyTitle(v.titel)} /></Row>
          ))}
          {s.abPar && (
            <Row><div className="cms-suggestion-text"><small className="cms-muted">A/B-par til test</small><span>A: {s.abPar.a}</span><span>B: {s.abPar.b}</span></div>
              <span className="cms-row-actions"><Apply label="Brug A" onClick={() => actions.applyTitle(s.abPar!.a)} /><Apply label="Brug B" onClick={() => actions.applyTitle(s.abPar!.b)} /></span></Row>
          )}
        </ul>
      );
    }
    case "subheading": {
      const s = r.suggestion as TaskResult["subheading"];
      return <ul className="cms-suggestion-list"><Row><div className="cms-suggestion-text"><span>{s.manchet}</span><small className="cms-muted">{Array.from(s.manchet).length} tegn</small></div><Apply onClick={() => actions.applyManchet(s.manchet)} /></Row></ul>;
    }
    case "slug": {
      const s = r.suggestion as TaskResult["slug"];
      return <ul className="cms-suggestion-list"><Row><code className="cms-mono">{s.slug}</code><Apply onClick={() => actions.applySlug(s.slug)} /></Row></ul>;
    }
    case "seo": {
      const s = r.suggestion as TaskResult["seo"];
      return (
        <ul className="cms-suggestion-list">
          <Row><div className="cms-suggestion-text"><small className="cms-muted">SEO-titel ({Array.from(s.seoTitel).length}/60)</small><span>{s.seoTitel}</span><small className="cms-muted">Metabeskrivelse ({Array.from(s.seoBeskrivelse).length}/155)</small><span>{s.seoBeskrivelse}</span></div><Apply label="Anvend begge" onClick={() => actions.applySeo(s)} /></Row>
        </ul>
      );
    }
    case "og": {
      const s = r.suggestion as TaskResult["og"];
      return (
        <ul className="cms-suggestion-list">
          <Row><div className="cms-suggestion-text"><small className="cms-muted">OG-titel</small><span>{s.ogTitel}</span><small className="cms-muted">OG-beskrivelse</small><span>{s.ogBeskrivelse}</span><small className="cms-muted">X-titel</small><span>{s.twitterTitel}</span><small className="cms-muted">X-beskrivelse</small><span>{s.twitterBeskrivelse}</span></div><Apply label="Anvend alle" onClick={() => actions.applyOg(s)} /></Row>
        </ul>
      );
    }
    case "social": {
      const s = r.suggestion as TaskResult["social"];
      const platforms = SOCIAL_PLATFORMS.filter((p) => s.opslag[p]);
      return (
        <ul className="cms-suggestion-list">
          {platforms.map((p) => {
            const post = s.opslag[p]!;
            return (
              <Row key={p}>
                <div className="cms-suggestion-text">
                  <small className="cms-muted">{PLATFORM_SPECS[p].label} · {postLength(p, { tekst: post.tekst, hashtags: post.hashtags })}/{PLATFORM_SPECS[p].max}</small>
                  <span>{post.tekst}</span>
                  {post.hashtags.length > 0 && <small className="cms-muted">{post.hashtags.map((h) => `#${h}`).join(" ")}</small>}
                </div>
                <Apply onClick={() => actions.applySocial(p, post)} />
              </Row>
            );
          })}
          {platforms.length > 1 && <li className="cms-suggestion-foot"><Apply label="Anvend alle platforme" onClick={() => platforms.forEach((p) => actions.applySocial(p, s.opslag[p]!))} /></li>}
        </ul>
      );
    }
    case "tagsGeo": {
      const s = r.suggestion as TaskResult["tagsGeo"];
      return (
        <ul className="cms-suggestion-list">
          <Row>
            <div className="cms-suggestion-text">
              <small className="cms-muted">Eksisterende tags</small>
              <span>{s.eksisterendeTags.length ? s.eksisterendeTags.join(", ") : "Ingen passende"}</span>
              <small className="cms-muted">Eksisterende områder</small>
              <span>{s.eksisterendeGeo.length ? s.eksisterendeGeo.join(", ") : "Ingen passende"}</span>
              {(s.nyeTags.length > 0 || s.nyeGeo.length > 0) && <small className="cms-muted">Forslag til nye (oprettes under Emner/Områder): {[...s.nyeTags, ...s.nyeGeo].join(", ")}</small>}
            </div>
            <Apply label="Tilføj eksisterende" onClick={() => { actions.applyTags(s.eksisterendeTags); actions.applyGeo(s.eksisterendeGeo); }} />
          </Row>
        </ul>
      );
    }
    case "summary": {
      const s = r.suggestion as TaskResult["summary"];
      return (
        <ul className="cms-suggestion-list">
          <Row><div className="cms-suggestion-text"><span>{s.tldr}</span><ul className="cms-bullets">{s.punkter.map((p, i) => <li key={i}>{p}</li>)}</ul></div><Apply label="Indsæt som faktaboks" onClick={() => actions.applySummary(s)} /></Row>
        </ul>
      );
    }
    case "factcheck": {
      const s = r.suggestion as TaskResult["factcheck"];
      return (
        <ul className="cms-suggestion-list">
          {s.markeringer.length === 0 && <li className="cms-muted">Ingen kontrollérbare udsagn fundet.</li>}
          {s.markeringer.map((m, i) => (
            <Row key={i}>
              <div className="cms-suggestion-text">
                <span><span className={`cms-fact cms-fact-${m.status}`}>{m.status === "groen" ? "Grøn" : m.status === "gul" ? "Gul" : "Rød"}</span> {m.udsagn}</span>
                <small className="cms-muted">{m.begrundelse}{m.kilde ? ` (kilde ${m.kilde})` : ""}</small>
              </div>
            </Row>
          ))}
          <li className="cms-muted cms-suggestion-foot">Faktatjekket bruger kun de kilder, du har angivet. Det erstatter ikke journalistisk kontrol.</li>
        </ul>
      );
    }
    case "seoComment": {
      const s = r.suggestion as TaskResult["seoComment"];
      return <div className="cms-suggestion-text"><p>{s.kommentar}</p>{s.prioriteter.length > 0 && <ol className="cms-bullets">{s.prioriteter.map((p, i) => <li key={i}>{p}</li>)}</ol>}</div>;
    }
    case "publishTime": {
      const s = r.suggestion as TaskResult["publishTime"];
      return (
        <ul className="cms-suggestion-list">
          {s.forslag.map((f, i) => <Row key={i}><div className="cms-suggestion-text"><strong>{f.tidspunkt} ({f.dagsdel})</strong><small className="cms-muted">{f.begrundelse}</small></div><Apply label="Brug tidspunkt" onClick={() => actions.applyTime(f.tidspunkt)} /></Row>)}
          {s.note && <li className="cms-muted cms-suggestion-foot">{s.note}</li>}
        </ul>
      );
    }
    default:
      return null;
  }
}

/** Alt-tekst-forslag til en billedblok (egen lille visning, fordi den ændrer blokken, ikke artikelfelterne). */
export function AltSuggestion({ entry, onApply, onDismiss }: { entry: AiEntry | undefined; onApply: (v: { altTekst: string; billedtekst?: string }) => void; onDismiss: () => void }) {
  if (!entry) return null;
  if (entry.status === "loading") return <div className="cms-suggestion" aria-busy="true"><AiChip /> <span className="cms-muted">Henter forslag…</span></div>;
  if (entry.status === "error") return <div className="cms-suggestion is-error" role="alert"><span>{entry.error}</span><button type="button" className="cms-icon-btn" onClick={onDismiss} aria-label="Luk besked"><X size={16} aria-hidden="true" /></button></div>;
  const s = entry.response.suggestion as TaskResult["altText"];
  return (
    <div className="cms-suggestion" role="group" aria-label="AI-forslag til alt-tekst">
      <div className="cms-suggestion-head"><AiChip>AI-forslag — tjek mod billedet</AiChip><button type="button" className="cms-btn cms-btn-quiet" onClick={onDismiss}><X size={14} aria-hidden="true" /> Kassér</button></div>
      <ul className="cms-suggestion-list"><Row><div className="cms-suggestion-text"><small className="cms-muted">Alt-tekst ({Array.from(s.altTekst).length}/125)</small><span>{s.altTekst}</span>{s.billedtekst && <><small className="cms-muted">Billedtekst</small><span>{s.billedtekst}</span></>}</div><Apply onClick={() => onApply(s)} /></Row></ul>
    </div>
  );
}

/** Forbedr-tekst-forslag til en afsnitsblok. */
export function ImproveSuggestion({ entry, onApply, onDismiss }: { entry: AiEntry | undefined; onApply: (html: string) => void; onDismiss: () => void }) {
  if (!entry) return null;
  if (entry.status === "loading") return <div className="cms-suggestion" aria-busy="true"><AiChip /> <span className="cms-muted">Bearbejder teksten…</span></div>;
  if (entry.status === "error") return <div className="cms-suggestion is-error" role="alert"><span>{entry.error}</span><button type="button" className="cms-icon-btn" onClick={onDismiss} aria-label="Luk besked"><X size={16} aria-hidden="true" /></button></div>;
  const s = entry.response.suggestion as TaskResult["improve"];
  return (
    <div className="cms-suggestion" role="group" aria-label="AI-forslag til bearbejdet tekst">
      <div className="cms-suggestion-head"><AiChip>AI-forslag — ikke anvendt</AiChip><button type="button" className="cms-btn cms-btn-quiet" onClick={onDismiss}><X size={14} aria-hidden="true" /> Kassér</button></div>
      <div className="cms-suggestion-text"><div className="cms-suggestion-preview" dangerouslySetInnerHTML={{ __html: previewHtml(s.tekst) }} />{s.noter && <small className="cms-muted">{s.noter}</small>}</div>
      <div className="cms-suggestion-foot"><Apply label="Anvend (erstatter afsnittet)" onClick={() => onApply(s.tekst)} /></div>
    </div>
  );
}

/** Forenklet, sikker visning af AI-tekst: al markup fjernes undtagen afsnit — AI-output sættes aldrig ind som rå HTML. */
export function previewHtml(text: string): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const plain = text.replace(/<\/p>\s*<p[^>]*>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "");
  return plain.split(/\n{2,}/).map((p) => `<p>${esc(p.trim())}</p>`).join("");
}
