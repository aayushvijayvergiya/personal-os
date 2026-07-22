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
