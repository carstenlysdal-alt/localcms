"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitMeddelerTip } from "@/app/actions/meddeler";
import {
  Radio,
  Send,
  Mic,
  MicOff,
  Camera,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
  Info,
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

export function MeddelerPortalClient({ kommuneNavn }: { kommuneNavn: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategoryParam = searchParams.get("kategori") as Category | null;

  const [category, setCategory] = useState<Category>(
    initialCategoryParam && CATEGORIES.some((c) => c.key === initialCategoryParam)
      ? initialCategoryParam
      : "tip"
  );

  const [storedToken, setStoredToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{ token: string; sagId: string } | null>(null);

  // Formularfelter
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [what, setWhat] = useState("");
  const [who, setWho] = useState("");
  const [basis, setBasis] = useState("");
  const [where, setWhere] = useState(kommuneNavn);
  const [when, setWhen] = useState("");
  const [text, setText] = useState("");
  const [photoCredit, setPhotoCredit] = useState("");
  const [contactOk, setContactOk] = useState(true);
  const [consent, setConsent] = useState(true);

  // Mikrofon optager
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState("");
  const [speechRec, setSpeechRec] = useState<unknown | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("local2027_meddeler_token");
      if (saved) setStoredToken(saved);
    } catch {}
  }, []);

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

  const handleTokenJump = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tokenInput.trim();
    if (clean) {
      try {
        localStorage.setItem("local2027_meddeler_token", clean);
      } catch {}
      router.push(`/meddeler/${clean}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !what) return;
    if (!consent) {
      alert("Bekræft venligst samtykket for at indsende.");
      return;
    }

    setIsSubmitting(true);
    const photosList = photoCredit ? [{ name: "Foto fra kilde", credit: photoCredit }] : [];

    const res = await submitMeddelerTip({
      category,
      name,
      email,
      phone,
      organisation,
      what,
      who,
      basis,
      where,
      when,
      text,
      audioTranscript,
      photos: photosList,
      contactOk,
      consent,
    });

    setIsSubmitting(false);

    if (res.success && res.token && res.sagId) {
      try {
        localStorage.setItem("local2027_meddeler_token", res.token);
      } catch {}
      setSuccessResult({ token: res.token, sagId: res.sagId });
    } else {
      alert(res.error || "Der opstod en fejl.");
    }
  };

  const currentCatMeta = CATEGORIES.find((c) => c.key === category) || CATEGORIES[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Gemt meddeler token genvej */}
      {storedToken && !successResult && (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: "var(--radius-card)",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <strong style={{ color: "#92400e", fontSize: "14px", display: "block" }}>
              Velkommen tilbage! Vi har fundet din meddelerprofil på denne enhed.
            </strong>
            <span style={{ fontSize: "12.5px", color: "#b45309" }}>
              Vil du åbne dit personlige panel med dine tidligere indberetninger?
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/meddeler/${storedToken}`)}
            style={{
              background: "#d97706",
              color: "#ffffff",
              border: "none",
              padding: "8px 18px",
              borderRadius: "var(--radius-pill)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Gå til mit meddelerpanel →
          </button>
        </div>
      )}

      {/* Succes kvittering */}
      {successResult ? (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "var(--radius-card)",
            padding: "36px 28px",
            textAlign: "center",
          }}
        >
          <CheckCircle2 size={46} style={{ color: "#16a34a", margin: "0 auto 12px auto" }} />
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", color: "#166534", margin: "0 0 10px 0" }}>
            Tusind tak for dit tip!
          </h2>
          <p style={{ fontSize: "15px", color: "#14532d", maxWidth: "540px", margin: "0 auto 20px auto", lineHeight: "1.5" }}>
            Redaktionen har modtaget oplysningerne i vores indbakke. Vi har oprettet din personlige meddelerside,
            hvor du altid kan følge sagens status og indsende flere oplysninger.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => router.push(`/meddeler/${successResult.token}`)}
              style={{
                background: "#16a34a",
                color: "#ffffff",
                border: "none",
                padding: "10px 24px",
                borderRadius: "var(--radius-pill)",
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Åbn mit personlige meddelerpanel →
            </button>
            <button
              type="button"
              onClick={() => {
                setSuccessResult(null);
                setWhat("");
                setText("");
                setWho("");
                setBasis("");
                setAudioTranscript("");
              }}
              style={{
                background: "transparent",
                border: "1px solid #86efac",
                color: "#166534",
                padding: "10px 20px",
                borderRadius: "var(--radius-pill)",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Send endnu et tip
            </button>
          </div>
        </div>
      ) : (
        /* Hovedformular for Tip & Meddeler */
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-card)",
            padding: "32px 28px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* Kategori-vælger */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-2)", marginBottom: "8px" }}>
              Hvad vil du fortælle redaktionen?
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
                      padding: "8px 16px",
                      borderRadius: "var(--radius-pill)",
                      fontSize: "13.5px",
                      fontWeight: isActive ? "700" : "500",
                      background: isActive ? "var(--site-accent, #9E3D1B)" : "var(--paper)",
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
            <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "var(--ink-2)", fontStyle: "italic" }}>
              {currentCatMeta.help}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* 1. Hvad handler tippet om */}
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "700", marginBottom: "6px", color: "var(--ink)" }}>
                {category === "tip"
                  ? "Hvad handler dit tip om? *"
                  : category === "haendelse"
                  ? "Hvad er der sket? *"
                  : category === "sport"
                  ? "Hvilken kamp eller sportsbegivenhed? *"
                  : category === "arrangement"
                  ? "Hvad hedder arrangementet? *"
                  : "Hvad drejer det sig om? *"}
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
                  padding: "12px 14px",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  fontSize: "15px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Specifikke Tip-felter */}
            {category === "tip" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px", color: "var(--ink)" }}>
                    Hvem eller hvilken organisation drejer det sig om?
                  </label>
                  <input
                    type="text"
                    placeholder="F.eks. Kommunens tekniske forvaltning, en lokal virksomhed, bylaug m.m."
                    value={who}
                    onChange={(e) => setWho(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px", color: "var(--ink)" }}>
                    Hvordan ved du det? (Grundlag)
                  </label>
                  <input
                    type="text"
                    placeholder="F.eks. Har set det selv, talt med ansatte, eller fundet dokumenter"
                    value={basis}
                    onChange={(e) => setBasis(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                  />
                </div>
              </div>
            )}

            {/* Sted og tidspunkt */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px", color: "var(--ink)" }}>
                  Hvor i kommunen? (Sted/Område)
                </label>
                <input
                  type="text"
                  placeholder="F.eks. Slagelse By, Skælskør, Korsør, Boeslunde..."
                  value={where}
                  onChange={(e) => setWhere(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px", color: "var(--ink)" }}>
                  Hvornår er det sket / sker det?
                </label>
                <input
                  type="text"
                  placeholder="F.eks. I morges kl. 08, eller i weekenden"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                />
              </div>
            </div>

            {/* Uddybende tekst og talememo */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)" }}>
                  Uddybende detaljer og forklaring:
                </label>

                {/* Mikrofonknap */}
                <button
                  type="button"
                  onClick={toggleRecording}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 14px",
                    background: isRecording ? "#fee2e2" : "#fef3c7",
                    color: isRecording ? "#b91c1c" : "#92400e",
                    border: `1px solid ${isRecording ? "#fca5a5" : "#fde68a"}`,
                    borderRadius: "var(--radius-pill)",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
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
                placeholder="Skriv alle relevante detaljer, hvad du har hørt, hvem der er berørt, og hvad redaktionen bør undersøge..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  fontSize: "14.5px",
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

            {/* Foto kreditering */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px", color: "var(--ink)" }}>
                Har du billeder eller dokumenter til tippet?
              </label>
              <input
                type="text"
                placeholder="Skriv fotografens navn eller 'Har billeder klar på telefonen'..."
                value={photoCredit}
                onChange={(e) => setPhotoCredit(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
              />
              <span style={{ display: "block", fontSize: "12px", color: "var(--ink-3)", marginTop: "3px" }}>
                Vi kontakter dig for at modtage originale fotos, hvis tippet bruges til en artikel.
              </span>
            </div>

            {/* Kontaktoplysninger */}
            <div style={{ paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                Dine kontaktoplysninger (behandles fortroligt)
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                    Dit fulde navn *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="F.eks. Mette Vestergaard"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                    E-mailadresse *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="F.eks. mette@mail.dk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                    Telefonnummer (til opfølgning)
                  </label>
                  <input
                    type="tel"
                    placeholder="F.eks. 20 30 40 50"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                  />
                </div>
              </div>
            </div>

            {/* Samtykke & rettigheder */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "var(--ink-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={contactOk}
                  onChange={(e) => setContactOk(e.target.checked)}
                  style={{ marginTop: "3px" }}
                />
                <span>Redaktionen må gerne kontakte mig på telefon eller e-mail for uddybende spørgsmål.</span>
              </label>

              <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "var(--ink-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ marginTop: "3px" }}
                />
                <span>
                  Jeg bekræfter, at oplysningerne gives i god tro, og at redaktionen må anvende tippet efter gældende presseetiske regler.
                </span>
              </label>
            </div>

            {/* Indsend knap */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: "var(--site-accent, #9E3D1B)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "var(--radius-pill)",
                  padding: "12px 28px",
                  fontSize: "15px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 6px rgba(158, 61, 27, 0.25)",
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Sender tip...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Send mit tip til redaktionen</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Login for eksisterende meddelere med token */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <KeyRound size={17} style={{ color: "var(--site-accent)" }} />
            <strong style={{ fontSize: "14px", color: "var(--ink)" }}>
              Er du allerede registreret meddeler?
            </strong>
          </div>
          <span style={{ fontSize: "13px", color: "var(--ink-2)" }}>
            Indtast dit personlige meddeler-token for at åbne din sagshistorik:
          </span>
        </div>

        <form onSubmit={handleTokenJump} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Indtast token..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "13px", width: "160px" }}
          />
          <button
            type="submit"
            disabled={!tokenInput.trim()}
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              padding: "8px 16px",
              borderRadius: "var(--radius-pill)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Åbn panel →
          </button>
        </form>
      </div>
    </div>
  );
}
