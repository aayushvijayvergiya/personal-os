"use client";
import type { Recurrence } from "@/lib/recurrence";
import { weekdayIndex, withAnchor } from "@/lib/recurrence";
import { todayISO } from "@/lib/dates";
import { Select } from "@/components/win";
import WeekdayPicker from "@/components/WeekdayPicker";

const FREQ_OPTS = [
  { value: "daily", label: "day(s)" }, { value: "weekly", label: "week(s)" }, { value: "monthly", label: "month(s)" },
];

export default function RecurrenceEditor({ value, anchorIso, onChange }: {
  value: Recurrence; anchorIso: string | null; onChange: (r: Recurrence) => void;
}) {
  function changeFreq(freq: Recurrence["freq"]) {
    const interval = value.interval;
    if (freq === "daily") return onChange({ freq, interval });
    if (freq === "weekly") return onChange({ freq, interval, days: [weekdayIndex(anchorIso ?? todayISO())] });
    onChange(withAnchor({ freq, interval, day: 1 }, anchorIso ?? todayISO()));
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span>Every</span>
        <input type="number" min={1} className="win-input" style={{ width: 64 }}
          value={Number.isNaN(value.interval) ? "" : value.interval}
          onChange={(e) => onChange({ ...value, interval: e.target.value === "" ? NaN : Number(e.target.value) })} />
        <Select className="w-28" value={value.freq} options={FREQ_OPTS}
          onChange={(e) => changeFreq(e.target.value as Recurrence["freq"])} />
        {value.freq === "monthly" && <span className="text-xs text-[#444]">on day {value.day} (from the due date)</span>}
      </div>
      {value.freq === "weekly" && (
        <WeekdayPicker value={value.days} onChange={(days) => onChange({ ...value, days })} />
      )}
    </div>
  );
}
