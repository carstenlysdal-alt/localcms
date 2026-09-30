"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function TopicFilterBar() {
  const searchParams = useSearchParams();
  const activeEmne = searchParams.get("emne") || "alle";

  const topics = [
    { key: "alle", label: "Alle", href: "/" },
    { key: "politik", label: "Politik", href: "/nyheder?emne=politik" },
    { key: "krimi", label: "Krimi & Beredskab", href: "/nyheder?emne=krimi" },
    { key: "trafik", label: "Trafik", href: "/nyheder?emne=trafik" },
    { key: "skole", label: "Skole og børn", href: "/nyheder?emne=skole" },
    { key: "sport", label: "Sport", href: "/sport" },
    { key: "erhverv", label: "Erhverv", href: "/erhverv" },
    { key: "kultur", label: "Kultur", href: "/kultur" },
    { key: "kalender", label: "Det sker", href: "/kalender" },
    { key: "opslagstavle", label: "Opslagstavle", href: "/opslagstavle" },
  ];

  return (
    <div className="topic-filter-bar-wrapper">
      <div className="topic-filter-bar">
        {topics.map((t) => {
          const isActive = activeEmne === t.key;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`topic-filter-pill ${isActive ? "is-active" : ""}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
