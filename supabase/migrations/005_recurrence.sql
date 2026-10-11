-- Repeating tasks: null = one-time. Habit schedules: weekdays 0=Mon..6=Sun the habit applies to.
-- Existing habits default to every day, so nothing changes for them until edited.

alter table public.tasks
  add column if not exists recurrence jsonb
  check (recurrence is null or recurrence->>'freq' in ('daily','weekly','monthly'));

alter table public.habits
  add column if not exists schedule_days smallint[] not null default '{0,1,2,3,4,5,6}'
  check (cardinality(schedule_days) between 1 and 7);
