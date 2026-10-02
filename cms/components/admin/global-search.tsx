"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { StatusChip } from "@/components/ui/Badge";
import { quickSearchArticles, type QuickArticleHit } from "@/app/redaktion/search-actions";
import { NAV_ICONS } from "./nav-icons";
import type { NavIconKey } from "./nav-model";

export type SearchPage = { href: string; label: string; group: string; icon: NavIconKey };

type Option = { key: string; href: string; label: string; kind: "page" | "article"; group: string; icon?: NavIconKey; status?: string };

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

/**
 * Global søgning i topbaren: hop til sider (klient-side, rettighedsfiltreret liste fra serveren) og artikler (server
 * action `quickSearchArticles`). Åbnes med knappen eller "/" (når man ikke skriver i et felt). Combobox-mønster:
 * pil op/ned flytter den aktive mulighed, Enter åbner, Esc lukker.
 */
export function GlobalSearch({ pages }: { pages: SearchPage[] }) {
  const router = useRouter();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<QuickArticleHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) queueMicrotask(() => input.current?.focus());
  }, [open]);

  const q = query.trim().toLowerCase();
  useEffect(() => {
    if (q.length < 2) return;
    const id = ++seq.current;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const hits = await quickSearchArticles(q).catch(() => []);
        if (id === seq.current) setArticles(hits);
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [q]);

  const options = useMemo<Option[]>(() => {
    const pageHits = pages
      .filter((p) => !q || p.label.toLowerCase().includes(q) || p.group.toLowerCase().includes(q))
      .slice(0, q ? 8 : 6)
      .map<Option>((p) => ({ key: `p-${p.href}`, href: p.href, label: p.label, kind: "page", group: p.group, icon: p.icon }));
    const articleHits = (q.length >= 2 ? articles : []).map<Option>((a) => ({ key: `a-${a.id}`, href: `/redaktion/artikler/${a.id}`, label: a.titel, kind: "article", group: "Artikler", status: a.status }));
    return [...pageHits, ...articleHits];
  }, [pages, articles, q]);

  function close() {
    setOpen(false);
    setQuery("");
    setArticles([]);
    setActive(0);
  }

  function go(option: Option | undefined) {
    if (!option) return;
    close();
    router.push(option.href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (options.length ? (i + 1) % options.length : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (options.length ? (i - 1 + options.length) % options.length : 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(options[active]); }
  }

  const activeId = options[active] ? `${uid}-opt-${options[active].key}` : undefined;
  const groups = Array.from(new Set(options.map((o) => o.group)));

  return (
    <>
      <button type="button" className="shell-search" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Search size={16} aria-hidden="true" />
        <span className="shell-search-text">Søg i redaktionen</span>
        <kbd className="shell-kbd" aria-label="genvej skråstreg">/</kbd>
      </button>
      <Dialog open={open} onClose={close} title="Søg i redaktionen" size="md" className="shell-search-dialog">
        <div className="shell-palette">
          <label className="ui-search shell-palette-field">
            <span className="sr-only">Søg efter sider og artikler</span>
            <Search size={16} aria-hidden="true" className="ui-search-icon" />
            <input
              ref={input}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={`${uid}-list`}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              autoComplete="off"
              value={query}
              placeholder="Skriv en side eller en artikeltitel…"
              className="ui-search-input"
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
            />
          </label>
          <div id={`${uid}-list`} role="listbox" aria-label="Resultater" className="shell-palette-list">
            {groups.map((group) => (
              <div key={group} role="group" aria-label={group}>
                <p className="shell-palette-group" aria-hidden="true">{group}</p>
                {options.filter((o) => o.group === group).map((o) => {
                  const idx = options.indexOf(o);
                  const Icon = o.icon ? NAV_ICONS[o.icon] : FileText;
                  return (
                    <div
                      key={o.key}
                      id={`${uid}-opt-${o.key}`}
                      role="option"
                      aria-selected={idx === active}
                      className="shell-palette-option"
                      onMouseMove={() => setActive(idx)}
                      onClick={() => go(o)}
                    >
                      <Icon size={16} aria-hidden="true" />
                      <span className="shell-palette-label">{o.label}</span>
                      {o.status ? <StatusChip status={o.status} /> : null}
                    </div>
                  );
                })}
              </div>
            ))}
            {options.length === 0 ? <p className="shell-palette-empty" role="status">{pending ? "Søger…" : "Ingen resultater"}</p> : null}
          </div>
          <p className="shell-palette-hint">Piletaster vælger · Enter åbner · Esc lukker</p>
        </div>
      </Dialog>
    </>
  );
}
