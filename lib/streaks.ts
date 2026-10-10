import { addDays } from "./dates";
import { ALL_DAYS, isScheduled } from "./recurrence";

export interface StreakStats { current: number; best: number; completionPct: number; }

/** Nearest scheduled date strictly before (dir -1) or after (dir 1) `iso`. `days` must be non-empty. */
function stepScheduled(days: number[], iso: string, dir: 1 | -1): string {
  let c = addDays(iso, dir);
  while (!isScheduled(days, c)) c = addDays(c, dir);
  return c;
}

/**
 * Streaks over a habit's scheduled weekdays only. Check-ins on unscheduled days are ignored
 * (they neither extend nor break a streak). A scheduled "today" that is still unchecked does
 * not break the current streak.
 */
export function computeStreaks(
  checkedDates: string[], todayIso: string, days: number[] = ALL_DAYS,
): StreakStats {
  const zero: StreakStats = { current: 0, best: 0, completionPct: 0 };
  if (days.length === 0) return zero;
  const set = new Set(checkedDates.filter((d) => isScheduled(days, d)));
  if (set.size === 0) return zero;

  let current = 0;
  let cursor = set.has(todayIso) ? todayIso : stepScheduled(days, todayIso, -1);
  while (set.has(cursor)) { current++; cursor = stepScheduled(days, cursor, -1); }

  let best = 0;
  for (const d of set) {
    if (set.has(stepScheduled(days, d, -1))) continue; // not a run start
    let len = 0, c = d;
    while (set.has(c)) { len++; c = stepScheduled(days, c, 1); }
    best = Math.max(best, len);
  }

  let scheduled30 = 0, checked30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDays(todayIso, -i);
    if (!isScheduled(days, d)) continue;
    scheduled30++;
    if (set.has(d)) checked30++;
  }
  return { current, best, completionPct: scheduled30 === 0 ? 0 : Math.round((checked30 / scheduled30) * 100) };
}
