import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SubmissionInbox } from "@/components/admin/SubmissionInbox";
import { Inbox, MessageSquarePlus } from "lucide-react";

export default async function RedaktionIndbakkePage() {
  const session = await auth();
  if (!session?.user) return null;

  const submissions = await db.submission.findMany({
    where: { instansId: session.user.instansId },
    include: {
      omraade: { select: { id: true, navn: true } },
      article: { select: { id: true, titel: true, slug: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const nyCount = submissions.filter((s) => s.status === "Ny").length;

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Inbox size={26} style={{ color: "var(--color-primary, #9E3D1B)" }} />
            <h1 style={{ margin: 0 }}>Redaktionel Indbakke</h1>
            {nyCount > 0 && (
              <span
                style={{
                  background: "#EFF6FF",
                  color: "#1D4ED8",
                  border: "1px solid #BFDBFE",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: "700",
                }}
              >
                {nyCount} nye forslag
              </span>
            )}
          </div>
          <p className="text-muted" style={{ marginTop: "4px" }}>
            Brugerindsendte historieforslag, tips og læserbreve (CMS-07, Spor A). Gennemgå, tag stilling og konvertér til artikler med ét klik.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <a
            href="/indsend"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: "13px" }}
          >
            <MessageSquarePlus size={14} /> Se offentlig formular ↗
          </a>
        </div>
      </div>

      <SubmissionInbox submissions={submissions} />
    </main>
  );
}
