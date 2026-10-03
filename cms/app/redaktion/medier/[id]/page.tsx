import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { MediaEditForm } from "@/components/media/media-edit-form";
import { MediaPreview } from "@/components/media/media-preview";
import { getFreshSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { Page, PageHeader } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";

export default async function MediaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getFreshSession();
  if (!session?.user) return null;
  const { id } = await params;
  const media = await db.media.findFirst({ where: { id, instansId: session.user.instansId } });
  if (!media) notFound();
  return (
    <Page>
      <Link className="btn btn-ghost btn-sm ui-back" href="/redaktion/medier"><ChevronLeft size={16} aria-hidden="true" /> Medier</Link>
      <PageHeader
        eyebrow={`${media.filtype} · ${media.kildeType}`}
        title={media.billedtekst || media.filnavn || "Medie"}
        actions={<a className="btn btn-secondary" href={media.url} target="_blank" rel="noreferrer">Åbn original <ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (åbner i ny fane)</span></a>}
      />
      <div className="media-detail-grid">
        <Card padding="none" as="div" className="media-detail-preview">
          <MediaPreview media={media} detail />
          <dl className="media-facts">
            <div><dt>Filnavn</dt><dd>{media.filnavn || "—"}</dd></div>
            <div><dt>Format</dt><dd>{media.mimeType || media.filtype}</dd></div>
            <div><dt>Dimensioner</dt><dd>{media.bredde && media.hoejde ? `${media.bredde} × ${media.hoejde}` : "—"}</dd></div>
            <div><dt>Oprettet</dt><dd>{new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(media.createdAt)}</dd></div>
          </dl>
        </Card>
        {can(session.user, PERMISSIONS.MEDIA_MANAGE) ? <MediaEditForm media={media} /> : <Card><p>Du kan se og genbruge mediet, men din rolle kan ikke redigere metadata.</p></Card>}
      </div>
    </Page>
  );
}
