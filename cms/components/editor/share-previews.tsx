"use client";

import { useId, useState } from "react";
import { Globe, Smartphone } from "lucide-react";
import type { ArticleSeoInput } from "@/lib/seo/article-seo";
import { buildPreviews } from "@/lib/seo/preview";

const TABS = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
  { id: "mobil", label: "Mobil" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Delings-previews drevet af de samme helper-funktioner som det offentlige site (lib/seo/preview.ts). */
export function SharePreviews({ input, siteName }: { input: ArticleSeoInput; siteName: string }) {
  const [tab, setTab] = useState<TabId>("google");
  const uid = useId();
  const p = buildPreviews(input);
  const noImage = p.seo.og.image.url.endsWith("/og/by.jpg");
  return (
    <div className="cms-previews">
      <div role="tablist" aria-label="Forhåndsvisning af deling" className="cms-tabs-inline">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`${uid}-${t.id}`} aria-selected={tab === t.id} aria-controls={`${uid}-panel`} tabIndex={tab === t.id ? 0 : -1} className="cms-tab" onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              const i = TABS.findIndex((x) => x.id === tab);
              if (e.key === "ArrowRight") setTab(TABS[(i + 1) % TABS.length].id);
              if (e.key === "ArrowLeft") setTab(TABS[(i + TABS.length - 1) % TABS.length].id);
            }}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${tab}`} className="cms-preview-panel">
        {tab === "google" && (
          <div className="cms-serp">
            <p className="cms-serp-site"><Globe size={14} aria-hidden="true" /> <span>{siteName}</span> <span className="cms-serp-url">{p.serp.displayUrl}</span></p>
            <p className="cms-serp-title">{p.serp.title}</p>
            <p className="cms-serp-desc">{p.serp.description || "Ingen metabeskrivelse — Google vælger selv en tekst."}</p>
            {(p.serp.titleClipped || p.serp.descriptionClipped) && <p className="cms-hint is-warn">{p.serp.titleClipped ? "Titlen klippes af Google. " : ""}{p.serp.descriptionClipped ? "Beskrivelsen klippes af Google." : ""}</p>}
          </div>
        )}
        {(tab === "facebook" || tab === "linkedin") && (
          <div className={`cms-card-preview is-${tab}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cms-card-img" src={p.cards[tab].imageUrl} alt={p.cards[tab].imageAlt} />
            <div className="cms-card-body">
              <p className="cms-card-host">{p.cards[tab].host}</p>
              <p className="cms-card-title">{p.cards[tab].title}</p>
              {p.cards[tab].description && <p className="cms-card-desc">{p.cards[tab].description}</p>}
            </div>
          </div>
        )}
        {tab === "x" && (
          <div className={`cms-card-preview is-x${p.cards.x.card === "summary" ? " is-summary" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cms-card-img" src={p.cards.x.imageUrl} alt={p.cards.x.imageAlt} />
            <div className="cms-card-body">
              <p className="cms-card-host">{p.cards.x.host}</p>
              <p className="cms-card-title">{p.cards.x.title}</p>
              <p className="cms-card-desc">{p.cards.x.description}</p>
            </div>
          </div>
        )}
        {tab === "mobil" && (
          <div className="cms-phone" aria-label="Mobilvisning">
            <p className="cms-phone-bar"><Smartphone size={14} aria-hidden="true" /> {p.cards.facebook.host}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cms-phone-img" src={p.seo.og.image.url} alt={p.seo.og.image.alt} />
            <p className="cms-phone-title">{p.mobileTitle}</p>
            <p className="cms-phone-desc">{p.mobileDescription}</p>
          </div>
        )}
        {noImage && tab !== "google" && <p className="cms-hint is-warn">Intet billede valgt — vælg et featurebillede eller et OG-billede.</p>}
      </div>
    </div>
  );
}
