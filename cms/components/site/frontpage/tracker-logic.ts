/**
 * Ren kø-logik til forside-måling: dedupe pr. sideindlæsning, loft, batching. Ingen DOM, ingen PII.
 */
export interface SlotEvent {
  moduleId: string;
  slotKey: string;
  articleId: string;
  type: "impression" | "click";
}

export const MAX_EVENTS_PER_PAGE = 60;

export function eventKey(e: SlotEvent): string {
  return `${e.type}:${e.moduleId}:${e.slotKey}:${e.articleId}`;
}

/** Klient-side validering der spejler /api/frontpage/track (så vi ikke sender ugyldige beacons). */
export function isValidEvent(e: SlotEvent): boolean {
  return (
    /^[a-z0-9][a-z0-9-]{1,39}$/.test(e.moduleId) &&
    /^\d{1,2}$/.test(e.slotKey) &&
    /^[A-Za-z0-9_-]{8,64}$/.test(e.articleId) &&
    (e.type === "impression" || e.type === "click")
  );
}

export function createEventQueue(send: (e: SlotEvent) => void, max = MAX_EVENTS_PER_PAGE) {
  const seen = new Set<string>();
  let pending: SlotEvent[] = [];
  let sent = 0;
  return {
    add(e: SlotEvent): boolean {
      if (!isValidEvent(e)) return false;
      const k = eventKey(e);
      if (seen.has(k) || seen.size >= max) return false;
      seen.add(k);
      pending.push(e);
      return true;
    },
    flush(): number {
      const batch = pending;
      pending = [];
      for (const e of batch) {
        send(e);
        sent++;
      }
      return batch.length;
    },
    get pending() {
      return pending.length;
    },
    get sent() {
      return sent;
    },
  };
}
