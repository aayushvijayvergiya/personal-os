create extension if not exists "pgcrypto";

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  color text not null default '#000080',
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  description text,
  color text not null default '#000080',
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  target_date date,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  description text,
  due_date date,
  priority int not null default 2 check (priority between 1 and 3),
  status text not null default 'open' check (status in ('open','in_progress','done')),
  completed_at timestamptz,
  project_id uuid references public.projects(id) on delete cascade,
  custom_fields jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index tasks_due_idx on public.tasks (user_id, due_date);
create index tasks_project_idx on public.tasks (project_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  description text,
  horizon_type text not null check (horizon_type in ('date','month','quarter','year')),
  horizon_value text not null,
  category_id uuid references public.categories(id) on delete set null,
  status text not null default 'not_started' check (status in ('not_started','in_progress','done')),
  custom_fields jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  icon text not null default '⭐',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.habit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  date date not null,
  checked boolean not null default true,
  unique (habit_id, date)
);

create table public.journal_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  prompt text not null,
  journal_type text not null check (journal_type in ('daily','weekly')),
  sort_order int not null default 0,
  active boolean not null default true
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date date not null,
  type text not null check (type in ('daily','weekly')),
  answers jsonb not null default '{}',
  notes text not null default '',
  day_rating int check (day_rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, date, type)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  author text,
  status text not null default 'to_read' check (status in ('to_read','reading','finished')),
  rating int check (rating between 1 and 5),
  takeaways text,
  link text,
  started_at date,
  finished_at date,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.field_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  entity text not null check (entity in ('task','goal')),
  name text not null,
  field_type text not null check (field_type in ('text','number','date','select')),
  options jsonb,
  sort_order int not null default 0
);

create table public.vision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  item_type text not null check (item_type in ('note','image','goal','list')),
  content jsonb not null default '{}',
  pos_x double precision not null default 40,
  pos_y double precision not null default 40,
  rotation double precision not null default 0,
  z_index int not null default 1,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['categories','projects','tasks','goals','habits','habit_entries',
    'journal_questions','journal_entries','notes','books','field_definitions','vision_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
