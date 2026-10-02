import { cn } from "./cn";

export type AvatarProps = {
  name: string | null | undefined;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";
}

/** Stabil farvetone ud fra navnet (6 toner fra diagram-paletten), så samme person altid har samme farve. */
export function avatarTone(name: string | null | undefined): number {
  let h = 0;
  for (const ch of name ?? "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 6;
}

/** Initialer (eller billede). Dekorativ: navnet skal stå som tekst ved siden af, ellers får den `role="img"` med label. */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const label = name ?? "Ukendt";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cn("ui-avatar", `ui-avatar-${size}`, className)} src={src} alt={label} />;
  }
  return (
    <span role="img" aria-label={label} className={cn("ui-avatar", `ui-avatar-${size}`, `ui-avatar-tone-${avatarTone(name)}`, className)}>
      <span aria-hidden="true">{initialsOf(name)}</span>
    </span>
  );
}
