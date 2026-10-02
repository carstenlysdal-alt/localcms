import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { resolveOwnerConfig } from "@/lib/owner-config";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ShieldCheck } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  const owner = resolveOwnerConfig(site);
  return {
    title: `Privatliv og databeskyttelse — ${site.navn}`,
    description: `Sådan behandler ${site.navn} personoplysninger: nyhedsbrev, tips og indsendelser, annoncer, cookies og dine rettigheder.`,
    // Indtil ejeren har godkendt siden (OWNER_CONFIG / Instance.sideTekster.ejer.privatliv.godkendt) indekseres den ikke.
    ...(owner.privatliv.godkendt ? {} : { robots: { index: false, follow: true } }),
  };
}

const h2Style = { fontFamily: "var(--font-display)", fontSize: "22px", margin: "36px 0 8px 0" } as const;
const pStyle = { fontSize: "16px", lineHeight: 1.6, color: "var(--ink-2)", margin: "0 0 12px 0" } as const;
const ulStyle = { fontSize: "16px", lineHeight: 1.6, color: "var(--ink-2)", margin: "0 0 12px 0", paddingLeft: "22px" } as const;

export default async function PrivacyPage() {
  const site = await getCurrentSite();
  const email = `redaktion@${site.domaene}`;
  // Ejer-afhængige felter (T6 nr. 30): vises kun når de er konfigureret — aldrig som pladsholder i firkantede parenteser.
  const priv = resolveOwnerConfig(site).privatliv;

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "800px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Om mediet", href: "/om-mediet" },
            { label: "Privatliv" },
          ]}
        />

        <header className="site-page-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <ShieldCheck size={28} style={{ color: "var(--site-accent)" }} />
            <h1 className="site-page-title" style={{ margin: 0 }}>
              Privatliv og databeskyttelse
            </h1>
          </div>
          <p className="site-page-desc" style={{ fontSize: "18px", lineHeight: 1.5 }}>
            Kort og konkret: hvilke oplysninger {site.navn} behandler om dig, hvorfor, hvor længe, og hvordan du bruger
            dine rettigheder.
          </p>
        </header>

        <div
          role="note"
          style={{
            background: "var(--site-accent-soft)",
            borderLeft: "4px solid var(--site-accent)",
            padding: "16px 20px",
            borderRadius: "0 var(--radius-card) var(--radius-card) 0",
            margin: "20px 0 8px 0",
            fontSize: "14px",
            lineHeight: 1.5,
            color: "var(--ink-2)",
          }}
        >
          <strong>Udkast.</strong> Denne tekst afventer gennemgang af mediets ejer og en jurist (GDPR, e-privacy og presseetik).
        </div>

        <h2 style={h2Style}>1. Hvem er dataansvarlig?</h2>
        <p style={pStyle}>
          Dataansvarlig er {site.navn} Udgiverselskab, {site.kommune}, Danmark{priv.dataansvarlig ? ` (${priv.dataansvarlig})` : ""}.
          Kontakt os om privatliv på <a href={`mailto:${email}`} style={{ color: "var(--site-accent)" }}>{email}</a>.
        </p>

        <h2 style={h2Style}>2. Hvilke oplysninger behandler vi, og hvorfor?</h2>
        <ul style={ulStyle}>
          <li>
            <strong>Nyhedsbrev.</strong> E-mailadresse, evt. navn og dit valg af område/sektion. Formål: at sende nyhedsbrevet.
            Grundlag: dit samtykke (GDPR art. 6, stk. 1, litra a). Du kan til enhver tid afmelde dig.
            Vi gemmer oplysningerne, indtil du afmelder dig, hvorefter de slettes eller anonymiseres{priv.nyhedsbrevOpbevaring ? ` ${priv.nyhedsbrevOpbevaring}` : ""}.
          </li>
          <li>
            <strong>Tips, læserbreve og indsendelser</strong> (<Link href="/indsend" style={{ color: "var(--site-accent)" }}>/indsend</Link>).
            Navn, kontaktoplysninger (e-mail eller telefon), din tekst og evt. vedhæftede billeder. Formål: redaktionel
            behandling og kontakt til dig. Grundlag: dit samtykke og mediets redaktionelle virke. Kildebeskyttelse
            og tavshedspligt følger medieansvarsloven og de presseetiske regler. Afviste indsendelser slettes{priv.indsendelserSletning ? ` ${priv.indsendelserSletning}` : ""}.
          </li>
          <li>
            <strong>Annoncer og annoncekøb.</strong> Henvendelser fra annoncører og sponsorer behandles for at kunne
            besvare og indgå aftaler (kontaktperson, firma, e-mail). Grundlag: kontrakt/forberedelse heraf.
          </li>
          <li>
            <strong>Anonym måling af visninger og klik.</strong> Vi tæller artikelvisninger, læsetid og klik på annoncer for
            at kunne dokumentere rækkevidde over for annoncører og forbedre indholdet. Målingen sker på vores egen
            server, uden tredjeparts-annoncenetværk og uden at dele data med reklameaktører. Vi bruger ikke
            individuelle profiler, og målingen kræver ikke, at du er logget ind{priv.maalingAfgraensning ? `. ${priv.maalingAfgraensning}` : ""}.
          </li>
          <li>
            <strong>Serverlogs.</strong> IP-adresse og browseroplysninger kan blive logget kortvarigt af hensyn til
            drift, sikkerhed og misbrugsbeskyttelse (fx mod spam i formularer).
          </li>
          <li>
            <strong>Redaktionens login.</strong> Medarbejdere og freelancere logger ind i CMS&apos;et. Her behandles navn,
            e-mail og adgangsrettigheder.
          </li>
        </ul>

        <h2 style={h2Style}>3. Cookies og lokal lagring</h2>
        <p style={pStyle}>
          Vi bruger ikke kommercielle sporingscookies eller reklame-cookies. Offentlige sider sætter ingen
          markedsføringscookies. Der anvendes:
        </p>
        <ul style={ulStyle}>
          <li>
            <strong>Nødvendige cookies</strong> til login i redaktionens CMS (sessionscookie). Disse kræver ikke samtykke.
          </li>
          <li>
            <strong>Lokal lagring i din browser</strong> (localStorage) til funktioner du selv vælger, fx{" "}
            <Link href="/gemte" style={{ color: "var(--site-accent)" }}>gemte artikler</Link> og indstillinger på{" "}
            <Link href="/profil" style={{ color: "var(--site-accent)" }}>din profil</Link>. Oplysningerne forlader ikke din enhed,
            og du kan slette dem i din browser.
          </li>
        </ul>

        <h2 style={h2Style}>4. Modtagere og databehandlere</h2>
        <p style={pStyle}>
          Vi videregiver ikke dine oplysninger til tredjepart til markedsføring. Vi bruger databehandlere til hosting,
          database og evt. e-mailudsendelse{priv.leverandoerer ? ` (${priv.leverandoerer})` : ""}. Hvis oplysninger
          overføres uden for EU/EØS, sker det kun med gyldigt overførselsgrundlag.
        </p>

        <h2 style={h2Style}>5. Dine rettigheder</h2>
        <p style={pStyle}>Du har ret til at:</p>
        <ul style={ulStyle}>
          <li>få indsigt i, hvilke oplysninger vi har om dig,</li>
          <li>få urigtige oplysninger rettet og få slettet oplysninger (&quot;retten til at blive glemt&quot;),</li>
          <li>begrænse eller gøre indsigelse mod behandlingen og få dine data udleveret (dataportabilitet),</li>
          <li>trække et samtykke tilbage når som helst, fx ved at afmelde nyhedsbrevet.</li>
        </ul>
        <p style={pStyle}>
          Skriv til <a href={`mailto:${email}`} style={{ color: "var(--site-accent)" }}>{email}</a>, så svarer vi uden unødig
          forsinkelse og senest inden for en måned. Bemærk at journalistisk behandling er undtaget fra dele af
          reglerne (databeskyttelsesloven § 3), bl.a. af hensyn til kildebeskyttelse.
        </p>

        <h2 style={h2Style}>6. Klage</h2>
        <p style={pStyle}>
          Du kan klage til Datatilsynet, Carl Jacobsens Vej 35, 2500 Valby, <a href="https://www.datatilsynet.dk" rel="noopener" style={{ color: "var(--site-accent)" }}>datatilsynet.dk</a>.
          Klager over indhold kan rettes til os{priv.pressenaevnTilknytning ? ` eller til Pressenævnet (${priv.pressenaevnTilknytning})` : ""}.
        </p>

        <h2 style={h2Style}>7. Ændringer</h2>
        <p style={pStyle}>
          Vi opdaterer siden, når vores behandling ændres. {priv.gennemgaaetDato ? `Sidst gennemgået: ${priv.gennemgaaetDato}.` : ""}
        </p>

        <p style={{ ...pStyle, marginTop: 32 }}>
          Se også <Link href="/om-mediet/kontakt" style={{ color: "var(--site-accent)" }}>kontakt</Link>,{" "}
          <Link href="/om-mediet/redaktionelle-principper" style={{ color: "var(--site-accent)" }}>redaktionelle principper</Link> og{" "}
          <Link href="/nyhedsbrev" style={{ color: "var(--site-accent)" }}>nyhedsbrevet</Link>.
        </p>
      </div>
    </div>
  );
}
