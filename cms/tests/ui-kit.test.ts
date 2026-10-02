import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Accordion } from "../components/ui/Accordion";
import { Avatar, avatarTone, initialsOf } from "../components/ui/Avatar";
import { Badge, StatusChip, statusInfo } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { CityDot, citySlug } from "../components/ui/CityDot";
import { DataTable } from "../components/ui/DataTable";
import { Dialog } from "../components/ui/Dialog";
import { EmptyState } from "../components/ui/EmptyState";
import { FilterBar, FilterChips, FilterSelect, Toolbar } from "../components/ui/FilterBar";
import { Field, Grid, Notice } from "../components/ui/Layout";
import { LinkTabs } from "../components/ui/LinkTabs";
import { Page, PageHeader } from "../components/ui/Page";
import { SaveIndicator, saveLabel } from "../components/ui/SaveIndicator";
import { SearchField } from "../components/ui/SearchField";
import { SegmentedLinks } from "../components/ui/SegmentedLinks";
import { Skeleton, SkeletonGroup } from "../components/ui/Skeleton";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";
import { Bars, Donut, Heatmap, LineArea, Sparkline } from "../components/charts";

/** Løs createElement: testene kontrollerer markup, ikke prop-typer. */
const h = createElement as unknown as (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => ReactElement;
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

test("Accordion: knap med aria-expanded/aria-controls, region med aria-labelledby, lukkede paneler er hidden men i DOM", () => {
  const out = html(h(Accordion, { items: [
    { id: "a", title: "SEO", defaultOpen: true, children: h("input", { name: "seo" }) },
    { id: "b", title: "Sociale medier", children: h("input", { name: "some" }) },
  ] }));
  assert.equal((out.match(/aria-expanded="true"/g) ?? []).length, 1);
  assert.equal((out.match(/aria-expanded="false"/g) ?? []).length, 1);
  assert.equal((out.match(/role="region"/g) ?? []).length, 2);
  assert.match(out, /<h3 class="ui-accordion-heading"><button[^>]*aria-controls=/);
  assert.match(out, /hidden=""[^>]*>[\s\S]*name="some"/, "felter i lukket panel bevares i DOM");
  const ids = [...out.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) assert.ok(out.includes(`id="${id}"`), "aria-controls peger på et panel");
  assert.match(html(h(Accordion, { headingLevel: 2, items: [{ id: "x", title: "T", children: "c" }] })), /<h2 /);
});

test("Accordion: allowMultiple=false åbner kun ét panel fra start", () => {
  const out = html(h(Accordion, { allowMultiple: false, items: [
    { id: "a", title: "A", defaultOpen: true, children: "a" },
    { id: "b", title: "B", defaultOpen: true, children: "b" },
  ] }));
  assert.equal((out.match(/aria-expanded="true"/g) ?? []).length, 1);
});

test("Tabs: tablist/tab/tabpanel, roving tabindex og aria-selected; kun aktivt panel er synligt", () => {
  const out = html(h(Tabs, { label: "Visning", items: [
    { id: "one", label: "Et", children: "A" },
    { id: "two", label: "To", count: 3, children: "B" },
  ] }));
  assert.match(out, /role="tablist" aria-label="Visning"/);
  assert.equal((out.match(/role="tab"/g) ?? []).length, 2);
  assert.equal((out.match(/tabindex="0"[^>]*class="ui-tab"|aria-selected="true"/g) ?? []).length >= 1, true);
  assert.equal((out.match(/tabindex="-1"/g) ?? []).length, 1, "kun den aktive fane er i tab-rækkefølgen");
  assert.equal((out.match(/role="tabpanel"/g) ?? []).length, 2);
  assert.equal((out.match(/role="tabpanel"[^>]*hidden=""|hidden=""[^>]*role="tabpanel"/g) ?? []).length, 1);
});

test("LinkTabs og SegmentedLinks: nav med aria-label og aria-current på aktiv", () => {
  const out = html(h(LinkTabs, { label: "Status", items: [{ href: "/a", label: "A", active: true }, { href: "/b", label: "B", count: 4 }] }));
  assert.match(out, /<nav[^>]*aria-label="Status"/);
  assert.equal((out.match(/aria-current="page"/g) ?? []).length, 1);
  const seg = html(h(SegmentedLinks, { label: "Periode", items: [{ href: "?dage=7", label: "7 dage" }, { href: "?dage=28", label: "28 dage", active: true }] }));
  assert.equal((seg.match(/aria-current="true"/g) ?? []).length, 1);
});

test("Badge/StatusChip: statusvarianter og tekst (aldrig kun farve)", () => {
  assert.deepEqual(statusInfo("Udkast"), { tone: "draft", label: "Kladde" });
  assert.deepEqual(statusInfo("Godkendelse"), { tone: "review", label: "Til redigering" });
  assert.deepEqual(statusInfo("Planlagt"), { tone: "planned", label: "Planlagt" });
  assert.deepEqual(statusInfo("Distribueret"), { tone: "success", label: "Publiceret" });
  assert.deepEqual(statusInfo("Afvist"), { tone: "danger", label: "Afvist" });
  assert.deepEqual(statusInfo("Mærkelig"), { tone: "neutral", label: "Mærkelig" });
  const chip = html(h(StatusChip, { status: "Publiceret" }));
  assert.match(chip, /ui-badge-success/);
  assert.match(chip, /Publiceret/);
  assert.match(chip, /ui-badge-dot" aria-hidden="true"/);
  assert.match(html(h(Badge, { tone: "ai", variant: "solid" }, "AI")), /ui-badge-ai ui-badge-solid/);
});

test("StatCard: normal, delta-retning, tom, loading og 'ikke tilsluttet' uden opdigtede tal", () => {
  const ok = html(h(StatCard, { label: "Visninger", value: "1.200", delta: { value: 12.5, label: "mod forrige" } }));
  assert.match(ok, /1\.200/);
  assert.match(ok, /\+12,5 %/);
  assert.match(ok, /is-good/);
  const down = html(h(StatCard, { label: "Fejl", value: "3", delta: { value: -4, invert: true } }));
  assert.match(down, /−4 %/);
  assert.match(down, /is-good/, "fald i en 'ned er godt'-måling er godt");
  const na = html(h(StatCard, { label: "Unikke læsere", unavailable: "Kræver sporing." }));
  assert.match(na, /Kobles til når sporing er slået til/);
  assert.match(na, /Kræver sporing\./);
  assert.ok(!/ui-stat-value/.test(na), "intet tal vises");
  assert.match(html(h(StatCard, { label: "X", empty: "Ingen data" })), /Ingen data/);
  const loading = html(h(StatCard, { label: "X", loading: true }));
  assert.match(loading, /role="status"/);
});

test("DataTable: caption, aria-sort på sorterbare kolonner, tom/loading/fejl", () => {
  const cols = [{ key: "a", header: "Navn", sortable: true }, { key: "b", header: "Antal", sortable: true, align: "right" as const }, { key: "c", header: "Handling", srOnlyHeader: true }];
  const rows = [
    { id: "1", cells: { a: "Bo", b: 2, c: "x" }, sort: { b: 2 } },
    { id: "2", cells: { a: "Anna", b: 10, c: "y" }, sort: { b: 10 } },
  ];
  const out = html(h(DataTable, { caption: "Brugere", columns: cols, rows, defaultSort: { key: "b", direction: "desc" } }));
  assert.match(out, /<caption class="sr-only">Brugere<\/caption>/);
  assert.match(out, /aria-sort="descending"/);
  assert.match(out, /aria-sort="none"/);
  assert.ok(out.indexOf(">Anna<") < out.indexOf(">Bo<"), "sorteret faldende på antal");
  assert.match(out, /<span class="sr-only">Handling<\/span>/);
  assert.match(out, /role="region"[^>]*tabindex="0"/);
  assert.match(html(h(DataTable, { caption: "T", columns: cols, rows: [], emptyTitle: "Intet her" })), /Intet her/);
  assert.match(html(h(DataTable, { caption: "T", columns: cols, rows, state: "loading" })), /Indlæser/);
  assert.match(html(h(DataTable, { caption: "T", columns: cols, rows, state: "error", errorMessage: "Fejl!" })), /role="alert"[\s\S]*Fejl!/);
});

test("Dialog: native <dialog> med aria-labelledby, luk-knap med label og beskrivelse", () => {
  const out = html(h(Dialog, { open: false, onClose: () => undefined, title: "Slet?", description: "Sikker?", variant: "sheet", footer: "foot" }, "krop"));
  assert.match(out, /^<dialog/);
  assert.match(out, /aria-labelledby="[^"]+-title"/);
  assert.match(out, /aria-describedby="[^"]+-desc"/);
  assert.match(out, /aria-label="Luk"/);
  assert.match(out, /ui-dialog-sheet/);
  assert.ok(!out.includes("krop"), "indhold renderes først når dialogen er åben");
});

test("SaveIndicator: aria-live og danske tekster", () => {
  assert.match(html(h(SaveIndicator, { status: "saving" })), /aria-live="polite"[\s\S]*Gemmer…/);
  assert.match(html(h(SaveIndicator, { status: "error", error: "Netværk" })), /aria-live="assertive"[\s\S]*Kunne ikke gemme: Netværk/);
  assert.match(saveLabel("saved", new Date("2026-10-01T12:32:00Z")), /^Sidst gemt \d\d[.:]\d\d$/);
  assert.equal(saveLabel("dirty"), "Ikke gemt");
});

test("EmptyState, Skeleton, Notice, Field, Page, PageHeader, Card", () => {
  assert.match(html(h(EmptyState, { title: "Tomt", description: "Beskrivelse", action: h("a", { href: "/x" }, "Gør noget") })), /Tomt[\s\S]*Beskrivelse[\s\S]*Gør noget/);
  const sk = html(h(SkeletonGroup, null, h(Skeleton, { width: 50 })));
  assert.match(sk, /role="status"/);
  assert.match(sk, /aria-busy="true"/);
  assert.match(sk, /ui-skeleton[^"]*" aria-hidden="true"|aria-hidden="true"[^>]*ui-skeleton/);
  assert.match(html(h(Notice, { tone: "danger" }, "Fejl")), /role="alert"/);
  assert.match(html(h(Notice, { tone: "success" }, "Ok")), /role="status"/);
  const field = html(h(Field, { label: "Navn", htmlFor: "n", required: true, hint: "Hjælp", error: "Fejl" }, h("input", { id: "n" })));
  assert.match(field, /<label for="n">Navn/);
  assert.match(field, /id="n-hint"/);
  assert.match(field, /id="n-error"[^>]*role="alert"/);
  assert.match(html(h(Page, null, "x")), /^<main class="ui-page ui-page-default"/);
  const header = html(h(PageHeader, { title: "Titel", subtitle: "Under", actions: h("button", null, "Gem") }));
  assert.match(header, /<h1 class="ui-page-title">Titel<\/h1>/);
  assert.match(header, /Under/);
  const card = html(h(Card, { id: "k", title: "Kort", tone: "ai" }, "indhold"));
  assert.match(card, /aria-labelledby="k-title"/);
  assert.match(card, /ui-card-ai/);
  assert.match(html(h(Grid, { cols: 3 }, "x")), /ui-cols-3/);
});

test("FilterBar, SearchField, FilterChips, Toolbar: søg-landemærke, GET og skjulte labels", () => {
  const out = html(h(FilterBar, { label: "Filtre", resetHref: "/x" }, h(SearchField, { label: "Søg titel", defaultValue: "abc" }), h(FilterSelect, { name: "status", label: "Status", options: [{ value: "", label: "Alle" }, { value: "a", label: "A" }] })));
  assert.match(out, /<form role="search" aria-label="Filtre" class="ui-filterbar" method="get"/);
  assert.match(out, /<span class="sr-only">Søg titel<\/span>/);
  assert.match(out, /type="search"[^>]*name="q"|name="q"[^>]*type="search"/);
  assert.match(out, /aria-label="Status"/);
  assert.match(out, /Nulstil/);
  assert.match(html(h(FilterChips, { label: "Hurtig", chips: [{ href: "/a", label: "A", active: true }] })), /aria-current="true"/);
  assert.match(html(h(Toolbar, { label: "Handlinger" }, "x")), /role="toolbar" aria-label="Handlinger"/);
});

test("Avatar og CityDot: initialer, stabil farve og by-slug", () => {
  assert.equal(initialsOf("Carsten Lysdal"), "CL");
  assert.equal(initialsOf(null), "?");
  assert.equal(avatarTone("Anna"), avatarTone("Anna"));
  assert.match(html(h(Avatar, { name: "Anna Bo" })), /role="img" aria-label="Anna Bo"/);
  assert.equal(citySlug("Næstved"), "naestved");
  assert.equal(citySlug("Køge"), "koege");
  assert.equal(citySlug("Holbæk"), "holbaek");
  assert.match(html(h(CityDot, { city: "Køge" })), /data-city="koege"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-city="koege"/);
});

test("Diagrammer: titel, tabel-fallback, tilgængeligt navn og tom tilstand uden opdigtede tal", () => {
  const line = html(h(LineArea, { title: "Eksponeringer", categories: ["1. okt.", "2. okt."], series: [{ id: "a", label: "Eksponeringer", values: [2, 5] }] }));
  assert.match(line, /<figure[^>]*aria-labelledby/);
  assert.match(line, /<h3[^>]*>Eksponeringer<\/h3>/);
  assert.match(line, /<details class="ui-chart-table"><summary>Vis data som tabel<\/summary>/);
  assert.match(line, /<caption class="sr-only">Eksponeringer<\/caption>/);
  assert.match(line, /<svg[^>]*role="group"[^>]*aria-label="Eksponeringer\. /);
  assert.match(line, /tabindex="0"/);
  assert.match(line, /aria-live="polite"/);
  const empty = html(h(LineArea, { title: "T", categories: ["a"], series: [{ id: "a", label: "A", values: [0] }], emptyText: "Ingen data" }));
  assert.match(empty, /Ingen data/);
  assert.ok(!/<svg/.test(empty), "intet diagram uden data");

  const bars = html(h(Bars, { title: "Pr. sektion", categories: ["Nyheder", "Sport"], series: [{ id: "a", label: "Uafhængig", values: [4, 2] }, { id: "b", label: "Partner", values: [1, 0] }], mode: "stacked", orientation: "horizontal" }));
  assert.match(bars, /ui-chart-legend/);
  assert.match(bars, /I alt/);
  assert.match(bars, /ui-chart-s2/);

  const donut = html(h(Donut, { title: "Status", slices: [{ id: "p", label: "Publiceret", value: 3 }, { id: "k", label: "Kladde", value: 1 }] }));
  assert.match(donut, /Publiceret/);
  assert.match(donut, /75 %/);
  assert.match(html(h(Donut, { title: "Status", slices: [], emptyText: "Tom" })), /Tom/);

  const heat = html(h(Heatmap, { title: "Timer", rows: ["Man", "Tir"], cols: ["00", "01"], values: [[0, 3], [1, 0]], unit: "artikler" }));
  assert.match(heat, /ui-heat-5/);
  assert.match(heat, /Brug piletaster/);
  assert.match(html(h(Sparkline, { values: [1, 3, 2], label: "Trend" })), /role="img" aria-label="Trend"/);
  assert.match(html(h(Sparkline, { values: [0, 0], label: "x" })), /Ingen udvikling/);
});

test("Kittet bruger hverken inline style eller hex-farver", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  for (const dir of ["../components/ui", "../components/charts"]) {
    for (const f of readdirSync(new URL(`${dir}/`, import.meta.url)).filter((x) => /\.(tsx?)$/.test(x))) {
      const src = readFileSync(new URL(`${dir}/${f}`, import.meta.url), "utf8");
      assert.ok(!/style=\{\{/.test(src), `${dir}/${f}: style={{}}`);
      assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(src.replace(/&#\d+;/g, "")), `${dir}/${f}: hex-farve`);
    }
  }
});
