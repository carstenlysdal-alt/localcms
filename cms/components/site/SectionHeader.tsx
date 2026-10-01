"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Plus, Check } from "lucide-react";

type SubcategoryItem = {
  id: string;
  navn: string;
  slug: string;
};

type AreaItem = {
  id: string;
  navn: string;
  slug: string | null;
};

type SectionHeaderProps = {
  sektionNavn: string;
  sektionSlug: string;
  beskrivelse?: string | null;
  undersektioner?: SubcategoryItem[];
  aktivUndersektionSlug?: string | null;
  omraader?: AreaItem[];
  valgtOmraadeSlug?: string | null;
};

export function SectionHeader({
  sektionNavn,
  sektionSlug,
  beskrivelse,
  undersektioner = [],
  aktivUndersektionSlug = null,
  omraader = [],
  valgtOmraadeSlug = null,
}: SectionHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [following, setFollowing] = useState(false);

  function handleAreaChange(newAreaSlug: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (newAreaSlug) {
      params.set("omraade", newAreaSlug);
    } else {
      params.delete("omraade");
    }
    params.delete("side"); // Nulstil pagination ved nyt filter

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const basePath = aktivUndersektionSlug
      ? `/${sektionSlug}/${aktivUndersektionSlug}`
      : `/${sektionSlug}`;

    router.replace(`${basePath}${queryString}`, { scroll: false });
  }

  return (
    <div className="site-section-header">
      <div className="site-section-header-top" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <h1 className="site-section-title" style={{ margin: 0 }}>{sektionNavn}</h1>
            <button
              type="button"
              className="site-follow-topic-btn"
              onClick={() => setFollowing(!following)}
              aria-label={following ? `Følger ${sektionNavn}` : `Følg ${sektionNavn}`}
            >
              {following ? <Check size={14} /> : <Plus size={14} />}
              <span>{following ? "Følger emne" : "Følg emne"}</span>
            </button>
          </div>
          {beskrivelse && <p className="site-section-desc" style={{ marginTop: "6px" }}>{beskrivelse}</p>}
        </div>

        {/* Områdefilter */}
        {omraader.length > 0 && (
          <div className="site-section-area-filter">
            <label htmlFor="area-filter-select" className="site-area-filter-label">
              <MapPin size={15} />
              <span>Område:</span>
            </label>
            <select
              id="area-filter-select"
              className="site-area-filter-select"
              value={valgtOmraadeSlug || ""}
              onChange={(e) => handleAreaChange(e.target.value)}
            >
              <option value="">Hele kommunen</option>
              {omraader.map((area) => (
                <option key={area.id} value={area.slug || area.id}>
                  {area.navn}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Undersektionsbar med piller jf. Mock Screen 4 */}
      {undersektioner.length > 0 && (
        <div className="site-subnav-pills-wrapper">
          <ul className="site-subnav-pills">
            <li>
              <Link
                href={`/${sektionSlug}${valgtOmraadeSlug ? `?omraade=${valgtOmraadeSlug}` : ""}`}
                className={`site-pill ${!aktivUndersektionSlug ? "is-active" : ""}`}
                aria-current={!aktivUndersektionSlug ? "page" : undefined}
              >
                Seneste
              </Link>
            </li>
            {undersektioner.map((sub) => {
              const isActive = aktivUndersektionSlug === sub.slug;
              return (
                <li key={sub.id}>
                  <Link
                    href={`/${sektionSlug}/${sub.slug}${
                      valgtOmraadeSlug ? `?omraade=${valgtOmraadeSlug}` : ""
                    }`}
                    className={`site-pill ${isActive ? "is-active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {sub.navn}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
