"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { NAV_ICONS } from "./nav-icons";
import { activeHref, type NavGroup } from "./nav-model";
import { CityDot } from "@/components/ui/CityDot";

export type NavCity = { by: string; href: string; current: boolean };

/**
 * Sidebarens navigation: grupperede links (allerede filtreret efter rettigheder på serveren), by-liste med prikker.
 * Aktivt punkt: indigo pille + `aria-current="page"`. Tæller-badges vises hvor data findes (fx Indbakke).
 */
export function NavLinks({ groups, cities = [] }: { groups: NavGroup[]; cities?: NavCity[] }) {
  const path = usePathname();
  const active = activeHref(groups.flatMap((g) => g.items), path);
  return (
    <nav className="shell-nav" aria-label="Primær navigation">
      {groups.map((group) => (
        <div key={group.id} className="shell-nav-group" role="group" aria-labelledby={`nav-g-${group.id}`}>
          <p className="shell-nav-label" id={`nav-g-${group.id}`}>{group.label}</p>
          <ul className="shell-nav-list">
            {group.items.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link href={item.href} className="shell-link" aria-current={active === item.href ? "page" : undefined}>
                    <Icon size={18} aria-hidden="true" />
                    <span className="shell-link-text">{item.label}</span>
                    {item.badge ? <span className="shell-link-badge" aria-label={`${item.badge} nye`}>{item.badge > 99 ? "99+" : item.badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {cities.length > 0 ? (
        <div className="shell-nav-group" role="group" aria-labelledby="nav-g-cities">
          <p className="shell-nav-label" id="nav-g-cities">Byer</p>
          <ul className="shell-nav-list">
            {cities.map((city) => (
              <li key={city.by}>
                {city.current ? (
                  <span className="shell-link shell-link-city is-current" aria-current="true">
                    <CityDot city={city.by} />
                    <span className="shell-link-text">{city.by}</span>
                    <span className="shell-link-note">Du er her</span>
                  </span>
                ) : (
                  <a className="shell-link shell-link-city" href={city.href} rel="noopener">
                    <CityDot city={city.by} />
                    <span className="shell-link-text">{city.by}</span>
                    <ExternalLink size={14} aria-hidden="true" className="shell-link-ext" />
                    <span className="sr-only">(åbner byens redaktion)</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
