"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomFields, Task } from "@/lib/types";
import { todayISO, weekRange, monthRange, fmt } from "@/lib/dates";
import { PRIORITY_OPTS, priorityClass } from "@/lib/taskUi";
import { Btn, Input, Select, TabBar, Dialog, Check, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";
import CustomFieldsEditor from "@/components/CustomFieldsEditor";

const TABS = [
  { key: "today", label: "Today" }, { key: "week", label: "This Week" },
  { key: "month", label: "This Month" }, { key: "all", label: "All" }, { key: "done", label: "Done" },
];

export default function TasksPage() {
  const [supabase] = useState(() => createClient());
  const [tab, setTab] = useState("today");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(todayISO());
  const [priority, setPriority] = useState("2");
  const [detail, setDetail] = useState<Task | null>(null);
  const today = todayISO();

  const load = useCallback(async () => {
    let q = supabase.from("tasks").select("*").is("project_id", null)
      .order("due_date", { ascending: true, nullsFirst: false }).order("priority");
    if (tab === "done") q = q.eq("status", "done");
    else {
      q = q.neq("status", "done");
      if (tab === "today") q = q.lte("due_date", today);
      if (tab === "week") q = q.lte("due_date", weekRange(today).end);
      if (tab === "month") q = q.lte("due_date", monthRange(today).end);
    }
    const { data, error } = await q;
    if (error) showToast(error.message);
    else setTasks(data as Task[]);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function addTask() {
    if (!title.trim()) return;
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(), due_date: due || null, priority: Number(priority),
    });
    if (error) return showToast(error.message);
    setTitle("");
    load();
  }
  async function toggleDone(t: Task) {
    const done = t.status !== "done";
    setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, status: done ? "done" : "open" } : x));
    const { error } = await supabase.from("tasks").update({
      status: done ? "done" : "open", completed_at: done ? new Date().toISOString() : null,
    }).eq("id", t.id);
    if (error) { showToast(error.message); load(); } else load();
  }
  async function saveDetail() {
    if (!detail) return;
    const { error } = await supabase.from("tasks").update({
      title: detail.title, description: detail.description, due_date: detail.due_date || null,
      priority: detail.priority, status: detail.status, custom_fields: detail.custom_fields,
    }).eq("id", detail.id);
    if (error) return showToast(error.message);
    setDetail(null); load();
  }
  async function removeTask(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return showToast(error.message);
    setDetail(null); load();
  }

  return (
    <div>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      <div className="win-tabpanel">
        <div className="mb-3 flex gap-2">
          <Input placeholder="New task title…" value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()} />
          <input type="date" className="win-input w-40" value={due} onChange={(e) => setDue(e.target.value)} />
          <Select className="w-20" value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITY_OPTS} />
          <Btn primary onClick={addTask}>Add</Btn>
        </div>
        <div className="bevel-in bg-white">
          {tasks.length === 0 && <p className="p-4 text-[#666]">No tasks here. Add one above. ▲</p>}
          {tasks.map((t) => {
            const overdue = t.status !== "done" && t.due_date && t.due_date < today;
            return (
              <div key={t.id} className="flex items-center gap-2 border-b border-[#ddd] px-2 py-1 hover:bg-[#eef]">
                <Check checked={t.status === "done"} onChange={() => toggleDone(t)} />
                <button className="flex-1 text-left" onClick={() => setDetail({ ...t })}>
                  <span className={t.status === "done" ? "line-through text-[#666]" : ""}>{t.title}</span>
                </button>
                <span className={priorityClass(t.priority)}>P{t.priority}</span>
                <span className={`w-24 text-right text-xs ${overdue ? "text-[#aa0000] font-bold" : "text-[#444]"}`}>
                  {t.due_date ? fmt(t.due_date) : "—"}{overdue ? " !" : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog title="Task Properties" open={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <div className="field-row"><label>Title:</label>
              <Input value={detail.title} onChange={(e) => setDetail({ ...detail, title: e.target.value })} /></div>
            <div className="field-row"><label>Due date:</label>
              <input type="date" className="win-input" value={detail.due_date ?? ""}
                onChange={(e) => setDetail({ ...detail, due_date: e.target.value || null })} /></div>
            <div className="field-row"><label>Priority:</label>
              <Select value={String(detail.priority)} options={PRIORITY_OPTS}
                onChange={(e) => setDetail({ ...detail, priority: Number(e.target.value) })} /></div>
            <div className="field-row"><label>Status:</label>
              <Select value={detail.status} options={[
                { value: "open", label: "Open" }, { value: "in_progress", label: "In Progress" }, { value: "done", label: "Done" },
              ]} onChange={(e) => setDetail({ ...detail, status: e.target.value as Task["status"] })} /></div>
            <div className="field-row"><label>Description:</label>
              <TextArea value={detail.description ?? ""}
                onChange={(e) => setDetail({ ...detail, description: e.target.value })} /></div>
            <CustomFieldsEditor entity="task" values={detail.custom_fields}
              onChange={(custom_fields: CustomFields) => setDetail({ ...detail, custom_fields })} />
            <div className="mt-3 flex justify-between">
              <Btn onClick={() => removeTask(detail.id)}>Delete</Btn>
              <span className="flex gap-2">
                <Btn onClick={() => setDetail(null)}>Cancel</Btn>
                <Btn primary onClick={saveDetail}>OK</Btn>
              </span>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
