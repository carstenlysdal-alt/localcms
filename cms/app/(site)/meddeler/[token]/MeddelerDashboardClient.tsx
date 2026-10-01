"use client";

import { useState, useEffect } from "react";
import { submitMeddelerTip, answerMeddelerFollowUp } from "@/app/actions/meddeler";
import {
  Radio,
  Send,
  Mic,
  MicOff,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  ArrowRight,
  Loader2,
  Copy,
  Check,
  HelpCircle,
  MessageSquare,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

type Category = "tip" | "haendelse" | "arrangement" | "sport" | "andet";

const CATEGORIES: { key: Category; label: string; short: string; help: string }[] = [
  {
    key: "tip",
    label: "Jeg har et tip",
    short: "Tip til historien",
    help: "Du har hørt, set eller opdaget noget i lokalområdet, som redaktionen bør vide eller undersøge.",
  },
  {
    key: "haendelse",
    label: "Noget er sket lige nu",
    short: "Akut hændelse",
    help: "Uheld, brand, afspærring, vejrforhold eller akut observation — du er på stedet, eller det er lige sket.",
  },
  {
    key: "arrangement",
    label: "Jeg har et arrangement",
    short: "Arrangement",
    help: "Koncert, foredrag, byfest, loppemarked eller generalforsamling til kalenderen.",
  },
  {
    key: "sport",
    label: "Sportsresultat",
    short: "Sport & Kamp",
    help: "Resultat, målscorere, oprykning eller stilling fra en lokal kamp eller stævne.",
  },
  {
    key: "andet",
    label: "Noget andet",
    short: "Andet nyt",
    help: "Foreningsnyt, jubilæum, debatindspark eller andet materiale til redaktionen.",
  },
];

interface Sag {
  id: string;
  titel: string;
  kategori: string;
  status: string;
  tekst: string;
  opfoelgning?: unknown;
  opfoelgendeSpm?: unknown;
  createdAt: Date | string;
  article?: {
    id: string;
    titel: string;
    slug: string;
    status: string;
  } | null;
}

interface MeddelerDashboardClientProps {
  token: string;
  profile: {
    id: string;
    navn: string;
    kategori: string;
    kontakt: string;
    phone?: string | null;
    omraader?: string | null;
    sager: Sag[];
  };
}

export function MeddelerDashboardClient({ token, profile }: MeddelerDashboardClientProps) {
  const [category, setCategory] = useState<Category>(
    CATEGORIES.some((c) => c.key === profile.kategori) ? (profile.kategori as Category) : "tip"
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Formularfelter
  const [what, setWhat] = useState("");
  const [who, setWho] = useState("");
  const [basis, setBasis] = useState("");
  const [where, setWhere] = useState(profile.omraader || "");
  const [when, setWhen] = useState("");
  const [text, setText] = useState("");
  const [photoCredit, setPhotoCredit] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  // Lydoptagelse / Tale
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState("");
  const [speechRec, setSpeechRec] = useState<unknown | null>(null);

  // Opfølgende spørgsmål svar-state
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replySubmitting, setReplySubmitting] = useState<Record<string, boolean>>({});
  const [answeredIds, setAnsweredIds] = useState<Record<string, boolean>>({});

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
            setAudioTranscript((prev) => (prev ? `${prev} ` : "") + transcript);
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
      alert("Taleoptagelse er ikke understøttet i denne browser. Du kan skrive dit tip i tekstfeltet.");
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

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/meddeler/${token}`;
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!what.trim()) return;

    setIsSubmitting(true);
    const photosList = photoCredit ? [{ name: "Foto fra meddeler", credit: photoCredit }] : [];

    const res = await submitMeddelerTip({
      token,
      category,
      name: profile.navn,
      email: profile.kontakt,
      phone: profile.phone || undefined,
      what,
      who,
      basis,
      where,
      when,
      text,
      audioTranscript,
      photos: photosList,
      contactOk: true,
      consent: true,
    });

    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg(true);
      setWhat("");
      setWho("");
      setBasis("");
      setWhen("");
      setText("");
      setAudioTranscript("");
      setPhotoCredit("");
      setRightsConfirmed(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      alert(res.error || "Der opstod en fejl.");
    }
  };

  const handleAnswerQuestion = async (sagId: string, question: string) => {
    const answer = replyTexts[`${sagId}-${question}`]?.trim();
    if (!answer) return;

    setReplySubmitting((prev) => ({ ...prev, [`${sagId}-${question}`]: true }));

    const res = await answerMeddelerFollowUp(token, sagId, question, answer);

    setReplySubmitting((prev) => ({ ...prev, [`${sagId}-${question}`]: false }));

    if (res.success) {
      setAnsweredIds((prev) => ({ ...prev, [`${sagId}-${question}`]: true }));
    } else {
      alert(res.error || "Kunne ikke gemme dit svar.");
    }
  };

  const currentCatMeta = CATEGORIES.find((c) => c.key === category) || CATEGORIES[0];

  // Saml alle åbne spørgsmål fra redaktionen
  const openQuestionsList: Array<{ sagId: string; sagTitel: string; question: string }> = [];
  profile.sager.forEach((sag) => {
    const list = Array.isArray(sag.opfoelgning)
      ? sag.opfoelgning
      : Array.isArray(sag.opfoelgendeSpm)
      ? sag.opfoelgendeSpm
      : [];
    list.forEach((item: { question?: string; id?: string; answered?: boolean }) => {
      const q = item.question || item.id;
      if (q && !item.answered && !answeredIds[`${sag.id}-${q}`]) {
        openQuestionsList.push({
          sagId: sag.id,
          sagTitel: sag.titel,
          question: q,
        });
      }
    });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Gemt link boks */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ maxWidth: "520px" }}>
          <strong style={{ fontSize: "13.5px", color: "var(--ink)", display: "block", marginBottom: "2px" }}>
            Dit personlige meddelerlink
          </strong>
          <span style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: "1.4" }}>
            Gem dette link eller tilføj til bogmærker. Her kan du altid følge status på dine indsendelser,
            svare på redaktionens spørgsmål og indsende nye tips.
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: copiedLink ? "#16a34a" : "var(--paper)",
            color: copiedLink ? "#ffffff" : "var(--ink)",
            border: "1px solid var(--line)",
            padding: "8px 16px",
            borderRadius: "var(--radius-pill)",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {copiedLink ? <Check size={14} /> : <Copy size={14} />}
          <span>{copiedLink ? "Link kopieret!" : "Kopiér personligt link"}</span>
        </button>
      </div>

      {/* Spørgsmål fra redaktionen, hvis der er udeståender */}
      {openQuestionsList.length > 0 && (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: "var(--radius-card)",
            padding: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", color: "#92400e" }}>
            <MessageSquare size={18} />
            <h2 style={{ margin: 0, fontSize: "17px", fontFamily: "var(--font-display)" }}>
              Redaktionen har spørgsmål til dine indberetninger ({openQuestionsList.length})
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {openQuestionsList.map(({ sagId, sagTitel, question }) => {
              const key = `${sagId}-${question}`;
              const isReplying = replySubmitting[key];
              const isAnswered = answeredIds[key];

              if (isAnswered) {
                return (
                  <div key={key} style={{ background: "#ffffff", padding: "12px 16px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                    <span style={{ fontSize: "13px", color: "#166534", fontWeight: "600" }}>✓ Dit svar er sendt til redaktionen. Tak!</span>
                  </div>
                );
              }

              return (
                <div key={key} style={{ background: "#ffffff", padding: "16px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                  <div style={{ fontSize: "12px", color: "#92400e", fontWeight: "600", marginBottom: "4px" }}>
                    Vedrørende: {sagTitel}
                  </div>
                  <div style={{ fontSize: "14.5px", fontWeight: "700", color: "#1e1a16", marginBottom: "10px" }}>
                    {question}
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Skriv dit svar her..."
                    value={replyTexts[key] || ""}
                    onChange={(e) => setReplyTexts((prev) => ({ ...prev, [key]: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      fontSize: "13.5px",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      marginBottom: "8px",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      disabled={isReplying || !replyTexts[key]?.trim()}
                      onClick={() => handleAnswerQuestion(sagId, question)}
                      style={{
                        background: "#d97706",
                        color: "#ffffff",
                        border: "none",
                        padding: "7px 16px",
                        borderRadius: "var(--radius-pill)",
                        fontSize: "12.5px",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {isReplying ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      <span>Send svar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 1. Hovedformular: Indsend nyt tip eller sag */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "28px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <Radio size={20} style={{ color: "var(--site-accent, #a63d1e)" }} />
          <h2 style={{ margin: 0, fontSize: "21px", fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
            Indsend nyt tip eller sag til redaktionen
          </h2>
        </div>

        {successMsg && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              padding: "14px 18px",
              borderRadius: "8px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <CheckCircle2 size={20} style={{ color: "#16a34a" }} />
            <div>
              <strong style={{ color: "#166534", fontSize: "14px", display: "block" }}>
                Tak for dit tip! Redaktionen har modtaget oplysningerne.
              </strong>
              <span style={{ fontSize: "12.5px", color: "#14532d" }}>
                Sagen er tilføjet til din historik nedenfor, og vi kigger på materialet hurtigst muligt.
              </span>
            </div>
          </div>
        )}

        {/* Kategori-vælger */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--ink-2)",
              marginBottom: "8px",
            }}
          >
            Vælg kategori for henvendelsen:
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {CATEGORIES.map((c) => {
              const isActive = category === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  style={{
                    padding: "7px 15px",
                    borderRadius: "var(--radius-pill)",
                    fontSize: "13px",
                    fontWeight: isActive ? "700" : "500",
                    background: isActive ? "var(--site-accent, #a63d1e)" : "var(--paper)",
                    color: isActive ? "#ffffff" : "var(--ink)",
                    border: "1px solid",
                    borderColor: isActive ? "transparent" : "var(--line)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {c.short}
                </button>
              );
            })}
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: "12.5px", color: "var(--ink-2)", fontStyle: "italic" }}>
            {currentCatMeta.help}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Overskrift / Emne */}
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "700", marginBottom: "5px", color: "var(--ink)" }}>
              {category === "tip"
                ? "Hvad handler dit tip om? *"
                : category === "haendelse"
                ? "Hvad er der sket? *"
                : category === "sport"
                ? "Hvilken kamp eller sportsbegivenhed? *"
                : category === "arrangement"
                ? "Hvad hedder arrangementet? *"
                : "Hvad drejer henvendelsen sig om? *"}
            </label>
            <input
              type="text"
              required
              placeholder={
                category === "tip"
                  ? "F.eks. Skjult affaldsdeponi fundet ved Korsør Nor eller nyt butikscenter"
                  : category === "haendelse"
                  ? "F.eks. Vandrørsbrud lukker Vestergade eller brand i industrikvarteret"
                  : category === "sport"
                  ? "F.eks. Slagelse Håndbold sikrede oprykning med 28-26 sejr"
                  : "Kort, præcis overskrift..."
              }
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                fontSize: "14.5px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Kategori-specifikke felter for Tip */}
          {category === "tip" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                  Hvem eller hvilken organisation drejer det sig om?
                </label>
                <input
                  type="text"
                  placeholder="F.eks. Teknisk forvaltning, en lokal virksomhed, klub..."
                  value={who}
                  onChange={(e) => setWho(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                  Hvordan ved du det? (Grundlag)
                </label>
                <input
                  type="text"
                  placeholder="F.eks. Har set det selv, talt med ansatte eller dokumenter..."
                  value={basis}
                  onChange={(e) => setBasis(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                />
              </div>
            </div>
          )}

          {/* Sted og tidspunkt */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Hvor i lokalområdet? (Sted/Område)
              </label>
              <input
                type="text"
                placeholder="F.eks. Slagelse By, Skælskør, Korsør..."
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                Hvornår er det sket / sker det?
              </label>
              <input
                type="text"
                placeholder="F.eks. I morges kl. 08, eller i weekenden"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
            </div>
          </div>

          {/* Tekst og Mikrofon */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)" }}>
                Uddybende detaljer, referat eller forklaring:
              </label>

              <button
                type="button"
                onClick={toggleRecording}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  background: isRecording ? "#fee2e2" : "#fef3c7",
                  color: isRecording ? "#b91c1c" : "#92400e",
                  border: `1px solid ${isRecording ? "#fca5a5" : "#fde68a"}`,
                  borderRadius: "var(--radius-pill)",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                {isRecording ? <MicOff size={13} /> : <Mic size={13} />}
                <span>{isRecording ? "Optager... Klik for stop" : "Indtal tip med mikrofon"}</span>
              </button>
            </div>

            {isRecording && (
              <div style={{ background: "#fee2e2", padding: "8px 12px", borderRadius: "6px", marginBottom: "8px", fontSize: "12px", color: "#b91c1c" }}>
                ● Lytter til din stemme... Tal tydeligt, og det bliver skrevet ind i tippet.
              </div>
            )}

            <textarea
              rows={5}
              placeholder="Beskriv alle relevante detaljer, hvad du har hørt, hvem der er berørt, og hvad redaktionen bør undersøge..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                fontSize: "14px",
                lineHeight: "1.5",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />

            {audioTranscript && (
              <div style={{ marginTop: "8px", padding: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>
                  Indtalt transskription:
                </span>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#334155" }}>{audioTranscript}</p>
              </div>
            )}
          </div>

          {/* Billeder & fotokreditering */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
              Billeder eller dokumentation til sagen
            </label>
            <input
              type="text"
              placeholder="Skriv fotografens navn eller 'Har billeder klar på telefonen'..."
              value={photoCredit}
              onChange={(e) => setPhotoCredit(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
            />
            <span style={{ display: "block", fontSize: "12px", color: "var(--ink-3)", marginTop: "3px" }}>
              Redaktionen kontakter dig, hvis der er brug for originale billedfiler i fuld opløsning.
            </span>
          </div>

          {/* Knapper */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: "var(--site-accent, #a63d1e)",
                color: "#ffffff",
                border: "none",
                borderRadius: "var(--radius-pill)",
                padding: "11px 26px",
                fontSize: "14.5px",
                fontWeight: "700",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                boxShadow: "0 2px 6px rgba(166, 61, 30, 0.25)",
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Sender tip...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Send tip til redaktionen</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Historik over tidligere sager */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "24px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h2 style={{ margin: "0 0 16px 0", fontSize: "19px", fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
          Dine indberetninger og sager ({profile.sager.length})
        </h2>

        {profile.sager.length === 0 ? (
          <p style={{ fontSize: "14px", color: "var(--ink-3)", fontStyle: "italic", margin: 0 }}>
            Du har endnu ikke indsendt sager fra denne profil. Brug formularen ovenfor til dit første tip.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {profile.sager.map((sag) => {
              const statusLabel =
                sag.status === "ArtikelOprettet" || sag.status === "BrugtIArtikel"
                  ? "Tak — redaktionen har brugt det"
                  : sag.status === "UnderBehandling"
                  ? "Redaktionen kigger på det"
                  : sag.status === "Afvist"
                  ? "Redaktionen bruger det ikke denne gang"
                  : "Modtaget";

              const statusColor =
                sag.status === "ArtikelOprettet" || sag.status === "BrugtIArtikel"
                  ? { bg: "#dcfce7", text: "#166534" }
                  : sag.status === "UnderBehandling"
                  ? { bg: "#e0e7ff", text: "#3730a3" }
                  : sag.status === "Afvist"
                  ? { bg: "#fee2e2", text: "#991b1b" }
                  : { bg: "#fef3c7", text: "#92400e" };

              return (
                <div
                  key={sag.id}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "16px 18px",
                    background: "var(--paper)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          padding: "2px 7px",
                          borderRadius: "4px",
                          background: "var(--line)",
                          color: "var(--ink-2)",
                        }}
                      >
                        {sag.kategori}
                      </span>
                      <h3 style={{ margin: 0, fontSize: "16px", color: "var(--ink)" }}>{sag.titel}</h3>
                    </div>
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: "700",
                        padding: "3px 10px",
                        borderRadius: "9999px",
                        background: statusColor.bg,
                        color: statusColor.text,
                      }}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <p style={{ margin: "0 0 10px 0", fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.5" }}>
                    {sag.tekst.length > 220 ? `${sag.tekst.slice(0, 220)}...` : sag.tekst}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", fontSize: "11.5px", color: "var(--ink-3)", paddingTop: "8px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <span>
                      Modtaget: {new Date(sag.createdAt).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>

                    {sag.article && (
                      <a
                        href={`/artikel/${sag.article.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "var(--site-accent, #a63d1e)",
                          fontWeight: "600",
                          textDecoration: "none",
                        }}
                      >
                        <span>Se publiceret artikel: {sag.article.titel}</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
