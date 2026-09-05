"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Book, Goal, Habit, HabitEntry, Note, Task } from "@/lib/types";
import { addDays, fmt, fromISO, todayISO } from "@/lib/dates";
import { computeStreaks } from "@/lib/streaks";
import { currentValues } from "@/lib/horizons";
import { isOverdue, sortReadingItems } from "@/lib/reading";
import { Window, Check, Btn, Progress } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function Dashboard() {
  const supabase = createClient();
  const today = todayISO();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reading, setReading] = useState<Book[]>([]);
  const [articlesDue, setArticlesDue] = useState<Book[]>([]);

  const load = useCallback(async () => {
    const cur = currentValues(today);
    const [t, d, h, e, g, n, b, a] = await Promise.all([
      supabase.from("tasks").select("*").is("project_id", null).neq("status", "done")
        .lte("due_date", today).order("priority"),
      supabase.from("tasks").select("*").is("project_id", null).eq("status", "done")
        .gte("completed_at", fromISO(today).toISOString())
        .order("completed_at", { ascending: false }),
      supabase.from("habits").select("*").eq("active", true).order("sort_order"),
      supabase.from("habit_entries").select("*").gte("date", addDays(today, -60)),
      supabase.from("goals").select("*").neq("status", "done"),
      supabase.from("notes").select("*").eq("pinned", true).order("created_at", { ascending: false }).limit(5),
      supabase.from("books").select("*").eq("item_type", "book").eq("status", "reading"),
      supabase.from("books").select("*").eq("item_type", "article").eq("status", "to_read")
        .lte("due_date", today),
    ]);
    if (t.error) return showToast(t.error.message);
    setTasks(t.data as Task[]);
    setDoneTasks((d.data as Task[]) ?? []);
    setHabits((h.data as Habit[]) ?? []);
    setEntries((e.data as HabitEntry[]) ?? []);
    setGoals(((g.data as Goal[]) ?? []).filter((x) =>
      (x.horizon_type === "date" && x.horizon_value >= today && x.horizon_value <= addDays(today, 14)) ||
      (x.horizon_type === "month" && x.horizon_value === cur.month) ||
      (x.horizon_type === "quarter" && x.horizon_value === cur.quarter)));
    setNotes((n.data as Note[]) ?? []);
    setReading((b.data as Book[]) ?? []);
    setArticlesDue(sortReadingItems((a.data as Book[]) ?? []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  async function toggleTask(t: Task) {
    const done = t.status !== "done";
    const { error } = await supabase.from("tasks").update({
      status: done ? "done" : "open", completed_at: done ? new Date().toISOString() : null,
    }).eq("id", t.id);
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
  const checkedOn = (id: string, date: string) =>
    entries.some((e) => e.habit_id === id && e.date === date && e.checked);

  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)), [today]);
  const streaks = useMemo(() => new Map(habits.map((h) => [h.id, computeStreaks(
    entries.filter((e) => e.habit_id === h.id && e.checked).map((e) => e.date), today)])), [habits, entries, today]);

  const habitsDone = habits.filter((h) => checkedToday(h.id)).length;
  const tasksTotal = tasks.length + doneTasks.length;
  const bestStreak = habits.reduce((m, h) => Math.max(m, streaks.get(h.id)?.current ?? 0), 0);

  return (
    <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-[7fr_3fr]">
      {/* main column — 70% */}
      <div className="flex min-w-0 flex-col gap-2">
        <Window title={`Today — ${fmt(today)}`} icon="📋"
          actions={<Btn className="px-2 py-0 text-xs" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Hide" : "Show"} completed ({doneTasks.length})
          </Btn>}>
          {tasksTotal > 0 && (
            <div className="mb-3 flex items-center gap-2">
              <div className="flex-1"><Progress value={doneTasks.length} max={tasksTotal} /></div>
              <span className="shrink-0 text-xs font-bold text-[#444]">{doneTasks.length} / {tasksTotal} done</span>
            </div>
          )}
          {tasks.length === 0 && <p className="text-[#666]">All clear. 🎉</p>}
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 py-0.5">
              <Check checked={false} onChange={() => toggleTask(t)} />
              <span className="flex-1">{t.title}</span>
              {t.due_date && t.due_date < today && <span className="text-xs font-bold text-[#aa0000]">overdue!</span>}
            </div>
          ))}
          {showDone && (
            <div className="mt-2 border-t border-[#ddd] pt-1">
              <p className="text-xs font-bold text-[#444]">Completed today</p>
              {doneTasks.length === 0 && <p className="text-[#666]">Nothing completed today yet.</p>}
              {doneTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 py-0.5">
                  <Check checked onChange={() => toggleTask(t)} />
                  <span className="flex-1 text-[#666] line-through">{t.title}</span>
                </div>
              ))}
            </div>
          )}
          <Link className="mt-2 inline-block text-xs text-[#000080] underline" href="/tasks">Open Tasks →</Link>
        </Window>

        <Window title="Goals in Focus" icon="🎯">
          {goals.length === 0 && <p className="text-[#666]">No active goals in the current period.</p>}
          {goals.slice(0, 8).map((g) => (
            <p key={g.id} className="py-0.5">{g.status === "in_progress" ? "🔵" : "⚪"} {g.title}</p>
          ))}
          <Link className="mt-2 inline-block text-xs text-[#000080] underline" href="/goals">Open Goals →</Link>
        </Window>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Window title="Currently Reading" icon="📖">
            {reading.length === 0 ? <p className="text-[#666]">Nothing on the go — visit the Reading shelf.</p> :
              reading.map((b) => <p key={b.id} className="py-0.5">📖 <b>{b.title}</b>{b.author ? ` — ${b.author}` : ""}</p>)}
            <Link className="mt-2 inline-block text-xs text-[#000080] underline" href="/reading">Open Reading →</Link>
          </Window>
          <Window title="Articles Due" icon="📰">
            {articlesDue.length === 0 ? <p className="text-[#666]">No articles due today.</p> :
              articlesDue.map((a) => (
                <p key={a.id} className="py-0.5">
                  📰 {a.link
                    ? <a className="font-bold text-[#000080] underline" href={a.link} target="_blank">{a.title}</a>
                    : <b>{a.title}</b>}
                  {isOverdue(a, today) && <span className="ml-2 text-xs font-bold text-[#aa0000]">overdue!</span>}
                </p>
              ))}
            <Link className="mt-2 inline-block text-xs text-[#000080] underline" href="/reading">Open Reading →</Link>
          </Window>
          <Window className="sm:col-span-2" title="Pinned Notes" icon="📌">
            {notes.length === 0 && <p className="text-[#666]">No pinned notes.</p>}
            {notes.map((n) => <p key={n.id} className="truncate py-0.5">📌 {n.title ?? n.body}</p>)}
            <Link className="mt-2 inline-block text-xs text-[#000080] underline" href="/notes">Open Notes →</Link>
          </Window>
        </div>
      </div>

      {/* right rail — 30% */}
      <div className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-0">
        <Window title="Today's Habits" icon="✅"
          actions={<span className="text-xs font-normal">{habitsDone} / {habits.length}</span>}>
          {habits.length === 0 && <p className="text-[#666]">No habits configured.</p>}
          {habits.map((h) => (
            <div key={h.id} className="habit-row py-1.5">
              <Check label={`${h.icon} ${h.name}`} checked={checkedToday(h.id)} onChange={() => toggleHabit(h.id)} />
              <div className="mt-1 flex items-center gap-2 pl-6">
                <span className="text-xs text-[#444]">🔥 {streaks.get(h.id)?.current ?? 0}</span>
                <span className="ml-auto flex gap-0.5">
                  {last7.map((d) => (
                    <span key={d} title={fmt(d)}
                      className={`habit-dot ${checkedOn(h.id, d) ? "habit-dot-on" : ""}`} />
                  ))}
                </span>
              </div>
            </div>
          ))}
          <Link className="mt-2 inline-block text-xs text-[#000080] underline" href="/habits">Open Habits →</Link>
        </Window>

        <Window title="At a Glance" icon="📊">
          <div className="glance-row"><span>Tasks today</span><b>{doneTasks.length} / {tasksTotal}</b></div>
          <div className="glance-row"><span>Habits today</span><b>{habitsDone} / {habits.length}</b></div>
          <div className="glance-row"><span>Longest streak</span><b>🔥 {bestStreak}</b></div>
          <div className="glance-row"><span>Goals in focus</span><b>{goals.length}</b></div>
          <div className="glance-row"><span>Books reading</span><b>{reading.length}</b></div>
          <div className="glance-row"><span>Articles due</span><b>{articlesDue.length}</b></div>
        </Window>
      </div>
    </div>
  );
}
