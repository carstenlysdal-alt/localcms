"use client";

import Link from "next/link";
import { Mic } from "lucide-react";
import { convertInterviewToArticle } from "@/app/redaktion/indbakke/actions";
import { isAnswered, normalizeStatus } from "@/lib/validation/status";
import { IntakeCard } from "@/components/admin/IntakeCard";
import { Badge, StatusChip } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

interface InterviewItem {
  id: string;
  token: string;
  titel: string;
  emne: string;
  kildeNavn: string;
  kildeKontakt: string;
  kildeRolle: string | null;
  status: string;
  createdAt: Date;
  articleId: string | null;
  article?: { id: string; titel: string; status: string } | null;
}

export function InterviewListClient({ interviews }: { interviews: InterviewItem[] }) {
  if (interviews.length === 0) {
    return (
      <EmptyState
        icon={<Mic size={22} />}
        title="Ingen AI-interviews endnu"
        description={<>Kilder kan starte et interview via den offentlige portal på <Link className="ui-link" href="/interview">/interview</Link>.</>}
      />
    );
  }

  return (
    <ul className="ui-list" aria-label="Interviews">
      {interviews.map((item) => {
        const status = normalizeStatus("interview", item.status);
        return (
          <li key={item.id}>
            <IntakeCard
              badges={
                status === "ArtikelOprettet" ? <Badge tone="success" dot>Artikel oprettet</Badge>
                  : isAnswered("interview", item.status) ? <Badge tone="draft" dot>{item.status}</Badge>
                  : <StatusChip status={status} />
              }
              createdAt={item.createdAt}
              title={item.titel}
              meta={<span>Kilde: <strong>{item.kildeNavn}</strong>{item.kildeRolle ? ` (${item.kildeRolle})` : ""}{item.kildeKontakt ? ` · ${item.kildeKontakt}` : ""}</span>}
              portalPath="/interview"
              token={item.token}
              copyLabel="Kopier kildelink"
              articleId={item.articleId || item.article?.id}
              convert={() => convertInterviewToArticle(item.id)}
            />
          </li>
        );
      })}
    </ul>
  );
}
