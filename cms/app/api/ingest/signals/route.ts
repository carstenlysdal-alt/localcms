import { NextResponse } from "next/server";
import { authenticateIngest } from "@/lib/ingest/auth";
import { signalBatchSchema, type IngestItemResult } from "@/lib/ingest/schema";
import { upsertSignal } from "@/lib/ingest/signals";
import { readJsonBody } from "@/lib/http";

/**
 * POST /api/ingest/signals   (Authorization: Bearer lk_…, scope signals:write)
 * Body: ét signal ELLER { signals: [...] } (maks 100). Idempotent: dedupe på (instans, externalId) og normaliseret kildeUrl.
 * Signaler gemmes som "maskinindsamlet" og kan aldrig være breaking/notable. Se docs/review/AGENT-INGEST-API.md.
 */
export async function POST(request: Request) {
  const auth = await authenticateIngest(request, "signals:write");
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request, 2 * 1024 * 1024);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });

  // Instans-binding: nøglen bestemmer instansen. Et forsøg på at angive en anden afvises.
  if (body.data && typeof body.data === "object" && "instansId" in (body.data as object)) {
    return NextResponse.json({ error: "instansId kan ikke angives; nøglen er bundet til én instans." }, { status: 403 });
  }

  const parsed = signalBatchSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validering fejlede.", issues: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const isBatch = "signals" in parsed.data;
  const items = isBatch ? (parsed.data as { signals: Parameters<typeof upsertSignal>[2][] }).signals : [parsed.data as Parameters<typeof upsertSignal>[2]];

  const results: IngestItemResult[] = [];
  for (const item of items) {
    try {
      results.push(await upsertSignal(auth.principal.instansId, auth.principal.keyId, item));
    } catch (error) {
      console.error("Ingest signal-fejl:", error);
      results.push({ status: "rejected", externalId: item.externalId, reason: "Intern fejl." });
    }
  }

  const headers = { "Cache-Control": "no-store" };
  if (!isBatch) {
    const r = results[0];
    return NextResponse.json(r, { status: r.status === "created" ? 201 : r.status === "rejected" ? 500 : 200, headers });
  }
  const summary = {
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    duplicate: results.filter((r) => r.status === "duplicate").length,
    rejected: results.filter((r) => r.status === "rejected").length,
  };
  return NextResponse.json({ summary, results }, { status: 200, headers });
}
