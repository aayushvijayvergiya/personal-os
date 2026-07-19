# Personal OS — Design Spec

**Date:** 2026-07-19
**Status:** Approved by user (brainstorming session)

## Overview

A single-user "Personal OS" webapp for tracking tasks, personal projects, goals, habits (with streaks), daily/weekly journals, quick notes, a reading list, a vision board, and a calendar — styled as a light-themed retro Windows 95/2000 application, deployed to a public URL behind a simple login.

Source requirements: `docs/requirements/Requirements.md` plus three Notion "Life OS" reference screenshots.

## Decisions Made

| Question | Decision |
|---|---|
| Data & auth | Hosted DB (Supabase Postgres) + single-user email/password login |
| Configurability | Fixed modules, everything inside user-configurable, **plus custom fields** (text/number/date/select) on tasks and goals |
| Visual style | Retro Win95/2000 light theme (bevels, gray panels, classic chrome) |
| OS metaphor | Retro-**styled pages** with conventional sidebar navigation (no draggable-window desktop) |
| Stack | Next.js 15 (App Router, TypeScript) + Tailwind + Supabase, deployed on Vercel |
| Projects vs tasks | **Separate worlds**: project tasks live only inside the Projects module (own views + own calendar); main Tasks/Calendar/Dashboard/Journal show only standalone tasks |
| Reading list | Dedicated Reading module (not a project): To Read / Reading / Finished shelves |
| Vision board | Corkboard canvas with draggable cards, incl. goal-linked cards with live progress. Boot splash, future-self letters, screensaver deferred to v2 |

## Architecture

- **Frontend:** Next.js 15 App Router, TypeScript, Tailwind CSS with a custom retro design system: beveled 2px light/dark borders, classic gray (`#c0c0c0` family) panels on a light base, title-bar styled cards, MS Sans Serif-style font stack, classic red for overdue/alerts.
- **Navigation:** left sidebar styled like a classic file-explorer tree; persistent bottom **status bar** showing date/time and quick stats ("3 tasks due today · 4/6 habits done").
- **Backend:** Supabase — Postgres + Supabase Auth (email/password). Signup disabled via env flag after the owner account exists.
- **Data access:** Supabase JS client directly from the app; Row-Level Security scopes every row to the authenticated user. No custom API layer.
- **Deployment:** Vercel (app) + Supabase cloud (DB/auth), both free tier. SQL migrations checked into the repo.

## Data Model (Postgres)

All tables carry `user_id` (RLS) and timestamps.

- **tasks** — `title`, `description`, `due_date`, `priority`, `status` (`open|in_progress|done`), `completed_at`, `project_id` (nullable), `custom_fields jsonb`. Rows with `project_id` set are project tasks and are excluded from the main Tasks views, main Calendar, Dashboard, and Journal.
- **projects** — `name`, `description`, `color`, `status` (`active|paused|completed|archived`), `target_date` (nullable)
- **goals** — `title`, `description`, `horizon_type` (`date|month|quarter|year`), `horizon_value` (text: `2026-07-19`, `2026-07`, `2026-Q3`, `2026`), `category_id`, `status` (`not_started|in_progress|done`), `custom_fields jsonb`
- **categories** — goal categories: `name`, `color`
- **habits** — `name`, `icon`, `active`, `sort_order` (daily schedule in v1)
- **habit_entries** — `habit_id`, `date`, `checked` (unique per habit+date). Streaks computed client-side: current streak, best streak, completion %.
- **journal_entries** — `date`, `type` (`daily|weekly`), `answers jsonb` (keyed by question id), `notes`, `day_rating`
- **journal_questions** — `prompt`, `journal_type` (`daily|weekly`), `sort_order`, `active`
- **notes** — `title` (optional), `body`, `pinned`
- **books** — `title`, `author`, `status` (`to_read|reading|finished`), `rating` (1–5, nullable), `takeaways`, `link` (nullable), `started_at`/`finished_at` (nullable dates), `sort_order`
- **vision_items** — `item_type` (`note|image|goal|list`), `content jsonb` (note text + color, image URL + caption, `goal_id`, or list title + items), `pos_x`, `pos_y`, `rotation`, `z_index`
- **field_definitions** — custom fields config: `entity` (`task|goal`), `name`, `field_type` (`text|number|date|select`), `options jsonb` (for select), `sort_order`. Values stored in each row's `custom_fields` jsonb keyed by definition id.

## Screens

1. **Dashboard (home)** — today's tasks, today's habit check-off strip, current streaks, goals due soon, pinned notes, "currently reading" card.
2. **Tasks** — tab strip **Today / This Week / This Month / All / Done**; inline add (title, due date, priority); detail panel for description + custom fields; overdue flagged red.
3. **Goals** — grouped by horizon (This month / This quarter / This year / Dated); category chip filters; add dialog picks horizon type + value; status toggle.
4. **Projects** — left pane listing projects with progress ("4/9 tasks done") and status; selecting a project shows its task list with inline add and detail panel (same fields as tasks, incl. custom fields). An **All Tasks** tab lists every project task with a "Group by:" dropdown — **Project / Due date / Status**. A **Calendar** tab shows a month/week calendar of project tasks only, color-coded by project. Manage projects: create/edit/archive.
5. **Journal** — date navigator; opening a day auto-creates the entry from the template: habit checklist (writes to `habit_entries`), reflection questions, notes area, and that day's tasks (synced with Tasks). **Weekly** tab per ISO week with the weekly question set.
6. **Habits** — streak dashboard: week grid (habits × days with checkboxes), per-habit current/best streak and completion %; manage habits (add/rename/reorder/retire).
7. **Calendar** — month/week toggle; standalone tasks on due dates; dated goals on their day; month/quarter/year goals in a banner strip over the range; click a day for its items; quick-add task on a day.
8. **Notes** — quick capture at top, reverse-chron list, pin/unpin, search.
9. **Reading** — shelf tabs **To Read / Reading / Finished**; add book (title, author, optional link); move between shelves; star rating + takeaways when finished; "currently reading" card on Dashboard.
10. **Vision Board** — freeform corkboard canvas of draggable retro cards: sticky notes (text + color), image cards (URL or upload to Supabase storage), list cards (e.g. "Non-Negotiables"), and **goal cards** — pin any goal and it renders with a live progress/status bar. Positions, rotation, and stacking persist. Double-click empty space to add a card.
11. **Settings** — goal categories, journal question sets (daily/weekly), custom field definitions, habit management.

Plus a login page.

## Cross-Module Behavior

- Habit checkboxes in Journal and Habits pages read/write the same `habit_entries` rows.
- Tasks shown in Journal for a date are the same rows as the Tasks module (checking one completes the task); project tasks are excluded.
- Custom field definitions with `entity = task` apply to both standalone and project tasks (one table).
- Vision Board goal cards read the live goal row (title, status); completing a goal updates its card. Deleting a goal deletes its vision card.
- Journal entries are created lazily on first open of a date, snapshotting nothing — questions render from the active question set; answers persist in `answers` jsonb.

## Error Handling

- Optimistic updates with rollback and a retro-styled alert/toast on failure.
- Auth-guarded routes redirect to login.
- Friendly retro empty states on every module.

## Testing

- Vitest unit tests for pure logic: streak calculation, horizon parsing/grouping, today/week/month task filtering, journal template assembly.
- Light component tests for critical flows (add task, check habit, journal save).
- No e2e suite in v1.

## Out of Scope (v1)

- Multi-user support, sharing
- Weekly/monthly habit schedules (daily only)
- Drag-and-drop calendar rescheduling
- Full desktop-window metaphor
- Offline support
- Vision board extras: boot-splash vision rotation, time-locked letters to future self, screensaver mode
