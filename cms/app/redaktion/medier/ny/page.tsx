import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MediaCreateForm } from "@/components/media/media-create-form";
import { auth } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { Page, PageHeader } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";

export default async function NewMediaPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (!can(session.user, PERMISSIONS.MEDIA_MANAGE)) {
    return (
      <Page width="narrow">
        <Card tone="warn" title="Ingen adgang" headingLevel={1}>
          <div role="alert" className="ui-stack ui-gap-md">
            <p className="ui-section-text">Din rolle kan se og genbruge medier, men ikke tilføje nye.</p>
            <div><Link className="btn btn-secondary" href="/redaktion/medier">Til biblioteket</Link></div>
          </div>
        </Card>
      </Page>
    );
  }
  return (
    <Page width="narrow">
      <Link className="btn btn-ghost btn-sm ui-back" href="/redaktion/medier"><ChevronLeft size={16} aria-hidden="true" /> Medier</Link>
      <PageHeader title="Tilføj medie" subtitle="Upload en fil eller registrér et eksternt medie." />
      <MediaCreateForm />
    </Page>
  );
}
