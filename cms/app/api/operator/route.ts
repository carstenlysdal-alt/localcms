import { z } from "zod";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, rateLimitHeaders, getClientIp } from "@/lib/ratelimit";
import { isSameOrigin, readJsonBody } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { cleanText } from "@/lib/validation/text";
import { normalizeHistory, type ChatTurn } from "@/lib/chat";
import { encodeEvent, type OperatorEvent } from "@/lib/operator/events";
import { runOperatorTurn } from "@/lib/operator/loop";
import { MAX_MESSAGE_CHARS, RATE_LIMIT } from "@/lib/operator/policy";
import { getToolDeps, resolveOperatorProvider } from "@/lib/operator/runtime";

/**
 * POST /api/operator  { sessionId, message }   (kun indloggede brugere med operator.use)
 * Svarer med NDJSON-hændelser (se lib/operator/events.ts). Samtalens tekst gemmes i ChatMessage.
 * Modeludbyder: OPERATOR_PROVIDER / DEEPSEEK_API_KEY / ANTHROPIC_API_KEY (lib/operator/llm/select.ts); uden nøgle 503.
 * Grænser: besked ≤ 2000 tegn, 30 ture / 10 min pr. bruger, højst 8 værktøjskald og 60 s pr. tur.
 */
const bodySchema = z.object({
  sessionId: z.string().regex(/^op[-_][A-Za-z0-9_-]{6,60}$/, "Ugyldigt sessionId."),
  message: z.string().min(1).max(MAX_MESSAGE_CHARS * 2),
});

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "Ugyldig oprindelse." }, 403);
  if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) return json({ error: "Forventer application/json." }, 415);
  const user = await getAuthorizedUser(PERMISSIONS.OPERATOR_USE);
  if (!user) return json({ error: "Ikke autoriseret." }, 401);

  const limited = await rateLimit({ ...RATE_LIMIT, key: user.id, failMode: "closed" });
  if (!limited.ok) return json({ error: "For mange beskeder. Vent lidt og prøv igen." }, 429, rateLimitHeaders(limited));

  const llm = resolveOperatorProvider();
  if (!llm.ok) return json({ error: llm.message }, llm.status);
  const provider = llm.provider;

  const raw = await readJsonBody(req, 16 * 1024);
  if (!raw.ok) return json({ error: raw.error }, raw.status);
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Ugyldig forespørgsel." }, 400);
  const { sessionId } = parsed.data;
  const message = cleanText(parsed.data.message, MAX_MESSAGE_CHARS, { multiline: true });
  if (!message) return json({ error: "Beskeden er tom." }, 400);

  // Samtalen må kun tilhøre denne bruger og instans (id'et er klient-genereret).
  const foreign = await db.chatMessage.findFirst({
    where: { sessionId, OR: [{ instansId: { not: user.instansId } }, { userId: { not: null }, NOT: { userId: user.id } }] },
    select: { id: true },
  });
  if (foreign) return json({ error: "Samtalen findes ikke." }, 404);

  const recent = await db.chatMessage.findMany({ where: { sessionId, instansId: user.instansId }, orderBy: { createdAt: "desc" }, take: 20 });
  const history: ChatTurn[] = normalizeHistory(recent.reverse().map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })));
  await db.chatMessage.create({ data: { sessionId, role: "user", content: message, instansId: user.instansId, userId: user.id } });

  const encoder = new TextEncoder();
  const ctx = { user, instansId: user.instansId, now: new Date(), sessionId, provider: provider.id, ip: getClientIp(req.headers), deps: getToolDeps() };

  const readable = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (event: OperatorEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          closed = true;
        }
      };
      let text = "";
      try {
        const result = await runOperatorTurn({ client: provider.stream, ctx, history, message, emit, signal: req.signal, providerId: provider.id, minimiseData: provider.minimiseData });
        text = result.text;
      } catch (error) {
        console.error("[operator] uventet fejl:", error instanceof Error ? error.name : "ukendt");
        emit({ type: "error", message: "Der opstod en uventet fejl. Prøv igen." });
      } finally {
        if (text.trim()) {
          await db.chatMessage.create({ data: { sessionId, role: "assistant", content: text.slice(0, 20_000), instansId: user.instansId, userId: user.id } }).catch(() => undefined);
        }
        closed = true;
        try {
          controller.close();
        } catch {
          /* allerede lukket */
        }
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", ...rateLimitHeaders(limited) },
  });
}
