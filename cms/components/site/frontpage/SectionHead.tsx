import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHead({ title, href, linkText, id }: { title: string; href?: string; linkText?: string; id?: string }) {
  return (
    <header className="fp-head">
      <h2 className="fp-head-title" id={id}>
        {title}
      </h2>
      {href && (
        <Link href={href} className="fp-head-link">
          {linkText ?? "Se alle"} <ArrowRight size={15} aria-hidden="true" />
        </Link>
      )}
    </header>
  );
}
