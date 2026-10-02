"use client";

import { useCallback, useRef, useState } from "react";
import type { EditorialRequest, EditorialResponse, EditorialTask } from "@/lib/ai/editorial-schemas";

export type AiOk = Extract<EditorialResponse, { ok: true }>;
export type AiEntry = { status: "loading" } | { status: "error"; error: string; code?: string } | { status: "ready"; response: AiOk };

export type AiContext = EditorialRequest["context"];

/**
 * Klient-hook til feltniveau-AI (POST /api/redaktion/ai). Alt er FORSLAG: hook'en gemmer intet og ændrer ikke formularen.
 * `key` adskiller samtidige forslag af samme opgave (fx alt-tekst pr. billedblok).
 */
export function useEditorialAi({ articleId, getContext }: { articleId: string | null; getContext: () => AiContext }) {
  const [entries, setEntries] = useState<Record<string, AiEntry>>({});
  const [announce, setAnnounce] = useState("");
  const seq = useRef<Record<string, number>>({});

  const run = useCallback(
    async (task: EditorialTask, params: NonNullable<EditorialRequest["params"]> = {}, key: string = task) => {
      const id = (seq.current[key] ?? 0) + 1;
      seq.current[key] = id;
      setEntries((e) => ({ ...e, [key]: { status: "loading" } }));
      setAnnounce("AI arbejder…");
      let entry: AiEntry;
      try {
        const res = await fetch("/api/redaktion/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task, articleId, context: getContext(), params } satisfies EditorialRequest),
        });
        const data = (await res.json().catch(() => null)) as EditorialResponse | null;
        if (data && data.ok) entry = { status: "ready", response: data };
        else entry = { status: "error", error: data && !data.ok ? data.error : "AI kunne ikke svare. Prøv igen.", code: data && !data.ok ? data.code : undefined };
      } catch {
        entry = { status: "error", error: "Kunne ikke nå serveren. Tjek forbindelsen og prøv igen." };
      }
      if (seq.current[key] !== id) return; // et nyere kald har overtaget
      setEntries((e) => ({ ...e, [key]: entry }));
      setAnnounce(entry.status === "ready" ? "AI-forslag er klar." : entry.status === "error" ? entry.error : "");
    },
    [articleId, getContext],
  );

  const dismiss = useCallback((key: string) => {
    seq.current[key] = (seq.current[key] ?? 0) + 1;
    setEntries((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }, []);

  return { entries, run, dismiss, announce };
}
