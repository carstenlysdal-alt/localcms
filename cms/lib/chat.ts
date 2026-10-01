export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Anthropic kræver skiftende roller, der starter med "user". Slå efterfølgende ens roller sammen. */
export function normalizeHistory(turns: ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const turn of turns) {
    if (!turn.content.trim()) continue;
    const last = out[out.length - 1];
    if (last && last.role === turn.role) last.content += `\n\n${turn.content}`;
    else out.push({ ...turn });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}
