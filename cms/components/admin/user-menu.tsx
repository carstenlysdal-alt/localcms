"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronUp, LogOut, UserRound, Users, Activity } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

export type UserMenuProps = {
  name: string;
  roleName: string;
  canManageUsers: boolean;
  canUseOperator: boolean;
  /** Server action (fra layoutet) der logger ud. */
  logoutAction: () => Promise<void>;
};

/**
 * Brugerblok nederst i sidebaren med menu (WAI-ARIA menu button): Min konto, Brugere/Operator (kun med rettighed), Log ud.
 * Åbner opad. Piletaster flytter, Esc/klik udenfor lukker og returnerer fokus til knappen.
 */
export function UserMenu({ name, roleName, canManageUsers, canUseOperator, logoutAction }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    items()[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const list = items();
      const idx = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === "Escape") { setOpen(false); button.current?.focus(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); list[(idx + 1) % list.length]?.focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); list[(idx - 1 + list.length) % list.length]?.focus(); }
      else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
      else if (e.key === "End") { e.preventDefault(); list[list.length - 1]?.focus(); }
      else if (e.key === "Tab") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="shell-user">
      {open ? (
        <div ref={menu} id={`${uid}-menu`} role="menu" aria-label="Brugermenu" className="shell-user-menu">
          <Link role="menuitem" href="/redaktion/konto" className="shell-user-item" onClick={() => setOpen(false)}><UserRound size={16} aria-hidden="true" /> Min konto</Link>
          {canManageUsers ? <Link role="menuitem" href="/redaktion/brugere" className="shell-user-item" onClick={() => setOpen(false)}><Users size={16} aria-hidden="true" /> Brugere</Link> : null}
          {canUseOperator ? <Link role="menuitem" href="/redaktion/operator" className="shell-user-item" onClick={() => setOpen(false)}><Activity size={16} aria-hidden="true" /> Operator</Link> : null}
          <form action={logoutAction}>
            <button role="menuitem" type="submit" className="shell-user-item"><LogOut size={16} aria-hidden="true" /> Log ud</button>
          </form>
        </div>
      ) : null}
      <button ref={button} type="button" className="shell-user-button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${uid}-menu` : undefined} onClick={() => setOpen((v) => !v)}>
        <Avatar name={name} size="md" />
        <span className="shell-user-text">
          <span className="shell-user-name">{name}</span>
          <span className="shell-user-role">{roleName}</span>
        </span>
        <ChevronUp size={16} aria-hidden="true" className="shell-user-chevron" />
      </button>
    </div>
  );
}
