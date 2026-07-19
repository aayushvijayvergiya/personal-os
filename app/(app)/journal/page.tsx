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
  const [dates, setDates] = useState<Record<JournalType, string>>({ daily: today, weekly: today }); // daily: the day; weekly: Monday of week
  const date = dates[type];
  const setDate = (d: string) => setDates((m) => ({ ...m, [type]: d }));
  const [questions, setQuestions] = useState<JournalQuestion[]>([]);
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
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
