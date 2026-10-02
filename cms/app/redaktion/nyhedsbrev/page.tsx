import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SubscriberList } from "@/components/admin/SubscriberList";
import { ExternalLink, Mail } from "lucide-react";
import { NoAccess } from "@/components/admin/no-access";
import { PAGE_PERMISSIONS } from "@/lib/redaktion-access";
import { Page, PageHeader } from "@/components/ui/Page";

export default async function RedaktionNyhedsbrevPage() {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.nyhedsbrev]);
  if (!user) return <NoAccess area="nyhedsbrevets modtagerliste" />;

  const subscribers = await db.newsletterSubscriber.findMany({
    where: { instansId: user.instansId },
    orderBy: { createdAt: "desc" },
  });

  const areas = await db.geoTag.findMany({
    where: { instansId: user.instansId },
    orderBy: { navn: "asc" },
    select: { slug: true, navn: true },
  });

  return (
    <Page>
      <PageHeader
        icon={<Mail size={22} />}
        title="Nyhedsbrev"
        subtitle="First-party nyhedsbrevsabonnenter. Administrér modtagerlisten, se lokale præferencer og eksportér data som CSV til Excel."
        actions={
          <a href="/nyhedsbrev" target="_blank" rel="noreferrer" className="btn btn-secondary">
            Se tilmeldingsside <ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (åbner i ny fane)</span>
          </a>
        }
      />
      <SubscriberList subscribers={subscribers} areas={areas} />
    </Page>
  );
}
