import assert from "node:assert/strict";
import test, { after, afterEach, beforeEach, mock } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { db } from "../lib/db";
import { ALL_NETWORK_SITES, type NetworkSiteLink } from "../lib/network-sites";

/** Falsk next/headers + next/navigation: getCurrentSite()/getNetworkLinks() kører mod den rigtige (isolerede) test-DB. */
const request = { headers: new Headers(), cookies: new Map<string, string>(), pathname: "/nyheder" };
mock.module("next/headers", {
  namedExports: {
    headers: async () => request.headers,
    cookies: async () => ({ get: (name: string) => (request.cookies.has(name) ? { name, value: request.cookies.get(name) as string } : undefined) }),
  },
});
mock.module("next/navigation", {
  namedExports: {
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
    redirect: (url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    },
    usePathname: () => request.pathname,
  },
});

const RAILWAY = "lysdalcms-production.up.railway.app";
const env = process.env as Record<string, string | undefined>;
const KEYS = ["NODE_ENV", "PREVIEW_HOSTS", "FALLBACK_SITE_DOMAIN", "DEFAULT_SITE_DOMAIN", "TRUST_FORWARDED_HOST"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = env[k];
  env.NODE_ENV = "production";
  env.PREVIEW_HOSTS = RAILWAY;
  env.FALLBACK_SITE_DOMAIN = "slagelselokalt.dk";
  delete env.DEFAULT_SITE_DOMAIN;
  delete env.TRUST_FORWARDED_HOST;
  request.headers = new Headers({ host: RAILWAY });
  request.cookies = new Map();
  request.pathname = "/nyheder";
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete env[k];
    else env[k] = saved[k];
  }
});
after(async () => {
  await db.$disconnect();
});

async function site() {
  const { getCurrentSite } = await import("../lib/site");
  return (await getCurrentSite()).domaene;
}

test("getCurrentSite på preview-vært: standardby uden cookie, cookie vælger by, ugyldig cookie ignoreres", async () => {
  assert.equal(await site(), "slagelselokalt.dk", "FALLBACK_SITE_DOMAIN er standardby");
  for (const s of ALL_NETWORK_SITES) {
    request.cookies.set("lk_by", s.key as string);
    assert.equal(await site(), s.domaene, s.key);
  }
  for (const bad of ["naestvedlokalt.dk", "ukendt", "' OR 1=1 --", ""]) {
    request.cookies.set("lk_by", bad);
    assert.equal(await site(), "slagelselokalt.dk", JSON.stringify(bad));
  }
});

test("getCurrentSite på preview-vært uden FALLBACK_SITE_DOMAIN: første instans (ældste) når cookien mangler", async () => {
  delete env.FALLBACK_SITE_DOMAIN;
  const first = await db.instance.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  assert.equal(await site(), first.domaene);
  request.cookies.set("lk_by", "koege");
  assert.equal(await site(), "koegelokalt.dk");
});

test("getCurrentSite: cookien påvirker ikke rigtige domæner, ukendte værter eller værter uden for PREVIEW_HOSTS", async () => {
  request.cookies.set("lk_by", "roskilde");
  request.headers = new Headers({ host: "naestvedlokalt.dk" });
  assert.equal(await site(), "naestvedlokalt.dk");
  request.headers = new Headers({ host: "www.holbaeklokalt.dk" });
  assert.equal(await site(), "holbaeklokalt.dk");
  // Ukendt vært: som før — fallback hvis sat (her Slagelse), aldrig cookiens by
  request.headers = new Headers({ host: "evil.example" });
  assert.equal(await site(), "slagelselokalt.dk");
  delete env.FALLBACK_SITE_DOMAIN;
  await assert.rejects(site(), /NEXT_NOT_FOUND/, "ukendt vært uden fallback er 404");
  // Railway-værten uden at stå i PREVIEW_HOSTS: cookien ignoreres
  env.FALLBACK_SITE_DOMAIN = "slagelselokalt.dk";
  delete env.PREVIEW_HOSTS;
  request.headers = new Headers({ host: RAILWAY });
  assert.equal(await site(), "slagelselokalt.dk");
});

test("getCurrentSite: forfalsket X-Forwarded-Host kan ikke gøre en vært til preview-vært (kun betroet Host)", async () => {
  request.cookies.set("lk_by", "naestved");
  request.headers = new Headers({ host: "evil.example", "x-forwarded-host": RAILWAY });
  assert.equal(await site(), "slagelselokalt.dk", "Host=evil.example er ikke preview; fallback (ikke cookie)");
});

test("getNetworkLinks: previewBy kun på preview-vært; rigtige domæner uændret", async () => {
  const { getNetworkLinks } = await import("../lib/site");
  const preview = await getNetworkLinks();
  assert.equal(preview.length, 6);
  for (const l of preview) assert.equal(l.previewBy, l.key);
  request.headers = new Headers({ host: "naestvedlokalt.dk", "x-forwarded-proto": "https" });
  const real = await getNetworkLinks();
  for (const l of real) {
    assert.equal(l.previewBy, undefined);
    assert.equal(l.origin, `https://${l.domaene}`);
  }
});

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

async function networkLinks(host: string): Promise<NetworkSiteLink[]> {
  request.headers = new Headers({ host, "x-forwarded-proto": "https" });
  const { getNetworkLinks } = await import("../lib/site");
  return getNetworkLinks();
}

test("SiteHeader: på preview-vært linker byerne til /?by=<nøgle> på samme vært og aktiv by er markeret; rigtigt domæne uændret", async () => {
  const { SiteHeader } = await import("../components/site/SiteHeader");
  const render = (links: NetworkSiteLink[], current: string) =>
    renderToStaticMarkup(createElement(SiteHeader, { siteNavn: "NæstvedLokalt", categories: [], networkSites: links, currentDomaene: current, sectionPaths: ["/nyheder"] }));

  const previewHtml = render(await networkLinks(RAILWAY), "naestvedlokalt.dk");
  const previewHrefs = hrefs(previewHtml);
  for (const key of ["slagelse", "holbaek", "koege", "roskilde", "ringsted"]) assert.ok(previewHrefs.includes(`/?by=${key}`), key);
  assert.ok(!previewHrefs.includes("/?by=naestved"), "aktiv by er ikke et link");
  assert.ok(!previewHtml.includes("lokalt.dk/"), "ingen links til byernes (ikke-eksisterende) domæner");
  assert.match(previewHtml, /is-active"[^>]*>(?:<span[^>]*><\/span>)?NæstvedLokalt/, "aktiv by er markeret");

  const realHtml = render(await networkLinks("naestvedlokalt.dk"), "naestvedlokalt.dk");
  const realHrefs = hrefs(realHtml);
  assert.ok(realHrefs.includes("https://holbaeklokalt.dk/nyheder"), "sti bevares til målbyens domæne");
  assert.ok(!realHrefs.some((h) => h.includes("?by=")));
});

test("SectionSheet (mobil): samme regler som headeren", async () => {
  const { SectionSheet } = await import("../components/site/SectionSheet");
  const render = (links: NetworkSiteLink[]) =>
    renderToStaticMarkup(createElement(SectionSheet, { isOpen: true, onClose: () => undefined, categories: [], areas: [], siteNavn: "KøgeLokalt", networkSites: links, currentDomaene: "koegelokalt.dk", sectionPaths: [] }));
  const preview = render(await networkLinks(RAILWAY));
  assert.ok(hrefs(preview).includes("/?by=naestved"));
  assert.ok(hrefs(preview).includes("/?by=koege"), "aktiv by er også et link i arket, men markeret");
  assert.match(preview, /site-sheet-pill is-active/);
  assert.ok(!preview.includes("https://naestvedlokalt.dk"));
  const real = render(await networkLinks("koegelokalt.dk"));
  assert.ok(hrefs(real).includes("https://naestvedlokalt.dk/nyheder"), "sti bevares til målbyens domæne (uændret)");
  assert.ok(!hrefs(real).some((h) => h.includes("?by=")));
});

test("SiteFooter (server): søstermedier linker til /?by=<nøgle> på preview-vært, til domænerne ellers", async () => {
  const { SiteFooter } = await import("../components/site/SiteFooter");
  request.cookies.set("lk_by", "ringsted");
  request.headers = new Headers({ host: RAILWAY, "x-forwarded-proto": "https" });
  const preview = hrefs(renderToStaticMarkup(await SiteFooter({ siteNavn: "RingstedLokalt", categories: [] })));
  for (const key of ["slagelse", "naestved", "holbaek", "koege", "roskilde"]) assert.ok(preview.includes(`/?by=${key}`), key);
  assert.ok(!preview.includes("/?by=ringsted"), "egen by listes ikke blandt søstrene (som i dag)");
  assert.ok(!preview.some((h) => /lokalt\.dk/.test(h)));

  request.cookies.clear();
  request.headers = new Headers({ host: "ringstedlokalt.dk", "x-forwarded-proto": "https" });
  const real = hrefs(renderToStaticMarkup(await SiteFooter({ siteNavn: "RingstedLokalt", categories: [] })));
  assert.ok(real.includes("https://naestvedlokalt.dk/"));
  assert.ok(!real.some((h) => h.includes("?by=")));
});

test("Redaktionens by-liste (netværksadgang): byer med adgang er knapper, andre er låst; 'Se siden' peger på /?by=<nøgle> på preview-vært", async () => {
  const { NavLinks } = await import("../components/admin/nav-links");
  const { networkHref } = await import("../lib/network-sites");
  const links = await networkLinks(RAILWAY);
  // Brugeren har adgang til Slagelse (hjem) og Næstved (aktiv); de øvrige er låst.
  const access: Record<string, string> = { slagelse: "inst-s", naestved: "inst-n" };
  const cities = links.map((l) => ({ by: l.by, instansId: access[l.key as string] ?? null, current: l.key === "naestved", home: l.key === "slagelse", publicHref: networkHref(l) }));
  const html = renderToStaticMarkup(createElement(NavLinks, { groups: [], cities }));
  const all = hrefs(html);
  for (const key of ["slagelse", "naestved", "holbaek", "koege", "roskilde", "ringsted"]) assert.ok(all.includes(`/?by=${key}`), `Se siden for ${key}`);
  assert.ok(!all.some((h) => h.includes("/redaktion")), "ingen links til andre byers redaktion");
  assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1, "kun den aktive by er markeret");
  assert.match(html, /<button[^>]*aria-current="true"[^>]*disabled[^>]*>.*?Næstved<\/span><span class="shell-link-note">Redigeres nu/);
  assert.equal((html.match(/shell-link-city is-locked/g) ?? []).length, 4, "byer uden adgang er ikke klikbare");
  assert.equal((html.match(/<button/g) ?? []).length, 2, "kun byer med adgang er knapper");
  assert.doesNotMatch(html, /Din by/);

  // Rigtige domæner: Se siden peger på byens eget domæne (uændret opførsel for den offentlige side)
  const real = renderToStaticMarkup(
    createElement(NavLinks, { groups: [], cities: [{ by: "Næstved", instansId: "x", current: true, publicHref: "https://naestvedlokalt.dk/" }, { by: "Holbæk", instansId: null, current: false, publicHref: "https://holbaeklokalt.dk/" }] }),
  );
  assert.ok(hrefs(real).includes("https://holbaeklokalt.dk/"));
  assert.doesNotMatch(real, /Din by/);
});
