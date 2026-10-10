"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomFields, Task } from "@/lib/types";
import { todayISO, toISO, fmt, completedAtForDate } from "@/lib/dates";
import { PRIORITY_OPTS, priorityClass } from "@/lib/taskUi";
import { TASK_TABS, taskFilterFor, taskOrClause, type TaskTab } from "@/lib/taskFilters";
import { Btn, Input, Select, TabBar, Dialog, Check, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";
import CustomFieldsEditor from "@/components/CustomFieldsEditor";
import { completeTask, spawnNext } from "@/lib/taskRecurrence";
import { describeRule, recurrenceError, withAnchor, type Recurrence } from "@/lib/recurrence";
import RecurrenceEditor from "@/components/RecurrenceEditor";

export default function TasksPage() {
  const [supabase] = useState(() => createClient());
  const [tab, setTab] = useState<TaskTab>("today");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(todayISO());
  const [priority, setPriority] = useState("2");
  const [detail, setDetail] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [newRule, setNewRule] = useState<Recurrence | null>(null);
  const today = todayISO();

  const load = useCallback(async () => {
    let q = supabase.from("tasks").select("*").is("project_id", null)
      .order("due_date", { ascending: true, nullsFirst: false }).order("priority");
    const f = taskFilterFor(tab, showDone, today);
    const or = taskOrClause(f);
    if (f.onlyDone) q = q.eq("status", "done");
    if (f.excludeDone) q = q.neq("status", "done");
    if (or) q = q.or(or);
    else if (f.dueLte) q = q.lte("due_date", f.dueLte);
    const { data, error } = await q;
    if (error) showToast(error.message);
    else setTasks(data as Task[]);
  }, [tab, showDone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  async function addTask() {
    if (!title.trim()) return;
    const rule = newRule ? withAnchor(newRule, due || null) : null;
    const problem = recurrenceError(rule, due || null);
    if (problem) return showToast(problem);
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(), due_date: due || null, priority: Number(priority),
      ...(rule ? { recurrence: rule } : {}), // omitted for one-time tasks so an unmigrated DB still works
    });
    if (error) return showToast(error.message);
    setTitle(""); setNewRule(null);
    load();
  }
  async function toggleDone(t: Task) {
    const done = t.status !== "done";
    setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, status: done ? "done" : "open" } : x));
    const err = done
      ? await completeTask(supabase, t, today)
      : (await supabase.from("tasks").update({ status: "open", completed_at: null }).eq("id", t.id)).error?.message ?? null;
    if (err) showToast(err);
    load();
  }
  async function saveDetail() {
    if (!detail) return;
    // Not re-anchored here: the due-date field already re-anchors a monthly rule when the date
    // changes, and a clamped copy (due Feb 28, day 31) must keep its day.
    const rule = detail.recurrence;
    const problem = recurrenceError(rule, detail.due_date);
    if (problem) return showToast(problem);
    const prev = tasks.find((x) => x.id === detail.id);
    const { error } = await supabase.from("tasks").update({
      title: detail.title, description: detail.description, due_date: detail.due_date || null,
      priority: detail.priority, status: detail.status, custom_fields: detail.custom_fields,
      ...(detail.recurrence !== undefined ? { recurrence: rule } : {}),
      completed_at: detail.status === "done"
        ? detail.completed_at ?? new Date().toISOString() : null,
    }).eq("id", detail.id);
    if (error) return showToast(error.message);
    if (prev && prev.status !== "done" && detail.status === "done") {
      const err = await spawnNext(supabase, { ...detail, recurrence: rule }, today);
      if (err) showToast(err);
    }
    setDetail(null); load();
  }
  async function removeTask(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return showToast(error.message);
    setDetail(null); load();
  }

  return (
    <div>
      <TabBar tabs={TASK_TABS} active={tab} onSelect={(k) => setTab(k as TaskTab)} />
      <div className="win-tabpanel">
        <div className="mb-3 flex gap-2">
          <Input placeholder="New task title…" value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()} />
          <input type="date" className="win-input" style={{ width: "auto", flexShrink: 0 }} value={due}
            onChange={(e) => { setDue(e.target.value); setNewRule((r) => r ? withAnchor(r, e.target.value || null) : r); }} />
          <Select className="w-20" value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITY_OPTS} />
          <Btn primary onClick={addTask}>Add</Btn>
        </div>
        <div className="mb-3">
          <Check label="Repeat" checked={!!newRule}
            onChange={(on) => setNewRule(on ? withAnchor({ freq: "daily", interval: 1 }, due || null) : null)} />
          {newRule && (
            <div className="mt-1 pl-6">
              <RecurrenceEditor value={newRule} anchorIso={due || null} onChange={setNewRule} />
              {!due && <p className="mt-1 text-xs text-[#aa0000]">Repeating tasks need a due date.</p>}
            </div>
          )}
        </div>
        {tab !== "done" && (
          <div className="mb-2 flex items-center justify-between">
            <Check label="Show completed" checked={showDone} onChange={setShowDone} />
            <span className="text-xs text-[#444]">
              {tasks.filter((t) => t.status === "done").length} done / {tasks.length} shown
            </span>
          </div>
        )}
        <div className="bevel-in bg-white">
          {tasks.length === 0 && <p className="p-4 text-[#666]">No tasks here. Add one above. ▲</p>}
          {tasks.map((t) => {
            const overdue = t.status !== "done" && t.due_date && t.due_date < today;
            return (
              <div key={t.id} className="flex items-start gap-2 border-b border-[#ddd] px-2 py-1 hover:bg-[#eef]">
                <span className="mt-[3px]"><Check checked={t.status === "done"} onChange={() => toggleDone(t)} /></span>
                <button className="min-w-0 flex-1 text-left" onClick={() => setDetail({ ...t })}>
                  <span className={t.status === "done" ? "line-through text-[#666]" : ""}>{t.title}</span>
                  {t.recurrence && <span className="ml-2 text-xs text-[#000080]" title={describeRule(t.recurrence)}>🔁 {describeRule(t.recurrence)}</span>}
                  {t.description && (
                    <span className="mt-0.5 block whitespace-pre-wrap break-words text-xs text-[#666]">{t.description}</span>
                  )}
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
                onChange={(e) => setDetail({ ...detail, due_date: e.target.value || null,
                  recurrence: detail.recurrence ? withAnchor(detail.recurrence, e.target.value || null) : null })} /></div>
            <div className="field-row"><label>Priority:</label>
              <Select value={String(detail.priority)} options={PRIORITY_OPTS}
                onChange={(e) => setDetail({ ...detail, priority: Number(e.target.value) })} /></div>
            <div className="field-row"><label>Repeat:</label>
              <div className="flex-1">
                <Check label="Repeats" checked={!!detail.recurrence}
                  onChange={(on) => setDetail({ ...detail, recurrence: on ? withAnchor({ freq: "daily", interval: 1 }, detail.due_date) : null })} />
                {detail.recurrence && (
                  <div className="mt-1">
                    <RecurrenceEditor value={detail.recurrence} anchorIso={detail.due_date}
                      onChange={(recurrence) => setDetail({ ...detail, recurrence })} />
                  </div>
                )}
              </div></div>
            <div className="field-row"><label>Status:</label>
              <Select value={detail.status} options={[
                { value: "open", label: "Open" }, { value: "in_progress", label: "In Progress" }, { value: "done", label: "Done" },
              ]} onChange={(e) => setDetail({ ...detail, status: e.target.value as Task["status"] })} /></div>
            {detail.status === "done" && (
              <div className="field-row"><label>Completed:</label>
                <input type="date" className="win-input" value={detail.completed_at ? toISO(new Date(detail.completed_at)) : today}
                  onChange={(e) => e.target.value && setDetail({ ...detail, completed_at: completedAtForDate(detail.completed_at, e.target.value) })} /></div>
            )}
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
