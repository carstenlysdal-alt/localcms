"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="da">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <main style={{ maxWidth: 560, margin: "15vh auto", padding: "0 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 28 }}>Der gik noget galt</h1>
          <p style={{ color: "#555", lineHeight: 1.5 }}>
            Der opstod en uventet fejl{error.digest ? ` (fejlkode ${error.digest})` : ""}. Prøv igen om lidt.
          </p>
          <p style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button type="button" onClick={() => reset()} style={{ padding: "8px 16px" }}>
              Prøv igen
            </button>
            {/* global-error erstatter rod-layoutet; en almindelig <a> giver en ren genindlæsning */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ padding: "8px 16px" }}>
              Gå til forsiden
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
