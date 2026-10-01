"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="site-container">
      <div className="site-not-found-card" role="alert">
        <div className="site-not-found-code">Fejl</div>
        <h1 className="site-not-found-heading">Der gik noget galt</h1>
        <p className="site-not-found-text">
          Siden kunne ikke indlæses lige nu. Prøv igen, eller gå tilbage til forsiden.
          {error.digest ? ` (Fejlkode: ${error.digest})` : ""}
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="site-pill is-active" onClick={() => reset()}>
            Prøv igen
          </button>
          <Link href="/" className="site-pill">
            Gå til forsiden
          </Link>
          <Link href="/soeg" className="site-pill">
            Søg i arkivet
          </Link>
        </div>
      </div>
    </div>
  );
}
