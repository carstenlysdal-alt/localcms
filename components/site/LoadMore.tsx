"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

type LoadMoreProps = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
};

export function LoadMore({ currentPage, totalPages, totalCount }: LoadMoreProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (currentPage >= totalPages) {
    return (
      <div className="site-load-more-end">
        <span>Alle {totalCount} artikler er vist</span>
      </div>
    );
  }

  function handleNextPage() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("side", (currentPage + 1).toString());
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="site-load-more-container">
      <button
        type="button"
        className="site-btn site-btn-outline site-btn-load-more"
        onClick={handleNextPage}
      >
        <span>Vis flere artikler</span>
        <ChevronDown size={16} />
      </button>
    </div>
  );
}
