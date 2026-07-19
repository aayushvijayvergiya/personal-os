"use client";
import { fromISO, monthGridDates, todayISO, weekDates } from "@/lib/dates";

export interface CalItem { id: string; date: string; label: string; color?: string; done?: boolean; }

export default function CalendarGrid({ mode, anchor, items, banners = [], onDayClick }: {
  mode: "month" | "week"; anchor: string; items: CalItem[];
  banners?: { label: string; color?: string }[]; onDayClick?: (date: string) => void;
}) {
  const today = todayISO();
  const dates = mode === "month" ? monthGridDates(anchor) : weekDates(anchor);
  const anchorMonth = anchor.slice(0, 7);
  const byDate = new Map<string, CalItem[]>();
  for (const it of items) {
    if (!byDate.has(it.date)) byDate.set(it.date, []);
    byDate.get(it.date)!.push(it);
  }
  return (
    <div>
      {banners.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {banners.map((b, i) => (
            <span key={i} className="bevel-out px-2 py-0.5 text-xs"
              style={b.color ? { borderLeft: `6px solid ${b.color}` } : undefined}>🎯 {b.label}</span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-7 gap-px bevel-in bg-[#808080] p-px">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
          <div key={d} className="bg-[#c0c0c0] px-1 py-0.5 text-center text-xs font-bold">{d}</div>
        ))}
        {dates.map((d) => {
          const dim = mode === "month" && d.slice(0, 7) !== anchorMonth;
          const isToday = d === today;
          return (
            <div key={d} onClick={() => onDayClick?.(d)}
              className={`min-h-20 cursor-pointer bg-white p-1 align-top hover:bg-[#eef] ${dim ? "opacity-50" : ""}`}>
              <div className={`mb-0.5 text-right text-xs ${isToday ? "inline-block float-right rounded-full bg-[#aa0000] px-1.5 text-white font-bold" : "text-[#444]"}`}>
                {fromISO(d).getDate()}
              </div>
              <div className="clear-both flex flex-col gap-0.5">
                {(byDate.get(d) ?? []).slice(0, 4).map((it) => (
                  <div key={it.id} title={it.label}
                    className={`truncate px-1 text-xs text-white ${it.done ? "line-through opacity-60" : ""}`}
                    style={{ background: it.color ?? "#000080" }}>{it.label}</div>
                ))}
                {(byDate.get(d)?.length ?? 0) > 4 && <div className="text-xs text-[#666]">+{byDate.get(d)!.length - 4} more…</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
