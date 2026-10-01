/** Liveness: processen svarer. Rører hverken database eller Redis (så en DB-afbrydelse ikke får Railway til at genstarte appen). */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}

export function HEAD() {
  return new Response(null, { headers: { "Cache-Control": "no-store" } });
}
