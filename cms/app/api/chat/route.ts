import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { isSameOrigin, readJsonBody } from "@/lib/http";
import { getBreaker, isBreakerFailure } from "@/lib/resilience";
import { cleanText } from "@/lib/validation/text";
import { normalizeHistory, type ChatTurn } from "@/lib/chat";

/**
 * POST /api/chat  { sessionId, message, mode }   (kun indloggede redaktionsbrugere)
 * Streamer ren tekst. Model: ANTHROPIC_MODEL (default claude-sonnet-4-6). Nøgle: ANTHROPIC_API_KEY.
 * Grænser: besked ≤ 4000 tegn, 20 beskeder/10 min pr. bruger, sessionId = [A-Za-z0-9_-]{8,64},
 * sessionen skal tilhøre brugeren (og instansen).
 */
const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_MESSAGE_CHARS = 4000;

const bodySchema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, "Ugyldigt sessionId."),
  message: z.string().min(1).max(MAX_MESSAGE_CHARS * 2),
  mode: z.enum(["ask", "auto"]).default("ask"),
});

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

export async function POST(req: Request) {
  // Forsvar i dybden (T5 P3-6): cookie-auth kræver same-origin og en rigtig JSON-forespørgsel (ikke form/text-plain).
  if (!isSameOrigin(req)) return json({ error: "Ugyldig oprindelse." }, 403);
  if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) return json({ error: "Forventer application/json." }, 415);
  const user = await getAuthorizedUser();
  if (!user) return json({ error: "Ikke autoriseret." }, 401);

  const limited = await rateLimit({ bucket: "chat", key: user.id, limit: 20, windowMs: 10 * 60_000 });
  if (!limited.ok) return json({ error: "For mange beskeder. Vent lidt og prøv igen." }, 429, rateLimitHeaders(limited));

  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "AI-assistenten er ikke konfigureret (ANTHROPIC_API_KEY mangler)." }, 503);

  const raw = await readJsonBody(req, 32 * 1024);
  if (!raw.ok) return json({ error: raw.error }, raw.status);
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Ugyldig forespørgsel." }, 400);
  const { sessionId, mode } = parsed.data;
  const message = cleanText(parsed.data.message, MAX_MESSAGE_CHARS, { multiline: true });
  if (!message) return json({ error: "Beskeden er tom." }, 400);

  // Sessionen må kun tilhøre denne bruger (id'et er klient-genereret, så det må ikke give adgang til andres historik).
  const foreign = await db.chatMessage.findFirst({
    where: { sessionId, OR: [{ instansId: { not: user.instansId } }, { userId: { not: null }, NOT: { userId: user.id } }] },
    select: { id: true },
  });
  if (foreign) return json({ error: "Samtalen findes ikke." }, 404);

  const recent = await db.chatMessage.findMany({
    where: { sessionId, instansId: user.instansId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const history = recent.reverse().map((m) => ({ role: (m.role === "assistant" ? "assistant" : "user") as ChatTurn["role"], content: m.content }));

  await db.chatMessage.create({
    data: { sessionId, role: "user", content: message, instansId: user.instansId, userId: user.id },
  });

  const systemPrompt = mode === "auto"
    ? `Du er en redaktionel AI-assistent for ${user.name}. Du hjælper med at skrive, undersøge og redigere journalistiske historier. Brug en professionel, dansk journalistisk tone. Svar kortfattet og præcist.`
    : `Du er en research-assistent for ${user.name}. Du undersøger påstande, finder vinkler og identificerer kilder. Svar på dansk med fakta og nuancer.`;

  const messages = normalizeHistory([...history, { role: "user", content: message }]);

  // Circuit breaker + korte grænser: er Anthropic nede, svarer vi hurtigt 503 frem for at hænge forbindelser.
  const breaker = getBreaker("anthropic");
  if (!breaker.tryAcquire()) return json({ error: "AI-tjenesten er midlertidigt utilgængelig. Prøv igen om lidt." }, 503, { "Retry-After": "30" });
  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  let stream: ReturnType<typeof client.messages.stream>;
  try {
    stream = client.messages.stream({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });
  } catch (error) {
    if (isBreakerFailure(error)) breaker.recordFailure(error); else breaker.recordSuccess();
    console.error("Chat: kunne ikke starte stream", error);
    return json({ error: "AI-tjenesten er midlertidigt utilgængelig." }, 502);
  }
  req.signal.addEventListener("abort", () => stream.abort());

  const encoder = new TextEncoder();
  let fullContent = "";
  let breakerSettled = false;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            fullContent += chunk.delta.text;
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        breaker.recordSuccess();
        breakerSettled = true;
      } catch (error) {
        if (!req.signal.aborted && isBreakerFailure(error)) breaker.recordFailure(error); else breaker.recordSuccess();
        breakerSettled = true;
        console.error("Chat: stream-fejl", error);
        if (!req.signal.aborted) controller.enqueue(encoder.encode("\n\n[Svaret blev afbrudt af en fejl. Prøv igen.]"));
      } finally {
        if (!breakerSettled) breaker.recordSuccess(); // fx klient-afbrydelse: frigiv et eventuelt prøvekald
        if (fullContent.trim()) {
          try {
            await db.chatMessage.create({
              data: { sessionId, role: "assistant", content: fullContent, instansId: user.instansId, userId: user.id },
            });
          } catch (error) {
            console.error("Chat: kunne ikke gemme svar", error);
          }
        }
        try { controller.close(); } catch { /* allerede lukket */ }
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", ...rateLimitHeaders(limited) },
  });
}
