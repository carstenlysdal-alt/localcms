import Link from "next/link";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { getActiveFrontpagePlacements, calculateSupportedContentQuota } from "@/lib/frontpage-governance";
import { getFrontpageData } from "@/lib/site-queries";
import { FrontpageManager } from "@/components/admin/FrontpageManager";
import { ForsideEditor } from "./_components/ForsideEditor";
import { loadEditorData } from "./_lib/loaders";

export const metadata = { title: "Forsideeditor" };
export const dynamic = "force-dynamic";

export default async function ForsideAdminPage() {
  // Rettigheder læses fra databasen (ikke kun JWT). Mindst én forsideretighed kræves.
  const user = await getAuthorizedUser([PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE]);
  if (!user) {
    return (
      <main className="admin-main">
        <div className="dialog inline-dialog">
          <h1 className="dialog-title">Ingen adgang</h1>
          <p className="dialog-body">Din rolle har ikke rettighed til forsidestyring.</p>
          <Link className="btn btn-secondary" href="/redaktion/artikler">
            Tilbage til artikler
          </Link>
        </div>
      </main>
    );
  }

  const instansId = user.instansId;
  const instance = await db.instance.findUnique({ where: { id: instansId }, select: { id: true, navn: true } });
  const site = { id: instansId, navn: instance?.navn ?? "", kommune: (instance?.navn ?? "").replace(/Lokalt$/i, "") };
  const data = await loadEditorData(user, site);

  // De eksisterende fastgørelsesværktøjer (zoner med udløb + kvoteloft) bevares i fanen "Fastgør".
  const [rawPlacements, quota, articles, frontpageData] = await Promise.all([
    getActiveFrontpagePlacements(instansId),
    calculateSupportedContentQuota(instansId),
    db.article.findMany({ where: { instansId, status: "Publiceret" }, include: { kategori: { include: { parent: true } } }, orderBy: { publiceretTid: "desc" }, take: 60 }),
    getFrontpageData(instansId),
  ]);
  const placements = rawPlacements.map((p) => ({
    id: p.id,
    zone: p.zone,
    position: p.position,
    udloebTid: p.udloebTid,
    article: { id: p.article.id, titel: p.article.titel, indholdstype: p.article.indholdstype, sektionNavn: p.article.kategori?.navn || "Nyheder" },
  }));
  const availableArticles = articles.map((a) => ({ id: a.id, titel: a.titel, indholdstype: a.indholdstype, sektionNavn: a.kategori?.navn || "Nyheder" }));
  const algorithmicTop = {
    tophistorie: frontpageData.tophistorie ? { id: frontpageData.tophistorie.id, titel: frontpageData.tophistorie.titel, score: 100 } : null,
    sekundaere: frontpageData.topSekundaere.map((s) => ({ id: s.id, titel: s.titel, score: 85 })),
  };

  return (
    <main className="admin-main fpe-main">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Forsiden · {site.navn}</span>
          <h1>Forsideeditor</h1>
          <p className="text-muted">Sammensæt forsiden af moduler, lad AI foreslå, og godkend selv, hvad der går live.</p>
        </div>
      </div>
      <ForsideEditor
        data={data}
        legacy={
          <section className="fpe-panel">
            <h3 className="fpe-h3">Fastgør artikler til zoner</h3>
            <p className="fpe-muted">Fastgørelser med udløb (48 timer) vinder over rangering og AI i forslagene.</p>
            <FrontpageManager placements={placements} availableArticles={availableArticles} algorithmicTop={algorithmicTop} quota={quota} />
          </section>
        }
      />
    </main>
  );
}
