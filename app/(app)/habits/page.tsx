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
