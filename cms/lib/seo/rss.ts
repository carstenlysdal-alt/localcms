/** RSS 2.0-generator (ren funktion). Titler/beskrivelser XML-escapes; CDATA kun hvor nødvendigt og altid ]]>-sikkert. */
import { escapeXml, stripHtml, truncateAtWord } from "./escape";

export type FeedItem = {
  title: string;
  link: string;
  guid: string;
  pubDate: Date;
  description?: string;
  creator?: string;
  categories?: string[];
  image?: { url: string; width: number; height: number; type?: string };
};

export type FeedChannel = {
  title: string;
  link: string;
  selfUrl: string;
  description: string;
  language?: string;
  lastBuildDate?: Date;
  items: FeedItem[];
};

/** RFC 822-dato i UTC. */
export function rfc822(d: Date): string {
  return d.toUTCString();
}

export function sponsoredTitlePrefix(indholdstype: string): string {
  if (indholdstype === "Sponsoreret") return "Annonce: ";
  if (indholdstype === "Partner") return "Partnerindhold: ";
  return "";
}

/** Kategorier til mærkning i feed (alt andet end Uafhængig). */
export function labelCategory(indholdstype: string): string | undefined {
  switch (indholdstype) {
    case "Sponsoreret":
      return "Sponsoreret";
    case "Partner":
      return "Partner";
    case "Brugerindsendt":
      return "Brugerindsendt";
    case "AI-assisteret":
      return "AI-assisteret";
    case "PR":
      return "Pressemeddelelse";
    default:
      return undefined;
  }
}

export function buildRss(ch: FeedChannel): string {
  const last = ch.lastBuildDate ?? ch.items.reduce<Date | null>((m, i) => (!m || i.pubDate > m ? i.pubDate : m), null) ?? new Date();
  const items = ch.items
    .map((it) => {
      const desc = it.description ? truncateAtWord(stripHtml(it.description), 400) : "";
      const cats = (it.categories ?? []).filter(Boolean).map((c) => `      <category>${escapeXml(c)}</category>`).join("\n");
      return [
        "    <item>",
        `      <title>${escapeXml(stripHtml(it.title))}</title>`,
        `      <link>${escapeXml(it.link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(it.guid)}</guid>`,
        `      <pubDate>${rfc822(it.pubDate)}</pubDate>`,
        it.creator ? `      <dc:creator>${escapeXml(it.creator)}</dc:creator>` : "",
        cats,
        desc ? `      <description>${escapeXml(desc)}</description>` : "",
        it.image
          ? `      <media:content url="${escapeXml(it.image.url)}" medium="image" type="${escapeXml(it.image.type ?? "image/jpeg")}" width="${it.image.width}" height="${it.image.height}"/>\n      <media:thumbnail url="${escapeXml(it.image.url)}" width="${it.image.width}" height="${it.image.height}"/>`
          : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(ch.title)}</title>
    <link>${escapeXml(ch.link)}</link>
    <description>${escapeXml(ch.description)}</description>
    <language>${escapeXml(ch.language ?? "da")}</language>
    <lastBuildDate>${rfc822(last)}</lastBuildDate>
    <atom:link href="${escapeXml(ch.selfUrl)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}
