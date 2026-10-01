"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import "@/styles/frontpage-editor.css";
import type { EditorData } from "../_lib/dto";
import { HistoryTab } from "./HistoryTab";
import { LayoutTab } from "./LayoutTab";
import { MetricsTab } from "./MetricsTab";
import { ProposalsTab } from "./ProposalsTab";
import { Badge } from "./ui";

const TABS = [
  { id: "layout", label: "Layout" },
  { id: "forslag", label: "Forslag" },
  { id: "historik", label: "Historik" },
  { id: "metrikker", label: "Metrikker" },
  { id: "fastgoer", label: "Fastgør" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const SOURCE: Record<string, string> = { "godkendt-snapshot": "godkendt forside", deterministisk: "almindelig rangering", "seneste-nyt": "seneste nyt (nødfallback)" };

/** Skal for forsideeditoren: faner (alle paneler forbliver monteret, så ugemte layoutændringer ikke går tabt ved faneskift). */
export function ForsideEditor({ data, legacy }: { data: EditorData; legacy: ReactNode }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("layout");
  const [dirty, setDirty] = useState(false);
  const [proposeSignal, setProposeSignal] = useState(0);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "") as TabId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synkroniserer fanen med URL-hash (ekstern tilstand) efter hydrering
    if (TABS.some((t) => t.id === fromHash)) setTab(fromHash);
  }, []);

  const go = useCallback((id: TabId) => {
    setTab(id);
    try {
      history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignorer */
    }
  }, []);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    go(TABS[next].id);
    refs.current[TABS[next].id]?.focus();
  };

  const refresh = useCallback(() => router.refresh(), [router]);
  const live = data.liveResolution;

  return (
    <div className="fpe-root">
      <div className="fpe-statusbar" role="status">
        <span>
          Forsiden bruger lige nu: <strong>{SOURCE[live.source]}</strong>
          {live.snapshotId === null && live.source !== "godkendt-snapshot" ? " – ingen gyldig godkendelse" : ""}
        </span>
        <Badge tone={data.live.source === "live" ? "ok" : "neutral"}>{data.live.source === "live" ? `Layout v${data.live.version}` : "Standardlayout"}</Badge>
        {data.quota.isExceeded ? <Badge tone="error">Kvoteloft nået ({data.quota.percentage}% af {data.quota.kvoteloftProcent}%)</Badge> : <Badge>Kvote {data.quota.percentage}% af {data.quota.kvoteloftProcent}%</Badge>}
        <a className="fpe-link" href="/" target="_blank" rel="noopener">
          <LayoutTemplate size={14} aria-hidden="true" /> Åbn live forside
        </a>
      </div>

      <div className="fpe-tabs" role="tablist" aria-label="Forsideeditor" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            type="button"
            role="tab"
            id={`fpe-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`fpe-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={`fpe-tab${tab === t.id ? " is-on" : ""}`}
            onClick={() => go(t.id)}
          >
            {t.label}
            {t.id === "layout" && dirty && <span className="fpe-tab-dot" aria-label="ugemte ændringer" />}
            {t.id === "forslag" && data.snapshots.some((s) => s.status === "forslag") && <span className="fpe-tab-dot fpe-tab-dot--info" aria-label="åbent forslag" />}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="fpe-panel-layout" aria-labelledby="fpe-tab-layout" hidden={tab !== "layout"}>
        <LayoutTab
          data={data}
          onDirtyChange={setDirty}
          onServerChange={refresh}
          onOpenHistory={() => go("historik")}
          onProposeAfterPublish={() => {
            go("forslag");
            setProposeSignal((n) => n + 1);
          }}
        />
      </div>
      <div role="tabpanel" id="fpe-panel-forslag" aria-labelledby="fpe-tab-forslag" hidden={tab !== "forslag"}>
        <ProposalsTab data={data} initialSelectId={data.selected?.summary.id ?? null} onServerChange={refresh} proposeSignal={proposeSignal} />
      </div>
      <div role="tabpanel" id="fpe-panel-historik" aria-labelledby="fpe-tab-historik" hidden={tab !== "historik"}>
        <HistoryTab data={data} onServerChange={refresh} />
      </div>
      <div role="tabpanel" id="fpe-panel-metrikker" aria-labelledby="fpe-tab-metrikker" hidden={tab !== "metrikker"}>
        <MetricsTab data={data} />
      </div>
      <div role="tabpanel" id="fpe-panel-fastgoer" aria-labelledby="fpe-tab-fastgoer" hidden={tab !== "fastgoer"}>
        {legacy}
      </div>
    </div>
  );
}
