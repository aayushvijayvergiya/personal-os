# Personal OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a single-user retro-Win95-styled "Personal OS" webapp (tasks, projects, goals, habits+streaks, journals, calendar, notes, reading list, vision board) per `docs/superpowers/specs/2026-07-19-personal-os-design.md`.

**Architecture:** Next.js 15 App Router (TypeScript, Tailwind v4) frontend talking directly to Supabase (Postgres + Auth) via `@supabase/supabase-js` + `@supabase/ssr`, with Row-Level Security scoping all rows to the single authenticated user. Pure logic (dates, streaks, horizons) lives in `lib/` with Vitest TDD; each module is a client page under an auth-guarded `(app)` route group sharing a retro design system (CSS classes in `globals.css`) and a small `components/win` primitive library.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v4, @supabase/supabase-js v2, @supabase/ssr, Vitest, deployed on Vercel + Supabase cloud.

## Global Constraints

- Single user: all tables have `user_id uuid not null default auth.uid()` + RLS policy `user_id = auth.uid()`.
- Signup allowed only when env `NEXT_PUBLIC_ALLOW_SIGNUP=true`.
- **Separate worlds:** every query for main Tasks views, Dashboard, main Calendar, and Journal MUST filter `project_id IS NULL`. Project tasks appear only in the Projects module.
- Task status values: `open | in_progress | done`. Goal status: `not_started | in_progress | done`. Priority: integer 1–3 rendered as P1 (red `#aa0000`), P2 (black), P3 (gray `#666`).
- Horizon encoding (text): date `2026-07-19`, month `2026-07`, quarter `2026-Q3`, year `2026`.
- Weeks are Monday-based ISO weeks; weekly journal rows store `date` = Monday of the week.
- Retro theme: page background `#d4d0c8`, panel face `#c0c0c0` family, title bars `#000080→#1084d0` gradient with white text, beveled 2px borders, font stack `Tahoma, "MS Sans Serif", "Segoe UI", sans-serif` at 13px base. Light theme only.
- All dates stored as ISO `date` strings (no timezones math beyond local browser date).
- Commit after every task (messages given per task). Run `npx vitest run` before every commit — must pass.
- Work happens at repo root `PersonalOS/` (the Next.js app lives at the root, alongside `docs/` and `supabase/`).

## File Structure

```
app/
  layout.tsx                 # root layout, font + globals
  globals.css                # Tailwind + retro design system classes
  login/page.tsx             # login (+optional signup)
  (app)/layout.tsx           # auth-guarded shell: Sidebar + content + StatusBar
  (app)/page.tsx             # Dashboard
  (app)/tasks/page.tsx
  (app)/goals/page.tsx
  (app)/projects/page.tsx
  (app)/journal/page.tsx
  (app)/habits/page.tsx
  (app)/calendar/page.tsx
  (app)/notes/page.tsx
  (app)/reading/page.tsx
  (app)/vision/page.tsx
  (app)/settings/page.tsx
components/
  win/index.tsx              # retro primitives: Window, Btn, Input, Select, TabBar, Dialog, Checkbox
  win/toast.tsx              # showToast + <Toaster/>
  Sidebar.tsx
  StatusBar.tsx
  CustomFieldsEditor.tsx     # renders field_definitions for an entity, edits custom_fields jsonb
  CalendarGrid.tsx           # shared month/week grid used by Calendar page + Projects calendar tab
lib/
  types.ts                   # row types for all 12 tables
  supabase/client.ts         # browser client
  supabase/server.ts         # server client (cookies)
  dates.ts                   # ISO date helpers, week/month ranges, grids
  streaks.ts                 # streak + completion computation
  horizons.ts                # horizon parse/label/group/current-values
  journalDefaults.ts         # ensureDefaultQuestions()
middleware.ts                # session refresh + redirect to /login
supabase/migrations/001_init.sql
tests/dates.test.ts
tests/streaks.test.ts
tests/horizons.test.ts
vitest.config.ts
.env.local.example
README.md
```

---

### Task 1: Scaffold Next.js app + retro design system + app shell

**Files:**
- Create: entire Next.js scaffold at repo root, `app/globals.css` (replace), `app/layout.tsx` (replace), `components/Sidebar.tsx`, `components/StatusBar.tsx`, `app/(app)/layout.tsx`, `app/(app)/page.tsx` (placeholder), `.env.local.example`

**Interfaces:**
- Produces: CSS classes `win-window`, `win-titlebar`, `bevel-out`, `bevel-in`, `win-btn`, `win-input`, `win-select`, `win-tab`, `win-tab-active`, `field-row`; components `<Sidebar/>`, `<StatusBar/>`; route group `(app)` whose children render inside the shell.

- [ ] **Step 1: Scaffold Next.js into the existing repo**

Run (Bash tool; scaffold to temp dir because the repo root is non-empty, then move in):

```bash
cd "/c/Users/Aayush/Documents/Study Material/AI Engineering/POCs/PersonalOS"
npx --yes create-next-app@latest _scaffold --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --turbopack
shopt -s dotglob
rm -rf _scaffold/.git
mv _scaffold/* .
rmdir _scaffold
```

Expected: `package.json`, `app/`, `next.config.ts`, `tsconfig.json` now at repo root.

- [ ] **Step 2: Replace `app/globals.css` with the retro design system**

```css
@import "tailwindcss";

:root {
  --face: #c0c0c0;
  --desk: #d4d0c8;
  --light: #ffffff;
  --dark: #808080;
  --darker: #404040;
  --title-a: #000080;
  --title-b: #1084d0;
  --red: #aa0000;
}

html, body { height: 100%; }
body {
  background: var(--desk);
  color: #000;
  font-family: Tahoma, "MS Sans Serif", "Segoe UI", sans-serif;
  font-size: 13px;
}

.bevel-out { border: 2px solid; border-color: #fff var(--dark) var(--dark) #fff; background: var(--face); }
.bevel-in  { border: 2px solid; border-color: var(--dark) #fff #fff var(--dark); background: #fff; }

.win-window { border: 2px solid; border-color: #fff var(--darker) var(--darker) #fff; background: var(--face); box-shadow: 1px 1px 0 var(--darker); }
.win-titlebar {
  background: linear-gradient(90deg, var(--title-a), var(--title-b));
  color: #fff; font-weight: bold; padding: 3px 8px; font-size: 12px;
  display: flex; align-items: center; justify-content: space-between; user-select: none;
}
.win-body { padding: 10px; }

.win-btn {
  border: 2px solid; border-color: #fff var(--dark) var(--dark) #fff;
  background: var(--face); padding: 3px 12px; font-size: 12px; cursor: pointer; white-space: nowrap;
}
.win-btn:active { border-color: var(--dark) #fff #fff var(--dark); }
.win-btn:disabled { color: var(--dark); text-shadow: 1px 1px 0 #fff; cursor: default; }
.win-btn-primary { font-weight: bold; outline: 1px solid #000; }

.win-input, .win-select, .win-textarea {
  border: 2px solid; border-color: var(--dark) #fff #fff var(--dark);
  background: #fff; padding: 3px 6px; font-size: 13px; font-family: inherit; outline: none; width: 100%;
}
.win-textarea { resize: vertical; }

.win-tabbar { display: flex; gap: 2px; align-items: flex-end; padding: 0 6px; }
.win-tab {
  border: 2px solid; border-color: #fff var(--dark) var(--face) #fff;
  background: var(--face); padding: 3px 12px; font-size: 12px; cursor: pointer;
  border-bottom: none; position: relative; top: 2px;
}
.win-tab-active { font-weight: bold; top: 0; padding-bottom: 6px; z-index: 2; }
.win-tabpanel { border: 2px solid; border-color: #fff var(--dark) var(--dark) #fff; background: var(--face); padding: 10px; }

.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.field-row > label { width: 110px; text-align: right; flex-shrink: 0; }

.sidebar-link { display: flex; align-items: center; gap: 8px; padding: 4px 10px; cursor: pointer; text-decoration: none; color: #000; }
.sidebar-link:hover { background: var(--title-a); color: #fff; }
.sidebar-link-active { background: var(--title-a); color: #fff; }

.statusbar-cell { border: 1px solid; border-color: var(--dark) #fff #fff var(--dark); padding: 2px 10px; }

::-webkit-scrollbar { width: 16px; height: 16px; }
::-webkit-scrollbar-track { background: repeating-conic-gradient(#fff 0% 25%, var(--face) 0% 50%) 0 0/4px 4px; }
::-webkit-scrollbar-thumb { background: var(--face); border: 2px solid; border-color: #fff var(--dark) var(--dark) #fff; }
```

- [ ] **Step 3: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal OS",
  description: "A retro personal operating system for tasks, goals, habits and journals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Create `components/Sidebar.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", icon: "🖥️", label: "Dashboard" },
  { href: "/tasks", icon: "📋", label: "Tasks" },
  { href: "/goals", icon: "🎯", label: "Goals" },
  { href: "/projects", icon: "📁", label: "Projects" },
  { href: "/journal", icon: "📓", label: "Journal" },
  { href: "/habits", icon: "✅", label: "Habits" },
  { href: "/calendar", icon: "📅", label: "Calendar" },
  { href: "/notes", icon: "🗒️", label: "Notes" },
  { href: "/reading", icon: "📚", label: "Reading" },
  { href: "/vision", icon: "🌄", label: "Vision Board" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <nav className="win-window w-52 flex-shrink-0 flex flex-col">
      <div className="win-titlebar">🗂️ Personal OS</div>
      <div className="py-2 flex-1 overflow-y-auto">
        {links.map((l) => (
          <Link key={l.href} href={l.href}
            className={`sidebar-link ${path === l.href ? "sidebar-link-active" : ""}`}>
            <span>{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Create `components/StatusBar.tsx` (static for now; live stats wired in Task 15)**

```tsx
"use client";
import { useEffect, useState } from "react";

export default function StatusBar() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleString(undefined, {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <footer className="bevel-out flex gap-1 p-1 text-xs">
      <div className="statusbar-cell flex-1">Ready.</div>
      <div className="statusbar-cell" id="statusbar-stats" />
      <div className="statusbar-cell">{now}</div>
    </footer>
  );
}
```

- [ ] **Step 6: Create `app/(app)/layout.tsx` and placeholder `app/(app)/page.tsx`; delete scaffold's `app/page.tsx`**

`app/(app)/layout.tsx`:

```tsx
import Sidebar from "@/components/Sidebar";
import StatusBar from "@/components/StatusBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col gap-1 p-1">
      <div className="flex flex-1 gap-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
      </div>
      <StatusBar />
    </div>
  );
}
```

`app/(app)/page.tsx` (placeholder, replaced in Task 15):

```tsx
export default function Dashboard() {
  return (
    <div className="win-window">
      <div className="win-titlebar">🖥️ Dashboard</div>
      <div className="win-body">Welcome to Personal OS.</div>
    </div>
  );
}
```

Also run: `rm app/page.tsx` (the scaffold homepage conflicts with `(app)/page.tsx` route).

- [ ] **Step 7: Create `.env.local.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
NEXT_PUBLIC_ALLOW_SIGNUP=true
```

- [ ] **Step 8: Verify dev server renders shell**

Run: `npm run dev` (background), open http://localhost:3000.
Expected: gray retro shell — sidebar with 11 links, status bar with clock, dashboard placeholder window. Stop server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with retro Win95 design system and shell"
```

---

### Task 2: Supabase schema migration + row types

**Files:**
- Create: `supabase/migrations/001_init.sql`, `lib/types.ts`

**Interfaces:**
- Produces: all 12 tables with RLS; TypeScript row types `Task, Goal, Category, Project, Habit, HabitEntry, JournalEntry, JournalQuestion, Note, Book, FieldDefinition, VisionItem` exactly as defined below — every later task imports from `@/lib/types`.

- [ ] **Step 1: Write `supabase/migrations/001_init.sql`**

```sql
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
```

- [ ] **Step 2: Write `lib/types.ts`**

```ts
export type TaskStatus = "open" | "in_progress" | "done";
export type GoalStatus = "not_started" | "in_progress" | "done";
export type HorizonType = "date" | "month" | "quarter" | "year";
export type JournalType = "daily" | "weekly";
export type CustomFields = Record<string, string | number | null>;

export interface Task {
  id: string; title: string; description: string | null; due_date: string | null;
  priority: number; status: TaskStatus; completed_at: string | null;
  project_id: string | null; custom_fields: CustomFields; created_at: string;
}
export interface Category { id: string; name: string; color: string; }
export interface Project {
  id: string; name: string; description: string | null; color: string;
  status: "active" | "paused" | "completed" | "archived"; target_date: string | null;
}
export interface Goal {
  id: string; title: string; description: string | null;
  horizon_type: HorizonType; horizon_value: string; category_id: string | null;
  status: GoalStatus; custom_fields: CustomFields; created_at: string;
}
export interface Habit { id: string; name: string; icon: string; active: boolean; sort_order: number; }
export interface HabitEntry { id: string; habit_id: string; date: string; checked: boolean; }
export interface JournalQuestion {
  id: string; prompt: string; journal_type: JournalType; sort_order: number; active: boolean;
}
export interface JournalEntry {
  id: string; date: string; type: JournalType;
  answers: Record<string, string>; notes: string; day_rating: number | null;
}
export interface Note { id: string; title: string | null; body: string; pinned: boolean; created_at: string; }
export interface Book {
  id: string; title: string; author: string | null;
  status: "to_read" | "reading" | "finished"; rating: number | null;
  takeaways: string | null; link: string | null;
  started_at: string | null; finished_at: string | null; sort_order: number;
}
export interface FieldDefinition {
  id: string; entity: "task" | "goal"; name: string;
  field_type: "text" | "number" | "date" | "select";
  options: string[] | null; sort_order: number;
}
export interface VisionItem {
  id: string; item_type: "note" | "image" | "goal" | "list";
  content: { text?: string; color?: string; url?: string; caption?: string; goal_id?: string; title?: string; items?: string[] };
  pos_x: number; pos_y: number; rotation: number; z_index: number;
}
```

- [ ] **Step 3: Apply the migration to Supabase**

Human setup (one-time, coordinate with user if project not yet created): create a Supabase project at https://supabase.com/dashboard, then paste `001_init.sql` into SQL Editor and run it. Alternatively with CLI: `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`.
Expected: "Success. No rows returned". Record URL + anon key into `.env.local` (copied from `.env.local.example`).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/ lib/types.ts
git commit -m "feat: add Supabase schema with RLS and row types"
```

---

### Task 3: Auth — Supabase clients, middleware, login page

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`, `app/login/page.tsx`
- Modify: `package.json` (deps)

**Interfaces:**
- Produces: `createClient()` from `@/lib/supabase/client` (browser, used by every page), `createServerSupabase()` from `@/lib/supabase/server`, route protection for everything except `/login`.

- [ ] **Step 1: Install dependencies**

Run: `npm install @supabase/supabase-js @supabase/ssr`
Expected: added to `package.json`.

- [ ] **Step 2: Create `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Create `lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );
}
```

- [ ] **Step 4: Create `middleware.ts` at repo root**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 5: Create `app/login/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const allowSignup = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";
  const supabase = createClient();

  async function signIn() {
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else { router.push("/"); router.refresh(); }
  }
  async function signUp() {
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else setError("Account created. If email confirmation is on, confirm then sign in.");
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="win-window w-96">
        <div className="win-titlebar">🔐 Log On to Personal OS</div>
        <div className="win-body">
          <p className="mb-3">Type your email and password to log on.</p>
          <div className="field-row"><label>Email:</label>
            <input className="win-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field-row"><label>Password:</label>
            <input className="win-input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()} /></div>
          {error && <p className="mb-2 text-[--red]">{error}</p>}
          <div className="flex justify-end gap-2">
            {allowSignup && <button className="win-btn" disabled={busy} onClick={signUp}>Create Account</button>}
            <button className="win-btn win-btn-primary" disabled={busy} onClick={signIn}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify auth flow**

Run: `npm run dev`. Visit http://localhost:3000 → expect redirect to `/login`. Create the account (signup flag true), sign in → expect shell. (Tip: in Supabase dashboard → Auth → Providers → Email, disable "Confirm email" for instant login.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Supabase auth with login page and route protection"
```

---
### Task 4: Core logic library (TDD): dates, streaks, horizons

**Files:**
- Create: `lib/dates.ts`, `lib/streaks.ts`, `lib/horizons.ts`, `tests/dates.test.ts`, `tests/streaks.test.ts`, `tests/horizons.test.ts`, `vitest.config.ts`
- Modify: `package.json` (test script)

**Interfaces:**
- Produces (exact signatures used by later tasks):
  - `dates.ts`: `toISO(d: Date): string`, `todayISO(): string`, `addDays(iso: string, n: number): string`, `weekStart(iso: string): string` (Monday), `weekDates(iso: string): string[]` (7 ISO dates Mon–Sun), `weekRange(iso): {start,end}`, `monthRange(iso): {start,end}`, `monthGridDates(iso: string): string[]` (42 dates, Mon-start grid), `isoWeekLabel(iso: string): string` (e.g. `"Week 29, 2026"`), `fmt(iso: string): string` (e.g. `"Sat, Jul 19"`)
  - `streaks.ts`: `interface StreakStats { current: number; best: number; completionPct: number }`, `computeStreaks(checkedDates: string[], todayIso: string): StreakStats` (completionPct = % of last 30 days checked, rounded)
  - `horizons.ts`: `currentValues(todayIso: string): { month: string; quarter: string; year: string }`, `horizonLabel(type: HorizonType, value: string): string`, `groupGoals<T extends {horizon_type: HorizonType; horizon_value: string}>(goals: T[]): { date: T[]; month: T[]; quarter: T[]; year: T[] }` (each sorted ascending by value), `isCurrent(type: HorizonType, value: string, todayIso: string): boolean`, `isPast(type: HorizonType, value: string, todayIso: string): boolean`

- [ ] **Step 1: Install vitest and add script**

Run: `npm install -D vitest`
In `package.json` scripts add: `"test": "vitest run"`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 2: Write failing tests `tests/dates.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { toISO, addDays, weekStart, weekDates, weekRange, monthRange, monthGridDates, isoWeekLabel, fmt } from "@/lib/dates";

describe("dates", () => {
  it("toISO formats local date", () => {
    expect(toISO(new Date(2026, 6, 19))).toBe("2026-07-19");
  });
  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
  });
  it("weekStart returns Monday (2026-07-19 is a Sunday)", () => {
    expect(weekStart("2026-07-19")).toBe("2026-07-13");
    expect(weekStart("2026-07-13")).toBe("2026-07-13");
  });
  it("weekDates returns Mon..Sun", () => {
    const w = weekDates("2026-07-19");
    expect(w).toHaveLength(7);
    expect(w[0]).toBe("2026-07-13");
    expect(w[6]).toBe("2026-07-19");
  });
  it("weekRange and monthRange", () => {
    expect(weekRange("2026-07-19")).toEqual({ start: "2026-07-13", end: "2026-07-19" });
    expect(monthRange("2026-07-19")).toEqual({ start: "2026-07-01", end: "2026-07-31" });
  });
  it("monthGridDates covers July 2026 in 42 cells starting Mon Jun 29", () => {
    const g = monthGridDates("2026-07-19");
    expect(g).toHaveLength(42);
    expect(g[0]).toBe("2026-06-29");
    expect(g[41]).toBe("2026-08-09");
  });
  it("isoWeekLabel", () => {
    expect(isoWeekLabel("2026-07-19")).toBe("Week 29, 2026");
  });
  it("fmt", () => {
    expect(fmt("2026-07-19")).toBe("Sun, Jul 19");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/dates.test.ts`
Expected: FAIL — cannot resolve `@/lib/dates`.

- [ ] **Step 4: Implement `lib/dates.ts`**

```ts
export function toISO(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function todayISO(): string { return toISO(new Date()); }
export function addDays(iso: string, n: number): string {
  const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d);
}
export function weekStart(iso: string): string {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  return addDays(iso, -dow);
}
export function weekDates(iso: string): string[] {
  const start = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
export function weekRange(iso: string): { start: string; end: string } {
  const start = weekStart(iso);
  return { start, end: addDays(start, 6) };
}
export function monthRange(iso: string): { start: string; end: string } {
  const d = fromISO(iso);
  return {
    start: toISO(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}
export function monthGridDates(iso: string): string[] {
  const first = monthRange(iso).start;
  const gridStart = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}
export function isoWeekLabel(iso: string): string {
  const d = fromISO(weekStart(iso));
  d.setDate(d.getDate() + 3); // Thursday determines ISO week-year
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `Week ${week}, ${d.getFullYear()}`;
}
export function fmt(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
```

- [ ] **Step 5: Run dates tests — expect PASS**

Run: `npx vitest run tests/dates.test.ts` — all green. If `isoWeekLabel` disagrees, fix implementation (2026-07-19 is ISO week 29).

- [ ] **Step 6: Write failing tests `tests/streaks.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { computeStreaks } from "@/lib/streaks";

describe("computeStreaks", () => {
  it("empty entries → zeros", () => {
    expect(computeStreaks([], "2026-07-19")).toEqual({ current: 0, best: 0, completionPct: 0 });
  });
  it("streak including today", () => {
    const s = computeStreaks(["2026-07-17", "2026-07-18", "2026-07-19"], "2026-07-19");
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });
  it("today unchecked keeps yesterday-anchored streak alive", () => {
    const s = computeStreaks(["2026-07-17", "2026-07-18"], "2026-07-19");
    expect(s.current).toBe(2);
  });
  it("gap breaks current but best remembers", () => {
    const s = computeStreaks(["2026-07-13", "2026-07-14", "2026-07-15"], "2026-07-19");
    expect(s.current).toBe(0);
    expect(s.best).toBe(3);
  });
  it("completionPct over last 30 days", () => {
    const dates = ["2026-07-19", "2026-07-18", "2026-07-17"]; // 3 of 30
    expect(computeStreaks(dates, "2026-07-19").completionPct).toBe(10);
  });
});
```

- [ ] **Step 7: Run to verify fail, then implement `lib/streaks.ts`**

Run: `npx vitest run tests/streaks.test.ts` → FAIL (module not found).

```ts
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
```

- [ ] **Step 8: Run streaks tests — expect PASS**

Run: `npx vitest run tests/streaks.test.ts`

- [ ] **Step 9: Write failing tests `tests/horizons.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { currentValues, horizonLabel, groupGoals, isCurrent, isPast } from "@/lib/horizons";

describe("horizons", () => {
  it("currentValues for 2026-07-19", () => {
    expect(currentValues("2026-07-19")).toEqual({ month: "2026-07", quarter: "2026-Q3", year: "2026" });
  });
  it("labels", () => {
    expect(horizonLabel("date", "2026-07-19")).toBe("Sun, Jul 19");
    expect(horizonLabel("month", "2026-07")).toBe("July 2026");
    expect(horizonLabel("quarter", "2026-Q3")).toBe("Q3 2026");
    expect(horizonLabel("year", "2026")).toBe("2026");
  });
  it("groups and sorts", () => {
    const gs = [
      { horizon_type: "year" as const, horizon_value: "2027" },
      { horizon_type: "month" as const, horizon_value: "2026-08" },
      { horizon_type: "month" as const, horizon_value: "2026-07" },
    ];
    const g = groupGoals(gs);
    expect(g.month.map((x) => x.horizon_value)).toEqual(["2026-07", "2026-08"]);
    expect(g.year).toHaveLength(1);
    expect(g.date).toHaveLength(0);
  });
  it("isCurrent / isPast", () => {
    expect(isCurrent("month", "2026-07", "2026-07-19")).toBe(true);
    expect(isPast("month", "2026-06", "2026-07-19")).toBe(true);
    expect(isPast("date", "2026-07-18", "2026-07-19")).toBe(true);
    expect(isPast("quarter", "2026-Q3", "2026-07-19")).toBe(false);
    expect(isPast("year", "2027", "2026-07-19")).toBe(false);
  });
});
```

- [ ] **Step 10: Run to verify fail, then implement `lib/horizons.ts`**

```ts
import type { HorizonType } from "./types";
import { fmt } from "./dates";

export function currentValues(todayIso: string): { month: string; quarter: string; year: string } {
  const [y, m] = todayIso.split("-").map(Number);
  return { month: `${y}-${String(m).padStart(2, "0")}`, quarter: `${y}-Q${Math.ceil(m / 3)}`, year: `${y}` };
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function horizonLabel(type: HorizonType, value: string): string {
  if (type === "date") return fmt(value);
  if (type === "month") { const [y, m] = value.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; }
  if (type === "quarter") { const [y, q] = value.split("-"); return `${q} ${y}`; }
  return value;
}

export function groupGoals<T extends { horizon_type: HorizonType; horizon_value: string }>(
  goals: T[]
): { date: T[]; month: T[]; quarter: T[]; year: T[] } {
  const out = { date: [] as T[], month: [] as T[], quarter: [] as T[], year: [] as T[] };
  for (const g of goals) out[g.horizon_type].push(g);
  for (const k of Object.keys(out) as (keyof typeof out)[])
    out[k].sort((a, b) => a.horizon_value.localeCompare(b.horizon_value));
  return out;
}

export function isCurrent(type: HorizonType, value: string, todayIso: string): boolean {
  const cur = currentValues(todayIso);
  if (type === "date") return value === todayIso;
  return value === cur[type];
}

export function isPast(type: HorizonType, value: string, todayIso: string): boolean {
  const cur = currentValues(todayIso);
  if (type === "date") return value < todayIso;
  return value < cur[type];
}
```

- [ ] **Step 11: Run full suite — expect all PASS**

Run: `npx vitest run`
Expected: 3 files, all tests pass.

- [ ] **Step 12: Commit**

```bash
git add lib/ tests/ vitest.config.ts package.json package-lock.json
git commit -m "feat: add date, streak and horizon logic with tests"
```

---

### Task 5: Retro UI primitives + toast

**Files:**
- Create: `components/win/index.tsx`, `components/win/toast.tsx`
- Modify: `app/(app)/layout.tsx` (mount `<Toaster/>`)

**Interfaces:**
- Produces:
  - `<Window title icon actions? children>` — titled retro window panel
  - `<Btn primary? …buttonProps>` , `<Input …>`, `<Select options …>`, `<TextArea …>`, `<Check checked onChange label?>`
  - `<TabBar tabs={{key,label}[]} active onSelect>`
  - `<Dialog title open onClose children>` — modal
  - `showToast(msg: string)` from `@/components/win/toast`; `<Toaster/>` mounted once in app layout

- [ ] **Step 1: Create `components/win/index.tsx`**

```tsx
"use client";
import React from "react";

export function Window({ title, icon, actions, children, className = "" }: {
  title: string; icon?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`win-window ${className}`}>
      <div className="win-titlebar">
        <span>{icon ? `${icon} ` : ""}{title}</span>
        {actions && <span className="flex gap-1">{actions}</span>}
      </div>
      <div className="win-body">{children}</div>
    </div>
  );
}

export function Btn({ primary, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button className={`win-btn ${primary ? "win-btn-primary" : ""} ${className}`} {...props} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="win-input" {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="win-textarea" rows={3} {...props} />;
}

export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
}) {
  return (
    <select className="win-select" {...props}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input type="checkbox" className="h-4 w-4 accent-[#000080]" checked={checked}
        onChange={(e) => onChange(e.target.checked)} />
      {label && <span>{label}</span>}
    </label>
  );
}

export function TabBar({ tabs, active, onSelect }: {
  tabs: { key: string; label: string }[]; active: string; onSelect: (k: string) => void;
}) {
  return (
    <div className="win-tabbar">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onSelect(t.key)}
          className={`win-tab ${active === t.key ? "win-tab-active" : ""}`}>{t.label}</button>
      ))}
    </div>
  );
}

export function Dialog({ title, open, onClose, children }: {
  title: string; open: boolean; onClose: () => void; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onMouseDown={onClose}>
      <div className="win-window w-[420px] max-w-[92vw]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="win-titlebar">
          <span>{title}</span>
          <button className="win-btn px-2 py-0 text-xs leading-none" onClick={onClose}>✕</button>
        </div>
        <div className="win-body max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/win/toast.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";

let push: ((msg: string) => void) | null = null;
export function showToast(msg: string) { push?.(msg); }

export function Toaster() {
  const [msgs, setMsgs] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    push = (msg) => {
      const id = Date.now() + Math.random();
      setMsgs((m) => [...m, { id, msg }]);
      setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 4000);
    };
    return () => { push = null; };
  }, []);
  return (
    <div className="fixed bottom-10 right-3 z-[100] flex flex-col gap-2">
      {msgs.map((m) => (
        <div key={m.id} className="win-window w-72">
          <div className="win-titlebar">⚠️ Personal OS</div>
          <div className="win-body text-xs">{m.msg}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Mount Toaster in `app/(app)/layout.tsx`**

Add import `import { Toaster } from "@/components/win/toast";` and render `<Toaster />` as last child of the outer `<div>`.

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit` → no errors. `npm run dev` still renders shell.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add retro UI primitives and toast system"
```

---

### Task 6: Tasks module (+ CustomFieldsEditor)

**Files:**
- Create: `components/CustomFieldsEditor.tsx`, `app/(app)/tasks/page.tsx`

**Interfaces:**
- Consumes: `createClient`, types, `todayISO/weekRange/monthRange` from Task 4, primitives from Task 5.
- Produces: `<CustomFieldsEditor entity values onChange>` with props `{ entity: "task" | "goal"; values: CustomFields; onChange: (v: CustomFields) => void }` (loads `field_definitions` itself) — reused by Goals (Task 7) and Projects (Task 8).

- [ ] **Step 1: Create `components/CustomFieldsEditor.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomFields, FieldDefinition } from "@/lib/types";
import { Input, Select } from "@/components/win";

export default function CustomFieldsEditor({ entity, values, onChange }: {
  entity: "task" | "goal"; values: CustomFields; onChange: (v: CustomFields) => void;
}) {
  const [defs, setDefs] = useState<FieldDefinition[]>([]);
  useEffect(() => {
    createClient().from("field_definitions").select("*").eq("entity", entity)
      .order("sort_order").then(({ data }) => setDefs((data as FieldDefinition[]) ?? []));
  }, [entity]);
  if (defs.length === 0) return null;
  const set = (id: string, v: string) => onChange({ ...values, [id]: v === "" ? null : v });
  return (
    <>
      {defs.map((d) => (
        <div className="field-row" key={d.id}>
          <label>{d.name}:</label>
          {d.field_type === "select" ? (
            <Select value={(values[d.id] as string) ?? ""} onChange={(e) => set(d.id, e.target.value)}
              options={[{ value: "", label: "—" }, ...(d.options ?? []).map((o) => ({ value: o, label: o }))]} />
          ) : (
            <Input type={d.field_type === "number" ? "number" : d.field_type === "date" ? "date" : "text"}
              value={(values[d.id] as string) ?? ""} onChange={(e) => set(d.id, e.target.value)} />
          )}
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Create `app/(app)/tasks/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomFields, Task } from "@/lib/types";
import { todayISO, weekRange, monthRange, fmt } from "@/lib/dates";
import { Btn, Input, Select, TabBar, Dialog, Check, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";
import CustomFieldsEditor from "@/components/CustomFieldsEditor";

const TABS = [
  { key: "today", label: "Today" }, { key: "week", label: "This Week" },
  { key: "month", label: "This Month" }, { key: "all", label: "All" }, { key: "done", label: "Done" },
];
const PRIORITY_OPTS = [
  { value: "1", label: "P1" }, { value: "2", label: "P2" }, { value: "3", label: "P3" },
];
function priorityClass(p: number) {
  return p === 1 ? "text-[#aa0000] font-bold" : p === 3 ? "text-[#666666]" : "";
}

export default function TasksPage() {
  const supabase = createClient();
  const [tab, setTab] = useState("today");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(todayISO());
  const [priority, setPriority] = useState("2");
  const [detail, setDetail] = useState<Task | null>(null);
  const today = todayISO();

  const load = useCallback(async () => {
    let q = supabase.from("tasks").select("*").is("project_id", null)
      .order("due_date", { ascending: true, nullsFirst: false }).order("priority");
    if (tab === "done") q = q.eq("status", "done");
    else {
      q = q.neq("status", "done");
      if (tab === "today") q = q.lte("due_date", today);
      if (tab === "week") q = q.lte("due_date", weekRange(today).end);
      if (tab === "month") q = q.lte("due_date", monthRange(today).end);
    }
    const { data, error } = await q;
    if (error) showToast(error.message);
    else setTasks(data as Task[]);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function addTask() {
    if (!title.trim()) return;
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(), due_date: due || null, priority: Number(priority),
    });
    if (error) return showToast(error.message);
    setTitle("");
    load();
  }
  async function toggleDone(t: Task) {
    const done = t.status !== "done";
    setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, status: done ? "done" : "open" } : x));
    const { error } = await supabase.from("tasks").update({
      status: done ? "done" : "open", completed_at: done ? new Date().toISOString() : null,
    }).eq("id", t.id);
    if (error) { showToast(error.message); load(); } else load();
  }
  async function saveDetail() {
    if (!detail) return;
    const { error } = await supabase.from("tasks").update({
      title: detail.title, description: detail.description, due_date: detail.due_date || null,
      priority: detail.priority, status: detail.status, custom_fields: detail.custom_fields,
    }).eq("id", detail.id);
    if (error) return showToast(error.message);
    setDetail(null); load();
  }
  async function removeTask(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return showToast(error.message);
    setDetail(null); load();
  }

  return (
    <div>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      <div className="win-tabpanel">
        <div className="mb-3 flex gap-2">
          <Input placeholder="New task title…" value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()} />
          <input type="date" className="win-input w-40" value={due} onChange={(e) => setDue(e.target.value)} />
          <Select className="w-20" value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITY_OPTS} />
          <Btn primary onClick={addTask}>Add</Btn>
        </div>
        <div className="bevel-in bg-white">
          {tasks.length === 0 && <p className="p-4 text-[#666]">No tasks here. Add one above. ▲</p>}
          {tasks.map((t) => {
            const overdue = t.status !== "done" && t.due_date && t.due_date < today;
            return (
              <div key={t.id} className="flex items-center gap-2 border-b border-[#ddd] px-2 py-1 hover:bg-[#eef]">
                <Check checked={t.status === "done"} onChange={() => toggleDone(t)} />
                <button className="flex-1 text-left" onClick={() => setDetail({ ...t })}>
                  <span className={t.status === "done" ? "line-through text-[#666]" : ""}>{t.title}</span>
                </button>
                <span className={priorityClass(t.priority)}>P{t.priority}</span>
                <span className={`w-24 text-right text-xs ${overdue ? "text-[#aa0000] font-bold" : "text-[#444]"}`}>
                  {t.due_date ? fmt(t.due_date) : "—"}{overdue ? " !" : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog title="Task Properties" open={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <div className="field-row"><label>Title:</label>
              <Input value={detail.title} onChange={(e) => setDetail({ ...detail, title: e.target.value })} /></div>
            <div className="field-row"><label>Due date:</label>
              <input type="date" className="win-input" value={detail.due_date ?? ""}
                onChange={(e) => setDetail({ ...detail, due_date: e.target.value || null })} /></div>
            <div className="field-row"><label>Priority:</label>
              <Select value={String(detail.priority)} options={PRIORITY_OPTS}
                onChange={(e) => setDetail({ ...detail, priority: Number(e.target.value) })} /></div>
            <div className="field-row"><label>Status:</label>
              <Select value={detail.status} options={[
                { value: "open", label: "Open" }, { value: "in_progress", label: "In Progress" }, { value: "done", label: "Done" },
              ]} onChange={(e) => setDetail({ ...detail, status: e.target.value as Task["status"] })} /></div>
            <div className="field-row"><label>Description:</label>
              <TextArea value={detail.description ?? ""}
                onChange={(e) => setDetail({ ...detail, description: e.target.value })} /></div>
            <CustomFieldsEditor entity="task" values={detail.custom_fields}
              onChange={(custom_fields: CustomFields) => setDetail({ ...detail, custom_fields })} />
            <div className="mt-3 flex justify-between">
              <Btn onClick={() => removeTask(detail.id)}>Delete</Btn>
              <span className="flex gap-2">
                <Btn onClick={() => setDetail(null)}>Cancel</Btn>
                <Btn primary onClick={saveDetail}>OK</Btn>
              </span>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
```

Note: `PRIORITY_OPTS`/`priorityClass` are defined locally here; Task 8 moves them to `lib/taskUi.ts` for reuse by the Projects page.

- [ ] **Step 3: Manual verification**

`npm run dev` → /tasks: add tasks with today/future/past due dates; switch tabs (Today shows due ≤ today; overdue red with `!`); check off a task (moves to Done tab); open detail, edit fields, save; delete. Custom fields section is empty until Task 16 creates definitions — that's expected.

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: add tasks module with tabbed views and custom fields editor"
```

---

### Task 7: Goals module

**Files:**
- Create: `app/(app)/goals/page.tsx`

**Interfaces:**
- Consumes: `groupGoals`, `horizonLabel`, `isCurrent`, `isPast`, `currentValues` (Task 4); `CustomFieldsEditor` (Task 6); primitives (Task 5).

- [ ] **Step 1: Create `app/(app)/goals/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, CustomFields, Goal, GoalStatus, HorizonType } from "@/lib/types";
import { todayISO } from "@/lib/dates";
import { currentValues, groupGoals, horizonLabel, isCurrent, isPast } from "@/lib/horizons";
import { Window, Btn, Input, Select, Dialog, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";
import CustomFieldsEditor from "@/components/CustomFieldsEditor";

const STATUS_OPTS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];
const SECTIONS: { key: "date" | "month" | "quarter" | "year"; title: string }[] = [
  { key: "date", title: "📅 Dated Goals" }, { key: "month", title: "🗓️ Monthly Goals" },
  { key: "quarter", title: "🧭 Quarterly Goals" }, { key: "year", title: "🏆 Yearly Goals" },
];
const emptyDraft = (today: string): Partial<Goal> => ({
  title: "", description: "", horizon_type: "month",
  horizon_value: currentValues(today).month, category_id: null,
  status: "not_started", custom_fields: {},
});

export default function GoalsPage() {
  const supabase = createClient();
  const today = todayISO();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Goal> | null>(null);

  const load = useCallback(async () => {
    const [g, c] = await Promise.all([
      supabase.from("goals").select("*").order("created_at"),
      supabase.from("categories").select("*").order("name"),
    ]);
    if (g.error) showToast(g.error.message); else setGoals(g.data as Goal[]);
    if (!c.error) setCats(c.data as Category[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  function defaultValueFor(type: HorizonType): string {
    const cur = currentValues(today);
    return type === "date" ? today : cur[type as "month" | "quarter" | "year"];
  }
  async function save() {
    if (!draft?.title?.trim()) return;
    const row = {
      title: draft.title.trim(), description: draft.description || null,
      horizon_type: draft.horizon_type, horizon_value: draft.horizon_value,
      category_id: draft.category_id, status: draft.status, custom_fields: draft.custom_fields ?? {},
    };
    const { error } = draft.id
      ? await supabase.from("goals").update(row).eq("id", draft.id)
      : await supabase.from("goals").insert(row);
    if (error) return showToast(error.message);
    setDraft(null); load();
  }
  async function cycleStatus(g: Goal) {
    const next: GoalStatus = g.status === "not_started" ? "in_progress" : g.status === "in_progress" ? "done" : "not_started";
    const { error } = await supabase.from("goals").update({ status: next }).eq("id", g.id);
    if (error) showToast(error.message); else load();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) return showToast(error.message);
    setDraft(null); load();
  }

  const visible = filter ? goals.filter((g) => g.category_id === filter) : goals;
  const grouped = groupGoals(visible);
  const statusIcon = (s: GoalStatus) => (s === "done" ? "✅" : s === "in_progress" ? "🔵" : "⚪");

  return (
    <div className="flex flex-col gap-2">
      <Window title="Goals" icon="🎯" actions={<Btn onClick={() => setDraft(emptyDraft(today))}>New Goal</Btn>}>
        <div className="flex flex-wrap gap-1">
          <Btn className={!filter ? "win-btn-primary" : ""} onClick={() => setFilter(null)}>All</Btn>
          {cats.map((c) => (
            <Btn key={c.id} className={filter === c.id ? "win-btn-primary" : ""}
              style={{ borderLeft: `6px solid ${c.color}` }} onClick={() => setFilter(c.id)}>{c.name}</Btn>
          ))}
        </div>
      </Window>

      {SECTIONS.map(({ key, title }) => (
        <Window key={key} title={title}>
          {grouped[key].length === 0 && <p className="text-[#666]">Nothing here yet.</p>}
          {grouped[key].map((g) => {
            const cat = cats.find((c) => c.id === g.category_id);
            const past = g.status !== "done" && isPast(g.horizon_type, g.horizon_value, today);
            const cur = isCurrent(g.horizon_type, g.horizon_value, today);
            return (
              <div key={g.id} className={`mb-1 flex items-center gap-2 bevel-in px-2 py-1 ${cur ? "bg-[#ffffe1]" : "bg-white"}`}>
                <button title="Cycle status" onClick={() => cycleStatus(g)}>{statusIcon(g.status)}</button>
                <button className="flex-1 text-left" onClick={() => setDraft({ ...g })}>
                  <span className={g.status === "done" ? "line-through text-[#666]" : ""}>{g.title}</span>
                </button>
                {cat && <span className="px-2 text-xs" style={{ background: cat.color, color: "#fff" }}>{cat.name}</span>}
                <span className={`text-xs ${past ? "font-bold text-[#aa0000]" : "text-[#444]"}`}>
                  {horizonLabel(g.horizon_type, g.horizon_value)}{past ? " !" : ""}
                </span>
              </div>
            );
          })}
        </Window>
      ))}

      <Dialog title="Goal Properties" open={!!draft} onClose={() => setDraft(null)}>
        {draft && (
          <>
            <div className="field-row"><label>Title:</label>
              <Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="field-row"><label>Horizon:</label>
              <Select value={draft.horizon_type} options={[
                { value: "date", label: "Specific date" }, { value: "month", label: "Month" },
                { value: "quarter", label: "Quarter" }, { value: "year", label: "Year" },
              ]} onChange={(e) => {
                const t = e.target.value as HorizonType;
                setDraft({ ...draft, horizon_type: t, horizon_value: defaultValueFor(t) });
              }} /></div>
            <div className="field-row"><label>When:</label>
              {draft.horizon_type === "date" ? (
                <input type="date" className="win-input" value={draft.horizon_value}
                  onChange={(e) => setDraft({ ...draft, horizon_value: e.target.value })} />
              ) : draft.horizon_type === "month" ? (
                <input type="month" className="win-input" value={draft.horizon_value}
                  onChange={(e) => setDraft({ ...draft, horizon_value: e.target.value })} />
              ) : draft.horizon_type === "quarter" ? (
                <Input value={draft.horizon_value} placeholder="2026-Q3"
                  onChange={(e) => setDraft({ ...draft, horizon_value: e.target.value })} />
              ) : (
                <Input value={draft.horizon_value} placeholder="2026"
                  onChange={(e) => setDraft({ ...draft, horizon_value: e.target.value })} />
              )}</div>
            <div className="field-row"><label>Category:</label>
              <Select value={draft.category_id ?? ""} options={[
                { value: "", label: "— none —" }, ...cats.map((c) => ({ value: c.id, label: c.name })),
              ]} onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })} /></div>
            <div className="field-row"><label>Status:</label>
              <Select value={draft.status} options={STATUS_OPTS}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as GoalStatus })} /></div>
            <div className="field-row"><label>Description:</label>
              <TextArea value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <CustomFieldsEditor entity="goal" values={draft.custom_fields ?? {}}
              onChange={(custom_fields: CustomFields) => setDraft({ ...draft, custom_fields })} />
            <div className="mt-3 flex justify-between">
              {draft.id ? <Btn onClick={() => remove(draft.id!)}>Delete</Btn> : <span />}
              <span className="flex gap-2">
                <Btn onClick={() => setDraft(null)}>Cancel</Btn>
                <Btn primary onClick={save}>OK</Btn>
              </span>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
```

Quarter/year inputs are free text validated by shape: on save, if `horizon_type === "quarter"` and value doesn't match `/^\d{4}-Q[1-4]$/`, or `year` and not `/^\d{4}$/`, call `showToast("Use format 2026-Q3 / 2026")` and return without saving — add this guard at the top of `save()`:

```ts
if (draft.horizon_type === "quarter" && !/^\d{4}-Q[1-4]$/.test(draft.horizon_value ?? "")) return showToast("Quarter format: 2026-Q3");
if (draft.horizon_type === "year" && !/^\d{4}$/.test(draft.horizon_value ?? "")) return showToast("Year format: 2026");
```

- [ ] **Step 2: Manual verification**

/goals: create goals for each horizon type; current-period goals highlighted pale yellow; past-period non-done goals red; cycle status by clicking the icon; category filter buttons appear once categories exist (Task 16 — or insert one via Supabase table editor to verify now).

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: add goals module with horizon grouping and category filters"
```

---
### Task 8: Projects module

**Files:**
- Create: `lib/taskUi.ts` (move `PRIORITY_OPTS` + `priorityClass` here; update the Tasks page import), `app/(app)/projects/page.tsx`

**Interfaces:**
- Consumes: types, `createClient`, primitives, `CustomFieldsEditor`, `fmt`.
- Produces: `lib/taskUi.ts` exporting `PRIORITY_OPTS: {value,label}[]` and `priorityClass(p: number): string`. The page persists its selected sub-tab in querystring `?tab=` (`board|all|calendar`) — Task 9 adds the calendar tab content.

- [ ] **Step 1: Create `lib/taskUi.ts` and refactor Tasks page to import it**

```ts
export const PRIORITY_OPTS = [
  { value: "1", label: "P1" }, { value: "2", label: "P2" }, { value: "3", label: "P3" },
];
export function priorityClass(p: number) {
  return p === 1 ? "text-[#aa0000] font-bold" : p === 3 ? "text-[#666666]" : "";
}
```

In `app/(app)/tasks/page.tsx`: delete the local `PRIORITY_OPTS`/`priorityClass` definitions and add `import { PRIORITY_OPTS, priorityClass } from "@/lib/taskUi";`.

- [ ] **Step 2: Create `app/(app)/projects/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomFields, Project, Task } from "@/lib/types";
import { fmt, todayISO } from "@/lib/dates";
import { PRIORITY_OPTS, priorityClass } from "@/lib/taskUi";
import { Window, Btn, Input, Select, TabBar, Dialog, Check, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";
import CustomFieldsEditor from "@/components/CustomFieldsEditor";

const STATUS_LABEL: Record<Task["status"], string> = { open: "Open", in_progress: "In Progress", done: "Done" };

export default function ProjectsPage() {
  const supabase = createClient();
  const today = todayISO();
  const [tab, setTab] = useState("board");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"project" | "due" | "status">("project");
  const [newTitle, setNewTitle] = useState("");
  const [projDraft, setProjDraft] = useState<Partial<Project> | null>(null);
  const [detail, setDetail] = useState<Task | null>(null);

  const load = useCallback(async () => {
    const [p, t] = await Promise.all([
      supabase.from("projects").select("*").neq("status", "archived").order("created_at"),
      supabase.from("tasks").select("*").not("project_id", "is", null)
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);
    if (p.error) return showToast(p.error.message);
    setProjects(p.data as Project[]);
    if (!t.error) setTasks(t.data as Task[]);
    setSelected((s) => s ?? (p.data as Project[])[0]?.id ?? null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function saveProject() {
    if (!projDraft?.name?.trim()) return;
    const row = {
      name: projDraft.name.trim(), description: projDraft.description || null,
      color: projDraft.color ?? "#000080", status: projDraft.status ?? "active",
      target_date: projDraft.target_date || null,
    };
    const { error } = projDraft.id
      ? await supabase.from("projects").update(row).eq("id", projDraft.id)
      : await supabase.from("projects").insert(row);
    if (error) return showToast(error.message);
    setProjDraft(null); load();
  }
  async function addTask() {
    if (!newTitle.trim() || !selected) return;
    const { error } = await supabase.from("tasks").insert({ title: newTitle.trim(), project_id: selected });
    if (error) return showToast(error.message);
    setNewTitle(""); load();
  }
  async function toggleDone(t: Task) {
    const done = t.status !== "done";
    const { error } = await supabase.from("tasks").update({
      status: done ? "done" : "open", completed_at: done ? new Date().toISOString() : null,
    }).eq("id", t.id);
    if (error) showToast(error.message); else load();
  }
  async function saveDetail() {
    if (!detail) return;
    const { error } = await supabase.from("tasks").update({
      title: detail.title, description: detail.description, due_date: detail.due_date || null,
      priority: detail.priority, status: detail.status, custom_fields: detail.custom_fields,
      project_id: detail.project_id,
    }).eq("id", detail.id);
    if (error) return showToast(error.message);
    setDetail(null); load();
  }
  async function removeTask(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    setDetail(null); load();
  }

  const proj = projects.find((p) => p.id === selected) ?? null;
  const projTasks = tasks.filter((t) => t.project_id === selected);
  const doneCount = (pid: string) => tasks.filter((t) => t.project_id === pid && t.status === "done").length;
  const totalCount = (pid: string) => tasks.filter((t) => t.project_id === pid).length;

  const groups = useMemo(() => {
    const open = tasks;
    if (groupBy === "project")
      return projects.map((p) => ({ label: `📁 ${p.name}`, color: p.color, items: open.filter((t) => t.project_id === p.id) }));
    if (groupBy === "status")
      return (["open", "in_progress", "done"] as const).map((s) => ({
        label: STATUS_LABEL[s], color: undefined, items: open.filter((t) => t.status === s) }));
    const dates = [...new Set(open.map((t) => t.due_date ?? "No due date"))].sort();
    return dates.map((d) => ({
      label: d === "No due date" ? d : fmt(d), color: undefined,
      items: open.filter((t) => (t.due_date ?? "No due date") === d) }));
  }, [tasks, projects, groupBy]);

  const row = (t: Task) => {
    const overdue = t.status !== "done" && t.due_date && t.due_date < today;
    const p = projects.find((x) => x.id === t.project_id);
    return (
      <div key={t.id} className="flex items-center gap-2 border-b border-[#ddd] px-2 py-1 hover:bg-[#eef]">
        <Check checked={t.status === "done"} onChange={() => toggleDone(t)} />
        <button className="flex-1 text-left" onClick={() => setDetail({ ...t })}>
          <span className={t.status === "done" ? "line-through text-[#666]" : ""}>{t.title}</span>
        </button>
        {t.status === "in_progress" && <span className="text-xs">🔵</span>}
        {p && <span className="px-1 text-xs text-white" style={{ background: p.color }}>{p.name}</span>}
        <span className={priorityClass(t.priority)}>P{t.priority}</span>
        <span className={`w-24 text-right text-xs ${overdue ? "font-bold text-[#aa0000]" : "text-[#444]"}`}>
          {t.due_date ? fmt(t.due_date) : "—"}
        </span>
      </div>
    );
  };

  return (
    <div>
      <TabBar active={tab} onSelect={setTab} tabs={[
        { key: "board", label: "Projects" }, { key: "all", label: "All Tasks" }, { key: "calendar", label: "Calendar" },
      ]} />
      <div className="win-tabpanel">
        {tab === "board" && (
          <div className="flex gap-2">
            <div className="w-60 flex-shrink-0">
              <Btn className="mb-2 w-full" onClick={() => setProjDraft({ name: "", color: "#000080", status: "active" })}>
                ➕ New Project
              </Btn>
              {projects.map((p) => (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className={`mb-1 block w-full bevel-out px-2 py-1 text-left ${selected === p.id ? "outline outline-1 outline-black" : ""}`}
                  style={{ borderLeft: `6px solid ${p.color}` }}>
                  <div className="font-bold">{p.name} {p.status !== "active" && <span className="text-xs">({p.status})</span>}</div>
                  <div className="text-xs text-[#444]">{doneCount(p.id)}/{totalCount(p.id)} tasks done
                    {p.target_date ? ` · 🎯 ${fmt(p.target_date)}` : ""}</div>
                </button>
              ))}
              {projects.length === 0 && <p className="text-[#666]">No projects yet.</p>}
            </div>
            <div className="min-w-0 flex-1">
              {proj ? (
                <Window title={proj.name} icon="📁"
                  actions={<Btn onClick={() => setProjDraft({ ...proj })}>Properties</Btn>}>
                  {proj.description && <p className="mb-2 text-[#444]">{proj.description}</p>}
                  <div className="mb-2 flex gap-2">
                    <Input placeholder="New task in this project…" value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTask()} />
                    <Btn primary onClick={addTask}>Add</Btn>
                  </div>
                  <div className="bevel-in bg-white">
                    {projTasks.length === 0 && <p className="p-3 text-[#666]">No tasks in this project.</p>}
                    {projTasks.map(row)}
                  </div>
                </Window>
              ) : <p className="text-[#666]">Create a project to get started.</p>}
            </div>
          </div>
        )}

        {tab === "all" && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <label>Group by:</label>
              <Select className="w-40" value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
                options={[{ value: "project", label: "Project" }, { value: "due", label: "Due date" }, { value: "status", label: "Status" }]} />
            </div>
            {groups.map((g) => (
              <div key={g.label} className="mb-3">
                <div className="win-titlebar" style={g.color ? { background: g.color } : undefined}>{g.label} ({g.items.length})</div>
                <div className="bevel-in bg-white">{g.items.length ? g.items.map(row) : <p className="p-2 text-[#666]">—</p>}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "calendar" && <p className="text-[#666]">Calendar arrives with Task 9.</p>}
      </div>

      <Dialog title="Project Properties" open={!!projDraft} onClose={() => setProjDraft(null)}>
        {projDraft && (
          <>
            <div className="field-row"><label>Name:</label>
              <Input value={projDraft.name ?? ""} onChange={(e) => setProjDraft({ ...projDraft, name: e.target.value })} /></div>
            <div className="field-row"><label>Color:</label>
              <input type="color" className="win-input h-8 w-16 p-0" value={projDraft.color ?? "#000080"}
                onChange={(e) => setProjDraft({ ...projDraft, color: e.target.value })} /></div>
            <div className="field-row"><label>Status:</label>
              <Select value={projDraft.status ?? "active"} options={[
                { value: "active", label: "Active" }, { value: "paused", label: "Paused" },
                { value: "completed", label: "Completed" }, { value: "archived", label: "Archived" },
              ]} onChange={(e) => setProjDraft({ ...projDraft, status: e.target.value as Project["status"] })} /></div>
            <div className="field-row"><label>Target date:</label>
              <input type="date" className="win-input" value={projDraft.target_date ?? ""}
                onChange={(e) => setProjDraft({ ...projDraft, target_date: e.target.value || null })} /></div>
            <div className="field-row"><label>Description:</label>
              <TextArea value={projDraft.description ?? ""}
                onChange={(e) => setProjDraft({ ...projDraft, description: e.target.value })} /></div>
            <div className="mt-3 flex justify-end gap-2">
              <Btn onClick={() => setProjDraft(null)}>Cancel</Btn>
              <Btn primary onClick={saveProject}>OK</Btn>
            </div>
          </>
        )}
      </Dialog>

      <Dialog title="Task Properties" open={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <div className="field-row"><label>Title:</label>
              <Input value={detail.title} onChange={(e) => setDetail({ ...detail, title: e.target.value })} /></div>
            <div className="field-row"><label>Project:</label>
              <Select value={detail.project_id ?? ""} options={projects.map((p) => ({ value: p.id, label: p.name }))}
                onChange={(e) => setDetail({ ...detail, project_id: e.target.value })} /></div>
            <div className="field-row"><label>Due date:</label>
              <input type="date" className="win-input" value={detail.due_date ?? ""}
                onChange={(e) => setDetail({ ...detail, due_date: e.target.value || null })} /></div>
            <div className="field-row"><label>Priority:</label>
              <Select value={String(detail.priority)} options={PRIORITY_OPTS}
                onChange={(e) => setDetail({ ...detail, priority: Number(e.target.value) })} /></div>
            <div className="field-row"><label>Status:</label>
              <Select value={detail.status} options={[
                { value: "open", label: "Open" }, { value: "in_progress", label: "In Progress" }, { value: "done", label: "Done" },
              ]} onChange={(e) => setDetail({ ...detail, status: e.target.value as Task["status"] })} /></div>
            <div className="field-row"><label>Description:</label>
              <TextArea value={detail.description ?? ""}
                onChange={(e) => setDetail({ ...detail, description: e.target.value })} /></div>
            <CustomFieldsEditor entity="task" values={detail.custom_fields}
              onChange={(custom_fields: CustomFields) => setDetail({ ...detail, custom_fields })} />
            <div className="mt-3 flex justify-between">
              <Btn onClick={() => removeTask(detail.id)}>Delete</Btn>
              <span className="flex gap-2">
                <Btn onClick={() => setDetail(null)}>Cancel</Btn>
                <Btn primary onClick={saveDetail}>OK</Btn>
              </span>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

/projects: create two projects with different colors; add tasks with/without due dates; verify progress counts; All Tasks tab groups by Project / Due date / Status; verify these tasks do NOT appear on /tasks (separate worlds).

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: add projects module with grouped task views"
```

---

### Task 9: Shared CalendarGrid + main Calendar page + project calendar tab

**Files:**
- Create: `components/CalendarGrid.tsx`, `app/(app)/calendar/page.tsx`
- Modify: `app/(app)/projects/page.tsx` (replace calendar-tab placeholder)

**Interfaces:**
- Produces: `CalendarGrid` component:

```ts
export interface CalItem { id: string; date: string; label: string; color?: string; done?: boolean; }
// props:
{ mode: "month" | "week"; anchor: string; items: CalItem[];
  banners?: { label: string; color?: string }[];
  onDayClick?: (date: string) => void; }
```

- [ ] **Step 1: Create `components/CalendarGrid.tsx`**

```tsx
"use client";
import { fromISO, monthGridDates, todayISO, weekDates } from "@/lib/dates";

export interface CalItem { id: string; date: string; label: string; color?: string; done?: boolean; }

export default function CalendarGrid({ mode, anchor, items, banners = [], onDayClick }: {
  mode: "month" | "week"; anchor: string; items: CalItem[];
  banners?: { label: string; color?: string }[]; onDayClick?: (date: string) => void;
}) {
  const today = todayISO();
  const dates = mode === "month" ? monthGridDates(anchor) : weekDates(anchor);
  const anchorMonth = anchor.slice(0, 7);
  const byDate = new Map<string, CalItem[]>();
  for (const it of items) {
    if (!byDate.has(it.date)) byDate.set(it.date, []);
    byDate.get(it.date)!.push(it);
  }
  return (
    <div>
      {banners.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {banners.map((b, i) => (
            <span key={i} className="bevel-out px-2 py-0.5 text-xs"
              style={b.color ? { borderLeft: `6px solid ${b.color}` } : undefined}>🎯 {b.label}</span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-7 gap-px bevel-in bg-[#808080] p-px">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
          <div key={d} className="bg-[#c0c0c0] px-1 py-0.5 text-center text-xs font-bold">{d}</div>
        ))}
        {dates.map((d) => {
          const dim = mode === "month" && d.slice(0, 7) !== anchorMonth;
          const isToday = d === today;
          return (
            <div key={d} onClick={() => onDayClick?.(d)}
              className={`min-h-20 cursor-pointer bg-white p-1 align-top hover:bg-[#eef] ${dim ? "opacity-50" : ""}`}>
              <div className={`mb-0.5 text-right text-xs ${isToday ? "inline-block float-right rounded-full bg-[#aa0000] px-1.5 text-white font-bold" : "text-[#444]"}`}>
                {fromISO(d).getDate()}
              </div>
              <div className="clear-both flex flex-col gap-0.5">
                {(byDate.get(d) ?? []).slice(0, 4).map((it) => (
                  <div key={it.id} title={it.label}
                    className={`truncate px-1 text-xs text-white ${it.done ? "line-through opacity-60" : ""}`}
                    style={{ background: it.color ?? "#000080" }}>{it.label}</div>
                ))}
                {(byDate.get(d)?.length ?? 0) > 4 && <div className="text-xs text-[#666]">+{byDate.get(d)!.length - 4} more…</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Note: `fromISO` must be exported from `lib/dates.ts` (it already is per Task 4).

- [ ] **Step 2: Create `app/(app)/calendar/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Goal, Task } from "@/lib/types";
import { addDays, fmt, monthRange, todayISO, weekRange } from "@/lib/dates";
import { horizonLabel } from "@/lib/horizons";
import { Window, Btn, Input } from "@/components/win";
import { showToast } from "@/components/win/toast";
import CalendarGrid, { type CalItem } from "@/components/CalendarGrid";

export default function CalendarPage() {
  const supabase = createClient();
  const [mode, setMode] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(todayISO());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");

  const range = mode === "month" ? monthRange(anchor) : weekRange(anchor);

  const load = useCallback(async () => {
    const [t, g] = await Promise.all([
      supabase.from("tasks").select("*").is("project_id", null)
        .gte("due_date", addDays(range.start, -7)).lte("due_date", addDays(range.end, 7)),
      supabase.from("goals").select("*"),
    ]);
    if (t.error) showToast(t.error.message); else setTasks(t.data as Task[]);
    if (!g.error) setGoals(g.data as Goal[]);
  }, [range.start, range.end]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const items: CalItem[] = useMemo(() => [
    ...tasks.filter((t) => t.due_date).map((t) => ({
      id: t.id, date: t.due_date!, label: t.title, done: t.status === "done",
      color: t.priority === 1 ? "#aa0000" : "#000080",
    })),
    ...goals.filter((g) => g.horizon_type === "date").map((g) => ({
      id: g.id, date: g.horizon_value, label: `🎯 ${g.title}`, done: g.status === "done", color: "#008080",
    })),
  ], [tasks, goals]);

  const banners = useMemo(() => {
    const [y, m] = anchor.split("-").map(Number);
    const month = `${y}-${String(m).padStart(2, "0")}`;
    const quarter = `${y}-Q${Math.ceil(m / 3)}`;
    const year = `${y}`;
    return goals
      .filter((g) => g.status !== "done")
      .filter((g) =>
        (g.horizon_type === "month" && g.horizon_value === month) ||
        (g.horizon_type === "quarter" && g.horizon_value === quarter) ||
        (g.horizon_type === "year" && g.horizon_value === year))
      .map((g) => ({ label: `${g.title} (${horizonLabel(g.horizon_type, g.horizon_value)})`, color: "#008080" }));
  }, [goals, anchor]);

  function move(dir: 1 | -1) {
    if (mode === "week") setAnchor(addDays(anchor, dir * 7));
    else {
      const [y, m] = anchor.split("-").map(Number);
      const d = new Date(y, m - 1 + dir, 1);
      setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    }
  }
  async function quickAdd() {
    if (!quickTitle.trim() || !dayOpen) return;
    const { error } = await supabase.from("tasks").insert({ title: quickTitle.trim(), due_date: dayOpen });
    if (error) return showToast(error.message);
    setQuickTitle(""); load();
  }

  const dayTasks = tasks.filter((t) => t.due_date === dayOpen);
  const monthName = new Date(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <Window title="Calendar" icon="📅" actions={
      <span className="flex gap-1">
        <Btn onClick={() => move(-1)}>◀</Btn>
        <Btn onClick={() => setAnchor(todayISO())}>Today</Btn>
        <Btn onClick={() => move(1)}>▶</Btn>
        <Btn className={mode === "week" ? "win-btn-primary" : ""} onClick={() => setMode("week")}>Week</Btn>
        <Btn className={mode === "month" ? "win-btn-primary" : ""} onClick={() => setMode("month")}>Month</Btn>
      </span>
    }>
      <p className="mb-2 font-bold">{monthName}</p>
      <CalendarGrid mode={mode} anchor={anchor} items={items} banners={banners}
        onDayClick={(d) => setDayOpen(d)} />
      {dayOpen && (
        <div className="mt-2 bevel-out p-2">
          <p className="mb-1 font-bold">{fmt(dayOpen)}</p>
          {dayTasks.length === 0 && <p className="text-[#666]">Nothing due.</p>}
          {dayTasks.map((t) => <p key={t.id}>• {t.title}{t.status === "done" ? " ✔" : ""}</p>)}
          <div className="mt-1 flex gap-2">
            <Input placeholder="Quick add task for this day…" value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && quickAdd()} />
            <Btn primary onClick={quickAdd}>Add</Btn>
          </div>
        </div>
      )}
    </Window>
  );
}
```

- [ ] **Step 3: Wire project calendar tab in `app/(app)/projects/page.tsx`**

Replace `{tab === "calendar" && <p ...>...</p>}` with:

```tsx
{tab === "calendar" && (
  <ProjectCalendar tasks={tasks} projects={projects} />
)}
```

And add at the bottom of the file:

```tsx
function ProjectCalendar({ tasks, projects }: { tasks: Task[]; projects: Project[] }) {
  const [mode, setMode] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(todayISO());
  function move(dir: 1 | -1) {
    if (mode === "week") setAnchor(addDays(anchor, dir * 7));
    else {
      const [y, m] = anchor.split("-").map(Number);
      const d = new Date(y, m - 1 + dir, 1);
      setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    }
  }
  const items = tasks.filter((t) => t.due_date).map((t) => ({
    id: t.id, date: t.due_date!, label: t.title, done: t.status === "done",
    color: projects.find((p) => p.id === t.project_id)?.color ?? "#000080",
  }));
  return (
    <div>
      <div className="mb-2 flex gap-1">
        <Btn onClick={() => move(-1)}>◀</Btn>
        <Btn onClick={() => setAnchor(todayISO())}>Today</Btn>
        <Btn onClick={() => move(1)}>▶</Btn>
        <Btn className={mode === "week" ? "win-btn-primary" : ""} onClick={() => setMode("week")}>Week</Btn>
        <Btn className={mode === "month" ? "win-btn-primary" : ""} onClick={() => setMode("month")}>Month</Btn>
      </div>
      <CalendarGrid mode={mode} anchor={anchor} items={items} />
    </div>
  );
}
```

Add imports to the projects page: `import CalendarGrid from "@/components/CalendarGrid";` and `addDays` from `@/lib/dates`.

- [ ] **Step 4: Manual verification**

/calendar: month grid shows standalone tasks (P1 red) and dated goals (teal 🎯); month/quarter/year goals for the visible period appear as banner chips; week mode; prev/next/Today; click a day → items + quick add. /projects → Calendar tab: project tasks color-coded by project; standalone tasks absent.

- [ ] **Step 5: Run tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: add shared calendar grid, main calendar and project calendar"
```

---

### Task 10: Habits module

**Files:**
- Create: `app/(app)/habits/page.tsx`

**Interfaces:**
- Consumes: `computeStreaks` (Task 4), `weekDates`, types, primitives.

- [ ] **Step 1: Create `app/(app)/habits/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Habit, HabitEntry } from "@/lib/types";
import { addDays, fromISO, todayISO, weekDates } from "@/lib/dates";
import { computeStreaks } from "@/lib/streaks";
import { Window, Btn, Input, Dialog } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function HabitsPage() {
  const supabase = createClient();
  const today = todayISO();
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [manage, setManage] = useState(false);
  const [newName, setNewName] = useState("");
  const days = weekDates(weekAnchor);

  const load = useCallback(async () => {
    const [h, e] = await Promise.all([
      supabase.from("habits").select("*").order("sort_order"),
      supabase.from("habit_entries").select("*").gte("date", addDays(today, -60)),
    ]);
    if (h.error) return showToast(h.error.message);
    setHabits(h.data as Habit[]);
    if (!e.error) setEntries(e.data as HabitEntry[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const isChecked = (habitId: string, date: string) =>
    entries.some((e) => e.habit_id === habitId && e.date === date && e.checked);

  async function toggle(habitId: string, date: string) {
    if (date > today) return;
    const existing = entries.find((e) => e.habit_id === habitId && e.date === date);
    // optimistic
    if (existing) setEntries((es) => es.map((e) => e === existing ? { ...e, checked: !e.checked } : e));
    else setEntries((es) => [...es, { id: "tmp", habit_id: habitId, date, checked: true }]);
    const { error } = existing
      ? await supabase.from("habit_entries").update({ checked: !existing.checked }).eq("id", existing.id)
      : await supabase.from("habit_entries").insert({ habit_id: habitId, date });
    if (error) { showToast(error.message); }
    load();
  }
  async function addHabit() {
    if (!newName.trim()) return;
    const { error } = await supabase.from("habits").insert({
      name: newName.trim(), sort_order: habits.length });
    if (error) return showToast(error.message);
    setNewName(""); load();
  }
  async function renameHabit(h: Habit, name: string) {
    setHabits((hs) => hs.map((x) => x.id === h.id ? { ...x, name } : x));
    await supabase.from("habits").update({ name }).eq("id", h.id);
  }
  async function toggleActive(h: Habit) {
    await supabase.from("habits").update({ active: !h.active }).eq("id", h.id);
    load();
  }
  async function moveHabit(h: Habit, dir: -1 | 1) {
    const act = habits;
    const i = act.findIndex((x) => x.id === h.id);
    const j = i + dir;
    if (j < 0 || j >= act.length) return;
    await Promise.all([
      supabase.from("habits").update({ sort_order: j }).eq("id", act[i].id),
      supabase.from("habits").update({ sort_order: i }).eq("id", act[j].id),
    ]);
    load();
  }

  const active = habits.filter((h) => h.active);
  const statsFor = (h: Habit) =>
    computeStreaks(entries.filter((e) => e.habit_id === h.id && e.checked).map((e) => e.date), today);

  return (
    <div className="flex flex-col gap-2">
      <Window title="Habit Tracker — This Week" icon="✅" actions={
        <span className="flex gap-1">
          <Btn onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>◀</Btn>
          <Btn onClick={() => setWeekAnchor(today)}>This Week</Btn>
          <Btn onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>▶</Btn>
          <Btn onClick={() => setManage(true)}>Manage…</Btn>
        </span>
      }>
        {active.length === 0 ? <p className="text-[#666]">No habits yet — click Manage… to add some.</p> : (
          <table className="w-full border-collapse bg-white bevel-in">
            <thead><tr>
              <th className="border border-[#ccc] px-2 py-1 text-left">Habit</th>
              {days.map((d) => (
                <th key={d} className={`border border-[#ccc] px-1 py-1 text-xs ${d === today ? "bg-[#ffffe1]" : ""}`}>
                  {fromISO(d).toLocaleDateString("en-US", { weekday: "short" })}<br />{fromISO(d).getDate()}
                </th>
              ))}
              <th className="border border-[#ccc] px-2 text-xs">🔥 Streak</th>
              <th className="border border-[#ccc] px-2 text-xs">🏅 Best</th>
              <th className="border border-[#ccc] px-2 text-xs">30d %</th>
            </tr></thead>
            <tbody>
              {active.map((h) => {
                const s = statsFor(h);
                return (
                  <tr key={h.id}>
                    <td className="border border-[#ccc] px-2 py-1">{h.icon} {h.name}</td>
                    {days.map((d) => (
                      <td key={d} className={`border border-[#ccc] text-center ${d === today ? "bg-[#ffffe1]" : ""}`}>
                        <input type="checkbox" className="h-4 w-4 accent-[#000080]"
                          disabled={d > today}
                          checked={isChecked(h.id, d)} onChange={() => toggle(h.id, d)} />
                      </td>
                    ))}
                    <td className="border border-[#ccc] text-center font-bold">{s.current}</td>
                    <td className="border border-[#ccc] text-center">{s.best}</td>
                    <td className="border border-[#ccc] text-center">{s.completionPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Window>

      <Dialog title="Manage Habits" open={manage} onClose={() => setManage(false)}>
        <div className="mb-2 flex gap-2">
          <Input placeholder="New habit name…" value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHabit()} />
          <Btn primary onClick={addHabit}>Add</Btn>
        </div>
        {habits.map((h) => (
          <div key={h.id} className="mb-1 flex items-center gap-2">
            <Input value={h.name} onChange={(e) => renameHabit(h, e.target.value)} />
            <Btn onClick={() => moveHabit(h, -1)}>▲</Btn>
            <Btn onClick={() => moveHabit(h, 1)}>▼</Btn>
            <Btn onClick={() => toggleActive(h)}>{h.active ? "Retire" : "Restore"}</Btn>
          </div>
        ))}
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

/habits: add 3 habits; check boxes across several days (future days disabled); streak/best/30d% update; navigate weeks; rename, reorder, retire/restore.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: add habits module with week grid and streaks"
```

---

### Task 11: Journal module (daily + weekly)

**Files:**
- Create: `lib/journalDefaults.ts`, `app/(app)/journal/page.tsx`

**Interfaces:**
- Produces: `ensureDefaultQuestions(supabase): Promise<void>` — inserts default question sets if the user has none.
- Consumes: `weekStart`, `isoWeekLabel`, `fmt`, `addDays`, types, primitives.

- [ ] **Step 1: Create `lib/journalDefaults.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

const DAILY = ["What went well today?", "What could have gone better?", "What am I grateful for?"];
const WEEKLY = ["What were this week's wins?", "What did I learn this week?", "What's the focus for next week?"];

export async function ensureDefaultQuestions(supabase: SupabaseClient): Promise<void> {
  const { count } = await supabase.from("journal_questions")
    .select("*", { count: "exact", head: true });
  if (count && count > 0) return;
  await supabase.from("journal_questions").insert([
    ...DAILY.map((prompt, i) => ({ prompt, journal_type: "daily", sort_order: i })),
    ...WEEKLY.map((prompt, i) => ({ prompt, journal_type: "weekly", sort_order: i })),
  ]);
}
```

- [ ] **Step 2: Create `app/(app)/journal/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Habit, HabitEntry, JournalEntry, JournalQuestion, JournalType, Task } from "@/lib/types";
import { addDays, fmt, isoWeekLabel, todayISO, weekStart } from "@/lib/dates";
import { ensureDefaultQuestions } from "@/lib/journalDefaults";
import { Window, Btn, TabBar, Check, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function JournalPage() {
  const supabase = createClient();
  const today = todayISO();
  const [type, setType] = useState<JournalType>("daily");
  const [date, setDate] = useState(today); // daily: the day; weekly: Monday of week
  const [questions, setQuestions] = useState<JournalQuestion[]>([]);
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [saving, setSaving] = useState(false);

  const effectiveDate = type === "weekly" ? weekStart(date) : date;

  const load = useCallback(async () => {
    await ensureDefaultQuestions(supabase);
    const [q, h, he, t, e] = await Promise.all([
      supabase.from("journal_questions").select("*").eq("journal_type", type).eq("active", true).order("sort_order"),
      supabase.from("habits").select("*").eq("active", true).order("sort_order"),
      supabase.from("habit_entries").select("*").eq("date", effectiveDate),
      supabase.from("tasks").select("*").is("project_id", null).eq("due_date", effectiveDate).order("priority"),
      supabase.from("journal_entries").select("*").eq("date", effectiveDate).eq("type", type).maybeSingle(),
    ]);
    if (q.error) return showToast(q.error.message);
    setQuestions(q.data as JournalQuestion[]);
    setHabits((h.data as Habit[]) ?? []);
    setHabitEntries((he.data as HabitEntry[]) ?? []);
    setTasks((t.data as Task[]) ?? []);
    if (e.data) setEntry(e.data as JournalEntry);
    else {
      const { data, error } = await supabase.from("journal_entries")
        .insert({ date: effectiveDate, type }).select().single();
      if (error) showToast(error.message); else setEntry(data as JournalEntry);
    }
  }, [type, effectiveDate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setEntry(null); load(); }, [load]);

  async function saveEntry(patch: Partial<JournalEntry>) {
    if (!entry) return;
    const next = { ...entry, ...patch };
    setEntry(next);
    setSaving(true);
    const { error } = await supabase.from("journal_entries").update({
      answers: next.answers, notes: next.notes, day_rating: next.day_rating,
    }).eq("id", entry.id);
    setSaving(false);
    if (error) showToast(error.message);
  }
  async function toggleHabit(habitId: string) {
    const ex = habitEntries.find((e) => e.habit_id === habitId);
    const { error } = ex
      ? await supabase.from("habit_entries").update({ checked: !ex.checked }).eq("id", ex.id)
      : await supabase.from("habit_entries").insert({ habit_id: habitId, date: effectiveDate });
    if (error) showToast(error.message);
    const { data } = await supabase.from("habit_entries").select("*").eq("date", effectiveDate);
    setHabitEntries((data as HabitEntry[]) ?? []);
  }
  async function toggleTask(t: Task) {
    const done = t.status !== "done";
    const { error } = await supabase.from("tasks").update({
      status: done ? "done" : "open", completed_at: done ? new Date().toISOString() : null,
    }).eq("id", t.id);
    if (error) showToast(error.message);
    const { data } = await supabase.from("tasks").select("*").is("project_id", null)
      .eq("due_date", effectiveDate).order("priority");
    setTasks((data as Task[]) ?? []);
  }

  const heading = type === "daily" ? fmt(effectiveDate) : isoWeekLabel(effectiveDate);
  const step = type === "daily" ? 1 : 7;

  return (
    <div>
      <TabBar active={type} onSelect={(k) => setType(k as JournalType)}
        tabs={[{ key: "daily", label: "Daily" }, { key: "weekly", label: "Weekly" }]} />
      <div className="win-tabpanel">
        <div className="mb-2 flex items-center gap-2">
          <Btn onClick={() => setDate(addDays(effectiveDate, -step))}>◀</Btn>
          <span className="min-w-40 text-center font-bold">{heading}</span>
          <Btn onClick={() => setDate(addDays(effectiveDate, step))}>▶</Btn>
          <Btn onClick={() => setDate(today)}>Today</Btn>
          <span className="ml-auto text-xs text-[#666]">{saving ? "Saving…" : "Saved"}</span>
        </div>

        {type === "daily" && (
          <Window title="Daily Habits" icon="✅" className="mb-2">
            {habits.length === 0 && <p className="text-[#666]">No habits configured (see Habits page).</p>}
            <div className="flex flex-wrap gap-4">
              {habits.map((h) => (
                <Check key={h.id} label={`${h.icon} ${h.name}`}
                  checked={habitEntries.some((e) => e.habit_id === h.id && e.checked)}
                  onChange={() => toggleHabit(h.id)} />
              ))}
            </div>
          </Window>
        )}

        {type === "daily" && (
          <Window title="Tasks for this day" icon="📋" className="mb-2">
            {tasks.length === 0 && <p className="text-[#666]">No tasks due this day.</p>}
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-0.5">
                <Check checked={t.status === "done"} onChange={() => toggleTask(t)} />
                <span className={t.status === "done" ? "line-through text-[#666]" : ""}>{t.title}</span>
              </div>
            ))}
          </Window>
        )}

        <Window title="Reflection" icon="💭" className="mb-2">
          {questions.map((q) => (
            <div key={q.id} className="mb-2">
              <p className="mb-1 font-bold">{q.prompt}</p>
              <TextArea value={entry?.answers[q.id] ?? ""}
                onChange={(e) => entry && saveEntry({ answers: { ...entry.answers, [q.id]: e.target.value } })} />
            </div>
          ))}
        </Window>

        <Window title="Notes from the day" icon="🗒️" className="mb-2">
          <TextArea rows={5} value={entry?.notes ?? ""}
            onChange={(e) => entry && saveEntry({ notes: e.target.value })} />
        </Window>

        <Window title={type === "daily" ? "Day rating" : "Week rating"} icon="⭐">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Btn key={n} className={entry?.day_rating === n ? "win-btn-primary" : ""}
                onClick={() => saveEntry({ day_rating: n })}>{"★".repeat(n)}</Btn>
            ))}
          </div>
        </Window>
      </div>
    </div>
  );
}
```

Note on save frequency: `saveEntry` fires per keystroke; that is acceptable for v1 (single user, small rows). If it feels chatty, debounce with a 500 ms `setTimeout` — optional, not required.

- [ ] **Step 3: Manual verification**

/journal: today's template auto-creates (verify row in `journal_entries`); habit checkboxes sync with /habits page for the same date; tasks due today listed and checkable (syncs with /tasks); answers/notes/rating persist across reloads; navigate to yesterday — separate entry; Weekly tab shows week label, weekly questions, no habit/task sections.

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: add daily and weekly journal with auto-created templates"
```

---
### Task 12: Notes module

**Files:**
- Create: `app/(app)/notes/page.tsx`

- [ ] **Step 1: Create `app/(app)/notes/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Note } from "@/lib/types";
import { Window, Btn, Input, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function NotesPage() {
  const supabase = createClient();
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("notes").select("*")
      .order("pinned", { ascending: false }).order("created_at", { ascending: false });
    if (error) showToast(error.message); else setNotes(data as Note[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!body.trim()) return;
    const { error } = await supabase.from("notes").insert({ body: body.trim() });
    if (error) return showToast(error.message);
    setBody(""); load();
  }
  async function togglePin(n: Note) {
    await supabase.from("notes").update({ pinned: !n.pinned }).eq("id", n.id);
    load();
  }
  async function saveEdit() {
    if (!editing) return;
    await supabase.from("notes").update({ body: editing.body, title: editing.title }).eq("id", editing.id);
    setEditing(null); load();
  }
  async function remove(id: string) {
    await supabase.from("notes").delete().eq("id", id);
    setEditing(null); load();
  }

  const visible = notes.filter((n) =>
    !search || (n.body + " " + (n.title ?? "")).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-2">
      <Window title="Quick Capture" icon="🗒️">
        <div className="flex gap-2">
          <Input placeholder="Jot something and press Enter…" value={body}
            onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Btn primary onClick={add}>Add</Btn>
        </div>
      </Window>
      <Window title="Notes" icon="📌" actions={
        <input className="win-input w-48 text-xs" placeholder="Search…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
      }>
        {visible.length === 0 && <p className="text-[#666]">No notes found.</p>}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((n) => (
            <div key={n.id} className={`bevel-out p-2 ${n.pinned ? "bg-[#ffffe1]" : ""}`}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-[#666]">{new Date(n.created_at).toLocaleDateString()}</span>
                <span className="flex gap-1">
                  <Btn className="px-1 py-0 text-xs" onClick={() => togglePin(n)}>{n.pinned ? "📌" : "📍"}</Btn>
                  <Btn className="px-1 py-0 text-xs" onClick={() => setEditing({ ...n })}>✏️</Btn>
                  <Btn className="px-1 py-0 text-xs" onClick={() => remove(n.id)}>🗑️</Btn>
                </span>
              </div>
              {n.title && <p className="font-bold">{n.title}</p>}
              <p className="whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
        </div>
      </Window>
      {editing && (
        <Window title="Edit Note" icon="✏️">
          <div className="field-row"><label>Title:</label>
            <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
          <TextArea rows={4} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
          <div className="mt-2 flex justify-end gap-2">
            <Btn onClick={() => setEditing(null)}>Cancel</Btn>
            <Btn primary onClick={saveEdit}>Save</Btn>
          </div>
        </Window>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

/notes: quick-add via Enter; pinned notes sort first with yellow tint; search filters; edit and delete work.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: add quick notes module"
```

---

### Task 13: Reading module

**Files:**
- Create: `app/(app)/reading/page.tsx`

- [ ] **Step 1: Create `app/(app)/reading/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Book } from "@/lib/types";
import { todayISO } from "@/lib/dates";
import { Window, Btn, Input, TabBar, Dialog, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";

const SHELVES = [
  { key: "to_read", label: "📕 To Read" }, { key: "reading", label: "📖 Reading" }, { key: "finished", label: "✅ Finished" },
];

export default function ReadingPage() {
  const supabase = createClient();
  const [shelf, setShelf] = useState("to_read");
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [finishing, setFinishing] = useState<Book | null>(null);
  const [editing, setEditing] = useState<Book | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("books").select("*")
      .order("sort_order").order("created_at", { ascending: false });
    if (error) showToast(error.message); else setBooks(data as Book[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!title.trim()) return;
    const { error } = await supabase.from("books").insert({ title: title.trim(), author: author.trim() || null });
    if (error) return showToast(error.message);
    setTitle(""); setAuthor(""); load();
  }
  async function move(b: Book, status: Book["status"]) {
    if (status === "finished") { setFinishing({ ...b, rating: b.rating ?? 4 }); return; }
    const patch: Partial<Book> = { status };
    if (status === "reading" && !b.started_at) patch.started_at = todayISO();
    await supabase.from("books").update(patch).eq("id", b.id);
    load();
  }
  async function confirmFinish() {
    if (!finishing) return;
    await supabase.from("books").update({
      status: "finished", rating: finishing.rating, takeaways: finishing.takeaways,
      finished_at: todayISO(),
    }).eq("id", finishing.id);
    setFinishing(null); load();
  }
  async function saveEdit() {
    if (!editing) return;
    await supabase.from("books").update({
      title: editing.title, author: editing.author, link: editing.link,
      rating: editing.rating, takeaways: editing.takeaways,
    }).eq("id", editing.id);
    setEditing(null); load();
  }
  async function remove(id: string) {
    await supabase.from("books").delete().eq("id", id);
    setEditing(null); load();
  }

  const visible = books.filter((b) => b.status === shelf);
  const stars = (n: number | null) => n ? "★".repeat(n) + "☆".repeat(5 - n) : "";

  return (
    <div>
      <div className="mb-2">
        <Window title="Add a book" icon="📚">
          <div className="flex gap-2">
            <Input placeholder="Title…" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Author (optional)…" value={author} onChange={(e) => setAuthor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()} />
            <Btn primary onClick={add}>Add</Btn>
          </div>
        </Window>
      </div>
      <TabBar tabs={SHELVES} active={shelf} onSelect={setShelf} />
      <div className="win-tabpanel">
        {visible.length === 0 && <p className="text-[#666]">This shelf is empty.</p>}
        {visible.map((b) => (
          <div key={b.id} className="mb-1 flex items-center gap-2 bevel-in bg-white px-2 py-1">
            <button className="flex-1 text-left" onClick={() => setEditing({ ...b })}>
              <span className="font-bold">{b.title}</span>
              {b.author && <span className="text-[#444]"> — {b.author}</span>}
              {b.status === "finished" && <span className="ml-2 text-[#b8860b]">{stars(b.rating)}</span>}
            </button>
            {b.link && <a className="text-xs text-[#000080] underline" href={b.link} target="_blank">link</a>}
            {b.status !== "to_read" && <Btn className="text-xs" onClick={() => move(b, "to_read")}>To Read</Btn>}
            {b.status !== "reading" && <Btn className="text-xs" onClick={() => move(b, "reading")}>Reading</Btn>}
            {b.status !== "finished" && <Btn className="text-xs" onClick={() => move(b, "finished")}>Finish…</Btn>}
          </div>
        ))}
      </div>

      <Dialog title="Finish Book" open={!!finishing} onClose={() => setFinishing(null)}>
        {finishing && (
          <>
            <p className="mb-2 font-bold">{finishing.title}</p>
            <div className="field-row"><label>Rating:</label>
              <span className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Btn key={n} className={finishing.rating === n ? "win-btn-primary" : ""}
                    onClick={() => setFinishing({ ...finishing, rating: n })}>{n}★</Btn>
                ))}
              </span></div>
            <div className="field-row"><label>Takeaways:</label>
              <TextArea value={finishing.takeaways ?? ""}
                onChange={(e) => setFinishing({ ...finishing, takeaways: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setFinishing(null)}>Cancel</Btn>
              <Btn primary onClick={confirmFinish}>Finish Book</Btn>
            </div>
          </>
        )}
      </Dialog>

      <Dialog title="Book Properties" open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <>
            <div className="field-row"><label>Title:</label>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            <div className="field-row"><label>Author:</label>
              <Input value={editing.author ?? ""} onChange={(e) => setEditing({ ...editing, author: e.target.value })} /></div>
            <div className="field-row"><label>Link:</label>
              <Input value={editing.link ?? ""} onChange={(e) => setEditing({ ...editing, link: e.target.value })} /></div>
            {editing.status === "finished" && (
              <>
                <div className="field-row"><label>Rating:</label>
                  <span className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Btn key={n} className={editing.rating === n ? "win-btn-primary" : ""}
                        onClick={() => setEditing({ ...editing, rating: n })}>{n}★</Btn>
                    ))}
                  </span></div>
                <div className="field-row"><label>Takeaways:</label>
                  <TextArea value={editing.takeaways ?? ""}
                    onChange={(e) => setEditing({ ...editing, takeaways: e.target.value })} /></div>
              </>
            )}
            <div className="mt-3 flex justify-between">
              <Btn onClick={() => remove(editing.id)}>Delete</Btn>
              <span className="flex gap-2">
                <Btn onClick={() => setEditing(null)}>Cancel</Btn>
                <Btn primary onClick={saveEdit}>OK</Btn>
              </span>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

/reading: add books; move To Read → Reading (sets started_at) → Finish… (rating + takeaways dialog, sets finished_at); finished shelf shows stars; edit and delete.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: add reading list module with shelves and ratings"
```

---

### Task 14: Vision Board

**Files:**
- Create: `app/(app)/vision/page.tsx`

**Interfaces:**
- Consumes: `VisionItem`, `Goal` types; primitives. Goal cards join live `goals` rows by `content.goal_id`.

- [ ] **Step 1: Create `app/(app)/vision/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Goal, VisionItem } from "@/lib/types";
import { horizonLabel } from "@/lib/horizons";
import { Btn, Dialog, Input, Select, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";

const NOTE_COLORS = ["#ffffe1", "#e1ffe1", "#e1f0ff", "#ffe1f0", "#fff0d0"];

export default function VisionPage() {
  const supabase = createClient();
  const [items, setItems] = useState<VisionItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [adding, setAdding] = useState<{ x: number; y: number } | null>(null);
  const [kind, setKind] = useState<VisionItem["item_type"]>("note");
  const [text, setText] = useState("");
  const [goalId, setGoalId] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const load = useCallback(async () => {
    const [v, g] = await Promise.all([
      supabase.from("vision_items").select("*").order("z_index"),
      supabase.from("goals").select("*"),
    ]);
    if (v.error) showToast(v.error.message); else setItems(v.data as VisionItem[]);
    if (!g.error) setGoals(g.data as Goal[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  function onPointerDown(e: React.PointerEvent, it: VisionItem) {
    const rect = boardRef.current!.getBoundingClientRect();
    drag.current = { id: it.id, dx: e.clientX - rect.left - it.pos_x, dy: e.clientY - rect.top - it.pos_y };
    const maxZ = Math.max(0, ...items.map((x) => x.z_index)) + 1;
    setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, z_index: maxZ } : x));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const rect = boardRef.current!.getBoundingClientRect();
    const { id, dx, dy } = drag.current;
    const x = Math.max(0, e.clientX - rect.left - dx), y = Math.max(0, e.clientY - rect.top - dy);
    setItems((xs) => xs.map((it) => it.id === id ? { ...it, pos_x: x, pos_y: y } : it));
  }
  async function onPointerUp() {
    if (!drag.current) return;
    const it = items.find((x) => x.id === drag.current!.id);
    drag.current = null;
    if (it) {
      const { error } = await supabase.from("vision_items")
        .update({ pos_x: it.pos_x, pos_y: it.pos_y, z_index: it.z_index }).eq("id", it.id);
      if (error) showToast(error.message);
    }
  }
  function onBoardDoubleClick(e: React.MouseEvent) {
    if (e.target !== boardRef.current) return;
    const rect = boardRef.current!.getBoundingClientRect();
    setKind("note"); setText(""); setGoalId(goals[0]?.id ?? "");
    setAdding({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }
  async function addItem() {
    if (!adding) return;
    const content =
      kind === "note" ? { text, color: NOTE_COLORS[items.length % NOTE_COLORS.length] } :
      kind === "image" ? { url: text, caption: "" } :
      kind === "goal" ? { goal_id: goalId } :
      { title: text || "Non-Negotiables", items: [] as string[] };
    const { error } = await supabase.from("vision_items").insert({
      item_type: kind, content, pos_x: adding.x, pos_y: adding.y,
      rotation: (Math.random() * 6 - 3), z_index: items.length + 1,
    });
    if (error) return showToast(error.message);
    setAdding(null); load();
  }
  async function remove(id: string) {
    await supabase.from("vision_items").delete().eq("id", id);
    load();
  }
  async function updateContent(it: VisionItem, content: VisionItem["content"]) {
    setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, content } : x));
    await supabase.from("vision_items").update({ content }).eq("id", it.id);
  }

  function renderCard(it: VisionItem) {
    const g = it.item_type === "goal" ? goals.find((x) => x.id === it.content.goal_id) : null;
    const pct = g ? (g.status === "done" ? 100 : g.status === "in_progress" ? 50 : 0) : 0;
    return (
      <div key={it.id}
        onPointerDown={(e) => onPointerDown(e, it)} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        className="absolute w-52 cursor-move select-none bevel-out p-2 shadow-md"
        style={{ left: it.pos_x, top: it.pos_y, transform: `rotate(${it.rotation}deg)`, zIndex: it.z_index,
          background: it.item_type === "note" ? it.content.color ?? "#ffffe1" : "#c0c0c0" }}>
        <button className="float-right text-xs" onPointerDown={(e) => e.stopPropagation()}
          onClick={() => remove(it.id)}>✕</button>
        {it.item_type === "note" && <p className="whitespace-pre-wrap">{it.content.text}</p>}
        {it.item_type === "image" && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.content.url} alt={it.content.caption ?? "vision"} className="max-h-40 w-full bevel-in object-cover" />
            {it.content.caption && <p className="mt-1 text-center text-xs">{it.content.caption}</p>}
          </>
        )}
        {it.item_type === "goal" && (g ? (
          <>
            <p className="font-bold">🎯 {g.title}</p>
            <p className="text-xs text-[#444]">{horizonLabel(g.horizon_type, g.horizon_value)}</p>
            <div className="mt-1 bevel-in h-4 bg-white">
              <div className="h-full bg-[#000080]" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-center text-xs">{g.status.replace("_", " ")}</p>
          </>
        ) : <p className="text-xs text-[#aa0000]">Goal deleted — remove this card.</p>)}
        {it.item_type === "list" && (
          <>
            <p className="font-bold">‼️ {it.content.title}</p>
            {(it.content.items ?? []).map((li, i) => (
              <div key={i} className="flex items-center gap-1">
                <span>•</span><span className="flex-1">{li}</span>
                <button className="text-xs" onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => updateContent(it, { ...it.content, items: it.content.items!.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <input className="win-input mt-1 text-xs" placeholder="Add item + Enter"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  updateContent(it, { ...it.content, items: [...(it.content.items ?? []), e.currentTarget.value.trim()] });
                  e.currentTarget.value = "";
                }
              }} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="win-window flex h-full flex-col">
      <div className="win-titlebar">🌄 Vision Board — double-click the board to pin something</div>
      <div ref={boardRef} onDoubleClick={onBoardDoubleClick}
        className="relative flex-1 overflow-auto"
        style={{ background: "repeating-linear-gradient(45deg,#d4b896,#d4b896 12px,#ccb08e 12px,#ccb08e 24px)" }}>
        {items.map(renderCard)}
        {items.length === 0 && (
          <p className="p-6 text-[#5a4a32]">The corkboard is empty. Double-click anywhere to pin your first vision. 📌</p>
        )}
      </div>

      <Dialog title="Pin to Vision Board" open={!!adding} onClose={() => setAdding(null)}>
        <div className="field-row"><label>Type:</label>
          <Select value={kind} options={[
            { value: "note", label: "Sticky note" }, { value: "image", label: "Image (URL)" },
            { value: "goal", label: "Goal card" }, { value: "list", label: "List (e.g. Non-Negotiables)" },
          ]} onChange={(e) => setKind(e.target.value as VisionItem["item_type"])} /></div>
        {kind === "note" && <div className="field-row"><label>Text:</label>
          <TextArea value={text} onChange={(e) => setText(e.target.value)} /></div>}
        {kind === "image" && <div className="field-row"><label>Image URL:</label>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="https://…" /></div>}
        {kind === "list" && <div className="field-row"><label>List title:</label>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Non-Negotiables" /></div>}
        {kind === "goal" && <div className="field-row"><label>Goal:</label>
          <Select value={goalId} options={goals.map((g) => ({ value: g.id, label: g.title }))}
            onChange={(e) => setGoalId(e.target.value)} /></div>}
        <div className="flex justify-end gap-2">
          <Btn onClick={() => setAdding(null)}>Cancel</Btn>
          <Btn primary onClick={addItem}>Pin It</Btn>
        </div>
      </Dialog>
    </div>
  );
}
```

Spec deviation note (intentional, tiny): images are added by URL only in v1; Supabase Storage upload is deferred — record in README "future ideas" if desired.

- [ ] **Step 2: Manual verification**

/vision: double-click board → pin each card type; drag cards (positions persist across reload); goal card shows live status bar — change goal status on /goals, revisit, bar updates; list card add/remove items; delete cards.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: add corkboard vision board with draggable cards"
```

---
### Task 15: Dashboard + live status bar stats

**Files:**
- Modify: `app/(app)/page.tsx` (replace placeholder), `components/StatusBar.tsx`

**Interfaces:**
- Consumes: everything prior. StatusBar fetches its own stats (standalone tasks due today not done; habits checked today / active habits).

- [ ] **Step 1: Replace `app/(app)/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Book, Goal, Habit, HabitEntry, Note, Task } from "@/lib/types";
import { addDays, fmt, todayISO } from "@/lib/dates";
import { computeStreaks } from "@/lib/streaks";
import { currentValues } from "@/lib/horizons";
import { Window, Check } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function Dashboard() {
  const supabase = createClient();
  const today = todayISO();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reading, setReading] = useState<Book[]>([]);

  const load = useCallback(async () => {
    const cur = currentValues(today);
    const [t, h, e, g, n, b] = await Promise.all([
      supabase.from("tasks").select("*").is("project_id", null).neq("status", "done")
        .lte("due_date", today).order("priority"),
      supabase.from("habits").select("*").eq("active", true).order("sort_order"),
      supabase.from("habit_entries").select("*").gte("date", addDays(today, -60)),
      supabase.from("goals").select("*").neq("status", "done"),
      supabase.from("notes").select("*").eq("pinned", true).order("created_at", { ascending: false }).limit(5),
      supabase.from("books").select("*").eq("status", "reading"),
    ]);
    if (t.error) return showToast(t.error.message);
    setTasks(t.data as Task[]);
    setHabits((h.data as Habit[]) ?? []);
    setEntries((e.data as HabitEntry[]) ?? []);
    setGoals(((g.data as Goal[]) ?? []).filter((x) =>
      (x.horizon_type === "date" && x.horizon_value >= today && x.horizon_value <= addDays(today, 14)) ||
      (x.horizon_type === "month" && x.horizon_value === cur.month) ||
      (x.horizon_type === "quarter" && x.horizon_value === cur.quarter)));
    setNotes((n.data as Note[]) ?? []);
    setReading((b.data as Book[]) ?? []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function toggleTask(t: Task) {
    await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", t.id);
    load();
  }
  async function toggleHabit(habitId: string) {
    const ex = entries.find((e) => e.habit_id === habitId && e.date === today);
    if (ex) await supabase.from("habit_entries").update({ checked: !ex.checked }).eq("id", ex.id);
    else await supabase.from("habit_entries").insert({ habit_id: habitId, date: today });
    load();
  }
  const checkedToday = (id: string) => entries.some((e) => e.habit_id === id && e.date === today && e.checked);

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      <Window title={`Today — ${fmt(today)}`} icon="📋">
        {tasks.length === 0 && <p className="text-[#666]">All clear. 🎉</p>}
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-2 py-0.5">
            <Check checked={false} onChange={() => toggleTask(t)} />
            <span className="flex-1">{t.title}</span>
            {t.due_date && t.due_date < today && <span className="text-xs font-bold text-[#aa0000]">overdue!</span>}
          </div>
        ))}
        <Link className="text-xs text-[#000080] underline" href="/tasks">Open Tasks →</Link>
      </Window>

      <Window title="Today's Habits" icon="✅">
        {habits.length === 0 && <p className="text-[#666]">No habits configured.</p>}
        <div className="mb-2 flex flex-wrap gap-3">
          {habits.map((h) => (
            <Check key={h.id} label={`${h.icon} ${h.name}`} checked={checkedToday(h.id)}
              onChange={() => toggleHabit(h.id)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {habits.map((h) => {
            const s = computeStreaks(entries.filter((e) => e.habit_id === h.id && e.checked).map((e) => e.date), today);
            return <span key={h.id} className="bevel-in bg-white px-2 py-0.5 text-xs">{h.icon} 🔥 {s.current}</span>;
          })}
        </div>
        <Link className="text-xs text-[#000080] underline" href="/habits">Open Habits →</Link>
      </Window>

      <Window title="Goals in Focus" icon="🎯">
        {goals.length === 0 && <p className="text-[#666]">No active goals in the current period.</p>}
        {goals.slice(0, 8).map((g) => (
          <p key={g.id} className="py-0.5">{g.status === "in_progress" ? "🔵" : "⚪"} {g.title}</p>
        ))}
        <Link className="text-xs text-[#000080] underline" href="/goals">Open Goals →</Link>
      </Window>

      <div className="flex flex-col gap-2">
        <Window title="Currently Reading" icon="📖">
          {reading.length === 0 ? <p className="text-[#666]">Nothing on the go — visit the Reading shelf.</p> :
            reading.map((b) => <p key={b.id}>📖 <b>{b.title}</b>{b.author ? ` — ${b.author}` : ""}</p>)}
        </Window>
        <Window title="Pinned Notes" icon="📌">
          {notes.length === 0 && <p className="text-[#666]">No pinned notes.</p>}
          {notes.map((n) => <p key={n.id} className="truncate py-0.5">📌 {n.title ?? n.body}</p>)}
        </Window>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire live stats into `components/StatusBar.tsx`**

Replace the file with:

```tsx
"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/dates";

export default function StatusBar() {
  const [now, setNow] = useState("");
  const [stats, setStats] = useState("");
  const path = usePathname();

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleString(undefined, {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const today = todayISO();
    async function loadStats() {
      const [t, h, e] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true })
          .is("project_id", null).neq("status", "done").lte("due_date", today),
        supabase.from("habits").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("habit_entries").select("id", { count: "exact", head: true })
          .eq("date", today).eq("checked", true),
      ]);
      setStats(`${t.count ?? 0} tasks due · ${e.count ?? 0}/${h.count ?? 0} habits done`);
    }
    loadStats();
  }, [path]);

  return (
    <footer className="bevel-out flex gap-1 p-1 text-xs">
      <div className="statusbar-cell flex-1">Ready.</div>
      {stats && <div className="statusbar-cell">{stats}</div>}
      <div className="statusbar-cell">{now}</div>
    </footer>
  );
}
```

(Stats refresh on every route change — good enough for v1; the earlier `id="statusbar-stats"` placeholder div is removed.)

- [ ] **Step 3: Manual verification**

/: all five dashboard windows render with real data; checking a task/habit updates lists and streak chips; status bar shows "N tasks due · X/Y habits done" and updates after navigating away and back.

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: add dashboard overview and live status bar stats"
```

---

### Task 16: Settings module

**Files:**
- Create: `app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `Category`, `JournalQuestion`, `FieldDefinition` types; primitives. Manages rows that CustomFieldsEditor (Task 6), Goals (Task 7) and Journal (Task 11) consume.

- [ ] **Step 1: Create `app/(app)/settings/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category, FieldDefinition, JournalQuestion } from "@/lib/types";
import { Window, Btn, Input, Select } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [cats, setCats] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<JournalQuestion[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [catName, setCatName] = useState(""); const [catColor, setCatColor] = useState("#000080");
  const [qPrompt, setQPrompt] = useState(""); const [qType, setQType] = useState<"daily" | "weekly">("daily");
  const [fName, setFName] = useState(""); const [fEntity, setFEntity] = useState<"task" | "goal">("task");
  const [fType, setFType] = useState<FieldDefinition["field_type"]>("text");
  const [fOptions, setFOptions] = useState("");

  const load = useCallback(async () => {
    const [c, q, f] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("journal_questions").select("*").order("journal_type").order("sort_order"),
      supabase.from("field_definitions").select("*").order("entity").order("sort_order"),
    ]);
    if (c.error) return showToast(c.error.message);
    setCats(c.data as Category[]);
    setQuestions((q.data as JournalQuestion[]) ?? []);
    setFields((f.data as FieldDefinition[]) ?? []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function addCat() {
    if (!catName.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: catName.trim(), color: catColor });
    if (error) return showToast(error.message);
    setCatName(""); load();
  }
  async function delCat(id: string) {
    await supabase.from("categories").delete().eq("id", id);
    load();
  }
  async function addQuestion() {
    if (!qPrompt.trim()) return;
    const n = questions.filter((q) => q.journal_type === qType).length;
    const { error } = await supabase.from("journal_questions").insert({
      prompt: qPrompt.trim(), journal_type: qType, sort_order: n });
    if (error) return showToast(error.message);
    setQPrompt(""); load();
  }
  async function toggleQuestion(q: JournalQuestion) {
    await supabase.from("journal_questions").update({ active: !q.active }).eq("id", q.id);
    load();
  }
  async function delQuestion(id: string) {
    await supabase.from("journal_questions").delete().eq("id", id);
    load();
  }
  async function addField() {
    if (!fName.trim()) return;
    if (fType === "select" && !fOptions.trim()) return showToast("Give comma-separated options for a select field.");
    const n = fields.filter((f) => f.entity === fEntity).length;
    const { error } = await supabase.from("field_definitions").insert({
      entity: fEntity, name: fName.trim(), field_type: fType,
      options: fType === "select" ? fOptions.split(",").map((s) => s.trim()).filter(Boolean) : null,
      sort_order: n,
    });
    if (error) return showToast(error.message);
    setFName(""); setFOptions(""); load();
  }
  async function delField(id: string) {
    await supabase.from("field_definitions").delete().eq("id", id);
    load();
  }
  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login"); router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Window title="Goal Categories" icon="🏷️">
        <div className="mb-2 flex gap-2">
          <Input placeholder="Category name…" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <input type="color" className="win-input h-8 w-14 p-0" value={catColor}
            onChange={(e) => setCatColor(e.target.value)} />
          <Btn primary onClick={addCat}>Add</Btn>
        </div>
        {cats.map((c) => (
          <div key={c.id} className="mb-1 flex items-center gap-2">
            <span className="inline-block h-4 w-4 bevel-in" style={{ background: c.color }} />
            <span className="flex-1">{c.name}</span>
            <Btn className="text-xs" onClick={() => delCat(c.id)}>Delete</Btn>
          </div>
        ))}
      </Window>

      <Window title="Journal Questions" icon="💭">
        <div className="mb-2 flex gap-2">
          <Input placeholder="New reflection question…" value={qPrompt} onChange={(e) => setQPrompt(e.target.value)} />
          <Select className="w-28" value={qType} onChange={(e) => setQType(e.target.value as "daily" | "weekly")}
            options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} />
          <Btn primary onClick={addQuestion}>Add</Btn>
        </div>
        {(["daily", "weekly"] as const).map((jt) => (
          <div key={jt} className="mb-2">
            <p className="font-bold">{jt === "daily" ? "Daily" : "Weekly"}</p>
            {questions.filter((q) => q.journal_type === jt).map((q) => (
              <div key={q.id} className="mb-1 flex items-center gap-2">
                <span className={`flex-1 ${q.active ? "" : "text-[#888] line-through"}`}>{q.prompt}</span>
                <Btn className="text-xs" onClick={() => toggleQuestion(q)}>{q.active ? "Disable" : "Enable"}</Btn>
                <Btn className="text-xs" onClick={() => delQuestion(q.id)}>Delete</Btn>
              </div>
            ))}
          </div>
        ))}
      </Window>

      <Window title="Custom Fields" icon="🧩">
        <div className="mb-2 flex flex-wrap gap-2">
          <Input className="w-40" placeholder="Field name…" value={fName} onChange={(e) => setFName(e.target.value)} />
          <Select className="w-24" value={fEntity} onChange={(e) => setFEntity(e.target.value as "task" | "goal")}
            options={[{ value: "task", label: "Task" }, { value: "goal", label: "Goal" }]} />
          <Select className="w-28" value={fType} onChange={(e) => setFType(e.target.value as FieldDefinition["field_type"])}
            options={[{ value: "text", label: "Text" }, { value: "number", label: "Number" },
              { value: "date", label: "Date" }, { value: "select", label: "Select" }]} />
          {fType === "select" && (
            <Input className="w-56" placeholder="Options, comma-separated" value={fOptions}
              onChange={(e) => setFOptions(e.target.value)} />
          )}
          <Btn primary onClick={addField}>Add</Btn>
        </div>
        {fields.map((f) => (
          <div key={f.id} className="mb-1 flex items-center gap-2">
            <span className="bevel-in bg-white px-1 text-xs">{f.entity}</span>
            <span className="flex-1">{f.name} <span className="text-xs text-[#666]">({f.field_type}
              {f.options ? `: ${f.options.join(", ")}` : ""})</span></span>
            <Btn className="text-xs" onClick={() => delField(f.id)}>Delete</Btn>
          </div>
        ))}
        <p className="mt-1 text-xs text-[#666]">Custom fields appear in Task and Goal property dialogs.</p>
      </Window>

      <Window title="Session" icon="🔐">
        <Btn onClick={signOut}>Log Off Personal OS…</Btn>
      </Window>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

/settings: add categories → visible on /goals (chips + dialog); add a daily question → appears on /journal; disable a question → disappears from journal template (existing answers preserved in jsonb); add task custom field (one select with options) → appears in task dialog on /tasks and /projects; goal custom field → /goals dialog; Log Off returns to login.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run
git add -A
git commit -m "feat: add settings for categories, journal questions and custom fields"
```

---

### Task 17: Deployment + README + production checks

**Files:**
- Create: `README.md`
- Modify: none expected; fix whatever `npm run build` surfaces.

- [ ] **Step 1: Production build locally**

Run: `npm run build`
Expected: build succeeds. Fix any type/lint errors it reports (common: unused imports, `<img>` warnings on vision board — the eslint-disable comment in Task 14 covers it).

- [ ] **Step 2: Write `README.md`**

```markdown
# Personal OS 🖥️

A single-user, retro Windows-95-styled personal operating system for life:
tasks, projects, goals, habits with streaks, daily/weekly journals, calendar,
quick notes, a reading list and a corkboard vision board.

Built with Next.js 15 + Supabase. Spec: `docs/superpowers/specs/2026-07-19-personal-os-design.md`.

## Local development

1. `npm install`
2. Create a Supabase project (free tier) at https://supabase.com
3. In the Supabase SQL Editor, run `supabase/migrations/001_init.sql`
4. (Recommended) Auth → Providers → Email → disable "Confirm email"
5. `cp .env.local.example .env.local` and fill in the project URL + anon key
6. `npm run dev` → http://localhost:3000 → Create Account → sign in

## Deploying to Vercel

1. Push this repo to GitHub
2. Import into Vercel (framework auto-detected: Next.js)
3. Set env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_ALLOW_SIGNUP=true`
4. Deploy, open the URL, create your account, sign in
5. **Lock the door:** set `NEXT_PUBLIC_ALLOW_SIGNUP=false` and redeploy.
   Also disable signups in Supabase: Auth → Sign In / Up → "Allow new users to sign up" → off.

## Tests

`npm test` — unit tests for date, streak and horizon logic.

## v2 ideas

- Boot-splash vision rotation, time-locked letters to future self, screensaver mode
- Image upload to Supabase Storage for vision board (URL-only today)
- Weekly/monthly habit schedules
```

- [ ] **Step 3: Deploy**

With user coordination (Vercel account login):
- Create GitHub repo and push (`gh repo create` or dashboard), import to Vercel, set the three env vars, deploy.
- Verify the public URL: login works, all 11 pages function, RLS blocks anonymous access (open a page in a private window → redirected to /login).
- After the owner account exists: flip `NEXT_PUBLIC_ALLOW_SIGNUP=false` in Vercel env and disable signups in Supabase as per README.

- [ ] **Step 4: Final full check + commit**

```bash
npx vitest run
npm run build
git add -A
git commit -m "docs: add README with setup and deployment guide"
```

---

## Testing note (spec deviation, deliberate)

The spec asks for "light component tests for critical flows". This plan covers the critical *computations* (streaks, horizons, date ranges) with unit tests and covers every UI flow via per-task manual verification plus the acceptance pass below, instead of Supabase-mocked component tests (high setup cost, low added confidence for a single-user app). If component tests are wanted later, add `@testing-library/react` + a mocked Supabase client as a follow-up.

## Post-plan verification (whole-app acceptance pass)

Walk the spec's screen list end-to-end on the deployed URL:

1. Login required everywhere; wrong password rejected with retro error.
2. Tasks: Today/Week/Month/All/Done tabs; overdue red; custom fields save.
3. Goals: four horizon sections; category filter; current-period highlight; past-period red.
4. Projects: separate-worlds check (project tasks absent from Tasks/Calendar/Dashboard/Journal); Group by Project/Due date/Status; project calendar color-coded.
5. Journal daily: habits sync with Habits page; tasks sync with Tasks; answers persist; weekly tab independent.
6. Habits: streak math spot-check (3 consecutive days → streak 3; skip a day → resets).
7. Calendar: month + week; banner goals; quick-add.
8. Notes: capture/pin/search. Reading: shelf flow with rating. Vision: drag persists, goal card live.
9. Settings: every config type round-trips into its consuming module.
```
