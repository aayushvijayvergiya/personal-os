import { addDays, fromISO, monthRange, weekRange } from "./dates";

export type TaskTab = "today" | "week" | "month" | "all" | "done";

/** What a Tasks tab means as a database filter. Pure, so it can be tested without Supabase. */
export interface TaskQueryFilter {
  /** Keep rows whose `due_date` is on or before this ISO date. Undefined means "no date bound". */
  dueLte?: string;
  /** Keep only completed rows. */
  onlyDone: boolean;
  /** Drop completed rows. */
  excludeDone: boolean;
  /**
   * When set, completed rows are kept only if `completed_at` falls in [from, to) — UTC ISO
   * timestamps of local-midnight boundaries. Open rows are still bounded by `dueLte`.
   */
  completedBetween?: { from: string; to: string };
}

export const TASK_TABS: { key: TaskTab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All" },
  { key: "done", label: "Done" },
];

/** [start, end] ISO dates → half-open UTC timestamp window covering those local days. */
function completedWindow(start: string, end: string) {
  return { from: fromISO(start).toISOString(), to: fromISO(addDays(end, 1)).toISOString() };
}

/**
 * The Done tab shows completed rows only. Every other tab bounds open rows' due date by today,
 * the end of the ISO week, or the end of the month; "Show completed" adds the rows that were
 * completed inside that same window (all of them on the All tab).
 */
export function taskFilterFor(tab: TaskTab, showDone: boolean, todayIso: string): TaskQueryFilter {
  if (tab === "done") return { onlyDone: true, excludeDone: false };

  const excludeDone = !showDone;
  if (tab === "all") return { onlyDone: false, excludeDone };

  const range =
    tab === "today" ? { start: todayIso, end: todayIso }
    : tab === "week" ? weekRange(todayIso)
    : monthRange(todayIso);
  const base: TaskQueryFilter = { dueLte: range.end, onlyDone: false, excludeDone };
  return showDone ? { ...base, completedBetween: completedWindow(range.start, range.end) } : base;
}

/**
 * PostgREST `or=` clause for a windowed filter: open rows due by the bound OR done rows
 * completed inside the window. Null when the filter needs no OR (plain eq/neq/lte suffice).
 */
export function taskOrClause(f: TaskQueryFilter): string | null {
  if (!f.completedBetween || !f.dueLte) return null;
  const { from, to } = f.completedBetween;
  return `and(status.neq.done,due_date.lte.${f.dueLte}),and(status.eq.done,completed_at.gte.${from},completed_at.lt.${to})`;
}
