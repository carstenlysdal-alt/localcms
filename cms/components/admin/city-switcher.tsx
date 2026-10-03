"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, ExternalLink, Lock } from "lucide-react";
import { switchInstance } from "@/app/redaktion/instans-actions";
import { CityDot } from "@/components/ui/CityDot";

/**
 * En by i skifteren. `instansId` er kun sat for byer brugeren HAR adgang til (hjem eller adgangsrække, afgjort på serveren);
 * øvrige byer er ikke klikbare, men "Se siden" (den offentlige side) virker stadig. Serveren genvaliderer ved hvert skift
 * (app/redaktion/instans-actions.ts) — klienten kan aldrig selv vælge en by.
 */
export type NavCity = {
  by: string;
  instansId: string | null;
  /** Den aktive by: den der redigeres nu. */
  current: boolean;
  /** Brugerens hjemmeby. */
  home?: boolean;
  /** Byens offentlige side: `/?by=<nøgle>` på preview-værten (samme by som redigeringen), ellers byens eget domæne. Null = ukendt. */
  publicHref: string | null;
};

/** `/redaktion/artikler/abc` -> `/redaktion/artikler`: en enkelt artikel/medie findes ikke i den nye by, så vi lander på listen. */
export function sectionRoot(pathname: string | null | undefined): string {
  const parts = (pathname ?? "").split("/").filter(Boolean);
  return parts[0] === "redaktion" && parts[1] ? `/redaktion/${parts[1]}` : "/redaktion/artikler";
}

/**
 * Skifter by via serveractionen og genindlæser derefter siden helt (hård navigation): klientens router-cache kan ellers indeholde
 * den forrige bys sider. Fejl vises i en live-region; intet skifter ved afvisning.
 */
export function useSwitchCity() {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  function switchTo(instansId: string) {
    setMessage("");
    startTransition(async () => {
      try {
        const res = await switchInstance(instansId);
        if (!res.ok) {
          setMessage(res.message);
          return;
        }
        window.location.assign(sectionRoot(pathname));
      } catch {
        setMessage("Kunne ikke skifte by. Prøv igen.");
      }
    });
  }
  return { switchTo, pending, message };
}

/** "Redigerer: Næstved" i topbaren. Med flere byer er det en menu (knapper), ellers en ren etiket. */
export function CitySwitcher({ cities }: { cities: NavCity[] }) {
  const current = cities.find((c) => c.current);
  const choices = cities.filter((c) => c.instansId);
  const { switchTo, pending, message } = useSwitchCity();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  if (!current) return null;
  const label = (
    <>
      <CityDot city={current.by} />
      <span className="shell-cityswitch-kicker">Redigerer:</span>
      <span className="shell-cityswitch-name">{current.by}</span>
    </>
  );
  const view = current.publicHref ? (
    <a className="shell-cityswitch-view" href={current.publicHref} rel="noopener">
      <ExternalLink size={16} aria-hidden="true" />
      <span className="shell-cityswitch-viewtext">Se siden</span>
      <span className="sr-only"> for {current.by} (åbner den offentlige side)</span>
    </a>
  ) : null;
  if (choices.length < 2) return <div className="shell-cityswitch" data-single="true"><span className="shell-cityswitch-btn is-static">{label}</span>{view}</div>;

  return (
    <div className="shell-cityswitch" ref={root}>
      <button ref={button} type="button" className="shell-cityswitch-btn" aria-expanded={open} aria-controls="shell-cityswitch-menu" onClick={() => setOpen((v) => !v)} disabled={pending}>
        {label}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <ul id="shell-cityswitch-menu" className="shell-cityswitch-menu" aria-label="Vælg by at redigere">
          {choices.map((city) => (
            <li key={city.by}>
              <button
                type="button"
                className="shell-cityswitch-item"
                aria-current={city.current ? "true" : undefined}
                disabled={pending || city.current}
                onClick={() => {
                  setOpen(false);
                  if (city.instansId) switchTo(city.instansId);
                }}
              >
                <CityDot city={city.by} />
                <span className="shell-cityswitch-itemname">{city.by}</span>
                {city.current ? <Check size={16} aria-hidden="true" /> : null}
                {city.current ? <span className="sr-only">(redigeres nu)</span> : city.home ? <span className="shell-cityswitch-note">Hjem</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {view}
      <span className="sr-only" role="status" aria-live="polite">{pending ? "Skifter by…" : message}</span>
      {message ? <span className="shell-cityswitch-error" role="alert">{message}</span> : null}
    </div>
  );
}

/** Rækken for én by i sidebarens by-liste: skifteknap (eller låst) + "Se siden" (byens offentlige side). */
export function CityRow({ city, onSwitch, pending }: { city: NavCity; onSwitch: (instansId: string) => void; pending: boolean }) {
  const canSwitch = Boolean(city.instansId);
  return (
    <div className={`shell-cityrow${city.current ? " is-current" : ""}`}>
      {canSwitch ? (
        <button
          type="button"
          className={`shell-link shell-link-city${city.current ? " is-current" : ""}`}
          aria-current={city.current ? "true" : undefined}
          disabled={pending || city.current}
          onClick={() => city.instansId && onSwitch(city.instansId)}
        >
          <CityDot city={city.by} />
          <span className="shell-link-text">{city.by}</span>
          {city.current ? <span className="shell-link-note">Redigeres nu</span> : city.home ? <span className="shell-link-note">Hjem</span> : null}
        </button>
      ) : (
        <span className="shell-link shell-link-city is-locked">
          <CityDot city={city.by} />
          <span className="shell-link-text">{city.by}</span>
          <Lock size={14} aria-hidden="true" className="shell-link-ext" />
          <span className="sr-only">(ingen adgang til at redigere)</span>
        </span>
      )}
      {city.publicHref ? (
        <a className="shell-cityrow-view" href={city.publicHref} rel="noopener">
          <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only">Se siden for {city.by}</span>
        </a>
      ) : null}
    </div>
  );
}

/**
 * By-faner til Artikler/Analytics: "Alle byer" (oversigt over de byer brugeren har adgang til) + én fane pr. by.
 * Byer med adgang skifter den aktive by (serveractionen) og lander på siden for den by; byer uden adgang er låste.
 * `variant="cms"` bruger artikelstyrens faneklasser, `"ui"` UI-kittets. `bare` udelader `<nav>` (indsættes i en eksisterende fanerække).
 */
export function CityTabs({ cities, allHref, allActive = false, label, variant = "ui", bare = false }: { cities: NavCity[]; allHref?: string | null; allActive?: boolean; label: string; variant?: "ui" | "cms"; bare?: boolean }) {
  const { switchTo, pending, message } = useSwitchCity();
  const cls = variant === "cms" ? "cms-tab is-city" : "ui-tab";
  const navCls = variant === "cms" ? "cms-tabs" : "ui-tablist ui-linktabs";
  const Wrap = bare ? Fragment : "nav";
  const wrapProps = bare ? {} : { "aria-label": label, className: navCls };
  return (
    <Wrap {...wrapProps}>
      {allHref ? (
        <a className={variant === "cms" ? "cms-tab" : "ui-tab"} href={allHref} aria-current={allActive ? "page" : undefined}>Alle byer</a>
      ) : null}
      {cities.map((city) => {
        const dot = <CityDot city={city.by} />;
        if (!city.instansId) {
          return (
            <span key={city.by} className={`${cls} is-locked`} aria-disabled="true" title="Du har ikke adgang til at redigere denne by">
              {dot} {city.by}<span className="sr-only"> (ingen adgang)</span>
            </span>
          );
        }
        if (city.current && !allActive) {
          return <span key={city.by} className={cls} aria-current={bare ? "true" : "page"}>{dot} {city.by}</span>;
        }
        return (
          <button key={city.by} type="button" className={cls} disabled={pending} onClick={() => city.instansId && switchTo(city.instansId)}>
            {dot} {city.by}<span className="sr-only"> (skift til denne by)</span>
          </button>
        );
      })}
      <span className="sr-only" role="status" aria-live="polite">{pending ? "Skifter by…" : message}</span>
    </Wrap>
  );
}

/**
 * Åbner en post i dens egen by fra en "Alle byer"-oversigt: er den allerede aktiv, er det et almindeligt link; ellers skiftes
 * byen først (serveren tjekker adgangen), og siden åbnes derefter. Instans-id'et kommer fra serveren og valideres igen dér.
 */
export function CityOpenLink({ instansId, current, href, children }: { instansId: string; current: boolean; href: string; children: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  if (current) return <a className="article-title-link" href={href}>{children}</a>;
  return (
    <span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await switchInstance(instansId);
            if (!res.ok) setMessage(res.message);
            else window.location.assign(href);
          })
        }
      >
        {children}
      </button>
      {message ? <span className="ui-small ui-muted" role="alert"> {message}</span> : null}
    </span>
  );
}
