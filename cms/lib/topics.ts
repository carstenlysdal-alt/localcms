import { db } from "./db";
import { cleanText, isSafePublicUrl } from "./validation/text";

/**
 * Emner (Topic): ren service uden FormData, delt af siden Nyt emne og AI-operatøren.
 * Tenant-binding: instansId kommer altid fra den udførende brugers DB-række, aldrig fra input.
 */
export interface TopicInput {
  titel: unknown;
  beskrivelse?: unknown;
  coverUrl?: unknown;
  /** Liste eller kommasepareret tekst. */
  kategorier?: unknown;
}

export function parseTopicInput(input: TopicInput) {
  const titel = cleanText(input.titel, 160);
  if (titel.length < 2) return null;
  const beskrivelse = cleanText(input.beskrivelse, 1000, { multiline: true });
  const coverRaw = typeof input.coverUrl === "string" ? input.coverUrl.trim() : "";
  const coverUrl = isSafePublicUrl(coverRaw) ? coverRaw : "";
  const rawCategories = Array.isArray(input.kategorier) ? input.kategorier.map(String).join(",") : cleanText(input.kategorier, 500);
  const kategorier = cleanText(rawCategories, 500)
    .split(",")
    .map((k) => k.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 20);
  return { titel, beskrivelse: beskrivelse || null, coverUrl: coverUrl || null, kategorier };
}

/** Opretter et emne i brugerens instans. Returnerer null ved ugyldigt input (titel under 2 tegn). */
export async function createTopic(user: { instansId: string }, input: TopicInput) {
  const parsed = parseTopicInput(input);
  if (!parsed) return null;
  return db.topic.create({ data: { ...parsed, instansId: user.instansId } });
}

export async function deleteTopic(user: { instansId: string }, id: string): Promise<boolean> {
  const res = await db.topic.deleteMany({ where: { id, instansId: user.instansId } });
  return res.count === 1;
}
