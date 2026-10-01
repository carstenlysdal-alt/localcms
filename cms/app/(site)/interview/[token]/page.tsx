import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { InterviewRunner } from "./InterviewRunner";
import { Mic, User, ShieldCheck } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const interview = await db.interviewSession.findUnique({ where: { token } });
  return {
    title: interview ? `Kildeinterview: ${interview.titel}` : "Kildeinterview",
    robots: { index: false, follow: false },
  };
}

export default async function InterviewRunPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const site = await getCurrentSite();

  const interview = await db.interviewSession.findUnique({
    where: { token },
  });

  if (!interview) {
    return (
      <div className="site-page-container" style={{ padding: "48px 0" }}>
        <div className="site-container" style={{ maxWidth: "600px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "28px" }}>Interview ikke fundet</h1>
          <p style={{ color: "var(--ink-2)", marginTop: "8px" }}>
            Vi kunne ikke finde interviewet med den angivne kode. Tjek venligst dit link.
          </p>
        </div>
      </div>
    );
  }

  const questions = (interview.spoergsmaal as Array<{ id: string; text: string }>) || [];
  const existingAnswers = (interview.svar as Record<string, { text: string; audioUrl?: string }>) || {};

  return (
    <div className="site-page-container" style={{ padding: "28px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "760px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "AI Kildeinterview", href: "/interview" },
            { label: interview.titel },
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#5b21b6", marginBottom: "8px" }}>
            <Mic size={18} />
            <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Aktivt kildeinterview
            </span>
            <span
              style={{
                marginLeft: "auto",
                background: interview.status === "GENNEMFOERT" ? "#dcfce7" : "#ede9fe",
                color: interview.status === "GENNEMFOERT" ? "#166534" : "#5b21b6",
                padding: "2px 8px",
                borderRadius: "9999px",
                fontSize: "11px",
                fontWeight: "700",
              }}
            >
              {interview.status === "GENNEMFOERT" ? "Gennemført" : "I gang"}
            </span>
          </div>

          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "30px", margin: "0 0 12px 0", color: "var(--ink)" }}>
            {interview.titel}
          </h1>

          <p style={{ fontSize: "15px", color: "var(--ink-2)", lineHeight: "1.5", margin: "0 0 16px 0" }}>
            Emne: <strong>{interview.emne}</strong> {interview.formaal ? `· Formål: ${interview.formaal}` : ""}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", paddingTop: "12px", borderTop: "1px solid var(--line)", fontSize: "13px", color: "var(--ink-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <User size={14} />
              <span>Kilde: <strong>{interview.kildeNavn}</strong> {interview.kildeRolle ? `(${interview.kildeRolle})` : ""}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
              <ShieldCheck size={14} />
              <span>{site.navn} · Citatgodkendelse gælder</span>
            </div>
          </div>
        </div>

        {/* Runner */}
        <InterviewRunner
          token={token}
          questions={questions}
          initialAnswers={existingAnswers}
          isCompleted={interview.status === "GENNEMFOERT"}
        />
      </div>
    </div>
  );
}
