# Journal Question Editing (Settings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Settings panel's journal-question manager (web + mobile) edit a question's prompt text and remove a question, without rewriting what already-past journal entries show.

**Architecture:** Add `created_on`/`retired_on` date columns to `journal_questions` via one migration in the web repo (the mobile repo never adds migrations — both apps share this Supabase backend). Add a small pure helper, `filterQuestionsForDate`, to each app's own `journalDefaults.ts`, used only by the Journal day/week page's question fetch so a question only appears on entries dated within its `[created_on, retired_on)` window. The Settings panel in each app gets an always-editable "commit on blur" prompt field (mirroring the existing habit-rename pattern) and changes its delete button to a soft "Remove" that sets `retired_on` instead of deleting the row. Editing is modeled as retire-old + insert-new (never an in-place rename), because rewriting the `prompt` column in place would silently rewrite history on every past entry that references that row.

**Tech Stack:** Next.js + Supabase (web, Vitest); Expo/React Native + TanStack Query + Supabase (mobile, Jest + React Native Testing Library).

**Spec:** `docs/superpowers/specs/2026-09-20-journal-question-editing-design.md`

## Global Constraints

- Migrations live only in the web repo, under `supabase/migrations/NNN_description.sql`; the mobile repo's `AGENTS.md` says its Supabase backend is frozen and owned by the web repo.
- `created_on`/`retired_on` are plain `date` columns (not `timestamptz`), matching `journal_entries.date` and every other date-typed column in this schema.
- Every date value the client writes to these columns is the app's own local `todayISO()` (or `weekStart(todayISO())`), never a bare database default — this matches how `habit_entries.date` and `tasks.due_date` are already written, and avoids a day-boundary mismatch between the user's local midnight and the database server's clock.
- Never hard-delete a `journal_questions` row and never update its `prompt` column in place. "Remove" sets `retired_on = today`. "Edit" retires the old row and inserts a new one with the new prompt.
- This feature is Settings-panel-only. Do not add question-management UI to the Journal day/week pages (`app/(app)/journal/page.tsx`, `src/screens/journal/*`) — they only gain the date-window *read* filter.
- No RLS changes — the existing `"own rows"` policy already covers new columns on an existing table.

---

## Task 1: Migration + web `JournalQuestion` type

**Files:**
- Create: `supabase/migrations/004_journal_question_history.sql`
- Modify: `lib/types.ts:24-26`

**Interfaces:**
- Produces: `journal_questions.created_on date not null default current_date`, `journal_questions.retired_on date` (nullable) on the shared Supabase schema; `JournalQuestion.created_on: string` and `JournalQuestion.retired_on: string | null` in the web app's type.

- [ ] **Step 1: Write the migration**

```sql
-- Journal questions now track when each row started and stopped applying, so editing or
-- removing a question in Settings only changes the day/week view from today onward instead
-- of rewriting what past entries show.

alter table public.journal_questions
  add column if not exists created_on date not null default current_date,
  add column if not exists retired_on date;

-- Existing questions have been in effect since before we tracked this — keep them visible
-- on all historical entries rather than only from the day this migration runs.
update public.journal_questions set created_on = '1970-01-01';
```

- [ ] **Step 2: Apply the migration**

Run the contents of `supabase/migrations/004_journal_question_history.sql` in this project's Supabase SQL Editor (see `README.md`'s existing migration instructions for where that is). This can't be done from this checkout without a live Supabase connection — do it against the project's database before manually testing the app end-to-end. Verify with:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'journal_questions' and column_name in ('created_on', 'retired_on');
```

Expected: `created_on` (`date`, not nullable, default `CURRENT_DATE`) and `retired_on` (`date`, nullable, no default) both present.

- [ ] **Step 3: Update the web `JournalQuestion` type**

Replace `lib/types.ts:24-26`:

```ts
export interface JournalQuestion {
  id: string; prompt: string; journal_type: JournalType; sort_order: number; active: boolean;
  created_on: string; retired_on: string | null;
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (This interface isn't constructed as an object literal anywhere else in this repo, so nothing else should break.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/004_journal_question_history.sql lib/types.ts
git commit -m "feat(journal): add created_on/retired_on to journal_questions"
```

---

## Task 2: Web `filterQuestionsForDate` helper

**Files:**
- Modify: `lib/journalDefaults.ts`
- Test: `tests/journalDefaults.test.ts` (new)

**Interfaces:**
- Consumes: `JournalQuestion` (with `created_on`/`retired_on`) and `JournalType` from `lib/types.ts` (Task 1); `addDays` from `lib/dates.ts`.
- Produces: `filterQuestionsForDate(questions: JournalQuestion[], type: JournalType, date: string): JournalQuestion[]`, exported from `lib/journalDefaults.ts`.

- [ ] **Step 1: Write the failing tests**

Create `tests/journalDefaults.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filterQuestionsForDate } from "@/lib/journalDefaults";
import type { JournalQuestion } from "@/lib/types";

function q(over: Partial<JournalQuestion> = {}): JournalQuestion {
  return {
    id: "q1", prompt: "Prompt", journal_type: "daily", sort_order: 0, active: true,
    created_on: "1970-01-01", retired_on: null,
    ...over,
  };
}

describe("filterQuestionsForDate", () => {
  it("keeps a pre-existing question on entries from long before or after today", () => {
    const questions = [q({ created_on: "1970-01-01" })];
    expect(filterQuestionsForDate(questions, "daily", "2020-01-01")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "daily", "2026-07-19")).toEqual(questions);
  });

  it("hides a question added today from a daily entry dated before today", () => {
    const questions = [q({ created_on: "2026-07-19" })];
    expect(filterQuestionsForDate(questions, "daily", "2026-07-18")).toEqual([]);
    expect(filterQuestionsForDate(questions, "daily", "2026-07-19")).toEqual(questions);
  });

  it("shows a weekly question added mid-week on that week's entry but not an earlier week's", () => {
    const questions = [q({ journal_type: "weekly", created_on: "2026-07-17" })]; // Friday of the Mon 07-13 week
    expect(filterQuestionsForDate(questions, "weekly", "2026-07-13")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "weekly", "2026-07-06")).toEqual([]);
  });

  it("hides a question retired today from today's daily entry immediately, but keeps it on past entries", () => {
    const questions = [q({ retired_on: "2026-07-19" })];
    expect(filterQuestionsForDate(questions, "daily", "2026-07-18")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "daily", "2026-07-19")).toEqual([]);
    expect(filterQuestionsForDate(questions, "daily", "2026-07-20")).toEqual([]);
  });

  it("keeps a weekly question retired mid-week on that week's entry but not the next week's", () => {
    const questions = [q({ journal_type: "weekly", retired_on: "2026-07-17" })];
    expect(filterQuestionsForDate(questions, "weekly", "2026-07-13")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "weekly", "2026-07-20")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/journalDefaults.test.ts`
Expected: FAIL — `filterQuestionsForDate` is not exported from `@/lib/journalDefaults`.

- [ ] **Step 3: Implement the helper**

Replace `lib/journalDefaults.ts` in full:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./dates";
import type { JournalQuestion, JournalType } from "./types";

const DAILY = ["What went well today?", "What could have gone better?", "What am I grateful for?"];
const WEEKLY = ["What were this week's wins?", "What did I learn this week?", "What's the focus for next week?"];

let ensured: Promise<void> | null = null;

export function ensureDefaultQuestions(supabase: SupabaseClient): Promise<void> {
  ensured ??= (async () => {
    const { count, error } = await supabase.from("journal_questions")
      .select("*", { count: "exact", head: true });
    if (error) { ensured = null; throw error; }
    if (count && count > 0) return;
    const { error: insErr } = await supabase.from("journal_questions").insert([
      ...DAILY.map((prompt, i) => ({ prompt, journal_type: "daily", sort_order: i })),
      ...WEEKLY.map((prompt, i) => ({ prompt, journal_type: "weekly", sort_order: i })),
    ]);
    if (insErr) { ensured = null; throw insErr; }
  })();
  return ensured;
}

/**
 * Keeps only the questions whose [created_on, retired_on) window covers `date`. For a weekly
 * entry, `date` is already the Monday of that week (per the existing `weekStart` convention),
 * so a question counts as covering the week if it was created on or before that week's Sunday.
 */
export function filterQuestionsForDate(
  questions: JournalQuestion[],
  type: JournalType,
  date: string,
): JournalQuestion[] {
  const windowEnd = type === "weekly" ? addDays(date, 6) : date;
  return questions.filter((q) => q.created_on <= windowEnd && (!q.retired_on || date < q.retired_on));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/journalDefaults.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full web test suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add lib/journalDefaults.ts tests/journalDefaults.test.ts
git commit -m "feat(journal): add filterQuestionsForDate helper"
```

---

## Task 3: Web — date-scope the Journal page's question list

**Files:**
- Modify: `app/(app)/journal/page.tsx:1-52`

**Interfaces:**
- Consumes: `filterQuestionsForDate` from `lib/journalDefaults.ts` (Task 2).

- [ ] **Step 1: Wire the filter into `load()`**

In `app/(app)/journal/page.tsx`, update the import on line 6 and the question-handling lines inside `load()` (currently lines 40-41):

```ts
import { ensureDefaultQuestions, filterQuestionsForDate } from "@/lib/journalDefaults";
```

```ts
    if (q.error) return showToast(q.error.message);
    setQuestions(filterQuestionsForDate(q.data as JournalQuestion[], type, effectiveDate));
```

(Everything else in the file — the `Promise.all` fetch, `habits`/`tasks`/`entry` handling, and the render below — stays exactly as it is.)

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open the Journal page. Add a question in Settings (it should immediately show on today's daily/weekly entry per Task 4 below, once that lands — for now, confirm today's entry still shows all pre-existing questions exactly as before, and navigating to a past date still shows its previously-answered questions). This step is about confirming no regression; the "only shows from today" behavior becomes end-to-end testable once Task 4 ships Edit/Remove.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/journal/page.tsx"
git commit -m "feat(journal): date-scope the Journal page's question list"
```

---

## Task 4: Web — Settings panel Edit and history-preserving Remove

**Files:**
- Modify: `app/(app)/settings/sections/JournalQuestionsPanel.tsx`

**Interfaces:**
- Consumes: `created_on`/`retired_on` fields from Task 1; `todayISO`, `weekStart` from `lib/dates.ts` (pre-existing, unchanged).

- [ ] **Step 1: Replace the panel**

Replace `app/(app)/settings/sections/JournalQuestionsPanel.tsx` in full:

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { JournalEntry, JournalQuestion } from "@/lib/types";
import { todayISO, weekStart } from "@/lib/dates";
import { Btn, Input, Select } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function JournalQuestionsPanel() {
  const supabase = createClient();
  const [questions, setQuestions] = useState<JournalQuestion[]>([]);
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<"daily" | "weekly">("daily");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("journal_questions").select("*")
      .is("retired_on", null).order("journal_type").order("sort_order");
    if (error) return showToast(error.message);
    setQuestions(data as JournalQuestion[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  async function add() {
    if (!prompt.trim()) return;
    const group = questions.filter((q) => q.journal_type === type);
    const n = group.reduce((m, q) => Math.max(m, q.sort_order), -1) + 1;
    const { error } = await supabase.from("journal_questions").insert({
      prompt: prompt.trim(), journal_type: type, sort_order: n, created_on: todayISO() });
    if (error) return showToast(error.message);
    setPrompt(""); load();
  }
  async function toggle(q: JournalQuestion) {
    const { error } = await supabase.from("journal_questions").update({ active: !q.active }).eq("id", q.id);
    if (error) return showToast(error.message);
    load();
  }
  /**
   * Editing retires the old row and inserts a new one instead of updating `prompt` in place,
   * so the reworded text only shows from today onward — past entries keep the old wording.
   * If today's (or this week's) entry already has an answer under the old question, that
   * answer is carried over to the new question's id so it doesn't look like it vanished.
   */
  async function editPrompt(q: JournalQuestion, text: string) {
    const newPrompt = text.trim();
    if (!newPrompt || newPrompt === q.prompt) return;
    const today = todayISO();
    const { error: retireErr } = await supabase.from("journal_questions")
      .update({ retired_on: today }).eq("id", q.id);
    if (retireErr) return showToast(retireErr.message);
    const { data: created, error: insertErr } = await supabase.from("journal_questions")
      .insert({ prompt: newPrompt, journal_type: q.journal_type, sort_order: q.sort_order, created_on: today })
      .select().single();
    if (insertErr) { showToast(insertErr.message); return load(); } // old row is already retired — refresh so the list reflects that even though the rename failed
    const newQuestion = created as JournalQuestion;
    const currentDate = q.journal_type === "weekly" ? weekStart(today) : today;
    const { data: existing } = await supabase.from("journal_entries").select("*")
      .eq("date", currentDate).eq("type", q.journal_type).maybeSingle();
    const entry = existing as JournalEntry | null;
    const value = entry?.answers[q.id];
    if (entry && value) {
      const answers = { ...entry.answers };
      delete answers[q.id];
      answers[newQuestion.id] = value;
      const { error: carryErr } = await supabase.from("journal_entries").update({ answers }).eq("id", entry.id);
      if (carryErr) showToast(carryErr.message);
    }
    load();
  }
  async function remove(q: JournalQuestion) {
    if (!window.confirm("Remove this question? It'll disappear from today onward — past entries keep it.")) return;
    const { error } = await supabase.from("journal_questions")
      .update({ retired_on: todayISO() }).eq("id", q.id);
    if (error) return showToast(error.message);
    load();
  }

  return (
    <>
      <div className="mb-3 flex gap-2">
        <Input placeholder="New reflection question…" value={prompt} onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <Select className="w-28" value={type} onChange={(e) => setType(e.target.value as "daily" | "weekly")}
          options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} />
        <Btn primary onClick={add}>Add</Btn>
      </div>
      {(["daily", "weekly"] as const).map((jt) => {
        const group = questions.filter((q) => q.journal_type === jt);
        return (
          <div key={jt} className="mb-3">
            <p className="settings-group">{jt === "daily" ? "Daily" : "Weekly"}</p>
            {group.length === 0 && <p className="text-[#666]">None yet.</p>}
            {group.map((q) => (
              <div key={q.id} className="mb-1 flex items-center gap-2">
                <Input key={q.id} defaultValue={q.prompt} onBlur={(e) => editPrompt(q, e.target.value)}
                  style={q.active ? undefined : { textDecoration: "line-through", color: "#888" }} />
                <Btn className="text-xs" onClick={() => toggle(q)}>{q.active ? "Disable" : "Enable"}</Btn>
                <Btn className="text-xs" onClick={() => remove(q)}>Remove</Btn>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open Settings → the journal questions section:
1. Add a question — it appears immediately.
2. Click into an existing question's text, change it, click away (blur) — the field keeps the new text and the row stays in place (no flicker/duplicate row).
3. Open the Journal page for **today** — the reworded prompt shows. Navigate to a **past** date that already had an answer under that question — it still shows the *original* wording and the original answer.
4. Click Remove on a question, confirm — it disappears from Settings. Today's Journal entry no longer shows it; a past entry that had answered it still shows the question and the answer.
5. If you'd already typed an answer to a question today before editing it, confirm that answer still appears under the reworded prompt afterward (the carry-over step).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/settings/sections/JournalQuestionsPanel.tsx"
git commit -m "feat(journal): edit and history-preserving remove in Settings"
```

---

## Task 5: Mobile — `JournalQuestion` type + `filterQuestionsForDate` helper

**Files:**
- Modify: `src/lib/types.ts:24-26`
- Modify: `src/lib/journalDefaults.ts`
- Modify: `tests/screens/journal.test.tsx:17-23`
- Test: `tests/lib/journalDefaults.test.ts` (new)

**Interfaces:**
- Produces: `JournalQuestion.created_on: string`, `JournalQuestion.retired_on: string | null` in the mobile app's type; `filterQuestionsForDate(questions: JournalQuestion[], type: JournalType, date: string): JournalQuestion[]`, exported from `src/lib/journalDefaults.ts` — same signature and semantics as the web copy in Task 2, kept as a separate implementation since the two apps are separate codebases.

- [ ] **Step 1: Update the mobile `JournalQuestion` type**

Replace `src/lib/types.ts:24-26`:

```ts
export interface JournalQuestion {
  id: string; prompt: string; journal_type: JournalType; sort_order: number; active: boolean;
  created_on: string; retired_on: string | null;
}
```

- [ ] **Step 2: Fix the now-incomplete fixture in the existing journal screen test**

In `tests/screens/journal.test.tsx`, the `question` object (lines 17-23) is missing the new required fields. Replace it:

```ts
const question: JournalQuestion = {
  id: "q1",
  prompt: "What went well today?",
  journal_type: "daily",
  sort_order: 0,
  active: true,
  created_on: "2026-01-01",
  retired_on: null,
};
```

- [ ] **Step 3: Run typecheck to confirm the fixture fix is enough**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Write the failing tests for the helper**

Create `tests/lib/journalDefaults.test.ts`:

```ts
import { filterQuestionsForDate } from "@/lib/journalDefaults";
import type { JournalQuestion } from "@/lib/types";

function q(over: Partial<JournalQuestion> = {}): JournalQuestion {
  return {
    id: "q1", prompt: "Prompt", journal_type: "daily", sort_order: 0, active: true,
    created_on: "1970-01-01", retired_on: null,
    ...over,
  };
}

describe("filterQuestionsForDate", () => {
  it("keeps a pre-existing question on entries from long before or after today", () => {
    const questions = [q({ created_on: "1970-01-01" })];
    expect(filterQuestionsForDate(questions, "daily", "2020-01-01")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "daily", "2026-07-19")).toEqual(questions);
  });

  it("hides a question added today from a daily entry dated before today", () => {
    const questions = [q({ created_on: "2026-07-19" })];
    expect(filterQuestionsForDate(questions, "daily", "2026-07-18")).toEqual([]);
    expect(filterQuestionsForDate(questions, "daily", "2026-07-19")).toEqual(questions);
  });

  it("shows a weekly question added mid-week on that week's entry but not an earlier week's", () => {
    const questions = [q({ journal_type: "weekly", created_on: "2026-07-17" })];
    expect(filterQuestionsForDate(questions, "weekly", "2026-07-13")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "weekly", "2026-07-06")).toEqual([]);
  });

  it("hides a question retired today from today's daily entry immediately, but keeps it on past entries", () => {
    const questions = [q({ retired_on: "2026-07-19" })];
    expect(filterQuestionsForDate(questions, "daily", "2026-07-18")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "daily", "2026-07-19")).toEqual([]);
    expect(filterQuestionsForDate(questions, "daily", "2026-07-20")).toEqual([]);
  });

  it("keeps a weekly question retired mid-week on that week's entry but not the next week's", () => {
    const questions = [q({ journal_type: "weekly", retired_on: "2026-07-17" })];
    expect(filterQuestionsForDate(questions, "weekly", "2026-07-13")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "weekly", "2026-07-20")).toEqual([]);
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx jest tests/lib/journalDefaults.test.ts`
Expected: FAIL — `filterQuestionsForDate` is not exported from `@/lib/journalDefaults`.

- [ ] **Step 6: Implement the helper**

Replace `src/lib/journalDefaults.ts` in full:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./dates";
import type { JournalQuestion, JournalType } from "./types";

const DAILY = ["What went well today?", "What could have gone better?", "What am I grateful for?"];
const WEEKLY = ["What were this week's wins?", "What did I learn this week?", "What's the focus for next week?"];

let ensured: Promise<void> | null = null;

export function ensureDefaultQuestions(supabase: SupabaseClient): Promise<void> {
  ensured ??= (async () => {
    const { count, error } = await supabase.from("journal_questions")
      .select("*", { count: "exact", head: true });
    if (error) { ensured = null; throw error; }
    if (count && count > 0) return;
    const { error: insErr } = await supabase.from("journal_questions").insert([
      ...DAILY.map((prompt, i) => ({ prompt, journal_type: "daily", sort_order: i })),
      ...WEEKLY.map((prompt, i) => ({ prompt, journal_type: "weekly", sort_order: i })),
    ]);
    if (insErr) { ensured = null; throw insErr; }
  })();
  return ensured;
}

/**
 * Keeps only the questions whose [created_on, retired_on) window covers `date`. For a weekly
 * entry, `date` is already the Monday of that week (per the existing `weekStart` convention),
 * so a question counts as covering the week if it was created on or before that week's Sunday.
 */
export function filterQuestionsForDate(
  questions: JournalQuestion[],
  type: JournalType,
  date: string,
): JournalQuestion[] {
  const windowEnd = type === "weekly" ? addDays(date, 6) : date;
  return questions.filter((q) => q.created_on <= windowEnd && (!q.retired_on || date < q.retired_on));
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest tests/lib/journalDefaults.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 8: Run the full mobile check**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS, no regressions.

- [ ] **Step 9: Commit**

```bash
git add src/lib/types.ts src/lib/journalDefaults.ts tests/lib/journalDefaults.test.ts tests/screens/journal.test.tsx
git commit -m "feat(journal): add created_on/retired_on and filterQuestionsForDate"
```

---

## Task 6: Mobile — date-scope the Journal screen's question list

**Files:**
- Modify: `src/screens/journal/JournalScreen.tsx`

**Interfaces:**
- Consumes: `filterQuestionsForDate` from `src/lib/journalDefaults.ts` (Task 5).

- [ ] **Step 1: Wire the filter in before questions reach `JournalBody`**

In `src/screens/journal/JournalScreen.tsx`, add the import alongside the existing ones (near line 6):

```ts
import { filterQuestionsForDate } from "@/lib/journalDefaults";
```

Add a computed value next to the other derived values (near `const dayTasks = tasks.data ?? [];`, currently line 42):

```ts
  const liveQuestions = filterQuestionsForDate(questions.data ?? [], type, date);
```

Then change the `JournalBody` usage (currently line 119) from:

```tsx
            questions={questions.data ?? []}
```

to:

```tsx
            questions={liveQuestions}
```

- [ ] **Step 2: Verify the existing screen test still passes**

Run: `npx jest tests/screens/journal.test.tsx`
Expected: PASS unchanged — the test's `question` fixture (fixed in Task 5) has `created_on: "2026-01-01"` and the entry's date is `"2026-07-19"`, so it still passes the new filter. No test edits should be required; if this fails, check that the fixture dates line up before changing anything else.

- [ ] **Step 3: Full mobile check**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/screens/journal/JournalScreen.tsx
git commit -m "feat(journal): date-scope the Journal screen's question list"
```

---

## Task 7: Mobile — Settings panel Edit and history-preserving Remove

**Files:**
- Modify: `src/data/journal.ts`
- Modify: `src/screens/settings/panels/JournalQuestionsPanel.tsx`
- Test: `tests/screens/journalQuestionsPanel.test.tsx` (new)

**Interfaces:**
- Consumes: `created_on`/`retired_on` fields from Task 5; `todayISO`, `weekStart` from `src/lib/dates.ts` (pre-existing, unchanged); `JournalEntry`, `JournalQuestion` types (pre-existing).
- Produces: `useJournalQuestionMutations()` now also returns `edit: UseMutationResult<void, Error, { question: JournalQuestion; prompt: string }>`.

- [ ] **Step 1: Write the failing component tests**

Create `tests/screens/journalQuestionsPanel.test.tsx`:

```tsx
import { fireEvent } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";
import { mutationsStub, queryStub } from "../helpers/fixtures";
import { renderWithProviders } from "../helpers/render";
import { useAllJournalQuestions, useJournalQuestionMutations } from "@/data/journal";
import type { JournalQuestion } from "@/lib/types";
import { JournalQuestionsPanel } from "@/screens/settings/panels/JournalQuestionsPanel";

jest.mock("@/data/journal");

const dailyQuestion: JournalQuestion = {
  id: "q1",
  prompt: "What went well today?",
  journal_type: "daily",
  sort_order: 0,
  active: true,
  created_on: "2026-01-01",
  retired_on: null,
};

describe("JournalQuestionsPanel", () => {
  const create = mutationsStub();
  const setActive = mutationsStub();
  const remove = mutationsStub();
  const edit = mutationsStub();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAllJournalQuestions as jest.Mock).mockReturnValue(queryStub([dailyQuestion]));
    (useJournalQuestionMutations as jest.Mock).mockReturnValue({ create, setActive, remove, edit });
  });

  it("shows each question's prompt in an editable field", async () => {
    const { getByDisplayValue } = await renderWithProviders(<JournalQuestionsPanel />);
    expect(getByDisplayValue("What went well today?")).toBeTruthy();
  });

  it("commits an edited prompt on blur", async () => {
    const { getByDisplayValue } = await renderWithProviders(<JournalQuestionsPanel />);
    const field = getByDisplayValue("What went well today?");
    fireEvent.changeText(field, "What went great today?");
    fireEvent(field, "blur");
    expect(edit.mutate).toHaveBeenCalledWith({ question: dailyQuestion, prompt: "What went great today?" });
  });

  it("does not commit on blur when the text is unchanged", async () => {
    const { getByDisplayValue } = await renderWithProviders(<JournalQuestionsPanel />);
    const field = getByDisplayValue("What went well today?");
    fireEvent(field, "blur");
    expect(edit.mutate).not.toHaveBeenCalled();
  });

  it("removes a question after confirming", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === "Remove")?.onPress?.();
    });
    const { getByText } = await renderWithProviders(<JournalQuestionsPanel />);
    fireEvent.press(getByText("Remove"));
    expect(remove.mutate).toHaveBeenCalledWith("q1");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/screens/journalQuestionsPanel.test.tsx`
Expected: FAIL — `edit` isn't returned by the mocked `useJournalQuestionMutations`'s real implementation yet, "Remove" button/text doesn't exist yet (current button says "Delete"), and there's no editable field with that display value (current UI is a static `Txt`).

- [ ] **Step 3: Add the `edit` mutation and soft-retire `remove`**

Replace `src/data/journal.ts` in full:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureDefaultQuestions } from "@/lib/journalDefaults";
import { todayISO, weekStart } from "@/lib/dates";
import type { JournalEntry, JournalQuestion, JournalType } from "@/lib/types";
import { rows, toastError, unwrap } from "./helpers";
import { keys } from "./keys";
import { supabase } from "./supabase";

/** Active prompts for one journal type. Seeds the default set once if the table is empty. */
export function useJournalQuestions(type: JournalType) {
  return useQuery({
    queryKey: keys.journal.questions(type),
    queryFn: async () => {
      await ensureDefaultQuestions(supabase);
      return rows<JournalQuestion>(
        await supabase
          .from("journal_questions")
          .select("*")
          .eq("journal_type", type)
          .eq("active", true)
          .order("sort_order"),
      );
    },
  });
}

/** Every currently-live question including disabled ones — the Settings panel. */
export function useAllJournalQuestions() {
  return useQuery({
    queryKey: [...keys.journal.questions("daily"), "all"],
    queryFn: async () =>
      rows<JournalQuestion>(
        await supabase
          .from("journal_questions")
          .select("*")
          .is("retired_on", null)
          .order("journal_type")
          .order("sort_order"),
      ),
  });
}

/**
 * The entry for a date, created lazily on first open exactly as the web app does.
 * `journal_entries` is unique on (user_id, date, type); `user_id` defaults to auth.uid().
 */
export function useJournalEntry(type: JournalType, date: string) {
  return useQuery({
    queryKey: keys.journal.entry(type, date),
    queryFn: async () => {
      const existing = await supabase
        .from("journal_entries")
        .select("*")
        .eq("date", date)
        .eq("type", type)
        .maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      if (existing.data) return existing.data as JournalEntry;

      const created = await supabase
        .from("journal_entries")
        .upsert({ date, type }, { onConflict: "user_id,date,type" })
        .select()
        .single();
      return unwrap(created) as JournalEntry;
    },
  });
}

export function useJournalMutations(type: JournalType, date: string) {
  const qc = useQueryClient();

  /**
   * Write-through save. Deliberately does NOT invalidate: the screen owns the draft while the
   * user types, and a refetch mid-keystroke would clobber it.
   */
  const save = useMutation({
    mutationFn: async (entry: JournalEntry) => {
      const { error } = await supabase
        .from("journal_entries")
        .update({ answers: entry.answers, notes: entry.notes, day_rating: entry.day_rating })
        .eq("id", entry.id);
      if (error) throw new Error(error.message);
      return entry;
    },
    onSuccess: (entry) => qc.setQueryData(keys.journal.entry(type, date), entry),
    onError: toastError,
  });

  return { save };
}

export function useJournalQuestionMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.journal.all });

  const create = useMutation({
    mutationFn: async ({
      prompt,
      journalType,
      sortOrder,
    }: {
      prompt: string;
      journalType: JournalType;
      sortOrder: number;
    }) => {
      const { error } = await supabase
        .from("journal_questions")
        .insert({ prompt: prompt.trim(), journal_type: journalType, sort_order: sortOrder, created_on: todayISO() });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: toastError,
  });

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("journal_questions").update({ active }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: toastError,
  });

  /** Soft-retire: keeps the row (and its past answers) but stops it showing from today on. */
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journal_questions").update({ retired_on: todayISO() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: toastError,
  });

  /**
   * Retires the old row and inserts a new one instead of updating `prompt` in place, so the
   * reworded text only shows from today onward. If today's (or this week's) entry already has
   * an answer under the old question, that answer is carried over to the new question's id.
   */
  const edit = useMutation({
    mutationFn: async ({ question, prompt }: { question: JournalQuestion; prompt: string }) => {
      const newPrompt = prompt.trim();
      const today = todayISO();
      const retire = await supabase.from("journal_questions").update({ retired_on: today }).eq("id", question.id);
      if (retire.error) throw new Error(retire.error.message);
      const created = await supabase
        .from("journal_questions")
        .insert({
          prompt: newPrompt,
          journal_type: question.journal_type,
          sort_order: question.sort_order,
          created_on: today,
        })
        .select()
        .single();
      if (created.error) throw new Error(created.error.message);
      const newQuestion = created.data as JournalQuestion;

      const currentDate = question.journal_type === "weekly" ? weekStart(today) : today;
      const existing = await supabase
        .from("journal_entries")
        .select("*")
        .eq("date", currentDate)
        .eq("type", question.journal_type)
        .maybeSingle();
      const entry = existing.data as JournalEntry | null;
      const value = entry?.answers[question.id];
      if (entry && value) {
        const answers = { ...entry.answers };
        delete answers[question.id];
        answers[newQuestion.id] = value;
        const carryOver = await supabase.from("journal_entries").update({ answers }).eq("id", entry.id);
        if (carryOver.error) toastError(carryOver.error);
      }
    },
    // onSettled (not onSuccess): if retire succeeded but the insert or carry-over step failed
    // partway through, the query cache must still refresh so the list reflects the row that
    // was in fact retired, instead of going stale showing a question no longer live.
    onSettled: invalidate,
    onError: toastError,
  });

  return { create, setActive, remove, edit };
}
```

- [ ] **Step 4: Update the panel UI**

Replace `src/screens/settings/panels/JournalQuestionsPanel.tsx` in full:

```tsx
import React, { useState } from "react";
import { Alert, View } from "react-native";
import type { StyleProp, TextStyle } from "react-native";
import { useAllJournalQuestions, useJournalQuestionMutations } from "@/data/journal";
import type { JournalQuestion, JournalType } from "@/lib/types";
import { useTheme } from "@/theme/useTheme";
import { Btn, EmptyState, FieldRow, Input, Select, Txt } from "@/ui";

/** Prompt field that commits on blur, the way the web app's manage list behaves. */
function QuestionPromptInput({
  question,
  onCommit,
  style,
}: {
  question: JournalQuestion;
  onCommit: (prompt: string) => void;
  style?: StyleProp<TextStyle>;
}) {
  const [text, setText] = useState(question.prompt);
  return (
    <Input
      value={text}
      onChangeText={setText}
      accessibilityLabel={`Edit ${question.prompt}`}
      style={style}
      onBlur={() => {
        const trimmed = text.trim();
        if (trimmed && trimmed !== question.prompt) onCommit(trimmed);
      }}
    />
  );
}

export function JournalQuestionsPanel() {
  const t = useTheme();
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<JournalType>("daily");
  const questions = useAllJournalQuestions();
  const { create, setActive, remove, edit } = useJournalQuestionMutations();

  function add() {
    if (!prompt.trim()) return;
    const group = (questions.data ?? []).filter((q) => q.journal_type === type);
    const sortOrder = group.reduce((max, q) => Math.max(max, q.sort_order), -1) + 1;
    create.mutate({ prompt, journalType: type, sortOrder });
    setPrompt("");
  }

  function confirmRemove(question: JournalQuestion) {
    Alert.alert(
      "Remove question",
      "Remove this question? It'll disappear from today onward — past entries keep it.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => remove.mutate(question.id) },
      ],
    );
  }

  return (
    <>
      <FieldRow label="New question:">
        <Input
          placeholder="New reflection question…"
          value={prompt}
          onChangeText={setPrompt}
          returnKeyType="done"
          onSubmitEditing={add}
        />
      </FieldRow>
      <FieldRow label="Journal:">
        <Select
          title="Journal type"
          value={type}
          onChange={(v) => setType(v as JournalType)}
          options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
          ]}
        />
      </FieldRow>
      <Btn primary onPress={add}>
        Add
      </Btn>

      {(["daily", "weekly"] as const).map((journalType) => {
        const group = (questions.data ?? []).filter((q) => q.journal_type === journalType);
        return (
          <View key={journalType} style={{ gap: 4, marginTop: 8 }}>
            <Txt variant="bold" style={{ fontSize: t.metric.fontSmall }}>
              {journalType === "daily" ? "DAILY" : "WEEKLY"}
            </Txt>
            {group.length === 0 ? <EmptyState text="None yet." /> : null}
            {group.map((question) => (
              <View key={question.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ flex: 1 }}>
                  <QuestionPromptInput
                    question={question}
                    onCommit={(text) => edit.mutate({ question, prompt: text })}
                    style={question.active ? undefined : { textDecorationLine: "line-through", color: t.color.textMuted }}
                  />
                </View>
                <Btn small onPress={() => setActive.mutate({ id: question.id, active: !question.active })}>
                  {question.active ? "Disable" : "Enable"}
                </Btn>
                <Btn small onPress={() => confirmRemove(question)}>
                  Remove
                </Btn>
              </View>
            ))}
          </View>
        );
      })}
    </>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest tests/screens/journalQuestionsPanel.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Full mobile check**

Run: `npm run typecheck && npm run lint && npm test && npx expo-doctor`
Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/data/journal.ts src/screens/settings/panels/JournalQuestionsPanel.tsx tests/screens/journalQuestionsPanel.test.tsx
git commit -m "feat(journal): edit and history-preserving remove in Settings"
```
