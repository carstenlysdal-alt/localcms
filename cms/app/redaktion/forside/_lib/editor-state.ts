import type { ModuleInstance } from "@/lib/frontpage/layout-schema";

/** Undo/redo-historik for layout-kladden. Rent og testbart (ingen React). */
export const HISTORY_LIMIT = 100;

export interface EditorHistory {
  present: ModuleInstance[];
  past: ModuleInstance[][];
  future: ModuleInstance[][];
  /** JSON af sidst gemte/indlæste layout (til "ugemte ændringer"). */
  saved: string;
}

export type EditorAction =
  | { type: "commit"; modules: ModuleInstance[] }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; modules: ModuleInstance[] }
  | { type: "markSaved" };

const sig = (m: readonly ModuleInstance[]) => JSON.stringify(m);

export function initHistory(modules: ModuleInstance[]): EditorHistory {
  return { present: modules, past: [], future: [], saved: sig(modules) };
}

export function historyReducer(state: EditorHistory, action: EditorAction): EditorHistory {
  switch (action.type) {
    case "commit": {
      if (sig(action.modules) === sig(state.present)) return state;
      const past = [...state.past, state.present].slice(-HISTORY_LIMIT);
      return { ...state, present: action.modules, past, future: [] };
    }
    case "undo": {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return { ...state, present: previous, past: state.past.slice(0, -1), future: [state.present, ...state.future] };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return { ...state, present: next, past: [...state.past, state.present], future: rest };
    }
    case "reset":
      return initHistory(action.modules);
    case "markSaved":
      return { ...state, saved: sig(state.present) };
  }
}

export const isDirty = (s: EditorHistory) => sig(s.present) !== s.saved;
export const canUndo = (s: EditorHistory) => s.past.length > 0;
export const canRedo = (s: EditorHistory) => s.future.length > 0;
