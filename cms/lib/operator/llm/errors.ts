import type { ProviderId } from "./types";

export type LlmErrorKind = "auth" | "billing" | "rate_limit" | "server" | "bad_request" | "timeout" | "network" | "aborted" | "invalid_response" | "content_filter";

/**
 * Fejl fra en modeludbyder. `userMessage` er en dansk tekst, der må vises for redaktøren (aldrig nøgler, headers eller
 * svartekst). `status` (HTTP) bruges af circuit breakeren (isBreakerFailure tæller ikke 4xx undtagen 408/429).
 */
export class LlmError extends Error {
  constructor(
    readonly provider: ProviderId,
    readonly kind: LlmErrorKind,
    readonly userMessage: string,
    readonly status?: number,
  ) {
    super(`${provider}: ${kind}${status ? ` (${status})` : ""}`);
    this.name = "LlmError";
  }
}

export function isLlmError(error: unknown): error is LlmError {
  return error instanceof LlmError;
}

const NAMES: Record<ProviderId, string> = { anthropic: "Claude", deepseek: "DeepSeek" };

/** Dansk fejltekst ud fra HTTP-status. Nævner kun variabelnavne, aldrig værdier. */
export function errorFromStatus(provider: ProviderId, status: number): LlmError {
  const name = NAMES[provider];
  if (status === 401 || status === 403) return new LlmError(provider, "auth", `${name} afviste nøglen (${status}). Kontakt administratoren: API-nøglen i Railway skal kontrolleres.`, status);
  if (status === 402) return new LlmError(provider, "billing", `${name}-kontoen mangler saldo (402). Kontakt administratoren, som skal tilføje kredit hos udbyderen.`, status);
  if (status === 429) return new LlmError(provider, "rate_limit", `${name} har for mange forespørgsler lige nu (429). Prøv igen om lidt.`, status);
  if (status >= 500) return new LlmError(provider, "server", `${name} har en fejl eller er overbelastet (${status}). Prøv igen om lidt.`, status);
  if (status === 408) return new LlmError(provider, "timeout", `${name} svarede ikke i tide (408). Prøv igen.`, status);
  return new LlmError(provider, "bad_request", `${name} afviste forespørgslen (${status}). Prøv at formulere opgaven kortere.`, status);
}
