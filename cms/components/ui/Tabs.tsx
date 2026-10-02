"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export type TabItem = {
  id: string;
  label: ReactNode;
  count?: number | string;
  disabled?: boolean;
  /** Panelets indhold. */
  children: ReactNode;
};

export type TabsProps = {
  items: TabItem[];
  /** Tilgængeligt navn for fanelisten. */
  label: string;
  defaultTab?: string;
  /** Kontrolleret tilstand (valgfri). */
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
};

/**
 * WAI-ARIA Tabs (client): `tablist` > `tab` med roving tabindex; pil venstre/højre, Home, End skifter fane og flytter fokus.
 * Kun den aktive fane er i tab-rækkefølgen; panelet er fokuserbart (`tabIndex=0`). Brug <LinkTabs> når fanerne er sider/URL'er.
 */
export function Tabs({ items, label, defaultTab, value, onChange, className }: TabsProps) {
  const uid = useId();
  const enabled = items.filter((i) => !i.disabled);
  const [inner, setInner] = useState(defaultTab ?? enabled[0]?.id ?? items[0]?.id);
  const active = value ?? inner;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(id: string, focus = false) {
    if (value === undefined) setInner(id);
    onChange?.(id);
    if (focus) refs.current[id]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const idx = enabled.findIndex((i) => i.id === active);
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % enabled.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    if (next >= 0) {
      e.preventDefault();
      select(enabled[next].id, true);
    }
  }

  return (
    <div className={cn("ui-tabs", className)}>
      <div role="tablist" aria-label={label} className="ui-tablist">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(el) => { refs.current[item.id] = el; }}
              type="button"
              role="tab"
              id={`${uid}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              className="ui-tab"
              onClick={() => select(item.id)}
              onKeyDown={onKeyDown}
            >
              {item.label}
              {item.count !== undefined ? <span className="ui-tab-count">{item.count}</span> : null}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${uid}-panel-${item.id}`}
          aria-labelledby={`${uid}-tab-${item.id}`}
          tabIndex={0}
          hidden={item.id !== active}
          className="ui-tabpanel"
        >
          {item.children}
        </div>
      ))}
    </div>
  );
}
