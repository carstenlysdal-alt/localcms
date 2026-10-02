import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SubscriberList } from "@/components/admin/SubscriberList";
import { Mail } from "lucide-react";
import { NoAccess } from "@/components/admin/no-access";
import { PAGE_PERMISSIONS } from "@/lib/redaktion-access";

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
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Mail size={26} style={{ color: "var(--color-primary, #9E3D1B)" }} />
            <h1 style={{ margin: 0 }}>Nyhedsbrev & Modtagere</h1>
          </div>
          <p className="text-muted" style={{ marginTop: "4px" }}>
            First-party nyhedsbrevsabonnenter (P-16, A-08). Administrér modtagerlisten, se lokale præferencer og eksportér data i rent Excel-format.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <a
            href="/nyhedsbrev"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: "13px" }}
          >
            Se tilmeldingsside ↗
          </a>
        </div>
      </div>

      <SubscriberList subscribers={subscribers} areas={areas} />
    </main>
  );
}
