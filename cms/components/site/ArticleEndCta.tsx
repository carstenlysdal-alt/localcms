import Link from "next/link";
import { Heart, Send } from "lucide-react";

type ArticleEndCtaProps = {
  siteNavn: string;
  kommune: string;
};

/**
 * Artiklens logiske næste klik: Støt (primær) + Indsend tip (sekundær).
 * Ét roligt modul i stedet for flere nyhedsbreve (DESIGN.md §6 punkt 9-12).
 */
export function ArticleEndCta({ siteNavn, kommune }: ArticleEndCtaProps) {
  return (
    <section className="site-support-cta" aria-labelledby="support-cta-title">
      <h2 id="support-cta-title" className="site-support-cta-title">
        Støt lokaljournalistikken i {kommune}
      </h2>
      <p className="site-support-cta-text">
        {siteNavn} er uafhængigt og uden bannerreklamer. Din støtte betaler for journalistik, der ellers ikke
        bliver skrevet. Ved du noget, vi bør kende til, kan du sende os et tip.
      </p>
      <div className="site-support-cta-actions">
        <Link href="/bliv-stoette" className="site-btn-support">
          <Heart size={16} fill="currentColor" aria-hidden="true" />
          Støt {siteNavn}
        </Link>
        <Link href="/indsend?kategori=tip" className="site-btn-submit">
          <Send size={16} aria-hidden="true" />
          Send et tip
        </Link>
      </div>
    </section>
  );
}
