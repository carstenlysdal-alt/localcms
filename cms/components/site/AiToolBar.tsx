"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Mic, Handshake, Radio, CalendarPlus } from "lucide-react";

export function AiToolBar() {
  const pathname = usePathname();

  const tools = [
    {
      href: "/qa",
      label: "Q&A",
      icon: Inbox,
      active: pathname.startsWith("/qa"),
      title: "Kilde-Q&A: Besvar redaktionens spørgsmål eller send kildeudtalelse",
    },
    {
      href: "/interview",
      label: "Interview",
      icon: Mic,
      active: pathname.startsWith("/interview"),
      title: "AI Kildeinterview: Gennemfør et guidet kildeinterview når det passer dig",
    },
    {
      href: "/sponsor",
      label: "Sponsor",
      icon: Handshake,
      active: pathname.startsWith("/sponsor") || pathname.startsWith("/partner"),
      title: "Sponsor & Partnerindhold: Gennemsigtigt lokalt partnerskab",
    },
    {
      href: "/bliv-en-del-af-journalistikken",
      label: "Bliv en del af journalistikken",
      icon: Radio,
      active: pathname.startsWith("/meddeler") || pathname.startsWith("/bliv-en-del-af-journalistikken"),
      title: "Bliv en del af journalistikken: Tip redaktionen, rapportér fra din klub eller bliv meddeler",
    },
  ];

  return (
    <aside className="ai-toolbar-strip" aria-label="Redaktionelle værktøjer og indgange">
      <div className="site-container ai-toolbar-inner">
        <div className="ai-toolbar-tools">
          {tools.map(({ href, label, icon: Icon, active, title }) => (
            <Link
              key={href}
              href={href}
              className={`ai-toolbar-item ${active ? "is-active" : ""}`}
              title={title}
            >
              <Icon size={17} strokeWidth={1.9} className="ai-toolbar-icon" />
              <span className="ai-toolbar-label">{label}</span>
            </Link>
          ))}
          <Link
            href="/indsend"
            className="ai-toolbar-pill-btn"
            title="Indsend arrangement, tip eller debatindlæg"
          >
            <CalendarPlus size={17} strokeWidth={2} />
            <span>Indsend</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
