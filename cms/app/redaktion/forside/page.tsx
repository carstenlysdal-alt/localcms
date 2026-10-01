import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { getActiveFrontpagePlacements, calculateSupportedContentQuota } from "@/lib/frontpage-governance";
import { getFrontpageData } from "@/lib/site-queries";
import { FrontpageManager } from "@/components/admin/FrontpageManager";
import { LayoutTemplate } from "lucide-react";
import Link from "next/link";

export default async function ForsideAdminPage() {
  const session = await auth();
  if (!session?.user) return null;

  if (!can(session.user, PERMISSIONS.FRONTPAGE_EDIT)) {
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

  const instansId = session.user.instansId;

  const [rawPlacements, quota, articles, frontpageData] = await Promise.all([
    getActiveFrontpagePlacements(instansId),
    calculateSupportedContentQuota(instansId),
    db.article.findMany({
      where: { instansId, status: "Publiceret" },
      include: { kategori: { include: { parent: true } } },
      orderBy: { publiceretTid: "desc" },
      take: 60,
    }),
    getFrontpageData(instansId),
  ]);

  const placements = rawPlacements.map((p) => ({
    id: p.id,
    zone: p.zone,
    position: p.position,
    udloebTid: p.udloebTid,
    article: {
      id: p.article.id,
      titel: p.article.titel,
      indholdstype: p.article.indholdstype,
      sektionNavn: p.article.kategori?.navn || "Nyheder",
    },
  }));

  const availableArticles = articles.map((a) => ({
    id: a.id,
    titel: a.titel,
    indholdstype: a.indholdstype,
    sektionNavn: a.kategori?.navn || "Nyheder",
  }));

  const algorithmicTop = {
    tophistorie: frontpageData.tophistorie
      ? {
          id: frontpageData.tophistorie.id,
          titel: frontpageData.tophistorie.titel,
          score: 100,
        }
      : null,
    sekundaere: frontpageData.topSekundaere.map((s) => ({
      id: s.id,
      titel: s.titel,
      score: 85,
    })),
  };

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <h1>Forsidestyring & Zoner</h1>
          <p className="text-muted">
            Styr placeringer på forsiden, fastgør historier med udløb og overvåg kvoteloftet
          </p>
        </div>
        <div>
          <a
            href="/"
            target="_blank"
            className="btn btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <LayoutTemplate size={16} /> Åbn Live Forside
          </a>
        </div>
      </div>

      <FrontpageManager
        placements={placements}
        availableArticles={availableArticles}
        algorithmicTop={algorithmicTop}
        quota={quota}
      />
    </main>
  );
}
