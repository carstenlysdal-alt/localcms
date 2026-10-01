import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { cleanText, csvCell, escapeHtml, isHttpUrl, isSafePublicUrl, normalizeUrl, safeFilename, stripHtml, textToParagraphHtml } from "../lib/validation/text";
import { generateToken, looksLikeToken, safeEqual, sha256Hex } from "../lib/validation/tokens";
import { isAnswered, isNewIntakeStatus, normalizeStatus } from "../lib/validation/status";
import { contactSchema, emailSchema, meddelerTipInput, qaAnswersInput, sponsorBriefInput } from "../lib/validation/public";
import { MemoryRateLimitStore, firstSeen, getClientIp, isLoginLocked, rateLimit, recordLoginFailure, clearLoginFailures, setRateLimitStore, getRateLimitStore, LOGIN_MAX_FAILURES } from "../lib/ratelimit";
import { detectUpload, validateUploadBuffer } from "../lib/upload";
import { isLikelyBot, visitorKey } from "../lib/tracking";
import { isAiRestrictedCategory } from "../lib/marking";
import { normalizeHistory } from "../lib/chat";
import { PERMISSIONS, can } from "../lib/permissions";
import { DEFAULT_ROLES } from "../lib/default-roles";
import { canTransition, ARTICLE_STATUSES } from "../lib/workflow";

test("HTML fjernes fra offentligt input og escapes ved paragraph-blokke", () => {
  assert.equal(cleanText("Hej <b>verden</b><script>alert(1)</script>!", 100), "Hej verden !");
  assert.ok(!stripHtml("&lt;script&gt;alert(1)&lt;/script&gt;x").includes("<script"));
  assert.ok(!stripHtml('<img src=x onerror="alert(1)">tekst').includes("onerror"));
  const html = textToParagraphHtml('Linje 1\n\nLinje <2> & "3"');
  assert.equal(html, "<p>Linje 1</p><p>Linje &lt;2&gt; &amp; &quot;3&quot;</p>");
  assert.equal(escapeHtml("<a href='x'>"), "&lt;a href=&#39;x&#39;&gt;");
  assert.equal(cleanText("x".repeat(500), 50).length, 50);
});

test("URL-hjælpere afviser javascript:/data: og normaliserer til dedupe", () => {
  assert.equal(isHttpUrl("javascript:alert(1)"), false);
  assert.equal(isHttpUrl("data:text/html,<script>"), false);
  assert.equal(isSafePublicUrl("/uploads/../etc/passwd"), false);
  assert.equal(isSafePublicUrl("/uploads/a.webp"), true);
  assert.equal(
    normalizeUrl("http://WWW.Naestved.dk/dagsorden/?utm_source=x&b=2&a=1#frag"),
    normalizeUrl("https://naestved.dk/dagsorden?a=1&b=2"),
  );
  assert.notEqual(normalizeUrl("https://naestved.dk/a"), normalizeUrl("https://naestved.dk/b"));
});

test("CSV-celler neutraliserer formel-injektion og citerer", () => {
  assert.equal(csvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
  assert.equal(csvCell("+45 12 34"), "\"'+45 12 34\"");
  assert.equal(csvCell("Normal"), '"Normal"');
  assert.equal(csvCell(-5), '"-5"');
  assert.equal(csvCell(null), '""');
});

test("filnavne renses for stier og kontroltegn", () => {
  assert.equal(safeFilename("../../etc/passwd"), "passwd");
  assert.equal(safeFilename("C:\\temp\\evil\".exe"), "evil.exe");
  assert.equal(safeFilename("", "fil"), "fil");
  assert.equal(safeFilename("..."), "fil");
});

test("nye tokens er kryptografisk tilfældige, mindst 24 bytes og unikke", () => {
  const tokens = new Set(Array.from({ length: 200 }, () => generateToken()));
  assert.equal(tokens.size, 200);
  for (const t of tokens) {
    assert.ok(t.length >= 32, "base64url af 24 bytes = 32 tegn");
    assert.ok(looksLikeToken(t));
    assert.ok(/^[A-Za-z0-9_-]+$/.test(t));
  }
  assert.ok(generateToken(8).length >= 32, "minimum 24 bytes selv hvis der bedes om færre");
  // Eksisterende cuid-tokens virker fortsat
  assert.ok(looksLikeToken("cm1abcdefghijklmnopqrstuv"));
  assert.equal(looksLikeToken("kort"), false);
  assert.equal(sha256Hex("a").length, 64);
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
});

test("statusvokabular: ét kanonisk sæt, ældre værdier læses stadig", () => {
  assert.equal(normalizeStatus("qa", "BESVARET"), "Besvaret");
  assert.equal(normalizeStatus("qa", "AFVENTER_SVAR"), "Sendt");
  assert.equal(normalizeStatus("qa", "Besvaret"), "Besvaret");
  assert.equal(normalizeStatus("interview", "GENNEMFOERT"), "Besvaret");
  assert.equal(normalizeStatus("interview", "OPRETTET"), "Oprettet");
  assert.equal(normalizeStatus("sponsor", "BriefModtaget"), "BriefIndsendt");
  assert.equal(normalizeStatus("meddeler", "Modtaget"), "Ny");
  assert.equal(isAnswered("qa", "BESVARET"), true);
  assert.equal(isAnswered("interview", "Besvaret"), true);
  assert.equal(isAnswered("qa", "Sendt"), false);
  for (const s of ["Ny", "AFVENTER_SVAR", "OPRETTET", "BriefModtaget", "BriefIndsendt", "Modtaget", "Sendt", "Oprettet"]) assert.equal(isNewIntakeStatus(s), true, s);
  assert.equal(isNewIntakeStatus("Besvaret"), false);
});

test("zod-skemaer: e-mail, kontakt, længder, enums og HTML-strip", () => {
  assert.equal(emailSchema.safeParse(" Test@Example.COM ").data, "test@example.com");
  assert.equal(emailSchema.safeParse("ikke-en-mail").success, false);
  assert.equal(contactSchema.safeParse("+45 12 34 56 78").success, true);
  assert.equal(contactSchema.safeParse("abc").success, false);

  const ok = sponsorBriefInput.safeParse({ partnerNavn: "<b>Bager</b> A/S", kontaktNavn: "Mette", kontaktEmail: "m@bager.dk", formaal: "Rekruttering", budskab: "Vi søger lærlinge", format: "Sponsoreret artikel" });
  assert.equal(ok.success, true);
  if (ok.success) assert.equal(ok.data.partnerNavn, "Bager A/S");
  assert.equal(sponsorBriefInput.safeParse({ partnerNavn: "A", kontaktNavn: "M", kontaktEmail: "x", formaal: "", budskab: "" }).success, false);
  assert.equal(sponsorBriefInput.safeParse({ partnerNavn: "Bager", kontaktNavn: "Mette", kontaktEmail: "m@b.dk", formaal: "", budskab: "Hej hej", format: "hacker" }).success, false);

  assert.equal(qaAnswersInput.safeParse({}).success, false, "tomme svar afvises");
  const many = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`q${i}`, { text: "svar" }]));
  assert.equal(qaAnswersInput.safeParse(many).success, false, "for mange svar afvises");
  assert.equal(qaAnswersInput.safeParse({ q1: { text: "x".repeat(100_000) } }).success, false, "for lang tekst afvises");

  const tip = meddelerTipInput.safeParse({ category: "ukendt", name: "Per", email: "per@x.dk", what: "Brand i hallen", consent: true, photos: [{ name: "f", credit: "Per", url: "javascript:alert(1)" }] });
  assert.equal(tip.success, true);
  if (tip.success) { assert.equal(tip.data.category, "tip"); assert.equal(tip.data.photos[0].url, undefined); }
  assert.equal(meddelerTipInput.safeParse({ category: "tip", name: "Per", email: "per@x.dk", what: "Brand", consent: false }).success, false);
});

test("rate limiter: vindue, grænse, Retry-After og nulstilling", async () => {
  const previous = getRateLimitStore();
  setRateLimitStore(new MemoryRateLimitStore());
  try {
    const now = 1_000_000;
    const r = [];
    for (let i = 0; i < 4; i++) r.push(await rateLimit({ bucket: "t", key: "ip1", limit: 3, windowMs: 60_000, now }));
    assert.deepEqual(r.map((x) => x.ok), [true, true, true, false]);
    assert.equal(r[3].remaining, 0);
    assert.ok(r[3].retryAfterSec >= 1 && r[3].retryAfterSec <= 60);
    assert.equal((await rateLimit({ bucket: "t", key: "ip2", limit: 3, windowMs: 60_000, now })).ok, true, "pr. nøgle");
    assert.equal((await rateLimit({ bucket: "t", key: "ip1", limit: 3, windowMs: 60_000, now: now + 61_000 })).ok, true, "vinduet udløber");

    assert.equal(await firstSeen("view", "v1", 1000, now), true);
    assert.equal(await firstSeen("view", "v1", 1000, now + 10), false);
    assert.equal(await firstSeen("view", "v1", 1000, now + 2000), true);

    assert.equal(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })), "203.0.113.5");
    assert.equal(getClientIp(new Headers()), "unknown");
  } finally {
    setRateLimitStore(previous);
  }
});

test("login-lockout efter gentagne fejl og nulstilling ved succes", async () => {
  const previous = getRateLimitStore();
  setRateLimitStore(new MemoryRateLimitStore());
  try {
    const email = "lockout@test.dk";
    assert.equal(await isLoginLocked(email, "1.1.1.1"), false);
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) await recordLoginFailure(email, "1.1.1.1");
    assert.equal(await isLoginLocked(email, "9.9.9.9"), true, "låst pr. e-mail uanset IP");
    assert.equal(await isLoginLocked("andre@test.dk", "9.9.9.9"), false);
    await clearLoginFailures(email);
    assert.equal(await isLoginLocked(email, "9.9.9.9"), false);
  } finally {
    setRateLimitStore(previous);
  }
});

test("upload: filtype afgøres af indhold, SVG/HTML/exe/aktiv PDF afvises", async () => {
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer();
  const jpg = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).jpeg().toBuffer();
  assert.equal(detectUpload(png)?.extension, "png");
  assert.equal(detectUpload(jpg)?.extension, "jpg");
  assert.equal(validateUploadBuffer(png).ok, true);

  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const html = Buffer.from("<!DOCTYPE html><html><body><script>alert(1)</script></body></html>");
  const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(200)]);
  for (const bad of [svg, html, exe]) assert.equal(validateUploadBuffer(bad).ok, false);

  // HTML forklædt som .png (klientens MIME ignoreres): ingen magic bytes -> afvist
  assert.equal(validateUploadBuffer(Buffer.from("GIF89a<script>")).ok, false);
  // Polyglot: PNG-header efterfulgt af script-indhold i de første bytes afvises
  assert.equal(validateUploadBuffer(Buffer.concat([png.subarray(0, 8), Buffer.from("<script>alert(1)</script>"), Buffer.alloc(40)])).ok, false);

  const cleanPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n%%EOF\n");
  const evilPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\nendobj\n");
  assert.equal(validateUploadBuffer(cleanPdf).ok, true);
  assert.equal(validateUploadBuffer(evilPdf).ok, false);

  const tooBig = Buffer.concat([png.subarray(0, 8), Buffer.alloc(11 * 1024 * 1024)]);
  assert.equal(validateUploadBuffer(tooBig).ok, false);
});

test("tracking: bots ignoreres og besøgsnøgle er anonym og dagligt roterende", () => {
  assert.equal(isLikelyBot(""), true);
  assert.equal(isLikelyBot("curl/8.1.2"), true);
  assert.equal(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  assert.equal(isLikelyBot("python-requests/2.31"), true);
  assert.equal(isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"), false);
  const a = visitorKey("1.2.3.4", "UA", new Date("2026-10-01T10:00:00Z"));
  assert.equal(a, visitorKey("1.2.3.4", "UA", new Date("2026-10-01T23:00:00Z")));
  assert.notEqual(a, visitorKey("1.2.3.4", "UA", new Date("2026-10-02T10:00:00Z")));
  assert.ok(!a.includes("1.2.3.4"));
});

test("rettigheder: NEWSLETTER/ADS/INGEST findes i standardroller og kan() kræver eksakt rettighed", () => {
  const editor = DEFAULT_ROLES.find((r) => r.navn === "Ansvarshavende redaktør")!;
  for (const p of [PERMISSIONS.NEWSLETTER_MANAGE, PERMISSIONS.ADS_MANAGE, PERMISSIONS.INGEST_MANAGE]) assert.ok((editor.permissions as readonly string[]).includes(p));
  const freelancer = DEFAULT_ROLES.find((r) => r.navn === "Freelancejournalist")!;
  assert.equal((freelancer.permissions as readonly string[]).includes(PERMISSIONS.NEWSLETTER_MANAGE), false);
  assert.equal(can({ permissions: [...freelancer.permissions] }, PERMISSIONS.NEWSLETTER_MANAGE), false);
  assert.equal(can(null, PERMISSIONS.NEWSLETTER_MANAGE), false);
  assert.equal(can({ permissions: ["newsletter.manage"] }, PERMISSIONS.NEWSLETTER_MANAGE), true);
});

test("Krimi/Sundhed er AI-spærrede kategorier; chat-historik normaliseres", () => {
  assert.equal(isAiRestrictedCategory({ slug: "krimi-og-retsvaesen", navn: "Krimi og retsvæsen" }), true);
  assert.equal(isAiRestrictedCategory({ slug: "sundhed", navn: "Sundhed" }), true);
  assert.equal(isAiRestrictedCategory({ slug: "politik", navn: "Politik" }), false);
  assert.equal(isAiRestrictedCategory(null), false);
  assert.deepEqual(normalizeHistory([
    { role: "assistant", content: "orphan" },
    { role: "user", content: "a" },
    { role: "user", content: "b" },
    { role: "assistant", content: "c" },
  ]), [{ role: "user", content: "a\n\nb" }, { role: "assistant", content: "c" }]);
});

test("workflow: ingen vej fra første kladdetilstand direkte til Publiceret, heller ikke for publisher", () => {
  const publisher = { permissions: [PERMISSIONS.ARTICLE_PUBLISH, PERMISSIONS.ARTICLE_CREATE] };
  assert.equal(canTransition(ARTICLE_STATUSES[0], "Publiceret", publisher), false);
  assert.equal(canTransition("Udkast", "Publiceret", publisher), false);
});
