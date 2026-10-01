import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, getAuthorizedUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { cleanText, isSafePublicUrl } from "@/lib/validation/text";
import { db } from "@/lib/db";

async function createTopic(data: FormData) {
  "use server";
  // Server-side autorisation uafhængig af proxy.ts: rettigheden slås op i databasen.
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_CREATE);
  if (!user) return;
  const titel = cleanText(String(data.get("titel") ?? ""), 160);
  if (titel.length < 2) return;
  const beskrivelse = cleanText(String(data.get("beskrivelse") ?? ""), 1000, { multiline: true });
  const coverRaw = String(data.get("coverUrl") ?? "").trim();
  const coverUrl = isSafePublicUrl(coverRaw) ? coverRaw : "";
  const kategorier = cleanText(String(data.get("kategorier") ?? ""), 500)
    .split(",")
    .map((k) => k.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 20);
  await db.topic.create({
    data: { titel, beskrivelse: beskrivelse || null, coverUrl: coverUrl || null, kategorier, instansId: user.instansId },
  });
  redirect("/redaktion/emner");
}

export default async function NytEmnePage() {
  const session = await auth();
  if (!session?.user) return null;
  return (
    <main className="admin-main">
      <div className="page-heading"><div><h1>Nyt emne</h1><p className="text-muted">Definer et emne du vil overvåge</p></div></div>
      <form action={createTopic} className="stack" style={{ maxWidth: 640 }}>
        <div className="field"><label htmlFor="titel">Emnetitel *</label><input className="input" id="titel" name="titel" required placeholder="fx Kommunalvalg" /></div>
        <div className="field"><label htmlFor="beskrivelse">Beskrivelse</label><textarea className="input" id="beskrivelse" name="beskrivelse" rows={3} placeholder="Hvad skal overvåges?" /></div>
        <div className="field"><label htmlFor="kategorier">Kategorier (kommasepareret)</label><input className="input" id="kategorier" name="kategorier" placeholder="fx Politik, Økonomi, Lokalt" /></div>
        <div className="field"><label htmlFor="coverUrl">Cover-URL (valgfrit)</label><input className="input" id="coverUrl" name="coverUrl" type="url" placeholder="https://…" /></div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className="btn btn-primary" type="submit">Opret emne</button>
          <Link className="btn btn-secondary" href="/redaktion/emner">Annullér</Link>
        </div>
      </form>
    </main>
  );
}
