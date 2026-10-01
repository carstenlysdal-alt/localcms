"use client";

import { useMemo, useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { rollbackAction } from "../editor-actions";
import type { EditorData } from "../_lib/dto";
import { KILDE_LABEL } from "../_lib/explain";
import type { Msg } from "../_lib/messages";
import { Badge, Dialog, Notice, fmtDateTime } from "./ui";

const HANDLING_LABEL: Record<string, string> = {
  placeret: "Placeret",
  afvist: "Afvist af rækværk",
  fjernet: "Fjernet",
  godkendt: "Forslag godkendt",
  "afvist-forslag": "Forslag afvist",
  redigeret: "Redigeret af redaktør",
  "nl-kommando": "AI-kommando",
  "foreslaa-layout": "AI: foreslå layout",
};

export function HistoryTab({ data, onServerChange }: { data: EditorData; onServerChange: () => void }) {
  const [filter, setFilter] = useState("alle");
  const [rollback, setRollback] = useState<number | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [pending, start] = useTransition();
  const handlings = useMemo(() => ["alle", ...new Set(data.decisions.map((d) => d.handling))], [data.decisions]);
  const rows = data.decisions.filter((d) => filter === "alle" || d.handling === filter);
  const canRollback = data.perms.layout;

  return (
    <div className="fpe-history">
      <Notice msg={msg} onClose={() => setMsg(null)} />
      <section className="fpe-panel" aria-labelledby="fpe-ver-h">
        <h3 className="fpe-h3" id="fpe-ver-h">Layoutversioner</h3>
        <p className="fpe-muted">Hver publicering og rollback giver en ny version. Rollback sletter ikke historik: den opretter en ny version med det gamle indhold.</p>
        {data.versions.length === 0 ? (
          <p className="fpe-empty">Der er endnu ikke publiceret et eget layout. Forsiden bruger standardlayoutet.</p>
        ) : (
          <table className="fpe-table">
            <caption className="sr-only">Publicerede layoutversioner</caption>
            <thead>
              <tr><th scope="col">Version</th><th scope="col">Note</th><th scope="col">Tidspunkt</th><th scope="col">Handling</th></tr>
            </thead>
            <tbody>
              {data.versions.map((v) => (
                <tr key={v.id}>
                  <th scope="row">v{v.version} {v.version === data.live.version && <Badge tone="ok">Live</Badge>}</th>
                  <td>{v.note ?? "–"}</td>
                  <td>{fmtDateTime(v.createdAt)}</td>
                  <td>
                    {canRollback && v.version !== data.live.version ? (
                      <button type="button" className="fpe-btn fpe-btn--small fpe-btn--secondary" onClick={() => setRollback(v.version)}>
                        <RotateCcw size={14} aria-hidden="true" /> Rul tilbage hertil
                      </button>
                    ) : (
                      <span className="fpe-muted">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="fpe-panel" aria-labelledby="fpe-dec-h">
        <div className="fpe-panel-head">
          <h3 className="fpe-h3" id="fpe-dec-h">Beslutningslog</h3>
          <div className="fpe-field fpe-field--inline">
            <label htmlFor="fpe-dec-filter">Vis</label>
            <select id="fpe-dec-filter" className="fpe-input" value={filter} onChange={(e) => setFilter(e.target.value)}>
              {handlings.map((h) => (
                <option key={h} value={h}>{h === "alle" ? "Alle handlinger" : HANDLING_LABEL[h] ?? h}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="fpe-muted">Hvem eller hvad placerede hvilken artikel hvor, og hvorfor. Alle AI-valg og alle godkendelser står her (seneste {data.decisions.length}).</p>
        {rows.length === 0 ? (
          <p className="fpe-empty">Ingen poster endnu.</p>
        ) : (
          <div className="fpe-table-wrap">
            <table className="fpe-table">
              <caption className="sr-only">Beslutningslog for forsiden</caption>
              <thead>
                <tr><th scope="col">Tid</th><th scope="col">Handling</th><th scope="col">Af</th><th scope="col">Slot</th><th scope="col">Artikel</th><th scope="col">Begrundelse</th></tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td>{fmtDateTime(d.createdAt)}</td>
                    <td>{HANDLING_LABEL[d.handling] ?? d.handling}</td>
                    <td><Badge tone={d.kilde === "ai" ? "ai" : d.kilde === "redaktør" ? "accent" : "neutral"}>{KILDE_LABEL[d.kilde] ?? d.kilde}</Badge>{d.konfidens !== null && <span className="fpe-muted"> {Math.round(d.konfidens * 100)} %</span>}</td>
                    <td>{d.slot}</td>
                    <td>{d.articleId ? data.liveArticles[d.articleId]?.titel ?? d.articleId.slice(0, 8) : "–"}</td>
                    <td>{d.begrundelse ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog
        open={rollback !== null}
        title={`Rul tilbage til version ${rollback}`}
        onClose={() => setRollback(null)}
        actions={
          <>
            <button type="button" className="fpe-btn fpe-btn--ghost" onClick={() => setRollback(null)}>Annullér</button>
            <button
              type="button"
              className="fpe-btn fpe-btn--danger"
              disabled={pending}
              onClick={() => {
                const v = rollback;
                setRollback(null);
                if (v === null) return;
                start(async () => {
                  const r = await rollbackAction(v);
                  setMsg(r.ok ? { tone: "ok", text: `Layoutet er rullet tilbage som ny version ${r.version}. Godkendelsen er nulstillet: opret og godkend et nyt forslag.` } : { tone: "error", text: r.message });
                  if (r.ok) onServerChange();
                });
              }}
            >
              Rul tilbage
            </button>
          </>
        }
      >
        <p>Det publicerede layout bliver til indholdet fra version {rollback}, som en ny version. Den nuværende godkendelse hører til det nuværende layout og bliver derfor ugyldig; forsiden bruger almindelig rangering, til du har godkendt et nyt forslag.</p>
      </Dialog>
    </div>
  );
}
