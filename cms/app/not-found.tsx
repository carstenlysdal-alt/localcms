import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Siden blev ikke fundet",
  robots: { index: false, follow: false },
};

/** Rodniveau-404 (ukendte stier uden for sitet). Server-renderet indhold med links, så siden aldrig er en blind vej. */
export default function RootNotFound() {
  return (
    <main style={{ maxWidth: 560, margin: "15vh auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <p style={{ fontSize: 14, letterSpacing: 2, color: "#777", margin: 0 }}>404</p>
      <h1 style={{ fontSize: 28, margin: "8px 0 12px" }}>Siden blev desværre ikke fundet</h1>
      <p style={{ color: "#555", lineHeight: 1.5 }}>
        Adressen findes ikke, eller siden er flyttet. Gå til forsiden eller søg i arkivet.
      </p>
      <p style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <Link href="/" style={{ padding: "8px 16px", border: "1px solid #999", borderRadius: 999 }}>
          Gå til forsiden
        </Link>
        <Link href="/soeg" style={{ padding: "8px 16px", border: "1px solid #999", borderRadius: 999 }}>
          Søg
        </Link>
      </p>
    </main>
  );
}
