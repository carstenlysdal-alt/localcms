"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";

export type AccordionItem = {
  /** Stabilt id (bruges til aria og til åben/lukket-tilstand). */
  id: string;
  title: ReactNode;
  /** Ekstra indhold i hovedet, fx en <Badge> eller en kort status (ikke interaktivt). */
  meta?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

export type AccordionProps = {
  items: AccordionItem[];
  /** Flere paneler åbne samtidig (standard: ja). Sæt false for "kun ét ad gangen". */
  allowMultiple?: boolean;
  /** Overskriftsniveau for hver sektion (default 3). */
  headingLevel?: 2 | 3 | 4;
  /** Kontrolleret tilstand (valgfri). */
  openIds?: string[];
  onOpenChange?: (openIds: string[]) => void;
  className?: string;
};

/**
 * WAI-ARIA Accordion: hver sektion er en overskrift med en knap (aria-expanded/aria-controls); panelet er en region.
 * Lukkede paneler forbliver i DOM'en (attributten `hidden`), så formularfelter i dem bevares og stadig sendes med.
 * Tastatur: Enter/Space åbner/lukker · Pil op/ned, Home, End flytter mellem sektionernes knapper.
 */
export function Accordion({ items, allowMultiple = true, headingLevel = 3, openIds, onOpenChange, className }: AccordionProps) {
  const uid = useId();
  const [inner, setInner] = useState<string[]>(() => {
    const initial = items.filter((i) => i.defaultOpen).map((i) => i.id);
    return allowMultiple ? initial : initial.slice(0, 1);
  });
  const open = openIds ?? inner;
  const triggers = useRef<Array<HTMLButtonElement | null>>([]);
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  function toggle(id: string) {
    const isOpen = open.includes(id);
    const next = isOpen ? open.filter((x) => x !== id) : allowMultiple ? [...open, id] : [id];
    if (openIds === undefined) setInner(next);
    onOpenChange?.(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    let target = -1;
    if (e.key === "ArrowDown") target = index === last ? 0 : index + 1;
    else if (e.key === "ArrowUp") target = index === 0 ? last : index - 1;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = last;
    if (target >= 0) {
      e.preventDefault();
      triggers.current[target]?.focus();
    }
  }

  return (
    <div className={cn("ui-accordion", className)}>
      {items.map((item, index) => {
        const isOpen = open.includes(item.id);
        const triggerId = `${uid}-trigger-${item.id}`;
        const panelId = `${uid}-panel-${item.id}`;
        return (
          <div key={item.id} className="ui-accordion-item" data-open={isOpen ? "true" : "false"}>
            <Heading className="ui-accordion-heading">
              <button
                ref={(el) => { triggers.current[index] = el; }}
                type="button"
                id={triggerId}
                className="ui-accordion-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                onKeyDown={(e) => onKeyDown(e, index)}
              >
                {item.icon ? <span className="ui-accordion-icon" aria-hidden="true">{item.icon}</span> : null}
                <span className="ui-accordion-title">{item.title}</span>
                {item.meta ? <span className="ui-accordion-meta">{item.meta}</span> : null}
                <ChevronDown className="ui-accordion-chevron" size={18} aria-hidden="true" />
              </button>
            </Heading>
            <div id={panelId} role="region" aria-labelledby={triggerId} className="ui-accordion-panel" hidden={!isOpen}>
              {item.children}
            </div>
          </div>
        );
      })}
    </div>
  );
}
