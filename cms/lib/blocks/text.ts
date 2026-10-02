/**
 * Ren tekst ud af en blokliste (til ordtælling, læsetid, AI-kontekst og SEO-score). Ingen Next/Prisma-afhængigheder.
 */
import type { Block } from "./schema";
import { stripHtml } from "../seo/escape";

export function blockText(block: Block): string {
  switch (block.type) {
    case "paragraph": return stripHtml(block.data.content);
    case "heading":
    case "subheading":
    case "manchet": return stripHtml(block.data.text);
    case "quote": return stripHtml(block.data.quote);
    case "factbox":
    case "infobox": return `${stripHtml(block.data.title)} ${stripHtml(block.data.content)}`.trim();
    case "image": return "";
    default: return "";
  }
}

export function blocksPlainText(blocks: readonly Block[]): string {
  return blocks.map(blockText).filter(Boolean).join("\n\n");
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Læsetid i hele minutter (min. 1 hvis der er tekst); 200 ord/min er gængs for dansk nyhedstekst. */
export function readingMinutes(wordCount: number, wordsPerMinute = 200): number {
  return wordCount > 0 ? Math.max(1, Math.round(wordCount / wordsPerMinute)) : 0;
}
