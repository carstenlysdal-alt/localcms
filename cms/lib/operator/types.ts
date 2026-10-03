import type { z } from "zod";
import type { AuthorizedUser } from "../auth";
import type { Permission } from "../permissions";
import type { AiTextClient } from "../frontpage/ai-client";
import type { Risk } from "./policy";
import type { ExternalLlmSpec } from "./redact";

/** Afhængigheder der kan injiceres i tests (ingen netværk). */
export interface ToolDeps {
  /** Klient til forsidens naturligt-sprog-fortolkning (nl-commands). Udeladt = den rigtige (ANTHROPIC_API_KEY). */
  frontpageClient?: AiTextClient | null;
}

/**
 * Kontekst for ét værktøjskald. Bevidst IKKE et input: `user` er slået op i databasen (getAuthorizedUser), og
 * `instansId` stammer altid fra brugeren — aldrig fra modellen.
 */
export interface ToolCtx {
  user: AuthorizedUser;
  instansId: string;
  now: Date;
  sessionId: string | null;
  /** Aktiv modeludbyder (anthropic | deepseek) når handlingen udløses af en model; skrives i revisionssporet (aldrig indhold). */
  provider?: string | null;
  ip?: string | null;
  deps: ToolDeps;
}

/** Recept der kan føre en safe-write tilbage. `tool` peger på værktøjet hvis `undo()` udfører den. */
export interface UndoRecipe {
  tool: string;
  input: Record<string, unknown>;
  /** Kort dansk tekst til Fortryd-knappen, fx "Fortryd: 6 sektioner oprettet". */
  label: string;
}

export interface ToolOutcome {
  ok: boolean;
  /** Kort dansk resumé uden følsomme data. Vises i UI og gives til modellen. */
  summary: string;
  /** Data til modellen (afkortes og pakkes som DATA før brug). Aldrig hemmeligheder. */
  data?: unknown;
  /** Id'er på det der er oprettet/ændret (til revisionsspor). */
  resultIds?: string[];
  undo?: UndoRecipe | null;
  /** Vises kun i brugerens egen browser ved bekræftelse (fx midlertidig adgangskode). Gemmes og logges aldrig. */
  clientSecret?: { label: string; value: string } | null;
}

export interface ToolDef<S extends z.ZodType = z.ZodType> {
  /** snake_case, ASCII. */
  name: string;
  /** Dansk beskrivelse til modellen. */
  description: string;
  input: S;
  /** Gruppe i hjælpen/UI'et, fx "Sektioner", "Artikler", "LocalRating". Frit valg; nye moduler vælger selv. */
  category: string;
  risk: Risk;
  /** Brugeren skal have MINDST ÉN af disse (samme semantik som getAuthorizedUser). */
  permissions: readonly Permission[];
  /** ...og ALLE disse (fx forsidens AI-kommandoer kræver to rettigheder). */
  alsoRequires?: readonly Permission[];
  /**
   * Dataminimering til eksterne udbydere (DeepSeek): hvad der IKKE må forlade processen for dette værktøj (fx navnet på en
   * indsender eller bruger). Kontaktfelter (e-mail, telefon, afsender, adresse …) fjernes altid generelt; tekst maskeres altid.
   * Et værktøj der returnerer persondata SKAL erklære sine felter her (se redact.ts og ADR-017).
   */
  externalLlm?: ExternalLlmSpec;
  /** Læse-værktøjer skrives kun til AuditLog når dette er sat (fx brugerlister). Skrivende værktøjer logges altid. */
  audit?: boolean;
  /** Kort dansk resumé af hvad kaldet gør (vises i tool_call og i bekræftelseskortet). Uden hemmeligheder. */
  summarize(input: z.infer<S>): string;
  /**
   * Linjer til bekræftelseskortet: præcis hvad der sker (må slå op i databasen). Kaster ToolError hvis det kaldet
   * peger på ikke findes — så udstedes der intet token, og modellen får fejlen.
   */
  details?(ctx: ToolCtx, input: z.infer<S>): Promise<string[]> | string[];
  execute(ctx: ToolCtx, input: z.infer<S>): Promise<ToolOutcome>;
  /** Udfører en recept fra `execute`. Må kun føre tilbage det operatøren selv gjorde. */
  undo?(ctx: ToolCtx, input: Record<string, unknown>): Promise<{ ok: boolean; summary: string }>;
}

export type AnyTool = ToolDef<z.ZodType>;

/** Typesikker definition: skemaet afgør input-typen i summarize/execute; registret gemmer den type-slettede form. */
export function defineTool<S extends z.ZodType>(def: ToolDef<S>): AnyTool {
  return def as unknown as AnyTool;
}

/** Fejl med en dansk tekst der må vises for brugeren/modellen. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}
