import assert from "node:assert/strict";
import test from "node:test";
import { installNextMocks } from "./helpers/mock-session";

installNextMocks();

const post = (headers: Record<string, string>, body = JSON.stringify({ sessionId: "abcdefgh12", message: "hej", mode: "chat" })) =>
  new Request("https://slagelselokalt.dk/api/chat", { method: "POST", headers: { host: "slagelselokalt.dk", ...headers }, body });

test("T5 P3-6: /api/chat afviser fremmed origin og ikke-JSON før login/rate limit (forsvar i dybden)", async () => {
  const { POST } = await import("../app/api/chat/route");
  const crossOrigin = await POST(post({ origin: "https://evil.test", "content-type": "application/json", "sec-fetch-site": "cross-site" }));
  assert.equal(crossOrigin.status, 403);
  const forgedForwarded = await POST(post({ origin: "https://evil.test", "x-forwarded-host": "evil.test", "content-type": "application/json" }));
  assert.equal(forgedForwarded.status, 403, "falsk X-Forwarded-Host gør ikke en fremmed origin same-origin");
  const textPlain = await POST(post({ origin: "https://slagelselokalt.dk", "content-type": "text/plain" }));
  assert.equal(textPlain.status, 415);
  const sameOriginAnon = await POST(post({ origin: "https://slagelselokalt.dk", "content-type": "application/json" }));
  assert.equal(sameOriginAnon.status, 401, "same-origin JSON uden login -> ikke autoriseret");
  assert.match(((await sameOriginAnon.json()) as { error: string }).error, /Ikke autoriseret/);
});
