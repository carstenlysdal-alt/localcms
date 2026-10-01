"use client";

import { useEffect } from "react";
import { createEventQueue, type SlotEvent } from "./tracker-logic";

/**
 * Måler impressions (≥ 50 % synlig i ≥ 1 s) og klik pr. forsideslot via /api/frontpage/track.
 * Monteres ÉN gang på forsiden. Ingen cookies, ingen persondata; serveren dedupe'r og filtrerer bots.
 * Slår sig selv fra for automatiserede klienter (navigator.webdriver) og "Do Not Track".
 */
const DWELL_MS = 1000;
const FLUSH_MS = 3000;

function readSlot(el: Element): Omit<SlotEvent, "type"> | null {
  const moduleId = el.getAttribute("data-fp-module");
  const slotKey = el.getAttribute("data-fp-slot");
  const articleId = el.getAttribute("data-fp-article");
  if (!moduleId || slotKey === null || !articleId) return null;
  return { moduleId, slotKey, articleId };
}

export function FrontpageTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (navigator.webdriver || navigator.doNotTrack === "1") return;

    const send = (e: SlotEvent) => {
      const body = JSON.stringify(e);
      try {
        if (navigator.sendBeacon && navigator.sendBeacon("/api/frontpage/track", new Blob([body], { type: "application/json" }))) return;
      } catch {
        /* falder tilbage til fetch */
      }
      fetch("/api/frontpage/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    };
    const queue = createEventQueue(send);
    const timers = new Map<Element, number>();

    const flush = () => {
      queue.flush();
    };
    const flushTimer = window.setInterval(flush, FLUSH_MS);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (timers.has(el)) continue;
            timers.set(
              el,
              window.setTimeout(() => {
                timers.delete(el);
                const slot = readSlot(el);
                if (slot) queue.add({ ...slot, type: "impression" });
                io.unobserve(el);
              }, DWELL_MS),
            );
          } else {
            const t = timers.get(el);
            if (t !== undefined) {
              window.clearTimeout(t);
              timers.delete(el);
            }
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    document.querySelectorAll("[data-fp-article]").forEach((el) => io.observe(el));

    const onClick = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      const a = target?.closest?.("a");
      const slotEl = a?.closest("[data-fp-article]");
      if (!a || !slotEl) return;
      const slot = readSlot(slotEl);
      if (slot && queue.add({ ...slot, type: "click" })) flush();
    };
    document.addEventListener("click", onClick, true);

    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(flushTimer);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
  return null;
}
