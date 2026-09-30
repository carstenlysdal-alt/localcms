import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autoriseret" }, { status: 401 });
  }

  const subscribers = await db.newsletterSubscriber.findMany({
    where: { instansId: session.user.instansId },
    orderBy: { createdAt: "desc" },
  });

  // Opbyg CSV med semikolon-separator og UTF-8 BOM til Excel
  const rows: string[] = [
    ["Email", "Navn", "Omraade", "Sektion", "Status", "TilmeldtDato"].join(";"),
  ];

  for (const s of subscribers) {
    const email = `"${(s.email || "").replace(/"/g, '""')}"`;
    const navn = `"${(s.navn || "").replace(/"/g, '""')}"`;
    const omraade = `"${(s.omraadeSlug || "").replace(/"/g, '""')}"`;
    const sektion = `"${(s.sektionSlug || "").replace(/"/g, '""')}"`;
    const status = s.aktiv ? "Aktiv" : "Afmeldt";
    const dato = s.createdAt.toISOString();

    rows.push([email, navn, omraade, sektion, status, dato].join(";"));
  }

  const csvString = "\uFEFF" + rows.join("\r\n");
  const filename = `nyhedsbrev-abonnenter-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvString, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
