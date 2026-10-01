"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2, Mail, Share2 } from "lucide-react";

type ShareButtonProps = {
  /** Kanonisk, absolut artikel-URL. */
  url: string;
  title: string;
};

function withUtm(url: string, source: string): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", source);
  u.searchParams.set("utm_medium", "share");
  return u.toString();
}

/**
 * Del-knap: native deling på mobil, ellers menu med Facebook, X, LinkedIn, WhatsApp, mail og kopiér link.
 * Delings-URL'en er canonical + utm (canonical sørger for at utm ikke skaber dubletter).
 */
export function ShareButton({ url, title }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onToggle() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url: withUtm(url, "native") });
        return;
      } catch {
        // Brugeren afbrød – åbn ikke menuen
        return;
      }
    }
    setOpen((v) => !v);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Kopiér link", url);
    }
  }

  const enc = encodeURIComponent;
  const links: Array<{ label: string; href: string }> = [
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(withUtm(url, "facebook"))}` },
    { label: "X", href: `https://x.com/intent/post?url=${enc(withUtm(url, "x"))}&text=${enc(title)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(withUtm(url, "linkedin"))}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${title} ${withUtm(url, "whatsapp")}`)}` },
  ];

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    fontSize: "14px",
    color: "var(--ink)",
    textDecoration: "none",
    background: "none",
    border: "none",
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label="Del artikel"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        style={{ background: "none", border: "none", color: "var(--ink-2)", cursor: "pointer", padding: "6px", minWidth: "44px", minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "6px" }}
      >
        <Share2 size={18} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            zIndex: 20,
            minWidth: "190px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            padding: "6px 0",
          }}
        >
          {links.map((l) => (
            <a key={l.label} role="menuitem" href={l.href} target="_blank" rel="noopener noreferrer" style={itemStyle}>
              {l.label}
            </a>
          ))}
          <a role="menuitem" href={`mailto:?subject=${enc(title)}&body=${enc(withUtm(url, "mail"))}`} style={itemStyle}>
            <Mail size={15} aria-hidden="true" /> E-mail
          </a>
          <button type="button" role="menuitem" onClick={copy} style={itemStyle}>
            {copied ? <Check size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
            {copied ? "Link kopieret" : "Kopiér link"}
          </button>
        </div>
      )}
    </div>
  );
}
