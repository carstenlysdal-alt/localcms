import Link from "next/link";

interface BeaconPartnersProps {
  kommuneNavn: string;
}

// Fyrtårnspartnere tilpasset hver kommune
const LOCAL_PARTNERS: Record<string, string[]> = {
  Slagelse: [
    "Slagelse Sparekasse",
    "Korsør Erhvervsforening",
    "Skælskør Bypulje",
    "Vestsjællands Boligselskab",
    "Sparekassen Sjælland-Fyn",
  ],
  Næstved: [
    "Møn Sparekasse",
    "Næstved Erhvervsforening",
    "Fjordens Venner",
    "Karrebæk Brolaug",
    "Næstved Håndværkerforening",
  ],
  Holbæk: [
    "Sparekassen Sjælland Holbæk",
    "Holbæk Byforum",
    "Sidesporet Kulturfond",
    "Tølløse Borgerforening",
    "Nordvestsjællands Erhvervsråd",
  ],
  Ringsted: [
    "Ringsted Erhvervsforum",
    "Midtsjællands Sparekasse",
    "Kværkeby Udvikling",
    "Ringsted Idrætsunion",
    "Sjællandske Ildsjæle",
  ],
  Køge: [
    "Køge Handel & Erhverv",
    "Køge Bugt Sparekasse",
    "Herfølge Fællesskab",
    "Køge Kyst Partnerskab",
    "Østsjællandske Medier",
  ],
  Roskilde: [
    "Roskilde Festival Fonden",
    "Sparekassen Sjælland Roskilde",
    "Roskilde Erhvervsråd",
    "Trekroner Bynetværk",
    "Fjordlandets Kulturforening",
  ],
};

export function BeaconPartners({ kommuneNavn }: BeaconPartnersProps) {
  const partners = LOCAL_PARTNERS[kommuneNavn] || LOCAL_PARTNERS.Slagelse;

  return (
    <section className="site-beacon-partners-section" aria-label="Fyrtårnspartnere">
      <div className="site-beacon-header">
        FYRTÅRNSPARTNERE · MED TIL AT GØRE LOKALJOURNALISTIK MULIG
      </div>
      <div className="site-beacon-grid">
        {partners.map((partner, idx) => (
          <div key={idx} className="b site-beacon-card">
            <span className="site-beacon-name">{partner}</span>
          </div>
        ))}
      </div>
      <div className="site-beacon-footer">
        <Link href="/stoet" className="site-beacon-link">
          Vil din virksomhed også støtte uafhængig lokaljournalistik? Læs om støtteaftaler her →
        </Link>
      </div>
    </section>
  );
}
