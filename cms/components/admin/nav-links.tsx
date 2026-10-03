"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ICONS } from "./nav-icons";
import { activeHref, type NavGroup } from "./nav-model";
import { CityRow, useSwitchCity, type NavCity } from "./city-switcher";

export type { NavCity } from "./city-switcher";

/**
 * Sidebarens navigation: grupperede links (allerede filtreret efter rettigheder på serveren) og byer med prikker.
 * Aktivt punkt: indigo pille + `aria-current="page"`. Tæller-badges vises hvor data findes (fx Indbakke).
 * By-listen er byskifteren: byer brugeren har adgang til kan vælges (den aktive er markeret `aria-current`), øvrige er låst;
 * "Se siden" åbner byens offentlige side (på preview-værten `/?by=<nøgle>`).
 */
export function NavLinks({ groups, cities = [] }: { groups: NavGroup[]; cities?: NavCity[] }) {
  const path = usePathname();
  const active = activeHref(groups.flatMap((g) => g.items), path);
  const { switchTo, pending, message } = useSwitchCity();
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
                <CityRow city={city} onSwitch={switchTo} pending={pending} />
              </li>
            ))}
          </ul>
          <p className="shell-nav-status" role="status" aria-live="polite">{pending ? "Skifter by…" : message}</p>
        </div>
      ) : null}
    </nav>
  );
}
