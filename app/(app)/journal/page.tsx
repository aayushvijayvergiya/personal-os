"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Habit, HabitEntry, JournalEntry, JournalQuestion, JournalType, Task } from "@/lib/types";
import { addDays, fmt, isoWeekLabel, todayISO, weekStart } from "@/lib/dates";
import { ensureDefaultQuestions } from "@/lib/journalDefaults";
import { Btn, TabBar, Check } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function JournalPage() {
  const supabase = createClient();
  const today = todayISO();
  const [type, setType] = useState<JournalType>("daily");
  const [dates, setDates] = useState<Record<JournalType, string>>({ daily: today, weekly: today }); // daily: the day; weekly: Monday of week
  const date = dates[type];
  const setDate = (d: string) => setDates((m) => ({ ...m, [type]: d }));
  const [questions, setQuestions] = useState<JournalQuestion[]>([]);
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const effectiveDate = type === "weekly" ? weekStart(date) : date;

  const load = useCallback(async () => {
    try {
      await ensureDefaultQuestions(supabase);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
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
        .upsert({ date: effectiveDate, type }, { onConflict: "user_id,date,type" })
        .select().single();
      if (error) showToast(error.message); else setEntry(data as JournalEntry);
    }
  }, [type, effectiveDate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setEntry(null); setTasksOpen(false); load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

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
      : await supabase.from("habit_entries")
          .upsert({ habit_id: habitId, date: effectiveDate, checked: true }, { onConflict: "habit_id,date" });
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
  const period = type === "daily" ? "day" : "week";
  const habitChecked = (id: string) => habitEntries.some((e) => e.habit_id === id && e.checked);
  const tasksDone = tasks.filter((t) => t.status === "done").length;
  const answered = questions.filter((q) => (entry?.answers[q.id] ?? "").trim().length > 0).length;

  return (
    <div>
      <TabBar active={type} onSelect={(k) => setType(k as JournalType)}
        tabs={[{ key: "daily", label: "Daily" }, { key: "weekly", label: "Weekly" }]} />
      <div className="win-tabpanel">
        {/* ── toolbar strip ───────────────────────────────────────────── */}
        <div className="bevel-out mb-2 flex flex-col gap-1 p-1.5">
          <div className="flex items-center gap-2">
            <Btn onClick={() => setDate(addDays(effectiveDate, -step))}>◀</Btn>
            <span className="min-w-40 text-center font-bold">{heading}</span>
            <Btn onClick={() => setDate(addDays(effectiveDate, step))}>▶</Btn>
            <Btn onClick={() => setDate(today)}>Today</Btn>
            <span className="ml-auto text-xs text-[#666]">{saving ? "Saving…" : "Saved"}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[#a0a0a0] pt-1">
            {type === "daily" && (
              <>
                <span className="text-xs text-[#444]">✅</span>
                {habits.length === 0
                  ? <span className="text-xs text-[#666]">No habits configured.</span>
                  : habits.map((h) => (
                    <button key={h.id} aria-pressed={habitChecked(h.id)} title={h.name}
                      className={`journal-chip ${habitChecked(h.id) ? "journal-chip-on" : ""}`}
                      onClick={() => toggleHabit(h.id)}>
                      {habitChecked(h.id) ? "☑" : "☐"} {h.icon} {h.name}
                    </button>
                  ))}

                <span className="journal-sep" />

                <div className="relative">
                  <Btn className="px-2 py-0.5 text-xs" onClick={() => setTasksOpen((v) => !v)}>
                    📋 {tasksDone} / {tasks.length} ▾
                  </Btn>
                  {tasksOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onMouseDown={() => setTasksOpen(false)} />
                      <div className="win-window absolute left-0 top-full z-50 mt-1 w-64">
                        <div className="win-titlebar">📋 Tasks for this {period}</div>
                        <div className="win-body max-h-64 overflow-y-auto">
                          {tasks.length === 0 && <p className="text-xs text-[#666]">No tasks due this {period}.</p>}
                          {tasks.map((t) => (
                            <div key={t.id} className="flex items-center gap-2 py-0.5 text-xs">
                              <Check checked={t.status === "done"} onChange={() => toggleTask(t)} />
                              <span className={t.status === "done" ? "text-[#666] line-through" : ""}>{t.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <span className="journal-sep" />
              </>
            )}

            <span className="flex items-center gap-1">
              <span className="text-xs text-[#444]" title={`${type === "daily" ? "Day" : "Week"} rating`}>⭐</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className="journal-star" aria-pressed={entry?.day_rating === n}
                  title={`${n} star${n > 1 ? "s" : ""}`} onClick={() => saveEntry({ day_rating: n })}>
                  {(entry?.day_rating ?? 0) >= n ? "★" : "☆"}
                </button>
              ))}
            </span>
          </div>
        </div>

        {/* ── notebook spread ─────────────────────────────────────────── */}
        <div className="win-window">
          <div className="win-titlebar">
            <span>📖 Journal — {heading}</span>
            <span className="font-normal">{answered} / {questions.length} answered</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="journal-page border-b-2 border-[#808080] p-4 md:border-b-0 md:border-r-2">
              {questions.length === 0 && <p className="text-[#666]">No questions configured (see Settings).</p>}
              {questions.map((q) => (
                <div key={q.id} className="mb-4">
                  <p className="journal-prompt">{q.prompt}</p>
                  <textarea className="journal-input" rows={3} value={entry?.answers[q.id] ?? ""}
                    onChange={(e) => entry && saveEntry({ answers: { ...entry.answers, [q.id]: e.target.value } })} />
                </div>
              ))}
            </div>
            <div className="journal-page p-4">
              <p className="journal-prompt">Notes from the {period}</p>
              <textarea className="journal-input" rows={14} value={entry?.notes ?? ""}
                onChange={(e) => entry && saveEntry({ notes: e.target.value })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
