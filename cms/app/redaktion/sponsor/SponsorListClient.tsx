"use client";

import Link from "next/link";
import { Handshake } from "lucide-react";
import { convertSponsorBriefToArticle } from "@/app/redaktion/indbakke/actions";
import { IntakeCard } from "@/components/admin/IntakeCard";
import { StatusChip } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

interface SponsorItem {
  id: string;
  token: string;
  partnerNavn: string;
  kontaktNavn: string;
  kontaktEmail: string;
  format: string;
  status: string;
  createdAt: Date;
  articleId: string | null;
  article?: { id: string; titel: string; status: string } | null;
}

export function SponsorListClient({ briefs }: { briefs: SponsorItem[] }) {
  if (briefs.length === 0) {
    return (
      <EmptyState
        icon={<Handshake size={22} />}
        title="Ingen partner-briefs endnu"
        description={<>Virksomheder kan indsende briefs via <Link className="ui-link" href="/sponsor">/sponsor</Link>.</>}
      />
    );
  }

  return (
    <ul className="ui-list" aria-label="Partner-briefs">
      {briefs.map((brief) => (
        <li key={brief.id}>
          <IntakeCard
            badges={<StatusChip status={brief.status} />}
            createdAt={brief.createdAt}
            title={<>{brief.partnerNavn} <span className="ui-muted intake-format">({brief.format})</span></>}
            meta={<span>Kontakt: <strong>{brief.kontaktNavn}</strong> ({brief.kontaktEmail})</span>}
            portalPath="/partner"
            token={brief.token}
            copyLabel="Kopier partnerlink"
            articleId={brief.articleId || brief.article?.id}
            openLabel="Åbn partnerartikel"
            convert={() => convertSponsorBriefToArticle(brief.id)}
            convertLabel="Opret partnerartikel"
          />
        </li>
      ))}
    </ul>
  );
}
