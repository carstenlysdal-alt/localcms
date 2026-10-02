import type { OperatorEvent } from "@/lib/operator/events";

/** Ren tilstandsmaskine for operatør-UI'et (ingen DOM) — testes i tests/operator-ui.test.ts. */

export type ConfirmStatus = "pending" | "applying" | "applied" | "cancelled" | "error" | "expired";
export type UndoStatus = "available" | "working" | "done" | "error";

export type Item =
  | { kind: "user"; id: string; text: string; status: "ok" | "error" }
  | { kind: "assistant"; id: string; text: string; streaming: boolean }
  | { kind: "tool"; id: string; name: string; summary: string; status: "running" | "ok" | "error"; resultSummary?: string }
  | { kind: "confirm"; id: string; token: string; tool: string; summary: string; details: string[]; expiresAt: string; status: ConfirmStatus; message?: string; secret?: { label: string; value: string } | null }
  | { kind: "undo"; id: string; undoId: string; label: string; status: UndoStatus; message?: string }
  | { kind: "error"; id: string; message: string; retryText: string | null };

export interface State {
  items: Item[];
  streaming: boolean;
  lastUserText: string | null;
  seq: number;
}

export const initialState: State = { items: [], streaming: false, lastUserText: null, seq: 0 };

export type Action =
  | { type: "send"; text: string; retry?: boolean }
  | { type: "event"; event: OperatorEvent }
  | { type: "abort" }
  | { type: "fail"; message: string }
  | { type: "confirm_start"; token: string }
  | { type: "confirm_done"; token: string; status: ConfirmStatus; message?: string; secret?: { label: string; value: string } | null; undo?: { undoId: string; label: string } | null }
  | { type: "undo_start"; undoId: string }
  | { type: "undo_done"; undoId: string; ok: boolean; message: string }
  | { type: "dismiss_secret"; token: string }
  | { type: "reset" };

function nextId(state: State, prefix: string): [string, number] {
  return [`${prefix}-${state.seq + 1}`, state.seq + 1];
}

function patch(items: Item[], match: (item: Item) => boolean, update: (item: Item) => Item): Item[] {
  return items.map((item) => (match(item) ? update(item) : item));
}

function stopStreaming(items: Item[]): Item[] {
  return items.map((item) => (item.kind === "assistant" && item.streaming ? { ...item, streaming: false } : item.kind === "tool" && item.status === "running" ? { ...item, status: "error", resultSummary: "Afbrudt" } : item));
}

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "send": {
      const [id, seq] = nextId(state, "u");
      let base = stopStreaming(state.items).filter((i) => i.kind !== "error");
      // Genforsøg erstatter den mislykkede besked i stedet for at tilføje en dublet.
      if (action.retry) {
        const at = base.map((i) => i.kind === "user" && i.status === "error").lastIndexOf(true);
        if (at >= 0) base = base.filter((_, idx) => idx !== at);
      }
      return { ...state, seq, streaming: true, lastUserText: action.text, items: [...base, { kind: "user", id, text: action.text, status: "ok" }] };
    }
    case "event": {
      const e = action.event;
      switch (e.type) {
        case "text": {
          const last = state.items[state.items.length - 1];
          if (last && last.kind === "assistant" && last.streaming) return { ...state, items: [...state.items.slice(0, -1), { ...last, text: last.text + e.delta }] };
          const [id, seq] = nextId(state, "a");
          return { ...state, seq, items: [...state.items, { kind: "assistant", id, text: e.delta, streaming: true }] };
        }
        case "tool_call": {
          const [, seq] = nextId(state, "t");
          return { ...state, seq, items: [...stopStreaming(state.items), { kind: "tool", id: e.id, name: e.name, summary: e.summary, status: "running" }] };
        }
        case "tool_result":
          return { ...state, items: patch(state.items, (i) => i.kind === "tool" && i.id === e.id, (i) => ({ ...i, status: e.ok ? "ok" : "error", resultSummary: e.summary }) as Item) };
        case "confirm_required": {
          const [id, seq] = nextId(state, "c");
          return { ...state, seq, items: [...stopStreaming(state.items), { kind: "confirm", id, token: e.token, tool: e.tool, summary: e.summary, details: e.details, expiresAt: e.expiresAt, status: "pending" }] };
        }
        case "undo": {
          const [id, seq] = nextId(state, "z");
          return { ...state, seq, items: [...stopStreaming(state.items), { kind: "undo", id, undoId: e.undoId, label: e.label, status: "available" }] };
        }
        case "done":
          return { ...state, streaming: false, items: stopStreaming(state.items) };
        case "error": {
          const [id, seq] = nextId(state, "e");
          return { ...state, seq, streaming: false, items: [...stopStreaming(state.items), { kind: "error", id, message: e.message, retryText: state.lastUserText }] };
        }
      }
    }
    case "abort":
      return { ...state, streaming: false, items: stopStreaming(state.items) };
    case "fail": {
      const [id, seq] = nextId(state, "e");
      return { ...state, seq, streaming: false, items: [...stopStreaming(state.items).map((i) => (i.kind === "user" && i.text === state.lastUserText ? { ...i, status: "error" as const } : i)), { kind: "error", id, message: action.message, retryText: state.lastUserText }] };
    }
    case "confirm_start":
      return { ...state, items: patch(state.items, (i) => i.kind === "confirm" && i.token === action.token && i.status === "pending", (i) => ({ ...i, status: "applying" }) as Item) };
    case "confirm_done": {
      let seq = state.seq;
      const items = patch(state.items, (i) => i.kind === "confirm" && i.token === action.token, (i) => ({ ...i, status: action.status, message: action.message, secret: action.secret ?? null }) as Item);
      if (action.undo) {
        seq += 1;
        items.push({ kind: "undo", id: `z-${seq}`, undoId: action.undo.undoId, label: action.undo.label, status: "available" });
      }
      return { ...state, seq, items };
    }
    case "undo_start":
      return { ...state, items: patch(state.items, (i) => i.kind === "undo" && i.undoId === action.undoId && i.status === "available", (i) => ({ ...i, status: "working" }) as Item) };
    case "undo_done":
      return { ...state, items: patch(state.items, (i) => i.kind === "undo" && i.undoId === action.undoId, (i) => ({ ...i, status: action.ok ? "done" : "error", message: action.message }) as Item) };
    case "dismiss_secret":
      return { ...state, items: patch(state.items, (i) => i.kind === "confirm" && i.token === action.token, (i) => ({ ...i, secret: null }) as Item) };
    case "reset":
      return initialState;
  }
}

/** Platte tekster til "Kopiér svar": al assistenttekst i samtalen. */
export function plainTranscript(items: readonly Item[]): string {
  return items.filter((i): i is Extract<Item, { kind: "assistant" }> => i.kind === "assistant").map((i) => i.text).join("\n\n");
}
