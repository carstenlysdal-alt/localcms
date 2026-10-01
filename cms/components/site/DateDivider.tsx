import { Calendar } from "lucide-react";

type DateDividerProps = {
  label: string;
};

export function DateDivider({ label }: DateDividerProps) {
  return (
    <div className="site-date-divider" role="separator" aria-label={label}>
      <div className="site-date-divider-line" />
      <div className="site-date-divider-pill">
        <Calendar size={13} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="site-date-divider-line" />
    </div>
  );
}
