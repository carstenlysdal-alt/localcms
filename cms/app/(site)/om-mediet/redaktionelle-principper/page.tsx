import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ShieldCheck, Handshake, AlertCircle, MessageSquare, Bot, Megaphone, CheckCircle2 } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Redaktionelle principper og etik — ${site.navn}`,
    description: `Læs om ${site.navn}s regler for uafhængighed, kilder, adskillelse af salg og redaktion, samt mærkning af indhold.`,
  };
}

export default async function EditorialPrinciplesPage() {
  const site = await getCurrentSite();

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "840px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Om mediet", href: "/om-mediet" },
            { label: "Redaktionelle principper" },
          ]}
        />

        <header className="site-page-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <ShieldCheck size={28} style={{ color: "var(--site-accent)" }} />
            <h1 className="site-page-title" style={{ margin: 0 }}>
              Redaktionelle principper
            </h1>
          </div>
          <p className="site-page-desc" style={{ fontSize: "19px", lineHeight: "1.5" }}>
            Troværdighed er vores vigtigste aktiv. Hos {site.navn} arbejder vi efter faste regler for
            uafhængighed, kildekritik, mærkning af kommercielt indhold og gennemsigtighed.
          </p>
        </header>

        {/* 1. Uafhængighed og ansvar */}
        <section style={{ margin: "36px 0" }}>
          <h2 className="site-block-heading">1. Fuld redaktionel uafhængighed</h2>
          <p className="site-block-paragraph">
            {site.navn} er et uafhængigt medie. Vi er ikke ejet af politiske partier, kommuner eller
            erhvervsinteresser. Den ansvarshavende redaktør har det fulde og uindskrænkede ansvar for
            alt redaktionelt indhold, vinkling, kildevalg og prioritering.
          </p>
          <p className="site-block-paragraph">
            Ingen annoncør, partner, kommune eller kilde kan købe sig til positiv omtale eller forhindre
            kritisk dækning. Vi er tilmeldt Pressenævnet og følger de vejledende regler for god presseskik.
          </p>
        </section>

        {/* 2. Skarp adskillelse mellem salg og redaktion */}
        <section style={{ margin: "36px 0" }}>
          <h2 className="site-block-heading">2. Skarp adskillelse mellem salg og redaktion</h2>
          <p className="site-block-paragraph">
            Vi opretholder vandtætte skotter mellem vores redaktionelle arbejde og vores kommercielle aktiviteter:
          </p>
          <ul className="site-block-list site-block-list-unordered">
            <li>Partnere og sponsorer har <strong>aldrig</strong> adgang til at læse eller godkende artikler før publicering.</li>
            <li>Journalister og redaktører må ikke deltage i salgsmøder eller forhandle partnerskaber.</li>
            <li>Kommercielle aftaler forhandles udelukkende på faste, transparente vilkår uden redaktionelle modydelser.</li>
            <li>Støtteaftaler giver synlighed og goodwill, men <strong>ingen</strong> redaktionel indflydelse.</li>
          </ul>
        </section>

        {/* 3. Mærkningsordning */}
        <section style={{ margin: "40px 0" }}>
          <h2 className="site-block-heading">3. Krystalklar mærkning af alle indholdstyper</h2>
          <p className="site-block-paragraph">
            Vores læsere skal aldrig være i tvivl om, hvem der er afsender på en artikel. Vi anvender en
            teknisk håndhævet mærkningsordning, hvor mærkningen fremgår både direkte på artikelkortet på
            forsiden og i en fremhævet informationsboks øverst i selve artiklen:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>
            {/* Uafhængig */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                padding: "16px 20px",
                borderRadius: "var(--radius-card)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <CheckCircle2 size={18} style={{ color: "#166534" }} />
                <strong style={{ fontFamily: "var(--font-display)", fontSize: "15px" }}>
                  Uafhængig lokaljournalistik (standard)
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--ink-2)", lineHeight: "1.4" }}>
                Initieret, researched og skrevet af redaktionen efter egne journalistiske kriterier. Har ingen mærkningsboks.
              </p>
            </div>

            {/* Partner */}
            <div
              style={{
                backgroundColor: "var(--label-partner-bg)",
                border: "1px solid var(--label-partner-ink)",
                padding: "16px 20px",
                borderRadius: "var(--radius-card)",
                color: "var(--label-partner-ink)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <Handshake size={18} />
                <strong style={{ fontFamily: "var(--font-display)", fontSize: "15px" }}>
                  Partnerfinansieret indhold
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.4" }}>
                Artikler om lokale initiativer finansieret som led i en flerårig støtteaftale. Redaktionen har fuld
                kontrol over vinkling og kildevalg. Mærkes med blåt badge og boks med angivelse af støttepartneren.
              </p>
            </div>

            {/* Sponsoreret / Annonce */}
            <div
              style={{
                backgroundColor: "var(--label-ad-bg)",
                border: "2px solid var(--label-ad-line)",
                padding: "16px 20px",
                borderRadius: "var(--radius-card)",
                color: "var(--label-ad-ink)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <AlertCircle size={18} />
                <strong style={{ fontFamily: "var(--font-display)", fontSize: "15px" }}>
                  Sponsoreret indhold (Annonce)
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.4" }}>
                Betalt kommercielt indhold. Mærkes med kraftig rav-ramme og tydelig &quot;ANNONCE&quot;-mærkning. Indholdet
                er ikke omfattet af mediets uafhængige dækning.
              </p>
            </div>

            {/* Brugerindsendt */}
            <div
              style={{
                backgroundColor: "var(--label-user-bg)",
                border: "1px dashed var(--label-user-ink)",
                padding: "16px 20px",
                borderRadius: "var(--radius-card)",
                color: "var(--label-user-ink)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <MessageSquare size={18} />
                <strong style={{ fontFamily: "var(--font-display)", fontSize: "15px" }}>
                  Brugerindsendt indhold (Borgerjournalistik)
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.4" }}>
                Tips, beretninger og læserbreve indsendt af lokale borgere og foreninger. Redigeres og godkendes
                af redaktionen før publicering (ingen automatisk publicering).
              </p>
            </div>

            {/* AI-assisteret */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px dashed var(--ink-2)",
                padding: "16px 20px",
                borderRadius: "var(--radius-card)",
                color: "var(--ink)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <Bot size={18} />
                <strong style={{ fontFamily: "var(--font-display)", fontSize: "15px" }}>
                  AI-assisteret indhold
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.4", color: "var(--ink-2)" }}>
                Artikler udarbejdet med sprogmodel-assistance (fx referater af byrådsdagsordener eller sportsresultater).
                Skal <strong>altid</strong> faktatjekkes og godkendes af en navngiven redaktør og liste alle kilde-URL&apos;er.
                AI må aldrig anvendes i følsomme stofområder som Krimi eller Sundhed.
              </p>
            </div>

            {/* PR */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid var(--line)",
                padding: "16px 20px",
                borderRadius: "var(--radius-card)",
                color: "var(--ink)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <Megaphone size={18} />
                <strong style={{ fontFamily: "var(--font-display)", fontSize: "15px" }}>
                  Pressemeddelelser
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.4", color: "var(--ink-2)" }}>
                Officielle meddelelser fra myndigheder, foreninger eller virksomheder, bragt til almen orientering.
                Afsenderen fremgår altid eksplicit.
              </p>
            </div>
          </div>
        </section>

        {/* 4. AI- og citatetik */}
        <section style={{ margin: "36px 0" }}>
          <h2 className="site-block-heading">4. Regler for AI og citater</h2>
          <p className="site-block-paragraph">
            Vi anvender aldrig kunstig intelligens til at opfinde eller syntetisere citater. Ethvert citat,
            der optræder i vores artikler, stammer fra et reelt mundtligt interview eller et verificerbart
            skriftligt dokument. I AI-assisterede artikler kræver vores CMS, at citatblokke er forsynet med en
            præcis kilde-URL og dato for udtalelsen.
          </p>
        </section>

        {/* 5. Rettelser og fejlfinding */}
        <section style={{ margin: "36px 0" }}>
          <h2 className="site-block-heading">5. Rettelser og åbenhed</h2>
          <p className="site-block-paragraph">
            Hvis vi begår faktuelle fejl, retter vi dem så hurtigt som muligt. Væsentlige rettelser markeres
            i selve artiklen med en tydelig rettelsesboks, der angiver hvad der blev rettet og hvornår.
            Derudover fører vi en samlet, offentlig log over alle rettelser.
          </p>
          <p style={{ marginTop: "12px" }}>
            <Link href="/om-mediet/rettelser" className="site-pill">
              Se listen over rettelser →
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
