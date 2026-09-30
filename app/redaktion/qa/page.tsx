import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Inbox, Plus, ExternalLink, Copy } from "lucide-react";
import { CreateQaModal } from "./CreateQaModal";
import { QaListClient } from "./QaListClient";

export default async function RedaktionQaPage() {
  const session = await auth();
  if (!session?.user) return null;

  const qas = await db.sourceQA.findMany({
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
            <Inbox size={26} style={{ color: "var(--color-primary, #9E3D1B)" }} />
            <h1 style={{ margin: 0 }}>Kilde-Q&A</h1>
          </div>
          <p className="text-muted" style={{ marginTop: "4px" }}>
            Send skriftlige spørgsmål til kilder via et unikt link uden login. Modtag strukturerede svar og citater klar til artikeloprettelse.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <CreateQaModal />
        </div>
      </div>

      <QaListClient qas={qas} />
    </main>
  );
}
