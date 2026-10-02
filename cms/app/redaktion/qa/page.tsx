import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Inbox, Plus, ExternalLink, Copy } from "lucide-react";
import { CreateQaModal } from "./CreateQaModal";
import { QaListClient } from "./QaListClient";
import { NoAccess } from "@/components/admin/no-access";
import { PAGE_PERMISSIONS, canViewSourceDetails, HIDDEN_CONTACT } from "@/lib/redaktion-access";

export default async function RedaktionQaPage() {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.qa]);
  if (!user) return <NoAccess area="kilde-Q&A" />;
  const showSources = canViewSourceDetails(user);

  const qas = await db.sourceQA.findMany({
    where: { instansId: user.instansId },
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

      <QaListClient
        qas={qas.map((q) => ({
          ...q,
          // Kildekontakt og portal-link kræver SOURCE_VIEW_CONFIDENTIAL.
          token: showSources ? q.token : "",
          kildeKontakt: showSources ? q.kildeKontakt : q.kildeKontakt ? HIDDEN_CONTACT : null,
        }))}
      />
    </main>
  );
}
