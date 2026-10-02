"use client";

import { Inbox } from "lucide-react";
import { convertQaToArticle } from "@/app/redaktion/indbakke/actions";
import { isAnswered, normalizeStatus } from "@/lib/validation/status";
import { IntakeCard } from "@/components/admin/IntakeCard";
import { Badge, StatusChip } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

interface QAItem {
  id: string;
  token: string;
  titel: string;
  emne: string;
  kildeNavn: string | null;
  kildeKontakt: string | null;
  kildeRolle: string | null;
  status: string;
  createdAt: Date;
  articleId: string | null;
  article?: { id: string; titel: string; status: string } | null;
}

export function QaListClient({ qas }: { qas: QAItem[] }) {
  if (qas.length === 0) {
    return <EmptyState icon={<Inbox size={22} />} title="Ingen kilde-Q&A endnu" description="Brug knappen øverst til at oprette den første Q&A-session til en kilde." />;
  }

  return (
    <ul className="ui-list" aria-label="Kilde-Q&A">
      {qas.map((qa) => {
        const status = normalizeStatus("qa", qa.status);
        return (
          <li key={qa.id}>
            <IntakeCard
              badges={
                status === "ArtikelOprettet" ? <Badge tone="success" dot>Artikel oprettet</Badge>
                  : isAnswered("qa", qa.status) ? <Badge tone="success" dot>{qa.status}</Badge>
                  : <StatusChip status={status} />
              }
              createdAt={qa.createdAt}
              title={qa.titel}
              meta={<span>Kilde: <strong>{qa.kildeNavn || "Ikke angivet"}</strong>{qa.kildeRolle ? ` (${qa.kildeRolle})` : ""}{qa.kildeKontakt ? ` · ${qa.kildeKontakt}` : ""}</span>}
              portalPath="/qa"
              token={qa.token}
              copyLabel="Kopier kildelink"
              articleId={qa.articleId || qa.article?.id}
              convert={() => convertQaToArticle(qa.id)}
            />
          </li>
        );
      })}
    </ul>
  );
}
