# Journal question editing (Settings): edit, add, remove with history preservation

## Problem

The Settings panel's journal question manager (web `JournalQuestionsPanel`, mobile
equivalent) already supports Add, Delete, and Enable/Disable for `journal_questions`
rows, grouped by Daily and Weekly. Two gaps:

1. There is no way to **edit** a question's prompt text — only add a new one or delete
   the old one.
2. **Delete is destructive to history.** The day/week Journal view fetches "active
   questions of this type" with no notion of date, so it applies the *current* set of
   questions uniformly to every entry, past and future. Deleting a question removes it
   (and its already-written answers) from every past entry's display, not just from
   today onward. The same problem would apply to a naive in-place edit: renaming a
   prompt would silently rewrite the text shown on old entries too.

## Goal

Add Edit to the Settings panel (web + mobile), and change Remove so that:

- Editing, adding, or removing a question only affects the day/week view **from today
  onward**.
- Entries dated before today keep showing exactly what they showed before the change.

This does **not** add any question-management UI to the Journal day/week pages
themselves — those keep only displaying whatever questions are live for the date being
viewed, per the user's explicit direction during brainstorming.

## Feasibility of date-scoping

`journal_questions` currently has no timestamp of any kind. To scope changes by date we
need to know when each row started (and, for removed/edited-away rows, stopped)
applying. A migration adds `created_on` and `retired_on` (both plain `date`, matching
the rest of the schema's date-typed columns like `journal_entries.date`).

Existing rows have no real "created" date to recover, so the migration backfills them to
a sentinel date far in the past. This means **date-scoping is only meaningful for
changes made from the day this migration ships forward** — every question that already
exists keeps showing on all historical entries exactly as it does today, and only new
edits/adds/removes after the migration get the "starts/stops on this date" treatment.
This is feasible with no other constraints; it does not require any RLS change since the
existing "own rows" policy already covers new columns.

## Data model change

Migration `supabase/migrations/004_journal_question_history.sql` (web repo — the mobile
repo never adds migrations; its `AGENTS.md` says the Supabase backend is frozen and
owned by the web repo, so this single migration covers both clients):

```sql
alter table public.journal_questions
  add column if not exists created_on date not null default current_date,
  add column if not exists retired_on date;

-- Existing questions have been in effect since before we tracked this — keep them
-- visible on all historical entries rather than only from today.
update public.journal_questions set created_on = '1970-01-01';
```

`JournalQuestion` (both apps' `lib/types.ts`) gains:

```ts
created_on: string;      // ISO date
retired_on: string | null;
```

## Effective-date semantics

A question is **live** for a given entry date `d` of journal type `t` when:

- **Daily:** `created_on <= d` and (`retired_on` is null or `d < retired_on`).
- **Weekly:** `d` is already the Monday of the week being viewed (existing
  `weekStart(date)` convention). The question is live for that week if
  `created_on <= weekEnd(d)` (i.e. it was added on any day within that week or
  earlier) and (`retired_on` is null or `d < retired_on`) — a mid-week retirement
  still leaves the question visible for the week it happened in, but not later weeks.

Both `created_on` and `retired_on` are always set to "today" (never a future date) by
the mutations below, so in practice "retire" and "start showing" always take effect
immediately, and the week-end/week-start comparisons above are what let the *current*
day/week keep or gain a question consistently with "changes apply starting today."

This filtering is a new pure helper, `filterQuestionsForDate(questions, type, date)`,
added to each app's `journalDefaults.ts` (the module that already owns
`ensureDefaultQuestions`). It is applied client-side, after the existing
`.eq("journal_type", t).eq("active", true)` fetch, in:

- Web: `app/(app)/journal/page.tsx`'s `load()`, filtering `q.data` before
  `setQuestions`.
- Mobile: `src/screens/journal/JournalScreen.tsx`, filtering `questions.data` before
  it's passed to `JournalBody`.

The underlying Supabase query is unchanged (`select("*")` already returns the new
columns); no query-key or caching changes are needed since the filter runs after the
existing fetch.

## Settings panel changes

Applies identically to web (`app/(app)/settings/sections/JournalQuestionsPanel.tsx`)
and mobile (`src/screens/settings/panels/JournalQuestionsPanel.tsx` +
`src/data/journal.ts`).

**List query:** add `retired_on is null` to the filter. A retired question disappears
from the management list immediately, the same way a deleted one does today. (Since
`retired_on` is always set to today, never a future date, `is null` is a complete
"currently live" check — no extra date comparison needed here.)

**Add:** unchanged behavior, but the insert now stamps `created_on` explicitly with the
client's local `todayISO()` (not the database's `current_date` default), consistent
with how every other date field in these apps — `habit_entries.date`,
`tasks.due_date` — is client-supplied rather than server-defaulted, avoiding a
day-boundary mismatch between the user's local midnight and the database's clock.

**Edit (new):** the row's prompt becomes an inline text input (mirroring the existing
"add" input) with Save/Cancel. On Save, three sequential calls (no DB transaction,
consistent with this codebase's existing non-transactional multi-step writes like
`ensureDefaultQuestions`):

1. `update journal_questions set retired_on = today where id = oldId`
2. `insert into journal_questions (prompt, journal_type, sort_order, created_on) values (newPrompt, oldType, oldSortOrder, today)` → new id
3. Best-effort answer carry-over: look up today's entry (daily) or the current week's
   entry (weekly) for that journal type. If it exists and has a non-empty answer keyed
   by `oldId`, move that value to the `newId` key (delete the `oldId` key) so the
   in-progress answer doesn't appear to disappear just because the prompt was
   reworded. Step 3 failing does not roll back or error out steps 1–2 — it's a
   convenience, not a correctness requirement, since the raw answer remains intact
   under the old id in the JSON regardless.

**Remove (renamed from Delete):** instead of `DELETE`, `update journal_questions set
retired_on = today where id`. Confirmation copy updates to reflect that past entries
keep the question and its answers, e.g. "Remove this question? It'll disappear from
today onward — past entries keep it." (Mobile's existing confirm text already gestures
at this; both apps get the same wording.)

**Enable/Disable (`active` toggle):** unchanged — an orthogonal, instant, reversible
global on/off, not part of this feature.

## Testing

- Unit tests for `filterQuestionsForDate` covering: pre-migration question (sentinel
  `created_on`) shows on old and new entries; a question added today shows on today's
  entry and this week's but not on an entry from last week; a question retired today
  still shows on today's/this week's entry and on all past entries, but not on
  tomorrow's/next week's.
- Settings panel tests (existing test files per app, e.g. mobile's
  `tests/screens/journal.test.tsx` pattern) covering: edit flow updates the visible
  prompt and the list still shows one row for that slot; remove drops the row from the
  list; add still works with the new `created_on` stamp.
- Manual check: edit a question that already has an answer in today's entry; confirm
  the answer still shows under the reworded prompt afterward.

## Out of scope

- No add/edit/remove UI on the Journal day/week pages themselves.
- No "restore a retired question" UI — re-adding manually covers this rare case.
- No change to the `active` enable/disable toggle.
