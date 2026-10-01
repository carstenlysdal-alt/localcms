import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  // Byg schema.org BreadcrumbList JSON-LD
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: item.href } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      <nav className="site-breadcrumbs" aria-label="Brødkrumme">
        <ol className="site-breadcrumbs-list">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={index} className="site-breadcrumbs-item">
                {index > 0 && <ChevronRight size={14} className="site-breadcrumbs-sep" aria-hidden="true" />}
                {isLast || !item.href ? (
                  <span className="site-breadcrumbs-current" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className="site-breadcrumbs-link">
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
