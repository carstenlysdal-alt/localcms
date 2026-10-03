import Link from "next/link";
import { Images, Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { MediaPreview } from "@/components/media/media-preview";
import { getFreshSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { searchOr } from "@/lib/search";
import { Page, PageHeader } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { SearchField } from "@/components/ui/SearchField";

function formatBytes(value: number | null) {
  if (!value) return "Ekstern";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

const TYPES = [
  { key: "", label: "Alle" },
  { key: "billede", label: "Billeder" },
  { key: "video", label: "Video" },
  { key: "lyd", label: "Lyd" },
  { key: "dokument", label: "Dokumenter" },
];

export default async function MediaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getFreshSession();
  if (!session?.user) return null;
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const type = typeof params.type === "string" ? params.type : "";
  const where: Prisma.MediaWhereInput = {
    instansId: session.user.instansId,
    ...(type ? { filtype: type } : {}),
    ...(query ? { OR: searchOr<Prisma.MediaWhereInput>(["filnavn", "billedtekst", "altTekst", "ophavsperson"], query) } : {}),
  };
  const media = await db.media.findMany({ where, orderBy: { createdAt: "desc" } });

  const href = (t: string) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (t) p.set("type", t);
    const s = p.toString();
    return `/redaktion/medier${s ? `?${s}` : ""}`;
  };

  return (
    <Page>
      <PageHeader
        icon={<Images size={22} />}
        title="Medier"
        subtitle={`${media.length} ${media.length === 1 ? "medie" : "medier"} i den aktuelle visning`}
        actions={can(session.user, PERMISSIONS.MEDIA_MANAGE) ? <Link className="btn btn-primary" href="/redaktion/medier/ny"><Plus size={16} aria-hidden="true" /> Tilføj medie</Link> : undefined}
      />
      <LinkTabs label="Medietype" items={TYPES.map((t) => ({ href: href(t.key), label: t.label, active: type === t.key }))} />
      <FilterBar label="Søg i medier" resetHref={query || type ? "/redaktion/medier" : undefined}>
        <SearchField label="Søg filnavn, billedtekst eller ophav" defaultValue={query} placeholder="Søg filnavn, billedtekst eller ophav" />
        <FilterSelect name="type" label="Medietype" value={type} options={[{ value: "", label: "Alle medietyper" }, ...TYPES.slice(1).map((t) => ({ value: t.key, label: t.label }))]} />
      </FilterBar>
      {media.length ? (
        <ul className="media-grid ui-list-reset">
          {media.map((item) => (
            <li key={item.id}>
              <Link className="media-card card" href={`/redaktion/medier/${item.id}`}>
                <div className="media-card-preview"><MediaPreview media={item} /></div>
                <span><Badge tone="neutral">{item.filtype}</Badge></span>
                <strong className="media-card-title">{item.billedtekst || item.filnavn || "Unavngivet medie"}</strong>
                <small>{item.ophavsperson || "Ophav ikke angivet"} · {formatBytes(item.stoerrelse)}</small>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Images size={22} />} title="Ingen medier matcher filtrene" description="Prøv en anden søgning eller medietype." />
      )}
    </Page>
  );
}
