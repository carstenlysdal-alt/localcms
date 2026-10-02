import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DEFAULT_ROLES } from "../lib/default-roles";
import { PERMISSIONS } from "../lib/permissions";
import { activeHref, bottomNavItems, buildNav, NAV_GROUPS } from "../components/admin/nav-model";
import { NAV_ICONS } from "../components/admin/nav-icons";
import { avgReadSeconds, bucketByDay, dayKey, formatDuration, parseRange, pctDelta, periodBounds, periodDays, ratio, weekdayHourMatrix } from "../app/redaktion/metrikker/_lib/aggregate";

const css = readFileSync(new URL("../styles/modernist.css", import.meta.url), "utf8");
const token = (name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  assert.ok(m, `token --${name} findes som hex`);
  return m[1];
};
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("tokens: tekstpar opfylder WCAG AA (4,5:1) og grafik/kanter 3:1", () => {
  const T = (n: string) => token(`cms-${n}`);
  const text: Array<[string, string]> = [
    ["text", "surface"], ["text", "bg"], ["text-muted", "surface"], ["text-muted", "bg"], ["text-muted", "surface-sunken"], ["text-muted", "primary-tint"],
    ["primary", "surface"], ["text-on-primary", "primary"], ["text-on-primary", "sidebar-active"], ["text-on-primary", "danger"],
    ["sidebar-text", "sidebar-bg"], ["sidebar-muted", "sidebar-bg"], ["sidebar-text-strong", "sidebar-bg"],
    ["success-ink", "success-bg"], ["planned-ink", "planned-bg"], ["draft-ink", "draft-bg"], ["review-ink", "review-bg"], ["danger-ink", "danger-bg"], ["info-ink", "info-bg"], ["ai-ink", "ai-tint"], ["ai-ink", "surface"],
    ["success-ink", "surface"], ["danger-ink", "surface"], ["review-ink", "surface"],
  ];
  for (const [fg, bg] of text) assert.ok(contrast(T(fg), T(bg)) >= 4.5, `${fg} på ${bg}: ${contrast(T(fg), T(bg)).toFixed(2)}`);
  for (const n of ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6", "control-border"]) assert.ok(contrast(T(n), T("surface")) >= 3, `${n} mod hvid: ${contrast(T(n), T("surface")).toFixed(2)}`);
});

test("tokens: alle --cms-* fra briefet findes, og ældre navne lever som aliaser", () => {
  const required = ["bg", "surface", "border", "border-strong", "text", "text-muted", "primary", "primary-hover", "primary-tint", "ai", "ai-tint", "sidebar-bg", "sidebar-text", "sidebar-active", "success", "success-bg", "planned", "planned-bg", "draft", "draft-bg", "review", "review-bg", "danger", "danger-bg", "info", "info-bg", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6", "radius-sm", "radius-md", "radius-lg", "shadow-sm", "shadow-md", "space-1", "space-8", "sidebar-w", "topbar-h", "font-display", "font-body", "font-mono"];
  for (const t of required) assert.match(css, new RegExp(`--cms-${t}:`), `--cms-${t}`);
  assert.match(css, /--cms-sidebar-w:\s*264px/);
  assert.match(css, /--cms-topbar-h:\s*64px/);
  for (const alias of ["color-accent", "color-neutral-500", "color-divider", "space-4", "font-heading", "font-body", "radius-md", "shadow-md"]) assert.match(css, new RegExp(`--${alias}:`), `alias --${alias}`);
});

test("CSS: ingen 9–11 px-tekst i redaktionens stilark, og editor-layout bruger --cms-sidebar-w", () => {
  for (const f of ["../styles/modernist.css", "../styles/cms-shell.css", "../app/globals.css", "../styles/frontpage-editor.css"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    const bad = src.split("\n").filter((l) => /font-size:\s*(9|10|11)px/.test(l) && !/^h6 \{/.test(l));
    assert.deepEqual(bad, [], f);
  }
  const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(globals, /var\(--cms-sidebar-w\)/);
  assert.ok(!/224px/.test(globals), "ingen hårdkodet 224px");
  const shell = readFileSync(new URL("../styles/cms-shell.css", import.meta.url), "utf8");
  assert.ok(!/#[0-9A-Fa-f]{3,8}\b/.test(shell.replace(/\/\*[\s\S]*?\*\//g, "")), "ingen hex i cms-shell.css");
});

test("navigation: filtreret efter rettigheder, grupperet, uden dublet-ikoner eller dublet-links", () => {
  const roles = Object.fromEntries(DEFAULT_ROLES.map((r) => [r.navn, { permissions: [...r.permissions] }]));
  const links = (name: string) => buildNav(roles[name], { inbox: 3 }).flatMap((g) => g.items.map((i) => i.href));

  const admin = links("Ansvarshavende redaktør");
  for (const href of ["/redaktion/brugere", "/redaktion/metrikker", "/redaktion/forside", "/redaktion/sektioner", "/redaktion/annoncer", "/redaktion/indbakke", "/redaktion/artikler/ny"]) assert.ok(admin.includes(href), href);

  const free = links("Freelancejournalist");
  assert.ok(free.includes("/redaktion/indbakke"));
  assert.ok(!free.includes("/redaktion/brugere") && !free.includes("/redaktion/metrikker") && !free.includes("/redaktion/annoncer") && !free.includes("/redaktion/nyhedsbrev") && !free.includes("/redaktion/forside"));

  const sales = links("Salgs- og partnerskabsansvarlig");
  assert.ok(sales.includes("/redaktion/annoncer") && sales.includes("/redaktion/sponsor"));
  assert.ok(!sales.includes("/redaktion/indbakke") && !sales.includes("/redaktion/artikler/ny"));

  const media = links("Medieproducent");
  assert.ok(media.includes("/redaktion/medier") && media.includes("/redaktion/artikler"));
  assert.ok(!media.includes("/redaktion/indbakke"));

  const all = NAV_GROUPS.flatMap((g) => g.items);
  assert.equal(new Set(all.map((i) => i.href)).size, all.length, "ingen dublet-links");
  assert.equal(new Set(all.map((i) => i.icon)).size, all.length, "ingen dublet-ikoner");
  for (const i of all) assert.ok(NAV_ICONS[i.icon], `ikon for ${i.href}`);
  assert.equal(buildNav(roles["Ansvarshavende redaktør"], { inbox: 3 }).find((g) => g.id === "inbox")?.items[0].badge, 3);
  assert.equal(buildNav(roles["Ansvarshavende redaktør"], { inbox: 0 }).find((g) => g.id === "inbox")?.items[0].badge, undefined);
  assert.deepEqual(buildNav({ permissions: [] }).map((g) => g.id), ["content", "inbox", "structure"], "uden rettigheder: kun sider uden adgangskrav");
});

test("navigation: bundnavigation viser højst 4 tilladte hovedpunkter; aktivt punkt = længste præfiks", () => {
  const admin = buildNav({ permissions: DEFAULT_ROLES[0].permissions as unknown as string[] }, {});
  assert.equal(bottomNavItems(admin).length, 4);
  assert.deepEqual(bottomNavItems(buildNav({ permissions: [PERMISSIONS.MEDIA_MANAGE] })).map((i) => i.href), ["/redaktion/artikler", "/redaktion/medier"]);
  const items = NAV_GROUPS.flatMap((g) => g.items);
  assert.equal(activeHref(items, "/redaktion/artikler"), "/redaktion/artikler");
  assert.equal(activeHref(items, "/redaktion/artikler/ny"), "/redaktion/artikler/ny");
  assert.equal(activeHref(items, "/redaktion/artikler/abc123"), "/redaktion/artikler");
  assert.equal(activeHref(items, "/redaktion/medier/xyz"), "/redaktion/medier");
  assert.equal(activeHref(items, "/redaktion/ukendt"), null);
});

test("analytics: periode, delta og serier regnes ærligt (null i stedet for opdigtede tal)", () => {
  assert.equal(parseRange("7"), 7);
  assert.equal(parseRange("90"), 90);
  assert.equal(parseRange("13"), 28);
  assert.equal(parseRange(undefined), 28);
  const p = periodBounds(new Date("2026-10-10T15:00:00Z"), 7);
  assert.equal(dayKey(p.start), "2026-10-04");
  assert.equal(dayKey(p.prevStart), "2026-09-27");
  assert.deepEqual(periodDays(p), ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]);
  assert.equal(pctDelta(150, 100), 50);
  assert.equal(pctDelta(50, 100), -50);
  assert.equal(pctDelta(5, 0), null);
  assert.equal(ratio(1, 0), null);
  assert.equal(avgReadSeconds({ visninger: 5, laesninger: 0, totalLaesetidSek: 0 }), null);
  assert.equal(avgReadSeconds({ visninger: 5, laesninger: 2, totalLaesetidSek: 130 }), 65);
  assert.equal(formatDuration(65), "1m 05s");
  assert.equal(formatDuration(null), "–");
  assert.deepEqual(bucketByDay([{ d: "2026-10-05", v: 2 }, { d: "2026-10-05", v: 3 }, { d: "2026-01-01", v: 9 }], ["2026-10-04", "2026-10-05"], (r) => r.d, (r) => r.v), [0, 5]);
});

test("analytics: varmekort lægger tidspunkter i ugedag × time (dansk tid)", () => {
  // 2026-10-05 er en mandag; 07:30 UTC = 09:30 dansk sommertid.
  const grid = weekdayHourMatrix([new Date("2026-10-05T07:30:00Z"), new Date("2026-10-05T07:45:00Z"), new Date("2026-10-11T21:30:00Z")]);
  assert.equal(grid[0][9], 2);
  assert.equal(grid[6][23], 1, "søndag aften 23:30 dansk tid");
  assert.equal(grid.flat().reduce((a, b) => a + b, 0), 3);
});
