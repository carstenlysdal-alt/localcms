"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Bookmark,
  MapPin,
  Bell,
  Heart,
  ShieldCheck,
  Check,
  Edit3,
  Save,
  KeyRound,
  ExternalLink,
  Tag,
} from "lucide-react";

type AreaItem = {
  id: string;
  navn: string;
};

type BrugerprofilProps = {
  siteNavn: string;
  kommune: string;
  areas: AreaItem[];
};

export function BrugerprofilClient({ siteNavn, kommune, areas }: BrugerprofilProps) {
  const [navn, setNavn] = useState("Lokal Læser");
  const [email, setEmail] = useState("");
  const [valgtOmraade, setValgtOmraade] = useState(areas[0]?.navn || kommune);
  const [isEditing, setIsEditing] = useState(false);
  const [gemteArtiklerCount, setGemteArtiklerCount] = useState(0);

  // Følg emner
  const [fulgteEmner, setFulgteEmner] = useState<string[]>([
    "Trafik & Veje",
    "Byråd & Politik",
  ]);

  // Nyhedsbreve
  const [morgenNl, setMorgenNl] = useState(true);
  const [weekendNl, setWeekendNl] = useState(true);
  const [breakingNl, setBreakingNl] = useState(false);

  // Indlæs fra localStorage ved opstart
  useEffect(() => {
    try {
      const gemtProfil = localStorage.getItem("lokalt_brugerprofil_v1");
      if (gemtProfil) {
        const parsed = JSON.parse(gemtProfil);
        if (parsed.navn) setNavn(parsed.navn);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.omraade) setValgtOmraade(parsed.omraade);
        if (parsed.emner) setFulgteEmner(parsed.emner);
        if (parsed.morgenNl !== undefined) setMorgenNl(parsed.morgenNl);
        if (parsed.weekendNl !== undefined) setWeekendNl(parsed.weekendNl);
        if (parsed.breakingNl !== undefined) setBreakingNl(parsed.breakingNl);
      }

      const gemte = localStorage.getItem("local2027_saved_articles");
      if (gemte) {
        const list = JSON.parse(gemte);
        setGemteArtiklerCount(list.length);
      }
    } catch {}
  }, []);

  const saveProfile = () => {
    try {
      const data = {
        navn,
        email,
        omraade: valgtOmraade,
        emner: fulgteEmner,
        morgenNl,
        weekendNl,
        breakingNl,
      };
      localStorage.setItem("lokalt_brugerprofil_v1", JSON.stringify(data));
    } catch {}
    setIsEditing(false);
  };

  const toggleEmne = (emne: string) => {
    setFulgteEmner((prev) =>
      prev.includes(emne) ? prev.filter((e) => e !== emne) : [...prev, emne]
    );
  };

  const allTopics = [
    "Trafik & Veje",
    "Byråd & Politik",
    "Erhverv & Handel",
    "Natur & Miljø",
    "Sport & Fritid",
    "Kultur & Oplevelser",
    "Børn & Skole",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* 1. Profil Hovedkort */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "28px",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "var(--site-accent-soft)",
              color: "var(--site-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: "800",
            }}
          >
            <User size={32} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", margin: 0, color: "var(--ink)" }}>
                {navn}
              </h1>
              <span
                style={{
                  background: "var(--surface-2)",
                  color: "var(--ink-2)",
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "3px 8px",
                  borderRadius: "999px",
                  border: "1px solid var(--line)",
                }}
              >
                Læserprofil
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "var(--ink-2)" }}>
              {email || "Ingen e-mail tilknyttet"} · {valgtOmraade}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isEditing) saveProfile();
            else setIsEditing(true);
          }}
          className="site-header-btn-solid"
          style={{ padding: "8px 18px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          {isEditing ? (
            <>
              <Save size={15} />
              <span>Gem profil</span>
            </>
          ) : (
            <>
              <Edit3 size={15} />
              <span>Redigér oplysninger</span>
            </>
          )}
        </button>
      </div>

      {/* Redigeringstilstand */}
      {isEditing && (
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-card)",
            padding: "24px",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 16px 0", color: "var(--ink)" }}>
            Redigér dine læseroplysninger
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Dit navn
              </label>
              <input
                type="text"
                value={navn}
                onChange={(e) => setNavn(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                E-mailadresse
              </label>
              <input
                type="email"
                placeholder="f.eks. min@email.dk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Dit primære lokalområde
              </label>
              <select
                value={valgtOmraade}
                onChange={(e) => setValgtOmraade(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px", background: "#fff" }}
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.navn}>
                    {a.navn}
                  </option>
                ))}
                <option value={kommune}>Hele {kommune}</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              style={{ background: "transparent", border: "1px solid var(--line)", padding: "8px 16px", borderRadius: "var(--radius-pill)", fontSize: "13px", cursor: "pointer" }}
            >
              Annullér
            </button>
            <button
              type="button"
              onClick={saveProfile}
              className="site-header-btn-solid"
              style={{ padding: "8px 20px", fontSize: "13px" }}
            >
              Gem ændringer
            </button>
          </div>
        </div>
      )}

      {/* 2. Grid med Gemte artikler & Støttemedlemskab */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px" }}>
        {/* Gemte artikler */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-card)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "16px", marginBottom: "8px", color: "var(--ink)" }}>
              <Bookmark size={18} style={{ color: "var(--site-accent)" }} />
              Gemte artikler
            </div>
            <p style={{ margin: "0 0 14px 0", fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45" }}>
              {gemteArtiklerCount > 0
                ? `Du har ${gemteArtiklerCount} gemte artikler gemt lokalt på denne enhed.`
                : "Du har endnu ikke gemt nogen artikler. Klik på bogmærke-ikonet på enhver artikel for at gemme den til senere."}
            </p>
          </div>
          <Link
            href="/gemte"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--site-accent)",
              fontWeight: "700",
              fontSize: "13.5px",
              textDecoration: "none",
            }}
          >
            <span>Se dine gemte artikler</span>
            <ExternalLink size={14} />
          </Link>
        </div>

        {/* Støttemedlemskab */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-card)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "16px", marginBottom: "8px", color: "var(--ink)" }}>
              <Heart size={18} style={{ color: "var(--site-accent)" }} />
              Mit medlemskab
            </div>
            <p style={{ margin: "0 0 14px 0", fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45" }}>
              Status: <strong>Gratis læserkonto</strong>. Fri adgang til al journalistik uden betalingsmur.
            </p>
          </div>
          <Link
            href="/bliv-stoette"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--site-accent)",
              fontWeight: "700",
              fontSize: "13.5px",
              textDecoration: "none",
            }}
          >
            <span>Støt med valgfrit beløb el. fast pakke →</span>
          </Link>
        </div>
      </div>

      {/* 3. Følg emner */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Tag size={18} style={{ color: "var(--site-accent)" }} />
          <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0, color: "var(--ink)" }}>
            Følg lokale emner i {kommune}
          </h2>
        </div>
        <p style={{ margin: "0 0 16px 0", fontSize: "13.5px", color: "var(--ink-2)" }}>
          Vælg de emner, du er mest interesseret i, så vi kan prioritere dem i dit personlige overblik:
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {allTopics.map((topic) => {
            const isFollowed = fulgteEmner.includes(topic);
            return (
              <button
                key={topic}
                type="button"
                onClick={() => toggleEmne(topic)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "999px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  border: isFollowed ? "1px solid var(--site-accent)" : "1px solid var(--line)",
                  background: isFollowed ? "var(--site-accent-soft)" : "var(--surface)",
                  color: isFollowed ? "var(--site-accent)" : "var(--ink)",
                  transition: "all 0.15s ease",
                }}
              >
                {isFollowed && <Check size={14} />}
                <span>{topic}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Nyhedsbreve */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
          <Bell size={18} style={{ color: "var(--site-accent)" }} />
          <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0, color: "var(--ink)" }}>
            Nyhedsbreve og notifikationer
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={morgenNl}
              onChange={(e) => setMorgenNl(e.target.checked)}
              style={{ marginTop: "3px", accentColor: "var(--site-accent)", width: "16px", height: "16px" }}
            />
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)" }}>
                Morgenoverblik (alle hverdage kl. 07.00)
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--ink-2)" }}>
                De vigtigste historier fra {kommune}, leveret før din arbejdsdag starter.
              </div>
            </div>
          </label>

          <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={weekendNl}
              onChange={(e) => setWeekendNl(e.target.checked)}
              style={{ marginTop: "3px", accentColor: "var(--site-accent)", width: "16px", height: "16px" }}
            />
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)" }}>
                Weekendguiden &quot;Det Sker&quot; (fredag kl. 14.00)
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--ink-2)" }}>
                Koncerter, loppemarkeder, spisesteder og kulturbegivenheder i weekenden.
              </div>
            </div>
          </label>

          <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={breakingNl}
              onChange={(e) => setBreakingNl(e.target.checked)}
              style={{ marginTop: "3px", accentColor: "var(--site-accent)", width: "16px", height: "16px" }}
            />
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink)" }}>
                Akutte advarsler (trafik, vejr og beredskab)
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--ink-2)" }}>
                Kun når der er markante hændelser, der påvirker hverdagen i kommunen.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 5. Mine indsendelser & Meddelerpanel */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "16px", marginBottom: "4px", color: "var(--ink)" }}>
            <KeyRound size={18} style={{ color: "var(--site-accent)" }} />
            Har du indsendt et tip eller en sag til redaktionen?
          </div>
          <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)" }}>
            Følg status på dine indberetninger i Meddelerpanelet med din personlige nøglekode.
          </p>
        </div>
        <Link
          href="/meddeler"
          className="site-header-btn-solid"
          style={{ padding: "8px 18px", fontSize: "13px", textDecoration: "none" }}
        >
          Åbn meddelerpanel →
        </Link>
      </div>

      {/* 6. Diskret admin-link til journalister */}
      <div
        style={{
          borderTop: "1px solid var(--line)",
          paddingTop: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "12.5px",
          color: "var(--ink-3)",
        }}
      >
        <span>
          Er du journalist eller redaktør på {siteNavn}?
        </span>
        <Link
          href="/login"
          style={{ color: "var(--ink-2)", textDecoration: "underline", fontWeight: "600" }}
        >
          Gå til redaktionelt login (/redaktion) →
        </Link>
      </div>
    </div>
  );
}
