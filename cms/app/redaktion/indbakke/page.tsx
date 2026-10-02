import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnifiedIntakeInbox, type IntakeItem } from "@/components/admin/UnifiedIntakeInbox";
import { Inbox, ExternalLink } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { isNewIntakeStatus } from "@/lib/validation/status";
import { NoAccess } from "@/components/admin/no-access";
import { PAGE_PERMISSIONS, canViewPartnerBriefs, canViewSourceDetails, HIDDEN_CONTACT } from "@/lib/redaktion-access";

export default async function RedaktionIndbakkePage() {
  // Rettighed slås op i databasen (ikke JWT'en). Layoutet kræver kun login.
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.indbakke]);
  if (!user) return <NoAccess area="den redaktionelle indbakke" />;

  const instansId = user.instansId;
  // Kildekontakter og portal-links kræver SOURCE_VIEW_CONFIDENTIAL; partnerbriefs kræver salgs-/supportrettighed.
  const showSources = canViewSourceDetails(user);
  const showPartners = canViewPartnerBriefs(user);
  const contact = (value: string | null | undefined) => (showSources ? value : value ? HIDDEN_CONTACT : value);
  const tokenOf = <T,>(value: T) => (showSources ? value : undefined);

  // Hent alle 5 kilder sideløbende
  const [qas, interviews, sponsorBriefs, meddelerSager, submissions] = await Promise.all([
    db.sourceQA.findMany({
      where: { instansId },
      include: { article: { select: { id: true, titel: true, slug: true, status: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.interviewSession.findMany({
      where: { instansId },
      include: { article: { select: { id: true, titel: true, slug: true, status: true } } },
      orderBy: { createdAt: "desc" },
    }),
    showPartners ? db.sponsorBrief.findMany({
      where: { instansId },
      include: { article: { select: { id: true, titel: true, slug: true, status: true } } },
      orderBy: { createdAt: "desc" },
    }) : Promise.resolve([]),
    db.meddelerSag.findMany({
      where: { instansId },
      include: {
        meddeler: true,
        article: { select: { id: true, titel: true, slug: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.submission.findMany({
      where: { instansId },
      include: {
        omraade: { select: { id: true, navn: true } },
        article: { select: { id: true, titel: true, slug: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Transformér til en samlet liste
  const items: IntakeItem[] = [
    ...qas.map((q) => ({
      id: q.id,
      channel: "qa" as const,
      title: q.titel,
      senderName: q.kildeNavn || "Ukendt kilde",
      senderContact: contact(q.kildeKontakt),
      senderRole: q.kildeRolle,
      status: q.status,
      createdAt: q.createdAt,
      summary: q.aiOpsummering || q.baggrund || q.emne,
      token: tokenOf(q.token),
      articleId: q.articleId,
      article: q.article,
      details: {
        emne: q.emne,
        baggrund: q.baggrund,
        spørgsmål: q.spoergsmaal,
        svar: q.svar,
        citater: q.citater,
      },
    })),
    ...interviews.map((i) => ({
      id: i.id,
      channel: "interview" as const,
      title: i.titel,
      senderName: i.kildeNavn,
      senderContact: contact(i.kildeKontakt),
      senderRole: i.kildeRolle,
      status: i.status,
      createdAt: i.createdAt,
      summary: i.aiOpsummering || `Interview om ${i.emne}`,
      token: tokenOf(i.token),
      articleId: i.articleId,
      article: i.article,
      details: {
        emne: i.emne,
        formaal: i.formaal,
        transskription: i.transskription,
        citater: i.citater,
        svar: i.svar,
      },
    })),
    ...sponsorBriefs.map((s) => ({
      id: s.id,
      channel: "sponsor" as const,
      title: `${s.partnerNavn} (${s.format})`,
      senderName: s.kontaktNavn,
      senderContact: s.kontaktEmail,
      senderRole: s.partnerNavn,
      status: s.status,
      createdAt: s.createdAt,
      summary: (s.briefData as Record<string, string>)?.budskab || `Partnerbrief for ${s.partnerNavn}`,
      token: s.token,
      articleId: s.articleId,
      article: s.article,
      details: {
        pakke: s.pakkeNavn,
        format: s.format,
        briefData: s.briefData,
        citater: s.citater,
        reviewItems: s.reviewItems,
      },
    })),
    ...meddelerSager.map((m) => ({
      id: m.id,
      channel: "meddeler" as const,
      title: m.titel,
      senderName: m.meddeler?.navn || "Lokal meddeler",
      senderContact: contact(m.meddeler?.kontakt),
      senderRole: m.meddeler?.organisation || m.kategori,
      status: m.status,
      createdAt: m.createdAt,
      summary: m.tekst.length > 140 ? `${m.tekst.slice(0, 140)}...` : m.tekst,
      token: tokenOf(m.meddeler?.token),
      articleId: m.articleId,
      article: m.article,
      details: {
        kategori: m.kategori,
        tekst: m.tekst,
        struktureret: m.struktureret,
        opfoelgning: m.opfoelgning,
      },
    })),
    ...submissions.map((sub) => ({
      id: sub.id,
      channel: "submission" as const,
      title: sub.emne,
      senderName: sub.navn,
      senderContact: contact(sub.kontakt),
      senderRole: sub.omraade?.navn || "Borger",
      status: sub.status,
      createdAt: sub.createdAt,
      summary: sub.tekst.length > 140 ? `${sub.tekst.slice(0, 140)}...` : sub.tekst,
      articleId: sub.articleId,
      article: sub.article,
      details: {
        tekst: sub.tekst,
        omraade: sub.omraade?.navn,
        noter: sub.noter,
      },
    })),
  ];

  // Sorter efter oprettelsesdato nyeste først
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const nyCount = items.filter(
    (i) => isNewIntakeStatus(i.status)
  ).length;

  return (
    <Page>
      <PageHeader
        icon={<Inbox size={22} />}
        title="Indbakke"
        badge={nyCount > 0 ? <Badge tone="info" dot>{nyCount} {nyCount === 1 ? "ny henvendelse" : "nye henvendelser"}</Badge> : undefined}
        subtitle="Samlet gennemstrømning af kilde-Q&A, interviews, partner-briefs, meddeler-sager og borgerindlæg. Konvertér til artikler med ét klik, med korrekte indholdstyper og deklarationer."
        actions={
          <a href="/qa" target="_blank" rel="noreferrer" className="btn btn-secondary">
            Se kilde-portaler <ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (åbner i ny fane)</span>
          </a>
        }
      />
      <UnifiedIntakeInbox items={items} />
    </Page>
  );
}
