export default function Loading() {
  return (
    <div className="site-container" style={{ padding: "48px 0" }} role="status" aria-live="polite">
      <p style={{ color: "var(--ink-3)" }}>Indlæser…</p>
    </div>
  );
}
