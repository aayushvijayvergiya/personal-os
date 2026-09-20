-- Journal questions now track when each row started and stopped applying, so editing or
-- removing a question in Settings only changes the day/week view from today onward instead
-- of rewriting what past entries show.

alter table public.journal_questions
  add column if not exists created_on date not null default current_date,
  add column if not exists retired_on date;

-- Existing questions have been in effect since before we tracked this — keep them visible
-- on all historical entries rather than only from the day this migration runs.
update public.journal_questions set created_on = '1970-01-01';
