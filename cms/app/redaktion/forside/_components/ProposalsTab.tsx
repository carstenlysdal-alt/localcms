"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Pencil, Sparkles, Undo2, X } from "lucide-react";
import { MODULE_REGISTRY } from "@/lib/frontpage/modules";
import type { SlotAssignment, Violation } from "@/lib/frontpage/types";
import { approveProposalAction, createProposalAction, editProposalAction, loadProposalAction, rejectProposalAction, removePinAction } from "../editor-actions";
import type { ArticleLite, EditorData, ProposalDetailDTO } from "../_lib/dto";
import { diffAssignments, diffSummary } from "../_lib/diff";
import { collapseEmptySlots, groupViolations, violationTitle } from "../_lib/hints";
import { serviceErrorMessage, type Msg } from "../_lib/messages";
import { SlotBoard } from "./SlotBoard";
import { Badge, Dialog, Notice, fmtDateTime } from "./ui";

interface Props {
  data: EditorData;
  initialSelectId: string | null;
  onServerChange: () => void;
  /** Øges af shellen når "Foreslå forside" er trykket efter publicering. */
  proposeSignal: number;
}

const STATUS_TONE: Record<string, "ok" | "warn" | "error" | "neutral" | "accent"> = { forslag: "accent", godkendt: "ok", afvist: "error", udløbet: "neutral" };
const SOURCE_LABEL = { "godkendt-snapshot": "Sidst godkendte forside", deterministisk: "Almindelig rangering (ingen gyldig godkendelse)", "seneste-nyt": "Seneste nyt (nødfallback)" } as const;
const ZONE_LABEL: Record<string, string> = { "top-hoved": "Hero", "top-sekundaer": "Top-grid", omraade: "Dit område", sektion: "Sektion" };

export function ProposalsTab({ data, initialSelectId, onServerChange, proposeSignal }: Props) {
  const canApprove = data.perms.approve;
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectId ?? data.selected?.summary.id ?? null);
  const [detail, setDetail] = useState<ProposalDetailDTO | null>(data.selected);
  const [extraArticles, setExtraArticles] = useState<Record<string, ArticleLite>>({});
  const [msg, setMsg] = useState<Msg | null>(null);
  const [useAi, setUseAi] = useState(data.perms.ai && data.aiConfigured);
  const [force, setForce] = useState(false);
  const [editing, setEditing] = useState(false);
  const [undo, setUndo] = useState<SlotAssignment[][]>([]);
  const [dialog, setDialog] = useState<null | "approve" | "reject">(null);
  const [reason, setReason] = useState("");
  const [editViolations, setEditViolations] = useState<Violation[]>([]);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  const select = async (id: string) => {
    setSelectedId(id);
    setEditing(false);
    setUndo([]);
    setEditViolations([]);
    const res = await loadProposalAction(id);
    if (res.ok) setDetail(res.detail);
    else setMsg({ tone: "error", text: res.message });
  };

  const articles = useMemo(() => ({ ...data.liveArticles, ...extraArticles, ...(detail?.articles ?? {}) }), [data.liveArticles, extraArticles, detail]);
  const modules = data.live.modules;
  const live = data.liveResolution.assignments;
  const diffs = useMemo(() => (detail ? diffAssignments(live, detail.assignments) : []), [live, detail]);
  const sum = diffSummary(diffs);
  const nameOf = (id: string) => { const m = modules.find((x) => x.id === id); return m ? MODULE_REGISTRY[m.type].label : id; };
  const grouped = groupViolations(collapseEmptySlots(detail?.warnings ?? [], nameOf));
  const isOpen = detail?.summary.status === "forslag";
  const canAct = Boolean(detail && isOpen && !detail.layoutStale && canApprove);

  const propose = () =>
    start(async () => {
      setMsg(null);
      const res = await createProposalAction({ useAi: useAi && data.perms.ai, force });
      if (!res.ok) {
        setMsg({ tone: res.code === "ai-unavailable" || res.code === "rate-limited" || res.code === "no-candidates" ? "warn" : "error", text: res.message });
        return;
      }
      setMsg(res.message);
      await select(res.snapshotId);
      onServerChange();
    });

  // Hvis serveren sender et nyt "valgt" forslag (efter refresh/Foreslå forside) og intet er valgt lokalt, så følg det.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- følger serverens nyeste forslag (ekstern ændring efter refresh)
    if (initialSelectId && initialSelectId !== selectedId) void select(initialSelectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectId]);

  useEffect(() => {
    if (proposeSignal > 0) propose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposeSignal]);

  const change = (next: SlotAssignment[]) => {
    if (!detail || !selectedId || busy) return;
    const prev = detail.assignments;
    setDetail({ ...detail, assignments: next }); // optimistisk
    setBusy(true);
    start(async () => {
      const res = await editProposalAction(selectedId, next);
      setBusy(false);
      if (!res.ok) {
        setDetail((d) => (d ? { ...d, assignments: prev } : d)); // rul tilbage
        setEditViolations(res.violations ?? []);
        setMsg({ tone: "error", text: `${res.message}${res.violations?.length ? ` (${res.violations.map((v) => v.besked).slice(0, 2).join(" ")})` : ""}` });
        return;
      }
      setEditViolations([]);
      setUndo((u) => [...u, prev].slice(-30));
      setDetail((d) => (d ? { ...d, assignments: res.assignments, warnings: res.warnings } : d));
      const missing = res.assignments.map((a) => a.articleId).filter((x) => !articles[x]);
      if (missing.length) {
        const { articleLitesAction } = await import("../editor-actions");
        const r = await articleLitesAction(missing);
        if (r.ok) setExtraArticles((cur) => ({ ...cur, ...r.articles }));
      }
      setMsg({ tone: "ok", text: "Ændringen er gemt i forslaget og overholder rækværkene. Intet er live, før du godkender." });
    });
  };

  const undoLast = () => {
    const prev = undo[undo.length - 1];
    if (!prev || !detail || !selectedId) return;
    setUndo((u) => u.slice(0, -1));
    setBusy(true);
    start(async () => {
      const res = await editProposalAction(selectedId, prev);
      setBusy(false);
      if (res.ok) setDetail((d) => (d ? { ...d, assignments: res.assignments, warnings: res.warnings } : d));
      else setMsg({ tone: "error", text: res.message });
    });
  };

  const approve = () => {
    if (!detail) return;
    setDialog(null);
    start(async () => {
      const res = await approveProposalAction(detail.summary.id);
      if (!res.ok) {
        setMsg({ tone: "error", text: `${res.message}${res.violations?.length ? ` ${res.violations.length} placering(er) overholder ikke længere rækværkene.` : ""}` });
        if (res.violations) setEditViolations(res.violations);
        return;
      }
      setEditing(false);
      setMsg({ tone: "ok", text: `Forslaget er godkendt og er nu forsiden. Det gælder til ${fmtDateTime(res.expiresAt)}; derefter bruges almindelig rangering, til et nyt forslag godkendes.` });
      await select(detail.summary.id);
      onServerChange();
    });
  };

  const reject = () => {
    if (!detail) return;
    setDialog(null);
    start(async () => {
      const res = await rejectProposalAction(detail.summary.id, reason);
      if (!res.ok) return setMsg({ tone: "error", text: res.message });
      setReason("");
      setEditing(false);
      setMsg({ tone: "info", text: "Forslaget er afvist. Forsiden er uændret." });
      await select(detail.summary.id);
      onServerChange();
    });
  };

  const noAi = !data.perms.ai ? "Din rolle har ikke rettighed til AI." : !data.aiConfigured ? "AI er ikke sat op i dette miljø (API-nøgle mangler)." : null;

  return (
    <div className="fpe-proposals">
      <section className="fpe-panel" aria-labelledby="fpe-prop-new-h">
        <h3 className="fpe-h3" id="fpe-prop-new-h"><Sparkles size={16} aria-hidden="true" /> Foreslå forside</h3>
        <p className="fpe-muted">Rangerer dagens publicerede artikler ind i layoutets slots og gemmer resultatet som et <strong>forslag</strong>. Intet er live, før en redaktør godkender det.</p>
        <div className="fpe-row">
          <label className="fpe-check">
            <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} disabled={Boolean(noAi)} /> Brug AI til at finpudse rækkefølgen
          </label>
          <label className="fpe-check">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Opret nyt, selv om input er uændret
          </label>
          <button type="button" className="fpe-btn" onClick={propose} disabled={pending || !(data.perms.edit || data.perms.approve)}>
            {pending ? "Arbejder…" : "Foreslå forside"}
          </button>
        </div>
        {noAi && <p className="fpe-help">{noAi} Forslaget laves så med almindelig rangering.</p>}
        <Notice msg={msg} onClose={() => setMsg(null)} />
      </section>

      <div className="fpe-prop-grid">
        <section className="fpe-panel" aria-labelledby="fpe-prop-list-h">
          <h3 className="fpe-h3" id="fpe-prop-list-h">Forslag</h3>
          {data.snapshots.length === 0 ? (
            <p className="fpe-empty">Der er endnu ikke lavet nogen forslag.</p>
          ) : (
            <ul className="fpe-prop-list">
              {data.snapshots.map((s) => (
                <li key={s.id}>
                  <button type="button" className={`fpe-prop-item${selectedId === s.id ? " is-selected" : ""}`} aria-current={selectedId === s.id ? "true" : undefined} onClick={() => void select(s.id)}>
                    <span className="fpe-prop-line">
                      <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
                      <Badge tone={s.generatedBy === "ai" ? "ai" : "neutral"}>{s.generatedBy === "ai" ? "AI" : "Almindelig"}</Badge>
                    </span>
                    <span className="fpe-prop-when">{fmtDateTime(s.createdAt)}</span>
                    {s.status === "godkendt" && <span className="fpe-muted">Godkendt {fmtDateTime(s.godkendtTid)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <h4 className="fpe-h4">Forsiden lige nu</h4>
          <p className="fpe-help"><strong>{SOURCE_LABEL[data.liveResolution.source]}</strong>. {data.liveResolution.reason}{data.liveResolution.repaired ? ` (${data.liveResolution.repaired} placering(er) repareret).` : ""} Besøgende ser ikke denne forklaring.</p>
        </section>

        <section className="fpe-panel" aria-labelledby="fpe-prop-detail-h">
          {!detail ? (
            <>
              <h3 className="fpe-h3" id="fpe-prop-detail-h">Forslag</h3>
              <p className="fpe-empty">Vælg et forslag, eller tryk Foreslå forside.</p>
            </>
          ) : (
            <>
              <div className="fpe-panel-head">
                <h3 className="fpe-h3" id="fpe-prop-detail-h">
                  Forslag fra {fmtDateTime(detail.summary.createdAt)}
                </h3>
                <Badge tone={STATUS_TONE[detail.summary.status] ?? "neutral"}>{detail.summary.status}</Badge>
                <Badge tone={detail.summary.generatedBy === "ai" ? "ai" : "neutral"} title={detail.summary.modelId ?? undefined}>{detail.summary.generatedBy === "ai" ? `AI${detail.summary.modelId ? ` · ${detail.summary.modelId}` : ""}` : "Almindelig rangering"}</Badge>
              </div>
              {detail.layoutStale && isOpen && <p className="fpe-notice fpe-notice--warn" role="alert">Layoutet er ændret siden forslaget blev lavet. Opret et nyt forslag, dette kan ikke godkendes.</p>}
              {detail.summary.status === "godkendt" && <p className="fpe-notice fpe-notice--ok" role="status">Godkendt af {detail.summary.godkendtAf ?? "en redaktør"} {fmtDateTime(detail.summary.godkendtTid)}; gælder til {fmtDateTime(detail.summary.expiresAt)}.</p>}
              {detail.summary.status === "afvist" && <p className="fpe-notice fpe-notice--info" role="status">Afvist{detail.summary.afvistGrund ? `: ${detail.summary.afvistGrund}` : ""}.</p>}

              <p className="fpe-diff-sum" aria-label="Forskel til forsiden lige nu">
                Mod forsiden lige nu: <Badge tone="ok">{sum.ny} nye</Badge> <Badge tone="accent">{sum.aendret} ændret/flyttet</Badge> <Badge tone="warn">{sum.fjernet} fjernes</Badge> <Badge>{sum.uaendret} uændrede</Badge>
              </p>

              {(grouped.blokerende.length > 0 || grouped.advarsler.length > 0 || editViolations.length > 0) && (
                <section className="fpe-warnbox" aria-label="Rækværksadvarsler for forslaget">
                  <h4 className="fpe-h4">Advarsler fra rækværkene</h4>
                  <ul className="fpe-warn-list">
                    {[...grouped.blokerende, ...editViolations].map((v, i) => (
                      <li key={`b${i}`} className="fpe-warn fpe-warn--error"><span><strong>{violationTitle(v)}</strong>: {v.besked}</span></li>
                    ))}
                    {grouped.advarsler.map((v, i) => (
                      <li key={`a${i}`} className="fpe-warn"><span><strong>{violationTitle(v)}</strong>: {v.besked}</span></li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="fpe-row fpe-row--actions">
                {canAct && (
                  <>
                    <button type="button" className="fpe-btn" onClick={() => setDialog("approve")} disabled={pending || busy || grouped.blokerende.length > 0} title={grouped.blokerende.length ? "Blokerende regelbrud forhindrer godkendelse" : undefined}>
                      <Check size={16} aria-hidden="true" /> Godkend
                    </button>
                    <button type="button" className="fpe-btn fpe-btn--secondary" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
                      <Pencil size={16} aria-hidden="true" /> {editing ? "Afslut redigering" : "Redigér placeringer"}
                    </button>
                    {editing && (
                      <button type="button" className="fpe-btn fpe-btn--ghost" onClick={undoLast} disabled={undo.length === 0 || busy}>
                        <Undo2 size={16} aria-hidden="true" /> Fortryd sidste ændring
                      </button>
                    )}
                    <button type="button" className="fpe-btn fpe-btn--ghost" onClick={() => setDialog("reject")} disabled={pending}>
                      <X size={16} aria-hidden="true" /> Afvis
                    </button>
                  </>
                )}
                {isOpen && !canApprove && <p className="fpe-help">Du kan se forslaget, men godkendelse kræver rettigheden &quot;Godkend forside-forslag&quot;.</p>}
                <a className="fpe-btn fpe-btn--ghost" href={`/redaktion/forside/preview?snapshot=${detail.summary.id}`} target="_blank" rel="noopener">
                  Åbn forhåndsvisning (nyt vindue)
                </a>
              </div>

              <SlotBoard
                modules={modules}
                assignments={detail.assignments}
                liveAssignments={live}
                articles={articles}
                warnings={detail.warnings}
                pool={data.pool}
                editing={editing && canAct}
                busy={busy || pending}
                onChange={change}
              />
              {detail.decisions.some((d) => d.handling === "afvist") && (
                <details className="fpe-rules">
                  <summary>Blokeret af rækværkene ({detail.decisions.filter((d) => d.handling === "afvist").length})</summary>
                  <ul>
                    {detail.decisions.filter((d) => d.handling === "afvist").slice(0, 20).map((d) => (
                      <li key={d.id}>{d.articleId ? articles[d.articleId]?.titel ?? d.articleId.slice(0, 8) : "–"}: {d.begrundelse}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </section>
      </div>

      <section className="fpe-panel" aria-labelledby="fpe-pins-h">
        <h3 className="fpe-h3" id="fpe-pins-h">Fastgjorte artikler (pins)</h3>
        <p className="fpe-muted">Redaktørens pins vinder over AI og rangering. Nye pins sættes i fanen &quot;Fastgør&quot; eller via AI-kommandoer i layouteditoren.</p>
        {data.pins.length === 0 ? (
          <p className="fpe-empty">Ingen aktive pins.</p>
        ) : (
          <ul className="fpe-pin-list">
            {data.pins.map((p) => (
              <li key={p.id} className="fpe-pin">
                <span className="fpe-slot-title">{articles[p.articleId]?.titel ?? p.articleId.slice(0, 8)}</span>
                <Badge tone="accent">{ZONE_LABEL[p.zone] ?? p.zone}, plads {p.position + 1}</Badge>
                <span className="fpe-muted">{p.udloebTid ? `udløber ${fmtDateTime(p.udloebTid)}` : "ingen udløb"}</span>
                {data.perms.edit && (
                  <button type="button" className="fpe-btn fpe-btn--small fpe-btn--ghost" onClick={() => start(async () => { const r = await removePinAction(p.id); if (r.ok) onServerChange(); else setMsg({ tone: "error", text: r.message || serviceErrorMessage(r.code) }); })} disabled={pending}>
                    Fjern pin
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={dialog === "approve"}
        title="Godkend forslaget"
        onClose={() => setDialog(null)}
        actions={
          <>
            <button type="button" className="fpe-btn fpe-btn--ghost" onClick={() => setDialog(null)}>Annullér</button>
            <button type="button" className="fpe-btn" onClick={approve}>Godkend og gør til forside</button>
          </>
        }
      >
        <p>Forslaget bliver den forside, besøgende ser, med det samme.</p>
        <ul className="fpe-diff">
          <li>{sum.ny} nye placeringer, {sum.aendret} ændrede/flyttede, {sum.fjernet} fjernes, {sum.uaendret} uændrede.</li>
          <li>{grouped.advarsler.length} advarsel(er) fra rækværkene (ikke blokerende).</li>
          <li>Serveren tjekker alle placeringer mod friske data, inden godkendelsen gemmes.</li>
        </ul>
      </Dialog>

      <Dialog
        open={dialog === "reject"}
        title="Afvis forslaget"
        onClose={() => setDialog(null)}
        actions={
          <>
            <button type="button" className="fpe-btn fpe-btn--ghost" onClick={() => setDialog(null)}>Annullér</button>
            <button type="button" className="fpe-btn fpe-btn--danger" onClick={reject}>Afvis forslaget</button>
          </>
        }
      >
        <div className="fpe-field">
          <label htmlFor="fpe-reject-reason">Begrundelse (valgfri, gemmes i loggen)</label>
          <textarea id="fpe-reject-reason" className="fpe-input" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Dialog>
    </div>
  );
}
