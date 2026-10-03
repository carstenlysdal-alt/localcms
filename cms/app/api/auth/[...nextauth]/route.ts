import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

export const { GET } = handlers;

/**
 * POST til /api/auth/session (klientens `update()`) afvises: den aktive by skiftes kun via serveractionen switchInstance
 * (app/redaktion/instans-actions.ts), som tjekker adgang, rate limit og skriver revisionsspor. Auth.js' øvrige POST-ruter
 * (login, logout, csrf) er uændrede.
 */
export async function POST(request: NextRequest) {
  if (new URL(request.url).pathname.replace(/\/+$/, "").endsWith("/session")) {
    return Response.json({ error: "Metoden er ikke tilladt." }, { status: 405 });
  }
  return handlers.POST(request);
}
