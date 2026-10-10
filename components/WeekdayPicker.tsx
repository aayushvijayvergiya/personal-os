"use client";
import { ALL_DAYS, WEEKDAY_LABELS } from "@/lib/recurrence";
import { Btn } from "@/components/win";

export default function WeekdayPicker({ value, onChange, presets = false }: {
  value: number[]; onChange: (days: number[]) => void; presets?: boolean;
}) {
  const toggle = (d: number) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));
  return (
    <div className="flex flex-wrap items-center gap-1">
      {WEEKDAY_LABELS.map((label, d) => (
        <button key={d} type="button" aria-pressed={value.includes(d)}
          className={`journal-chip ${value.includes(d) ? "journal-chip-on" : ""}`}
          onClick={() => toggle(d)}>{label}</button>
      ))}
      {presets && (
        <span className="ml-2 flex gap-1">
          <Btn type="button" className="px-2 py-0 text-xs" onClick={() => onChange(ALL_DAYS)}>Daily</Btn>
          <Btn type="button" className="px-2 py-0 text-xs" onClick={() => onChange([0, 1, 2, 3, 4])}>Weekdays</Btn>
          <Btn type="button" className="px-2 py-0 text-xs" onClick={() => onChange([5, 6])}>Weekends</Btn>
        </span>
      )}
    </div>
  );
}
