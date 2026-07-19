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
