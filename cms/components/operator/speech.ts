/**
 * Talestyring via browserens Web Speech API (lang da-DK). Ingen lyd sendes til vores server; i nogle browsere (Chrome)
 * behandles talen af browserleverandørens egen tjeneste. Denne fil er ren logik uden React, så den kan testes.
 */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognition(scope: { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor } | undefined): SpeechRecognitionCtor | null {
  if (!scope) return null;
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export const SPEECH_UNSUPPORTED = "Talegenkendelse understøttes ikke af denne browser. Brug Chrome, Edge eller Safari, eller skriv din besked.";

/** Dansk forklaring på en fejlkode fra SpeechRecognition. */
export function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Mikrofonen er blokeret. Tillad adgang til mikrofonen i browserens indstillinger, og prøv igen.";
    case "no-speech":
      return "Jeg hørte ikke noget. Tryk på mikrofonen og tal tydeligt.";
    case "audio-capture":
      return "Der blev ikke fundet en mikrofon.";
    case "network":
      return "Talegenkendelsen kunne ikke nå sin tjeneste. Tjek forbindelsen, eller skriv i stedet.";
    case "aborted":
      return "";
    default:
      return "Talegenkendelsen fejlede. Prøv igen, eller skriv din besked.";
  }
}

/** Samler resultater til (endelig, midlertidig) tekst. */
export function collectTranscript(results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>): { final: string; interim: string } {
  let final = "";
  let interim = "";
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const t = r[0]?.transcript ?? "";
    if (r.isFinal) final += t;
    else interim += t;
  }
  return { final: final.trim(), interim: interim.trim() };
}

/** Sætter dikteret tekst sammen med det der stod i feltet før mikrofonen blev tændt. */
export function mergeDictation(base: string, spoken: string): string {
  const b = base.trimEnd();
  const s = spoken.trim();
  if (!s) return base;
  return b ? `${b} ${s}` : s;
}
