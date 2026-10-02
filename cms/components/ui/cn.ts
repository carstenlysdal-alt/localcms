/** Samler klassenavne; falsy-værdier udelades. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
