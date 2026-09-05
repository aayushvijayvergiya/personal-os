-- The Reading shelf now holds two kinds of thing: books (title/author, three shelves) and
-- articles (title/link, read or not). They share this table so RLS, sort_order and the
-- single query path stay as they are; `item_type` tells them apart. Articles use only
-- 'to_read' and 'finished' of the existing status values, so the check constraint stands.

alter table public.books
  add column if not exists item_type text not null default 'book',
  add column if not exists due_date date;

alter table public.books drop constraint if exists books_item_type_check;
alter table public.books add constraint books_item_type_check
  check (item_type in ('book','article'));

create index if not exists books_item_type_due_date_idx
  on public.books (user_id, item_type, due_date);
