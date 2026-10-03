import { z } from "zod";

/**
 * Hændelser fra /api/operator (NDJSON: ét JSON-objekt pr. linje). Delt af server, klient og tests.
 * Ingen hændelse indeholder hemmeligheder, rå databaserækker eller stakspor.
 */
export const operatorEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), delta: z.string().max(20_000) }),
  z.object({ type: z.literal("tool_call"), id: z.string().max(80), name: z.string().max(80), summary: z.string().max(400) }),
  z.object({ type: z.literal("tool_result"), id: z.string().max(80), name: z.string().max(80), ok: z.boolean(), summary: z.string().max(600) }),
  z.object({
    type: z.literal("confirm_required"),
    token: z.string().min(16).max(128),
    tool: z.string().max(80),
    summary: z.string().max(400),
    details: z.array(z.string().max(300)).max(30),
    risk: z.literal("confirm"),
    expiresAt: z.string().max(40),
  }),
  z.object({ type: z.literal("undo"), undoId: z.string().max(80), label: z.string().max(200) }),
  z.object({ type: z.literal("done"), promptVersion: z.string().max(40), toolCalls: z.number().int().min(0).max(100), provider: z.enum(["anthropic", "deepseek"]).optional() }),
  z.object({ type: z.literal("error"), message: z.string().max(400) }),
]);

export type OperatorEvent = z.infer<typeof operatorEventSchema>;

export function encodeEvent(event: OperatorEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Inkrementel NDJSON-parser: tåler at en linje deles over flere chunks, tomme linjer og ugyldige linjer
 * (ignoreres og tælles). Rent og uden DOM, så den kan testes og bruges i klienten.
 */
export function createNdjsonParser() {
  let buffer = "";
  let invalid = 0;
  const parseLine = (line: string): OperatorEvent | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
      const parsed = operatorEventSchema.safeParse(JSON.parse(trimmed));
      if (parsed.success) return parsed.data;
    } catch {
      /* ugyldig JSON */
    }
    invalid += 1;
    return null;
  };
  return {
    push(chunk: string): OperatorEvent[] {
      buffer += chunk;
      const events: OperatorEvent[] = [];
      let at: number;
      while ((at = buffer.indexOf("\n")) >= 0) {
        const event = parseLine(buffer.slice(0, at));
        buffer = buffer.slice(at + 1);
        if (event) events.push(event);
      }
      if (buffer.length > 200_000) buffer = ""; // beskyt mod en linje uden ende
      return events;
    },
    /** Kald når strømmen er slut: tolker en sidste linje uden afsluttende linjeskift. */
    flush(): OperatorEvent[] {
      const rest = buffer;
      buffer = "";
      const event = parseLine(rest);
      return event ? [event] : [];
    },
    get invalidCount() {
      return invalid;
    },
  };
}
