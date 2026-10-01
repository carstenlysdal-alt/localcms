import Link from "next/link";

interface BeaconPartnersProps {
  kommuneNavn: string;
  /** Aktive støttepartnere for netop denne by (fra støtteaftaler i databasen). */
  partners?: string[];
}

export function BeaconPartners({ kommuneNavn, partners = [] }: BeaconPartnersProps) {
  return (
    <section className="site-beacon-partners-section" aria-label="Fyrtårnspartnere">
      {partners.length > 0 ? (
        <>
          <div className="site-beacon-header">
            FYRTÅRNSPARTNERE · MED TIL AT GØRE LOKALJOURNALISTIK I {kommuneNavn.toUpperCase()} MULIG
          </div>
          <div className="site-beacon-grid">
            {partners.map((partner) => (
              <div key={partner} className="b site-beacon-card">
                <span className="site-beacon-name">{partner}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="site-beacon-header">STØT LOKALJOURNALISTIKKEN I {kommuneNavn.toUpperCase()}</div>
      )}
      <div className="site-beacon-footer">
        <Link href="/bliv-stoette" className="site-beacon-link">
          Vil din virksomhed også støtte lokaljournalistikken? Læs om støtteaftaler her →
        </Link>
      </div>
    </section>
  );
}
