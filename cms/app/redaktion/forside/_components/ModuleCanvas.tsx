"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import { effectiveVariant, type ModuleInstance } from "@/lib/frontpage/layout-schema";
import { MODULE_REGISTRY } from "@/lib/frontpage/modules";
import type { Violation } from "@/lib/frontpage/types";
import { breaksOf, topLevel } from "../_lib/layout-ops";
import { Badge } from "./ui";

const label = (m: ModuleInstance) => MODULE_REGISTRY[m.type]?.label ?? m.type;

const instructions: ScreenReaderInstructions = {
  draggable:
    "For at flytte et modul: tryk mellemrum for at løfte det, brug piletasterne op og ned til at vælge en ny placering, tryk mellemrum igen for at slippe, eller Escape for at fortryde. Du kan også bruge knapperne Flyt op og Flyt ned.",
};

interface Props {
  modules: ModuleInstance[];
  selectedId: string | null;
  violations: Violation[];
  canEdit: boolean;
  onSelect: (id: string) => void;
  onMove: (activeId: string, overId: string) => void;
  onMoveBy: (id: string, delta: number) => void;
  onToggleVisible: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

export function ModuleCanvas(p: Props) {
  const top = topLevel(p.modules);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nameOf = (id: string | number) => {
    const m = top.find((x) => x.id === id);
    return m ? label(m) : String(id);
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Løftede ${nameOf(active.id)}. Position ${top.findIndex((m) => m.id === active.id) + 1} af ${top.length}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} er nu over position ${top.findIndex((m) => m.id === over.id) + 1} af ${top.length}.` : `${nameOf(active.id)} er ikke over et modul.`),
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} er flyttet til position ${top.findIndex((m) => m.id === over.id) + 1} af ${top.length}.` : `${nameOf(active.id)} blev sluppet uden at flytte.`),
    onDragCancel: ({ active }) => `Flytning af ${nameOf(active.id)} er annulleret.`,
  };

  const onEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (e.over && e.active.id !== e.over.id) p.onMove(String(e.active.id), String(e.over.id));
  };
  const activeModule = top.find((m) => m.id === activeId);

  return (
    <DndContext
      id="fpe-modules-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements, screenReaderInstructions: instructions, restoreFocus: true }}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={onEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={top.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <ol className="fpe-canvas" aria-label="Forsidens moduler i rækkefølge">
          {top.map((m, i) => (
            <SortableModule key={m.id} module={m} index={i} total={top.length} {...p} />
          ))}
        </ol>
      </SortableContext>
      <DragOverlay dropAnimation={null}>{activeModule ? <div className="fpe-module fpe-module--overlay"><ModuleSummary module={activeModule} modules={p.modules} violations={p.violations} /></div> : null}</DragOverlay>
      {top.length === 0 && <p className="fpe-empty">Layoutet er tomt. Tilføj et modul eller en skabelon fra biblioteket.</p>}
    </DndContext>
  );
}

function ModuleSummary({ module: m, modules, violations }: { module: ModuleInstance; modules: ModuleInstance[]; violations: Violation[] }) {
  const def = MODULE_REGISTRY[m.type];
  const mine = violations.filter((v) => v.moduleId === m.id || breaksOf(modules, m).some((b) => b.module.id === v.moduleId));
  const blocking = mine.filter((v) => v.severity === "blokerende").length;
  return (
    <div className="fpe-module-main">
      <div className="fpe-module-title">
        <strong>{label(m)}</strong>
        {def?.kind === "dynamisk" && <Badge>Dynamisk</Badge>}
        {!m.visible && <Badge tone="warn">Skjult</Badge>}
        {m.mode === "auto" && <Badge tone="warn" title="Auto er endnu ikke aktivt">Auto (ikke aktiv)</Badge>}
        {mine.length > 0 && <Badge tone={blocking ? "error" : "warn"}>{mine.length} advarsel{mine.length === 1 ? "" : "er"}</Badge>}
      </div>
      <p className="fpe-module-meta">
        {m.slots} slot{m.slots === 1 ? "" : "s"} · {effectiveVariant(m)} · {m.region === "full" ? "fuld bredde" : m.region === "main" ? "hovedspalte" : "sidespalte"}
        {m.config.titel ? ` · "${m.config.titel}"` : ""}
        {m.config.sektionSlug ? ` · sektion ${m.config.sektionSlug}` : ""}
      </p>
      {breaksOf(modules, m).length > 0 && (
        <ul className="fpe-break-chips" aria-label="Break-punkter">
          {breaksOf(modules, m).map(({ ref, module: b }) => (
            <li key={b.id} className="fpe-break-chip">
              Efter slot {ref.afterSlot}: {label(b)}
              {ref.repeatEvery ? ` (hver ${ref.repeatEvery}.)` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SortableModule({ module: m, index, total, modules, selectedId, violations, canEdit, onSelect, onMoveBy, onToggleVisible, onDuplicate, onRemove }: Props & { module: ModuleInstance; index: number; total: number }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver, activeIndex, overIndex } = useSortable({ id: m.id, disabled: !canEdit });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const indicator = isOver && !isDragging ? (overIndex < activeIndex ? "before" : "after") : null;
  const name = label(m);
  return (
    <li ref={setNodeRef} style={style} className={`fpe-module${selectedId === m.id ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}${!m.visible ? " is-hidden" : ""}${indicator ? ` has-drop-${indicator}` : ""}`} aria-label={`${name}, position ${index + 1} af ${total}`}>
      {indicator === "before" && <span className="fpe-drop-indicator fpe-drop-indicator--before" aria-hidden="true" />}
      <button type="button" ref={setActivatorNodeRef} className="fpe-handle" aria-label={`Flyt ${name}. Tryk mellemrum for at løfte.`} {...attributes} {...listeners} disabled={!canEdit}>
        <GripVertical size={18} aria-hidden="true" />
      </button>
      <button type="button" className="fpe-module-body" onClick={() => onSelect(m.id)} aria-pressed={selectedId === m.id} aria-label={`Vælg ${name} for at redigere indstillinger`}>
        <ModuleSummary module={m} modules={modules} violations={violations} />
      </button>
      {canEdit && (
        <div className="fpe-module-actions" role="group" aria-label={`Handlinger for ${name}`}>
          <button type="button" className="fpe-iconbtn" onClick={() => onMoveBy(m.id, -1)} disabled={index === 0} aria-label={`Flyt ${name} op`} title="Flyt op">
            <ArrowUp size={16} aria-hidden="true" />
          </button>
          <button type="button" className="fpe-iconbtn" onClick={() => onMoveBy(m.id, 1)} disabled={index === total - 1} aria-label={`Flyt ${name} ned`} title="Flyt ned">
            <ArrowDown size={16} aria-hidden="true" />
          </button>
          <button type="button" className="fpe-iconbtn" onClick={() => onToggleVisible(m.id)} aria-label={m.visible ? `Skjul ${name}` : `Vis ${name}`} title={m.visible ? "Skjul" : "Vis"}>
            {m.visible ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
          </button>
          <button type="button" className="fpe-iconbtn" onClick={() => onDuplicate(m.id)} aria-label={`Dublér ${name}`} title="Dublér">
            <Copy size={16} aria-hidden="true" />
          </button>
          <button type="button" className="fpe-iconbtn fpe-iconbtn--danger" onClick={() => onRemove(m.id)} aria-label={`Fjern ${name}`} title="Fjern">
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      {indicator === "after" && <span className="fpe-drop-indicator fpe-drop-indicator--after" aria-hidden="true" />}
    </li>
  );
}
