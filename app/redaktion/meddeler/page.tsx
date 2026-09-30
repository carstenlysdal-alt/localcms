import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Radio } from "lucide-react";
import { MeddelerListClient } from "./MeddelerListClient";

export default async function RedaktionMeddelerPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [meddelere, sager] = await Promise.all([
    db.meddelerProfile.findMany({
      where: { instansId: session.user.instansId },
      include: {
        _count: { select: { sager: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.meddelerSag.findMany({
      where: { instansId: session.user.instansId },
      include: {
        meddeler: true,
        article: { select: { id: true, titel: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Radio size={26} style={{ color: "#d97706" }} />
            <h1 style={{ margin: 0 }}>Meddeler-netværket</h1>
          </div>
          <p className="text-muted" style={{ marginTop: "4px" }}>
            Lokale kontaktpersoner, foreningssekretærer og beredskabskilder. Se registrerede meddelere og konvertér indberettede sager til artikler.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <a href="/meddeler" target="_blank" rel="noreferrer" className="btn btn-secondary">
            Se offentlig tilmelding ↗
          </a>
        </div>
      </div>

      <MeddelerListClient meddelere={meddelere} sager={sager} />
    </main>
  );
}
