-- The task Properties dialogs write `status` without touching `completed_at`, so rows
-- could end up status='done' with completed_at null. Anything that lists completed work
-- by date (dashboard) then silently skipped them, while views that read `status`
-- (calendar) still showed them as done. Backfill, then keep the two in sync in the DB
-- so every write path stays correct.

update public.tasks
set completed_at = coalesce(due_date::timestamptz, created_at)
where status = 'done' and completed_at is null;

update public.tasks
set completed_at = null
where status <> 'done' and completed_at is not null;

create or replace function public.tasks_sync_completed_at()
returns trigger language plpgsql as $fn$
begin
  if new.status = 'done' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end
$fn$;

drop trigger if exists tasks_sync_completed_at on public.tasks;
create trigger tasks_sync_completed_at
  before insert or update on public.tasks
  for each row execute function public.tasks_sync_completed_at();
