"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  Calendar,
  FileText,
  FolderTree,
  Handshake,
  Images,
  Inbox,
  LayoutTemplate,
  Mail,
  MapPin,
  Megaphone,
  Mic,
  Radio,
  Rss,
  WalletCards,
} from "lucide-react";

const links = [
  { href: "/redaktion/artikler", label: "Artikler", icon: FileText },
  { href: "/redaktion/indbakke", label: "Indbakke", icon: Inbox },
  { href: "/redaktion/qa", label: "Kilde-Q&A", icon: Inbox },
  { href: "/redaktion/interview", label: "AI Interview", icon: Mic },
  { href: "/redaktion/sponsor", label: "Sponsor & Briefs", icon: Handshake },
  { href: "/redaktion/meddeler", label: "Meddelere", icon: Radio },
  { href: "/redaktion/forside", label: "Forsidestyring", icon: LayoutTemplate },
  { href: "/redaktion/metrikker", label: "Metrikker", icon: BarChart3 },
  { href: "/redaktion/annoncer", label: "Annoncer & Ads", icon: Megaphone },
  { href: "/redaktion/nyhedsbrev", label: "Nyhedsbrev", icon: Mail },
  { href: "/redaktion/sektioner", label: "Sektioner", icon: FolderTree },
  { href: "/redaktion/omraader", label: "Områder", icon: MapPin },
  { href: "/redaktion/signaler", label: "Signaler", icon: Rss },
  { href: "/redaktion/emner", label: "Emner", icon: Radio },
  { href: "/redaktion/medier", label: "Medier", icon: Images },
  { href: "/redaktion/opgaver", label: "Opgaver", icon: BriefcaseBusiness },
  { href: "/redaktion/honorar", label: "Honorar", icon: WalletCards },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="sidebar-nav" aria-label="Primær navigation">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="sidebar-link"
          aria-current={path.startsWith(href) ? "page" : undefined}
        >
          <Icon size={16} /> {label}
        </Link>
      ))}
      <span className="sidebar-link sidebar-link-disabled" aria-disabled="true">
        <Calendar size={16} /> Kalender <span className="sidebar-link-badge">Snart</span>
      </span>
    </nav>
  );
}
