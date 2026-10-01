import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateIngest } from "@/lib/ingest/auth";
import type { IngestHealth } from "@/lib/ingest/schema";

/** GET /api/ingest/health (scope health:read) — verificerer nøgle, instans-binding og scopes. */
export async function GET(request: Request) {
  const auth = await authenticateIngest(request, "health:read");
  if (!auth.ok) return auth.response;
  const instance = await db.instance.findUnique({ where: { id: auth.principal.instansId }, select: { id: true, domaene: true, navn: true } });
  if (!instance) return NextResponse.json({ error: "Instansen findes ikke." }, { status: 404 });
  const body: IngestHealth = {
    ok: true,
    service: "lokalt-cms-ingest",
    version: 1,
    instance,
    key: { prefix: auth.principal.prefix, scopes: auth.principal.scopes },
    limits: { signalsPerRequest: 100, requestsPerMinute: 120 },
    serverTime: new Date().toISOString(),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
