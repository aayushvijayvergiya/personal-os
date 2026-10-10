# Recurring Tasks & Habit Schedules — Design

## Goal
1. A task can be one-time or repeating. Repeating tasks have a configurable period: every N days, every N weeks on chosen weekdays, or every N months.
2. A habit can be scheduled on chosen weekdays (e.g. weekends only). Streaks count scheduled days only.
3. Existing habits in the DB can be edited to use a schedule.

## Decisions (agreed)
- Repeating task: **spawn next occurrence on completion**; next due date is **anchored to the schedule**, not the completion date.
- Habit schedule changes are **retroactive**: stats are always computed from the current schedule over all past check-ins. No schedule history table.
- Monthly repeat = the stored `day` of month, clamped to month end (stored in the rule so clamping never drifts).

## Out of scope
End dates / occurrence counts, "repeat after completion" mode, times of day, habits every N days, back-filling past occurrences, calendar changes.

## 1. `lib/recurrence.ts` (pure, unit-tested)
```ts
type Recurrence =
  | { freq: "daily";   interval: number }
  | { freq: "weekly";  interval: number; days: number[] }  // 0=Mon..6=Sun, non-empty
  | { freq: "monthly"; interval: number; day: number };  // day-of-month 1..31, stored so Jan 31 → Feb 28 → Mar 31 does not drift
```
- `nextOccurrence(rule, afterIso): string` — first matching date strictly after `afterIso`. Weekly with interval > 1 counts weeks from the ISO week of `afterIso`'s anchor week (the week containing the previous due date).
- `isScheduled(days: number[], iso): boolean`
- `describeRule(rule): string` — e.g. "Every 2 weeks on Mon, Thu".
- `validateRule(rule): boolean` — interval >= 1 integer; weekly days non-empty, unique, 0..6.

## 2. Tasks
- Migration `005_recurrence.sql`: `tasks.recurrence jsonb null` (null = one-time) with a check that `recurrence->>'freq'` is in (daily, weekly, monthly) when not null.
- `Task.recurrence: Recurrence | null` in `lib/types.ts`.
- Task form: "Repeat" checkbox → frequency select, "every N" input, weekday toggles when weekly. Repeating requires a due date. Rule validated with `validateRule` before save.
- Completion: on transition to `done` of a task with a recurrence, insert a new open task copying title, description, priority, project_id, custom_fields and recurrence, with `due_date = nextOccurrence(rule, max(old due_date, today))`. Spawn only on the transition (not when already done) to avoid duplicates. Insert error → toast; the completion itself is kept.
- Reopening a done task does not remove the spawned copy.
- Row display: 🔁 badge with `describeRule`.

## 3. Habits
- Migration (same file): `habits.schedule_days smallint[] not null default '{0,1,2,3,4,5,6}'` with a check that it is non-empty. Existing rows become daily; `habit_entries` is untouched.
- `Habit.schedule_days: number[]` in `lib/types.ts`.
- `computeStreaks(checkedDates, todayIso, days = [0..6])`:
  - Only scheduled dates count. Current streak walks back through scheduled days; an unchecked scheduled *today* does not break it.
  - A missed scheduled day breaks the streak. Checks on unscheduled days (bonus) neither extend nor break it.
  - Best streak uses the same rule over all scheduled days.
  - 30-day % = checked scheduled days / scheduled days in the last 30 days (0 if none).
  - Default `days` keeps existing behaviour and tests.
- Dashboard "Today's Habits": list only habits scheduled today; "Habits today" count uses scheduled habits only.
- Habits page grid: unscheduled cells are greyed but still checkable (bonus). Stats use `statsFor` with the habit's days.
- Manage Habits dialog: per habit, Mon–Sun chips plus Daily / Weekdays / Weekends presets. Applies on toggle (optimistic, rollback + toast on error). At least one day must remain selected. Works for active and retired habits. New habits default to daily and can be scheduled right after being added.

## 4. Testing
- Vitest, test-first: `tests/recurrence.test.ts` (daily, multi-day weekly, N-week interval, month-end clamping, overdue anchor, validation, describe) and extended `tests/streaks.test.ts` (weekend-only, Sunday-only, missed scheduled day, bonus day, default-days regression, 30d %).
- Manual browser check of: creating/completing a repeating task, editing an existing habit's schedule, dashboard filtering.
- Before touching pages, read the relevant Next.js 16 docs in `node_modules/next/dist/docs/` (per AGENTS.md).
