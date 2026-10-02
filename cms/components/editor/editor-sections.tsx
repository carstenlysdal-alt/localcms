"use client";

import { useState, useTransition } from "react";
import { Copy, Plus, Trash2, X } from "lucide-react";
import {
  buildShareLink, checkPost, composePost, CREDIT_ROLES, defaultUtm, META_LIMITS, normalizeHashtag, PLATFORM_SPECS, postLength, SCHEMA_TYPES, SOCIAL_PLATFORMS, TWITTER_CARDS,
  type ArticleMetaForm, type SocialPlatform, type SocialPost,
} from "@/lib/article-meta";
import type { SeoScore } from "@/lib/editor/seo-score";
import type { FormState } from "@/lib/editor/form-state";
import { fromLocalInput, toLocalInput } from "@/lib/editor/format";
import type { ArticleEditorValue, EditorFlags, EditorOptions, EditorSite } from "@/lib/editor/types";
import type { ArticleSeoInput } from "@/lib/seo/article-seo";
import { AI_USAGE_VALUES, AI_USE_NONE, CONTENT_TYPES } from "@/lib/marking";
import type { EditorialRequest, EditorialTask } from "@/lib/ai/editorial-schemas";
import { checkSlugAction } from "@/app/redaktion/artikler/draft-actions";
import { Accordion, AiChip, CharCounter, SuggestButton } from "./primitives";
import { CoverField } from "./media-picker";
import { SharePreviews } from "./share-previews";

export type AiBundle = {
  enabled: boolean;
  /** Grund til at en opgave er spærret (Krimi/Sundhed for tekstgenererende); null = tilladt. */
  blocked: (task: EditorialTask) => string | null;
  loading: (task: EditorialTask) => boolean;
  run: (task: EditorialTask, params?: NonNullable<EditorialRequest["params"]>) => void;
  tray: (task: EditorialTask) => React.ReactNode;
};

export type SectionProps = {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  setMeta: (patch: Partial<ArticleMetaForm>) => void;
  options: EditorOptions;
  flags: EditorFlags;
  site: EditorSite;
  article: ArticleEditorValue;
  ai: AiBundle;
  score: SeoScore;
  seoInput: ArticleSeoInput;
  articleUrl: string;
  live: boolean;
};

function Field({ id, label, hint, counter, action, children, wide }: { id: string; label: string; hint?: React.ReactNode; counter?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`cms-field${wide ? " is-wide" : ""}`}>
      <div className="cms-field-head">
        <label className="cms-label" htmlFor={id}>{label}</label>
        <span className="cms-field-tools">{counter}{action}</span>
      </div>
      {children}
      {hint && <p className="cms-hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}

function Toggle({ id, checked, onChange, label, hint, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <div className="cms-toggle">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-describedby={hint ? `${id}-hint` : undefined} />
      <label htmlFor={id}>{label}</label>
      {hint && <p className="cms-hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}

function ChipInput({ id, label, values, onChange, max, placeholder, hint, format }: { id: string; label: string; values: string[]; onChange: (v: string[]) => void; max: number; placeholder?: string; hint?: string; format?: (v: string) => string }) {
  const [draft, setDraft] = useState("");
  function commit() {
    const parts = draft.split(/[,\n]/).map((s) => (format ? format(s) : s.trim())).filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p);
    onChange(next);
    setDraft("");
  }
  return (
    <div className="cms-field">
      <label className="cms-label" htmlFor={id}>{label}</label>
      <div className="cms-chips">
        {values.map((v) => (
          <span key={v} className="cms-chip">{format ? `#${v}` : v}<button type="button" className="cms-chip-x" aria-label={`Fjern ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}><X size={12} aria-hidden="true" /></button></span>
        ))}
        <input id={id} className="cms-chip-input" value={draft} placeholder={values.length >= max ? `Højst ${max}` : placeholder} disabled={values.length >= max} aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); } if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1)); }} />
      </div>
      {hint && <p className="cms-hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}

// ── SEO & metadata ──────────────────────────────────────────────────────────

export function ScoreList({ score }: { score: SeoScore }) {
  return (
    <div className="cms-score">
      <div className="cms-score-head">
        <span className={`cms-score-num is-${score.score >= 85 ? "ok" : score.score >= 60 ? "warn" : "bad"}`} aria-label={`SEO-score ${score.score} af 100`}>{score.score}</span>
        <div><strong>Metadata {score.complete ? "komplet" : "ikke komplet"}</strong><p className="cms-muted">Beregnes ud fra faste regler. Det er en rettesnor, ikke en spærring.</p></div>
      </div>
      <ul className="cms-checklist">
        {score.items.map((i) => (
          <li key={i.id} className={`is-${i.status}`}>
            <span className="cms-check-mark" aria-hidden="true">{i.status === "ok" ? "✓" : i.status === "warn" ? "!" : "×"}</span>
            <span><strong>{i.label}</strong> <span className="cms-muted">— {i.hint}</span></span>
            <span className="sr-only cms-sr-only">{i.status === "ok" ? "i orden" : i.status === "warn" ? "advarsel" : "mangler"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SeoSection(p: SectionProps) {
  const { form, set, ai, site } = p;
  const [slugState, setSlugState] = useState<{ available: boolean; suggestion: string | null } | null>(null);
  const [, startTransition] = useTransition();

  function checkSlug(slug: string) {
    if (!slug) { setSlugState(null); return; }
    startTransition(async () => setSlugState(await checkSlugAction(slug, form.titel, p.article.id)));
  }

  return (
    <Accordion title="SEO & metadata" summary={`SEO ${p.score.score}/100`}>
      <ScoreList score={p.score} />

      <Field id="slug" label="Slug (URL)" hint={p.live ? "Ændring af slug på en publiceret artikel opretter automatisk en permanent omdirigering fra den gamle adresse." : "Udfyldes automatisk ud fra titlen, indtil du selv redigerer den."}
        action={<>
          <button type="button" className="cms-btn cms-btn-quiet" onClick={() => startTransition(async () => { const r = await checkSlugAction("", form.titel, p.article.id); if (r.suggestion) { set("slug", r.suggestion); setSlugState({ available: true, suggestion: null }); } })} disabled={form.titel.trim().length < 3}>Fra titel</button>
          {ai.enabled && <SuggestButton loading={ai.loading("slug")} reason={ai.blocked("slug")} onClick={() => ai.run("slug")} />}
        </>}>
        <input id="slug" className="cms-input cms-mono" value={form.slug} onChange={(e) => { set("slug", e.target.value.toLowerCase()); setSlugState(null); }} onBlur={(e) => checkSlug(e.target.value)} aria-describedby="slug-hint slug-state" spellCheck={false} />
        <p id="slug-state" className="cms-hint" aria-live="polite">
          {slugState ? (slugState.available ? "Sluggen er ledig." : `Sluggen bruges allerede.${slugState.suggestion ? ` Forslag: ${slugState.suggestion}` : ""}`) : ""}
        </p>
      </Field>
      {ai.tray("slug")}

      <Field id="seoTitel" label="SEO-titel" counter={<CharCounter text={form.seoTitel || form.titel} max={60} />} hint="Vises som blå titel i Google (højst ca. 60 tegn). Tom = artiklens titel."
        action={ai.enabled && <SuggestButton loading={ai.loading("seo")} reason={ai.blocked("seo")} label="Foreslå SEO" onClick={() => ai.run("seo")} />}>
        <input id="seoTitel" className="cms-input" value={form.seoTitel} onChange={(e) => set("seoTitel", e.target.value)} placeholder={form.titel} aria-describedby="seoTitel-hint" />
      </Field>
      <Field id="seoBeskrivelse" label="Metabeskrivelse" counter={<CharCounter text={form.seoBeskrivelse || form.manchet} max={155} />} hint="Vises under titlen i Google (70-155 tegn). Tom = underrubrikken.">
        <textarea id="seoBeskrivelse" className="cms-input" rows={3} value={form.seoBeskrivelse} onChange={(e) => set("seoBeskrivelse", e.target.value)} placeholder={form.manchet} aria-describedby="seoBeskrivelse-hint" />
      </Field>
      {ai.tray("seo")}

      <Field id="sprog" label="Sprog" hint="Sprogkode, fx da eller en. Styrer og:locale og schema.org inLanguage.">
        <input id="sprog" className="cms-input cms-input-sm" value={form.sprog} onChange={(e) => set("sprog", e.target.value)} maxLength={10} aria-describedby="sprog-hint" />
      </Field>

      <h4 className="cms-subhead">Forhåndsvisning</h4>
      <SharePreviews input={p.seoInput} siteName={site.navn} />
    </Accordion>
  );
}

// ── Sociale medier ──────────────────────────────────────────────────────────

export function SocialSection(p: SectionProps) {
  const { form, setMeta, ai } = p;
  const [platform, setPlatform] = useState<SocialPlatform>("facebook");
  const [copied, setCopied] = useState(false);
  const post: SocialPost = form.meta.social[platform] ?? { tekst: "", hashtags: [] };
  const spec = PLATFORM_SPECS[platform];
  const shareLink = buildShareLink(p.articleUrl, post.utm);
  const check = checkPost(platform, { ...post, link: p.articleUrl || "https://x" });
  const filled = SOCIAL_PLATFORMS.filter((x) => (form.meta.social[x]?.tekst ?? "").trim()).length;

  function setPost(next: Partial<SocialPost>) {
    setMeta({ social: { ...form.meta.social, [platform]: { ...post, ...next } } });
  }

  const composed = composePost(platform, post, p.articleUrl ? shareLink : undefined);

  return (
    <Accordion title="Sociale medier" summary={`${filled}/${SOCIAL_PLATFORMS.length} opslag`}>
      <div role="tablist" aria-label="Platform" className="cms-tabs-inline">
        {SOCIAL_PLATFORMS.map((x) => (
          <button key={x} type="button" role="tab" id={`tab-${x}`} aria-selected={platform === x} aria-controls="social-panel" tabIndex={platform === x ? 0 : -1} className="cms-tab" onClick={() => setPlatform(x)}
            onKeyDown={(e) => {
              const i = SOCIAL_PLATFORMS.indexOf(platform);
              if (e.key === "ArrowRight") setPlatform(SOCIAL_PLATFORMS[(i + 1) % SOCIAL_PLATFORMS.length]);
              if (e.key === "ArrowLeft") setPlatform(SOCIAL_PLATFORMS[(i + SOCIAL_PLATFORMS.length - 1) % SOCIAL_PLATFORMS.length]);
            }}>
            {PLATFORM_SPECS[x].label}{(form.meta.social[x]?.tekst ?? "").trim() ? <span className="cms-tab-dot" aria-label="udfyldt" /> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="social-panel" aria-labelledby={`tab-${platform}`} className="cms-preview-panel">
        <Field id={`soc-${platform}`} label={`Opslagstekst til ${spec.label}`}
          counter={<span className={`cms-counter${check.errors.length ? " is-over" : check.warnings.length ? " is-near" : ""}`}>{postLength(platform, { ...post, link: p.articleUrl || undefined })}/{spec.max}</span>}
          hint={spec.tone}
          action={ai.enabled && <SuggestButton loading={ai.loading("social")} reason={ai.blocked("social")} label={`Foreslå ${spec.label}`} onClick={() => ai.run("social", { platforms: [platform] })} />}>
          <textarea id={`soc-${platform}`} className="cms-input" rows={platform === "x" || platform === "bluesky" ? 4 : 6} value={post.tekst} onChange={(e) => setPost({ tekst: e.target.value })} aria-describedby={`soc-${platform}-hint`} aria-invalid={check.errors.length ? true : undefined} />
        </Field>
        {check.errors.map((m) => <p key={m} className="cms-hint is-warn" role="alert">{m}</p>)}
        {check.warnings.map((m) => <p key={m} className="cms-hint is-warn">{m}</p>)}
        <ChipInput id={`soc-${platform}-tags`} label="Hashtags" values={post.hashtags} onChange={(hashtags) => setPost({ hashtags })} max={spec.maxHashtags} format={normalizeHashtag} placeholder="Tilføj hashtag og tryk Enter" hint={`Anbefalet højst ${spec.recommendedHashtags}.`} />
        <div className="cms-toggle">
          <input id={`soc-${platform}-utm`} type="checkbox" checked={Boolean(post.utm)} onChange={(e) => setPost({ utm: e.target.checked ? defaultUtm(platform, form.slug || "artikel") : undefined })} />
          <label htmlFor={`soc-${platform}-utm`}>Tilføj UTM-parametre til linket</label>
        </div>
        {post.utm && (
          <div className="cms-grid-3">
            {(["source", "medium", "campaign"] as const).map((k) => (
              <div className="cms-field" key={k}>
                <label className="cms-label" htmlFor={`soc-${platform}-${k}`}>utm_{k}</label>
                <input id={`soc-${platform}-${k}`} className="cms-input" value={post.utm?.[k] ?? ""} onChange={(e) => setPost({ utm: { ...(post.utm ?? defaultUtm(platform, form.slug)), [k]: e.target.value } })} />
              </div>
            ))}
          </div>
        )}
        <p className="cms-hint">{spec.linkInline ? <>Link i opslaget: <code className="cms-mono">{shareLink || "(vælg sektion og slug først)"}</code>{platform === "x" ? " (tæller 23 tegn)" : ""}</> : "Instagram: links i billedtekster er ikke klikbare. Skriv “link i bio”."}</p>
        <div className="cms-row-actions">
          <button type="button" className="cms-btn cms-btn-secondary" disabled={!composed} onClick={async () => { try { await navigator.clipboard.writeText(composed); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ingen adgang til udklipsholder */ } }}>
            <Copy size={14} aria-hidden="true" /> {copied ? "Kopieret" : "Kopiér opslag"}
          </button>
        </div>
      </div>
      {ai.tray("social")}

      <h4 className="cms-subhead">Open Graph (Facebook, LinkedIn)</h4>
      <Field id="ogTitel" label="OG-titel" counter={<CharCounter text={form.meta.ogTitel ?? ""} max={META_LIMITS.ogTitel} />} hint="Tom = SEO-titel, ellers titel.">
        <input id="ogTitel" className="cms-input" value={form.meta.ogTitel ?? ""} onChange={(e) => setMeta({ ogTitel: e.target.value })} placeholder={form.seoTitel || form.titel} aria-describedby="ogTitel-hint" />
      </Field>
      <Field id="ogBeskrivelse" label="OG-beskrivelse" counter={<CharCounter text={form.meta.ogBeskrivelse ?? ""} max={META_LIMITS.ogBeskrivelse} />} hint="Tom = metabeskrivelse, ellers underrubrik.">
        <textarea id="ogBeskrivelse" className="cms-input" rows={2} value={form.meta.ogBeskrivelse ?? ""} onChange={(e) => setMeta({ ogBeskrivelse: e.target.value })} placeholder={form.seoBeskrivelse || form.manchet} aria-describedby="ogBeskrivelse-hint" />
      </Field>
      <OptionalImage label="OG-billede (valgfrit)" id="og-image" p={p} value={form.meta.ogMediaId ?? ""} onChange={(id) => setMeta({ ogMediaId: id || null })} hint="Tomt = featurebilledet (beskåret til 1200×630). Eget billede bruges uden beskæring: brug 1200×630 px." />

      <h4 className="cms-subhead">X (Twitter)</h4>
      <Field id="twitterCard" label="Korttype">
        <select id="twitterCard" className="cms-select" value={form.meta.twitterCard ?? ""} onChange={(e) => setMeta({ twitterCard: (e.target.value || null) as ArticleMetaForm["twitterCard"] })}>
          <option value="">Standard (stort billedkort)</option>
          {TWITTER_CARDS.map((c) => <option key={c} value={c}>{c === "summary" ? "Lille kort (summary)" : "Stort billedkort (summary_large_image)"}</option>)}
        </select>
      </Field>
      <Field id="twitterTitel" label="X-titel" counter={<CharCounter text={form.meta.twitterTitel ?? ""} max={META_LIMITS.twitterTitel} />} hint="Tom = OG-titel.">
        <input id="twitterTitel" className="cms-input" value={form.meta.twitterTitel ?? ""} onChange={(e) => setMeta({ twitterTitel: e.target.value })} aria-describedby="twitterTitel-hint" />
      </Field>
      <Field id="twitterBeskrivelse" label="X-beskrivelse" counter={<CharCounter text={form.meta.twitterBeskrivelse ?? ""} max={META_LIMITS.twitterBeskrivelse} />} hint="Tom = OG-beskrivelse.">
        <textarea id="twitterBeskrivelse" className="cms-input" rows={2} value={form.meta.twitterBeskrivelse ?? ""} onChange={(e) => setMeta({ twitterBeskrivelse: e.target.value })} aria-describedby="twitterBeskrivelse-hint" />
      </Field>
      <OptionalImage label="X-billede (valgfrit)" id="tw-image" p={p} value={form.meta.twitterMediaId ?? ""} onChange={(id) => setMeta({ twitterMediaId: id || null })} hint="Tomt = OG-billedet." />
      <div className="cms-row-actions">
        {ai.enabled && <SuggestButton loading={ai.loading("og")} reason={ai.blocked("og")} label="Foreslå OG- og X-tekster" onClick={() => ai.run("og")} />}
      </div>
      {ai.tray("og")}

      <h4 className="cms-subhead">Forhåndsvisning</h4>
      <SharePreviews input={p.seoInput} siteName={p.site.navn} />
    </Accordion>
  );
}

function OptionalImage({ label, id, p, value, onChange, hint }: { label: string; id: string; p: SectionProps; value: string; onChange: (id: string) => void; hint?: string }) {
  return (
    <div className="cms-field" id={id}>
      <CoverField media={p.options.media} value={value} onChange={onChange} label={label} />
      {hint && <p className="cms-hint">{hint}</p>}
    </div>
  );
}

// ── Planlægning ─────────────────────────────────────────────────────────────

export function PlanningSection(p: SectionProps) {
  const { form, set, setMeta, ai, flags, options } = p;
  const [renderedAt] = useState(() => Date.now());
  const planlagt = toLocalInput(form.planlagtTid);
  const udloeb = toLocalInput(form.meta.udloebTid);

  return (
    <Accordion title="Planlægning" summary={form.planlagtTid ? `Planlagt ${planlagt.replace("T", " ")}` : "Ikke planlagt"}>
      <Field id="planlagtTid" label="Udgivelsestidspunkt" hint={<>Dansk tid. En redaktør med publiceringsret sætter status <strong>Planlagt</strong> under handlingerne øverst; artiklen publiceres derefter automatisk, når tidspunktet er nået.</>}
        action={ai.enabled && <SuggestButton loading={ai.loading("publishTime")} reason={ai.blocked("publishTime")} label="Foreslå tidspunkt" onClick={() => ai.run("publishTime", { weekday: new Intl.DateTimeFormat("da-DK", { weekday: "long" }).format(new Date()) })} />}>
        <div className="cms-inline">
          <input id="planlagtTid" type="datetime-local" className="cms-input cms-input-sm" value={planlagt} onChange={(e) => set("planlagtTid", fromLocalInput(e.target.value))} aria-describedby="planlagtTid-hint" />
          {planlagt && <button type="button" className="cms-btn cms-btn-quiet" onClick={() => set("planlagtTid", "")}>Ryd</button>}
        </div>
      </Field>
      {ai.tray("publishTime")}
      {p.article.status === "Planlagt" && form.planlagtTid && new Date(form.planlagtTid).getTime() < renderedAt && (
        <p className="cms-hint is-warn" role="status">Tidspunktet er passeret, men artiklen er endnu ikke publiceret. Den publiceres ved næste kørsel af den automatiske udgivelse — eller publicér manuelt.</p>
      )}

      <Field id="forfatterId" label="Forfatter">
        <select id="forfatterId" className="cms-select" value={form.forfatterId} onChange={(e) => set("forfatterId", e.target.value)}>
          <option value="">Vælg forfatter</option>
          {options.authors.map((a) => <option key={a.id} value={a.id}>{a.navn}</option>)}
        </select>
      </Field>

      <Field id="udloebTid" label="Udløbstidspunkt (valgfrit)" hint="Sendes til søgemaskiner (unavailable_after) og schema.org (expires). Artiklen fjernes ikke automatisk fra sitet.">
        <div className="cms-inline">
          <input id="udloebTid" type="datetime-local" className="cms-input cms-input-sm" value={udloeb} onChange={(e) => setMeta({ udloebTid: fromLocalInput(e.target.value) || null })} aria-describedby="udloebTid-hint" />
          {udloeb && <button type="button" className="cms-btn cms-btn-quiet" onClick={() => setMeta({ udloebTid: null })}>Ryd</button>}
        </div>
      </Field>

      <fieldset className="cms-fieldset">
        <legend>Synlighed</legend>
        <Toggle id="vis-noindex" checked={form.meta.robotsNoindex} onChange={(v) => setMeta({ robotsNoindex: v })} label="Skjul for søgemaskiner (noindex)" hint="Artiklen kan stadig læses via link, men vises ikke i Google og udelades fra sitemaps." />
        {flags.canControlFrontpage ? (
          <>
            <Toggle id="breaking" checked={form.breaking} onChange={(v) => set("breaking", v)} label="Hastenyhed (breaking)" />
            <Toggle id="pinned" checked={form.pinned} onChange={(v) => set("pinned", v)} label="Fastgjort på forsiden" />
          </>
        ) : (
          <p className="cms-hint">Hastenyhed og fastgørelse på forsiden sættes af forsideredaktionen.</p>
        )}
      </fieldset>
    </Accordion>
  );
}

// ── AI ──────────────────────────────────────────────────────────────────────

const AI_TASKS: Array<{ task: EditorialTask; label: string; hint: string }> = [
  { task: "headlines", label: "Overskrifter", hint: "3-5 varianter + A/B-par" },
  { task: "subheading", label: "Underrubrik", hint: "Ud fra brødteksten" },
  { task: "summary", label: "Resumé (TL;DR)", hint: "Kort + punkter" },
  { task: "seo", label: "SEO-titel og beskrivelse", hint: "Med længdekrav" },
  { task: "og", label: "OG- og X-tekster", hint: "Til deling" },
  { task: "social", label: "Opslagstekster (alle)", hint: "Pr. platform" },
  { task: "tagsGeo", label: "Tags og områder", hint: "Fra eksisterende lister" },
  { task: "factcheck", label: "Faktatjek", hint: "Kun mod dine kilder" },
  { task: "seoComment", label: "SEO-kommentar", hint: "Oven på scoren" },
  { task: "publishTime", label: "Udgivelsestidspunkt", hint: "Generelt råd" },
];

export function AiSection(p: SectionProps) {
  const { ai } = p;
  const restricted = ai.blocked("headlines");
  return (
    <Accordion title="AI" badge={<AiChip />} summary={ai.enabled ? "Forslag — intet anvendes uden dit klik" : "Ikke tilgængelig"}>
      {!ai.enabled ? (
        <p className="cms-muted">Du har ikke adgang til AI i artikelarbejdet. Bed en administrator om rettigheden “article.ai.use”.</p>
      ) : (
        <>
          <p className="cms-muted">AI foreslår — du beslutter. Tekstforslag (overskrift, underrubrik, resumé, omskrivning) registreres som AI-brug under Mærkning, når du anvender dem. Forslag til metadata mærkes ikke.</p>
          {restricted && <p className="cms-hint is-warn" role="note">{restricted}</p>}
          <ul className="cms-ai-grid">
            {AI_TASKS.map((t) => (
              <li key={t.task}>
                <SuggestButton label={t.label} loading={ai.loading(t.task)} reason={ai.blocked(t.task)} title={t.hint} onClick={() => ai.run(t.task, t.task === "social" ? {} : undefined)} />
                <span className="cms-muted">{t.hint}</span>
              </li>
            ))}
          </ul>
          {AI_TASKS.map((t) => <div key={t.task}>{ai.tray(t.task)}</div>)}
        </>
      )}
    </Accordion>
  );
}

// ── Kilder ──────────────────────────────────────────────────────────────────

export function SourcesSection(p: SectionProps) {
  const { form, setMeta, ai } = p;
  const kilder = form.meta.kilder;
  function setRow(i: number, patch: Partial<(typeof kilder)[number]>) {
    setMeta({ kilder: kilder.map((k, x) => (x === i ? { ...k, ...patch } : k)) });
  }
  return (
    <Accordion title="Kilder" summary={`${kilder.length} angivet`}>
      <p className="cms-hint is-warn" role="note">Kildelisten udgives i artiklens struktureret data (schema.org). Skriv aldrig fortrolige kilder eller kilder, der skal beskyttes, her.</p>
      {kilder.length === 0 && <p className="cms-muted">Ingen kilder endnu.</p>}
      <ul className="cms-rows">
        {kilder.map((k, i) => (
          <li key={i} className="cms-row-card">
            <div className="cms-grid-2">
              <div className="cms-field"><label className="cms-label" htmlFor={`k-t-${i}`}>Titel</label><input id={`k-t-${i}`} className="cms-input" value={k.titel} onChange={(e) => setRow(i, { titel: e.target.value })} /></div>
              <div className="cms-field"><label className="cms-label" htmlFor={`k-u-${i}`}>Udgiver</label><input id={`k-u-${i}`} className="cms-input" value={k.udgiver ?? ""} onChange={(e) => setRow(i, { udgiver: e.target.value })} /></div>
              <div className="cms-field"><label className="cms-label" htmlFor={`k-l-${i}`}>URL</label><input id={`k-l-${i}`} className="cms-input" value={k.url ?? ""} onChange={(e) => setRow(i, { url: e.target.value })} placeholder="https://…" /></div>
              <div className="cms-field"><label className="cms-label" htmlFor={`k-d-${i}`}>Dato</label><input id={`k-d-${i}`} className="cms-input" value={k.dato ?? ""} onChange={(e) => setRow(i, { dato: e.target.value })} placeholder="ÅÅÅÅ-MM-DD" /></div>
            </div>
            <button type="button" className="cms-btn cms-btn-quiet" onClick={() => setMeta({ kilder: kilder.filter((_, x) => x !== i) })}><Trash2 size={14} aria-hidden="true" /> Fjern kilde</button>
          </li>
        ))}
      </ul>
      <div className="cms-row-actions">
        <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setMeta({ kilder: [...kilder, { titel: "", url: null, udgiver: null, dato: null }] })} disabled={kilder.length >= META_LIMITS.kilder}><Plus size={14} aria-hidden="true" /> Tilføj kilde</button>
        {ai.enabled && <SuggestButton label="Faktatjek mod kilder" loading={ai.loading("factcheck")} reason={ai.blocked("factcheck") ?? (kilder.filter((k) => k.titel.trim()).length ? null : "Tilføj mindst én kilde.")} onClick={() => ai.run("factcheck")} />}
      </div>
      {ai.tray("factcheck")}
    </Accordion>
  );
}

// ── Avanceret ───────────────────────────────────────────────────────────────

export function AdvancedSection(p: SectionProps) {
  const { form, setMeta, options } = p;
  const m = form.meta;
  const credits = m.medforfattere;
  const translations = Object.entries(m.oversaettelser ?? {});
  return (
    <Accordion title="Avanceret" summary="Canonical, robots, schema, paywall …">
      <Field id="canonicalUrl" label="Canonical-URL" hint="Kun hvis indholdet oprindeligt er udgivet et andet sted. Tom = artiklens egen adresse.">
        <input id="canonicalUrl" className="cms-input" value={m.canonicalUrl ?? ""} onChange={(e) => setMeta({ canonicalUrl: e.target.value })} placeholder="https://…" aria-describedby="canonicalUrl-hint" />
      </Field>
      <fieldset className="cms-fieldset">
        <legend>Robots</legend>
        <Toggle id="adv-noindex" checked={m.robotsNoindex} onChange={(v) => setMeta({ robotsNoindex: v })} label="noindex — vis ikke i søgemaskiner" />
        <Toggle id="adv-nofollow" checked={m.robotsNofollow} onChange={(v) => setMeta({ robotsNofollow: v })} label="nofollow — følg ikke links i artiklen" />
      </fieldset>
      <ChipInput id="keywords" label="Nøgleord (keywords)" values={m.keywords} onChange={(keywords) => setMeta({ keywords })} max={META_LIMITS.keywords} placeholder="Tilføj nøgleord og tryk Enter" hint="Bruges i meta keywords og schema.org keywords. Tom = tags og områder." />
      <ChipInput id="newsKeywords" label="Google News-nøgleord (news_keywords)" values={m.newsKeywords} onChange={(newsKeywords) => setMeta({ newsKeywords })} max={META_LIMITS.newsKeywords} placeholder="Højst 10" hint="Bruges i meta news_keywords og news-sitemap." />

      <Field id="schemaType" label="Schema-type" hint="Tom = automatisk (NewsArticle, OpinionNewsArticle i Debat, Article for kommercielt indhold).">
        <select id="schemaType" className="cms-select" value={m.schemaType ?? ""} onChange={(e) => setMeta({ schemaType: (e.target.value || null) as ArticleMetaForm["schemaType"] })} aria-describedby="schemaType-hint">
          <option value="">Automatisk</option>
          {SCHEMA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <fieldset className="cms-fieldset">
        <legend>Adgang (paywall)</legend>
        <Toggle id="free" checked={m.isAccessibleForFree} onChange={(v) => setMeta({ isAccessibleForFree: v, paywall: v ? null : m.paywall })} label="Gratis at læse (isAccessibleForFree)" />
        {!m.isAccessibleForFree && (
          <Field id="paywallSel" label="CSS-selector for det betalte indhold" hint="Fx .site-article-blocks. Tom = hele brødteksten.">
            <input id="paywallSel" className="cms-input cms-mono" value={m.paywall?.cssSelector ?? ""} onChange={(e) => setMeta({ paywall: e.target.value ? { cssSelector: e.target.value } : null })} aria-describedby="paywallSel-hint" />
          </Field>
        )}
      </fieldset>

      <Field id="dateline" label="Dateline" counter={<CharCounter text={m.dateline ?? ""} max={META_LIMITS.dateline} />} hint="Fx “NÆSTVED —”. Bruges i schema.org for nyhedsartikler.">
        <input id="dateline" className="cms-input" value={m.dateline ?? ""} onChange={(e) => setMeta({ dateline: e.target.value })} aria-describedby="dateline-hint" />
      </Field>
      <div className="cms-grid-2">
        <Field id="laesetid" label="Læsetid (minutter)" hint="Tom = beregnes ud fra antal ord.">
          <input id="laesetid" type="number" min={1} max={240} className="cms-input" value={m.laesetidMin ?? ""} onChange={(e) => setMeta({ laesetidMin: e.target.value ? Number(e.target.value) : null })} aria-describedby="laesetid-hint" />
        </Field>
        <Field id="begivenhed" label="Begivenhedstidspunkt" hint="Hvornår det beskrevne skete (contentReferenceTime).">
          <input id="begivenhed" type="datetime-local" className="cms-input" value={toLocalInput(m.begivenhedTid)} onChange={(e) => setMeta({ begivenhedTid: fromLocalInput(e.target.value) || null })} aria-describedby="begivenhed-hint" />
        </Field>
      </div>
      <Toggle id="standout" checked={m.standout} onChange={(v) => setMeta({ standout: v })} label="Google News standout" hint="Markér som en særlig vigtig, originalt journalistisk historie (højst få pr. uge)." />

      <Field id="substantiel" label="Sidst substantielt opdateret" hint="Redaktørens vurdering. Bruges som dateModified i stedet for tekniske gem.">
        <div className="cms-inline">
          <input id="substantiel" type="datetime-local" className="cms-input cms-input-sm" value={toLocalInput(m.sistSubstantielOpdateringTid)} onChange={(e) => setMeta({ sistSubstantielOpdateringTid: fromLocalInput(e.target.value) || null })} aria-describedby="substantiel-hint" />
          <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setMeta({ sistSubstantielOpdateringTid: new Date().toISOString() })}>Nu</button>
          {m.sistSubstantielOpdateringTid && <button type="button" className="cms-btn cms-btn-quiet" onClick={() => setMeta({ sistSubstantielOpdateringTid: null })}>Ryd</button>}
        </div>
      </Field>

      <h4 className="cms-subhead">Medforfattere og roller</h4>
      <ul className="cms-rows">
        {credits.map((c, i) => (
          <li key={i} className="cms-row-card">
            <div className="cms-grid-3">
              <div className="cms-field">
                <label className="cms-label" htmlFor={`c-a-${i}`}>Forfatter</label>
                <select id={`c-a-${i}`} className="cms-select" value={c.authorId ?? ""} onChange={(e) => { const a = options.authors.find((x) => x.id === e.target.value); setMeta({ medforfattere: credits.map((x, n) => (n === i ? { ...x, authorId: e.target.value || null, navn: a ? a.navn : x.navn } : x)) }); }}>
                  <option value="">Ekstern (skriv navn)</option>
                  {options.authors.map((a) => <option key={a.id} value={a.id}>{a.navn}</option>)}
                </select>
              </div>
              <div className="cms-field"><label className="cms-label" htmlFor={`c-n-${i}`}>Navn</label><input id={`c-n-${i}`} className="cms-input" value={c.navn} onChange={(e) => setMeta({ medforfattere: credits.map((x, n) => (n === i ? { ...x, navn: e.target.value } : x)) })} /></div>
              <div className="cms-field"><label className="cms-label" htmlFor={`c-r-${i}`}>Rolle</label>
                <select id={`c-r-${i}`} className="cms-select" value={c.rolle} onChange={(e) => setMeta({ medforfattere: credits.map((x, n) => (n === i ? { ...x, rolle: e.target.value } : x)) })}>
                  {CREDIT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <button type="button" className="cms-btn cms-btn-quiet" onClick={() => setMeta({ medforfattere: credits.filter((_, n) => n !== i) })}><Trash2 size={14} aria-hidden="true" /> Fjern</button>
          </li>
        ))}
      </ul>
      <button type="button" className="cms-btn cms-btn-secondary" disabled={credits.length >= META_LIMITS.medforfattere} onClick={() => setMeta({ medforfattere: [...credits, { authorId: null, navn: "", rolle: "Fotograf" }] })}><Plus size={14} aria-hidden="true" /> Tilføj</button>

      <h4 className="cms-subhead">Oversættelser (hreflang)</h4>
      <ul className="cms-rows">
        {translations.map(([lang, t]) => (
          <li key={lang} className="cms-row-card">
            <div className="cms-grid-2">
              <div className="cms-field"><label className="cms-label" htmlFor={`t-l-${lang}`}>Sprogkode</label><input id={`t-l-${lang}`} className="cms-input cms-input-sm" value={lang} readOnly /></div>
              <div className="cms-field"><label className="cms-label" htmlFor={`t-u-${lang}`}>URL til oversættelsen</label><input id={`t-u-${lang}`} className="cms-input" value={t.url} onChange={(e) => setMeta({ oversaettelser: { ...(m.oversaettelser ?? {}), [lang]: { ...t, url: e.target.value } } })} /></div>
            </div>
            <button type="button" className="cms-btn cms-btn-quiet" onClick={() => { const next = { ...(m.oversaettelser ?? {}) }; delete next[lang]; setMeta({ oversaettelser: Object.keys(next).length ? next : null }); }}><Trash2 size={14} aria-hidden="true" /> Fjern</button>
          </li>
        ))}
      </ul>
      <AddTranslation onAdd={(lang) => setMeta({ oversaettelser: { ...(m.oversaettelser ?? {}), [lang]: { url: "https://", titel: null } } })} existing={translations.map(([l]) => l)} />
    </Accordion>
  );
}

function AddTranslation({ onAdd, existing }: { onAdd: (lang: string) => void; existing: string[] }) {
  const [lang, setLang] = useState("");
  const valid = /^[a-z]{2}(-[A-Za-z]{2})?$/.test(lang) && !existing.includes(lang);
  return (
    <div className="cms-inline">
      <label className="cms-sr-only" htmlFor="new-lang">Sprogkode</label>
      <input id="new-lang" className="cms-input cms-input-sm" value={lang} onChange={(e) => setLang(e.target.value.trim())} placeholder="en" maxLength={8} />
      <button type="button" className="cms-btn cms-btn-secondary" disabled={!valid} onClick={() => { onAdd(lang); setLang(""); }}><Plus size={14} aria-hidden="true" /> Tilføj sprog</button>
    </div>
  );
}

// ── Mærkning og AI-brug ─────────────────────────────────────────────────────

export function MarkingSection(p: SectionProps & { aiRestricted: boolean; aiNone: boolean; aiUses: string[]; setAiBrug: (list: string[]) => void; highlight: boolean; hasUnverifiedSource: boolean }) {
  const { form, set } = p;
  const type = form.indholdstype;
  return (
    <Accordion title="Mærkning og AI-brug" summary={type === "Uafhængig" ? "Uafhængig" : type} defaultOpen={type !== "Uafhængig" || p.highlight}>
      <Field id="indholdstype" label="Indholdstype">
        <select id="indholdstype" className="cms-select" value={type} onChange={(e) => set("indholdstype", e.target.value)}>
          {CONTENT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>
      {(type === "Partner" || type === "Sponsoreret") && (
        <div className="cms-subbox">
          <p className="cms-hint">Obligatorisk før publicering.</p>
          <Field id="markingSponsor" label="Sponsor/partner"><input id="markingSponsor" className="cms-input" value={form.markingSponsor} onChange={(e) => set("markingSponsor", e.target.value)} required /></Field>
          <Field id="markingLabel" label="Synlig mærkning"><input id="markingLabel" className="cms-input" value={form.markingLabel} onChange={(e) => set("markingLabel", e.target.value)} placeholder={type === "Partner" ? "fx Finansieret af" : "fx ANNONCE"} required /></Field>
          {type === "Partner" && <Field id="markingAftaleId" label="Støtteaftale ID"><input id="markingAftaleId" className="cms-input" value={form.markingAftaleId} onChange={(e) => set("markingAftaleId", e.target.value)} required /></Field>}
        </div>
      )}
      {(type === "Brugerindsendt" || type === "PR") && (
        <div className="cms-subbox">
          <p className="cms-hint">Obligatorisk før publicering.</p>
          <Field id="markingAfsender" label="Afsender / indsender"><input id="markingAfsender" className="cms-input" value={form.markingAfsender} onChange={(e) => set("markingAfsender", e.target.value)} required /></Field>
        </div>
      )}
      {type === "AI-assisteret" && (
        <div className="cms-subbox">
          <p className="cms-hint">Obligatorisk før publicering (del 9 §2). Godkenderen er den bruger, der publicerer (eller planlægger) artiklen.</p>
          <Field id="markingKilder" label="Kilder (én URL/reference pr. linje)"><textarea id="markingKilder" className="cms-input" rows={3} value={form.markingKilder} onChange={(e) => set("markingKilder", e.target.value)} placeholder="https://..." required /></Field>
        </div>
      )}
      {p.hasUnverifiedSource && (
        <div className="cms-subbox">
          <Toggle id="kildeVerificeret" checked={form.kildeVerificeret} onChange={(v) => set("kildeVerificeret", v)} label="Kildens identitet er verificeret" hint="Kladden stammer fra en henvendelse, hvor kildens identitet ikke er kontrolleret. Artiklen kan ikke publiceres, før redaktionen har verificeret kilden." />
        </div>
      )}

      <fieldset className={`cms-fieldset${p.highlight ? " is-highlight" : ""}`}>
        <legend>AI-brug {p.highlight && <AiChip>Opdateret</AiChip>}</legend>
        <p className="cms-hint">Vælg hvad AI har været brugt til — eller at AI ikke er brugt. Påkrævet før publicering.{p.aiRestricted ? " I Krimi og retsvæsen samt Sundhed må AI ikke bruges til udkast eller omskrivning." : ""}</p>
        <Toggle id="ai-none" checked={p.aiNone} onChange={(v) => p.setAiBrug(v ? [AI_USE_NONE] : [])} label="Ingen AI brugt" />
        {AI_USAGE_VALUES.map((u) => {
          const blocked = p.aiRestricted && (u === "Omskrivning" || u === "Udkast");
          return (
            <Toggle key={u} id={`ai-${u}`} disabled={p.aiNone} checked={p.aiUses.includes(u)} onChange={(v) => p.setAiBrug(v ? [...p.aiUses, u] : p.aiUses.filter((x) => x !== u))} label={blocked ? `${u} (ikke tilladt i denne sektion)` : u} />
          );
        })}
      </fieldset>
    </Accordion>
  );
}
