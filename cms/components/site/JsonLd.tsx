import { safeJsonLd } from "@/lib/seo/escape";

/**
 * Eneste sted JSON-LD skrives til HTML. `<` escapes (</script>-breakout), tomme
 * værdier fjernes, og tomme objekter giver intet script.
 */
export function JsonLd({ data }: { data: unknown }) {
  if (!data) return null;
  const json = safeJsonLd(data);
  if (json === "{}" || json === "[]") return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
