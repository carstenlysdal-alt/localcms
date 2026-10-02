"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type ShellContext = { drawerOpen: boolean; openDrawer: () => void; closeDrawer: () => void };
const Ctx = createContext<ShellContext>({ drawerOpen: false, openDrawer: () => {}, closeDrawer: () => {} });
export const useShell = () => useContext(Ctx);

const MOBILE = "(max-width: 900px)";

/**
 * Skallens klient-del: åbner/lukker mobil-drawer. Når drawer'en er åben (kun ≤ 900 px) gøres resten af siden `inert`
 * (fokus-fælde + skærmlæsere springer over), Esc lukker og fokus gives tilbage til hamburger-knappen. Lukker ved sideskift.
 */
export function ShellFrame({ children }: { children: ReactNode }) {
  const [drawerOpen, setOpen] = useState(false);
  const pathname = usePathname();
  const returnFocus = useRef<HTMLElement | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const openDrawer = useCallback(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);
  const closeDrawer = useCallback(() => setOpen(false), []);

  // Luk ved sideskift (justering af state under render er tilladt og undgår en effekt-kaskade).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (drawerOpen) setOpen(false);
  }

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const inertTargets = Array.from(el.querySelectorAll<HTMLElement>("[data-shell-inert]"));
    if (!drawerOpen) {
      inertTargets.forEach((t) => t.removeAttribute("inert"));
      return;
    }
    const mq = window.matchMedia(MOBILE);
    if (!mq.matches) return;
    inertTargets.forEach((t) => t.setAttribute("inert", ""));
    const first = el.querySelector<HTMLElement>("#shell-sidebar a[href], #shell-sidebar button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onChange = () => { if (!mq.matches) setOpen(false); };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onChange);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onChange);
      inertTargets.forEach((t) => t.removeAttribute("inert"));
      returnFocus.current?.focus();
    };
  }, [drawerOpen]);

  const value = useMemo(() => ({ drawerOpen, openDrawer, closeDrawer }), [drawerOpen, openDrawer, closeDrawer]);
  return (
    <Ctx.Provider value={value}>
      <div ref={root} className="shell" data-drawer={drawerOpen ? "open" : "closed"}>
        {children}
        <button type="button" className="shell-scrim" tabIndex={-1} aria-hidden="true" onClick={closeDrawer} />
      </div>
    </Ctx.Provider>
  );
}
