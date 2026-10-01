"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { ArrowDown, ArrowUp, GripVertical, HelpCircle, Lock, X } from "lucide-react";
import { effectiveVariant, listArticleSlots, type ModuleInstance } from "@/lib/frontpage/layout-schema";
import { MODULE_REGISTRY } from "@/lib/frontpage/modules";
import type { SlotAssignment, Violation } from "@/lib/frontpage/types";
import type { ArticleLite } from "../_lib/dto";
import { diffAssignments, type DiffStatus } from "../_lib/diff";
import { moveAssignment, moveAssignmentBy, parseSlotId, placeArticle, removeAssignment, slotId, type SlotRef } from "../_lib/dnd";
import { KILDE_LABEL, explainAssignment } from "../_lib/explain";
import { violationTitle } from "../_lib/hints";
import { Badge } from "./ui";

interface Props {
  modules: ModuleInstance[];
  assignments: SlotAssignment[];
  liveAssignments: SlotAssignment[];
  articles: Record<string, ArticleLite>;
  warnings: Violation[];
  pool: ArticleLite[];
  editing: boolean;
  busy: boolean;
  onChange: (next: SlotAssignment[]) => void;
}

const DIFF_LABEL: Record<DiffStatus, { text: string; tone: "neutral" | "ok" | "warn" | "accent" }> = {
  uaendret: { text: "Uændret", tone: "neutral" },
  ny: { text: "Ny", tone: "ok" },
  aendret: { text: "Ændret", tone: "accent" },
  flyttet: { text: "Flyttet", tone: "accent" },
  fjernet: { text: "Fjernes", tone: "warn" },
};

const toneOfType = (t: string): "neutral" | "warn" | "accent" | "ai" => (t === "Sponsoreret" ? "warn" : t === "Partner" ? "accent" : t === "AI-assisteret" ? "ai" : "neutral");

/** Forslagets placeringer pr. slot: diff mod live, "Hvorfor står den her?", og træk-og-slip (pointer, touch, tastatur) i redigeringstilstand. */
export function SlotBoard({ modules, assignments, liveAssignments, articles, warnings, pool, editing, busy, onChange }: Props) {
  const slots = useMemo(() => listArticleSlots(modules), [modules]);
  const order = useMemo(() => slots.map(slotId), [slots]);
  const byId = useMemo(() => new Map(assignments.map((a) => [slotId(a), a])), [assignments]);
  const diff = useMemo(() => diffAssignments(liveAssignments, assignments), [liveAssignments, assignments]);
  const diffBySlot = useMemo(() => new Map(diff.map((d) => [`${d.moduleId}:${d.slotIndex}`, d])), [diff]);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const moduleOf = (id: string) => modules.find((m) => m.id === id);
  const slotName = (r: SlotRef) => `${MODULE_REGISTRY[moduleOf(r.moduleId)?.type ?? "hero"]?.label ?? r.moduleId}, slot ${r.slotIndex + 1}`;
  const title = (articleId: string) => articles[articleId]?.titel ?? `Artikel ${articleId.slice(0, 8)}`;

  const coordinateGetter: KeyboardCoordinateGetter = (event, { context: { active: a, droppableRects, over, droppableContainers } }) => {
    const key = event.code;
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(key)) return undefined;
    event.preventDefault();
    const enabled = new Set(droppableContainers.getEnabled().map((c) => String(c.id)));
    const list = order.filter((id) => enabled.has(id));
    const originSlot = a && String(a.id).startsWith("drag|") ? String(a.id).slice(5) : null;
    const current = over ? String(over.id) : originSlot;
    let idx = current ? list.indexOf(current) : -1;
    idx = key === "ArrowDown" || key === "ArrowRight" ? Math.min(list.length - 1, idx + 1) : Math.max(0, idx - 1);
    const rect = list[idx] ? droppableRects.get(list[idx]) : undefined;
    return rect ? { x: rect.left, y: rect.top } : undefined;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter, scrollBehavior: "auto" }),
  );

  const describe = (id: string) => {
    if (id.startsWith("pool|")) return title(id.slice(5));
    const a = byId.get(id.slice(5));
    return a ? title(a.articleId) : "artikel";
  };
  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `Løftede ${describe(String(a.id))}.`,
    onDragOver: ({ active: a, over }) => {
      const r = over ? parseSlotId(String(over.id)) : null;
      return r ? `${describe(String(a.id))} er over ${slotName(r)}.` : `${describe(String(a.id))} er ikke over et slot.`;
    },
    onDragEnd: ({ active: a, over }) => {
      const r = over ? parseSlotId(String(over.id)) : null;
      return r ? `${describe(String(a.id))} er sat i ${slotName(r)}.` : `${describe(String(a.id))} blev sluppet uden at flytte.`;
    },
    onDragCancel: ({ active: a }) => `Flytning af ${describe(String(a.id))} er annulleret.`,
  };

  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    const to = e.over ? parseSlotId(String(e.over.id)) : null;
    if (!to) return;
    const id = String(e.active.id);
    if (id.startsWith("drag|")) {
      const from = parseSlotId(id.slice(5));
      if (from) onChange(moveAssignment(assignments, from, to, modules));
    } else if (id.startsWith("pool|")) {
      const art = articles[id.slice(5)];
      if (art) onChange(placeArticle(assignments, to, { id: art.id, label: art.label }, modules));
    }
  };

  const removed = diff.filter((d) => d.status === "fjernet");

  return (
    <DndContext
      id="fpe-slots-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: "Tryk mellemrum for at løfte artiklen, brug piletasterne til at vælge et slot, mellemrum for at slippe, Escape for at fortryde. Du kan også bruge knapperne Flyt op, Flyt ned og Sæt i slot." },
        restoreFocus: true,
      }}
      onDragStart={(e) => setActive(String(e.active.id))}
      onDragEnd={onEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className={`fpe-board${editing ? " is-editing" : ""}`}>
        <div className="fpe-board-slots">
          {modules
            .filter((m) => m.visible && MODULE_REGISTRY[m.type].kind === "artikel")
            .map((m) => (
              <section key={m.id} className="fpe-board-module" aria-label={MODULE_REGISTRY[m.type].label}>
                <h4 className="fpe-h4">
                  {MODULE_REGISTRY[m.type].label} <span className="fpe-muted">· {m.slots} slot{m.slots === 1 ? "" : "s"} · {effectiveVariant(m)}</span>
                </h4>
                <ol className="fpe-slot-list">
                  {Array.from({ length: m.slots }, (_, i) => {
                    const ref = { moduleId: m.id, slotIndex: i };
                    const a = byId.get(slotId(ref));
                    const d = diffBySlot.get(slotId(ref));
                    const wl = warnings.filter((w) => w.moduleId === m.id && (w.slotIndex === undefined || w.slotIndex === i));
                    return (
                      <SlotRow
                        key={i}
                        refSlot={ref}
                        name={slotName(ref)}
                        assignment={a}
                        article={a ? articles[a.articleId] : undefined}
                        diff={d?.status}
                        warnings={wl}
                        editing={editing && !busy}
                        explainOpen={open === slotId(ref)}
                        onToggleExplain={() => setOpen(open === slotId(ref) ? null : slotId(ref))}
                        moduleLabel={MODULE_REGISTRY[m.type].label}
                        onUp={() => onChange(moveAssignmentBy(assignments, ref, -1, modules))}
                        onDown={() => onChange(moveAssignmentBy(assignments, ref, 1, modules))}
                        onRemove={() => onChange(removeAssignment(assignments, ref))}
                        canUp={i > 0}
                        canDown={i < m.slots - 1}
                      />
                    );
                  })}
                </ol>
              </section>
            ))}
          {removed.length > 0 && (
            <section className="fpe-board-module" aria-label="Fjernes fra forsiden">
              <h4 className="fpe-h4">Står på forsiden nu, men fjernes af forslaget</h4>
              <ul className="fpe-slot-list">
                {removed.map((r) => (
                  <li key={`${r.moduleId}:${r.slotIndex}`} className="fpe-slot fpe-slot--removed">
                    <span className="fpe-slot-name">{slotName(r)}</span>
                    <span className="fpe-slot-title">{title(r.liveArticleId ?? "")}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {editing && (
          <aside className="fpe-pool" aria-labelledby="fpe-pool-h">
            <h4 className="fpe-h4" id="fpe-pool-h">Artikler at sætte ind</h4>
            <p className="fpe-help">Træk en artikel til et slot, eller vælg slot i listen. Rækværkene tjekkes af serveren ved hver ændring.</p>
            <ul className="fpe-pool-list">
              {pool.map((p) => (
                <PoolItem key={p.id} article={p} slots={slots} slotName={slotName} disabled={busy} onPlace={(to) => onChange(placeArticle(assignments, to, { id: p.id, label: p.label }, modules))} />
              ))}
            </ul>
          </aside>
        )}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <div className="fpe-slot fpe-slot--overlay">{describe(active)}</div> : null}</DragOverlay>
    </DndContext>
  );
}

function SlotRow({ refSlot, name, assignment: a, article, diff, warnings, editing, explainOpen, onToggleExplain, moduleLabel, onUp, onDown, onRemove, canUp, canDown }: {
  refSlot: SlotRef; name: string; assignment?: SlotAssignment; article?: ArticleLite; diff?: DiffStatus; warnings: Violation[]; editing: boolean; explainOpen: boolean; onToggleExplain: () => void; moduleLabel: string; onUp: () => void; onDown: () => void; onRemove: () => void; canUp: boolean; canDown: boolean;
}) {
  const id = slotId(refSlot);
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id, disabled: !editing });
  const { setNodeRef: setDragRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `drag|${id}`, disabled: !editing || !a });
  const dl = diff ? DIFF_LABEL[diff] : null;
  return (
    <li ref={setDropRef} className={`fpe-slot${isOver ? " is-over" : ""}${isDragging ? " is-dragging" : ""}${!a ? " is-empty" : ""}`}>
      {isOver && <span className="fpe-drop-indicator fpe-drop-indicator--before" aria-hidden="true" />}
      <div className="fpe-slot-head">
        <span className="fpe-slot-name">Slot {refSlot.slotIndex + 1}</span>
        {a ? (
          <>
            {editing && (
              <button type="button" ref={setActivatorNodeRef} className="fpe-handle fpe-handle--small" aria-label={`Flyt ${article?.titel ?? "artiklen"} fra ${name}`} {...attributes} {...listeners}>
                <GripVertical size={16} aria-hidden="true" />
              </button>
            )}
            <div ref={setDragRef} className="fpe-slot-main">
              <span className="fpe-slot-title">{article?.titel ?? `Artikel ${a.articleId.slice(0, 8)}`}</span>
              <span className="fpe-slot-badges">
                <Badge tone={toneOfType(article?.indholdstype ?? "")} title="Mærkning på forsiden (kan ikke slås fra)">{a.label.tekst}</Badge>
                <Badge tone={a.kilde === "ai" ? "ai" : a.kilde === "redaktør" ? "accent" : "neutral"}>{KILDE_LABEL[a.kilde] ?? a.kilde}</Badge>
                <Badge>P{a.prioritet}</Badge>
                {a.konfidens !== null && <Badge title="AI-konfidens">{Math.round(a.konfidens * 100)} %</Badge>}
                {a.score !== undefined && <Badge title="Deterministisk score">score {a.score.toFixed(0)}</Badge>}
                {a.locked && <Badge tone="accent" title="Fastgjort: AI flytter den ikke"><Lock size={12} aria-hidden="true" /> Fastgjort</Badge>}
                {dl && <Badge tone={dl.tone}>{dl.text}</Badge>}
              </span>
            </div>
            <div className="fpe-slot-actions">
              <button type="button" className="fpe-iconbtn" onClick={onToggleExplain} aria-expanded={explainOpen} aria-label={`Hvorfor står ${article?.titel ?? "artiklen"} her?`} title="Hvorfor står den her?">
                <HelpCircle size={16} aria-hidden="true" />
              </button>
              {editing && (
                <>
                  <button type="button" className="fpe-iconbtn" onClick={onUp} disabled={!canUp} aria-label={`Flyt ${article?.titel ?? "artiklen"} et slot op`}><ArrowUp size={16} aria-hidden="true" /></button>
                  <button type="button" className="fpe-iconbtn" onClick={onDown} disabled={!canDown} aria-label={`Flyt ${article?.titel ?? "artiklen"} et slot ned`}><ArrowDown size={16} aria-hidden="true" /></button>
                  <button type="button" className="fpe-iconbtn fpe-iconbtn--danger" onClick={onRemove} aria-label={`Fjern ${article?.titel ?? "artiklen"} fra ${name}`}><X size={16} aria-hidden="true" /></button>
                </>
              )}
            </div>
          </>
        ) : (
          <span ref={setDragRef} className="fpe-slot-title fpe-muted">Tomt slot{editing ? ": træk en artikel hertil" : ""}</span>
        )}
      </div>
      {a && explainOpen && (
        <ul className="fpe-explain" aria-label="Hvorfor står den her?">
          {explainAssignment(a, { moduleLabel }).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="fpe-slot-warn">
          {warnings.map((w, i) => (
            <li key={i}><strong>{violationTitle(w)}:</strong> {w.besked}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PoolItem({ article, slots, slotName, disabled, onPlace }: { article: ArticleLite; slots: SlotRef[]; slotName: (r: SlotRef) => string; disabled: boolean; onPlace: (to: SlotRef) => void }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `pool|${article.id}`, disabled });
  return (
    <li className={`fpe-pool-item${isDragging ? " is-dragging" : ""}`}>
      <button type="button" ref={setActivatorNodeRef} className="fpe-handle fpe-handle--small" aria-label={`Træk ${article.titel} til et slot`} {...attributes} {...listeners} disabled={disabled}>
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <div ref={setNodeRef} className="fpe-pool-main">
        <span className="fpe-slot-title">{article.titel}</span>
        <Badge tone={toneOfType(article.indholdstype)}>{article.label.tekst}</Badge>
        <label className="sr-only" htmlFor={`pool-${article.id}`}>Sæt {article.titel} i slot</label>
        <select id={`pool-${article.id}`} className="fpe-input fpe-input--small" value="" disabled={disabled} onChange={(e) => { const r = parseSlotId(e.target.value); if (r) onPlace(r); e.currentTarget.value = ""; }}>
          <option value="">Sæt i slot…</option>
          {slots.map((s) => (
            <option key={slotId(s)} value={slotId(s)}>{slotName(s)}</option>
          ))}
        </select>
      </div>
    </li>
  );
}
