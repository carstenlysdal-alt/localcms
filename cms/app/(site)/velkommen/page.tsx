import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { FileText, Users, Heart } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Tættere på ${site.kommune} — ${site.navn}`,
    description: `Uafhængig lokaljournalistik, der sætter fællesskabet først i ${site.kommune}.`,
  };
}

export default async function VelkommenPage() {
  const site = await getCurrentSite();

  return (
    <main className="velkommen-wrapper">
      <div className="velkommen-card">
        {/* Brand */}
        <div className="velkommen-brand">
          <span className="velkommen-brand-name">{site.navn}</span>
          <span className="velkommen-brand-sub">UAFHÆNGIG LOKALJOURNALISTIK</span>
        </div>

        {/* Hero titel & lead */}
        <h1 className="velkommen-title">Tættere på {site.kommune}</h1>
        <p className="velkommen-lead">
          Uafhængig lokaljournalistik, der sætter fællesskabet først.
        </p>

        {/* 3 værdipunkter med bløde cirkelikoner */}
        <div className="velkommen-points">
          <div className="velkommen-point">
            <div className="velkommen-point-icon">
              <FileText size={18} />
            </div>
            <span className="velkommen-point-text">
              Lokale nyheder, der gør en forskel
            </span>
          </div>

          <div className="velkommen-point">
            <div className="velkommen-point-icon">
              <Users size={18} />
            </div>
            <span className="velkommen-point-text">
              Det, der angår dig og din hverdag
            </span>
          </div>

          <div className="velkommen-point">
            <div className="velkommen-point-icon">
              <Heart size={18} />
            </div>
            <span className="velkommen-point-text">
              Et stærkere lokalsamfund gennem viden og dialog
            </span>
          </div>
        </div>

        {/* Bysilhuet / Illustration */}
        <div className="velkommen-illustration-wrap">
          <svg viewBox="0 0 400 160" className="velkommen-illustration" aria-hidden="true">
            {/* Varm sol */}
            <circle cx="320" cy="50" r="28" fill="#F4D9C6" />
            {/* Bløde bakker i baggrunden */}
            <path d="M0,160 Q100,100 240,130 T400,120 L400,160 Z" fill="#E8DEC8" opacity="0.6" />
            {/* Storebæltsbro eller brobue */}
            <path d="M260,160 L280,70 L288,70 L308,160" stroke="#7A8B99" strokeWidth="3" fill="none" />
            <path d="M240,120 Q284,80 328,120" stroke="#7A8B99" strokeWidth="2" fill="none" />
            {/* Kirketårn og bygningssilhuetter */}
            <rect x="70" y="80" width="30" height="80" fill="#BA4A28" rx="2" />
            <polygon points="70,80 85,25 100,80" fill="#2E4057" />
            <rect x="105" y="100" width="40" height="60" fill="#C95D3B" rx="2" />
            <polygon points="102,100 125,75 148,100" fill="#2E4057" />
            <rect x="150" y="110" width="35" height="50" fill="#BA4A28" rx="2" />
            {/* Træer og forgrund */}
            <circle cx="55" cy="140" r="18" fill="#3D5A53" />
            <circle cx="195" cy="142" r="16" fill="#3D5A53" />
            <circle cx="215" cy="145" r="14" fill="#4B6E65" />
            {/* Vand og kaj */}
            <path d="M0,145 Q200,138 400,145 L400,160 L0,160 Z" fill="#2E4057" />
            <path d="M0,152 Q200,146 400,152" stroke="#5C7D93" strokeWidth="2" fill="none" />
          </svg>
        </div>

        {/* Handlingsknapper */}
        <div className="velkommen-actions">
          <Link href="/" className="velkommen-btn-primary">
            Kom i gang
          </Link>
          <Link href="/login" className="velkommen-btn-secondary">
            Allerede læser? Log ind
          </Link>
        </div>

        {/* 4 dots indikator fra mock */}
        <div className="velkommen-dots" aria-hidden="true">
          <span className="velkommen-dot is-active" />
          <span className="velkommen-dot" />
          <span className="velkommen-dot" />
          <span className="velkommen-dot" />
        </div>
      </div>
    </main>
  );
}
