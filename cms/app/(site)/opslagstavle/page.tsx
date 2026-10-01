import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import { isGateOpen } from "@/lib/seo/page-state";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { getArticlesByTagSlugs, BOARD_TAG_SLUGS } from "@/lib/site-frontpage";
import { MessageSquare, Plus, MapPin, ShieldCheck, User } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/opslagstavle", (site) => ({
    title: "Den lokale opslagstavle",
    description: `Fællesskabets opslagstavle for ${site.kommune}: frivillige søges, foreningsnyt, efterlysninger og lokale initiativer.`,
  }), { noindex: async (site) => !(await isGateOpen("board", site.id)) });
}

/**
 * Opslagstavlen er pr. by. Opslag er publicerede artikler mærket "opslagstavle"/"opslag" for netop denne by.
 * Uden data vises en ærlig tom-tilstand med link til /indsend.
 */
export default async function OpslagstavlePage() {
  const site = await getCurrentSite();
  const posts = await getArticlesByTagSlugs(site.id, BOARD_TAG_SLUGS, 30);

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "880px" }}>
        <Breadcrumbs items={[{ label: "Forside", href: "/" }, { label: "Opslagstavlen" }]} />

        <header className="opslag-header">
          <div className="opslag-header-top">
            <div className="opslag-badge">
              <MessageSquare size={14} />
              <span>BORGERTAVLEN I {site.kommune.toUpperCase()}</span>
            </div>

            <Link href="/indsend?kategori=opslagstavle" className="opslag-submit-btn">
              <Plus size={16} />
              <span>Opret opslag på tavlen</span>
            </Link>
          </div>

          <h1 className="opslag-title">Opslagstavlen i {site.kommune}</h1>
          <p className="opslag-desc">
            Lokalsamfundets fælles opslagstavle. Her kan borgere, foreninger, bylaug og klubber efterlyse, informere, finde
            frivillige hænder eller dele gode lokale initiativer.
          </p>
        </header>

        {posts.length > 0 ? (
          <div className="opslag-grid">
            {posts.map((post) => (
              <article key={post.id} className="opslag-card">
                <div className="opslag-card-top">
                  <span className="opslag-card-category">{post.undersektion?.navn ?? post.sektion.navn}</span>
                  {post.omraade && (
                    <div className="opslag-card-location">
                      <MapPin size={12} />
                      <Link href={`/omraade/${post.omraade.slug}`}>{post.omraade.navn}</Link>
                    </div>
                  )}
                </div>

                <h2 className="opslag-card-title">
                  <Link href={post.href}>{post.titel}</Link>
                </h2>
                {post.manchet && <p className="opslag-card-desc">{post.manchet}</p>}

                <div className="opslag-card-footer">
                  <div className="opslag-card-author">
                    <User size={13} />
                    <span>{post.forfatter?.navn ?? site.navn}</span>
                    <span className="opslag-card-dot">·</span>
                    <span className="opslag-card-time">
                      {new Date(post.publiceretTid).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="kalender-cta-box" aria-label="Ingen opslag endnu">
            <div className="kalender-cta-content">
              <h2 className="kalender-cta-title">Der er endnu ingen opslag på tavlen i {site.kommune}</h2>
              <p className="kalender-cta-text">
                Skal din forening have frivillige, har du mistet noget, eller har du en idé til nabolaget? Send dit opslag til
                redaktionen, så kommer det på tavlen, når det er gennemgået.
              </p>
            </div>
            <Link href="/indsend?kategori=opslagstavle" className="kalender-submit-btn-large">
              <Plus size={16} />
              <span>Opret opslag</span>
            </Link>
          </section>
        )}

        <div className="opslag-info-box">
          <ShieldCheck size={20} className="opslag-info-icon" />
          <div className="opslag-info-text">
            <strong>Et trygt og lokalt fællesskab:</strong> Alle opslag gennemgås af redaktionen for at sikre en god tone og
            modvirke spam. Opslagstavlen er gratis for borgere og almennyttige foreninger.
          </div>
        </div>
      </div>
    </div>
  );
}
