import { getAuthorizedUser } from "@/lib/auth";
import { isSameOrigin, readJsonBody } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { runEditorialTask } from "@/lib/ai/editorial-service";
import type { EditorialRequest } from "@/lib/ai/editorial-schemas";

/**
 * POST /api/redaktion/ai  { task, articleId?, context, params }   (kun indloggede brugere med article.ai.use)
 * Feltniveau-AI i artikel-editoren. Returnerer FORSLAG (aldrig auto-gem/publicér). Se lib/ai/editorial-service.ts for
 * governance (Krimi/Sundhed-spærring, ratelimit pr. bruger, størrelsesloft, auditlog uden indhold).
 */
export const dynamic = "force-dynamic";

const STATUS = { "ingen-noegle": 503, forbudt: 403, ugyldig: 400, "for-stor": 413, rate: 429, "ai-fejl": 502, "ingen-tekst": 422 } as const;

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ ok: false, code: "forbudt", error: "Ugyldig oprindelse." }, 403);
  if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) return json({ ok: false, code: "ugyldig", error: "Forventer application/json." }, 415);
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_AI_USE);
  if (!user) return json({ ok: false, code: "forbudt", error: "Ikke autoriseret." }, 401);
  const raw = await readJsonBody(req, 96 * 1024);
  if (!raw.ok) return json({ ok: false, code: raw.status === 413 ? "for-stor" : "ugyldig", error: raw.error }, raw.status);
  const result = await runEditorialTask(user, raw.data as EditorialRequest);
  return json(result, result.ok ? 200 : STATUS[result.code]);
}
