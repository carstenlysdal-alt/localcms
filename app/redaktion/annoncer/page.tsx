import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdGeneratorForm } from "@/components/admin/AdGeneratorForm";
import { toggleCampaignStatusAction, deleteCampaignAction } from "./actions";
import { Megaphone, DollarSign, Eye, MousePointerClick, Trash2 } from "lucide-react";

export default async function AnnoncerPage() {
  const session = await auth();
  if (!session?.user) return null;

  const instansId = session.user.instansId;

  // Hent alle kampagner
  const campaigns = await db.adCampaign.findMany({
    where: { instansId },
    orderBy: { createdAt: "desc" },
  });

  const aktiveCount = campaigns.filter((c) => c.status === "Aktiv").length;
  const totalOmsaetning = campaigns.reduce((acc, c) => acc + c.pris, 0);
  const totalVisninger = campaigns.reduce((acc, c) => acc + c.visninger, 0);
  const totalKlik = campaigns.reduce((acc, c) => acc + c.klik, 0);
  const samletCtr = totalVisninger > 0 ? ((totalKlik / totalVisninger) * 100).toFixed(2) : "0.00";

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <h1>Annoncer & Banner-Motor</h1>
          <p className="text-muted">
            First-party native annoncering, in-feed display og event-posts i [By]Lokalt
          </p>
        </div>
      </div>

      {/* Nøgletal for annoncer */}
      <div className="honor-summary" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: "24px" }}>
        <article className="card">
          <DollarSign size={22} style={{ color: "#059669" }} />
          <span>Samlet Omsætning</span>
          <strong>{totalOmsaetning.toLocaleString("da-DK")} kr.</strong>
        </article>

        <article className="card">
          <Megaphone size={22} style={{ color: "#BF6415" }} />
          <span>Aktive Kampagner</span>
          <strong>{aktiveCount} stk.</strong>
        </article>

        <article className="card">
          <Eye size={22} style={{ color: "#2563EB" }} />
          <span>Samlede Visninger</span>
          <strong>{totalVisninger.toLocaleString("da-DK")}</strong>
        </article>

        <article className="card">
          <MousePointerClick size={22} style={{ color: "#7C3AED" }} />
          <span>Gennemsnitlig CTR</span>
          <strong>{samletCtr} %</strong>
        </article>
      </div>

      {/* Agentisk Generator Form */}
      <AdGeneratorForm />

      {/* Kampagnetabel */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Kampagne & Annoncør</th>
              <th>Format & Placering</th>
              <th>Periode</th>
              <th>Pris</th>
              <th>Visninger / Klik</th>
              <th>CTR</th>
              <th>Status</th>
              <th>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((camp) => {
              const ctr = camp.visninger > 0 ? ((camp.klik / camp.visninger) * 100).toFixed(2) : "0.00";
              const isAktiv = camp.status === "Aktiv";
              const formatLabel =
                camp.format === "IN_FEED_BANNER"
                  ? "In-Feed Display"
                  : camp.format === "EVENT_POST"
                  ? "Event Post"
                  : "Native Premium";

              return (
                <tr key={camp.id}>
                  <td>
                    <strong>{camp.titel}</strong>
                    <div className="text-muted" style={{ fontSize: "0.8rem" }}>{camp.annoncoer}</div>
                  </td>
                  <td>
                    <span className="tag">{formatLabel}</span>
                    <small className="table-subtitle">Zone: {camp.placeringZone}</small>
                  </td>
                  <td>
                    <div style={{ fontSize: "0.85rem" }}>
                      {camp.startDato.toLocaleDateString("da-DK", { day: "numeric", month: "short" })} –{" "}
                      {camp.slutDato.toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
                    </div>
                  </td>
                  <td>
                    <strong>{camp.pris.toLocaleString("da-DK")} kr.</strong>
                  </td>
                  <td>
                    <strong>{camp.visninger.toLocaleString("da-DK")}</strong> visninger
                    <small className="table-subtitle">{camp.klik} klik</small>
                  </td>
                  <td>
                    <span className="tag tag-success" style={{ fontWeight: 700 }}>
                      {ctr} %
                    </span>
                  </td>
                  <td>
                    <span className={`tag ${isAktiv ? "tag-success" : "tag-warn"}`}>
                      {camp.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <form action={toggleCampaignStatusAction.bind(null, camp.id, camp.status)}>
                        <button
                          type="submit"
                          className="btn btn-secondary"
                          title={isAktiv ? "Pause kampagne" : "Aktivér kampagne"}
                          style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                        >
                          {isAktiv ? "Pause" : "Aktivér"}
                        </button>
                      </form>
                      <form action={deleteCampaignAction.bind(null, camp.id)}>
                        <button
                          type="submit"
                          className="btn btn-secondary"
                          title="Slet kampagne"
                          style={{ padding: "4px 8px", fontSize: "0.8rem", color: "#DC2626" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!campaigns.length && (
          <div className="empty-state">
            Ingen kampagner oprettet endnu. Brug Ad-Generatoren ovenfor til at oprette din første annonce.
          </div>
        )}
      </div>
    </main>
  );
}
