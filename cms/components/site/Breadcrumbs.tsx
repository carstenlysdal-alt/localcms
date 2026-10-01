import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCurrentSite } from "@/lib/site";
import { breadcrumbList } from "@/lib/seo/jsonld";
import { siteBase } from "@/lib/seo/url";
import { JsonLd } from "@/components/site/JsonLd";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export async function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  // BreadcrumbList med absolutte URL'er (Google kræver absolut `item`).
  const site = await getCurrentSite();
  const schemaData = breadcrumbList(items, siteBase(site));

  return (
    <>
      <JsonLd data={schemaData} />
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
