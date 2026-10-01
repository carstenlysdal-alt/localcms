"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  toggleSubscriberStatus,
  deleteSubscriber,
  addSubscriberManual,
} from "@/app/redaktion/nyhedsbrev/actions";
import {
  Download,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  MapPin,
} from "lucide-react";

type SubscriberItem = {
  id: string;
  email: string;
  navn: string | null;
  omraadeSlug: string | null;
  sektionSlug: string | null;
  aktiv: boolean;
  createdAt: Date;
  afmeldtTid: Date | null;
};

type SubscriberListProps = {
  subscribers: SubscriberItem[];
  areas: Array<{ slug: string; navn: string }>;
};

export function SubscriberList({ subscribers, areas }: SubscriberListProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"alle" | "aktive" | "afmeldte">("alle");
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);

  const total = subscribers.length;
  const aktive = subscribers.filter((s) => s.aktiv).length;
  const afmeldte = total - aktive;
  const retentionPct = total > 0 ? Math.round((aktive / total) * 100) : 100;

  const filtered = subscribers.filter((s) => {
    if (statusFilter === "aktive" && !s.aktiv) return false;
    if (statusFilter === "afmeldte" && s.aktiv) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchEmail = s.email.toLowerCase().includes(q);
      const matchNavn = s.navn ? s.navn.toLowerCase().includes(q) : false;
      const matchOmraade = s.omraadeSlug ? s.omraadeSlug.toLowerCase().includes(q) : false;
      return matchEmail || matchNavn || matchOmraade;
    }
    return true;
  });

  async function handleToggle(id: string) {
    setLoadingId(`toggle-${id}`);
    await toggleSubscriberStatus(id);
    setLoadingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Vil du slette denne abonnent permanent?")) return;
    setLoadingId(`del-${id}`);
    await deleteSubscriber(id);
    setLoadingId(null);
    router.refresh();
  }

  async function handleAddManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setManualError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const res = await addSubscriberManual(formData);
    if (!res.success) {
      setManualError(res.error || "Fejl ved tilføjelse");
    } else {
      form.reset();
      setShowAddForm(false);
      router.refresh();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* KPI Opsamling */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: "700" }}>
            Aktive modtagere
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#059669", marginTop: "4px" }}>
            {aktive}
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px" }}>
            {retentionPct}% af alle tilmeldinger
          </div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: "700" }}>
            Total tilmeldinger
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--color-text)", marginTop: "4px" }}>
            {total}
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px" }}>
            Registreret i First-Party databasen
          </div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: "700" }}>
            Afmeldte
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#6B7280", marginTop: "4px" }}>
            {afmeldte}
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px" }}>
            Via 1-klik afmeldingslink
          </div>
        </div>
      </div>

      {/* Handlingsbar & Filtre */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "340px" }}>
            <Search
              size={16}
              style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }}
            />
            <input
              type="text"
              placeholder="Søg i e-mail, navn eller område..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
              style={{ paddingLeft: "32px", width: "100%", fontSize: "13px" }}
            />
          </div>

          <div style={{ display: "flex", gap: "4px" }}>
            <button
              type="button"
              onClick={() => setStatusFilter("alle")}
              className={`btn btn-secondary ${statusFilter === "alle" ? "btn-primary" : ""}`}
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              Alle ({total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("aktive")}
              className={`btn btn-secondary ${statusFilter === "aktive" ? "btn-primary" : ""}`}
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              Aktive ({aktive})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("afmeldte")}
              className={`btn btn-secondary ${statusFilter === "afmeldte" ? "btn-primary" : ""}`}
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              Afmeldte ({afmeldte})
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-secondary"
            style={{ fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={14} /> Manuel tilføjelse
          </button>

          <a
            href="/api/nyhedsbrev/export"
            download
            className="btn btn-primary"
            style={{ fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Download size={14} /> Eksportér CSV (Excel)
          </a>
        </div>
      </div>

      {/* Manuel tilføjelse boks */}
      {showAddForm && (
        <form
          onSubmit={handleAddManual}
          className="card"
          style={{
            padding: "20px",
            background: "var(--color-bg)",
            border: "1px solid var(--color-divider)",
          }}
        >
          <div style={{ fontWeight: "700", marginBottom: "12px", fontSize: "14px" }}>
            Manuel registrering af abonnent
          </div>

          {manualError && (
            <div style={{ color: "#DC2626", fontSize: "13px", marginBottom: "10px" }}>
              {manualError}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>
                E-mailadresse *
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="bruger@eksempel.dk"
                className="input"
                style={{ width: "100%", fontSize: "13px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>
                Navn (valgfrit)
              </label>
              <input
                name="navn"
                type="text"
                placeholder="Mette Frederiksen"
                className="input"
                style={{ width: "100%", fontSize: "13px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>
                Lokalområde
              </label>
              <select name="omraadeSlug" className="input" style={{ width: "100%", fontSize: "13px" }}>
                <option value="">Hele kommunen</option>
                {areas.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.navn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "14px" }}>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="btn btn-secondary"
              style={{ fontSize: "13px" }}
            >
              Annullér
            </button>
            <button type="submit" className="btn btn-primary" style={{ fontSize: "13px" }}>
              Gem abonnent
            </button>
          </div>
        </form>
      )}

      {/* Abonnent-tabel */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>E-mail & Navn</th>
              <th>Præferencer</th>
              <th>Status</th>
              <th>Tilmeldt dato</th>
              <th style={{ textAlign: "right" }}>Handling</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--color-text-muted)" }}>
                  Ingen abonnenter matcher søgningen.
                </td>
              </tr>
            ) : (
              filtered.map((sub) => (
                <tr key={sub.id}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <strong style={{ fontSize: "14px", color: "var(--color-text)" }}>{sub.email}</strong>
                      {sub.navn && (
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{sub.navn}</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "12px" }}>
                      {sub.omraadeSlug ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "#BF6415" }}>
                          <MapPin size={12} /> {sub.omraadeSlug}
                        </span>
                      ) : (
                        <span className="text-muted">Hele kommunen</span>
                      )}
                      {sub.sektionSlug && (
                        <span style={{ background: "rgba(0,0,0,0.05)", padding: "1px 6px", borderRadius: "4px" }}>
                          {sub.sektionSlug}
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    {sub.aktiv ? (
                      <span
                        className="badge"
                        style={{
                          background: "#ECFDF5",
                          color: "#047857",
                          border: "1px solid #A7F3D0",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <CheckCircle size={12} /> Aktiv
                      </span>
                    ) : (
                      <span
                        className="badge"
                        style={{
                          background: "#FEF2F2",
                          color: "#B91C1C",
                          border: "1px solid #FECACA",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <XCircle size={12} /> Afmeldt
                      </span>
                    )}
                  </td>

                  <td>
                    <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                      {new Date(sub.createdAt).toLocaleDateString("da-DK", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => handleToggle(sub.id)}
                        disabled={loadingId === `toggle-${sub.id}`}
                        className="btn btn-secondary"
                        style={{ fontSize: "12px", padding: "4px 8px" }}
                        title={sub.aktiv ? "Afmeld abonnent" : "Genaktivér abonnent"}
                      >
                        {sub.aktiv ? "Afmeld" : "Aktivér"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(sub.id)}
                        disabled={loadingId === `del-${sub.id}`}
                        className="btn btn-secondary"
                        style={{ fontSize: "12px", padding: "4px 8px", color: "#DC2626" }}
                        title="Slet abonnent"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
