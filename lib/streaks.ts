import { addDays } from "./dates";

export interface StreakStats { current: number; best: number; completionPct: number; }

export function computeStreaks(checkedDates: string[], todayIso: string): StreakStats {
  const set = new Set(checkedDates);
  if (set.size === 0) return { current: 0, best: 0, completionPct: 0 };

  // current: count back from today, allowing today itself to be unchecked yet
  let current = 0;
  let cursor = set.has(todayIso) ? todayIso : addDays(todayIso, -1);
  while (set.has(cursor)) { current++; cursor = addDays(cursor, -1); }

  // best: walk all runs
  let best = 0;
  for (const d of set) {
    if (set.has(addDays(d, -1))) continue; // not a run start
    let len = 0, c = d;
    while (set.has(c)) { len++; c = addDays(c, 1); }
    best = Math.max(best, len);
  }

  let checked30 = 0;
  for (let i = 0; i < 30; i++) if (set.has(addDays(todayIso, -i))) checked30++;
  return { current, best, completionPct: Math.round((checked30 / 30) * 100) };
}
