import Image from "next/image";
import type { Block } from "@/lib/blocks/schema";

type SiteBlockRendererProps = {
  blocks: Block[];
};

export function SiteBlockRenderer({ blocks }: SiteBlockRendererProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="site-article-blocks">
      {blocks.map((block) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={block.id} className="site-block-paragraph">
                {block.data.content}
              </p>
            );

          case "heading": {
            const HeadingTag = block.data.level === 3 ? "h3" : "h2";
            return (
              <HeadingTag key={block.id} className="site-block-heading">
                {block.data.text}
              </HeadingTag>
            );
          }

          case "subheading":
            return (
              <h3 key={block.id} className="site-block-heading" style={{ fontSize: "22px" }}>
                {block.data.text}
              </h3>
            );

          case "manchet":
            return (
              <p key={block.id} className="site-article-manchet">
                {block.data.text}
              </p>
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
                    <span>{block.data.caption}</span>
                  </figcaption>
                )}
              </figure>
            );

          case "quote":
            return (
              <blockquote key={block.id} className="site-block-quote">
                <p className="site-block-quote-text">
                  &ldquo;{block.data.quote}&rdquo;
                </p>
                {(block.data.attribution || block.data.kildeUrl || block.data.dato) && (
                  <footer className="site-block-quote-footer">
                    {block.data.attribution && (
                      <cite className="site-block-quote-author">
                        {block.data.attribution}
                      </cite>
                    )}
                    {block.data.kildeUrl && (
                      <span className="site-block-quote-source">
                        {" "}· Kilde:{" "}
                        <a
                          href={block.data.kildeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="site-block-quote-link"
                        >
                          {block.data.kildeUrl.replace(/^https?:\/\//, "")}
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
                  <h3 className="site-block-factbox-title">{block.data.title}</h3>
                )}
                <div className="site-block-factbox-text" style={{ whiteSpace: "pre-line" }}>
                  {block.data.content}
                </div>
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
                  <h3 className="site-block-factbox-title">{block.data.title}</h3>
                )}
                <div className="site-block-factbox-text" style={{ whiteSpace: "pre-line" }}>
                  {block.data.content}
                </div>
              </aside>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
