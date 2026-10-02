"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";

export type ArticleChatContext = {
  artikelId: string | null;
  titel: string;
  manchet: string;
  brodtekst: string;
  sektion: string | null;
  geo: string[];
  tags: string[];
};

type Getter = (() => ArticleChatContext) | null;
const Ctx = createContext<{ current: Getter } | null>(null);

/** Forbinder editoren (som ejer artiklens live-tilstand) med AI-docken (chat) uden at løfte hele tilstanden op. */
export function EditorBridgeProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<Getter>(null);
  return <Ctx.Provider value={ref}>{children}</Ctx.Provider>;
}

/** Editoren registrerer her en funktion, der giver artikelkonteksten (titel, underrubrik, brødtekst som ren tekst, sektion, geo, tags). */
export function useEditorBridge(getter: () => ArticleChatContext) {
  const ref = useContext(Ctx);
  const getterRef = useRef(getter);
  useEffect(() => {
    getterRef.current = getter;
  });
  useEffect(() => {
    if (!ref) return;
    ref.current = () => getterRef.current();
    return () => { ref.current = null; };
  }, [ref]);
}

/** Docken henter konteksten lige før en besked sendes (null hvis ingen editor er monteret). */
export function useArticleChatContext(): () => ArticleChatContext | null {
  const ref = useContext(Ctx);
  return useCallback(() => (ref?.current ? ref.current() : null), [ref]);
}
