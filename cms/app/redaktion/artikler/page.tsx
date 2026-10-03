import Link from "next/link";
import { Plus, Search, LayoutGrid, List as ListIcon } from "lucide-react";
import "@/styles/cms-editor.css";
import { ArticleCardList } from "@/components/editor/article-list";
import { ArticleEditor } from "@/components/editor/article-editor";
import { ArticleCorrections } from "@/components/editor/article-corrections";
import { AiDock } from "@/components/editor/ai-dock";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, canEditArticle, PERMISSIONS } from "@/lib/permissions";
import { searchOr } from "@/lib/search";
import { loadNavCities, switchableCount } from "@/lib/shell-cities";
import { CityTabs } from "@/components/admin/city-switcher";
import { ALL_STATUSES, buildWhere, listHref, parseListParams, type ListTab } from "@/lib/editor/list-query";
import { loadArticleValue, loadEditorOptions } from "@/lib/editor/load";

const PRIMARY_TABS: ListTab[] = ["Alle", "Planlagt", "Publiceret", "Kladder"];
const EXTRA_TABS: ListTab[] = ["Meninger", "Debat"];
const MAX_ROWS = 200;

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthorizedUser();
  if (!user) return null;
  const p = parseListParams(await searchParams);

  const where = buildWhere(p, user.instansId, (fields, q) => searchOr(fields, q));
  const [rows, authors, instance, cities, options] = await Promise.all([
    db.article.findMany({
      where,
      include: { forfatter: true, coverMedia: true, kategori: { select: { id: true, navn: true } } },
      orderBy: { opdateretTid: p.sort },
      take: MAX_ROWS,
    }),
    db.author.findMany({ where: { instansId: user.instansId }, orderBy: { navn: "asc" }, select: { id: true, navn: true } }),
    db.instance.findUnique({ where: { id: user.instansId }, select: { navn: true, domaene: true } }),
    loadNavCities(user),
    loadEditorOptions(user),
  ]);

  const canCreate = can(user, PERMISSIONS.ARTICLE_CREATE);
  const canManage = can(user, PERMISSIONS.FRONTPAGE_EDIT);
  const city = (instance?.navn ?? "").replace(/Lokalt$/i, "") || "Din by";
  const base = { ...p, id: "" };
  const hrefFor = (id: string) => listHref(p, { id });
  const closeHref = listHref(base);

  // Valgt artikel (højre panel).
  const selected = p.id ? await loadArticleValue(user, p.id) : null;
  const selectedAllowed = selected ? canEditArticle(user, selected.row) : false;
  const corrections = selected && selectedAllowed ? await db.correction.findMany({ where: { articleId: selected.row.id, instansId: user.instansId, fjernetTid: null }, orderBy: { dato: "desc" } }) : [];
  const chatHistory = selected && selectedAllowed
    ? await db.chatMessage.findMany({ where: { sessionId: `artikel-${selected.row.id}`, instansId: user.instansId }, orderBy: { createdAt: "asc" }, take: 40 })
    : [];

  const breaking = rows.filter((a) => a.breaking);
  const pinned = rows.filter((a) => a.pinned && !a.breaking);
  const rest = rows.filter((a) => !a.breaking && !a.pinned);
  const groups = [
    { key: "breaking", label: "Hastenyheder", rows: breaking },
    { key: "pinned", label: "Fastgjort", rows: pinned },
    { key: "rest", label: "Alle historier", rows: rest },
  ].filter((g) => g.rows.length > 0);

  const detail = selected ? (
    selectedAllowed ? (
      <ArticleEditor
        key={selected.row.id}
        article={selected.value}
        options={options.options}
        flags={options.flags}
        site={options.site}
        transitions={selected.transitions}
        mode="panel"
        closeHref={closeHref}
        hasUnverifiedSource={typeof (selected.row.marking as { uverificeretKilde?: unknown } | null)?.uverificeretKilde === "boolean"}
      >
        <ArticleCorrections articleId={selected.row.id} corrections={corrections} canRemove={can(user, PERMISSIONS.ARTICLE_PUBLISH) || can(user, PERMISSIONS.ARTICLE_EDIT_ALL)} />
      </ArticleEditor>
    ) : (
      <div className="cms-empty-detail">
        <h2>Ingen redigeringsadgang</h2>
        <p>Du kan kun redigere dine egne artikler.</p>
        <Link className="cms-btn cms-btn-secondary" href={closeHref} scroll={false}>Til listen</Link>
      </div>
    )
  ) : p.id ? (
    <div className="cms-empty-detail"><h2>Artiklen findes ikke</h2><Link className="cms-btn cms-btn-secondary" href={closeHref} scroll={false}>Til listen</Link></div>
  ) : (
    <div className="cms-empty-detail"><h2>Vælg en artikel</h2><p>Åbn en historie i listen for at redigere den her — eller opret en ny.</p>{canCreate && <Link className="cms-btn cms-btn-primary" href="/redaktion/artikler/ny"><Plus size={16} aria-hidden="true" /> Ny artikel</Link>}</div>
  );

  const workspace = (
    <main className="cms-ws cms-page" data-open={selected || p.id ? "true" : "false"}>
      <section className="cms-ws-list" aria-label="Artikler">
        <div className="cms-ws-head">
          <div>
            <h1>Artikler</h1>
            <p className="cms-muted">{rows.length}{rows.length === MAX_ROWS ? "+" : ""} historier i visningen</p>
          </div>
          {canCreate && <Link className="cms-btn cms-btn-primary" href="/redaktion/artikler/ny"><Plus size={16} aria-hidden="true" /> Ny artikel</Link>}
        </div>

        <nav className="cms-tabs" aria-label="Artikelvisninger">
          {PRIMARY_TABS.map((t) => (
            <Link key={t} className="cms-tab" aria-current={p.tab === t ? "page" : undefined} href={listHref({ ...base, tab: t, status: "" })} scroll={false}>{t}</Link>
          ))}
          <span className="cms-tab-sep" aria-hidden="true" />
          <CityTabs bare cities={cities} variant="cms" label="By" allHref={switchableCount(cities) > 1 ? "/redaktion/artikler/alle-byer" : null} />
        </nav>

        <form className="cms-filters" action="/redaktion/artikler" method="get">
          {p.tab !== "Alle" && <input type="hidden" name="tab" value={p.tab} />}
          <label className="cms-search"><Search size={16} aria-hidden="true" /><input name="q" defaultValue={p.q} placeholder="Søg på titel" aria-label="Søg på titel" /></label>
          <select className="cms-select" name="status" defaultValue={p.status} aria-label="Status">
            <option value="">Alle statusser</option>
            {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="cms-select" name="forfatter" defaultValue={p.forfatter} aria-label="Forfatter">
            <option value="">Alle forfattere</option>
            {authors.map((a) => <option key={a.id} value={a.id}>{a.navn}</option>)}
          </select>
          <select className="cms-select" name="sort" defaultValue={p.sort === "asc" ? "aeldste" : "nyeste"} aria-label="Sortering">
            <option value="nyeste">Nyeste først</option>
            <option value="aeldste">Ældste først</option>
          </select>
          {p.view === "gitter" && <input type="hidden" name="view" value="gitter" />}
          <button className="cms-btn cms-btn-secondary">Filtrér</button>
          <span className="cms-view-toggle" role="group" aria-label="Visning">
            <Link className="cms-icon-btn" aria-pressed={p.view === "liste"} aria-label="Liste" href={listHref({ ...p, view: "liste" })} scroll={false}><ListIcon size={16} aria-hidden="true" /></Link>
            <Link className="cms-icon-btn" aria-pressed={p.view === "gitter"} aria-label="Gitter" href={listHref({ ...p, view: "gitter" })} scroll={false}><LayoutGrid size={16} aria-hidden="true" /></Link>
          </span>
        </form>

        <div className="cms-quick">
          {EXTRA_TABS.map((t) => <Link key={t} className="cms-chip-btn" aria-pressed={p.tab === t} href={listHref({ ...base, tab: p.tab === t ? "Alle" : t })} scroll={false}>{t}</Link>)}
          {canManage && (
            <>
              <Link className="cms-chip-btn" aria-pressed={p.breaking} href={listHref({ ...base, breaking: !p.breaking })} scroll={false}>Breaking</Link>
              <Link className="cms-chip-btn" aria-pressed={p.sponsored} href={listHref({ ...base, sponsored: !p.sponsored })} scroll={false}>Sponsoreret</Link>
              <Link className="cms-chip-btn" aria-pressed={p.pinned} href={listHref({ ...base, pinned: !p.pinned })} scroll={false}>Fastgjort</Link>
            </>
          )}
        </div>

        {groups.length === 0 && <div className="cms-empty">Ingen historier i denne visning.</div>}
        {groups.map((g) => (
          <div key={g.key} className="cms-group">
            <h2 className="cms-group-title">{g.label} <span>{g.rows.length}</span></h2>
            <ArticleCardList rows={g.rows} selectedId={p.id} hrefFor={hrefFor} city={city} view={p.view} canManageFrontpage={canManage} />
          </div>
        ))}
      </section>

      <section className="cms-ws-detail" aria-label="Redigering">{detail}</section>
    </main>
  );

  if (selected && selectedAllowed) {
    return (
      <AiDock sessionId={`artikel-${selected.row.id}`} initialMessages={chatHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))}>
        {workspace}
      </AiDock>
    );
  }
  return workspace;
}
