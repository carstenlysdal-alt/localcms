"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleSubscriberStatus, deleteSubscriber, addSubscriberManual } from "@/app/redaktion/nyhedsbrev/actions";
import { Download, Mail, MapPin, Plus, Search, Trash2, UserCheck, UserMinus, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { DataTable, type DataTableColumn, type DataTableRow } from "@/components/ui/DataTable";
import { Field, Grid, Notice } from "@/components/ui/Layout";
import { StatCard } from "@/components/ui/StatCard";

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

const COLUMNS: DataTableColumn[] = [
  { key: "email", header: "E-mail og navn", sortable: true },
  { key: "praef", header: "Præferencer", hideOnMobile: true },
  { key: "status", header: "Status", sortable: true },
  { key: "dato", header: "Tilmeldt", sortable: true, hideOnMobile: true },
  { key: "handling", header: "Handling", srOnlyHeader: true, align: "right" },
];

export function SubscriberList({ subscribers, areas }: SubscriberListProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"alle" | "aktive" | "afmeldte">("alle");
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SubscriberItem | null>(null);

  const total = subscribers.length;
  const aktive = subscribers.filter((s) => s.aktiv).length;
  const afmeldte = total - aktive;
  const retentionPct = total > 0 ? Math.round((aktive / total) * 100) : 100;

  // Vækst i de seneste 30 dage fra createdAt (rigtige data; ingen sammenligning før sporing findes).
  const [since] = useState(() => Date.now() - 30 * 24 * 60 * 60 * 1000);
  const nye30 = subscribers.filter((s) => new Date(s.createdAt).getTime() >= since).length;

  const filtered = subscribers.filter((s) => {
    if (statusFilter === "aktive" && !s.aktiv) return false;
    if (statusFilter === "afmeldte" && s.aktiv) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return s.email.toLowerCase().includes(q) || (s.navn?.toLowerCase().includes(q) ?? false) || (s.omraadeSlug?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  async function handleToggle(id: string) {
    setLoadingId(`toggle-${id}`);
    await toggleSubscriberStatus(id);
    setLoadingId(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    setToDelete(null);
    setLoadingId(`del-${id}`);
    await deleteSubscriber(id);
    setLoadingId(null);
    router.refresh();
  }

  async function handleAddManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setManualError(null);
    const form = e.currentTarget;
    const res = await addSubscriberManual(new FormData(form));
    if (!res.success) {
      setManualError(res.error || "Fejl ved tilføjelse");
    } else {
      form.reset();
      setShowAddForm(false);
      router.refresh();
    }
  }

  const rows: DataTableRow[] = filtered.map((sub) => ({
    id: sub.id,
    sort: { email: sub.email, status: sub.aktiv ? 1 : 0, dato: new Date(sub.createdAt).getTime() },
    cells: {
      email: (
        <div className="ui-stack">
          <strong>{sub.email}</strong>
          {sub.navn ? <span className="ui-small ui-muted">{sub.navn}</span> : null}
        </div>
      ),
      praef: (
        <div className="ui-row ui-gap-sm">
          {sub.omraadeSlug ? <Badge tone="neutral" icon={<MapPin size={12} />}>{sub.omraadeSlug}</Badge> : <span className="ui-muted ui-small">Hele kommunen</span>}
          {sub.sektionSlug ? <Badge tone="primary">{sub.sektionSlug}</Badge> : null}
        </div>
      ),
      status: sub.aktiv ? <Badge tone="success" dot>Aktiv</Badge> : <Badge tone="neutral" dot>Afmeldt</Badge>,
      dato: <span className="ui-muted">{new Date(sub.createdAt).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })}</span>,
      handling: (
        <div className="ui-actions ui-justify-end">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleToggle(sub.id)} disabled={loadingId === `toggle-${sub.id}`}>
            {sub.aktiv ? "Afmeld" : "Aktivér"}
          </button>
          <button type="button" className="btn btn-secondary btn-sm cat-delete" aria-label={`Slet ${sub.email}`} title="Slet abonnent" onClick={() => setToDelete(sub)} disabled={loadingId === `del-${sub.id}`}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      ),
    },
  }));

  const filters = [
    { key: "alle", label: "Alle", count: total },
    { key: "aktive", label: "Aktive", count: aktive },
    { key: "afmeldte", label: "Afmeldte", count: afmeldte },
  ] as const;

  return (
    <div className="ui-stack ui-gap-lg">
      <Grid cols={4}>
        <StatCard label="Aktive modtagere" icon={<UserCheck size={16} />} value={aktive.toLocaleString("da-DK")} hint={`${retentionPct} % af alle tilmeldinger`} />
        <StatCard label="Samlede tilmeldinger" icon={<Users size={16} />} value={total.toLocaleString("da-DK")} hint="Registreret i first-party databasen" />
        <StatCard label="Afmeldte" icon={<UserMinus size={16} />} value={afmeldte.toLocaleString("da-DK")} hint="Via 1-klik afmeldingslink" />
        <StatCard label="Nye seneste 30 dage" icon={<Mail size={16} />} value={nye30.toLocaleString("da-DK")} hint="Tilmeldinger oprettet i perioden" />
      </Grid>

      <div className="ui-row ui-justify-between ui-gap-md">
        <div className="ui-row ui-gap-sm sub-filters">
          <label className="ui-search">
            <span className="sr-only">Søg i e-mail, navn eller område</span>
            <Search size={16} aria-hidden="true" className="ui-search-icon" />
            <input type="search" placeholder="Søg i e-mail, navn eller område…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="ui-search-input" />
          </label>
          <div className="ui-chips sub-chips" role="group" aria-label="Filtrér på status">
            {filters.map((f) => (
              <button key={f.key} type="button" className="ui-chip" aria-pressed={statusFilter === f.key} onClick={() => setStatusFilter(f.key)}>
                {f.label}<span className="ui-chip-count">{f.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ui-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(true)}><Plus size={16} aria-hidden="true" /> Tilføj manuelt</button>
          <a href="/api/nyhedsbrev/export" download className="btn btn-primary"><Download size={16} aria-hidden="true" /> Eksportér CSV</a>
        </div>
      </div>

      <DataTable
        caption="Nyhedsbrevsabonnenter"
        columns={COLUMNS}
        rows={rows}
        defaultSort={{ key: "dato", direction: "desc" }}
        emptyTitle="Ingen abonnenter matcher"
        emptyDescription={total === 0 ? "Der er ingen tilmeldinger endnu." : "Prøv en anden søgning eller et andet statusfilter."}
      />

      <Dialog open={showAddForm} onClose={() => setShowAddForm(false)} title="Manuel registrering af abonnent" size="md">
        <form onSubmit={handleAddManual} className="ui-stack ui-gap-md">
          {manualError ? <Notice tone="danger">{manualError}</Notice> : null}
          <Field label="E-mailadresse" htmlFor="sub-email" required>
            <input id="sub-email" name="email" type="email" required placeholder="bruger@eksempel.dk" className="input" />
          </Field>
          <div className="ui-form-grid">
            <Field label="Navn (valgfrit)" htmlFor="sub-navn">
              <input id="sub-navn" name="navn" type="text" placeholder="Mette Frederiksen" className="input" />
            </Field>
            <Field label="Lokalområde" htmlFor="sub-omraade">
              <select id="sub-omraade" name="omraadeSlug" className="input">
                <option value="">Hele kommunen</option>
                {areas.map((a) => <option key={a.slug} value={a.slug}>{a.navn}</option>)}
              </select>
            </Field>
          </div>
          <div className="ui-dialog-foot">
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Annullér</button>
            <button type="submit" className="btn btn-primary">Gem abonnent</button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Slet abonnent?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setToDelete(null)}>Annullér</button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>Slet abonnent</button>
          </>
        }
      >
        <p className="ui-dialog-message">{toDelete?.email} slettes permanent. Det kan ikke fortrydes.</p>
      </Dialog>
    </div>
  );
}

