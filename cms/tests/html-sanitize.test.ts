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

// ── T5 P1-1: regressionstest for dobbelt-entity-omgåelsen og varianter ──────────────────────────────

/** Uafhængig browser-model: dekoder attributværdien PRÆCIS én gang og returnerer den URL browseren ville navigere til. */
function browserHref(html: string): string[] {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', colon: ":", tab: "\t", newline: "\n", lpar: "(", rpar: ")" };
  const dec = (v: string) =>
    v.replace(/&(?:#x([0-9a-f]+);?|#(\d+);?|([a-z]+);)/gi, (w, h, d, n) =>
      h !== undefined ? String.fromCodePoint(parseInt(h, 16)) : d !== undefined ? String.fromCodePoint(parseInt(d, 10)) : (named[String(n).toLowerCase()] ?? w),
    );
  return [...html.matchAll(/\s(?:href|cite)="([^"]*)"/g)].map((m) => dec(m[1]));
}

function assertNoActiveScheme(out: string, label: string) {
  for (const url of browserHref(out)) {
    const compact = url.replace(/[\u0000- \u007f-\u009f]+/g, "");
    assert.ok(!/^(javascript|vbscript|data|file|blob):/i.test(compact), `${label}: browseren ville navigere til ${JSON.stringify(url)} (${out})`);
    assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(compact) || /^(https?:|mailto:|tel:)/i.test(compact), `${label}: ukendt skema ${JSON.stringify(url)}`);
  }
  // Attributværdier er escapede tekst; kontrollér kun markup uden for dem.
  const markup = out.replace(/="[^"]*"/g, '=""');
  assert.ok(!/\son[a-z]+\s*=|<script|<svg|<math|<iframe|srcdoc|<img/i.test(markup), `${label}: farligt element/attribut slap igennem: ${out}`);
}

test("P1-1: rapporterede payloads med dobbelt entity-kodning giver ingen aktiv href", () => {
  const payloads = [
    `<a href="java&amp;#115;cript:alert(1)">x</a>`,
    `<a href="javascript&amp;colon;alert(1)">x</a>`,
    `<a href="&amp;#x6a;avascript:alert(1)">x</a>`,
  ];
  for (const p of payloads) {
    const out = sanitizeHtml(p);
    assertNoActiveScheme(out, p);
    assert.ok(!out.includes("href=\"java&#"), `ingen enkelt-kodet entity i output: ${out}`);
    assert.ok(!/href="[^"]*&(?!amp;|quot;|lt;|gt;)/.test(out), `alle & i attributter er escapet: ${out}`);
  }
  assert.equal(safeHref("java&amp;#115;cript:alert(1)"), null);
  assert.equal(safeHref("javascript&amp;colon;alert(1)"), null);
  assert.equal(safeHref("&amp;#x6a;avascript:alert(1)"), null);
});

test("P1-1: tre og fire lags kodning, store/små bogstaver og manglende semikolon", () => {
  const payloads = [
    `<a href="java&amp;amp;#115;cript:alert(1)">x</a>`,
    `<a href="&amp;amp;amp;#106;avascript:alert(1)">x</a>`,
    `<a href="JaVa&amp;#83;cRiPt:alert(1)">x</a>`,
    `<a href="&#106&#97&#118&#97&#115&#99&#114&#105&#112&#116&#58;alert(1)">x</a>`,
    `<a href="&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;&#x3A;alert(1)">x</a>`,
    `<a href="&amp;#0000106;avascript:alert(1)">x</a>`,
    `<a href="javascript&COLON;alert(1)">x</a>`,
    `<a href='javascript&amp;colon;alert(1)'>x</a>`,
    `<a href=javascript&amp;colon;alert(1)>x</a>`,
  ];
  for (const p of payloads) assertNoActiveScheme(sanitizeHtml(p), p);
});

test("P1-1: blanktegn og kontroltegn i skemaet (tab, newline, NUL, usynlige tegn)", () => {
  const payloads = [
    `<a href="jav&#x09;ascript:alert(1)">x</a>`,
    `<a href="jav&Tab;ascript:alert(1)">x</a>`,
    `<a href="jav&amp;Tab;ascript:alert(1)">x</a>`,
    `<a href="jav&#x0A;ascript:alert(1)">x</a>`,
    `<a href="jav&NewLine;ascript:alert(1)">x</a>`,
    `<a href="java\nscript:alert(1)">x</a>`,
    `<a href="java\tscript:alert(1)">x</a>`,
    `<a href="  \u0001javascript:alert(1)">x</a>`,
    `<a href="java\u0000script:alert(1)">x</a>`,
    `<a href="​javascript:alert(1)">x</a>`,
    `<a href="java­script:alert(1)">x</a>`,
    `<a href="&#x1;javascript:alert(1)">x</a>`,
  ];
  for (const p of payloads) assertNoActiveScheme(sanitizeHtml(p), JSON.stringify(p));
});

test("P1-1: data:, vbscript:, file:, blob: og skemarelative URL'er afvises", () => {
  const payloads = [
    `<a href="data:text/html,<script>alert(1)</script>">x</a>`,
    `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>`,
    `<a href="DATA:text/html,x">x</a>`,
    `<a href="vbscript:msgbox(1)">x</a>`,
    `<a href="vb&amp;#115;cript:msgbox(1)">x</a>`,
    `<a href="file:///etc/passwd">x</a>`,
    `<a href="blob:https://evil.dk/x">x</a>`,
    `<a href="//evil.dk/x">x</a>`,
    `<a href="\\\\evil.dk\\x">x</a>`,
    `<a href="&#47;&#47;evil.dk">x</a>`,
    `<a href="&amp;#47;&amp;#47;evil.dk">x</a>`,
  ];
  for (const p of payloads) {
    const out = sanitizeHtml(p);
    assertNoActiveScheme(out, p);
    assert.ok(!/href=/.test(out), `href skal fjernes helt: ${out}`);
  }
});

test("P1-1: srcdoc, svg, math, style, on*-attributter og andre tags/attributter fjernes", () => {
  const payloads = [
    `<iframe srcdoc="<script>alert(1)</script>"></iframe>`,
    `<a href="/x" srcdoc="<script>alert(1)</script>">x</a>`,
    `<svg><script>alert(1)</script></svg>`,
    `<svg/onload=alert(1)>`,
    `<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>`,
    `<math><mtext><a href="javascript:alert(1)">x</a></mtext></math>`,
    `<math href="javascript:alert(1)">x</math>`,
    `<p style="background:url(javascript:alert(1))" onmouseover="alert(1)">x</p>`,
    `<a href="/x" onclick="alert(1)" onmouseover=alert(1)>x</a>`,
    `<img src=x onerror=alert(1)>`,
    `<body onload=alert(1)>`,
    `<form action="javascript:alert(1)"><button>x</button></form>`,
    `<object data="javascript:alert(1)"></object>`,
    `<embed src="javascript:alert(1)">`,
    `<base href="javascript:alert(1)//">`,
    `<meta http-equiv="refresh" content="0;url=javascript:alert(1)">`,
    `<link rel="stylesheet" href="javascript:alert(1)">`,
    `<a href="/x" title='" onmouseover="alert(1)'>x</a>`,
    `<a href="/x" title="&quot; onmouseover=&quot;alert(1)">x</a>`,
    `<q cite="javascript:alert(1)">x</q>`,
    `<blockquote cite="java&amp;#115;cript:alert(1)">x</blockquote>`,
  ];
  for (const p of payloads) assertNoActiveScheme(sanitizeHtml(p), p);
});

test("P1-1: attributværdier kan ikke bryde ud af citationstegnene", () => {
  const out = sanitizeHtml(`<a href="/x" title='" onmouseover="alert(1)'>x</a><a title="&quot; onmouseover=&quot;alert(2)">y</a>`);
  assert.ok(!/\sonmouseover\s*=/.test(out.replace(/title="[^"]*"/g, "")), out);
  assert.match(out, /title="&quot; onmouseover=&quot;alert\(1\)"/);
});

test("P1-1: legitime links og entiteter bevares og dobbeltescapes ikke", () => {
  assert.equal(sanitizeHtml(`<a href="https://x.dk/a?b=1&amp;c=2">l</a>`, {}), `<a href="https://x.dk/a?b=1&amp;c=2" rel="noopener noreferrer">l</a>`);
  assert.equal(sanitizeHtml(`<a href="/sti?a=1&b=2">l</a>`), `<a href="/sti?a=1&amp;b=2">l</a>`);
  assert.equal(sanitizeHtml(`<a href="mailto:a@b.dk">m</a>`), `<a href="mailto:a@b.dk">m</a>`);
  assert.equal(sanitizeHtml(`<a href="tel:+4512345678">t</a>`), `<a href="tel:+4512345678">t</a>`);
  assert.equal(sanitizeHtml(`<a href="#afsnit-2">a</a>`), `<a href="#afsnit-2">a</a>`);
  assert.equal(sanitizeHtml(`<abbr title="Ørsted &amp; co">Ø</abbr>`), `<abbr title="Ørsted &amp; co">Ø</abbr>`);
  assert.equal(safeHref("HTTPS://X.DK/a"), "HTTPS://X.DK/a");
  assert.equal(safeHref("?q=1&amp;r=2"), "?q=1&r=2");
});
