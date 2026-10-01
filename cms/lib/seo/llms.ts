/** llms.txt-generator (ren funktion). Format: https://llmstxt.org */
import { stripHtml, truncateAtWord } from "./escape";
import { POLICY_PATHS } from "./jsonld";

export type LlmsInput = {
  base: string;
  navn: string;
  kommune: string;
  tagline: string;
  omMediet?: string | null;
  email?: string | null;
  areas: string[];
  sections: Array<{ navn: string; slug: string }>;
  latest: Array<{ title: string; loc: string }>;
  includeCalendar?: boolean;
};

const link = (label: string, url: string, note?: string) => `- [${label}](${url})${note ? `: ${note}` : ""}`;

export function buildLlmsTxt(i: LlmsInput): string {
  const intro = i.omMediet ? truncateAtWord(stripHtml(i.omMediet), 240) : i.tagline;
  const areaText = i.areas.length > 0 ? ` Dækker ${i.areas.slice(0, 8).join(", ")}.` : "";
  const lines: string[] = [
    `# ${i.navn}`,
    `> ${intro} Lokalmedie for ${i.kommune} Kommune.${areaText} Gratis og uden betalingsmur.${i.email ? ` Redaktionen: ${i.email}.` : ""}`,
    "",
    "## Redaktion og tillid",
    link("Redaktionelle principper", `${i.base}${POLICY_PATHS.principper}`, "uafhængighed, kilder og mærkning af sponsoreret/AI-assisteret indhold"),
    link("Rettelser", `${i.base}${POLICY_PATHS.rettelser}`),
    link("Om mediet", `${i.base}${POLICY_PATHS.omMediet}`),
    link("Kontakt", `${i.base}${POLICY_PATHS.kontakt}`),
    "",
    "## Sektioner",
    ...i.sections.map((s) => link(s.navn, `${i.base}/${s.slug}`)),
    "",
    ...(i.latest.length > 0 ? ["## Seneste nyheder", ...i.latest.map((l) => link(l.title, l.loc)), ""] : []),
    "## Feeds og sitemaps",
    link("RSS", `${i.base}/feed.xml`),
    link("Sitemap", `${i.base}/sitemap.xml`),
    link("News-sitemap", `${i.base}/news-sitemap.xml`),
    "",
    "## Priser",
    link("Priser og annoncering", `${i.base}/priser`),
    "",
  ];
  return lines.join("\n");
}
