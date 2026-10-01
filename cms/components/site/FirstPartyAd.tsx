"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, Calendar } from "lucide-react";

export interface FirstPartyAdProps {
  campaign: {
    id: string;
    titel: string;
    annoncoer: string;
    format: string; // IN_FEED_BANNER | NATIVE_PREMIUM | EVENT_POST
    kreativData: {
      overskrift?: string;
      manchet?: string;
      ctaTekst?: string;
      linkUrl?: string;
      badgeTekst?: string;
      farve?: string;
      billedeUrl?: string;
    };
  };
}

export function FirstPartyAd({ campaign }: FirstPartyAdProps) {
  const hasTrackedImpression = useRef(false);

  useEffect(() => {
    if (!hasTrackedImpression.current) {
      hasTrackedImpression.current = true;
      try {
        fetch("/api/ads/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId: campaign.id, type: "impression" }),
        }).catch(() => {});
      } catch {}
    }
  }, [campaign.id]);

  const handleClick = () => {
    try {
      fetch("/api/ads/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id, type: "click" }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };

  const { overskrift, manchet, ctaTekst = "Læs mere", linkUrl = "#", badgeTekst = "ANNONCE" } = campaign.kreativData;

  // Format: EVENT_POST
  if (campaign.format === "EVENT_POST") {
    return (
      <aside
        className="site-ad-container site-ad-event"
        style={{
          border: "2px solid #B8860B",
          borderTop: "4px solid #B8860B",
          borderRadius: "8px",
          padding: "16px 20px",
          background: "#FFFDF5",
          margin: "24px 0",
        }}
        aria-label="Annonce"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span
            style={{
              background: "#FCE8A6",
              color: "#4D3900",
              fontSize: "0.75rem",
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: "4px",
              letterSpacing: "0.05em",
            }}
          >
            {badgeTekst}
          </span>
          <span style={{ fontSize: "0.8rem", color: "#666" }}>{campaign.annoncoer}</span>
        </div>
        <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px", color: "var(--site-text, #111)" }}>
          {overskrift || campaign.titel}
        </h4>
        {manchet && <p style={{ fontSize: "0.9rem", color: "#444", margin: "0 0 12px" }}>{manchet}</p>}
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "0.875rem",
            fontWeight: 700,
            color: "#996500",
            textDecoration: "underline",
          }}
        >
          <Calendar size={15} /> {ctaTekst} <ArrowUpRight size={14} />
        </a>
      </aside>
    );
  }

  // Format: IN_FEED_BANNER (Desktop 1200x200 / Responsive, Option 2a)
  return (
    <aside
      className="b site-ad-banner"
      style={{
        backgroundColor: "#FCE8A6",
        color: "#4D3900",
        border: "2px solid #B8860B",
        borderTop: "6px solid #B8860B",
        borderRadius: "16px",
        padding: "22px 28px",
        margin: "32px 0",
        display: "grid",
        gridTemplateColumns: campaign.kreativData.billedeUrl ? "160px 1fr auto" : "1fr auto",
        gap: "24px",
        alignItems: "center",
      }}
      aria-label="Annonce"
    >
      {campaign.kreativData.billedeUrl && (
        <div
          style={{
            height: "100px",
            borderRadius: "8px",
            overflow: "hidden",
            backgroundColor: "rgba(255,255,255,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={campaign.kreativData.billedeUrl}
            alt={campaign.annoncoer}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      <div>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            border: "1.5px solid #4D3900",
            padding: "3px 8px",
            borderRadius: "4px",
            display: "inline-block",
            color: "#4D3900",
          }}
        >
          {badgeTekst}
        </span>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "26px",
            lineHeight: 1.15,
            fontWeight: 600,
            margin: "10px 0 6px 0",
            color: "#4D3900",
          }}
        >
          {overskrift || campaign.titel}
        </h3>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 500, color: "#614900" }}>
          {campaign.annoncoer} {manchet ? `· ${manchet}` : ""}
        </div>
      </div>

      <div>
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          style={{
            fontFamily: "var(--font-sans)",
            backgroundColor: "#4D3900",
            color: "#FCE8A6",
            padding: "12px 22px",
            borderRadius: "999px",
            fontWeight: 700,
            fontSize: "14px",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
          }}
        >
          {ctaTekst} <ArrowUpRight size={15} />
        </a>
      </div>
    </aside>
  );
}
