"use client";

import { useMemo, useState, useTransition } from "react";
import { MODULE_REGISTRY } from "@/lib/frontpage/modules";
import { metricsAction } from "../editor-actions";
import type { EditorData, MetricsDTO } from "../_lib/dto";
import type { Msg } from "../_lib/messages";
import { Notice } from "./ui";

const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")} %`;

export function MetricsTab({ data }: { data: EditorData }) {
  const [metrics, setMetrics] = useState<MetricsDTO>(data.metrics);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [pending, start] = useTransition();
  const label = (id: string) => {
    const m = data.live.modules.find((x) => x.id === id);
    return m ? MODULE_REGISTRY[m.type].label : id;
  };
  const perModule = useMemo(() => {
    const map = new Map<string, { impressions: number; clicks: number }>();
    for (const r of metrics.rows) {
      const c = map.get(r.moduleId) ?? { impressions: 0, clicks: 0 };
      c.impressions += r.impressions;
      c.clicks += r.clicks;
      map.set(r.moduleId, c);
    }
    return [...map.entries()].map(([moduleId, v]) => ({ moduleId, ...v, ctr: v.impressions ? v.clicks / v.impressions : 0 }));
  }, [metrics.rows]);
  const maxCtr = Math.max(0.0001, ...metrics.rows.map((r) => r.ctr));
  const maxImp = Math.max(1, ...metrics.rows.map((r) => r.impressions));

  const setDays = (d: number) =>
    start(async () => {
      const r = await metricsAction(d);
      if (r.ok) setMetrics(r.metrics);
      else setMsg({ tone: "error", text: r.message });
    });

  return (
    <div className="fpe-metrics">
      <Notice msg={msg} onClose={() => setMsg(null)} />
      <section className="fpe-panel" aria-labelledby="fpe-met-h" aria-busy={pending}>
        <div className="fpe-panel-head">
          <h3 className="fpe-h3" id="fpe-met-h">Visninger og klik pr. slot</h3>
          <div className="fpe-field fpe-field--inline">
            <label htmlFor="fpe-met-days">Periode</label>
            <select id="fpe-met-days" className="fpe-input" value={metrics.days} onChange={(e) => setDays(Number(e.target.value))} disabled={pending}>
              {[7, 14, 30].map((d) => (
                <option key={d} value={d}>Seneste {d} dage</option>
              ))}
            </select>
          </div>
        </div>
        <p className="fpe-muted">Impression = slottet har været mindst 50 % synligt i 1 sekund. CTR = klik / impressions. Målingen er anonym (ingen cookies eller persondata), og bots filtreres fra.</p>

        {metrics.rows.length === 0 ? (
          <p className="fpe-empty">Der er endnu ingen målinger for perioden. De kommer, når besøgende har set den modulære forside.</p>
        ) : (
          <>
            <h4 className="fpe-h4">Pr. modul</h4>
            <div className="fpe-table-wrap">
              <table className="fpe-table">
                <caption className="sr-only">Visninger, klik og CTR pr. modul de seneste {metrics.days} dage, med dagligt forløb</caption>
                <thead>
                  <tr><th scope="col">Modul</th><th scope="col" className="fpe-num">Impressions</th><th scope="col" className="fpe-num">Klik</th><th scope="col" className="fpe-num">CTR</th><th scope="col">Forløb (impressions pr. dag)</th></tr>
                </thead>
                <tbody>
                  {perModule.map((m) => {
                    const series = metrics.daily.find((d) => d.moduleId === m.moduleId)?.series ?? [];
                    return (
                      <tr key={m.moduleId}>
                        <th scope="row">{label(m.moduleId)} <span className="fpe-muted">({m.moduleId})</span></th>
                        <td className="fpe-num">{m.impressions}</td>
                        <td className="fpe-num">{m.clicks}</td>
                        <td className="fpe-num">{pct(m.ctr)}</td>
                        <td><Sparkbars series={series} title={`${label(m.moduleId)}: impressions pr. dag`} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h4 className="fpe-h4">Pr. slot</h4>
            <div className="fpe-table-wrap">
              <table className="fpe-table">
                <caption className="sr-only">Visninger, klik og CTR pr. slot</caption>
                <thead>
                  <tr><th scope="col">Modul</th><th scope="col">Slot</th><th scope="col" className="fpe-num">Impressions</th><th scope="col" className="fpe-num">Klik</th><th scope="col" className="fpe-num">CTR</th><th scope="col">Søjler</th></tr>
                </thead>
                <tbody>
                  {metrics.rows.map((r) => (
                    <tr key={`${r.moduleId}:${r.slotKey}`}>
                      <th scope="row">{label(r.moduleId)}</th>
                      <td>{Number(r.slotKey) + 1}</td>
                      <td className="fpe-num">{r.impressions}</td>
                      <td className="fpe-num">{r.clicks}</td>
                      <td className="fpe-num">{pct(r.ctr)}</td>
                      <td>
                        <svg className="fpe-bars" width="160" height="26" role="img" aria-label={`Slot ${Number(r.slotKey) + 1}: ${r.impressions} impressions og CTR ${pct(r.ctr)}`}>
                          <title>{`Impressions ${r.impressions}, CTR ${pct(r.ctr)}`}</title>
                          <rect x="0" y="2" width={Math.max(2, (r.impressions / maxImp) * 158)} height="9" className="fpe-bar fpe-bar--imp" rx="2" />
                          <rect x="0" y="14" width={Math.max(2, (r.ctr / maxCtr) * 158)} height="9" className="fpe-bar fpe-bar--ctr" rx="2" />
                        </svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fpe-help">Øverste søjle: impressions (relativt til højeste slot). Nederste: CTR (relativt til højeste CTR). Tabellen er den fulde datakilde.</p>
          </>
        )}
      </section>
    </div>
  );
}

function Sparkbars({ series, title }: { series: { day: string; impressions: number; clicks: number }[]; title: string }) {
  const max = Math.max(1, ...series.map((s) => s.impressions));
  const w = 7;
  const gap = 3;
  const h = 28;
  return (
    <svg className="fpe-spark" width={series.length * (w + gap)} height={h + 2} role="img" aria-label={`${title}: ${series.map((s) => s.impressions).join(", ")}`}>
      <title>{title}</title>
      {series.map((s, i) => {
        const bh = Math.max(s.impressions ? 2 : 1, (s.impressions / max) * h);
        return <rect key={s.day} x={i * (w + gap)} y={h - bh + 1} width={w} height={bh} rx="1.5" className={s.impressions ? "fpe-bar fpe-bar--imp" : "fpe-bar fpe-bar--zero"}><title>{`${s.day}: ${s.impressions} impressions, ${s.clicks} klik`}</title></rect>;
      })}
    </svg>
  );
}
