"use client";

import { useActionState } from "react";
import Link from "next/link";
import { subscribeToNewsletter, type SubscribeActionResult } from "@/app/(site)/nyhedsbrev/actions";

/** Kompakt nyhedsbrevsformular til forsiden. Gemmer rigtigt via server action (virker også uden JS via /api/newsletter/subscribe). */
export function NewsletterMiniForm() {
  const [state, formAction, pending] = useActionState<SubscribeActionResult | null, FormData>(
    subscribeToNewsletter,
    null,
  );

  if (state?.success) {
    return (
      <p className="site-newsletter-mini-desc" role="status" aria-live="polite">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="site-newsletter-mini-form" style={{ flexWrap: "wrap" }}>
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Lad dette felt være tomt
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <input
        type="email"
        name="email"
        placeholder="Indtast din e-mail"
        required
        className="site-newsletter-mini-input"
        aria-label="E-mailadresse til nyhedsbrev"
        autoComplete="email"
      />
      <button type="submit" className="site-newsletter-mini-btn" disabled={pending}>
        {pending ? "Tilmelder…" : "Tilmeld"}
      </button>
      <label style={{ display: "flex", gap: 6, alignItems: "flex-start", width: "100%", fontSize: 12, lineHeight: 1.35 }}>
        <input type="checkbox" name="samtykke" value="true" required style={{ marginTop: 2 }} />
        <span>
          Ja tak til nyhedsbrevet. Læs{" "}
          <Link href="/om-mediet/privatliv" style={{ textDecoration: "underline" }}>
            privatlivspolitikken
          </Link>
          .
        </span>
      </label>
      {state && !state.success && (
        <p role="alert" style={{ width: "100%", margin: 0, fontSize: 12, color: "#b91c1c" }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
