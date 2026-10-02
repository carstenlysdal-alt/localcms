"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, FilePlus, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Layout";

export type IntakeCardProps = {
  /** Chip(s) til status, kanal osv. */
  badges: ReactNode;
  createdAt?: Date | string;
  title: ReactNode;
  /** Én eller flere linjer med afsender/kontakt. */
  meta?: ReactNode;
  summary?: ReactNode;
  /** Offentlig portal-sti (fx "/qa"): giver en "Kopier link"-knap sammen med `token`. Tom token = knappen skjules. */
  portalPath?: string;
  token?: string;
  copyLabel?: string;
  /** Eksisterende artikel (kladde) → "Åbn"-link; ellers vises convert-knappen. */
  articleId?: string | null;
  openLabel?: string;
  convert?: () => Promise<{ success: boolean; error?: string }>;
  convertLabel?: string;
};

/**
 * Fælles kort til kilde-/partner-/meddeler-henvendelser: statuschips, afsender, kopier portal-link, opret/åbn artikelkladde.
 * Fejl vises inline (ingen window.alert).
 */
export function IntakeCard({ badges, createdAt, title, meta, summary, portalPath, token, copyLabel = "Kopier link", articleId, openLabel = "Åbn artikelkladde", convert, convertLabel = "Opret artikel" }: IntakeCardProps) {
  const [copied, setCopied] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = () => {
    if (!token || !portalPath) return;
    navigator.clipboard.writeText(`${window.location.origin}${portalPath}/${token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const run = async () => {
    if (!convert) return;
    setConverting(true);
    setError(null);
    const res = await convert();
    setConverting(false);
    if (!res.success) setError(res.error || "Kunne ikke oprette artikel.");
  };

  return (
    <Card as="article" padding="sm">
      <div className="intake-row">
        <div className="intake-main">
          <div className="intake-badges">
            {badges}
            {createdAt ? (
              <time className="ui-small ui-muted" dateTime={new Date(createdAt).toISOString()}>
                {new Date(createdAt).toLocaleDateString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </time>
            ) : null}
          </div>
          <h3 className="intake-title">{title}</h3>
          {meta ? <p className="intake-sender">{meta}</p> : null}
          {summary ? <p className="intake-summary">{summary}</p> : null}
        </div>
        <div className="ui-actions">
          {token && portalPath ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              <span role="status">{copied ? "Kopieret" : copyLabel}</span>
            </button>
          ) : null}
          {articleId ? (
            <Link className="btn btn-secondary btn-sm" href={`/redaktion/artikler/${articleId}`}><ExternalLink size={14} aria-hidden="true" /> {openLabel}</Link>
          ) : convert ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={run} disabled={converting}>
              {converting ? <Loader2 size={14} className="ui-spin" aria-hidden="true" /> : <FilePlus size={14} aria-hidden="true" />}
              {converting ? "Opretter…" : convertLabel}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <Notice tone="danger" className="intake-notice">{error}</Notice> : null}
    </Card>
  );
}
