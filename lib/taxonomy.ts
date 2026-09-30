export const RESERVED_SLUGS = [
  "omraade",
  "emne",
  "forfatter",
  "soeg",
  "om-mediet",
  "indsend",
  "nyhedsbrev",
  "kalender",
  "guide",
  "virksomhed",
  "forening",
  "bliv-stoette",
  "partner",
  "qa",
  "interview",
  "sponsor",
  "meddeler",
  "redaktion",
  "login",
  "api",
] as const;

export function isReservedSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  return (RESERVED_SLUGS as readonly string[]).includes(normalized);
}

export function validateCategoryNesting(parent: { parentId: string | null } | null): { valid: boolean; error?: string } {
  if (parent && parent.parentId !== null) {
    return { valid: false, error: "Maksimalt to niveauer er tilladt. En undersektion kan ikke have egne undersektioner." };
  }
  return { valid: true };
}
