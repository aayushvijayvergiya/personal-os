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
    const { error } = await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", t.id);
    if (error) return showToast(error.message);
    load();
  }
  async function toggleHabit(habitId: string) {
    const ex = entries.find((e) => e.habit_id === habitId && e.date === today);
    if (ex) {
      const { error } = await supabase.from("habit_entries").update({ checked: !ex.checked }).eq("id", ex.id);
      if (error) return showToast(error.message);
    } else {
      const { error } = await supabase.from("habit_entries")
        .upsert({ habit_id: habitId, date: today, checked: true }, { onConflict: "habit_id,date" });
      if (error) return showToast(error.message);
    }
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
