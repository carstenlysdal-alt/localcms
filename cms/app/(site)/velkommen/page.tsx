import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/velkommen", (site) => ({
    title: "Velkommen",
    description: `Uafhængig lokaljournalistik, der sætter fællesskabet først i ${site.kommune}.`,
  }), { noindex: true });
}

export default async function VelkommenPage() {
  const site = await getCurrentSite();

  return (
    <div className="site-onboarding-wrapper">
      {/* Mobil topbar med logo og Spring over */}
      <header className="site-onboarding-mobile-header site-mobile-only">
        <span className="site-brand-logo">
          <span>{site.navn.replace(/Lokalt$/, "")}</span>
          <span className="site-brand-logo-accent">Lokalt</span>
        </span>
        <Link href="/" className="site-onboarding-skip-link">
          Gå til forsiden
        </Link>
      </header>

      <div className="site-container site-onboarding-container">
        {/* Desktop link "GÅ DIREKTE TIL FORSIDEN" */}
        <div className="site-onboarding-desktop-kicker site-desktop-only">
          <Link href="/" className="site-onboarding-skip-link">
            Gå direkte til forsiden →
          </Link>
        </div>

        {/* Hero overskrift & manifest */}
        <div className="site-onboarding-hero">
          <h1 className="site-onboarding-title">
            Din by. Dine nyheder. Lige ved hånden.
          </h1>

          <p className="site-onboarding-desc">
            {site.navn} er et uafhængigt lokalt nyhedsmedie for borgerne i {site.kommune}. Vi dækker de beslutninger, begivenheder og mennesker, der former vores fælles hverdag.
          </p>

          <div className="site-onboarding-actions">
            <Link href="/" className="site-btn-pill-primary">
              Læs dagens nyheder
            </Link>
            <Link href="/profil" className="site-btn-pill-secondary">
              Jeg har allerede en konto
            </Link>
          </div>
        </div>

        {/* Redaktionelle principper: Rytmisk definition (ikke bokse med ikoner) */}
        <div className="site-onboarding-manifesto" aria-label="Avisens publicistiske grundlag">
          <div className="site-onboarding-manifesto-item">
            <h2 className="site-onboarding-manifesto-title">Uafhængig lokaljournalistik</h2>
            <p className="site-onboarding-manifesto-desc">
              Vi drives af journalistisk nysgerrighed og samfundsrelevans. Vores dækning er fri for partipolitiske bindinger og kommercielle hensyn.
            </p>
          </div>

          <div className="site-onboarding-manifesto-item">
            <h2 className="site-onboarding-manifesto-title">Fuld gennemsigtighed</h2>
            <p className="site-onboarding-manifesto-desc">
              Hvert eneste stykke indhold er klart mærket, så du altid ved, hvem der har skrevet det, hvilke kilder der er anvendt, og hvordan historien er finansieret.
            </p>
          </div>

          <div className="site-onboarding-manifesto-item">
            <h2 className="site-onboarding-manifesto-title">Tæt på hele kommunen</h2>
            <p className="site-onboarding-manifesto-desc">
              Vi prioriterer de historier, der ellers bliver overset af de landsdækkende medier, fra byrådssalen til foreningslivet og de lokale erhvervsdrivende.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
