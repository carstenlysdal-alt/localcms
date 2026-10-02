import { Search } from "lucide-react";
import { cn } from "./cn";

export type SearchFieldProps = {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  /** Tilgængeligt navn (vises ikke visuelt). */
  label: string;
  className?: string;
  autoFocus?: boolean;
};

/** Søgefelt (server-venligt, uden state): brug inde i en <FilterBar> (GET-formular). */
export function SearchField({ name = "q", defaultValue, placeholder = "Søg…", label, className, autoFocus }: SearchFieldProps) {
  return (
    <label className={cn("ui-search", className)}>
      <span className="sr-only">{label}</span>
      <Search size={16} aria-hidden="true" className="ui-search-icon" />
      <input type="search" name={name} defaultValue={defaultValue} placeholder={placeholder} className="ui-search-input" autoComplete="off" autoFocus={autoFocus} />
    </label>
  );
}
