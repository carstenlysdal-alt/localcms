import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import Image from "next/image";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ShieldCheck, Mail, Users, Heart } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/om-mediet", (site) => ({
    title: `Om ${site.navn} – redaktion, ejerskab og finansiering`,
    description: `Læs om ${site.navn}, vores redaktion, finansiering og vision for fri lokaljournalistik i ${site.kommune}.`,
  }));
}

export default async function AboutPage() {
  const site = await getCurrentSite();

  const [authors, countArticles] = await Promise.all([
    db.author.findMany({
      where: { instansId: site.id },
      orderBy: { navn: "asc" },
    }),
    db.article.count({
      where: { instansId: site.id, status: "Publiceret" },
    }),
  ]);

  const rawCoverage = site.geografiskDækning as unknown;
  const coverage: string[] = Array.isArray(rawCoverage)
    ? rawCoverage.filter((v): v is string => typeof v === "string")
    : [];
  const sideTekster = (site.sideTekster as Record<string, string> | null) ?? null;

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "880px" }}>
        <Breadcrumbs items={[{ label: "Forside", href: "/" }, { label: "Om mediet" }]} />

        <header className="site-page-header">
          <h1 className="site-page-title">Om {site.navn}</h1>
          <p className="site-page-desc" style={{ fontSize: "19px", lineHeight: "1.5" }}>
            {sideTekster?.omMediet ??
              `${site.navn} er et uafhængigt, digitalt lokalmedie for alle borgere og lokalsamfund i ${site.kommune} Kommune.`}{" "}
            Vi tror på, at et oplyst lokaldemokrati kræver grundig, fair og
            tilgængelig journalistik – uden betalingsmure og uden kommercielle sporingscookies.
          </p>
        </header>

        {/* Nøgletal & Fakta */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            margin: "32px 0",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "20px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: "700", textTransform: "uppercase", color: "var(--ink-3)" }}>
              Dækningsområde
            </span>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--ink)", marginTop: "4px" }}>
              {site.kommune} Kommune
            </div>
            <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: "4px 0 0 0" }}>
              {coverage.length > 0 ? coverage.join(", ") : `Hele ${site.kommune} Kommune`}
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "20px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: "700", textTransform: "uppercase", color: "var(--ink-3)" }}>
              Publicerede artikler
            </span>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--site-accent)", marginTop: "4px" }}>
              {countArticles}+
            </div>
            <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: "4px 0 0 0" }}>
              Åbent tilgængelig for alle
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "20px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: "700", textTransform: "uppercase", color: "var(--ink-3)" }}>
              Adgang
            </span>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--ink)", marginTop: "4px" }}>
              100% Gratis
            </div>
            <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: "4px 0 0 0" }}>
              Ingen paywall, ingen bannere
            </p>
          </div>
        </div>

        {/* Vores vision & Finansiering */}
        <section style={{ margin: "40px 0" }}>
          <h2 className="site-block-heading">Hvorfor findes {site.navn}?</h2>
          <p className="site-block-paragraph">
            Mange lokale historier forsvinder i dag mellem regionale mediekoncerner og lukkede
            Facebook-grupper. Vi arbejder for at bringe den lokale samtale tilbage i det åbne rum, hvor
            beslutninger i byrådet, udviklingen på havnen, det lokale foreningsliv og nye erhvervsinitiativer
            belyses objektivt og grundigt.
          </p>
          <p className="site-block-paragraph">
            Vores journalistik er gratis for læserne. Vi finansieres gennem et netværk af lokale støttepartnere
            og borgere, som ønsker et levende og velinformeret lokalområde. Vi adskiller redaktion og kommercielle
            aftaler fuldstændigt: Ingen partnere har adgang til upubliceret indhold eller indflydelse på vores
            kritiske dækning.
          </p>

          <div
            style={{
              background: "var(--site-accent-soft)",
              borderLeft: "4px solid var(--site-accent)",
              padding: "20px",
              borderRadius: "0 var(--radius-card) var(--radius-card) 0",
              margin: "24px 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <ShieldCheck size={20} style={{ color: "var(--site-accent)" }} />
              <strong style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                Vores redaktionelle løfte
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: "15px", color: "var(--ink-2)" }}>
              Vi følger de presseetiske regler og god presseskik. Hvis vi begår fejl, retter vi dem hurtigt,
              tydeligt og transparent. Læs vores{" "}
              <Link
                href="/om-mediet/redaktionelle-principper"
                style={{ color: "var(--site-accent)", fontWeight: "700", textDecoration: "underline" }}
              >
                fulde redaktionelle principper her →
              </Link>
            </p>
          </div>
        </section>

        {/* Redaktionen */}
        <section style={{ margin: "48px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <Users size={22} style={{ color: "var(--site-accent)" }} />
            <h2 className="site-block-heading" style={{ margin: 0 }}>
              Redaktionen
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {authors.map((author) => (
              <div
                key={author.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-card)",
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                {author.profilbilledeUrl ? (
                  <Image
                    src={author.profilbilledeUrl}
                    alt={author.navn}
                    width={56}
                    height={56}
                    style={{ borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      backgroundColor: "var(--paper)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "700",
                    }}
                  >
                    {author.navn[0]}
                  </div>
                )}
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: "700", fontSize: "16px" }}>
                    {author.slug ? (
                      <Link
                        href={`/forfatter/${author.slug}`}
                        style={{ color: "var(--ink)", textDecoration: "none" }}
                      >
                        {author.navn}
                      </Link>
                    ) : (
                      author.navn
                    )}
                  </div>
                  <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>
                    {author.forfatterType === "Fast" ? "Fast journalist" : "Freelance journalist"}
                  </span>
                  {author.bio && (
                    <p style={{ fontSize: "13px", color: "var(--ink-2)", margin: "4px 0 0 0", lineHeight: "1.35" }}>
                      {author.bio}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Hurtige genveje */}
        <section
          style={{
            borderTop: "1px solid var(--line)",
            paddingTop: "32px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          <div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>
              <ShieldCheck size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
              Principper
            </h3>
            <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: 0 }}>
              <Link href="/om-mediet/redaktionelle-principper" className="site-pill">
                Redaktionelle principper →
              </Link>
            </p>
          </div>

          <div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>
              <Mail size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
              Kontakt os
            </h3>
            <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: 0 }}>
              <Link href="/om-mediet/kontakt" className="site-pill">
                Kontakt & tip →
              </Link>
            </p>
          </div>

          <div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>
              <Heart size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
              Støt lokaljournalistikken
            </h3>
            <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: 0 }}>
              <Link href="/bliv-stoette" className="site-pill">
                Bliv støttepartner →
              </Link>
            </p>
          </div>
        </section>

        {/* Find rundt på sitet */}
        <section style={{ borderTop: "1px solid var(--line)", marginTop: "32px", paddingTop: "24px" }}>
          <h2 className="site-block-heading">Find rundt i {site.navn}</h2>
          <p style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: 0 }}>
            <Link href="/omraade" className="site-pill">Områder</Link>
            <Link href="/emne" className="site-pill">Emner</Link>
            <Link href="/kalender" className="site-pill">Det sker</Link>
            <Link href="/opslagstavle" className="site-pill">Opslagstavlen</Link>
            <Link href="/nyhedsbrev" className="site-pill">Nyhedsbrev</Link>
            <Link href="/priser" className="site-pill">Priser & annoncering</Link>
            <Link href="/sponsor" className="site-pill">Sponsor & partner</Link>
            <Link href="/qa" className="site-pill">Kilde-Q&A</Link>
            <Link href="/interview" className="site-pill">Kildeinterview</Link>
            <Link href="/velkommen" className="site-pill">Ny her? Velkommen</Link>
            <Link href="/om-mediet/privatliv" className="site-pill">Privatliv</Link>
          </p>
          <p style={{ marginTop: "24px", fontSize: "13px", color: "var(--ink-3)" }}>
            Medarbejder?{" "}
            <Link href="/redaktion" style={{ color: "var(--ink-3)", textDecoration: "underline" }}>
              Redaktion
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
