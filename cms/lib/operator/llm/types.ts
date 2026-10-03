import type { AnthropicToolSchema } from "../registry";

/**
 * Udbyder-neutralt format for AI-operatørens modelkald. Orkestreringen (loop.ts) taler KUN dette format;
 * hver udbyder (anthropic, deepseek) oversætter til/fra sit eget API i sin adapter.
 *
 * Formatet er indholdsblokke: tekst + værktøjskald (assistent) og værktøjsresultater (bruger-tur) —
 * et værktøjskald og dets resultat hænger sammen via `id`.
 */
export type ProviderId = "anthropic" | "deepseek";

export const PROVIDER_IDS: readonly ProviderId[] = ["anthropic", "deepseek"];

export type ModelContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: unknown;
      /** Sat af en adapter når modellens argumenter ikke var gyldig JSON (rå tekst, afkortet). Loopet afviser kaldet med en tydelig fejl. */
      invalidArguments?: string;
    };
export type ModelToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type ModelMessage = { role: "user" | "assistant"; content: string | (ModelContentBlock | ModelToolResultBlock)[] };

/** Værktøjsskema (JSON Schema) udledt af det eksisterende zod-register. */
export type LlmToolSchema = AnthropicToolSchema;

export interface ModelRequest {
  system: { text: string; cache?: boolean }[];
  messages: ModelMessage[];
  tools: LlmToolSchema[];
  maxTokens: number;
  signal: AbortSignal;
  onTextDelta?: (delta: string) => void;
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "content_filter" | (string & {});

export interface ModelResponse {
  content: ModelContentBlock[];
  stopReason: StopReason;
  modelId?: string;
}

export type OperatorModelClient = (req: ModelRequest) => Promise<ModelResponse>;

export interface LlmProvider {
  readonly id: ProviderId;
  /** Visningsnavn til UI. */
  readonly label: string;
  readonly model: string;
  /**
   * True når udbyderen behandler data uden for EU/EØS eller på anden måde kræver dataminimering: loopet maskerer så
   * persondata i samtalen og i alle værktøjsresultater (se redact.ts), før noget sendes.
   */
  readonly minimiseData: boolean;
  /** Streamer svaret (kalder `onTextDelta`) og returnerer det samlede svar. */
  stream(req: ModelRequest): Promise<ModelResponse>;
  /** Samme som stream, men uden at levere delta undervejs. */
  complete(req: Omit<ModelRequest, "onTextDelta">): Promise<ModelResponse>;
}

/** Hvad UI'et og hjælpen må vide om den aktive udbyder (ingen nøgler). */
export interface ProviderInfo {
  id: ProviderId;
  label: string;
  model: string;
  minimiseData: boolean;
}

export function providerInfo(p: Pick<LlmProvider, "id" | "label" | "model" | "minimiseData">): ProviderInfo {
  return { id: p.id, label: p.label, model: p.model, minimiseData: p.minimiseData };
}
