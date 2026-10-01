"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";
import { History, Redo2, Save, Send, Sparkles, Trash2, Undo2 } from "lucide-react";
import { applyTemplate, getTemplate } from "@/lib/frontpage/templates";
import { MODULE_REGISTRY } from "@/lib/frontpage/modules";
import type { ModuleInstance } from "@/lib/frontpage/layout-schema";
import type { ModuleTypeId } from "@/lib/frontpage/types";
import { analyzeLayoutAction, discardDraftAction, getDraftAction, publishDraftAction, saveDraftAction, type LayoutAnalysis } from "../editor-actions";
import type { DraftDTO, EditorData } from "../_lib/dto";
import { canRedo, canUndo, historyReducer, initHistory, isDirty } from "../_lib/editor-state";
import { layoutHints } from "../_lib/hints";
import {
  addInlineBreak,
  addModule,
  changeBreakType,
  describeLayoutDiff,
  duplicateModule,
  moveTopLevel,
  moveTopLevelBy,
  removeInlineBreak,
  removeModule,
  toggleVisible,
  updateBreakRef,
  updateModule,
  type BreakType,
  type ModulePatch,
  type OpResult,
} from "../_lib/layout-ops";
import { PUBLISH_NOTICE, serviceErrorMessage, type Msg } from "../_lib/messages";
import { AiPanel } from "./AiPanel";
import { ModuleCanvas } from "./ModuleCanvas";
import { ModuleInspector } from "./ModuleInspector";
import { ModuleLibrary } from "./ModuleLibrary";
import { PreviewPanel } from "./PreviewPanel";
import { Dialog, Notice } from "./ui";
import { WarningsPanel } from "./WarningsPanel";

interface Props {
  data: EditorData;
  onProposeAfterPublish: () => void;
  onOpenHistory: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onServerChange: () => void;
}

const NEW_DRAFT = "__new__";

export function LayoutTab({ data, onProposeAfterPublish, onOpenHistory, onDirtyChange, onServerChange }: Props) {
  const canEdit = data.perms.layout;
  const [drafts, setDrafts] = useState<DraftDTO[]>(data.drafts);
  const first = drafts[0];
  const [hist, dispatch] = useReducer(historyReducer, (first?.modules ?? data.live.modules) as ModuleInstance[], initHistory);
  const [draftId, setDraftId] = useState<string | null>(first?.id ?? null);
  const [version, setVersion] = useState<number | null>(first?.version ?? null);
  const [name, setName] = useState(first?.name ?? (data.live.source === "live" ? `Kladde af ${data.live.name}` : "Ny forsidekladde"));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<{ latest: DraftDTO } | null>(null);
  const [analysis, setAnalysis] = useState<LayoutAnalysis | null>(null);
  const [analysisPending, setAnalysisPending] = useState(false);
  const [dialog, setDialog] = useState<null | { kind: "publish" } | { kind: "template"; id: string; params: Record<string, string | number> } | { kind: "switch"; id: string } | { kind: "discard" }>(null);
  const [tplMode, setTplMode] = useState<"append" | "replace">("append");
  const [published, setPublished] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const announcer = useRef<HTMLDivElement>(null);

  const modules = hist.present;
  const dirty = isDirty(hist);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const say = useCallback((t: string) => {
    if (announcer.current) announcer.current.textContent = t;
  }, []);

  // Server-validering (layout-schema + rækværk) af kladden, debounced. Lokale ændringer er optimistiske.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- markerer at serverkontrollen er i gang (debounced)
    setAnalysisPending(true);
    const t = setTimeout(async () => {
      const res = await analyzeLayoutAction(modules).catch(() => null);
      if (cancelled) return;
      setAnalysisPending(false);
      setAnalysis(res && res.ok ? res : null);
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [modules]);

  const commit = useCallback(
    (res: OpResult, okMessage?: string) => {
      if (!res.ok) {
        setMsg({ tone: "error", text: res.error });
        say(`Ændringen blev afvist: ${res.error}`);
        return res;
      }
      dispatch({ type: "commit", modules: res.modules });
      setMsg(null);
      if (okMessage) say(okMessage);
      return res;
    },
    [say],
  );

  const selected = modules.find((m) => m.id === selectedId) ?? null;
  const nameOf = useCallback((id: string) => (modules.find((m) => m.id === id) ? MODULE_REGISTRY[modules.find((m) => m.id === id)!.type].label : id), [modules]);
  const diffToLive = useMemo(() => describeLayoutDiff(data.live.modules, modules), [data.live.modules, modules]);
  const violations = analysis?.violations ?? [];
  const blocking = (analysis?.issues.length ?? 0) > 0;

  // Genveje: Ctrl/Cmd+Z og Shift+Ctrl/Cmd+Z uden for tekstfelter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Gem ────────────────────────────────────────────────────────────────
  const save = useCallback(
    async (opts: { overrideVersion?: number } = {}): Promise<{ ok: true; id: string; version: number } | { ok: false }> => {
      setSaving(true);
      const res = await saveDraftAction({ draftId, name, modules, expectedVersion: opts.overrideVersion ?? (draftId ? version ?? undefined : undefined) });
      setSaving(false);
      if (!res.ok) {
        if (res.code === "conflict" && draftId) {
          const latest = await getDraftAction(draftId);
          if (latest.ok) setConflict({ latest: latest.draft });
          setMsg({ tone: "warn", text: res.message });
        } else {
          setMsg({ tone: "error", text: `${res.message}${res.details?.length ? ` ${res.details.join(" ")}` : ""}` });
        }
        return { ok: false };
      }
      setDraftId(res.draftId);
      setVersion(res.version);
      setConflict(null);
      dispatch({ type: "markSaved" });
      setDrafts((cur) => {
        const row: DraftDTO = { id: res.draftId, name, version: res.version, modules, updatedAt: new Date().toISOString() };
        return cur.some((d) => d.id === res.draftId) ? cur.map((d) => (d.id === res.draftId ? row : d)) : [row, ...cur];
      });
      setMsg({ tone: "ok", text: `Kladden er gemt (version ${res.version}). Den er ikke live.` });
      say("Kladden er gemt.");
      return { ok: true, id: res.draftId, version: res.version };
    },
    [draftId, name, modules, version, say],
  );

  const loadDraft = (d: DraftDTO) => {
    dispatch({ type: "reset", modules: d.modules });
    setDraftId(d.id);
    setVersion(d.version);
    setName(d.name);
    setSelectedId(null);
    setConflict(null);
    setMsg(null);
  };

  const switchDraft = (id: string) => {
    if (id === NEW_DRAFT) {
      dispatch({ type: "reset", modules: data.live.modules });
      setDraftId(null);
      setVersion(null);
      setName(`Kladde af ${data.live.name}`);
      setSelectedId(null);
      setConflict(null);
      return;
    }
    const d = drafts.find((x) => x.id === id);
    if (d) loadDraft(d);
  };

  const doPublish = () => {
    setDialog(null);
    startTransition(async () => {
      let id = draftId;
      if (!id || dirty) {
        const s = await save();
        if (!s.ok) return;
        id = s.id;
      }
      const res = await publishDraftAction(id);
      if (!res.ok) {
        setMsg({ tone: "error", text: `${res.message}${res.details?.length ? ` ${res.details.join(" ")}` : ""}` });
        return;
      }
      setPublished(res.version);
      setMsg({ tone: "ok", text: PUBLISH_NOTICE });
      say(`Layoutet er publiceret som version ${res.version}.`);
      onServerChange();
    });
  };

  const doTemplate = () => {
    if (dialog?.kind !== "template") return;
    const res = applyTemplate(modules, dialog.id, dialog.params, tplMode);
    setDialog(null);
    if (!res.ok) {
      setMsg({ tone: "error", text: res.errors.join(" ") });
      return;
    }
    dispatch({ type: "commit", modules: res.value });
    setSelectedId(null);
    setMsg({ tone: "ok", text: `Skabelonen er ${tplMode === "replace" ? "sat ind i stedet for layoutet" : "tilføjet"}. Du kan fortryde.` });
  };

  const patchModule = (id: string, patch: ModulePatch) => commit(updateModule(modules, id, patch), "Indstillinger anvendt.");

  const unsavedWarningRef = useRef(false);
  useEffect(() => {
    unsavedWarningRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (unsavedWarningRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const tpl = dialog?.kind === "template" ? getTemplate(dialog.id) : null;

  return (
    <div className="fpe-layout">
      <div ref={announcer} className="sr-only" aria-live="polite" role="status" />

      <div className="fpe-toolbar" role="toolbar" aria-label="Layoutværktøjer">
        <div className="fpe-toolbar-left">
          <div className="fpe-field fpe-field--inline">
            <label htmlFor="fpe-draft-select">Kladde</label>
            <select
              id="fpe-draft-select"
              className="fpe-input"
              value={draftId ?? NEW_DRAFT}
              onChange={(e) => (dirty ? setDialog({ kind: "switch", id: e.target.value }) : switchDraft(e.target.value))}
              disabled={!canEdit && drafts.length === 0}
            >
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} (v{d.version})
                </option>
              ))}
              <option value={NEW_DRAFT}>+ Ny kladde fra det publicerede layout</option>
            </select>
          </div>
          <div className="fpe-field fpe-field--inline">
            <label htmlFor="fpe-draft-name">Navn</label>
            <input id="fpe-draft-name" className="fpe-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
          </div>
          <span className={`fpe-state${dirty ? " is-dirty" : ""}`} role="status">
            {dirty ? "Ugemte ændringer" : draftId ? `Gemt · v${version}` : "Ikke gemt endnu"}
          </span>
        </div>
        <div className="fpe-toolbar-right">
          <button type="button" className="fpe-btn fpe-btn--ghost" onClick={() => dispatch({ type: "undo" })} disabled={!canUndo(hist)} aria-label="Fortryd (Ctrl/Cmd+Z)">
            <Undo2 size={16} aria-hidden="true" /> Fortryd
          </button>
          <button type="button" className="fpe-btn fpe-btn--ghost" onClick={() => dispatch({ type: "redo" })} disabled={!canRedo(hist)} aria-label="Gentag (Shift+Ctrl/Cmd+Z)">
            <Redo2 size={16} aria-hidden="true" /> Gentag
          </button>
          <button type="button" className="fpe-btn fpe-btn--secondary" onClick={() => void save()} disabled={!canEdit || saving || (!dirty && Boolean(draftId))}>
            <Save size={16} aria-hidden="true" /> {saving ? "Gemmer…" : "Gem kladde"}
          </button>
          <button type="button" className="fpe-btn" onClick={() => setDialog({ kind: "publish" })} disabled={!canEdit || saving || blocking || modules.length === 0}>
            <Send size={16} aria-hidden="true" /> Publicér
          </button>
          <button type="button" className="fpe-btn fpe-btn--ghost" onClick={onOpenHistory} title="Versionshistorik og rollback">
            <History size={16} aria-hidden="true" /> Versioner
          </button>
          {draftId && canEdit && (
            <button type="button" className="fpe-iconbtn fpe-iconbtn--danger" onClick={() => setDialog({ kind: "discard" })} aria-label="Slet denne kladde" title="Slet kladden">
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {!canEdit && <p className="fpe-notice fpe-notice--info" role="note">Du kan se layoutet, men ikke redigere det (kræver rettigheden &quot;Redigér forsidens layout&quot;).</p>}
      <Notice msg={msg} onClose={() => setMsg(null)} />
      {published !== null && (
        <div className="fpe-notice fpe-notice--ok" role="status">
          <p>
            Version {published} er live. Godkendelsen er nulstillet for det nye layout.
          </p>
          <button type="button" className="fpe-btn fpe-btn--small" onClick={onProposeAfterPublish}>
            <Sparkles size={15} aria-hidden="true" /> Foreslå forside
          </button>
        </div>
      )}
      {conflict && (
        <div className="fpe-notice fpe-notice--warn" role="alert">
          <p>
            Kladden er ændret af en anden (nu version {conflict.latest.version}). Dine ændringer er ikke gemt.
          </p>
          <button type="button" className="fpe-btn fpe-btn--small" onClick={() => loadDraft(conflict.latest)}>
            Genindlæs deres version
          </button>
          <button type="button" className="fpe-btn fpe-btn--small fpe-btn--secondary" onClick={() => void save({ overrideVersion: conflict.latest.version })}>
            Behold mine ændringer (overskriv)
          </button>
        </div>
      )}

      <div className="fpe-grid3">
        <section className="fpe-panel fpe-col-lib" aria-labelledby="fpe-lib-h">
          <h3 className="fpe-h3" id="fpe-lib-h">Bibliotek</h3>
          <ModuleLibrary
            modules={modules}
            canEdit={canEdit}
            onAdd={(type: ModuleTypeId) => {
              const r = commit(addModule(modules, type, { afterId: selectedId }), `${MODULE_REGISTRY[type].label} er tilføjet.`);
              if (r.ok) setSelectedId(r.modules.find((m) => !modules.some((o) => o.id === m.id))?.id ?? null);
            }}
            onApplyTemplate={(id, params) => {
              setTplMode("append");
              setDialog({ kind: "template", id, params });
            }}
          />
        </section>

        <section className="fpe-panel fpe-col-canvas" aria-labelledby="fpe-canvas-h">
          <h3 className="fpe-h3" id="fpe-canvas-h">Forsiden (oppefra og ned)</h3>
          <p className="fpe-help">Træk i håndtaget, eller brug mellemrum og piletaster. Knapperne Flyt op/ned virker uden træk.</p>
          <ModuleCanvas
            modules={modules}
            selectedId={selectedId}
            violations={violations}
            canEdit={canEdit}
            onSelect={setSelectedId}
            onMove={(a, o) => commit(moveTopLevel(modules, a, o), `${nameOf(a)} er flyttet.`)}
            onMoveBy={(id, d) => commit(moveTopLevelBy(modules, id, d), `${nameOf(id)} er flyttet ${d < 0 ? "op" : "ned"}.`)}
            onToggleVisible={(id) => commit(toggleVisible(modules, id), `${nameOf(id)} skifter synlighed.`)}
            onDuplicate={(id) => commit(duplicateModule(modules, id), `${nameOf(id)} er duplikeret.`)}
            onRemove={(id) => {
              commit(removeModule(modules, id), `${nameOf(id)} er fjernet.`);
              if (selectedId === id) setSelectedId(null);
            }}
          />
        </section>

        <section className="fpe-panel fpe-col-insp" aria-labelledby="fpe-insp-h">
          <h3 className="fpe-h3" id="fpe-insp-h">Indstillinger</h3>
          {selected ? (
            <ModuleInspector
              module={selected}
              modules={modules}
              fieldCtx={data.options}
              canEdit={canEdit}
              onPatch={patchModule}
              onAddBreak={(h, t: BreakType, after, rep) => commit(addInlineBreak(modules, h, t, after, rep), "Break-punkt tilføjet.")}
              onRemoveBreak={(h, b) => commit(removeInlineBreak(modules, h, b), "Break-punkt fjernet.")}
              onUpdateBreak={(h, b, p) => commit(updateBreakRef(modules, h, b, p), "Break-punkt opdateret.")}
              onChangeBreakType={(h, b, t) => commit(changeBreakType(modules, h, b, t), "Break-type ændret.")}
            />
          ) : (
            <p className="fpe-muted">Vælg et modul i forsiden for at redigere dets slots, variant, tilstand og indstillinger.</p>
          )}
        </section>
      </div>

      <div className="fpe-grid2">
        <PreviewPanel draftId={draftId} version={version} dirty={dirty} canSave={canEdit} saving={saving} onSave={() => void save()} />
        <div className="fpe-stack">
          <WarningsPanel issues={analysis?.issues ?? []} violations={violations} hints={layoutHints(modules)} filled={analysis?.filled} total={analysis?.total} pending={analysisPending} moduleName={nameOf} />
          <AiPanel
            modules={modules}
            canUse={data.perms.ai && canEdit}
            canPin={data.perms.edit}
            aiConfigured={data.aiConfigured}
            onApply={(next, summary) => {
              dispatch({ type: "commit", modules: next });
              say(`AI-forslag anvendt: ${summary}.`);
            }}
          />
        </div>
      </div>

      <Dialog
        open={dialog?.kind === "publish"}
        title="Publicér layout"
        onClose={() => setDialog(null)}
        wide
        actions={
          <>
            <button type="button" className="fpe-btn fpe-btn--ghost" onClick={() => setDialog(null)}>Annullér</button>
            <button type="button" className="fpe-btn" onClick={doPublish}>Publicér til forsiden</button>
          </>
        }
      >
        <p>
          Du publicerer <strong>{name}</strong>
          {dirty || !draftId ? " (kladden gemmes først)" : ""}. Layoutet bliver version {data.live.source === "live" ? data.live.version + 1 : 1}.
        </p>
        <h4 className="fpe-h4">Ændringer i forhold til det publicerede layout</h4>
        {diffToLive.length === 0 ? <p className="fpe-muted">Ingen ændringer.</p> : <ul className="fpe-diff">{diffToLive.map((l) => <li key={l}>{l}</li>)}</ul>}
        <p className="fpe-warning" role="note">
          Når layoutet ændres, hører den nuværende godkendelse til en gammel layoutversion. Forsiden bruger derfor almindelig rangering, indtil du har godkendt et nyt forslag. Efter publicering kan du trykke &quot;Foreslå forside&quot;.
        </p>
        {violations.length > 0 && <p className="fpe-muted">{violations.length} rækværksadvarsel(er) er vist i advarselspanelet.</p>}
      </Dialog>

      <Dialog
        open={dialog?.kind === "template"}
        title={`Anvend skabelonen ${tpl?.navn ?? ""}`}
        onClose={() => setDialog(null)}
        actions={
          <>
            <button type="button" className="fpe-btn fpe-btn--ghost" onClick={() => setDialog(null)}>Annullér</button>
            <button type="button" className={`fpe-btn${tplMode === "replace" ? " fpe-btn--danger" : ""}`} onClick={doTemplate}>{tplMode === "replace" ? "Erstat layoutet" : "Tilføj skabelonen"}</button>
          </>
        }
      >
        <p>{tpl?.beskrivelse}</p>
        <fieldset className="fpe-fieldset">
          <legend>Hvordan?</legend>
          <label className="fpe-radio"><input type="radio" name="tplmode" checked={tplMode === "append"} onChange={() => setTplMode("append")} /> Tilføj nederst i det nuværende layout</label>
          <label className="fpe-radio"><input type="radio" name="tplmode" checked={tplMode === "replace"} onChange={() => setTplMode("replace")} /> Erstat hele layoutet ({modules.length} moduler fjernes)</label>
        </fieldset>
        <p className="fpe-help">Ændringen sker kun i kladden og kan fortrydes.</p>
      </Dialog>

      <Dialog
        open={dialog?.kind === "switch"}
        title="Ugemte ændringer"
        onClose={() => setDialog(null)}
        actions={
          <>
            <button type="button" className="fpe-btn fpe-btn--ghost" onClick={() => setDialog(null)}>Bliv her</button>
            <button type="button" className="fpe-btn fpe-btn--danger" onClick={() => { if (dialog?.kind === "switch") switchDraft(dialog.id); setDialog(null); }}>Skift og kassér ændringer</button>
          </>
        }
      >
        <p>Du har ugemte ændringer i denne kladde. Hvis du skifter, går de tabt.</p>
      </Dialog>

      <Dialog
        open={dialog?.kind === "discard"}
        title="Slet kladde"
        onClose={() => setDialog(null)}
        actions={
          <>
            <button type="button" className="fpe-btn fpe-btn--ghost" onClick={() => setDialog(null)}>Annullér</button>
            <button
              type="button"
              className="fpe-btn fpe-btn--danger"
              onClick={() => {
                const id = draftId;
                setDialog(null);
                if (!id) return;
                startTransition(async () => {
                  const r = await discardDraftAction(id);
                  if (!r.ok) return setMsg({ tone: "error", text: r.message || serviceErrorMessage(r.code) });
                  const rest = drafts.filter((d) => d.id !== id);
                  setDrafts(rest);
                  if (rest[0]) loadDraft(rest[0]);
                  else switchDraft(NEW_DRAFT);
                  setMsg({ tone: "ok", text: "Kladden er slettet. Det publicerede layout er uændret." });
                });
              }}
            >
              Slet kladden
            </button>
          </>
        }
      >
        <p>Kladden &quot;{name}&quot; slettes permanent. Det publicerede layout og tidligere versioner påvirkes ikke.</p>
      </Dialog>
    </div>
  );
}
