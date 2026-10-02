"use client";

import { useState } from "react";
import { Lightbulb, Megaphone, Eye, Rocket, ArrowUpRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field, Notice } from "@/components/ui/Layout";
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
    <div className="adgen">
      {!isOpen ? (
        <button type="button" onClick={() => setIsOpen(true)} className="btn btn-primary">
          <Plus size={16} aria-hidden="true" /> Opret ny kampagne
        </button>
      ) : (
        <Card
          title="Banner- og annoncegenerator"
          icon={<Megaphone size={18} />}
          description="Opret first-party annoncer ud fra standardformater og priser."
          actions={<button type="button" onClick={() => setIsOpen(false)} className="btn btn-secondary btn-sm">Luk</button>}
        >
          <form action={createCampaignAction} className="adgen-grid">
            <div className="ui-stack ui-gap-md">
              <Field label="Annonceformat" htmlFor="ad-format" hint="Baseret på Min By Media og støttemodellen.">
                <select id="ad-format" name="format" value={format} onChange={(e) => handleFormatChange(e.target.value)} className="input" aria-describedby="ad-format-hint">
                  <option value="IN_FEED_BANNER">In-feed display banner: 3.500 kr./uge (1200×300 / mobil)</option>
                  <option value="EVENT_POST">Event post i kalender: 499 kr. (lokalt)</option>
                  <option value="NATIVE_PREMIUM">Native premium artikel og forside: 14.500 kr.</option>
                </select>
              </Field>

              <div className="ui-form-grid">
                <Field label="Annoncør / firmanavn" htmlFor="ad-annoncoer" required>
                  <input
                    id="ad-annoncoer"
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
                  />
                </Field>
                <Field label="Internt kampagnenavn" htmlFor="ad-titel" required>
                  <input id="ad-titel" name="titel" type="text" placeholder="fx Efterårskampagne 2026" value={titel} onChange={(e) => setTitel(e.target.value)} required className="input" />
                </Field>
              </div>

              <div>
                <div className="ui-row ui-justify-between ui-gap-sm adgen-brief-head">
                  <label className="field-label" htmlFor="ad-brief">Kort brief eller stikord om budskabet</label>
                  <button type="button" onClick={handleGenerateAgenticAngles} disabled={!annoncoer || isGenerating} className="btn btn-secondary btn-sm">
                    <Lightbulb size={14} aria-hidden="true" /> {isGenerating ? "Finder vinkler…" : "Foreslå 3 vinkler"}
                  </button>
                </div>
                <textarea id="ad-brief" rows={2} placeholder="fx Nyt menukort til efteråret med lokale råvarer fra Vestsjælland…" value={brief} onChange={(e) => setBrief(e.target.value)} className="input" />
                <p className="ui-field-hint">Vinklerne er skabeloner ud fra annoncør og brief. Der kaldes ingen AI-model.</p>
              </div>

              {suggestedAngles.length > 0 ? (
                <div role="group" aria-label="Foreslåede vinkler" className="adgen-angles">
                  <p className="ui-small ui-strong">Vælg en vinkel</p>
                  {suggestedAngles.map((ang, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={overskrift === ang.overskrift}
                      className="adgen-angle"
                      onClick={() => {
                        setOverskrift(ang.overskrift);
                        setManchet(ang.manchet);
                        setCtaTekst(ang.cta);
                      }}
                    >
                      <strong>{ang.overskrift}</strong>
                      <span className="ui-small ui-muted">{ang.manchet}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <Field label="Overskrift på kortet" htmlFor="ad-overskrift" required>
                <input id="ad-overskrift" name="overskrift" type="text" value={overskrift} onChange={(e) => setOverskrift(e.target.value)} required className="input" />
              </Field>
              <Field label="Undertekst / manchet" htmlFor="ad-manchet">
                <textarea id="ad-manchet" name="manchet" rows={2} value={manchet} onChange={(e) => setManchet(e.target.value)} className="input" />
              </Field>

              <div className="ui-form-grid">
                <Field label="Destinations-URL" htmlFor="ad-link" required>
                  <input id="ad-link" name="linkUrl" type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} required className="input" />
                </Field>
                <Field label="Knaptekst (CTA)" htmlFor="ad-cta">
                  <input id="ad-cta" name="ctaTekst" type="text" value={ctaTekst} onChange={(e) => setCtaTekst(e.target.value)} className="input" />
                </Field>
              </div>

              <fieldset className="adgen-commercial">
                <legend className="field-label">Kommercielle parametre</legend>
                <div className="adgen-commercial-grid">
                  <Field label="Aftalt pris (kr. ex moms)" htmlFor="ad-pris">
                    <input id="ad-pris" name="pris" type="number" value={pris} onChange={(e) => setPris(parseInt(e.target.value, 10) || 0)} className="input" />
                  </Field>
                  <Field label="Placering" htmlFor="ad-zone">
                    <select id="ad-zone" name="placeringZone" value={placeringZone} onChange={(e) => setPlaceringZone(e.target.value)} className="input">
                      <option value="feed">Forside in-feed (mellem zoner)</option>
                      <option value="top">Topzone / hovedplacering</option>
                      <option value="kalender">Kalendersektion</option>
                    </select>
                  </Field>
                  <Field label="Varighed" htmlFor="ad-dage">
                    <select id="ad-dage" name="dageVarighed" value={dageVarighed} onChange={(e) => setDageVarighed(e.target.value)} className="input">
                      <option value="7">7 dage (1 uge)</option>
                      <option value="14">14 dage (2 uger)</option>
                      <option value="30">30 dage (1 måned)</option>
                    </select>
                  </Field>
                </div>
              </fieldset>

              <input type="hidden" name="badgeTekst" value="ANNONCE" />

              <div>
                <button type="submit" className="btn btn-primary adgen-submit"><Rocket size={18} aria-hidden="true" /> Lancér kampagne til website</button>
              </div>
            </div>

            <div className="ui-stack ui-gap-md">
              <p className="ui-eyebrow adgen-preview-label"><Eye size={14} aria-hidden="true" /> Forhåndsvisning, som læseren ser det</p>
              <div className="adgen-stage">
                <p className="ui-small ui-muted adgen-place">
                  Placering: {placeringZone === "feed" ? "Forside in-feed" : placeringZone === "top" ? "Topzone" : "Kalender"} · Mærkning: rav-ramme og ANNONCE
                </p>
                <article className="adprev" aria-label="Forhåndsvisning af annoncen">
                  <div className="adprev-head">
                    <span className="adprev-badge">ANNONCE</span>
                    <span className="adprev-by">{annoncoer || "Virksomhedsnavn"}</span>
                  </div>
                  <h3 className="adprev-title">{overskrift || "Overskrift på annoncen vises her"}</h3>
                  <p className="adprev-text">{manchet || "Dette er underteksten eller beskrivelsen af kampagnen, som den vil fremstå på sitet."}</p>
                  <span className="adprev-cta">{ctaTekst || "Læs mere"} <ArrowUpRight size={14} aria-hidden="true" /></span>
                </article>
              </div>
              <Notice tone="warn" title="Forbrugerombudsmanden og governance">
                Annoncen overholder automatisk kravene med tydelig rav-farvet afgrænsning og badge i versaler. Den serveres 100 % first-party uden tredjeparts-scripts.
              </Notice>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
