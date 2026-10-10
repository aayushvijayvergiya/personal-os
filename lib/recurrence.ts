import { addDays, fromISO, toISO } from "./dates";

export type Recurrence =
  | { freq: "daily"; interval: number }
  | { freq: "weekly"; interval: number; days: number[] } // 0=Mon..6=Sun
  | { freq: "monthly"; interval: number; day: number };  // 1..31, clamped to month end

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weekdayIndex(iso: string): number {
  return (fromISO(iso).getDay() + 6) % 7;
}
export function isScheduled(days: number[], iso: string): boolean {
  return days.includes(weekdayIndex(iso));
}

export function validateRule(r: Recurrence): boolean {
  if (!Number.isInteger(r.interval) || r.interval < 1) return false;
  if (r.freq === "weekly") {
    return r.days.length > 0 && new Set(r.days).size === r.days.length
      && r.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  }
  if (r.freq === "monthly") return Number.isInteger(r.day) && r.day >= 1 && r.day <= 31;
  return true;
}

/** User-facing reason a task's repeat settings can't be saved, or null if fine. */
export function recurrenceError(r: Recurrence | null, dueIso: string | null): string | null {
  if (!r) return null;
  if (!dueIso) return "Repeating tasks need a due date";
  if (!Number.isInteger(r.interval) || r.interval < 1) return "Repeat interval must be 1 or more";
  if (r.freq === "weekly" && r.days.length === 0) return "Pick at least one weekday";
  return validateRule(r) ? null : "Invalid repeat settings";
}

/** Monthly rules store the day-of-month from the due date; other rules are unaffected. */
export function withAnchor(r: Recurrence, dueIso: string | null): Recurrence {
  if (r.freq !== "monthly" || !dueIso) return r;
  return { ...r, day: fromISO(dueIso).getDate() };
}

function monthDate(year: number, month: number, day: number): string {
  const last = new Date(year, month + 1, 0).getDate(); // month may overflow; Date normalises it
  return toISO(new Date(year, month, Math.min(day, last)));
}

/** First scheduled date strictly after `afterIso`. */
export function nextOccurrence(r: Recurrence, afterIso: string): string {
  if (r.freq === "daily") return addDays(afterIso, r.interval);
  if (r.freq === "weekly") {
    const dow = weekdayIndex(afterIso);
    const days = [...r.days].sort((a, b) => a - b);
    const later = days.find((d) => d > dow);
    if (later !== undefined) return addDays(afterIso, later - dow);
    return addDays(addDays(afterIso, -dow), r.interval * 7 + days[0]);
  }
  const d = fromISO(afterIso);
  return monthDate(d.getFullYear(), d.getMonth() + r.interval, r.day);
}

const names = (days: number[]) => [...days].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(", ");

export function describeRule(r: Recurrence): string {
  const n = r.interval;
  if (r.freq === "daily") return n === 1 ? "Every day" : `Every ${n} days`;
  if (r.freq === "weekly") return `Every ${n === 1 ? "week" : `${n} weeks`} on ${names(r.days)}`;
  return `Every ${n === 1 ? "month" : `${n} months`} on day ${r.day}`;
}

export function describeDays(days: number[]): string {
  const key = [...days].sort((a, b) => a - b).join(",");
  if (key === ALL_DAYS.join(",")) return "Every day";
  if (key === "0,1,2,3,4") return "Weekdays";
  if (key === "5,6") return "Weekends";
  return names(days);
}

/**
 * A habit row with a usable `schedule_days`. Rows read from a database that hasn't run migration
 * 005 yet have no such column; treat them (and empty sets) as every day instead of crashing.
 */
export function withSchedule<T>(h: T & { schedule_days?: number[] | null }): Omit<T, "schedule_days"> & { schedule_days: number[] } {
  return h.schedule_days && h.schedule_days.length > 0
    ? (h as Omit<T, "schedule_days"> & { schedule_days: number[] })
    : { ...h, schedule_days: ALL_DAYS };
}
