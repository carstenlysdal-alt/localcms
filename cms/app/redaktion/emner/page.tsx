import Link from "next/link";
import { Plus, Tags } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";
import { searchOr } from "@/lib/search";
import { Page, PageHeader } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar, FilterChips } from "@/components/ui/FilterBar";
import { SearchField } from "@/components/ui/SearchField";

function formatTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "nu";
  if (mins < 60) return `${mins}m siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}t siden`;
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "short" }).format(date);
}

export default async function EmnerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const kategori = typeof params.kategori === "string" ? params.kategori : "";

  const topics = await db.topic.findMany({
    where: {
      instansId: session.user.instansId,
      ...(query ? { OR: searchOr<Prisma.TopicWhereInput>(["titel"], query) } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const kategorier = Array.from(new Set(topics.flatMap((t) => t.kategorier as string[]))).sort();
  const filtered = kategori ? topics.filter((t) => (t.kategorier as string[]).includes(kategori)) : topics;
  const canManage = can(session.user, PERMISSIONS.ARTICLE_CREATE);

  const withQuery = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    const s = p.toString();
    return `/redaktion/emner${s ? `?${s}` : ""}`;
  };

  return (
    <Page>
      <PageHeader
        title="Emner"
        subtitle="Nye leads fra dine emner. Åbn et for at se kilder og skriv historien."
        actions={canManage ? <Link className="btn btn-primary" href="/redaktion/emner/ny"><Plus size={16} aria-hidden="true" /> Nyt emne</Link> : undefined}
      />

      <FilterBar label="Søg i emner" submitLabel="Søg" resetHref={query || kategori ? "/redaktion/emner" : undefined}>
        <SearchField label="Søg i emner" defaultValue={query} placeholder="Søg emner…" />
        {kategori ? <input type="hidden" name="kategori" value={kategori} /> : null}
      </FilterBar>

      {kategorier.length > 0 ? (
        <FilterChips
          label="Kategorier"
          chips={[
            { href: withQuery({}), label: "Alle emner", count: topics.length, active: !kategori },
            ...kategorier.map((k) => ({
              href: withQuery({ kategori: k }),
              label: k,
              count: topics.filter((t) => (t.kategorier as string[]).includes(k)).length,
              active: kategori === k,
            })),
          ]}
        />
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Tags size={22} />}
          title="Ingen emner endnu"
          description="Opret et emne for at begynde at overvåge historier."
          action={canManage ? <Link className="btn btn-primary" href="/redaktion/emner/ny"><Plus size={16} aria-hidden="true" /> Nyt emne</Link> : undefined}
        />
      ) : (
        <ul className="topic-grid ui-list-reset">
          {filtered.map((topic) => (
            <li key={topic.id}>
              <Link href={`/redaktion/chat?emne=${encodeURIComponent(topic.titel)}`} className="topic-card">
                <div className="topic-cover">
                  {topic.coverUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={topic.coverUrl} alt="" />
                    : <div className="topic-cover-placeholder" />}
                </div>
                <div className="topic-body">
                  <div className="topic-tags">
                    {topic.notable ? <Badge tone="success">Notable</Badge> : null}
                    {(topic.kategorier as string[]).slice(0, 2).map((k) => <Badge key={k} tone="neutral">{k}</Badge>)}
                  </div>
                  <strong className="topic-title">{topic.titel}</strong>
                  {topic.beskrivelse ? <p className="topic-desc">{topic.beskrivelse}</p> : null}
                  <div className="topic-meta">
                    <span>{topic.kildeAntal} {topic.kildeAntal === 1 ? "kilde" : "kilder"}</span>
                    <span>Opdateret {formatTime(topic.updatedAt)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
