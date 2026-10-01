"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { safeHref } from "@/lib/html-sanitize";
import type { AdData } from "./types";

/**
 * Annonce-break. Fast mærkning "Annonce" + annoncørens navn. Impression tæller først når annoncen er synlig (≥ 50 %),
 * klik og impression går via det eksisterende /api/ads/track (samme motor som FirstPartyAd). Eksternt link: rel=sponsored.
 */
export function AdBreakView({ campaign, variant }: { campaign: AdData; variant: "kort" | "kompakt" | "tekstlinje" }) {
  const ref = useRef<HTMLElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || tracked.current) return;
    const send = () => {
      if (tracked.current) return;
      tracked.current = true;
      fetch("/api/ads/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: campaign.id, type: "impression" }) }).catch(() => {});
    };
    if (typeof IntersectionObserver === "undefined") {
      send();
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) {
        send();
        io.disconnect();
      }
    }, { threshold: [0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, [campaign.id]);

  const onClick = () => {
    fetch("/api/ads/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: campaign.id, type: "click" }), keepalive: true }).catch(() => {});
  };

  const k = campaign.kreativData;
  const href = safeHref(k.linkUrl);
  const headline = k.overskrift || campaign.titel;
  const cta = k.ctaTekst || "Læs mere";
  const image = k.billedeUrl;

  return (
    <aside ref={ref} className={`fp-break fp-break--ad fp-ad fp-ad--${variant}`} aria-label={`Annonce fra ${campaign.annoncoer}`}>
      <div className="fp-break-kicker">
        <span className="site-badge site-badge-ad fp-label fp-label--ad">Annonce</span>
        <span className="fp-break-by">{campaign.annoncoer}</span>
      </div>
      <div className="fp-ad-body">
        {variant !== "tekstlinje" && image && (
          <div className="fp-ad-media">
            <Image src={image} alt="" width={320} height={200} sizes="(max-width: 640px) 100vw, 240px" unoptimized={!image.startsWith("/")} />
          </div>
        )}
        <div className="fp-ad-text">
          <p className="fp-ad-headline">{headline}</p>
          {variant === "kort" && k.manchet && <p className="fp-ad-manchet">{k.manchet}</p>}
          {href && (
            <a href={href} className="fp-ad-cta" target="_blank" rel="sponsored noopener noreferrer" onClick={onClick}>
              {cta} <ArrowUpRight size={15} aria-hidden="true" />
              <span className="sr-only"> (annonce, åbner i nyt vindue)</span>
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
