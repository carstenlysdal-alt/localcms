"use client";

import { useRouter } from "next/navigation";

type AreaOption = { id: string; navn: string; slug: string };

/**
 * Områdevælger: med JavaScript navigerer valget straks til /omraade/<slug>;
 * uden JavaScript sender formularen (GET) til /omraade, som omdirigerer til det valgte område.
 */
export function AreaPicker({ areas }: { areas: AreaOption[] }) {
  const router = useRouter();
  return (
    <form action="/omraade" method="GET">
      <select
        name="valg"
        defaultValue=""
        className="site-neighborhood-select"
        aria-label="Vælg område i kommunen"
        onChange={(e) => {
          if (e.target.value) router.push(`/omraade/${e.target.value}`);
        }}
      >
        <option value="">Vælg område…</option>
        {areas.map((a) => (
          <option key={a.id} value={a.slug}>
            {a.navn}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="site-newsletter-mini-btn" style={{ marginTop: 8 }}>
          Gå til område
        </button>
      </noscript>
    </form>
  );
}
