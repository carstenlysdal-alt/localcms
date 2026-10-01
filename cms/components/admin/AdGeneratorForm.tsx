"use client";

import { useState } from "react";
import { Sparkles, Megaphone, Eye, Rocket, ArrowUpRight } from "lucide-react";
import { createCampaignAction } from "@/app/redaktion/annoncer/actions";

const FORMAT_PRESETS: Record<string, { standardPris: number; zone: string; label: string; cta: string }> = {
  IN_FEED_BANNER: {
    standardPris: 3500,
    zone: "feed",
    label: "In-Feed Display Banner (1200×300)",
    cta: "Læs mere her",
  },
  EVENT_POST: {
    standardPris: 499,
    zone: "kalender",
    label: "Event Post i Kalender",
    cta: "Køb billet / Se program",
  },
  NATIVE_PREMIUM: {
    standardPris: 14500,
    zone: "top",
    label: "Native Premium Artikel & Kort",
    cta: "Læs hele historien",
  },
};

export function AdGeneratorForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState("IN_FEED_BANNER");
  const [annoncoer, setAnnoncoer] = useState("");
  const [brief, setBrief] = useState("");
  const [titel, setTitel] = useState("");
  const [overskrift, setOverskrift] = useState("");
  const [manchet, setManchet] = useState("");
  const [ctaTekst, setCtaTekst] = useState(FORMAT_PRESETS.IN_FEED_BANNER.cta);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [pris, setPris] = useState(FORMAT_PRESETS.IN_FEED_BANNER.standardPris);
  const [dageVarighed, setDageVarighed] = useState("14");
  const [placeringZone, setPlaceringZone] = useState("feed");
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedAngles, setSuggestedAngles] = useState<Array<{ overskrift: string; manchet: string; cta: string }>>([]);

  const handleFormatChange = (newFormat: string) => {
    setFormat(newFormat);
    const preset = FORMAT_PRESETS[newFormat];
    if (preset) {
      setPris(preset.standardPris);
      setPlaceringZone(preset.zone);
      setCtaTekst(preset.cta);
    }
  };

  const handleGenerateAgenticAngles = () => {
    if (!annoncoer) return;
    setIsGenerating(true);

    // Agentisk simulation baseret på annoncør + brief
    setTimeout(() => {
      let angles = [];

      if (format === "EVENT_POST") {
        angles = [
          {
            overskrift: `${annoncoer}: Oplev en unik aften for hele familien`,
            manchet: brief || "Køb billet i forsalg og få reserveret din plads. Begrænset antal pladser.",
            cta: "Bestil billet online",
          },
          {
            overskrift: `Stor begivenhed hos ${annoncoer} i næste måned`,
            manchet: "Kom og vær med til en festlig fejring med lokale smagsprøver og musik.",
            cta: "Se fuldt program",
          },
        ];
      } else {
        angles = [
          {
            overskrift: `${annoncoer} styrker nærområdet med nye tilbud`,
            manchet: brief || "Oplev personlig rådgivning og høj kvalitet direkte hos din lokale specialist.",
            cta: "Besøg vores hjemmeside",
          },
          {
            overskrift: `Kvalitet og lokalt engagement hos ${annoncoer}`,
            manchet: "Vi støtter lokalsamfundet og leverer fleksible løsninger til private og erhverv.",
            cta: "Læs mere om mulighederne",
          },
          {
            overskrift: `Nyhed: ${annoncoer} lancerer nye faciliteter i kommunen`,
            manchet: "Få mere ud af hverdagen med gennemtænkte koncepter skabt til lokale borgere.",
            cta: "Udforsk tilbuddene her",
          },
        ];
      }

      setSuggestedAngles(angles);
      if (angles.length > 0) {
        setOverskrift(angles[0].overskrift);
        setManchet(angles[0].manchet);
        setCtaTekst(angles[0].cta);
        if (!titel) setTitel(`${annoncoer} - Kampagne`);
      }
      setIsGenerating(false);
    }, 450);
  };

  return (
    <div style={{ marginBottom: "32px" }}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="btn btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", fontSize: "0.95rem" }}
        >
          <Sparkles size={18} /> Opret Ny Kampagne (Ad-Generator)
        </button>
      ) : (
        <div className="card" style={{ padding: "24px", border: "2px solid var(--accent, #BF6415)", borderRadius: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Megaphone size={22} style={{ color: "#BF6415" }} />
                Agentisk Banner- og Ad-Generator
              </h2>
              <p className="text-muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
                Generér professionelle first-party annoncer ud fra priser og standardformater
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="btn btn-secondary"
              style={{ fontSize: "0.85rem", padding: "6px 12px" }}
            >
              Luk
            </button>
          </div>

          <form action={createCampaignAction}>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "28px" }}>
              {/* Venstre kolonne: Felter og AI generator */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Formatvælger */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                    Annonceformat (baseret på Min By Media & Støttemodellen)
                  </label>
                  <select
                    name="format"
                    value={format}
                    onChange={(e) => handleFormatChange(e.target.value)}
                    className="input"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
                  >
                    <option value="IN_FEED_BANNER">In-Feed Display Banner — 3.500 kr./uge (1200×300 / mobil)</option>
                    <option value="EVENT_POST">Event Post i Kalender — 499 kr. (lokalt)</option>
                    <option value="NATIVE_PREMIUM">Native Premium Artikel & Forside — 14.500 kr.</option>
                  </select>
                </div>

                {/* Annoncør & Brief */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                      Annoncør / Firmanavn *
                    </label>
                    <input
                      name="annoncoer"
                      type="text"
                      placeholder="fx Harboe Bryggeri A/S"
                      value={annoncoer}
                      onChange={(e) => {
                        setAnnoncoer(e.target.value);
                        if (!titel) setTitel(`${e.target.value} - Kampagne`);
                      }}
                      required
                      className="input"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                      Internt Kampagnenavn *
                    </label>
                    <input
                      name="titel"
                      type="text"
                      placeholder="fx Efterårskampagne 2026"
                      value={titel}
                      onChange={(e) => setTitel(e.target.value)}
                      required
                      className="input"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
                    />
                  </div>
                </div>

                {/* Brief & Agentisk Knap */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      Kort brief eller stikord om budskabet
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateAgenticAngles}
                      disabled={!annoncoer || isGenerating}
                      className="btn btn-secondary"
                      style={{
                        fontSize: "0.75rem",
                        padding: "4px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        color: "#92400e",
                        background: "#fef3c7",
                        borderColor: "#fde68a",
                        cursor: annoncoer ? "pointer" : "not-allowed",
                      }}
                    >
                      <Sparkles size={13} /> {isGenerating ? "Genererer vinkler..." : "AI: Generér 3 vinkler"}
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="fx Nyt menukort til efteråret med lokale råvarer fra Vestsjælland..."
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    className="input"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
                  />
                </div>

                {/* Forslag hvis genereret */}
                {suggestedAngles.length > 0 && (
                  <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Vælg genereret vinkel:
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
                      {suggestedAngles.map((ang, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setOverskrift(ang.overskrift);
                            setManchet(ang.manchet);
                            setCtaTekst(ang.cta);
                          }}
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            background: overskrift === ang.overskrift ? "#eff6ff" : "#fff",
                            border: `1px solid ${overskrift === ang.overskrift ? "#3b82f6" : "#cbd5e1"}`,
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                          }}
                        >
                          <strong>{ang.overskrift}</strong>
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{ang.manchet}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tekster på annoncen */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                    Overskrift på kortet *
                  </label>
                  <input
                    name="overskrift"
                    type="text"
                    value={overskrift}
                    onChange={(e) => setOverskrift(e.target.value)}
                    required
                    className="input"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                    Undertekst / Manchet
                  </label>
                  <textarea
                    name="manchet"
                    rows={2}
                    value={manchet}
                    onChange={(e) => setManchet(e.target.value)}
                    className="input"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
                  />
                </div>

                {/* Link & CTA */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                      Destinations-URL (Link) *
                    </label>
                    <input
                      name="linkUrl"
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      required
                      className="input"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                      Knaptekst (CTA)
                    </label>
                    <input
                      name="ctaTekst"
                      type="text"
                      value={ctaTekst}
                      onChange={(e) => setCtaTekst(e.target.value)}
                      className="input"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
                    />
                  </div>
                </div>

                {/* Kommercielle parametre: Pris, Placering, Varighed */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "8px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                      Aftalt Pris (kr. ex moms)
                    </label>
                    <input
                      name="pris"
                      type="number"
                      value={pris}
                      onChange={(e) => setPris(parseInt(e.target.value, 10) || 0)}
                      className="input"
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                      Placering
                    </label>
                    <select
                      name="placeringZone"
                      value={placeringZone}
                      onChange={(e) => setPlaceringZone(e.target.value)}
                      className="input"
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
                    >
                      <option value="feed">Forside In-Feed (Mellem zoner)</option>
                      <option value="top">Topzone / Hovedplacering</option>
                      <option value="kalender">Kalender sektion</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                      Varighed
                    </label>
                    <select
                      name="dageVarighed"
                      value={dageVarighed}
                      onChange={(e) => setDageVarighed(e.target.value)}
                      className="input"
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
                    >
                      <option value="7">7 dage (1 uge)</option>
                      <option value="14">14 dage (2 uger)</option>
                      <option value="30">30 dage (1 måned)</option>
                    </select>
                  </div>
                </div>

                <input type="hidden" name="badgeTekst" value="ANNONCE" />

                <div style={{ marginTop: "12px" }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: "100%", padding: "12px", fontSize: "1rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
                  >
                    <Rocket size={18} /> Lancér Kampagne til Website
                  </button>
                </div>
              </div>

              {/* Højre kolonne: Live Forhåndsvisning (HTML/CSS/SVG) */}
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Eye size={14} /> Live Forhåndsvisning (Som læseren ser det)
                </span>

                <div style={{ marginTop: "12px", background: "#f1f5f9", padding: "16px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "8px" }}>
                    Placering: {placeringZone === "feed" ? "Forside In-Feed" : placeringZone === "top" ? "Topzone" : "Kalender"} • Mærkning: Rav-ramme (#B8860B) + ANNONCE
                  </div>

                  {/* Render simulated ad */}
                  <div
                    style={{
                      border: "2px solid #B8860B",
                      borderTop: "4px solid #B8860B",
                      borderRadius: "8px",
                      padding: "18px 20px",
                      background: "linear-gradient(135deg, #FFFDF8 0%, #FFF9EB 100%)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span
                        style={{
                          background: "#FCE8A6",
                          color: "#4D3900",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          letterSpacing: "0.05em",
                        }}
                      >
                        ANNONCE
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "#666" }}>
                        {annoncoer || "Virksomhedsnavn"}
                      </span>
                    </div>

                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 6px", color: "#111" }}>
                      {overskrift || "Overskrift på annoncen vises her"}
                    </h3>

                    <p style={{ fontSize: "0.9rem", color: "#444", margin: "0 0 14px", lineHeight: 1.45 }}>
                      {manchet || "Dette er underteksten eller beskrivelsen af kampagnen, som den vil fremstå på sitet."}
                    </p>

                    <div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "#996500",
                          color: "#FFF",
                          padding: "8px 14px",
                          borderRadius: "6px",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                        }}
                      >
                        {ctaTekst || "Læs mere"} <ArrowUpRight size={14} />
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "16px", padding: "12px", background: "#fef3c7", borderRadius: "6px", fontSize: "0.8rem", color: "#92400e" }}>
                  <strong>Forbrugerombudsmanden & Governance:</strong> Annoncen overholder automatisk kravene med tydelig rav-farvet afgrænsning og badge i versaler. Den serveres 100% first-party uden tredjeparts-scripts.
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
