import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Clock, Eye, Flame, ShieldAlert, Sparkles, TrendingUp, CheckCircle2, Compass } from "lucide-react";
import Link from "next/link";
import { distributeArticles, ArticleDistributionInput } from "@/lib/distribution-engine";
import { NoAccess } from "@/components/admin/no-access";
import { PAGE_PERMISSIONS } from "@/lib/redaktion-access";

export default async function MetrikkerPage() {
  const user = await getAuthorizedUser([...PAGE_PERMISSIONS.metrikker]);
  if (!user) return <NoAccess area="metrikker" />;

  const instansId = user.instansId;

  // 1. Hent alle artikler med metrics og relationer
  const articles = await db.article.findMany({
    where: {
      instansId,
      status: "Publiceret",
    },
    include: {
      metric: true,
      kategori: { include: { parent: true } },
      forfatter: true,
      geoTags: true,
    },
    orderBy: {
      publiceretTid: "desc",
    },
  });

  // 2. Beregn aggregerede statistikker
  const distributionInputs: ArticleDistributionInput[] = articles.map((art) => {
    const v = art.metric?.visninger ?? 0;
    const l = art.metric?.laesninger ?? 0;
    const s = art.metric?.totalLaesetidSek ?? 0;

    const sektionSlug = art.kategori?.parent?.slug || art.kategori?.slug || "nyheder";
    const omraadeSlug = art.geoTags?.[0]?.slug || null;

    return {
      id: art.id,
      titel: art.titel,
      publiceretTid: art.publiceretTid ?? art.createdAt,
      indholdstype: art.indholdstype as ArticleDistributionInput["indholdstype"],
      breaking: art.breaking,
      pinned: art.pinned,
      sektionSlug,
      omraadeSlug,
      visninger: v,
      laesninger: l,
      totalLaesetidSek: s,
      kategoriNavn: art.kategori?.navn || "Generelt",
      omraadeNavn: art.geoTags?.[0]?.navn || null,
      forfatterNavn: art.forfatter?.navn || "Redaktionen",
    };
  });

  const totalVisninger = distributionInputs.reduce((sum, a) => sum + a.visninger, 0);
  const totalLaesninger = distributionInputs.reduce((sum, a) => sum + a.laesninger, 0);
  const totalSekunder = distributionInputs.reduce((sum, a) => sum + a.totalLaesetidSek, 0);

  const totalTimer = Math.round((totalSekunder / 3600) * 10) / 10;
  const gnsGennemlaesningPct = totalVisninger > 0 ? Math.round((totalLaesninger / totalVisninger) * 100) : 0;
  const gnsLaesetidSek = totalLaesninger > 0 ? Math.round(totalSekunder / totalLaesninger) : 0;

  // 3. Kør distributionsmotoren
  const distribution = distributeArticles(distributionInputs, 25);
  const currentHour = new Date().getHours();

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <h1>Performance & Metrikker</h1>
          <p className="text-muted">
            First-party privatlivssikker læseradfærd og algoritmisk fordelingsstatus
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <span className="tag tag-success" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <CheckCircle2 size={14} /> Cookiefri First-Party
          </span>
        </div>
      </div>

      {/* Nøgletalskort */}
      <div className="honor-summary" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <article className="card">
          <Clock size={22} style={{ color: "#BF6415" }} />
          <span>Samlet læsetid</span>
          <strong>{totalTimer} timer</strong>
        </article>

        <article className="card">
          <Eye size={22} style={{ color: "#2563EB" }} />
          <span>Total visninger</span>
          <strong>{totalVisninger.toLocaleString("da-DK")}</strong>
        </article>

        <article className="card">
          <TrendingUp size={22} style={{ color: "#059669" }} />
          <span>Gennemlæsningsrate</span>
          <strong>{gnsGennemlaesningPct} %</strong>
        </article>

        <article className="card">
          <Compass size={22} style={{ color: "#7C3AED" }} />
          <span>Gns. læsetid</span>
          <strong>{Math.floor(gnsLaesetidSek / 60)}m {gnsLaesetidSek % 60}s</strong>
        </article>

        <article className="card" style={{ borderColor: distribution.quotaAlert ? "#DC2626" : undefined }}>
          <ShieldAlert size={22} style={{ color: distribution.quotaAlert ? "#DC2626" : "#4B5563" }} />
          <span>Kvoteloft i topzonen</span>
          <strong style={{ color: distribution.quotaAlert ? "#DC2626" : "inherit" }}>
            {distribution.commercialRatioPercent} % / 25 %
          </strong>
        </article>
      </div>

      {/* Algoritmisk Fordelingsstatus lige nu */}
      <div className="card" style={{ marginTop: "24px", marginBottom: "24px", background: "var(--card-bg, #fff)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={18} style={{ color: "#D97706" }} /> 
              Algoritmisk Forsideplacering (Live Simulering)
            </h2>
            <p className="text-muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
              Beregnet ud fra redaktionelt veto + decay + læser-velocity + døgnrytme (kl. {currentHour}:00)
            </p>
          </div>
          {distribution.quotaAlert && (
            <span className="tag tag-warn" style={{ color: "#DC2626", borderColor: "#DC2626" }}>
              Advarsel: Kvoteloft overskredet
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px" }}>
          {/* Tophistorie udpeget af algoritmen */}
          <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              #1 Automatisk Tophistorie
            </span>
            {distribution.topArticle ? (
              <div style={{ marginTop: "8px" }}>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 6px" }}>
                  {distribution.topArticle.titel}
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "0.8rem" }}>
                  <span className="tag">{distribution.topArticle.sektionSlug}</span>
                  {distribution.topArticle.omraadeSlug && <span className="tag">{distribution.topArticle.omraadeSlug}</span>}
                  <span className="tag tag-success" style={{ fontWeight: 700 }}>
                    Score: {distribution.topArticle.scoreResult.totalScore}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted">Ingen artikler kvalificeret</p>
            )}
          </div>

          {/* Sekundære historier */}
          <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              #2 - #4 Sekundære Tophistorier
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              {distribution.secondaryArticles.map((art, idx) => (
                <div key={art.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem" }}>
                  <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "420px" }}>
                    {idx + 2}. {art.titel}
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span className="tag" style={{ fontSize: "0.75rem" }}>{art.sektionSlug}</span>
                    <span className="tag tag-success" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                      {art.scoreResult.totalScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Performer Tabel */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Artikel & Sektion</th>
              <th>Område</th>
              <th>Type</th>
              <th>Visninger</th>
              <th>Læsninger</th>
              <th>Læsetid</th>
              <th>Fordelingsscore</th>
              <th>Handling</th>
            </tr>
          </thead>
          <tbody>
            {distribution.ranked.map((art) => {
              const res = art.scoreResult;
              const readPct = art.visninger > 0 ? Math.round((art.laesninger / art.visninger) * 100) : 0;
              const avgSec = art.laesninger > 0 ? Math.round(art.totalLaesetidSek / art.laesninger) : 0;

              return (
                <tr key={art.id}>
                  <td>
                    <strong>{art.titel}</strong>
                    <div style={{ display: "flex", gap: "6px", marginTop: "4px", fontSize: "0.75rem" }}>
                      <span className="text-muted">{art.kategoriNavn}</span>
                      <span className="text-muted">•</span>
                      <span className="text-muted">{art.forfatterNavn}</span>
                    </div>
                  </td>
                  <td>
                    {art.omraadeNavn ? (
                      <span className="tag">{art.omraadeNavn}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`tag ${art.indholdstype === "Sponsoreret" ? "tag-warn" : art.indholdstype === "Partner" ? "tag-warn" : ""}`}>
                      {art.indholdstype}
                    </span>
                  </td>
                  <td>
                    <strong>{art.visninger.toLocaleString("da-DK")}</strong>
                  </td>
                  <td>
                    <span>{art.laesninger.toLocaleString("da-DK")}</span>
                    <small className="table-subtitle">{readPct} % gennemført</small>
                  </td>
                  <td>
                    <span>{Math.floor(avgSec / 60)}m {avgSec % 60}s</span>
                    <small className="table-subtitle">gns. opmærksomhed</small>
                  </td>
                  <td>
                    <span
                      className="tag tag-success"
                      style={{
                        fontWeight: 700,
                        background: res.totalScore > 100 ? "#ecfdf5" : undefined,
                        color: res.totalScore > 100 ? "#047857" : undefined,
                      }}
                    >
                      <Flame size={12} style={{ display: "inline", marginRight: "3px" }} />
                      {res.totalScore}
                    </span>
                    <small className="table-subtitle">
                      decay: {Math.round(res.decayMultiplier * 100)}% {res.daypartBonus > 0 ? `• +${res.daypartBonus} daypart` : ""}
                    </small>
                  </td>
                  <td>
                    <Link
                      href={`/redaktion/artikler/${art.id}`}
                      className="btn btn-secondary"
                      style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                    >
                      Redigér
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!distribution.ranked.length && (
          <div className="empty-state">
            Ingen publicerede artikler fundet.
          </div>
        )}
      </div>
    </main>
  );
}
