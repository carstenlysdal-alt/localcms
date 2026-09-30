"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Mic,
  MicOff,
  Paperclip,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Radio,
  FileText,
  Clock,
  MapPin,
} from "lucide-react";
import { submitCitizenProposal } from "@/app/(site)/indsend/actions";
import { submitMeddelerTip } from "@/app/actions/meddeler";

interface ThreeStepSubmissionWizardProps {
  siteNavn: string;
  kommuneNavn: string;
  areas: Array<{ id: string; navn: string }>;
  initialCategory?: string;
}

export function ThreeStepSubmissionWizard({
  siteNavn,
  kommuneNavn,
  areas,
  initialCategory = "tip",
}: ThreeStepSubmissionWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    message: string;
    token?: string;
    category: string;
  } | null>(null);

  // Step 1: Detaljer
  const [category, setCategory] = useState(initialCategory);
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [photosText, setPhotosText] = useState("");
  const [showPhotoInput, setShowPhotoInput] = useState(false);

  // Taleoptagelse
  const [isRecording, setIsRecording] = useState(false);
  const [speechRec, setSpeechRec] = useState<unknown | null>(null);

  // Step 2: Uddybning
  const [who, setWho] = useState("");
  const [whereArea, setWhereArea] = useState(areas[0]?.id || "");
  const [whenTime, setWhenTime] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [eventOrganizer, setEventOrganizer] = useState("");
  const [boardType, setBoardType] = useState<string>("Foreningsliv");
  const [anonymous, setAnonymous] = useState(false);

  // Step 3: Send & Kontakt
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .SpeechRecognition ||
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const rec = new (SpeechRecognition as new () => {
            continuous: boolean;
            interimResults: boolean;
            lang: string;
            onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void;
            onerror: () => void;
            onend: () => void;
            start: () => void;
            stop: () => void;
          })();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = "da-DK";

          rec.onresult = (event: { results: Array<Array<{ transcript: string }>> }) => {
            const transcript = Array.from(event.results)
              .map((r) => r[0].transcript)
              .join(" ");
            setMessage((prev) => (prev ? `${prev} ` : "") + transcript);
          };

          rec.onend = () => setIsRecording(false);
          rec.onerror = () => setIsRecording(false);

          setSpeechRec(rec);
        } catch {}
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!speechRec) {
      alert("Taleoptagelse er ikke understøttet i denne browser. Du kan skrive i tekstfeltet.");
      return;
    }
    const rec = speechRec as { start: () => void; stop: () => void };
    if (isRecording) {
      rec.stop();
      setIsRecording(false);
    } else {
      try {
        rec.start();
        setIsRecording(true);
      } catch {
        setIsRecording(false);
      }
    }
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (step === 1) {
      if (!message.trim() || message.trim().length < 5) {
        setErrorMsg("Beskriv venligst din historie, dit tip eller dit arrangement (mindst 5 tegn).");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Angiv venligst dit navn.");
      return;
    }
    if (!contact.trim() || !contact.includes("@")) {
      setErrorMsg("Angiv venligst en gyldig e-mailadresse.");
      return;
    }
    if (!consent) {
      setErrorMsg("Du skal acceptere samtykket for at indsende.");
      return;
    }

    setSubmitting(true);

    try {
      // Send til både Meddeler- og Submission-infrastrukturen
      const categoryMap: Record<string, "tip" | "haendelse" | "arrangement" | "sport" | "andet"> = {
        tip: "tip",
        haendelse: "haendelse",
        arrangement: "arrangement",
        sport: "sport",
        opslagstavle: "andet",
        debat: "andet",
      };

      const mappedCat = categoryMap[category] || "tip";

      const whereName = areas.find((a) => a.id === whereArea)?.navn || kommuneNavn;

      let detailString = message;
      if (category === "arrangement" && eventDate) {
        detailString += `\n\n[ARRANGEMENT DETALJER]:\nDato: ${eventDate}\nSted: ${eventAddress}\nArrangør: ${eventOrganizer}`;
      }
      if (category === "opslagstavle") {
        detailString += `\n\n[OPSLAGSTAVLE]:\nKategori: ${boardType}`;
      }

      const res = await submitMeddelerTip({
        category: mappedCat,
        name: name.trim(),
        email: contact.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        what: headline.trim() || message.slice(0, 60),
        who: who.trim() || undefined,
        where: whereName,
        when: whenTime.trim() || eventDate || undefined,
        text: detailString,
        photos: photosText ? [{ name: "Indsendt foto", credit: name }] : [],
        consent: true,
      });

      // Opret også som klassisk Submission for CMS Indbakke
      const fd = new FormData();
      fd.append("navn", name.trim());
      fd.append("kontakt", contact.trim());
      fd.append("emne", headline.trim() || `Indsendt [${category.toUpperCase()}]: ${message.slice(0, 45)}`);
      fd.append("tekst", detailString);
      if (whereArea) fd.append("omraadeId", whereArea);
      if (photosText) fd.append("billeder", photosText);
      fd.append("rettigheder", "true");
      fd.append("samtykke", "true");
      await submitCitizenProposal(null, fd);

      setSubmitting(false);

      if (res.success) {
        setSuccessInfo({
          message: "Mange tak for din henvendelse! Redaktionen har modtaget dine oplysninger.",
          token: res.token,
          category,
        });
      } else {
        setErrorMsg(res.error || "Der opstod en fejl.");
      }
    } catch {
      setSubmitting(false);
      setErrorMsg("Der opstod en uventet fejl. Prøv venligst igen.");
    }
  };

  return (
    <div className="submission-mock-container">
      {/* Topbar med Tilbage, brand og Ikon */}
      <div className="submission-mock-topbar">
        <Link href="/" className="submission-back-btn">
          <ArrowLeft size={16} />
          <span>Tilbage</span>
        </Link>
        <span className="submission-brand-name">{siteNavn}</span>
        <div className="submission-mail-badge">
          <Mail size={18} fill="#BA4A28" color="#BA4A28" />
        </div>
      </div>

      {successInfo ? (
        <div className="submission-success-card">
          <CheckCircle2 size={54} className="submission-success-icon" />
          <h2 className="submission-success-title">Mange tak for din historie!</h2>
          <p className="submission-success-text">
            {successInfo.message} Vores journalister gennemgår henvendelsen ud fra mediets redaktionelle principper.
          </p>

          {successInfo.token && (
            <div className="submission-token-card">
              <span className="submission-token-label">Din personlige meddelerkode:</span>
              <code className="submission-token-code">{successInfo.token}</code>
              <p className="submission-token-desc">
                Gem denne kode for at følge sagens forløb eller tilføje flere oplysninger.
              </p>
              <Link
                href={`/meddeler/${successInfo.token}`}
                className="submission-token-btn"
              >
                Følg dit tip i dit meddelerpanel →
              </Link>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px", flexWrap: "wrap" }}>
            <Link href="/" className="submission-btn-primary" style={{ textDecoration: "none" }}>
              Gå til forsiden
            </Link>
            <button
              type="button"
              onClick={() => {
                setSuccessInfo(null);
                setStep(1);
                setHeadline("");
                setMessage("");
              }}
              className="submission-btn-secondary"
            >
              Indsend en ny historie
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="submission-hero">
            <h1 className="submission-title">Indsend historie</h1>
            <p className="submission-lead">
              Har du en historie, et tip eller et arrangement, vi bør kende til?
              Vi lytter til vores læsere. Din henvendelse kan være med til at sætte vigtige emner på dagsordenen i {kommuneNavn}.
            </p>
          </div>

          {/* 3-Trins Progress Bar */}
          <div className="submission-progress-bar">
            <div className={`submission-step-node ${step >= 1 ? "is-active" : ""}`}>
              <div className="submission-step-circle">1</div>
              <span className="submission-step-label">Detaljer</span>
            </div>
            <div className={`submission-progress-line ${step >= 2 ? "is-active" : ""}`} />
            <div className={`submission-step-node ${step >= 2 ? "is-active" : ""}`}>
              <div className="submission-step-circle">2</div>
              <span className="submission-step-label">Uddybning</span>
            </div>
            <div className={`submission-progress-line ${step >= 3 ? "is-active" : ""}`} />
            <div className={`submission-step-node ${step >= 3 ? "is-active" : ""}`}>
              <div className="submission-step-circle">3</div>
              <span className="submission-step-label">Send</span>
            </div>
          </div>

          {errorMsg && (
            <div className="submission-alert-error">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TRIN 1: DETALJER */}
          {step === 1 && (
            <form onSubmit={handleNextStep} className="submission-form-card">
              <div className="submission-field-group">
                <label className="submission-label">
                  Hvad handler din henvendelse om?
                </label>
                <div className="submission-select-wrapper">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="submission-select"
                  >
                    <option value="tip">Tip til historien (Redaktionen bør undersøge)</option>
                    <option value="haendelse">Noget er sket lige nu (Akut hændelse/trafik/vejr)</option>
                    <option value="sport">Sportsresultat & Kampreferat</option>
                    <option value="arrangement">Arrangement til den lokale kalender</option>
                    <option value="opslagstavle">Opslag til den lokale opslagstavle</option>
                    <option value="debat">Læserbrev / Debatindlæg</option>
                  </select>
                </div>
              </div>

              <div className="submission-field-group">
                <label className="submission-label">
                  Overskrift <span className="submission-optional">(valgfri)</span>
                </label>
                <input
                  type="text"
                  placeholder="Kort og præcis overskrift"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="submission-input"
                />
              </div>

              <div className="submission-field-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label className="submission-label" style={{ margin: 0 }}>
                    Din besked <span className="submission-req">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`submission-mic-btn ${isRecording ? "is-recording" : ""}`}
                    title="Indtal med mikrofonen"
                  >
                    {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
                    <span>{isRecording ? "Stopper optagelse..." : "Indtal med tale"}</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  required
                  placeholder={
                    category === "arrangement"
                      ? "Beskriv arrangementet: hvad sker der, hvem henvender det sig til, pris m.m."
                      : category === "opslagstavle"
                      ? "Hvad vil du gerne dele på opslagstavlen? (Foreningsnyt, frivillige søges, efterlysning osv.)"
                      : "Beskriv din historie, dit tip eller dit arrangement ..."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="submission-textarea"
                />
              </div>

              {/* Tilføj billeder knap */}
              <div className="submission-field-group">
                {!showPhotoInput ? (
                  <button
                    type="button"
                    onClick={() => setShowPhotoInput(true)}
                    className="submission-attach-btn"
                  >
                    <Paperclip size={16} />
                    <span>Tilføj billeder eller filer (valgfrit)</span>
                  </button>
                ) : (
                  <div>
                    <label className="submission-label">
                      Billedlinks eller filbeskrivelse
                    </label>
                    <input
                      type="text"
                      placeholder="Indsæt link til fotos (f.eks. Dropbox, Google Drev, Imgur) eller beskriv billeder"
                      value={photosText}
                      onChange={(e) => setPhotosText(e.target.value)}
                      className="submission-input"
                    />
                  </div>
                )}
              </div>

              <div className="submission-action-row">
                <button type="submit" className="submission-btn-primary">
                  <span>Næste skridt</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* TRIN 2: UDDYBNING */}
          {step === 2 && (
            <form onSubmit={handleNextStep} className="submission-form-card">
              <div className="submission-step-header">
                <h2 className="submission-step-title">Uddybende oplysninger</h2>
                <p className="submission-step-sub">
                  Hjælp redaktionen med at forstå sagens geografiske placering og kontekst.
                </p>
              </div>

              {category === "arrangement" && (
                <>
                  <div className="submission-field-group">
                    <label className="submission-label">
                      Dato og klokkeslæt for arrangementet <span className="submission-req">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="F.eks. Lørdag d. 14. oktober kl. 10:00 - 16:00"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="submission-input"
                    />
                  </div>
                  <div className="submission-field-group">
                    <label className="submission-label">
                      Sted / Adresse for arrangementet
                    </label>
                    <input
                      type="text"
                      placeholder="F.eks. Slagelse Musikhus, Sdr. Stationsvej 1"
                      value={eventAddress}
                      onChange={(e) => setEventAddress(e.target.value)}
                      className="submission-input"
                    />
                  </div>
                  <div className="submission-field-group">
                    <label className="submission-label">
                      Arrangør / Forening
                    </label>
                    <input
                      type="text"
                      placeholder="F.eks. Slagelse Kulturforening eller Korsør Bylaug"
                      value={eventOrganizer}
                      onChange={(e) => setEventOrganizer(e.target.value)}
                      className="submission-input"
                    />
                  </div>
                </>
              )}

              {category === "opslagstavle" && (
                <div className="submission-field-group">
                  <label className="submission-label">
                    Kategori på opslagstavlen
                  </label>
                  <select
                    value={boardType}
                    onChange={(e) => setBoardType(e.target.value)}
                    className="submission-select"
                  >
                    <option value="Foreningsliv">Foreningsliv & Klubnyt</option>
                    <option value="Frivillige">Frivillige hænder søges</option>
                    <option value="Efterlysning">Efterlysning & Fundet</option>
                    <option value="Nabolag">Nabolag & Vejfester</option>
                    <option value="Initiativ">Lokalt initiativ & Borgerforslag</option>
                  </select>
                </div>
              )}

              <div className="submission-field-group">
                <label className="submission-label">
                  Hvor i kommunen? (Område)
                </label>
                <select
                  value={whereArea}
                  onChange={(e) => setWhereArea(e.target.value)}
                  className="submission-select"
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.navn}
                    </option>
                  ))}
                  <option value="">Hele {kommuneNavn}</option>
                </select>
              </div>

              <div className="submission-field-group">
                <label className="submission-label">
                  Hvem eller hvad drejer det sig om? <span className="submission-optional">(valgfri)</span>
                </label>
                <input
                  type="text"
                  placeholder="F.eks. Byrådet, en lokal klub, teknisk forvaltning..."
                  value={who}
                  onChange={(e) => setWho(e.target.value)}
                  className="submission-input"
                />
              </div>

              {category !== "arrangement" && (
                <div className="submission-field-group">
                  <label className="submission-label">
                    Hvornår skete det? <span className="submission-optional">(valgfri)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="F.eks. I morges, i weekenden, eller løbende over en måned"
                    value={whenTime}
                    onChange={(e) => setWhenTime(e.target.value)}
                    className="submission-input"
                  />
                </div>
              )}

              {/* Fortrolighed & Kildebeskyttelse */}
              <div className="submission-field-checkbox">
                <input
                  type="checkbox"
                  id="anonymousCheck"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                />
                <label htmlFor="anonymousCheck">
                  <strong>Jeg ønsker fuld kildebeskyttelse / anonymitet over for offentligheden.</strong> Redaktionen må godt kende min identitet til faktatjek, men mit navn må ikke bringes i artiklen.
                </label>
              </div>

              <div className="submission-action-row">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="submission-btn-secondary"
                >
                  ← Tilbage
                </button>
                <button type="submit" className="submission-btn-primary">
                  <span>Gå til afsendelse</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* TRIN 3: SEND & BEKRÆFT */}
          {step === 3 && (
            <form onSubmit={handleFinalSubmit} className="submission-form-card">
              <div className="submission-step-header">
                <h2 className="submission-step-title">Kontaktoplysninger</h2>
                <p className="submission-step-sub">
                  Redaktionen skal kunne kontakte dig ved spørgsmål eller for at bekræfte oplysningerne.
                </p>
              </div>

              <div className="submission-field-group">
                <label className="submission-label">
                  Dit fulde navn <span className="submission-req">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="F.eks. Mette Vestergaard"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="submission-input"
                />
              </div>

              <div className="submission-field-group">
                <label className="submission-label">
                  Din e-mailadresse <span className="submission-req">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="din-email@adresse.dk"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="submission-input"
                />
              </div>

              <div className="submission-field-group">
                <label className="submission-label">
                  Telefonnummer <span className="submission-optional">(valgfrit)</span>
                </label>
                <input
                  type="tel"
                  placeholder="+45 12 34 56 78"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="submission-input"
                />
              </div>

              {/* Samtykke */}
              <div className="submission-field-checkbox">
                <input
                  type="checkbox"
                  id="consentCheck"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <label htmlFor="consentCheck">
                  Jeg bekræfter, at de indsendte oplysninger er sandfærdige, og at redaktionen på {siteNavn} må behandle dem i henhold til mediets redaktionelle principper og de presseetiske regler.
                </label>
              </div>

              <div className="submission-action-row">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="submission-btn-secondary"
                  disabled={submitting}
                >
                  ← Tilbage
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="submission-btn-primary"
                >
                  {submitting ? "Sender din henvendelse..." : "Indsend historie nu"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
