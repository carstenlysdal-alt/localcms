/**
 * robots.txt-politik. Ren data + ren funktion (testbar).
 *
 * AI-BOT-POLITIK (redaktionelt valg – ændr konstanterne nedenfor):
 *  - Søge-/citationsbots (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Claude-User, Perplexity-User)
 *    er TILLADT: de henter indhold for at citere og linke til mediet i AI-svar (synlighed + trafik).
 *  - Træningsbots GPTBot (OpenAI), ClaudeBot (Anthropic) og Google-Extended (Gemini-træning/grounding;
 *    påvirker IKKE Google Søgning) er som standard TILLADT, fordi AI-citering er en distributionskanal og
 *    T4 anbefaler åbenhed. Vil redaktionen ikke have indhold brugt til modeltræning, sæt
 *    SEO_AI_TRAINING=block (env) eller ændr AI_TRAINING_DEFAULT.
 *  - CCBot (Common Crawl), Bytespider (ByteDance) og lignende rene datasamlere er BLOKERET.
 *  - Bemærk: robots.txt er kun en høflighedsaftale; blokering forhindrer ikke indeksering via links.
 *    Brug `noindex` meta (som siderne gør) til at holde sider ude af Google, og lad dem være crawlbare.
 *
 * /api/: DISALLOWED. JSON-endpoints (fx /api/articles) er ikke sider og skal ikke i søgeindeks;
 * læsere og feeds bruger RSS (/feed.xml) og sitemaps i stedet.
 */

export const AI_SEARCH_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
] as const;

export const AI_TRAINING_BOTS = ["GPTBot", "ClaudeBot", "Google-Extended"] as const;

export const AI_DATA_SCRAPERS_BLOCKED = ["CCBot", "Bytespider"] as const;

export type AiTrainingPolicy = "allow" | "block";
export const AI_TRAINING_DEFAULT: AiTrainingPolicy = "allow";

/** Stier der aldrig skal crawles (private, token-sider, API, intern søgning). */
export const DISALLOWED_PATHS = [
  "/redaktion",
  "/api/",
  "/login",
  "/soeg",
  "/gemte",
  "/profil",
  "/velkommen",
  "/meddeler/",
  "/qa/",
  "/interview/",
  "/partner/",
] as const;

export type RobotsGroup = { userAgent: string; allow?: string; disallow?: string[] };

export function buildRobotsGroups(options: { known: boolean; aiTraining?: AiTrainingPolicy }): RobotsGroup[] {
  if (!options.known) {
    // Ukendt vært: ingenting må crawles/indekseres.
    return [{ userAgent: "*", disallow: ["/"] }];
  }
  const training = options.aiTraining ?? AI_TRAINING_DEFAULT;
  const disallow = [...DISALLOWED_PATHS];
  const groups: RobotsGroup[] = [{ userAgent: "*", allow: "/", disallow }];
  // Navngivne grupper overstyrer `*` helt, så privat-stierne gentages.
  for (const bot of AI_SEARCH_BOTS) groups.push({ userAgent: bot, allow: "/", disallow });
  for (const bot of AI_TRAINING_BOTS) {
    groups.push(training === "allow" ? { userAgent: bot, allow: "/", disallow } : { userAgent: bot, disallow: ["/"] });
  }
  for (const bot of AI_DATA_SCRAPERS_BLOCKED) groups.push({ userAgent: bot, disallow: ["/"] });
  return groups;
}
