"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold, ChevronDown, ChevronUp, Heading2, Heading3, ImageIcon, Italic, Link2, List, ListOrdered, Maximize2, Minimize2, Pilcrow, Plus, Quote, Redo2, Trash2, Underline as UnderlineIcon, Undo2,
} from "lucide-react";
import { blockRegistry } from "@/lib/blocks/registry";
import type { Block, BlockType } from "@/lib/blocks/schema";
import { stripHtml } from "@/lib/seo/escape";
import type { MediaOption } from "@/lib/editor/types";
import type { EditorialRequest, EditorialTask, ImproveMode } from "@/lib/ai/editorial-schemas";
import type { AiEntry } from "./use-editorial-ai";
import { AltSuggestion, ImproveSuggestion } from "./ai-panels";
import { MediaPicker } from "./media-picker";
import { SuggestButton } from "./primitives";

export type BlockAi = {
  enabled: boolean;
  /** Sat når kategorien spærrer tekstgenererende AI (Krimi/Sundhed). */
  restrictedReason: string | null;
  entries: Record<string, AiEntry>;
  run: (task: EditorialTask, params: NonNullable<EditorialRequest["params"]>, key: string) => void;
  dismiss: (key: string) => void;
  /** Kaldes når et AI-forslag ACCEPTERES (editoren registrerer AI-brug). */
  onAccepted: (task: EditorialTask) => void;
};

function ParagraphEditor({ value, onChange, onFocusEditor, label }: { value: string; onChange: (value: string) => void; onFocusEditor: (editor: Editor) => void; label: string }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } } })],
    content: value,
    immediatelyRender: false,
    editorProps: { attributes: { class: "cms-prose", role: "textbox", "aria-multiline": "true", "aria-label": label } },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    onFocus: ({ editor: ed }) => onFocusEditor(ed),
  });
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);
  return <EditorContent editor={editor} className="cms-editor-content" />;
}

function ToolbarButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="cms-tool" aria-label={label} title={label} aria-pressed={active ?? undefined} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

const ADD_TYPES: Array<{ type: BlockType; short: string }> = [
  { type: "paragraph", short: "Afsnit" }, { type: "heading", short: "Overskrift" }, { type: "subheading", short: "Mellemrubrik" }, { type: "quote", short: "Citat" },
  { type: "image", short: "Billede" }, { type: "factbox", short: "Faktaboks" }, { type: "infobox", short: "Infoboks" }, { type: "manchet", short: "Manchet" },
];

const IMPROVE_LABEL: Record<ImproveMode, string> = { forbedr: "Forbedr", omskriv: "Omskriv", forkort: "Forkort", udvid: "Udvid" };

export function BlockEditor({ blocks, onChange, media = [], ai }: { blocks: Block[]; onChange: (blocks: Block[]) => void; media?: MediaOption[]; ai?: BlockAi }) {
  const uid = useId();
  const [activeId, setActiveId] = useState<string | null>(blocks[0]?.id ?? null);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<ImproveMode>("forbedr");
  const [, rerender] = useState(0);

  // Gentegn værktøjslinjens aktive tilstande når markeringen ændrer sig.
  useEffect(() => {
    if (!activeEditor) return;
    const tick = () => rerender((n) => n + 1);
    activeEditor.on("selectionUpdate", tick);
    activeEditor.on("transaction", tick);
    return () => { activeEditor.off("selectionUpdate", tick); activeEditor.off("transaction", tick); };
  }, [activeEditor]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const activeIndex = useMemo(() => blocks.findIndex((b) => b.id === activeId), [blocks, activeId]);
  const activeBlock = activeIndex >= 0 ? blocks[activeIndex] : null;
  const paragraphActive = activeBlock?.type === "paragraph" && activeEditor !== null;

  function update(index: number, data: Block["data"]) {
    onChange(blocks.map((block, i) => (i === index ? ({ ...block, data } as Block) : block)));
  }
  function replaceAt(index: number, block: Block) {
    onChange(blocks.map((b, i) => (i === index ? block : b)));
    setActiveId(block.id);
  }
  function insertAfter(index: number, block: Block) {
    const copy = [...blocks];
    copy.splice(index + 1, 0, block);
    onChange(copy);
    setActiveId(block.id);
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const copy = [...blocks];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onChange(copy);
  }
  function addBlock(type: BlockType) {
    const block = blockRegistry[type].create(crypto.randomUUID());
    insertAfter(activeIndex >= 0 ? activeIndex : blocks.length - 1, block);
  }
  function textOf(block: Block): string {
    if (block.type === "paragraph") return stripHtml(block.data.content);
    if (block.type === "heading" || block.type === "subheading" || block.type === "manchet") return block.data.text;
    if (block.type === "quote") return block.data.quote;
    return "";
  }
  /** Gør den aktive blok til afsnit/overskrift/citat; tekstindholdet bevares (formatering i afsnit mistes ved konvertering). */
  function convertActive(type: "paragraph" | "h2" | "h3" | "quote") {
    if (activeIndex < 0 || !activeBlock) return;
    const text = textOf(activeBlock);
    const id = activeBlock.id;
    if (type === "paragraph") replaceAt(activeIndex, { id, type: "paragraph", data: { content: text ? `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "" } });
    else if (type === "quote") replaceAt(activeIndex, { id, type: "quote", data: { quote: text, attribution: "" } });
    else replaceAt(activeIndex, { id, type: "heading", data: { text, level: type === "h2" ? 2 : 3 } });
  }
  function applyLink() {
    if (!activeEditor) return;
    const url = linkUrl.trim();
    if (!url) activeEditor.chain().focus().unsetLink().run();
    else if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(url)) activeEditor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkOpen(false);
    setLinkUrl("");
  }
  function openLink() {
    if (!activeEditor) return;
    setLinkUrl((activeEditor.getAttributes("link").href as string | undefined) ?? "https://");
    setLinkOpen((v) => !v);
  }

  const aiOn = Boolean(ai?.enabled);
  const improveBlocked = ai?.restrictedReason ?? null;

  return (
    <div className={`cms-blocks${fullscreen ? " is-fullscreen" : ""}`} role="group" aria-label="Brødtekst">
      <div className="cms-toolbar" role="toolbar" aria-label="Formatering" aria-controls={`${uid}-blocks`}>
        <ToolbarButton label="Fortryd" disabled={!paragraphActive || !activeEditor?.can().undo()} onClick={() => activeEditor?.chain().focus().undo().run()}><Undo2 size={16} /></ToolbarButton>
        <ToolbarButton label="Gentag" disabled={!paragraphActive || !activeEditor?.can().redo()} onClick={() => activeEditor?.chain().focus().redo().run()}><Redo2 size={16} /></ToolbarButton>
        <span className="cms-tool-sep" aria-hidden="true" />
        <ToolbarButton label="Afsnit" active={activeBlock?.type === "paragraph"} disabled={!activeBlock} onClick={() => convertActive("paragraph")}><Pilcrow size={16} /></ToolbarButton>
        <ToolbarButton label="Overskrift 2" active={activeBlock?.type === "heading" && activeBlock.data.level === 2} disabled={!activeBlock} onClick={() => convertActive("h2")}><Heading2 size={16} /></ToolbarButton>
        <ToolbarButton label="Overskrift 3" active={activeBlock?.type === "heading" && activeBlock.data.level === 3} disabled={!activeBlock} onClick={() => convertActive("h3")}><Heading3 size={16} /></ToolbarButton>
        <span className="cms-tool-sep" aria-hidden="true" />
        <ToolbarButton label="Fed" active={paragraphActive && activeEditor?.isActive("bold")} disabled={!paragraphActive} onClick={() => activeEditor?.chain().focus().toggleBold().run()}><Bold size={16} /></ToolbarButton>
        <ToolbarButton label="Kursiv" active={paragraphActive && activeEditor?.isActive("italic")} disabled={!paragraphActive} onClick={() => activeEditor?.chain().focus().toggleItalic().run()}><Italic size={16} /></ToolbarButton>
        <ToolbarButton label="Understreg" active={paragraphActive && activeEditor?.isActive("underline")} disabled={!paragraphActive} onClick={() => activeEditor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16} /></ToolbarButton>
        <ToolbarButton label="Link" active={paragraphActive && activeEditor?.isActive("link")} disabled={!paragraphActive} onClick={openLink}><Link2 size={16} /></ToolbarButton>
        <span className="cms-tool-sep" aria-hidden="true" />
        <ToolbarButton label="Punktliste" active={paragraphActive && activeEditor?.isActive("bulletList")} disabled={!paragraphActive} onClick={() => activeEditor?.chain().focus().toggleBulletList().run()}><List size={16} /></ToolbarButton>
        <ToolbarButton label="Nummereret liste" active={paragraphActive && activeEditor?.isActive("orderedList")} disabled={!paragraphActive} onClick={() => activeEditor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolbarButton>
        <ToolbarButton label="Citat" active={activeBlock?.type === "quote"} disabled={!activeBlock} onClick={() => convertActive("quote")}><Quote size={16} /></ToolbarButton>
        <ToolbarButton label="Indsæt billede" onClick={() => addBlock("image")}><ImageIcon size={16} /></ToolbarButton>
        <span className="cms-tool-spacer" />
        {aiOn && (
          <span className="cms-tool-ai">
            <label className="cms-sr-only" htmlFor={`${uid}-aimode`}>AI-handling på det valgte afsnit</label>
            <select id={`${uid}-aimode`} className="cms-select cms-select-sm" value={aiMode} onChange={(e) => setAiMode(e.target.value as ImproveMode)}>
              {(Object.keys(IMPROVE_LABEL) as ImproveMode[]).map((m) => <option key={m} value={m}>{IMPROVE_LABEL[m]}</option>)}
            </select>
            <SuggestButton
              label="AI"
              reason={improveBlocked ?? (activeBlock?.type !== "paragraph" ? "Vælg et afsnit først." : null)}
              loading={activeBlock ? ai?.entries[`improve:${activeBlock.id}`]?.status === "loading" : false}
              onClick={() => activeBlock && activeBlock.type === "paragraph" && ai?.run("improve", { mode: aiMode, text: activeBlock.data.content }, `improve:${activeBlock.id}`)}
            />
          </span>
        )}
        <ToolbarButton label={fullscreen ? "Afslut fuldskærm" : "Fuldskærm"} onClick={() => setFullscreen((v) => !v)}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</ToolbarButton>
      </div>
      {linkOpen && (
        <div className="cms-linkbar">
          <label className="cms-sr-only" htmlFor={`${uid}-link`}>Link-adresse</label>
          <input id={`${uid}-link`} className="cms-input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setLinkOpen(false); }} placeholder="https://… (tom fjerner linket)" autoFocus />
          <button type="button" className="cms-btn cms-btn-primary" onClick={applyLink}>Sæt link</button>
          <button type="button" className="cms-btn cms-btn-quiet" onClick={() => setLinkOpen(false)}>Annullér</button>
        </div>
      )}

      <div id={`${uid}-blocks`} className="cms-block-list">
        {blocks.length === 0 && <p className="cms-empty">Ingen blokke endnu. Tilføj et afsnit nedenfor.</p>}
        {blocks.map((block, index) => {
          const active = block.id === activeId;
          const mediaMatch = block.type === "image" ? media.find((m) => m.id === block.data.mediaId) ?? null : null;
          return (
            <section key={block.id} className={`cms-block${active ? " is-active" : ""}`} onFocusCapture={() => setActiveId(block.id)} onClick={() => setActiveId(block.id)} aria-label={blockRegistry[block.type].label}>
              <header className="cms-block-head">
                <span className="cms-block-label">{blockRegistry[block.type].label}{block.type === "heading" ? ` ${block.data.level}` : ""}</span>
                <span className="cms-row-actions">
                  <button type="button" className="cms-icon-btn" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Flyt op"><ChevronUp size={16} /></button>
                  <button type="button" className="cms-icon-btn" onClick={() => move(index, 1)} disabled={index === blocks.length - 1} aria-label="Flyt ned"><ChevronDown size={16} /></button>
                  {confirmId === block.id ? (
                    <>
                      <button type="button" className="cms-btn cms-btn-danger" onClick={() => { onChange(blocks.filter((_, i) => i !== index)); setConfirmId(null); }}>Slet blok</button>
                      <button type="button" className="cms-btn cms-btn-quiet" onClick={() => setConfirmId(null)}>Behold</button>
                    </>
                  ) : (
                    <button type="button" className="cms-icon-btn" onClick={() => setConfirmId(block.id)} aria-label="Slet blok"><Trash2 size={16} /></button>
                  )}
                </span>
              </header>

              {block.type === "paragraph" && (
                <>
                  <ParagraphEditor value={block.data.content} label={`Afsnit ${index + 1}`} onChange={(content) => update(index, { content })} onFocusEditor={(ed) => { setActiveId(block.id); setActiveEditor(ed); }} />
                  <ImproveSuggestion
                    entry={ai?.entries[`improve:${block.id}`]}
                    onDismiss={() => ai?.dismiss(`improve:${block.id}`)}
                    onApply={(html) => {
                      const content = /<\/?[a-z][\s\S]*>/i.test(html) ? html : html.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("");
                      update(index, { content });
                      ai?.dismiss(`improve:${block.id}`);
                      ai?.onAccepted("improve");
                    }}
                  />
                </>
              )}
              {block.type === "heading" && (
                <div className="cms-row-fields">
                  <label className="cms-sr-only" htmlFor={`${block.id}-h`}>Overskriftstekst</label>
                  <input id={`${block.id}-h`} className="cms-input cms-input-heading" value={block.data.text} onChange={(e) => update(index, { ...block.data, text: e.target.value })} />
                  <label className="cms-sr-only" htmlFor={`${block.id}-lvl`}>Niveau</label>
                  <select id={`${block.id}-lvl`} className="cms-select cms-select-sm" value={block.data.level} onChange={(e) => update(index, { ...block.data, level: Number(e.target.value) === 3 ? 3 : 2 })}>
                    <option value={2}>Niveau 2</option><option value={3}>Niveau 3</option>
                  </select>
                </div>
              )}
              {(block.type === "subheading" || block.type === "manchet") && (
                <>
                  <label className="cms-sr-only" htmlFor={`${block.id}-t`}>{blockRegistry[block.type].label}</label>
                  <input id={`${block.id}-t`} className="cms-input" value={block.data.text} onChange={(e) => update(index, { ...block.data, text: e.target.value })} />
                </>
              )}
              {block.type === "quote" && (
                <div className="cms-stack">
                  <label className="cms-label" htmlFor={`${block.id}-q`}>Citat</label>
                  <textarea id={`${block.id}-q`} className="cms-input" rows={3} value={block.data.quote} onChange={(e) => update(index, { ...block.data, quote: e.target.value })} />
                  <label className="cms-label" htmlFor={`${block.id}-qa`}>Hvem siger det?</label>
                  <input id={`${block.id}-qa`} className="cms-input" value={block.data.attribution ?? ""} onChange={(e) => update(index, { ...block.data, attribution: e.target.value })} />
                  <details className="cms-details">
                    <summary>Kilde til citatet (kræves ved AI-assisterede artikler)</summary>
                    <label className="cms-label" htmlFor={`${block.id}-qk`}>Kilde-URL / reference</label>
                    <input id={`${block.id}-qk`} className="cms-input" value={block.data.kildeUrl ?? ""} onChange={(e) => update(index, { ...block.data, kildeUrl: e.target.value })} />
                    <label className="cms-label" htmlFor={`${block.id}-qd`}>Dato</label>
                    <input id={`${block.id}-qd`} className="cms-input" value={block.data.dato ?? ""} onChange={(e) => update(index, { ...block.data, dato: e.target.value })} placeholder="ÅÅÅÅ-MM-DD" />
                  </details>
                </div>
              )}
              {(block.type === "factbox" || block.type === "infobox") && (
                <div className="cms-stack">
                  <label className="cms-label" htmlFor={`${block.id}-ft`}>Titel</label>
                  <input id={`${block.id}-ft`} className="cms-input" value={block.data.title} onChange={(e) => update(index, { ...block.data, title: e.target.value })} />
                  <label className="cms-label" htmlFor={`${block.id}-fc`}>Indhold</label>
                  <textarea id={`${block.id}-fc`} className="cms-input" rows={4} value={block.data.content} onChange={(e) => update(index, { ...block.data, content: e.target.value })} />
                </div>
              )}
              {block.type === "image" && (
                <div className="cms-stack">
                  {block.data.url && block.data.url !== "https://" ? (
                    <div className="cms-image-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={block.data.url} alt={block.data.alt || ""} />
                    </div>
                  ) : (
                    <button type="button" className="cms-dropzone" onClick={() => setPickerFor(block.id)}><ImageIcon size={20} aria-hidden="true" /> <span>Vælg billede fra mediebiblioteket</span></button>
                  )}
                  <div className="cms-row-actions">
                    <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setPickerFor(pickerFor === block.id ? null : block.id)}>{block.data.mediaId || (block.data.url && block.data.url !== "https://") ? "Skift billede" : "Vælg billede"}</button>
                  </div>
                  {pickerFor === block.id && (
                    <MediaPicker media={media} selectedId={block.data.mediaId} onClose={() => setPickerFor(null)} onSelect={(m) => { update(index, { mediaId: m.id, url: m.url, alt: m.altTekst ?? block.data.alt, caption: m.billedtekst ?? block.data.caption ?? "" }); setPickerFor(null); }} />
                  )}
                  <div className="cms-field">
                    <div className="cms-field-head">
                      <label className="cms-label" htmlFor={`${block.id}-alt`}>Alt-tekst</label>
                      {aiOn && <SuggestButton reason={block.data.url && block.data.url !== "https://" ? null : "Vælg først et billede."} loading={ai?.entries[`alt:${block.id}`]?.status === "loading"} onClick={() => ai?.run("altText", { image: { filnavn: mediaMatch?.filnavn ?? null, billedtekst: block.data.caption ?? null, ophavsperson: mediaMatch?.ophavsperson ?? null } }, `alt:${block.id}`)} />}
                    </div>
                    <input id={`${block.id}-alt`} className="cms-input" value={block.data.alt} onChange={(e) => update(index, { ...block.data, alt: e.target.value })} aria-invalid={!block.data.alt.trim() || undefined} aria-describedby={`${block.id}-altnote`} />
                    <p id={`${block.id}-altnote`} className={`cms-hint${block.data.alt.trim() ? "" : " is-warn"}`}>{block.data.alt.trim() ? "Beskriv hvad billedet viser — til skærmlæsere og søgemaskiner." : "Alt-tekst er påkrævet, før artiklen kan gemmes."}</p>
                    <AltSuggestion entry={ai?.entries[`alt:${block.id}`]} onDismiss={() => ai?.dismiss(`alt:${block.id}`)} onApply={(v) => { update(index, { ...block.data, alt: v.altTekst, ...(v.billedtekst && !block.data.caption ? { caption: v.billedtekst } : {}) }); ai?.dismiss(`alt:${block.id}`); ai?.onAccepted("altText"); }} />
                  </div>
                  <div className="cms-field">
                    <label className="cms-label" htmlFor={`${block.id}-cap`}>Billedtekst</label>
                    <input id={`${block.id}-cap`} className="cms-input" value={block.data.caption ?? ""} onChange={(e) => update(index, { ...block.data, caption: e.target.value })} />
                    {mediaMatch && !mediaMatch.ophavsperson && <p className="cms-hint is-warn">Billedet mangler kreditering (fotograf) i mediebiblioteket.</p>}
                  </div>
                  <details className="cms-details">
                    <summary>Brug ekstern billed-URL</summary>
                    <label className="cms-label" htmlFor={`${block.id}-url`}>URL</label>
                    <input id={`${block.id}-url`} className="cms-input" value={block.data.url} onChange={(e) => update(index, { ...block.data, mediaId: "", url: e.target.value })} />
                  </details>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="cms-addbar" role="group" aria-label="Tilføj blok">
        <span className="cms-label"><Plus size={14} aria-hidden="true" /> Tilføj</span>
        {ADD_TYPES.map((t) => (
          <button key={t.type} type="button" className="cms-chip-btn" onClick={() => addBlock(t.type)}>{t.short}</button>
        ))}
      </div>
    </div>
  );
}
