# Recurring Tasks & Habit Schedules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tasks can repeat on a configurable period; habits can be scheduled on chosen weekdays (including existing habits) with streaks computed over scheduled days only.

**Architecture:** A pure `lib/recurrence.ts` owns the rule type and all date math. `computeStreaks` gains an optional `days` argument. A thin `lib/taskRecurrence.ts` turns a completed repeating task into the next row and does the guarded Supabase write. Two small shared components (`WeekdayPicker`, `RecurrenceEditor`) are used by the Tasks and Habits pages. One migration adds `tasks.recurrence` and `habits.schedule_days`.

**Tech Stack:** Next.js 16 (client components), Supabase, Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-10-recurring-tasks-habit-schedules-design.md`

## Global Constraints

- `AGENTS.md`: this Next.js version differs from training data — before editing any page, skim the relevant guide in `node_modules/next/dist/docs/01-app` (client components). All pages here are `"use client"`; follow their existing patterns.
- Weekday indexes are **0=Mon … 6=Sun** everywhere (matches `weekStart` in `lib/dates.ts`).
- All dates are ISO `YYYY-MM-DD` strings handled with `lib/dates.ts` helpers (local time, never `toISOString().slice(0,10)`).
- Rule shape (verbatim from spec): daily `{freq, interval}`, weekly `{freq, interval, days}`, monthly `{freq, interval, day}`. `interval` integer >= 1; weekly `days` non-empty unique 0..6; monthly `day` 1..31.
- Existing habits must remain daily after the migration (`schedule_days` default `{0,1,2,3,4,5,6}`); `habit_entries` is never modified.
- Habit schedule edits are retroactive; no history table.
- Spawn the next task only on the transition to `done`; reopening never removes the spawned copy.
- Out of scope: end dates, repeat-after-completion, times, habits every N days, calendar changes, repeat UI on Projects tasks.
- **Working tree caveat:** `app/(app)/vision/page.tsx` and `lib/types.ts` (the `VisionItem` hunk) contain someone's unrelated, uncommitted Vision-board edits. Never stage `vision/page.tsx`. For `lib/types.ts` stage only your hunks with `git add -p lib/types.ts`.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

## Review Focus

- Completing the same repeating task twice quickly (double-click, or from Dashboard and Tasks at once) must create exactly one next copy → guarded `update … .neq("status","done").select()` in Task 4 (manual check in Task 8).
- Monthly rule on the 31st must not drift (Jan 31 → Feb 28 → Mar 31; leap-year Feb 29) → tests in Task 2.
- A repeating task completed very late (overdue by weeks) must spawn a *future* due date, not another overdue one → test in Task 4.
- A repeating task with no due date, or a habit schedule that is empty, must not crash or divide by zero → tests in Tasks 2–4.
- A weekend-only habit viewed on a weekday (today unscheduled, nothing checked today) must keep its streak, and bonus check-ins on unscheduled days must not affect streaks → tests in Task 3.

---

## Task 1: Migration and types

**Files:**
- Create: `supabase/migrations/005_recurrence.sql`
- Modify: `lib/types.ts` (`Task`, `Habit`, add import)

**Interfaces:**
- Produces: `Task.recurrence: Recurrence | null`, `Habit.schedule_days: number[]`.

- [ ] **Step 1: Write the migration**

```sql
-- Repeating tasks: null = one-time. Habit schedules: weekdays 0=Mon..6=Sun the habit applies to.
-- Existing habits default to every day, so nothing changes for them until edited.

alter table public.tasks
  add column if not exists recurrence jsonb
  check (recurrence is null or recurrence->>'freq' in ('daily','weekly','monthly'));

alter table public.habits
  add column if not exists schedule_days smallint[] not null default '{0,1,2,3,4,5,6}'
  check (cardinality(schedule_days) between 1 and 7);
```

- [ ] **Step 2: Update types.** At the top of `lib/types.ts` add `import type { Recurrence } from "./recurrence";`. Add `recurrence: Recurrence | null;` to the `Task` interface (after `custom_fields: CustomFields;`) and change `Habit` to:

```ts
export interface Habit { id: string; name: string; icon: string; active: boolean; sort_order: number; schedule_days: number[]; }
```

(`Recurrence` is defined in Task 2; typecheck passes after Task 2.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_recurrence.sql
git add -p lib/types.ts   # stage only the import, Task and Habit hunks — NOT the VisionItem hunk
git commit -m "feat(db): add tasks.recurrence and habits.schedule_days

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 2: `lib/recurrence.ts`

**Files:**
- Create: `lib/recurrence.ts`
- Test: `tests/recurrence.test.ts`

**Interfaces:**
- Produces:
  - `type Recurrence` (as in Global Constraints)
  - `ALL_DAYS: number[]`, `WEEKDAY_LABELS: string[]`
  - `weekdayIndex(iso: string): number`
  - `isScheduled(days: number[], iso: string): boolean`
  - `validateRule(r: Recurrence): boolean`
  - `recurrenceError(r: Recurrence | null, dueIso: string | null): string | null`
  - `withAnchor(r: Recurrence, dueIso: string | null): Recurrence` (monthly → `day` = due's day-of-month; others unchanged)
  - `nextOccurrence(r: Recurrence, afterIso: string): string` (strictly after)
  - `describeRule(r: Recurrence): string`, `describeDays(days: number[]): string`

- [ ] **Step 1: Write the failing tests** — `tests/recurrence.test.ts` (2026-10-10 is a Saturday; 10-05 Monday; 10-11 Sunday):

```ts
import { describe, it, expect } from "vitest";
import {
  ALL_DAYS, describeDays, describeRule, isScheduled, nextOccurrence,
  recurrenceError, validateRule, weekdayIndex, withAnchor, type Recurrence,
} from "@/lib/recurrence";

describe("weekdayIndex / isScheduled", () => {
  it("Mon=0..Sun=6", () => {
    expect(weekdayIndex("2026-10-05")).toBe(0);
    expect(weekdayIndex("2026-10-10")).toBe(5);
    expect(weekdayIndex("2026-10-11")).toBe(6);
  });
  it("isScheduled", () => {
    expect(isScheduled([5, 6], "2026-10-10")).toBe(true);
    expect(isScheduled([0, 1, 2, 3, 4], "2026-10-10")).toBe(false);
    expect(isScheduled(ALL_DAYS, "2026-10-07")).toBe(true);
  });
});

describe("nextOccurrence", () => {
  it("daily every 3 days", () => {
    expect(nextOccurrence({ freq: "daily", interval: 3 }, "2026-10-10")).toBe("2026-10-13");
  });
  it("weekly later in same week", () => {
    const r: Recurrence = { freq: "weekly", interval: 1, days: [0, 3] };
    expect(nextOccurrence(r, "2026-10-05")).toBe("2026-10-08"); // Mon -> Thu
  });
  it("weekly wraps to next week", () => {
    const r: Recurrence = { freq: "weekly", interval: 1, days: [0, 3] };
    expect(nextOccurrence(r, "2026-10-08")).toBe("2026-10-12"); // Thu -> next Mon
  });
  it("weekly interval 2 skips a week", () => {
    const r: Recurrence = { freq: "weekly", interval: 2, days: [0, 3] };
    expect(nextOccurrence(r, "2026-10-08")).toBe("2026-10-19");
  });
  it("weekly single day is strictly after", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1, days: [5] }, "2026-10-10")).toBe("2026-10-17");
  });
  it("weekly unsorted days", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1, days: [3, 0] }, "2026-10-05")).toBe("2026-10-08");
  });
  it("weekly across year boundary", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1, days: [0] }, "2026-12-31")).toBe("2027-01-04");
  });
  it("monthly clamps without drifting (day 31)", () => {
    const r: Recurrence = { freq: "monthly", interval: 1, day: 31 };
    expect(nextOccurrence(r, "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence(r, "2026-02-28")).toBe("2026-03-31");
  });
  it("monthly leap year", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 1, day: 31 }, "2028-01-31")).toBe("2028-02-29");
  });
  it("monthly interval across year end", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 2, day: 30 }, "2026-11-30")).toBe("2027-01-30");
    expect(nextOccurrence({ freq: "monthly", interval: 1, day: 15 }, "2026-12-15")).toBe("2027-01-15");
  });
});

describe("validateRule / recurrenceError / withAnchor", () => {
  it("rejects bad intervals", () => {
    expect(validateRule({ freq: "daily", interval: 0 })).toBe(false);
    expect(validateRule({ freq: "daily", interval: 1.5 })).toBe(false);
    expect(validateRule({ freq: "daily", interval: NaN })).toBe(false);
    expect(validateRule({ freq: "daily", interval: 2 })).toBe(true);
  });
  it("weekly days must be non-empty, unique, 0..6", () => {
    expect(validateRule({ freq: "weekly", interval: 1, days: [] })).toBe(false);
    expect(validateRule({ freq: "weekly", interval: 1, days: [1, 1] })).toBe(false);
    expect(validateRule({ freq: "weekly", interval: 1, days: [7] })).toBe(false);
    expect(validateRule({ freq: "weekly", interval: 1, days: [0, 6] })).toBe(true);
  });
  it("monthly day must be 1..31", () => {
    expect(validateRule({ freq: "monthly", interval: 1, day: 0 })).toBe(false);
    expect(validateRule({ freq: "monthly", interval: 1, day: 32 })).toBe(false);
    expect(validateRule({ freq: "monthly", interval: 1, day: 31 })).toBe(true);
  });
  it("recurrenceError", () => {
    expect(recurrenceError(null, null)).toBeNull();
    expect(recurrenceError({ freq: "daily", interval: 1 }, null)).toMatch(/due date/i);
    expect(recurrenceError({ freq: "weekly", interval: 1, days: [] }, "2026-10-10")).toMatch(/weekday/i);
    expect(recurrenceError({ freq: "daily", interval: 0 }, "2026-10-10")).toMatch(/1 or more/i);
    expect(recurrenceError({ freq: "daily", interval: 1 }, "2026-10-10")).toBeNull();
  });
  it("withAnchor sets monthly day only", () => {
    expect(withAnchor({ freq: "monthly", interval: 1, day: 1 }, "2026-10-17")).toEqual({ freq: "monthly", interval: 1, day: 17 });
    const d: Recurrence = { freq: "daily", interval: 1 };
    expect(withAnchor(d, "2026-10-17")).toBe(d);
    const m: Recurrence = { freq: "monthly", interval: 1, day: 5 };
    expect(withAnchor(m, null)).toBe(m);
  });
});

describe("describe", () => {
  it("describeRule", () => {
    expect(describeRule({ freq: "daily", interval: 1 })).toBe("Every day");
    expect(describeRule({ freq: "daily", interval: 3 })).toBe("Every 3 days");
    expect(describeRule({ freq: "weekly", interval: 1, days: [0, 3] })).toBe("Every week on Mon, Thu");
    expect(describeRule({ freq: "weekly", interval: 2, days: [3, 0] })).toBe("Every 2 weeks on Mon, Thu");
    expect(describeRule({ freq: "monthly", interval: 1, day: 15 })).toBe("Every month on day 15");
    expect(describeRule({ freq: "monthly", interval: 3, day: 15 })).toBe("Every 3 months on day 15");
  });
  it("describeDays", () => {
    expect(describeDays(ALL_DAYS)).toBe("Every day");
    expect(describeDays([0, 1, 2, 3, 4])).toBe("Weekdays");
    expect(describeDays([6, 5])).toBe("Weekends");
    expect(describeDays([6])).toBe("Sun");
    expect(describeDays([3, 0])).toBe("Mon, Thu");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/recurrence.test.ts`
Expected: FAIL (cannot resolve `@/lib/recurrence`).

- [ ] **Step 3: Implement** — `lib/recurrence.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/recurrence.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/recurrence.ts tests/recurrence.test.ts
git commit -m "feat: recurrence rules and next-occurrence logic

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Schedule-aware streaks

**Files:**
- Modify: `lib/streaks.ts` (full rewrite below)
- Test: `tests/streaks.test.ts` (append)

**Interfaces:**
- Consumes: `ALL_DAYS`, `isScheduled` from `lib/recurrence.ts`.
- Produces: `computeStreaks(checkedDates: string[], todayIso: string, days?: number[]): StreakStats` — `days` defaults to every day.

- [ ] **Step 1: Append failing tests** to `tests/streaks.test.ts` (2026-10-10 Sat; weekends: 09-26/27, 10-03/04, 10-10/11):

```ts
describe("computeStreaks with a schedule", () => {
  const WEEKEND = [5, 6];
  it("weekend-only: consecutive weekend days form a streak", () => {
    const checked = ["2026-09-26", "2026-09-27", "2026-10-03", "2026-10-04", "2026-10-10"];
    const s = computeStreaks(checked, "2026-10-10", WEEKEND);
    expect(s.current).toBe(5);
    expect(s.best).toBe(5);
  });
  it("unscheduled today with nothing checked keeps the streak", () => {
    const checked = ["2026-09-26", "2026-09-27", "2026-10-03", "2026-10-04"];
    expect(computeStreaks(checked, "2026-10-08", WEEKEND).current).toBe(4); // Thursday
  });
  it("scheduled today unchecked keeps the streak anchored on the previous scheduled day", () => {
    const checked = ["2026-10-03", "2026-10-04"];
    expect(computeStreaks(checked, "2026-10-10", WEEKEND).current).toBe(2);
  });
  it("a missed scheduled day breaks the streak", () => {
    const s = computeStreaks(["2026-10-03", "2026-10-10"], "2026-10-10", WEEKEND); // Sun 10-04 missed
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
  });
  it("Sunday-only", () => {
    const s = computeStreaks(["2026-09-27", "2026-10-04", "2026-10-11"], "2026-10-11", [6]);
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });
  it("bonus check-ins on unscheduled days neither extend nor break", () => {
    const s = computeStreaks(["2026-10-03", "2026-10-04", "2026-10-07"], "2026-10-04", WEEKEND);
    expect(s.current).toBe(2);
    expect(s.best).toBe(2);
  });
  it("only-bonus check-ins give zeros", () => {
    expect(computeStreaks(["2026-10-07"], "2026-10-10", WEEKEND)).toEqual({ current: 0, best: 0, completionPct: 0 });
  });
  it("completionPct counts scheduled days only", () => {
    // 9 weekend days in the 30 days ending 2026-10-10; 3 checked → 33%
    const s = computeStreaks(["2026-09-12", "2026-09-13", "2026-10-10"], "2026-10-10", WEEKEND);
    expect(s.completionPct).toBe(33);
  });
  it("empty schedule gives zeros without dividing by zero", () => {
    expect(computeStreaks(["2026-10-10"], "2026-10-10", [])).toEqual({ current: 0, best: 0, completionPct: 0 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/streaks.test.ts`
Expected: new tests FAIL; original 5 pass.

- [ ] **Step 3: Replace `lib/streaks.ts`:**

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/streaks.test.ts`
Expected: all PASS (old and new).

- [ ] **Step 5: Commit**

```bash
git add lib/streaks.ts tests/streaks.test.ts
git commit -m "feat(habits): compute streaks over scheduled weekdays only

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Task completion spawns the next occurrence

**Files:**
- Create: `lib/taskRecurrence.ts`
- Test: `tests/taskRecurrence.test.ts`

**Interfaces:**
- Consumes: `nextOccurrence` (Task 2); `Task` (Task 1).
- Produces:
  - `nextTaskRow(t: Task, todayIso: string): NextTaskRow | null`
  - `spawnNext(supabase: SupabaseClient, t: Task, todayIso: string): Promise<string | null>` — error message or null
  - `completeTask(supabase: SupabaseClient, t: Task, todayIso: string): Promise<string | null>` — marks done (only if not already done), then spawns; error message or null

- [ ] **Step 1: Write failing tests** — `tests/taskRecurrence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextTaskRow } from "@/lib/taskRecurrence";
import type { Task } from "@/lib/types";

const base: Task = {
  id: "t1", title: "Water plants", description: "front room", due_date: "2026-10-05",
  priority: 1, status: "done", completed_at: "2026-10-05T12:00:00Z", project_id: null,
  custom_fields: { a: 1 }, created_at: "2026-09-01T00:00:00Z",
  recurrence: { freq: "weekly", interval: 1, days: [0] },
};

describe("nextTaskRow", () => {
  it("null for one-time tasks", () => {
    expect(nextTaskRow({ ...base, recurrence: null }, "2026-10-05")).toBeNull();
  });
  it("null for a repeating task with no due date", () => {
    expect(nextTaskRow({ ...base, due_date: null }, "2026-10-05")).toBeNull();
  });
  it("copies fields, reopens, and schedules from the due date", () => {
    expect(nextTaskRow(base, "2026-10-05")).toEqual({
      title: "Water plants", description: "front room", priority: 1, project_id: null,
      custom_fields: { a: 1 }, recurrence: base.recurrence, status: "open", due_date: "2026-10-12",
    });
  });
  it("completed early: next is after the (future) due date", () => {
    expect(nextTaskRow({ ...base, due_date: "2026-10-12" }, "2026-10-08")!.due_date).toBe("2026-10-19");
  });
  it("completed weeks late: next is in the future, not another overdue date", () => {
    expect(nextTaskRow(base, "2026-10-28")!.due_date).toBe("2026-11-02"); // Wed 10-28 -> next Mon
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/taskRecurrence.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement** — `lib/taskRecurrence.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { nextOccurrence } from "./recurrence";
import type { Task } from "./types";

export type NextTaskRow = Pick<Task, "title" | "description" | "priority" | "project_id" | "custom_fields" | "recurrence">
  & { status: "open"; due_date: string };

/** The row to insert after `t` is completed, or null if `t` doesn't repeat (or has no anchor date). */
export function nextTaskRow(t: Task, todayIso: string): NextTaskRow | null {
  if (!t.recurrence || !t.due_date) return null;
  // Anchor on the schedule, but never produce a date that is already in the past.
  const base = t.due_date > todayIso ? t.due_date : todayIso;
  return {
    title: t.title, description: t.description, priority: t.priority, project_id: t.project_id,
    custom_fields: t.custom_fields, recurrence: t.recurrence, status: "open",
    due_date: nextOccurrence(t.recurrence, base),
  };
}

/** Insert the next occurrence of a just-completed repeating task. Returns an error message or null. */
export async function spawnNext(supabase: SupabaseClient, t: Task, todayIso: string): Promise<string | null> {
  const row = nextTaskRow(t, todayIso);
  if (!row) return null;
  const { error } = await supabase.from("tasks").insert(row);
  return error ? `Task completed, but creating the next occurrence failed: ${error.message}` : null;
}

/**
 * Mark a task done and spawn its next occurrence. The update only matches rows that are not
 * already done, so a double-click (or two pages) completing the same task spawns exactly once.
 */
export async function completeTask(supabase: SupabaseClient, t: Task, todayIso: string): Promise<string | null> {
  const { data, error } = await supabase.from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", t.id).neq("status", "done").select("id");
  if (error) return error.message;
  if (!data || data.length === 0) return null; // already completed elsewhere
  return spawnNext(supabase, t, todayIso);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/taskRecurrence.test.ts` and `npx tsc --noEmit`
Expected: PASS; tsc reports no errors from these files (pre-existing/unrelated errors, if any, are not yours).

- [ ] **Step 5: Commit**

```bash
git add lib/taskRecurrence.ts tests/taskRecurrence.test.ts
git commit -m "feat(tasks): spawn next occurrence when a repeating task completes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Shared UI components

**Files:**
- Create: `components/WeekdayPicker.tsx`, `components/RecurrenceEditor.tsx`

**Interfaces:**
- Consumes: `WEEKDAY_LABELS`, `ALL_DAYS`, `Recurrence`, `withAnchor`, `weekdayIndex` (Task 2); `Select` from `@/components/win`.
- Produces:
  - `<WeekdayPicker value={number[]} onChange={(days: number[]) => void} presets?: boolean />` — Mon–Sun toggle chips (sorted result); optional Daily/Weekdays/Weekends preset buttons. May emit an empty array; consumers validate.
  - `<RecurrenceEditor value={Recurrence} anchorIso={string | null} onChange={(r: Recurrence) => void} />`

- [ ] **Step 1: Skim `node_modules/next/dist/docs/01-app` for client-component guidance** (per AGENTS.md); both files are plain `"use client"` components like the existing `components/CustomFieldsEditor.tsx` — open it and match its style.

- [ ] **Step 2: Create `components/WeekdayPicker.tsx`:**

```tsx
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
```

- [ ] **Step 3: Create `components/RecurrenceEditor.tsx`:**

```tsx
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
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint components/WeekdayPicker.tsx components/RecurrenceEditor.tsx`
Expected: no errors in these files. (Check `Select`'s `options`/`className` props in `components/win/index.tsx:30` and adjust if the signature differs.)

- [ ] **Step 5: Commit**

```bash
git add components/WeekdayPicker.tsx components/RecurrenceEditor.tsx
git commit -m "feat(ui): WeekdayPicker and RecurrenceEditor components

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Tasks UI (create, edit, complete)

**Files:**
- Modify: `app/(app)/tasks/page.tsx`, `app/(app)/page.tsx` (`toggleTask`), `app/(app)/journal/page.tsx` (`toggleTask`, lines ~76-85)

**Interfaces:**
- Consumes: `completeTask`, `spawnNext` (Task 4); `RecurrenceEditor` (Task 5); `Recurrence`, `recurrenceError`, `withAnchor`, `describeRule` (Task 2).

- [ ] **Step 1: `app/(app)/tasks/page.tsx` — imports.** Add:

```ts
import { completeTask, spawnNext } from "@/lib/taskRecurrence";
import { describeRule, recurrenceError, withAnchor, type Recurrence } from "@/lib/recurrence";
import RecurrenceEditor from "@/components/RecurrenceEditor";
```

- [ ] **Step 2: New-task state and create.** Add `const [newRule, setNewRule] = useState<Recurrence | null>(null);` next to the other `useState`s. Replace `addTask`:

```ts
  async function addTask() {
    if (!title.trim()) return;
    const rule = newRule ? withAnchor(newRule, due || null) : null;
    const problem = recurrenceError(rule, due || null);
    if (problem) return showToast(problem);
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(), due_date: due || null, priority: Number(priority), recurrence: rule,
    });
    if (error) return showToast(error.message);
    setTitle(""); setNewRule(null);
    load();
  }
```

- [ ] **Step 3: Complete via helper.** Replace `toggleDone`:

```ts
  async function toggleDone(t: Task) {
    const done = t.status !== "done";
    setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, status: done ? "done" : "open" } : x));
    const err = done
      ? await completeTask(supabase, t, today)
      : (await supabase.from("tasks").update({ status: "open", completed_at: null }).eq("id", t.id)).error?.message ?? null;
    if (err) showToast(err);
    load();
  }
```

- [ ] **Step 4: Detail save.** Replace `saveDetail`:

```ts
  async function saveDetail() {
    if (!detail) return;
    const rule = detail.recurrence ? withAnchor(detail.recurrence, detail.due_date) : null;
    const problem = recurrenceError(rule, detail.due_date);
    if (problem) return showToast(problem);
    const prev = tasks.find((x) => x.id === detail.id);
    const { error } = await supabase.from("tasks").update({
      title: detail.title, description: detail.description, due_date: detail.due_date || null,
      priority: detail.priority, status: detail.status, custom_fields: detail.custom_fields,
      recurrence: rule,
      completed_at: detail.status === "done"
        ? detail.completed_at ?? new Date().toISOString() : null,
    }).eq("id", detail.id);
    if (error) return showToast(error.message);
    if (prev && prev.status !== "done" && detail.status === "done") {
      const err = await spawnNext(supabase, { ...detail, recurrence: rule }, today);
      if (err) showToast(err);
    }
    setDetail(null); load();
  }
```

- [ ] **Step 5: Add-row UI.** Directly after the closing `</div>` of the `mb-3 flex gap-2` add-row (before `{tab !== "done" && (`), insert:

```tsx
        <div className="mb-3">
          <Check label="Repeat" checked={!!newRule}
            onChange={(on) => setNewRule(on ? withAnchor({ freq: "daily", interval: 1 }, due || null) : null)} />
          {newRule && (
            <div className="mt-1 pl-6">
              <RecurrenceEditor value={newRule} anchorIso={due || null} onChange={setNewRule} />
              {!due && <p className="mt-1 text-xs text-[#aa0000]">Repeating tasks need a due date.</p>}
            </div>
          )}
        </div>
```

Also make the new-task due-date input keep a monthly rule's day in sync: change its `onChange` to
`onChange={(e) => { setDue(e.target.value); setNewRule((r) => r ? withAnchor(r, e.target.value || null) : r); }}`.

- [ ] **Step 6: Row badge.** In the row's title button, after the `<span className={t.status === "done" ...}>{t.title}</span>` add:

```tsx
                  {t.recurrence && <span className="ml-2 text-xs text-[#000080]" title={describeRule(t.recurrence)}>🔁 {describeRule(t.recurrence)}</span>}
```

- [ ] **Step 7: Detail dialog UI.** Make the due-date input keep monthly `day` in sync: its `onChange` becomes

```tsx
onChange={(e) => setDetail({ ...detail, due_date: e.target.value || null,
  recurrence: detail.recurrence ? withAnchor(detail.recurrence, e.target.value || null) : null })}
```

and after the `Priority:` field-row insert:

```tsx
            <div className="field-row"><label>Repeat:</label>
              <div className="flex-1">
                <Check label="Repeats" checked={!!detail.recurrence}
                  onChange={(on) => setDetail({ ...detail, recurrence: on ? withAnchor({ freq: "daily", interval: 1 }, detail.due_date) : null })} />
                {detail.recurrence && (
                  <div className="mt-1">
                    <RecurrenceEditor value={detail.recurrence} anchorIso={detail.due_date}
                      onChange={(recurrence) => setDetail({ ...detail, recurrence })} />
                  </div>
                )}
              </div></div>
```

- [ ] **Step 8: Dashboard `toggleTask`** (`app/(app)/page.tsx`): add `import { completeTask } from "@/lib/taskRecurrence";` and replace `toggleTask`:

```ts
  async function toggleTask(t: Task) {
    const err = t.status !== "done"
      ? await completeTask(supabase, t, today)
      : (await supabase.from("tasks").update({ status: "open", completed_at: null }).eq("id", t.id)).error?.message ?? null;
    if (err) return showToast(err);
    load();
  }
```

- [ ] **Step 9: Journal `toggleTask`** (`app/(app)/journal/page.tsx`): add `import { completeTask } from "@/lib/taskRecurrence";`, ensure `todayISO` is in its existing `@/lib/dates` import, and replace the update call inside `toggleTask` so the function becomes:

```ts
  async function toggleTask(t: Task) {
    const err = t.status !== "done"
      ? await completeTask(supabase, t, todayISO())
      : (await supabase.from("tasks").update({ status: "open", completed_at: null }).eq("id", t.id)).error?.message ?? null;
    if (err) showToast(err);
    const { data } = await supabase.from("tasks").select("*").is("project_id", null)
      .eq("due_date", effectiveDate).order("priority");
    setTasks((data as Task[]) ?? []);
  }
```

- [ ] **Step 10: Verify and commit**

Run: `npx tsc --noEmit && npx eslint "app/(app)/tasks/page.tsx" "app/(app)/page.tsx" "app/(app)/journal/page.tsx"`
Expected: no new errors. Do **not** stage `vision/page.tsx`.

```bash
git add "app/(app)/tasks/page.tsx" "app/(app)/page.tsx" "app/(app)/journal/page.tsx"
git commit -m "feat(tasks): configurable repeat on tasks, next occurrence on completion

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Habit schedules UI (Habits page + Dashboard)

**Files:**
- Modify: `app/(app)/habits/page.tsx`, `app/(app)/page.tsx`

**Interfaces:**
- Consumes: `computeStreaks(…, days)` (Task 3); `isScheduled`, `describeDays` (Task 2); `WeekdayPicker` (Task 5).

- [ ] **Step 1: Habits page imports.** Add:

```ts
import { describeDays, isScheduled } from "@/lib/recurrence";
import WeekdayPicker from "@/components/WeekdayPicker";
```

- [ ] **Step 2: `setSchedule`.** Add after `toggleActive`:

```ts
  async function setSchedule(h: Habit, days: number[]) {
    if (days.length === 0) return showToast("Pick at least one day");
    setHabits((hs) => hs.map((x) => x.id === h.id ? { ...x, schedule_days: days } : x));
    const { error } = await supabase.from("habits").update({ schedule_days: days }).eq("id", h.id);
    if (error) showToast(error.message);
    load(); // reloads the saved value, undoing the optimistic change on error
  }
```

- [ ] **Step 3: Stats use the schedule.** Replace `statsFor`:

```ts
  const statsFor = (h: Habit) =>
    computeStreaks(entries.filter((e) => e.habit_id === h.id && e.checked).map((e) => e.date), today, h.schedule_days);
```

- [ ] **Step 4: Grid.** In the habit name cell render the schedule when not daily:

```tsx
<td className="border border-[#ccc] px-2 py-1">{h.icon} {h.name}
  {h.schedule_days.length < 7 && <span className="block text-[10px] text-[#666]">{describeDays(h.schedule_days)}</span>}</td>
```

and change the day cell's className to grey out unscheduled days (still checkable as bonus):

```tsx
<td key={d} className={`border border-[#ccc] text-center ${d === today ? "bg-[#ffffe1]" : !isScheduled(h.schedule_days, d) ? "bg-[#eee]" : ""}`}>
```

- [ ] **Step 5: Manage dialog.** Replace the `habits.map` block in the Manage Habits dialog with:

```tsx
        {habits.map((h) => (
          <div key={h.id} className="mb-3">
            <div className="mb-1 flex items-center gap-2">
              <Input key={h.id} defaultValue={h.name} onBlur={(e) => renameHabit(h, e.target.value)} />
              <Btn onClick={() => moveHabit(h, -1)}>▲</Btn>
              <Btn onClick={() => moveHabit(h, 1)}>▼</Btn>
              <Btn onClick={() => toggleActive(h)}>{h.active ? "Retire" : "Restore"}</Btn>
            </div>
            <WeekdayPicker presets value={h.schedule_days} onChange={(days) => setSchedule(h, days)} />
          </div>
        ))}
```

- [ ] **Step 6: Dashboard.** In `app/(app)/page.tsx` add `import { isScheduled } from "@/lib/recurrence";`. Pass the schedule into the streaks memo: `entries.filter(...).map((e) => e.date), today, h.schedule_days)`. Add after `streaks`:

```ts
  const dueHabits = useMemo(() => habits.filter((h) => isScheduled(h.schedule_days, today)), [habits, today]);
```

Change `const habitsDone = habits.filter(` to `const habitsDone = dueHabits.filter(`. In the "Today's Habits" window: header count → `{habitsDone} / {dueHabits.length}`; replace the empty-state line and the map with:

```tsx
          {habits.length === 0 && <p className="text-[#666]">No habits configured.</p>}
          {habits.length > 0 && dueHabits.length === 0 && <p className="text-[#666]">No habits scheduled today.</p>}
          {dueHabits.map((h) => (
```

and the At a Glance row → `<b>{habitsDone} / {dueHabits.length}</b>`.

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit && npx eslint "app/(app)/habits/page.tsx" "app/(app)/page.tsx"`
Expected: no new errors.

```bash
git add "app/(app)/habits/page.tsx" "app/(app)/page.tsx"
git commit -m "feat(habits): per-habit weekday schedules, editable for existing habits

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Full verification

- [ ] **Step 1:** `npm test` — all suites PASS (existing + `recurrence`, `taskRecurrence`, extended `streaks`).
- [ ] **Step 2:** `npm run lint` and `npx tsc --noEmit` — no errors attributable to this branch.
- [ ] **Step 3:** `npm run build` — succeeds.
- [ ] **Step 4: Apply migration** `supabase/migrations/005_recurrence.sql` to the Supabase project the app uses (SQL editor or `supabase db push` — whichever the project already uses for 001–004). Confirm in the table editor that existing habits show `schedule_days = {0,1,2,3,4,5,6}`.
- [ ] **Step 5: Browser check** (`npm run dev`, use the `run` skill / Chrome DevTools MCP):
  1. Tasks → add "Test weekly" due today, Repeat → every 1 week on two weekdays → Add. Row shows 🔁 badge. Tick it → exactly one new open copy appears with the correct next date. Double-click the checkbox quickly on another repeating task → still only one copy.
  2. Open a repeating task's properties, change interval/days, OK; reopen and confirm persisted. Uncheck Repeats → badge disappears.
  3. Repeat checked with no due date → toast "Repeating tasks need a due date".
  4. Habits → Manage… → set an existing habit to Weekends. Grid shows weekday cells greyed, label "Weekends", streak counts weekends only. Dashboard "Today's Habits" hides it on a weekday and counts only due habits.
  5. Deselect every day → toast "Pick at least one day" and the schedule is unchanged.
- [ ] **Step 6:** Report results faithfully; if anything above fails, fix before claiming done (superpowers:verification-before-completion).
