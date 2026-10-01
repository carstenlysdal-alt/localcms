import assert from "node:assert/strict";
import test from "node:test";
import {
  chunk,
  isWithinNewsWindow,
  MAX_URLS_PER_SITEMAP,
  maxDate,
  newsSitemapXml,
  sitemapIndexXml,
  urlsetXml,
} from "../lib/seo/sitemap";
import { buildRss, labelCategory, sponsoredTitlePrefix } from "../lib/seo/rss";
import { buildRobotsGroups } from "../lib/seo/robots-policy";
import { classifyHost } from "../lib/seo/host";
import { buildLlmsTxt } from "../lib/seo/llms";
import { analyzeQuery, robotsMeta } from "../lib/seo/meta";

test("urlset: lastmod kun når den findes, billeder og escape", () => {
  const xml = urlsetXml([
    { loc: "https://x.dk/a?b=1&c=2", lastmod: new Date("2026-10-01T07:39:33Z"), images: [{ loc: "https://x.dk/og/a.jpg", title: "A & B" }] },
    { loc: "https://x.dk/b" },
  ]);
  assert.match(xml, /<loc>https:\/\/x\.dk\/a\?b=1&amp;c=2<\/loc>/);
  assert.match(xml, /<lastmod>2026-10-01T09:39:33\+02:00<\/lastmod>/);
  assert.match(xml, /<image:title>A &amp; B<\/image:title>/);
  assert.ok(xml.includes("xmlns:image"));
  const second = xml.split("<url>")[2];
  assert.ok(!second.includes("lastmod"));
});

test("chunk opdeler ved 1000 og sitemap-index linker til delene", () => {
  const items = Array.from({ length: 2500 }, (_, i) => i);
  const parts = chunk(items);
  assert.equal(MAX_URLS_PER_SITEMAP, 1000);
  assert.deepEqual(parts.map((p) => p.length), [1000, 1000, 500]);
  assert.deepEqual(chunk([]), [[]]);
  const idx = sitemapIndexXml(parts.map((_, i) => ({ loc: `https://x.dk/sitemaps/${i + 1}.xml` })));
  assert.equal((idx.match(/<sitemap>/g) ?? []).length, 3);
  assert.equal(maxDate([null, new Date(5), new Date(9)])?.getTime(), 9);
});

test("news-sitemap: publication, sprog og 48-timers vindue", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  assert.equal(isWithinNewsWindow(new Date("2026-09-29T13:00:00Z"), now), true);
  assert.equal(isWithinNewsWindow(new Date("2026-09-29T11:00:00Z"), now), false);
  assert.equal(isWithinNewsWindow(new Date("2026-10-02T12:00:00Z"), now), false);
  const xml = newsSitemapXml("NæstvedLokalt", [{ loc: "https://x.dk/a", title: "Titel <b>", publishedAt: new Date("2026-10-01T01:39:33Z") }]);
  assert.match(xml, /<news:name>NæstvedLokalt<\/news:name><news:language>da<\/news:language>/);
  assert.match(xml, /<news:publication_date>2026-10-01T03:39:33\+02:00<\/news:publication_date>/);
  assert.match(xml, /<news:title>Titel &lt;b&gt;<\/news:title>/);
});

test("RSS: dc:creator (ikke author), lastBuildDate, atom self, CDATA-sikkert, label", () => {
  const xml = buildRss({
    title: "Feed",
    link: "https://x.dk/",
    selfUrl: "https://x.dk/feed.xml",
    description: "d",
    items: [
      {
        title: `${sponsoredTitlePrefix("Sponsoreret")}Bil ]]> & <b>`,
        link: "https://x.dk/a",
        guid: "https://x.dk/a",
        pubDate: new Date("2026-10-01T01:39:33Z"),
        description: "<p>Manchet &amp; mere</p>",
        creator: "Morten Kaas",
        categories: ["Erhverv", labelCategory("Sponsoreret") ?? ""],
        image: { url: "https://x.dk/og/a.jpg", width: 1200, height: 630 },
      },
    ],
  });
  assert.ok(!xml.includes("<author>"));
  assert.match(xml, /<dc:creator>Morten Kaas<\/dc:creator>/);
  assert.match(xml, /<lastBuildDate>/);
  assert.match(xml, /<atom:link href="https:\/\/x\.dk\/feed\.xml" rel="self"/);
  assert.match(xml, /<title>Annonce: Bil \]\]&gt; &amp;<\/title>/);
  assert.match(xml, /<category>Sponsoreret<\/category>/);
  assert.match(xml, /<media:content url="https:\/\/x\.dk\/og\/a\.jpg"/);
  assert.ok(!xml.includes("]]>"));
});

test("robots: ukendt vært blokeres helt; kendt vært har AI-politik og gentager disallow", () => {
  assert.deepEqual(buildRobotsGroups({ known: false }), [{ userAgent: "*", disallow: ["/"] }]);
  const groups = buildRobotsGroups({ known: true });
  const byAgent = Object.fromEntries(groups.map((g) => [g.userAgent, g]));
  assert.equal(byAgent["*"].allow, "/");
  assert.ok(byAgent["*"].disallow?.includes("/redaktion"));
  assert.equal(byAgent["PerplexityBot"].allow, "/");
  assert.ok(byAgent["PerplexityBot"].disallow?.includes("/api/"));
  assert.equal(byAgent["GPTBot"].allow, "/");
  assert.deepEqual(byAgent["CCBot"].disallow, ["/"]);
  const blocked = buildRobotsGroups({ known: true, aiTraining: "block" });
  assert.deepEqual(blocked.find((g) => g.userAgent === "GPTBot")?.disallow, ["/"]);
  assert.deepEqual(blocked.find((g) => g.userAgent === "OAI-SearchBot")?.allow, "/");
});

test("classifyHost: apex/www/lokal er kendt, fremmed vært er ukendt", () => {
  assert.equal(classifyHost("naestvedlokalt.dk", "naestvedlokalt.dk").known, true);
  assert.equal(classifyHost("www.naestvedlokalt.dk", "naestvedlokalt.dk").isWww, true);
  assert.equal(classifyHost("naestvedlokalt.localhost:3000", "naestvedlokalt.dk").known, true);
  assert.equal(classifyHost("evil.example", "slagelselokalt.dk").known, false);
  assert.equal(classifyHost(null, "x.dk").known, true);
});

test("analyzeQuery: side, filtre og tracking-parametre", () => {
  assert.deepEqual(analyzeQuery({}), { page: 1, hasFilter: false });
  assert.deepEqual(analyzeQuery({ side: "3" }), { page: 3, hasFilter: false });
  assert.deepEqual(analyzeQuery({ side: "-1", utm_source: "fb" }), { page: 1, hasFilter: false });
  assert.equal(analyzeQuery({ omraade: "fensmark" }).hasFilter, true);
  assert.equal(analyzeQuery({ filter: "mest-laest", side: "2" }).hasFilter, true);
  assert.equal(analyzeQuery({ emne: "" }).hasFilter, false);
});

test("robotsMeta: index har max-image-preview:large, noindex har ikke", () => {
  const idx = robotsMeta(true) as Record<string, unknown>;
  assert.equal(idx["max-image-preview"], "large");
  assert.equal(idx.index, true);
  const no = robotsMeta(false) as Record<string, unknown>;
  assert.equal(no.index, false);
  assert.equal(no["max-image-preview"], undefined);
});

test("llms.txt indeholder sektioner, feeds og priser med absolutte links", () => {
  const txt = buildLlmsTxt({
    base: "https://naestvedlokalt.dk",
    navn: "NæstvedLokalt",
    kommune: "Næstved",
    tagline: "Din lokale stemme",
    areas: ["Fensmark", "Glumsø"],
    sections: [{ navn: "Nyheder", slug: "nyheder" }],
    latest: [{ title: "Titel", loc: "https://naestvedlokalt.dk/nyheder/a" }],
  });
  assert.match(txt, /^# NæstvedLokalt/);
  assert.match(txt, /\(https:\/\/naestvedlokalt\.dk\/nyheder\)/);
  assert.match(txt, /news-sitemap\.xml/);
  assert.match(txt, /\/priser/);
});
