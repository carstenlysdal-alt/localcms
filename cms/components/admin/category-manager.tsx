"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, FolderTree, ListPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { saveCategory, deleteCategory, createDefaultSections, type CategoryActionState } from "@/app/redaktion/sektioner/actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Dialog, Sheet } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Notice } from "@/components/ui/Layout";

type CategoryBase = {
  id: string;
  navn: string;
  slug: string;
  beskrivelse: string | null;
  sortering: number;
  iNavigation: boolean;
  parentId: string | null;
  articlesCount: number;
};

interface CategoryItem extends CategoryBase {
  children: CategoryBase[];
}

export type DefaultSection = { navn: string; slug: string; sortering?: number; children?: Array<{ navn: string; slug: string; sortering?: number }> };

const articleCount = (n: number) => `${n} ${n === 1 ? "artikel" : "artikler"}`;

/**
 * Sektioner og undersektioner: liste i kort (ingen træk-rækkefølge — der findes ingen reorder-action; rækkefølgen styres af
 * feltet "Sorteringsorden"). Redigér/opret i et sidepanel (Sheet); sletning bekræftes i en Dialog i stedet for window.confirm.
 */
export function CategoryManager({ categories, defaultSections = null }: { categories: CategoryItem[]; defaultSections?: DefaultSection[] | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingCat, setEditingCat] = useState<Partial<CategoryItem> | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; navn: string } | null>(null);
  const [actionState, setActionState] = useState<CategoryActionState>({});

  const openCreate = (parentId: string | null = null) => {
    setActionState({});
    setEditingCat({ id: undefined, navn: "", slug: "", beskrivelse: "", sortering: 0, iNavigation: true, parentId });
  };

  const openEdit = (item: CategoryBase) => {
    setActionState({});
    setEditingCat({ ...item });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    const { id } = toDelete;
    setToDelete(null);
    setActionState({});
    startTransition(async () => {
      const res = await deleteCategory(id);
      setActionState(res);
      if (res.success) setEditingCat(null);
    });
  };

  const handleSubmit = (formData: FormData) => {
    setActionState({});
    startTransition(async () => {
      const res = await saveCategory(editingCat?.id ?? null, {}, formData);
      setActionState(res);
      if (res.success) setEditingCat(null);
    });
  };

  // "Opret standardsektioner": opretter de topsektioner der mangler (saveCategory); undersektioner kræver forælderens id og
  // oprettes ved næste klik, når listen er opdateret. Findes ingen standardstruktur (lib/default-sections.ts), er knappen slået fra.
  const missingTop = (defaultSections ?? []).filter((d) => !categories.some((c) => c.slug === d.slug));
  const missingChildren = (defaultSections ?? []).flatMap((d) => {
    const parent = categories.find((c) => c.slug === d.slug);
    return parent ? (d.children ?? []).filter((ch) => !parent.children.some((x) => x.slug === ch.slug)).map((ch) => ({ ...ch, parentId: parent.id })) : [];
  });
  const defaultsDone = defaultSections !== null && missingTop.length === 0 && missingChildren.length === 0;

  const createDefaults = () => {
    setActionState({});
    startTransition(async () => {
      const res = await createDefaultSections();
      setActionState(res);
      router.refresh();
    });
  };

  const sheetTitle = editingCat?.id ? "Redigér sektion" : editingCat?.parentId ? "Opret undersektion" : "Opret hovedsektion";

  return (
    <div className="ui-stack ui-gap-md">
      <div className="ui-row ui-justify-between ui-gap-md">
        <div>
          <h2 className="ui-section-title">Sektioner og undersektioner</h2>
          <p className="ui-section-text">{categories.length} {categories.length === 1 ? "hovedsektion" : "hovedsektioner"} · to niveauer. Redaktøren kan vælge både sektion og undersektion på en artikel.</p>
        </div>
        <div className="ui-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={defaultSections === null || defaultsDone || isPending}
            aria-describedby="default-sections-hint"
            onClick={createDefaults}
          >
            <ListPlus size={16} aria-hidden="true" /> Opret standardsektioner
          </button>
          <button type="button" className="btn btn-primary" onClick={() => openCreate(null)}><Plus size={16} aria-hidden="true" /> Ny hovedsektion</button>
        </div>
      </div>
      <p id="default-sections-hint" className="ui-section-text">
        {defaultSections === null
          ? "Standardstrukturen er ikke indlæst endnu. Bed i mellemtiden AI-operatøren: \"Opret sektionerne Nyheder, Politik, Erhverv, 112 og Kultur\"."
          : defaultsDone ? "Standardsektionerne findes allerede." : `Opretter ${missingTop.length} topsektioner og ${missingChildren.length} undersektioner, der mangler.`}
      </p>

      {actionState.error ? <Notice tone="danger" title="Det lykkedes ikke">{actionState.error}</Notice> : null}
      {actionState.success ? <Notice tone="success">{actionState.success}</Notice> : null}

      {categories.length === 0 ? (
        <EmptyState
          icon={<FolderTree size={22} />}
          title="Ingen sektioner endnu"
          description="Sektioner er forsidens og navigationens rygrad. Opret den første, fx Nyheder eller Erhverv."
          action={<button type="button" className="btn btn-primary" onClick={() => openCreate(null)}><Plus size={16} aria-hidden="true" /> Ny hovedsektion</button>}
        />
      ) : (
        <ul className="ui-list cat-tree">
          {categories.map((parent) => (
            <li key={parent.id}>
              <Card padding="none" as="article" aria-label={parent.navn}>
                <div className="cat-row">
                  <FolderTree size={18} aria-hidden="true" className="cat-icon" />
                  <div className="cat-main">
                    <div className="ui-row ui-gap-sm">
                      <strong>{parent.navn}</strong>
                      <code className="cat-slug">/{parent.slug}</code>
                      {parent.iNavigation ? <Badge tone="success">I navigation</Badge> : <Badge tone="neutral">Skjult i menu</Badge>}
                    </div>
                    {parent.beskrivelse ? <p className="cat-desc">{parent.beskrivelse}</p> : null}
                    <p className="cat-meta">Sortering {parent.sortering} · {articleCount(parent.articlesCount)}</p>
                  </div>
                  <div className="ui-toolbar">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openCreate(parent.id)}><Plus size={14} aria-hidden="true" /> Undersektion</button>
                    <button type="button" className="btn btn-secondary btn-sm" aria-label={`Redigér ${parent.navn}`} onClick={() => openEdit(parent)}><Pencil size={14} aria-hidden="true" /></button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm cat-delete"
                      aria-label={`Slet ${parent.navn}`}
                      title={parent.children.length > 0 ? "Slet først undersektionerne" : parent.articlesCount > 0 ? "Flyt først artiklerne" : "Slet sektion"}
                      disabled={isPending || parent.children.length > 0 || parent.articlesCount > 0}
                      onClick={() => setToDelete({ id: parent.id, navn: parent.navn })}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {parent.children.length > 0 ? (
                  <ul className="cat-children">
                    {parent.children.map((sub) => (
                      <li key={sub.id} className="cat-row cat-sub">
                        <CornerDownRight size={16} aria-hidden="true" className="cat-icon" />
                        <div className="cat-main">
                          <div className="ui-row ui-gap-sm">
                            <span className="cat-subname">{sub.navn}</span>
                            <code className="cat-slug">/{parent.slug}/{sub.slug}</code>
                          </div>
                          {sub.beskrivelse ? <p className="cat-desc">{sub.beskrivelse}</p> : null}
                          <p className="cat-meta">Sortering {sub.sortering} · {articleCount(sub.articlesCount)}</p>
                        </div>
                        <div className="ui-toolbar">
                          <button type="button" className="btn btn-secondary btn-sm" aria-label={`Redigér ${sub.navn}`} onClick={() => openEdit(sub)}><Pencil size={14} aria-hidden="true" /></button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm cat-delete"
                            aria-label={`Slet ${sub.navn}`}
                            title={sub.articlesCount > 0 ? "Flyt først artiklerne" : "Slet undersektion"}
                            disabled={isPending || sub.articlesCount > 0}
                            onClick={() => setToDelete({ id: sub.id, navn: sub.navn })}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={editingCat !== null} onClose={() => setEditingCat(null)} title={sheetTitle} size="sm">
        {editingCat ? (
          <form action={handleSubmit} className="ui-stack ui-gap-md" key={editingCat.id ?? `new-${editingCat.parentId ?? "root"}`}>
            {actionState.error ? <Notice tone="danger">{actionState.error}</Notice> : null}
            <Field label="Navn" htmlFor="navn" required>
              <input className="input" id="navn" name="navn" defaultValue={editingCat.navn ?? ""} required placeholder="fx Erhverv eller Iværksættere" />
            </Field>
            <Field label="Slug (URL-sti)" htmlFor="slug" required hint="Små bogstaver, tal og bindestreger.">
              <input className="input" id="slug" name="slug" defaultValue={editingCat.slug ?? ""} required pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$" placeholder="fx erhverv eller ivaerksaettere" aria-describedby="slug-hint" />
            </Field>
            <Field label="Overordnet sektion" htmlFor="parentId" hint="Maksimalt to niveauer er tilladt.">
              <select className="input" id="parentId" name="parentId" defaultValue={editingCat.parentId ?? ""} aria-describedby="parentId-hint">
                <option value="">Ingen (dette er en hovedsektion)</option>
                {categories.filter((c) => c.id !== editingCat.id).map((c) => <option key={c.id} value={c.id}>{c.navn}</option>)}
              </select>
            </Field>
            <Field label="Beskrivelse" htmlFor="beskrivelse">
              <textarea className="input" id="beskrivelse" name="beskrivelse" defaultValue={editingCat.beskrivelse ?? ""} rows={2} placeholder="Kort beskrivelse til læsere og søgemaskiner…" />
            </Field>
            <Field label="Sorteringsorden" htmlFor="sortering" hint="Laveste tal vises først.">
              <input type="number" className="input" id="sortering" name="sortering" defaultValue={editingCat.sortering ?? 0} min={0} aria-describedby="sortering-hint" />
            </Field>
            <label className="check-row">
              <input type="checkbox" id="iNavigation" name="iNavigation" defaultChecked={editingCat.iNavigation ?? true} />
              Vis i primær navigation / menulinje
            </label>
            <div className="ui-dialog-foot">
              <button type="button" className="btn btn-secondary" disabled={isPending} onClick={() => setEditingCat(null)}>Annullér</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Gemmer…" : "Gem sektion"}</button>
            </div>
          </form>
        ) : null}
      </Sheet>

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Slet sektionen?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setToDelete(null)}>Annullér</button>
            <button type="button" className="btn btn-danger" onClick={confirmDelete}>Slet sektion</button>
          </>
        }
      >
        <p className="ui-dialog-message">Sektionen &quot;{toDelete?.navn}&quot; slettes permanent. Det kan ikke fortrydes.</p>
      </Dialog>
    </div>
  );
}
