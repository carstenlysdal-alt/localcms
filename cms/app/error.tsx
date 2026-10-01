"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main style={{ maxWidth: 560, margin: "15vh auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <h1 style={{ fontSize: 28 }}>Der gik noget galt</h1>
      <p style={{ color: "#555", lineHeight: 1.5 }}>Siden kunne ikke indlæses. Prøv igen, eller gå til forsiden.</p>
      <p style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button type="button" onClick={() => reset()} style={{ padding: "8px 16px" }}>
          Prøv igen
        </button>
        <Link href="/" style={{ padding: "8px 16px" }}>
          Gå til forsiden
        </Link>
      </p>
    </main>
  );
}
