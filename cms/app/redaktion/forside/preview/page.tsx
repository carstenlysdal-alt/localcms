import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Inter, Newsreader } from "next/font/google";
import "@/styles/site.css";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { composeFrontpage } from "@/lib/frontpage/compose";
import { parseModules, type ModuleInstance } from "@/lib/frontpage/layout-schema";
import { getQuota, getSnapshot, loadCandidates, loadPlacementPins, resolveFrontpageForRender } from "@/lib/frontpage/service";
import type { SlotAssignment } from "@/lib/frontpage/types";
import { parseSiteColors } from "@/lib/site";
import { FrontpageRender } from "@/components/site/frontpage/FrontpageRender";
import { buildRenderContext } from "@/components/site/frontpage/data";
import { previewDecision } from "../_lib/preview-access";

export const metadata: Metadata = { title: "Forhåndsvisning af forside", robots: { index: false, follow: false, nocache: true } };
export const dynamic = "force-dynamic";

const newsreader = Newsreader({ variable: "--font-serif", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap" });
const inter = Inter({ variable: "--font-sans", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap" });

type SP = Promise<Record<string, string | string[] | undefined>>;

/**
 * Forhåndsvisning af forsiden i editoren (vises i en iframe ved 375/768/1440 px).
 *  ?draft=<id>   en gemt kladde, komponeret med dagens artikler (almindelig rangering)
 *  ?draft=live   det publicerede layout som besøgende ser det
 *  ?snapshot=<id> et forslag oven på det publicerede layout
 * Kræver login + en forsideretighed; brugerens egen instans bruges (aldrig værten); noindex; ingen måling.
 */
export default async function PreviewPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await getAuthorizedUser();
  const decision = previewDecision(user, { draft: sp.draft, snapshot: sp.snapshot });
  if (!decision.allow) {
    if (decision.reason === "login") redirect("/login?callbackUrl=/redaktion/forside");
    notFound();
  }
  if (!user) notFound();
  const target = decision.target;

  const instance = await db.instance.findUnique({ where: { id: user.instansId } });
  if (!instance) notFound();
  const colors = parseSiteColors(instance.farver);
  const kommune = instance.navn.replace(/Lokalt$/i, "");

  let modules: ModuleInstance[];
  let assignments: SlotAssignment[];
  let description: string;
  const now = new Date();

  if (target.kind === "live") {
    const { resolved } = await resolveFrontpageForRender(user.instansId, { now });
    modules = resolved.modules;
    assignments = resolved.assignments;
    description = "Det publicerede layout, som besøgende ser det";
  } else if (target.kind === "draft") {
    const row = await db.frontpageLayout.findFirst({ where: { id: target.id, instansId: user.instansId, status: "kladde" } });
    if (!row) notFound();
    const parsed = parseModules(row.modules);
    if (!parsed.ok) notFound();
    modules = parsed.value;
    const [candidates, quota, pins] = await Promise.all([loadCandidates(user.instansId, { now }), getQuota(user.instansId), loadPlacementPins(user.instansId, now)]);
    assignments = composeFrontpage({ instansId: user.instansId, modules, candidates, pins, quota, now }).assignments;
    description = `Kladden "${row.name}" (v${row.version}) med dagens artikler og almindelig rangering`;
  } else {
    const snap = await getSnapshot(user, target.id);
    if (!snap) notFound();
    const { resolved, layout } = await resolveFrontpageForRender(user.instansId, { now });
    void resolved;
    modules = layout.modules;
    assignments = snap.items.assignments;
    description = `Forslag (${snap.snapshot.status}) oven på det publicerede layout`;
  }

  const ctx = await buildRenderContext({ id: instance.id, navn: instance.navn, kommune }, modules, assignments);
  const vars = { "--site-accent": colors.accent, "--site-accent-strong": colors.accentStrong, "--site-accent-soft": colors.accentSoft, "--site-on-accent": colors.onAccent } as React.CSSProperties;

  return (
    <>
      {/* Redaktionens sidebar skjules: siden vises i en iframe */}
      <style>{`.sidebar{display:none!important}.app-shell{display:block}.app-content{padding-bottom:0}body{background:var(--paper,#F8F6F1)}`}</style>
      <div className={`site-wrapper ${newsreader.variable} ${inter.variable}`} style={vars}>
        <p className="fp-preview-banner" role="status">
          Forhåndsvisning · {description} · ikke live, ingen måling
        </p>
        <FrontpageRender ctx={ctx} mode="preview" />
      </div>
    </>
  );
}
