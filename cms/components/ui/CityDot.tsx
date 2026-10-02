import { cn } from "./cn";

/** "Næstved" → "naestved". Farven slås op i CSS (`--cms-city-<slug>` i modernist.css), ikke i komponenten. */
export function citySlug(city: string): string {
  return city
    .toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Byens prik. Navnet vises som tekst ved siden af (farven er aldrig eneste bærer), så prikken er `aria-hidden`. */
export function CityDot({ city, className }: { city: string; className?: string }) {
  return <span className={cn("ui-citydot", className)} data-city={citySlug(city)} aria-hidden="true" />;
}

/** Prik + bynavn i ét. */
export function CityLabel({ city, className }: { city: string; className?: string }) {
  return (
    <span className={cn("ui-citylabel", className)}>
      <CityDot city={city} />
      {city}
    </span>
  );
}
