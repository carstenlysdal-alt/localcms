import Link from "next/link";

/** Fælles "Ingen adgang"-visning for redaktionssider (rettighed slås op server-side før data hentes). */
export function NoAccess({ area }: { area: string }) {
  return (
    <main className="admin-main">
      <div className="dialog inline-dialog" role="alert">
        <h1 className="dialog-title">Ingen adgang</h1>
        <p className="dialog-body">Din rolle har ikke adgang til {area}. Kontakt en redaktør, hvis du mener, det er en fejl.</p>
        <Link className="btn btn-secondary" href="/redaktion/artikler">Til artikler</Link>
      </div>
    </main>
  );
}
