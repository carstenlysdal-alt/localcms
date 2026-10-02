import Link from "next/link";
import { Pin, Radio } from "lucide-react";
import type { Article, Author, Media } from "@prisma/client";
import { toggleArticleFlag } from "@/app/redaktion/artikler/actions";
import { formatSavedAt } from "@/lib/editor/format";
import { slugify } from "@/lib/slug";

export type ListRow = Article & { forfatter: Author | null; coverMedia: Media | null; kategori: { id: string; navn: string } | null };

function statusTone(status: string): string {
  if (status === "Publiceret" || status === "Distribueret") return "published";
  if (status === "Planlagt") return "planned";
  if (["Godkendelse", "Redigering", "Faktatjek", "Juridisk kontrol", "SEO", "Medievalg"].includes(status)) return "review";
  if (status === "Afvist") return "danger";
  if (status === "Arkiveret") return "archived";
  return "draft";
}

function toneOf(id: string | null | undefined): number {
  if (!id) return 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}

export function ArticleCardList({ rows, selectedId, hrefFor, city, view, canManageFrontpage }: {
  rows: ListRow[]; selectedId: string; hrefFor: (id: string) => string; city: string; view: "liste" | "gitter"; canManageFrontpage: boolean;
}) {
  if (!rows.length) return <div className="cms-empty">Ingen historier i denne visning.</div>;
  const now = new Date();
  const cityKey = slugify(city);
  return (
    <ul className={`cms-list${view === "gitter" ? " is-grid" : ""}`}>
      {rows.map((a) => {
        const when = a.status === "Planlagt" && a.planlagtTid ? a.planlagtTid : a.publiceretTid ?? a.opdateretTid;
        const overdue = a.status === "Planlagt" && a.planlagtTid && a.planlagtTid.getTime() < now.getTime();
        return (
          <li key={a.id} className={`cms-card${a.id === selectedId ? " is-selected" : ""}`}>
            <Link className="cms-card-link" href={hrefFor(a.id)} scroll={false} aria-current={a.id === selectedId ? "true" : undefined}>
              <span className="cms-card-thumb">
                {a.coverMedia?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.coverMedia.url} alt="" loading="lazy" />
                ) : null}
              </span>
              <span className="cms-card-body">
                <span className="cms-card-title">
                  <span className="cms-city-dot" data-city={cityKey} aria-label={`By: ${city}`} role="img" />
                  {a.breaking && <span className="cms-chip-mini is-danger">Hastenyhed</span>}
                  <span>{a.titel || "Uden titel"}</span>
                </span>
                {a.manchet && <span className="cms-card-excerpt">{a.manchet}</span>}
                <span className="cms-card-meta">
                  {a.kategori && <span><span className="cms-dot" data-tone={toneOf(a.kategori.id)} aria-hidden="true" /> {a.kategori.navn}</span>}
                  <span>{a.forfatter?.navn ?? "Ikke tildelt"}</span>
                  <span>{a.status === "Planlagt" && a.planlagtTid ? `Planlagt ${formatSavedAt(when)}` : formatSavedAt(when)}</span>
                </span>
              </span>
              <span className="cms-card-side">
                <span className={`cms-status cms-status-${statusTone(a.status)}`}><span className="cms-status-dot" aria-hidden="true" /> {a.status}</span>
                {overdue && <span className="cms-chip-mini is-danger">Forsinket</span>}
              </span>
            </Link>
            {canManageFrontpage && (
              <div className="cms-card-actions">
                <form action={toggleArticleFlag.bind(null, a.id, "pinned")}><button className="cms-icon-btn" aria-pressed={a.pinned} title={a.pinned ? "Fjern fastgørelse" : "Fastgør"} aria-label={a.pinned ? "Fjern fastgørelse" : "Fastgør på forsiden"}><Pin size={16} aria-hidden="true" /></button></form>
                <form action={toggleArticleFlag.bind(null, a.id, "breaking")}><button className="cms-icon-btn" aria-pressed={a.breaking} title={a.breaking ? "Fjern breaking" : "Markér breaking"} aria-label={a.breaking ? "Fjern hastenyhed" : "Markér som hastenyhed"}><Radio size={16} aria-hidden="true" /></button></form>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
