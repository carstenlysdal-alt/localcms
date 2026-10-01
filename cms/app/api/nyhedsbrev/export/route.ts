import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { csvCell } from "@/lib/validation/text";

/** GET /api/nyhedsbrev/export — CSV over instansens abonnenter. Kræver NEWSLETTER_MANAGE (persondata). */
export async function GET() {
  const user = await getAuthorizedUser();
  if (!user) return NextResponse.json({ error: "Ikke autoriseret" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!user.permissions.includes(PERMISSIONS.NEWSLETTER_MANAGE)) {
    return NextResponse.json({ error: "Ingen adgang." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const subscribers = await db.newsletterSubscriber.findMany({
    where: { instansId: user.instansId },
    orderBy: { createdAt: "desc" },
  });

  const rows: string[] = [["Email", "Navn", "Omraade", "Sektion", "Status", "TilmeldtDato"].join(";")];
  for (const s of subscribers) {
    rows.push(
      [csvCell(s.email), csvCell(s.navn), csvCell(s.omraadeSlug), csvCell(s.sektionSlug), csvCell(s.aktiv ? "Aktiv" : "Afmeldt"), csvCell(s.createdAt)].join(";"),
    );
  }

  const filename = `nyhedsbrev-abonnenter-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response("﻿" + rows.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
