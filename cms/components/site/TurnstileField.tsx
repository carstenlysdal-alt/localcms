"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile-felt til offentlige formularer. Renderer INTET (og indlæser intet script) når
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY ikke er sat — formularer virker som før.
 *
 * Montering (UI-ejere): læg <TurnstileField /> inde i <form>. Widgetten indsætter selv et skjult felt med navnet
 * `cf-turnstile-response`, som følger med i FormData (indsend, nyhedsbrev). Til actions der tager et OBJEKT i stedet
 * for FormData (sponsor, qa, interview, meddeler) bruges `onToken` og tokenet sendes med som feltet
 * "cf-turnstile-response" i objektet. Serveren (lib/ratelimit/guard.ts -> lib/turnstile.ts) tjekker kun når
 * TURNSTILE_SECRET_KEY er sat.
 *
 * CSP: scriptet indlæses dynamisk fra challenges.cloudflare.com og tillades af 'strict-dynamic' (script-src) +
 * frame-src/connect-src for samme origin (lib/security-headers.ts).
 */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
  reset(widgetId?: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SCRIPT_SRC;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile kunne ikke indlæses"));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

export function TurnstileField({
  onToken,
  action,
  theme = "auto",
}: {
  /** Kaldes med tokenet (og med null når det udløber). Kun nødvendig for object-baserede actions. */
  onToken?: (token: string | null) => void;
  /** Valgfri handlingsetiket til Cloudflares analyse (a-z, 0-9, _ og -). */
  action?: string;
  theme?: "auto" | "light" | "dark";
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let widgetId: string | null = null;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action,
          theme,
          language: "da",
          callback: (token: string) => callback.current?.(token),
          "expired-callback": () => callback.current?.(null),
          "error-callback": () => callback.current?.(null),
        });
      })
      .catch(() => callback.current?.(null));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, action, theme]);

  if (!siteKey) return null;
  return <div ref={ref} className="turnstile-field" data-testid="turnstile-field" />;
}
