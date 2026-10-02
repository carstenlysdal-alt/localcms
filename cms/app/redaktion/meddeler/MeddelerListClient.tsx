"use client";

import { useState } from "react";
import { Check, Copy, Radio, Users } from "lucide-react";
import { convertMeddelerSagToArticle } from "@/app/redaktion/indbakke/actions";
import { IntakeCard } from "@/components/admin/IntakeCard";
import { Badge, StatusChip } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";

interface MeddelerItem {
  id: string;
  token: string;
  navn: string;
  kontakt: string;
  phone: string | null;
  organisation: string | null;
  kategori: string;
  omraader: string | null;
  createdAt: Date;
  _count: { sager: number };
}

interface SagItem {
  id: string;
  titel: string;
  kategori: string;
  status: string;
  tekst: string;
  createdAt: Date;
  articleId: string | null;
  article?: { id: string; titel: string; status: string } | null;
  meddeler: {
    navn: string;
    organisation: string | null;
    kontakt: string;
  };
}

interface MeddelerListClientProps {
  meddelere: MeddelerItem[];
  sager: SagItem[];
}

function ProfileCard({ m }: { m: MeddelerItem }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/meddeler/${m.token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <Card as="article" padding="sm">
      <div className="intake-row">
        <div className="intake-main">
          <h3 className="intake-title">{m.navn} <Badge tone="review">{m.kategori}</Badge></h3>
          <p className="intake-sender">
            <span>{m.organisation ? `${m.organisation} · ` : ""}{m.kontakt}{m.phone ? ` · ${m.phone}` : ""}</span>
            <span>Område: {m.omraader || "Alle"}</span>
          </p>
        </div>
        <div className="ui-actions">
          <span className="ui-small ui-muted">{m._count.sager} sager indsendt</span>
          {m.token ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              <span role="status">{copied ? "Kopieret" : "Kopier panel-link"}</span>
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function MeddelerListClient({ meddelere, sager }: MeddelerListClientProps) {
  return (
    <Tabs
      label="Meddeler-netværket"
      items={[
        {
          id: "sager",
          label: "Indberettede sager",
          count: sager.length,
          children: sager.length === 0 ? (
            <EmptyState icon={<Radio size={22} />} title="Ingen sager indberettet endnu" />
          ) : (
            <ul className="ui-list" aria-label="Indberettede sager">
              {sager.map((sag) => (
                <li key={sag.id}>
                  <IntakeCard
                    badges={<StatusChip status={sag.status} />}
                    createdAt={sag.createdAt}
                    title={sag.titel}
                    meta={<span>Fra meddeler: <strong>{sag.meddeler.navn}</strong>{sag.meddeler.organisation ? ` (${sag.meddeler.organisation})` : ""} · {sag.kategori}</span>}
                    articleId={sag.articleId || sag.article?.id}
                    convert={() => convertMeddelerSagToArticle(sag.id)}
                  />
                </li>
              ))}
            </ul>
          ),
        },
        {
          id: "profiler",
          label: "Registrerede meddelere",
          count: meddelere.length,
          children: meddelere.length === 0 ? (
            <EmptyState icon={<Users size={22} />} title="Ingen meddelere tilmeldt endnu" />
          ) : (
            <ul className="ui-list" aria-label="Registrerede meddelere">
              {meddelere.map((m) => <li key={m.id}><ProfileCard m={m} /></li>)}
            </ul>
          ),
        },
      ]}
    />
  );
}
