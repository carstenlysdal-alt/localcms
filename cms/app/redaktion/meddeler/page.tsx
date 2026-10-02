import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ExternalLink, Radio } from "lucide-react";
import { MeddelerListClient } from "./MeddelerListClient";
import { Page, PageHeader } from "@/components/ui/Page";
import { NoAccess } from "@/components/admin/no-access";
import { PAGE_PERMISSIONS, canViewSourceDetails, HIDDEN_CONTACT } from "@/lib/redaktion-access";

export default async function RedaktionMeddelerPage() {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.meddeler]);
  if (!user) return <NoAccess area="meddeler-netværket" />;
  const showSources = canViewSourceDetails(user);

  const [meddelere, sager] = await Promise.all([
    db.meddelerProfile.findMany({
      where: { instansId: user.instansId },
      include: {
        _count: { select: { sager: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.meddelerSag.findMany({
      where: { instansId: user.instansId },
      include: {
        meddeler: true,
        article: { select: { id: true, titel: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <Page>
      <PageHeader
        icon={<Radio size={22} />}
        title="Meddeler-netværket"
        subtitle="Lokale kontaktpersoner, foreningssekretærer og beredskabskilder. Se registrerede meddelere og konvertér indberettede sager til artikler."
        actions={
          <a href="/meddeler" target="_blank" rel="noreferrer" className="btn btn-secondary">
            Se offentlig tilmelding <ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (åbner i ny fane)</span>
          </a>
        }
      />
      <MeddelerListClient
        meddelere={meddelere.map((m) => (showSources ? m : {
          // Uden SOURCE_VIEW_CONFIDENTIAL sendes kontaktoplysninger og portal-link aldrig til klienten (heller ikke skjult i UI).
          ...m,
          token: "",
          kontakt: HIDDEN_CONTACT,
          phone: m.phone ? HIDDEN_CONTACT : null,
          telefon: null,
          noter: null,
        }))}
        sager={sager.map((s) => (showSources ? s : { ...s, meddeler: { id: s.meddeler.id, navn: s.meddeler.navn, organisation: s.meddeler.organisation, kontakt: HIDDEN_CONTACT } as typeof s.meddeler }))}
      />
    </Page>
  );
}
