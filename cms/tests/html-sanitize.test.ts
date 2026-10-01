import assert from "node:assert/strict";
import test from "node:test";
import { safeHref, sanitizeHtml } from "../lib/html-sanitize";

test("sanitizeHtml fjerner scripts, event-handlers og javascript:-links", () => {
  const out = sanitizeHtml(
    `<p onclick="x()">Hej <script>alert(1)</script><a href="javascript:alert(1)">klik</a> <img src=x onerror=alert(1)><iframe src="//e"></iframe></p>`,
  );
  assert.ok(!/script|onclick|onerror|javascript:|<img|iframe/i.test(out), out);
  assert.match(out, /<p>Hej /);
});

test("sanitizeHtml bevarer tilladt formatering og mærker eksterne links", () => {
  const out = sanitizeHtml(`<p><strong>fed</strong> <em>kursiv</em> <a href="https://x.dk/a?b=1&c=2" target="_blank" style="x">link</a> <a href="/intern">intern</a></p>`, {
    linkRel: ["sponsored"],
  });
  assert.match(out, /<strong>fed<\/strong>/);
  assert.match(out, /<a href="https:\/\/x\.dk\/a\?b=1&amp;c=2" rel="noopener noreferrer sponsored">link<\/a>/);
  assert.match(out, /<a href="\/intern">intern<\/a>/);
  assert.ok(!out.includes("style"));
  assert.ok(!out.includes("target"));
});

test("sanitizeHtml balancerer tags og escaper løse <", () => {
  assert.equal(sanitizeHtml("<p>åben <b>fed"), "<p>åben <b>fed</b></p>");
  assert.equal(sanitizeHtml("2 < 3 og 5 > 4"), "2 &lt; 3 og 5 > 4");
  assert.equal(sanitizeHtml("</p>stray"), "stray");
  assert.equal(sanitizeHtml("Næstved &amp; omegn"), "Næstved &amp; omegn");
});

test("sanitizeHtml: indlejrede og store/små bogstaver omgåelser", () => {
  const out = sanitizeHtml(`<scr<script>ipt>alert(1)</scr</script>ipt><SCRIPT SRC=//e></SCRIPT><a HREF="JaVaScRiPt:alert(1)">x</a><a href="  &#106;avascript:alert(1)">y</a>`);
  assert.ok(!/<script|javascript|alert/i.test(out.replace(/&lt;/g, "<")) || !/<script/i.test(out), out);
  assert.ok(!/href="[^"]*javascript/i.test(out));
});

test("safeHref tillader kun sikre skemaer", () => {
  assert.equal(safeHref("https://a.dk"), "https://a.dk");
  assert.equal(safeHref("/sti"), "/sti");
  assert.equal(safeHref("mailto:a@b.dk"), "mailto:a@b.dk");
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("data:text/html,x"), null);
  assert.equal(safeHref("//evil.dk"), null);
  assert.equal(safeHref("  java\nscript:x"), null);
});
