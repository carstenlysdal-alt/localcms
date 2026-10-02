import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Radio } from "lucide-react";
import { MeddelerListClient } from "./MeddelerListClient";
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
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Radio size={26} style={{ color: "#d97706" }} />
            <h1 style={{ margin: 0 }}>Meddeler-netværket</h1>
          </div>
          <p className="text-muted" style={{ marginTop: "4px" }}>
            Lokale kontaktpersoner, foreningssekretærer og beredskabskilder. Se registrerede meddelere og konvertér indberettede sager til artikler.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <a href="/meddeler" target="_blank" rel="noreferrer" className="btn btn-secondary">
            Se offentlig tilmelding ↗
          </a>
        </div>
      </div>

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
    </main>
  );
}
