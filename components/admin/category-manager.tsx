"use client";

import { useState, useTransition } from "react";
import { FolderTree, Plus, Edit2, Trash2, CornerDownRight, Check, AlertCircle } from "lucide-react";
import { saveCategory, deleteCategory, type CategoryActionState } from "@/app/redaktion/sektioner/actions";

interface CategoryItem {
  id: string;
  navn: string;
  slug: string;
  beskrivelse: string | null;
  sortering: number;
  iNavigation: boolean;
  parentId: string | null;
  articlesCount: number;
  children: Array<{
    id: string;
    navn: string;
    slug: string;
    beskrivelse: string | null;
    sortering: number;
    iNavigation: boolean;
    parentId: string | null;
    articlesCount: number;
  }>;
}

export function CategoryManager({ categories }: { categories: CategoryItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [editingCat, setEditingCat] = useState<Partial<CategoryItem> | null>(null);
  const [actionState, setActionState] = useState<CategoryActionState>({});

  const handleOpenCreate = (parentId: string | null = null) => {
    setActionState({});
    setEditingCat({
      id: undefined,
      navn: "",
      slug: "",
      beskrivelse: "",
      sortering: 0,
      iNavigation: true,
      parentId,
    });
  };

  const handleOpenEdit = (item: {
    id: string;
    navn: string;
    slug: string;
    beskrivelse: string | null;
    sortering: number;
    iNavigation: boolean;
    parentId: string | null;
  }) => {
    setActionState({});
    setEditingCat({
      ...item,
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Er du sikker på, at du vil slette sektionen "${name}"?`)) return;
    setActionState({});
    startTransition(async () => {
      const res = await deleteCategory(id);
      setActionState(res);
      if (res.success) {
        setEditingCat(null);
      }
    });
  };

  const handleSubmit = (formData: FormData) => {
    setActionState({});
    startTransition(async () => {
      const res = await saveCategory(editingCat?.id ?? null, {}, formData);
      setActionState(res);
      if (res.success) {
        setEditingCat(null);
      }
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: editingCat ? "1fr 380px" : "1fr", gap: "24px", alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>
              Sektioner og undersektioner ({categories.length} hovedsektioner)
            </h2>
            <p style={{ fontSize: "13px", color: "var(--color-neutral-600)", margin: "4px 0 0 0" }}>
              To-niveau taksonomi jf. Del 2 §1. Editoren kan vælge både sektion og undersektion.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleOpenCreate(null)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={16} /> Ny hovedsektion
          </button>
        </div>

        {actionState.error && (
          <div className="dialog inline-dialog" style={{ marginBottom: "16px", borderColor: "var(--color-error-400)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-error-600)" }}>
              <AlertCircle size={16} />
              <strong>Fejl: {actionState.error}</strong>
            </div>
          </div>
        )}

        {actionState.success && (
          <div className="notice-success" style={{ marginBottom: "16px" }}>
            <Check size={16} /> {actionState.success}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {categories.map((parent) => (
            <div
              key={parent.id}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}
            >
              {/* Hovedsektion Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "var(--color-neutral-50)",
                  borderBottom: parent.children.length > 0 ? "1px solid var(--color-border)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <FolderTree size={18} style={{ color: "var(--color-accent-600)" }} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "15px" }}>{parent.navn}</strong>
                      <code style={{ fontSize: "12px", background: "var(--color-neutral-200)", padding: "1px 6px", borderRadius: "4px" }}>
                        /{parent.slug}
                      </code>
                      {parent.iNavigation ? (
                        <span className="badge badge-live" style={{ fontSize: "10px" }}>I navigation</span>
                      ) : (
                        <span className="badge" style={{ fontSize: "10px", background: "var(--color-neutral-200)", color: "var(--color-neutral-700)" }}>Skjult i menu</span>
                      )}
                    </div>
                    {parent.beskrivelse && (
                      <div style={{ fontSize: "12px", color: "var(--color-neutral-600)", marginTop: "2px" }}>
                        {parent.beskrivelse}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "12px", color: "var(--color-neutral-500)" }}>
                    Sort: {parent.sortering} • {parent.articlesCount} {parent.articlesCount === 1 ? "artikel" : "artikler"}
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title="Tilføj undersektion"
                      onClick={() => handleOpenCreate(parent.id)}
                      style={{ padding: "4px 8px", fontSize: "12px" }}
                    >
                      <Plus size={13} /> Undersektion
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title="Rediger sektion"
                      onClick={() => handleOpenEdit(parent)}
                      style={{ padding: "4px 8px" }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title="Slet sektion"
                      disabled={isPending || parent.children.length > 0 || parent.articlesCount > 0}
                      onClick={() => handleDelete(parent.id, parent.navn)}
                      style={{ padding: "4px 8px", color: "var(--color-error-600)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Undersektioner */}
              {parent.children.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {parent.children.map((sub, idx) => (
                    <div
                      key={sub.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 16px 10px 36px",
                        borderBottom: idx === parent.children.length - 1 ? "none" : "1px solid var(--color-border-subtle, #eee)",
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <CornerDownRight size={14} style={{ color: "var(--color-neutral-400)" }} />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "500" }}>{sub.navn}</span>
                            <code style={{ fontSize: "11px", color: "var(--color-neutral-600)" }}>
                              /{parent.slug}/{sub.slug}
                            </code>
                          </div>
                          {sub.beskrivelse && (
                            <div style={{ fontSize: "11px", color: "var(--color-neutral-500)" }}>
                              {sub.beskrivelse}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "11px", color: "var(--color-neutral-500)" }}>
                          Sort: {sub.sortering} • {sub.articlesCount} {sub.articlesCount === 1 ? "artikel" : "artikler"}
                        </span>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Rediger undersektion"
                            onClick={() => handleOpenEdit(sub)}
                            style={{ padding: "3px 6px" }}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Slet undersektion"
                            disabled={isPending || sub.articlesCount > 0}
                            onClick={() => handleDelete(sub.id, sub.navn)}
                            style={{ padding: "3px 6px", color: "var(--color-error-600)" }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Redigering / Oprettelse Panel */}
      {editingCat && (
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "20px",
            position: "sticky",
            top: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600", margin: 0 }}>
              {editingCat.id ? "Rediger sektion" : editingCat.parentId ? "Opret undersektion" : "Opret hovedsektion"}
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditingCat(null)}
              style={{ fontSize: "11px", padding: "2px 8px" }}
            >
              Luk
            </button>
          </div>

          <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="field">
              <label htmlFor="navn">Navn</label>
              <input
                className="input"
                id="navn"
                name="navn"
                defaultValue={editingCat.navn ?? ""}
                required
                placeholder="fx Erhverv eller Iværksættere"
              />
            </div>

            <div className="field">
              <label htmlFor="slug">Slug (URL-sti)</label>
              <input
                className="input"
                id="slug"
                name="slug"
                defaultValue={editingCat.slug ?? ""}
                required
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                placeholder="fx erhverv eller ivaerksaettere"
              />
              <span style={{ fontSize: "11px", color: "var(--color-neutral-500)" }}>
                Små bogstaver, tal og bindestreger.
              </span>
            </div>

            <div className="field">
              <label htmlFor="parentId">Overordnet sektion</label>
              <select
                className="input"
                id="parentId"
                name="parentId"
                defaultValue={editingCat.parentId ?? ""}
              >
                <option value="">Ingen (dette er en hovedsektion)</option>
                {categories
                  .filter((c) => c.id !== editingCat.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.navn}
                    </option>
                  ))}
              </select>
              <span style={{ fontSize: "11px", color: "var(--color-neutral-500)" }}>
                Maksimalt to niveauer er tilladt.
              </span>
            </div>

            <div className="field">
              <label htmlFor="beskrivelse">Beskrivelse</label>
              <textarea
                className="input"
                id="beskrivelse"
                name="beskrivelse"
                defaultValue={editingCat.beskrivelse ?? ""}
                rows={2}
                placeholder="Kort beskrivelse til læsere og søgemaskiner..."
              />
            </div>

            <div className="field">
              <label htmlFor="sortering">Sorteringsorden</label>
              <input
                type="number"
                className="input"
                id="sortering"
                name="sortering"
                defaultValue={editingCat.sortering ?? 0}
                min={0}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                id="iNavigation"
                name="iNavigation"
                defaultChecked={editingCat.iNavigation ?? true}
              />
              <label htmlFor="iNavigation" style={{ fontSize: "13px", cursor: "pointer" }}>
                Vis i primær navigation / menulinje
              </label>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button type="submit" className="btn btn-primary" disabled={isPending} style={{ flex: 1 }}>
                {isPending ? "Gemmer…" : "Gem sektion"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isPending}
                onClick={() => setEditingCat(null)}
              >
                Annuller
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
