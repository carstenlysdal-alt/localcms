"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

type LoadMoreProps = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
};

/**
 * Paginering som rigtige <a>-links (crawlbare) med rel=prev/next.
 * Side N er selv-canonical (se buildPageMetadata); filter-params bevares.
 */
export function LoadMore({ currentPage, totalPages, totalCount }: LoadMoreProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(page: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("side");
    else params.set("side", String(page));
    const qs = params.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }

  if (currentPage >= totalPages) {
    return (
      <div className="site-load-more-end">
        <span>Alle {totalCount} artikler er vist</span>
        {currentPage > 1 && (
          <>
            {" · "}
            <Link href={hrefFor(currentPage - 1)} rel="prev" scroll={false}>
              Forrige side
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <nav className="site-load-more-container" aria-label="Sidenummerering">
      {currentPage > 1 && (
        <Link href={hrefFor(currentPage - 1)} rel="prev" scroll={false} className="site-btn site-btn-outline">
          <span>Forrige side</span>
        </Link>
      )}
      <Link
        href={hrefFor(currentPage + 1)}
        rel="next"
        scroll={false}
        className="site-btn site-btn-outline site-btn-load-more"
      >
        <span>Vis flere artikler</span>
        <ChevronDown size={16} />
      </Link>
    </nav>
  );
}
