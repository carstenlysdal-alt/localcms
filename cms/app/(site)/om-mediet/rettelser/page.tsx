import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { formatFullDate } from "@/lib/site-queries";
import { AlertCircle, CheckCircle, Mail } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/om-mediet/rettelser", (site) => ({
    title: "Rettelser og præciseringer",
    description: `Offentlig log over faktuelle rettelser og præciseringer i artikler på ${site.navn}.`,
  }));
}

export default async function CorrectionsPage() {
  const site = await getCurrentSite();

  const corrections = await db.correction.findMany({
    where: { instansId: site.id },
    orderBy: { dato: "desc" },
    include: {
      article: {
        include: {
          kategori: { include: { parent: true } },
        },
      },
    },
  });

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "800px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Om mediet", href: "/om-mediet" },
            { label: "Rettelser" },
          ]}
        />

        <header className="site-page-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <AlertCircle size={28} style={{ color: "var(--site-accent)" }} />
            <h1 className="site-page-title" style={{ margin: 0 }}>
              Rettelser og præciseringer
            </h1>
          </div>
          <p className="site-page-desc" style={{ fontSize: "18px", lineHeight: "1.5" }}>
            {site.navn} tilstræber altid at bringe korrekte og præcise oplysninger. Hvis vi begår
            faktuelle fejl, retter vi dem i selve artiklen og dokumenterer rettelsen her på siden.
          </p>
        </header>

        {/* Info om rettelsespolitik */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-card)",
            padding: "20px",
            margin: "24px 0 36px 0",
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
          }}
        >
          <Mail size={22} style={{ color: "var(--site-accent)", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: "15px", display: "block" }}>
              Har du fundet en fejl i en artikel?
            </strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Skriv direkte til redaktionen på{" "}
              <a
                href={`mailto:redaktion@${site.domaene}`}
                style={{ color: "var(--site-accent)", fontWeight: "600", textDecoration: "underline" }}
              >
                redaktion@{site.domaene}
              </a>
              . Angiv venligst linket til artiklen og hvad du mener er forkert. Vi undersøger alle henvendelser hurtigt.
            </p>
          </div>
        </div>

        {/* Listen af rettelser */}
        <section>
          <h2 className="site-block-heading" style={{ marginBottom: "20px" }}>
            Historik over rettelser ({corrections.length})
          </h2>

          {corrections.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {corrections.map((corr) => {
                const sektionSlug =
                  corr.article.kategori?.parent?.slug ||
                  corr.article.kategori?.slug ||
                  "nyheder";
                const articleHref = `/${sektionSlug}/${corr.article.slug}`;

                return (
                  <article
                    key={corr.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderLeft: "4px solid var(--site-accent)",
                      borderRadius: "0 var(--radius-card) var(--radius-card) 0",
                      padding: "18px 20px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "13px",
                        color: "var(--ink-3)",
                        marginBottom: "6px",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      <CheckCircle size={15} style={{ color: "var(--site-accent)" }} />
                      <time dateTime={corr.dato.toISOString()}>{formatFullDate(corr.dato)}</time>
                    </div>

                    <h3 style={{ margin: "0 0 8px 0", fontSize: "17px", fontFamily: "var(--font-display)", fontWeight: "700" }}>
                      <Link href={articleHref} style={{ color: "var(--ink)", textDecoration: "none" }}>
                        {corr.article.titel} →
                      </Link>
                    </h3>

                    <div
                      style={{
                        fontSize: "15px",
                        color: "var(--ink-2)",
                        lineHeight: "1.45",
                        whiteSpace: "pre-line",
                      }}
                    >
                      {corr.tekst}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-card)",
                color: "var(--ink-2)",
                fontStyle: "italic",
              }}
            >
              Der er i øjeblikket ingen registrerede rettelser.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
