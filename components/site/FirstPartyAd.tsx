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

  // Format: IN_FEED_BANNER (Desktop 1200x200 / Responsive)
  return (
    <aside
      className="site-ad-container site-ad-banner"
      style={{
        border: "2px solid #B8860B",
        borderTop: "4px solid #B8860B",
        borderRadius: "8px",
        padding: "20px 24px",
        background: "linear-gradient(135deg, #FFFDF8 0%, #FFF9EB 100%)",
        margin: "32px 0",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
      aria-label="Annonce"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
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
        <span style={{ fontSize: "0.8rem", color: "#777", fontWeight: 500 }}>
          Annoncør: {campaign.annoncoer}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
        <div style={{ flex: "1 1 500px" }}>
          <h3
            style={{
              fontSize: "1.3rem",
              fontWeight: 700,
              fontFamily: "var(--font-display, inherit)",
              margin: "0 0 6px",
              color: "var(--site-text, #111)",
            }}
          >
            {overskrift || campaign.titel}
          </h3>
          {manchet && (
            <p style={{ fontSize: "0.95rem", color: "#444", margin: 0, lineHeight: 1.45 }}>
              {manchet}
            </p>
          )}
        </div>

        <div>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={handleClick}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#996500",
              color: "#FFF",
              padding: "10px 18px",
              borderRadius: "6px",
              fontWeight: 700,
              fontSize: "0.9rem",
              textDecoration: "none",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            {ctaTekst} <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
    </aside>
  );
}
