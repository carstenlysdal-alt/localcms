import assert from "node:assert/strict";
import test from "node:test";
import { cdata, escapeXml, fitTitle, metaDescription, pruneEmpty, safeJsonLd, stripHtml, truncateAtWord } from "../lib/seo/escape";

test("safeJsonLd escaper < så </script> ikke kan bryde ud", () => {
  const out = safeJsonLd({ headline: "x </script><script>alert(1)</script>", "@type": "NewsArticle" });
  assert.ok(!out.includes("</script"));
  assert.ok(!out.includes("<"));
  assert.equal(JSON.parse(out).headline, "x </script><script>alert(1)</script>");
});

test("safeJsonLd escaper <!-- og U+2028/2029", () => {
  const out = safeJsonLd({ a: "<!-- hej -->", b: "linje og " });
  assert.ok(!out.includes("<!--"));
  assert.ok(!out.includes(" "));
  assert.ok(!out.includes(" "));
  assert.equal(JSON.parse(out).b, "linje og ");
});

test("pruneEmpty fjerner tomme strenge, arrays og objekter men bevarer false og 0", () => {
  const out = pruneEmpty({
    a: "",
    b: "  ",
    c: [],
    d: { "@type": "ImageObject", url: "" },
    e: false,
    f: 0,
    g: [{ x: "" }, "ok"],
    h: undefined,
    i: null,
  });
  assert.deepEqual(out, { e: false, f: 0, g: ["ok"] });
});

test("stripHtml fjerner tags, scripts og entity-escapet markup", () => {
  assert.equal(stripHtml("<p>Hej <strong>verden</strong></p><p>Igen</p>"), "Hej verden Igen");
  assert.equal(stripHtml("&lt;p&gt;Hej &amp; hej&lt;/p&gt;"), "Hej & hej");
  assert.equal(stripHtml("a<script>alert(1)</script>b"), "a b");
  assert.equal(stripHtml(null), "");
});

test("truncateAtWord og metaDescription afkorter ved ordgrænse", () => {
  const t = truncateAtWord("Dette er en ret lang sætning der skal klippes ved et ord", 30);
  assert.ok(t.length <= 30);
  assert.ok(t.endsWith("…"));
  assert.ok(!t.includes("klip "));
  assert.ok(metaDescription("<p>" + "ord ".repeat(100) + "</p>").length <= 155);
  assert.equal(metaDescription(null, "fallback"), "fallback");
  assert.ok(fitTitle("A ".repeat(60)).length <= 60);
});

test("escapeXml og cdata håndterer ]]> og kontroltegn", () => {
  assert.equal(escapeXml(`a & b < c > "d" 'e'`), "a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;");
  assert.equal(escapeXml("a\u0000b"), "ab");
  const c = cdata("før ]]> efter");
  assert.equal(c, "<![CDATA[før ]]]]><![CDATA[> efter]]>");
  assert.ok(!c.slice(9, -3).includes("]]>") || c.includes("]]]]><![CDATA[>"));
});
