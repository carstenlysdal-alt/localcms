import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Mic, ExternalLink, Copy } from "lucide-react";
import { InterviewListClient } from "./InterviewListClient";

export default async function RedaktionInterviewPage() {
  const session = await auth();
  if (!session?.user) return null;

  const interviews = await db.interviewSession.findMany({
    where: { instansId: session.user.instansId },
    include: {
      article: { select: { id: true, titel: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Mic size={26} style={{ color: "#7c3aed" }} />
            <h1 style={{ margin: 0 }}>AI Kildeinterview</h1>
          </div>
          <p className="text-muted" style={{ marginTop: "4px" }}>
            Interaktive kildeinterviews med tale- eller tekstsvar. Gennemførte interviews transskriberes og klargøres til artikelkladde.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <a href="/interview" target="_blank" rel="noreferrer" className="btn btn-secondary">
            Se offentlig interviewportal ↗
          </a>
        </div>
      </div>

      <InterviewListClient interviews={interviews} />
    </main>
  );
}
