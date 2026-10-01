import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { csvCell } from "@/lib/validation/text";

export async function GET() {
  const user = await getAuthorizedUser(PERMISSIONS.HONORAR_VIEW);
  if (!user) return Response.json({ error: "Ingen adgang." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const entries = await db.honorEntry.findMany({ where: { instansId: user.instansId }, include: { author: true, article: true, assignment: true }, orderBy: { generatedAt: "asc" } });
  const rows = [
    ["ID", "Status", "Modtager", "Opgave", "Artikel", "Leverancetype", "Beløb DKK", "Oprettet", "Godkendt"],
    ...entries.map((entry) => [entry.id, entry.status, entry.author.navn, entry.assignment.titel, entry.article.titel, entry.assignment.leverancetype, entry.beloeb, entry.generatedAt, entry.approvedAt]),
  ];
  const body = `﻿${rows.map((row) => row.map((cell) => csvCell(cell as string | number | Date | null)).join(";")).join("\r\n")}`;
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="honorar-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
