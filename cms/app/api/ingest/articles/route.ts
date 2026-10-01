import { NextResponse } from "next/server";
import { authenticateIngest } from "@/lib/ingest/auth";
import { articleInputSchema } from "@/lib/ingest/schema";
import { assertNoStatusOverride, createIngestDraft, IngestRejection, INGEST_DRAFT_STATUS } from "@/lib/ingest/articles";
import { readJsonBody } from "@/lib/http";

/**
 * POST /api/ingest/articles   (Authorization: Bearer lk_…, scope articles:draft)
 * Opretter KUN kladder: status = første workflow-tilstand, indholdstype = "AI-assisteret", aiBrug og kilder (url+dato) er påkrævet,
 * citater kræver kildeUrl+dato, Krimi/Sundhed (kategori eller politi/112-kilder) er spærret. Publicering sker aldrig herfra —
 * en redaktør med ARTICLE_PUBLISH skal føre artiklen gennem det eksisterende workflow. Idempotent på externalId.
 */
export async function POST(request: Request) {
  const auth = await authenticateIngest(request, "articles:draft");
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request, 1024 * 1024);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });

  try {
    assertNoStatusOverride(body.data);
    if (body.data && typeof body.data === "object" && "indholdstype" in (body.data as object) && (body.data as { indholdstype: unknown }).indholdstype !== "AI-assisteret") {
      throw new IngestRejection("indholdstype kan kun være 'AI-assisteret' via indtags-API'et.", 422);
    }

    const parsed = articleInputSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validering fejlede.", issues: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await createIngestDraft({
      instansId: auth.principal.instansId,
      ingestKeyId: auth.principal.keyId,
      keyPrefix: auth.principal.prefix,
      input: parsed.data,
    });
    return NextResponse.json(
      { ...result, workflowStatus: INGEST_DRAFT_STATUS, note: "Kladde oprettet. Kræver redaktionel gennemgang og godkendelse før publicering." },
      { status: result.status === "created" ? 201 : 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof IngestRejection) {
      return NextResponse.json({ error: error.message }, { status: error.httpStatus, headers: { "Cache-Control": "no-store" } });
    }
    console.error("Ingest artikel-fejl:", error);
    return NextResponse.json({ error: "Intern fejl." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
