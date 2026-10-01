import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { MeddelerDashboardClient } from "./MeddelerDashboardClient";
import { Radio, User, MapPin, Building, ShieldCheck } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const profile = await db.meddelerProfile.findUnique({ where: { token } });
  return {
    title: profile ? `Meddelerpanel: ${profile.navn}` : "Meddelerpanel",
    robots: { index: false, follow: false },
  };
}

export default async function MeddelerDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const site = await getCurrentSite();

  const profile = await db.meddelerProfile.findUnique({
    where: { token },
    include: {
      sager: {
        orderBy: { createdAt: "desc" },
        include: {
          article: {
            select: { id: true, titel: true, slug: true, status: true },
          },
        },
      },
    },
  });

  if (!profile) {
    return (
      <div className="site-page-container" style={{ padding: "48px 0" }}>
        <div className="site-container" style={{ maxWidth: "600px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "28px" }}>Meddelerprofil ikke fundet</h1>
          <p style={{ color: "var(--ink-2)", marginTop: "8px" }}>
            Vi kunne ikke finde din meddelerprofil med den angivne kode. Tjek venligst dit link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="site-page-container" style={{ padding: "28px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "800px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Meddeler-netværket", href: "/meddeler" },
            { label: profile.navn },
          ]}
        />

        {/* Profil header */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-card)",
            padding: "28px",
            marginBottom: "28px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#92400e", marginBottom: "8px" }}>
            <Radio size={18} />
            <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Meddeler-dashboard
            </span>
            <span
              style={{
                marginLeft: "auto",
                background: "#fef3c7",
                color: "#92400e",
                padding: "2px 10px",
                borderRadius: "9999px",
                fontSize: "11px",
                fontWeight: "700",
              }}
            >
              Aktiv meddeler · {profile.kategori}
            </span>
          </div>

          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "30px", margin: "0 0 8px 0", color: "var(--ink)" }}>
            {profile.navn}
          </h1>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", paddingTop: "12px", borderTop: "1px solid var(--line)", fontSize: "13px", color: "var(--ink-3)" }}>
            {profile.organisation && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Building size={14} />
                <span>Organisation: <strong>{profile.organisation}</strong></span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <MapPin size={14} />
              <span>Område: <strong>{profile.omraader || site.kommune}</strong></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
              <ShieldCheck size={14} />
              <span>Tilknyttet {site.navn}</span>
            </div>
          </div>
        </div>

        {/* Interaktiv indberetning og historik */}
        <MeddelerDashboardClient token={token} profile={profile} />
      </div>
    </div>
  );
}
