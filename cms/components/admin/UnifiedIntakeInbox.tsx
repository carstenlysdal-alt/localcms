"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Inbox,
  Mic,
  Handshake,
  Radio,
  MessageSquare,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  FilePlus,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { Badge, StatusChip, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Layout";
import {
  convertQaToArticle,
  convertInterviewToArticle,
  convertSponsorBriefToArticle,
  convertMeddelerSagToArticle,
  convertSubmissionToArticle,
} from "@/app/redaktion/indbakke/actions";
import { isNewIntakeStatus } from "@/lib/validation/status";

export type IntakeItem = {
  id: string;
  channel: "qa" | "interview" | "sponsor" | "meddeler" | "submission";
  title: string;
  senderName: string;
  senderContact?: string | null;
  senderRole?: string | null;
  status: string;
  createdAt: Date | string;
  summary?: string | null;
  token?: string;
  articleId?: string | null;
  article?: {
    id: string;
    titel: string;
    slug: string;
    status: string;
  } | null;
  details?: Record<string, unknown>;
};

interface UnifiedIntakeInboxProps {
  items: IntakeItem[];
}

const CHANNEL_META: Record<IntakeItem["channel"], { label: string; tone: BadgeTone; icon: typeof Inbox }> = {
  qa: { label: "Kilde-Q&A", tone: "planned", icon: Inbox },
  interview: { label: "AI-interview", tone: "draft", icon: Mic },
  sponsor: { label: "Sponsor / partner", tone: "success", icon: Handshake },
  meddeler: { label: "Meddeler-sag", tone: "review", icon: Radio },
  submission: { label: "Borgerindlæg", tone: "neutral", icon: MessageSquare },
};

export function UnifiedIntakeInbox({ items }: UnifiedIntakeInboxProps) {
  const [activeChannel, setActiveChannel] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<{ id: string; text: string } | null>(null);

  const channels = [
    { key: "all", label: "Alle kanaler", count: items.length },
    ...(Object.keys(CHANNEL_META) as Array<IntakeItem["channel"]>).map((key) => ({
      key,
      label: CHANNEL_META[key].label,
      icon: CHANNEL_META[key].icon,
      count: items.filter((i) => i.channel === key).length,
    })),
  ];

  const filteredItems = items.filter((i) => activeChannel === "all" || i.channel === activeChannel);

  const handleCopyLink = (token: string, channel: string) => {
    let url = "";
    if (channel === "qa") url = `${window.location.origin}/qa/${token}`;
    if (channel === "interview") url = `${window.location.origin}/interview/${token}`;
    if (channel === "sponsor") url = `${window.location.origin}/partner/${token}`;
    if (channel === "meddeler") url = `${window.location.origin}/meddeler/${token}`;

    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2500);
    }
  };

  const handleConvert = (item: IntakeItem) => {
    setLoadingItemId(item.id);
    setErrorMessage(null);
    startTransition(async () => {
      let res: { success: boolean; articleId?: string; message?: string; error?: string } = { success: false };

      if (item.channel === "qa") res = await convertQaToArticle(item.id);
      if (item.channel === "interview") res = await convertInterviewToArticle(item.id);
      if (item.channel === "sponsor") res = await convertSponsorBriefToArticle(item.id);
      if (item.channel === "meddeler") res = await convertMeddelerSagToArticle(item.id);
      if (item.channel === "submission") res = await convertSubmissionToArticle(item.id);

      setLoadingItemId(null);

      if (res.success) {
        setActionMessage({ id: item.id, text: res.message || "Artikel oprettet som kladde!" });
      } else {
        setErrorMessage({ id: item.id, text: res.error || "Kunne ikke oprette artikel." });
      }
    });
  };

  return (
    <div className="ui-stack ui-gap-md">
      <div className="ui-chips" role="group" aria-label="Filtrér på kanal">
        {channels.map((ch) => {
          const Icon = "icon" in ch ? ch.icon : null;
          return (
            <button key={ch.key} type="button" className="ui-chip" aria-pressed={activeChannel === ch.key} onClick={() => setActiveChannel(ch.key)}>
              {Icon ? <Icon size={14} aria-hidden="true" /> : null}
              {ch.label}
              <span className="ui-chip-count">{ch.count}</span>
            </button>
          );
        })}
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState icon={<Inbox size={22} />} title="Ingen henvendelser" description="Der er ingen henvendelser i denne kanal lige nu." />
      ) : (
        <ul className="ui-list" aria-label="Henvendelser">
          {filteredItems.map((item) => {
            const isExpanded = expandedId === item.id;
            const isConverting = loadingItemId === item.id;
            const hasArticle = !!item.articleId || !!item.article;
            const isNew = isNewIntakeStatus(item.status);
            const meta = CHANNEL_META[item.channel];
            const ChannelIcon = meta.icon;
            const contact = item.senderContact;

            return (
              <li key={`${item.channel}-${item.id}`}>
                <Card as="article" padding="sm" className={isNew ? "intake-new" : undefined} aria-label={item.title}>
                  <div className="intake-row">
                    <div className="intake-main">
                      <div className="intake-badges">
                        <Badge tone={meta.tone} icon={<ChannelIcon size={12} />}>{meta.label}</Badge>
                        {hasArticle ? <Badge tone="success" dot>Artikel oprettet</Badge> : <StatusChip status={item.status} />}
                        <time className="ui-small ui-muted" dateTime={new Date(item.createdAt).toISOString()}>
                          {new Date(item.createdAt).toLocaleDateString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </time>
                      </div>
                      <h3 className="intake-title">{item.title}</h3>
                      <p className="intake-sender">
                        <span>Afsender: <strong>{item.senderName}</strong>{item.senderRole ? ` (${item.senderRole})` : ""}</span>
                        {contact ? (
                          <span>Kontakt: {contact.includes("@") ? <a className="ui-link" href={`mailto:${contact}`}>{contact}</a> : <span className="ui-muted">{contact}</span>}</span>
                        ) : null}
                      </p>
                      {item.summary ? <p className="intake-summary">{item.summary}</p> : null}
                    </div>

                    <div className="ui-actions">
                      {item.token ? (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleCopyLink(item.token!, item.channel)} title="Kopier det direkte link, som kilden eller partneren bruger">
                          {copiedToken === item.token ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                          <span role="status">{copiedToken === item.token ? "Kopieret" : "Kildelink"}</span>
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-ghost btn-sm" aria-expanded={isExpanded} aria-controls={`intake-${item.id}`} onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                        <ChevronDown size={14} aria-hidden="true" className={isExpanded ? "intake-chevron is-open" : "intake-chevron"} />
                        {isExpanded ? "Skjul detaljer" : "Vis detaljer"}
                      </button>
                      {hasArticle ? (
                        <Link className="btn btn-secondary btn-sm" href={`/redaktion/artikler/${item.articleId || item.article?.id}`}>
                          <ExternalLink size={14} aria-hidden="true" /> Åbn artikelkladde
                        </Link>
                      ) : (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleConvert(item)} disabled={isConverting || isPending}>
                          {isConverting ? <Loader2 size={14} className="ui-spin" aria-hidden="true" /> : <FilePlus size={14} aria-hidden="true" />}
                          {isConverting ? "Opretter…" : "Opret artikel"}
                        </button>
                      )}
                    </div>
                  </div>

                  {actionMessage?.id === item.id ? (
                    <Notice tone="success" className="intake-notice"><span className="ui-row ui-gap-sm"><CheckCircle2 size={14} aria-hidden="true" />{actionMessage.text}</span></Notice>
                  ) : null}
                  {errorMessage?.id === item.id ? <Notice tone="danger" className="intake-notice">{errorMessage.text}</Notice> : null}

                  <div id={`intake-${item.id}`} role="region" aria-label={`Detaljer for ${item.title}`} hidden={!isExpanded || !item.details} className="intake-details">
                    <pre>{JSON.stringify(item.details, null, 2)}</pre>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
