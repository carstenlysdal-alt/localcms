import Link from "next/link";
import { MessageSquare, Plus, ArrowRight, MapPin, User } from "lucide-react";
import type { PublicArticleSummary } from "@/lib/site-queries";

interface CommunityBoardBlockProps {
  siteNavn: string;
  kommuneNavn: string;
  /** Rigtige opslag/borgerindsendte historier for netop denne by. Tom liste giver en ærlig tom-tilstand. */
  posts?: PublicArticleSummary[];
}

export function CommunityBoardBlock({ siteNavn, kommuneNavn, posts = [] }: CommunityBoardBlockProps) {
  return (
    <section className="community-board-section" aria-label="Den lokale opslagstavle">
      <div className="community-board-inner">
        <div className="community-board-header">
          <div>
            <div className="community-board-badge">
              <MessageSquare size={13} />
              <span>FÆLLESSKABETS OPSLAGSTAVLE</span>
            </div>
            <h2 className="community-board-title">Den Lokale Opslagstavle</h2>
            <p className="community-board-desc">
              Har din forening brug for frivillige hænder, har du mistet noget, eller planlægger I en vejfest i nabolaget?
              Del det gratis med hele {kommuneNavn}.
            </p>
          </div>

          <div className="community-board-header-actions">
            <Link href="/indsend?kategori=opslagstavle" className="community-board-btn-create">
              <Plus size={15} />
              <span>Opret opslag på tavlen</span>
            </Link>
            <Link href="/opslagstavle" className="community-board-btn-view">
              <span>Se opslagstavlen</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {posts.length > 0 ? (
          <div className="community-board-grid">
            {posts.map((post) => (
              <Link key={post.id} href={post.href} className="community-board-card">
                <div className="community-board-card-top">
                  <span className="community-board-card-cat">{post.undersektion?.navn ?? post.sektion.navn}</span>
                  {post.omraade && (
                    <span className="community-board-card-area">
                      <MapPin size={12} />
                      {post.omraade.navn}
                    </span>
                  )}
                </div>
                <h3 className="community-board-card-title">{post.titel}</h3>
                {post.manchet && <p className="community-board-card-desc">{post.manchet}</p>}
                <div className="community-board-card-author">
                  <User size={13} />
                  <span>{post.forfatter?.navn ?? siteNavn}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="community-board-desc" style={{ margin: "8px 0 0 0" }}>
            Der er endnu ingen opslag på tavlen i {kommuneNavn}. Vær den første – send dit opslag til redaktionen.
          </p>
        )}
      </div>
    </section>
  );
}
