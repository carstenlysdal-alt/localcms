import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveAreaAction, deleteAreaAction } from "./actions";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { NoAccess } from "@/components/admin/no-access";
import { PAGE_PERMISSIONS } from "@/lib/redaktion-access";

export default async function OmraaderAdminPage() {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.omraader]);
  if (!user) return <NoAccess area="områdeadministration" />;

  const areas = await db.geoTag.findMany({
    where: { instansId: user.instansId },
    include: { _count: { select: { articles: true } } },
    orderBy: { navn: "asc" },
  });

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <h1>Områdeadministration</h1>
          <p className="text-muted">
            Delområder og geografi i kommunen (bruges til filtrering, sektioner og geobonus)
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "28px" }}>
        {/* Områdeliste */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Område</th>
                <th>Slug</th>
                <th>Koordinater</th>
                <th>Artikler</th>
                <th>Handling</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <MapPin size={16} style={{ color: "#BF6415" }} />
                      <strong>{area.navn}</strong>
                    </div>
                  </td>
                  <td>
                    <code>{area.slug}</code>
                  </td>
                  <td>
                    {area.lat && area.lng ? (
                      <small className="text-muted">
                        {area.lat.toFixed(4)}, {area.lng.toFixed(4)}
                      </small>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="tag">{area._count.articles} stk.</span>
                  </td>
                  <td>
                    <form action={deleteAreaAction.bind(null, area.id)}>
                      <button
                        type="submit"
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", color: "#DC2626" }}
                        title="Slet område"
                      >
                        <Trash2 size={13} />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!areas.length && (
            <div className="empty-state">Ingen områder oprettet endnu.</div>
          )}
        </div>

        {/* Opret nyt område */}
        <div className="card" style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "10px", height: "fit-content" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Plus size={18} style={{ color: "#BF6415" }} />
            Opret Nyt Delområde
          </h3>

          <form action={saveAreaAction} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                Områdenavn *
              </label>
              <input
                name="navn"
                type="text"
                placeholder="fx Korsør eller Vemmelev"
                required
                className="input"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                Slug (URL-sti)
              </label>
              <input
                name="slug"
                type="text"
                placeholder="fx korsoer (autogenereres hvis tom)"
                className="input"
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                  Breddegrad (Lat)
                </label>
                <input
                  name="lat"
                  type="number"
                  step="any"
                  placeholder="55.3292"
                  className="input"
                  style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                  Længdegrad (Lng)
                </label>
                <input
                  name="lng"
                  type="number"
                  step="any"
                  placeholder="11.1378"
                  className="input"
                  style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: "10px", marginTop: "8px", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
            >
              <MapPin size={16} /> Gem Område
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
