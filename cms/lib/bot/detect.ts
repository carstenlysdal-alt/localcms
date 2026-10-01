import { AI_DATA_SCRAPERS_BLOCKED, AI_SEARCH_BOTS, AI_TRAINING_BOTS } from "../seo/robots-policy";

/**
 * Klassificering af User-Agent. Ren funktion (ingen I/O), brugt af proxy.ts, tracking og rate limits.
 *
 * VIGTIGT: en User-Agent kan forfalskes. Klassen "search" betyder kun "UA'en HEVDER at være en søgemaskine"; den giver
 * lidt højere læsegrænser, men aldrig fritagelse fra bandlysning på ondsindede stier. Vil man verificere ægte Googlebot,
 * kræves omvendt DNS eller Cloudflares "Verified Bots" (se docs/ops/EDGE-HARDENING.md).
 */

export type BotKind =
  | "human" // ser ud som en almindelig browser
  | "search" // Googlebot, Bingbot, DuckDuckBot ...
  | "ai" // AI-crawlere/-assistenter angivet i lib/seo/robots-policy.ts
  | "social" // link-preview (Facebook, LinkedIn, X, WhatsApp ...)
  | "scraper" // kendte skrabere/HTTP-biblioteker/SEO-crawlere
  | "headless" // headless browsere/automation
  | "empty"; // tom eller useriøst kort UA

export type BotInfo = { kind: BotKind; name?: string };

const SEARCH_BOTS: Array<[RegExp, string]> = [
  [/googlebot|google-inspectiontool|googleother|apis-google|mediapartners-google|adsbot-google/i, "Googlebot"],
  [/bingbot|bingpreview|msnbot/i, "Bingbot"],
  [/duckduckbot/i, "DuckDuckBot"],
  [/applebot/i, "Applebot"],
  [/yandex(bot|images)/i, "YandexBot"],
  [/baiduspider/i, "Baiduspider"],
  [/qwantify|ecosia/i, "Qwant"],
  [/seznambot/i, "SeznamBot"],
];

const SOCIAL_BOTS: Array<[RegExp, string]> = [
  [/facebookexternalhit|facebot|meta-externalagent/i, "Facebook"],
  [/twitterbot/i, "X"],
  [/linkedinbot/i, "LinkedIn"],
  [/whatsapp/i, "WhatsApp"],
  [/telegrambot/i, "Telegram"],
  [/slackbot|slack-imgproxy/i, "Slack"],
  [/pinterestbot|pinterest\//i, "Pinterest"],
  [/discordbot/i, "Discord"],
  [/skypeuripreview|embedly/i, "Preview"],
];

const SCRAPERS: Array<[RegExp, string]> = [
  [/\bcurl\//i, "curl"],
  [/\bwget\//i, "wget"],
  [/python-requests|python-urllib|python-httpx|aiohttp|urllib3|httplib2/i, "python"],
  [/scrapy/i, "scrapy"],
  [/go-http-client|fasthttp/i, "go-http"],
  [/okhttp|apache-httpclient|\bjava\/|jakarta/i, "java"],
  [/libwww-perl|lwp::/i, "perl"],
  [/node-fetch|undici|axios\/|got\s?\(|superagent/i, "node-http"],
  [/\bphp\/|guzzlehttp/i, "php"],
  [/ahrefsbot|semrushbot|mj12bot|dotbot|blexbot|dataforseobot|petalbot|serpstatbot|seokicks|megaindex|zoominfobot|barkrowler/i, "seo-crawler"],
  [/httrack|webcopier|offline explorer|teleport/i, "mirror"],
  [/masscan|nmap|nikto|sqlmap|zgrab|nuclei|acunetix|nessus|openvas|wpscan|dirbuster|gobuster/i, "scanner"],
  [/\b(bot|crawler|spider|scraper)\b/i, "generic-bot"],
];

const HEADLESS = /headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver|slimerjs|electron\/.*headless/i;

const AI_NAMES = [...AI_SEARCH_BOTS, ...AI_TRAINING_BOTS];
const AI_REGEX = new RegExp(`(${AI_NAMES.map(escapeRe).join("|")}|anthropic-ai|cohere-ai|diffbot|omgili|amazonbot|youbot|ai2bot|meta-externalfetcher|friendlycrawler|timpibot)`, "i");
const BLOCKED_SCRAPER_REGEX = new RegExp(`(${AI_DATA_SCRAPERS_BLOCKED.map(escapeRe).join("|")})`, "i");

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function classifyUserAgent(userAgent: string | null | undefined): BotInfo {
  const ua = (userAgent ?? "").trim();
  if (ua.length < 10) return { kind: "empty" };
  if (BLOCKED_SCRAPER_REGEX.test(ua)) return { kind: "scraper", name: "datasamler" };
  for (const [re, name] of SEARCH_BOTS) if (re.test(ua)) return { kind: "search", name };
  if (AI_REGEX.test(ua)) return { kind: "ai", name: AI_REGEX.exec(ua)?.[1] };
  for (const [re, name] of SOCIAL_BOTS) if (re.test(ua)) return { kind: "social", name };
  if (HEADLESS.test(ua)) return { kind: "headless" };
  for (const [re, name] of SCRAPERS) if (re.test(ua)) return { kind: "scraper", name };
  return { kind: "human" };
}

/** Skal besøget undlades i målinger (visninger/klik/læsninger)? Alt der ikke ser ud som et menneske. */
export function isNonHumanForTracking(userAgent: string | null | undefined): boolean {
  return classifyUserAgent(userAgent).kind !== "human";
}

/**
 * Pr.-minut-grænse for sidevisninger pr. IP (proxy.ts). Mennesker får en generøs grænse (NAT/kontor/mobilnet),
 * søgemaskiner mere, mistænkelige klienter markant mindre.
 */
export function pageLimitPerMinute(kind: BotKind, base = 300): number {
  switch (kind) {
    case "search":
      return base * 2;
    case "ai":
      return Math.round(base / 3);
    case "social":
      return Math.round(base / 2);
    case "scraper":
    case "headless":
      return Math.max(10, Math.round(base / 5));
    case "empty":
      return Math.max(10, Math.round(base / 6));
    default:
      return base;
  }
}

/** Skaler en eksisterende grænse efter klassen (tightenLimit(30,"scraper") = 6). Minimum 1. */
export function tightenLimit(limit: number, kind: BotKind): number {
  const factor = kind === "scraper" || kind === "headless" || kind === "empty" ? 0.2 : kind === "ai" ? 0.5 : 1;
  return Math.max(1, Math.round(limit * factor));
}
