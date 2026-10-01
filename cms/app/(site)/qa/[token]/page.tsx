import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { SourceQaResponder } from "./SourceQaResponder";
import { Inbox, Clock, User, ShieldCheck } from "lucide-react";
import { isAnswered } from "@/lib/validation/status";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const qa = await db.sourceQA.findUnique({ where: { token } });
  return {
    title: qa ? `Kilde-Q&A: ${qa.titel}` : "Kilde-Q&A",
    robots: { index: false, follow: false },
  };
}

export default async function SourceQaResponsePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const site = await getCurrentSite();

  const qa = await db.sourceQA.findUnique({
    where: { token },
  });

  if (!qa) {
    return (
      <div className="site-page-container" style={{ padding: "48px 0" }}>
        <div className="site-container" style={{ maxWidth: "600px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "28px" }}>Ugyldigt kilde-link</h1>
          <p style={{ color: "var(--ink-2)", marginTop: "8px" }}>
            Vi kunne ikke finde den forespurgte Q&A-session. Tjek venligst at linket er kopieret korrekt,
            eller kontakt redaktionen.
          </p>
        </div>
      </div>
    );
  }

  const questions = (qa.spoergsmaal as Array<{ id: string; text: string }>) || [];
  const existingAnswers = (qa.svar as Record<string, { choice?: string; text: string }>) || {};

  return (
    <div className="site-page-container" style={{ padding: "28px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "760px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Kilde-Q&A", href: "/qa" },
            { label: qa.titel },
          ]}
        />

        {/* Header boks */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#3730a3", marginBottom: "8px" }}>
            <Inbox size={18} />
            <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Kilde-svarside
            </span>
            <span
              style={{
                marginLeft: "auto",
                background: isAnswered("qa", qa.status) ? "#dcfce7" : "#fef3c7",
                color: isAnswered("qa", qa.status) ? "#166534" : "#92400e",
                padding: "2px 8px",
                borderRadius: "9999px",
                fontSize: "11px",
                fontWeight: "700",
              }}
            >
              {isAnswered("qa", qa.status) ? "Besvaret" : "Afventer dit svar"}
            </span>
          </div>

          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "30px", margin: "0 0 12px 0", color: "var(--ink)" }}>
            {qa.titel}
          </h1>

          {qa.baggrund && (
            <p style={{ fontSize: "15px", color: "var(--ink-2)", lineHeight: "1.5", margin: "0 0 16px 0" }}>
              {qa.baggrund}
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", paddingTop: "12px", borderTop: "1px solid var(--line)", fontSize: "13px", color: "var(--ink-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <User size={14} />
              <span>Kilde: <strong>{qa.kildeNavn || "Navn ikke angivet"}</strong> {qa.kildeRolle ? `(${qa.kildeRolle})` : ""}</span>
            </div>
            {qa.deadline && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={14} />
                <span>Deadline: <strong>{new Date(qa.deadline).toLocaleDateString("da-DK")}</strong></span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
              <ShieldCheck size={14} />
              <span>Direkte til redaktionen på {site.navn}</span>
            </div>
          </div>
        </div>

        {/* Interaktiv besvarelseskomponent */}
        <SourceQaResponder
          token={token}
          questions={questions}
          initialAnswers={existingAnswers}
          isAlreadyAnswered={isAnswered("qa", qa.status)}
        />
      </div>
    </div>
  );
}
