import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Inbox } from "lucide-react";
import { CreateQaModal } from "./CreateQaModal";
import { QaListClient } from "./QaListClient";
import { Page, PageHeader } from "@/components/ui/Page";
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
    <Page>
      <PageHeader
        icon={<Inbox size={22} />}
        title="Kilde-Q&A"
        subtitle="Send skriftlige spørgsmål til kilder via et unikt link uden login. Modtag strukturerede svar og citater klar til artikeloprettelse."
        actions={<CreateQaModal />}
      />
      <QaListClient
        qas={qas.map((q) => ({
          ...q,
          // Kildekontakt og portal-link kræver SOURCE_VIEW_CONFIDENTIAL.
          token: showSources ? q.token : "",
          kildeKontakt: showSources ? q.kildeKontakt : q.kildeKontakt ? HIDDEN_CONTACT : null,
        }))}
      />
    </Page>
  );
}
