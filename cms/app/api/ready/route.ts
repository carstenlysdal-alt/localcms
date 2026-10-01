import { getReadiness } from "@/lib/health";

/**
 * Readiness (Railway healthcheck + uptime-monitor): database `SELECT 1` (2 s timeout) og Redis `PING` hvis REDIS_URL er sat.
 * 200 når klar, ellers 503. Intet internt (fejltekster, værter, versioner) i svaret. Aldrig cachet.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getReadiness();
  return Response.json(
    { status: result.ready ? "ready" : "unavailable", checks: result.checks },
    { status: result.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function HEAD() {
  const result = await getReadiness();
  return new Response(null, { status: result.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
