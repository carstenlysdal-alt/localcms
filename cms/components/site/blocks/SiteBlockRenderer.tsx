import Image from "next/image";
import type { Block } from "@/lib/blocks/schema";
import { sanitizeHtml, safeHref, type SanitizeOptions } from "@/lib/html-sanitize";

type SiteBlockRendererProps = {
  blocks: Block[];
  /** Ekstra rel-tokens på eksterne links i brødteksten: ["sponsored"] (Partner/Sponsoreret), ["ugc"] (Brugerindsendt). */
  linkRel?: string[];
};

/**
 * Afkoder entity-escapet HTML og sanitiserer med en allowlist (lib/html-sanitize.ts).
 * Alt der sendes til dangerouslySetInnerHTML skal igennem denne funktion.
 */
export function normalizeHtml(content: string, options?: SanitizeOptions): string {
  if (!content) return "";
  let text = content;
  // Hvis teksten er HTML-entity-escapet som fx &lt;p&gt;&lt;strong&gt;
  if (text.includes("&lt;") && text.includes("&gt;")) {
    text = text
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
  }
  return sanitizeHtml(text, options);
}

export function SiteBlockRenderer({ blocks, linkRel }: SiteBlockRendererProps) {
  if (!blocks || blocks.length === 0) return null;
  const sanitizeOpts: SanitizeOptions = { linkRel };
  const normalizeHtml_ = (content: string) => normalizeHtml(content, sanitizeOpts);

  return (
    <div className="site-article-blocks">
      {blocks.map((block) => {
        switch (block.type) {
          case "paragraph":
            return (
              <div
                key={block.id}
                className="site-block-paragraph"
                dangerouslySetInnerHTML={{ __html: normalizeHtml_(block.data.content) }}
              />
            );

          case "heading": {
            const HeadingTag = block.data.level === 3 ? "h3" : "h2";
            return (
              <HeadingTag
                key={block.id}
                className="site-block-heading"
                dangerouslySetInnerHTML={{ __html: normalizeHtml_(block.data.text) }}
              />
            );
          }

          case "subheading":
            return (
              <h3
                key={block.id}
                className="site-block-heading"
                style={{ fontSize: "22px" }}
                dangerouslySetInnerHTML={{ __html: normalizeHtml_(block.data.text) }}
              />
            );

          case "manchet":
            return (
              <div
                key={block.id}
                className="site-article-manchet"
                dangerouslySetInnerHTML={{ __html: normalizeHtml_(block.data.text) }}
              />
            );

          case "image":
            return (
              <figure key={block.id} className="site-block-image-figure">
                <div className="site-block-image-container">
                  <Image
                    src={block.data.url}
                    alt={block.data.alt || "Billede til artikel"}
                    width={800}
                    height={500}
                    className="site-block-img"
                  />
                </div>
                {block.data.caption && (
                  <figcaption className="site-block-image-caption">
                    <span dangerouslySetInnerHTML={{ __html: normalizeHtml_(block.data.caption) }} />
                  </figcaption>
                )}
              </figure>
            );

          case "quote":
            return (
              <blockquote key={block.id} className="site-block-quote">
                <p
                  className="site-block-quote-text"
                  dangerouslySetInnerHTML={{
                    __html: `&ldquo;${normalizeHtml_(block.data.quote)}&rdquo;`,
                  }}
                />
                {(block.data.attribution || block.data.kildeUrl || block.data.dato) && (
                  <footer className="site-block-quote-footer">
                    {block.data.attribution && (
                      <cite className="site-block-quote-author">
                        {block.data.attribution}
                      </cite>
                    )}
                    {safeHref(block.data.kildeUrl) && /^https?:\/\//i.test(block.data.kildeUrl ?? "") && (
                      <span className="site-block-quote-source">
                        {" "}· Kilde:{" "}
                        <a
                          href={safeHref(block.data.kildeUrl) ?? "#"}
                          target="_blank"
                          rel={["noopener", "noreferrer", ...(linkRel ?? [])].join(" ")}
                          className="site-block-quote-link"
                        >
                          {(block.data.kildeUrl ?? "").replace(/^https?:\/\//, "")}
                        </a>
                      </span>
                    )}
                    {block.data.dato && (
                      <span className="site-block-quote-date">
                        {" "}({block.data.dato})
                      </span>
                    )}
                  </footer>
                )}
              </blockquote>
            );

          case "factbox":
            return (
              <aside key={block.id} className="site-block-factbox" role="complementary">
                {block.data.title && (
                  <h3
                    className="site-block-factbox-title"
                    dangerouslySetInnerHTML={{ __html: normalizeHtml_(block.data.title) }}
                  />
                )}
                <div
                  className="site-block-factbox-text"
                  style={{ whiteSpace: "pre-line" }}
                  dangerouslySetInnerHTML={{ __html: normalizeHtml_(block.data.content) }}
                />
              </aside>
            );

          case "infobox":
            return (
              <aside
                key={block.id}
                className="site-block-factbox"
                style={{ borderTopColor: "var(--label-partner-ink)" }}
                role="complementary"
              >
                {block.data.title && (
                  <h3
                    className="site-block-factbox-title"
                    dangerouslySetInnerHTML={{ __html: normalizeHtml_(block.data.title) }}
                  />
                )}
                <div
                  className="site-block-factbox-text"
                  style={{ whiteSpace: "pre-line" }}
                  dangerouslySetInnerHTML={{ __html: normalizeHtml_(block.data.content) }}
                />
              </aside>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
