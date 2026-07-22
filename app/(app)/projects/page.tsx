"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomFields, Project, Task } from "@/lib/types";
import { addDays, fmt, todayISO } from "@/lib/dates";
import { PRIORITY_OPTS, priorityClass } from "@/lib/taskUi";
import { Window, Btn, Input, Select, TabBar, Dialog, Check, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";
import CustomFieldsEditor from "@/components/CustomFieldsEditor";
import CalendarGrid from "@/components/CalendarGrid";

const STATUS_LABEL: Record<Task["status"], string> = { open: "Open", in_progress: "In Progress", done: "Done" };

export default function ProjectsPage() {
  const supabase = createClient();
  const today = todayISO();
  const [tab, setTabState] = useState("board");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"project" | "due" | "status">("project");
  const [newTitle, setNewTitle] = useState("");
  const [projDraft, setProjDraft] = useState<Partial<Project> | null>(null);
  const [detail, setDetail] = useState<Task | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "all" || t === "calendar") setTabState(t); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);
  function setTab(t: string) {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  }

  const load = useCallback(async () => {
    const [p, t] = await Promise.all([
      supabase.from("projects").select("*").neq("status", "archived").order("created_at"),
      supabase.from("tasks").select("*").not("project_id", "is", null)
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);
    if (p.error) return showToast(p.error.message);
    const list = p.data as Project[];
    setProjects(list);
    if (!t.error) setTasks(t.data as Task[]);
    setSelected((s) => (s && list.some((x) => x.id === s) ? s : list[0]?.id ?? null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  async function saveProject() {
    if (!projDraft?.name?.trim()) return;
    const row = {
      name: projDraft.name.trim(), description: projDraft.description || null,
      color: projDraft.color ?? "#000080", status: projDraft.status ?? "active",
      target_date: projDraft.target_date || null,
    };
    const { error } = projDraft.id
      ? await supabase.from("projects").update(row).eq("id", projDraft.id)
      : await supabase.from("projects").insert(row);
    if (error) return showToast(error.message);
    setProjDraft(null); load();
  }
  async function addTask() {
    if (!newTitle.trim() || !selected) return;
    const { error } = await supabase.from("tasks").insert({ title: newTitle.trim(), project_id: selected });
    if (error) return showToast(error.message);
    setNewTitle(""); load();
  }
  async function toggleDone(t: Task) {
    const done = t.status !== "done";
    const { error } = await supabase.from("tasks").update({
      status: done ? "done" : "open", completed_at: done ? new Date().toISOString() : null,
    }).eq("id", t.id);
    if (error) showToast(error.message); else load();
  }
  async function saveDetail() {
    if (!detail) return;
    const { error } = await supabase.from("tasks").update({
      title: detail.title, description: detail.description, due_date: detail.due_date || null,
      priority: detail.priority, status: detail.status, custom_fields: detail.custom_fields,
      project_id: detail.project_id,
    }).eq("id", detail.id);
    if (error) return showToast(error.message);
    setDetail(null); load();
  }
  async function removeTask(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    setDetail(null); load();
  }

  const proj = projects.find((p) => p.id === selected) ?? null;
  const projTasks = tasks.filter((t) => t.project_id === selected);
  const doneCount = (pid: string) => tasks.filter((t) => t.project_id === pid && t.status === "done").length;
  const totalCount = (pid: string) => tasks.filter((t) => t.project_id === pid).length;

  const groups = useMemo(() => {
    const open = tasks.filter((t) => projects.some((p) => p.id === t.project_id));
    if (groupBy === "project")
      return projects.map((p) => ({ label: `📁 ${p.name}`, color: p.color, items: open.filter((t) => t.project_id === p.id) }));
    if (groupBy === "status")
      return (["open", "in_progress", "done"] as const).map((s) => ({
        label: STATUS_LABEL[s], color: undefined, items: open.filter((t) => t.status === s) }));
    const dates = [...new Set(open.map((t) => t.due_date ?? "No due date"))].sort();
    return dates.map((d) => ({
      label: d === "No due date" ? d : fmt(d), color: undefined,
      items: open.filter((t) => (t.due_date ?? "No due date") === d) }));
  }, [tasks, projects, groupBy]);

  const row = (t: Task) => {
    const overdue = t.status !== "done" && t.due_date && t.due_date < today;
    const p = projects.find((x) => x.id === t.project_id);
    return (
      <div key={t.id} className="flex items-center gap-2 border-b border-[#ddd] px-2 py-1 hover:bg-[#eef]">
        <Check checked={t.status === "done"} onChange={() => toggleDone(t)} />
        <button className="flex-1 text-left" onClick={() => setDetail({ ...t })}>
          <span className={t.status === "done" ? "line-through text-[#666]" : ""}>{t.title}</span>
        </button>
        {t.status === "in_progress" && <span className="text-xs">🔵</span>}
        {p && <span className="px-1 text-xs text-white" style={{ background: p.color }}>{p.name}</span>}
        <span className={priorityClass(t.priority)}>P{t.priority}</span>
        <span className={`w-24 text-right text-xs ${overdue ? "font-bold text-[#aa0000]" : "text-[#444]"}`}>
          {t.due_date ? fmt(t.due_date) : "—"}
        </span>
      </div>
    );
  };

  return (
    <div>
      <TabBar active={tab} onSelect={setTab} tabs={[
        { key: "board", label: "Projects" }, { key: "all", label: "All Tasks" }, { key: "calendar", label: "Calendar" },
      ]} />
      <div className="win-tabpanel">
        {tab === "board" && (
          <div className="flex gap-2">
            <div className="w-60 flex-shrink-0">
              <Btn className="mb-2 w-full" onClick={() => setProjDraft({ name: "", color: "#000080", status: "active" })}>
                ➕ New Project
              </Btn>
              {projects.map((p) => (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className={`mb-1 block w-full bevel-out px-2 py-1 text-left ${selected === p.id ? "outline outline-1 outline-black" : ""}`}
                  style={{ borderLeft: `6px solid ${p.color}` }}>
                  <div className="font-bold">{p.name} {p.status !== "active" && <span className="text-xs">({p.status})</span>}</div>
                  <div className="text-xs text-[#444]">{doneCount(p.id)}/{totalCount(p.id)} tasks done
                    {p.target_date ? ` · 🎯 ${fmt(p.target_date)}` : ""}</div>
                </button>
              ))}
              {projects.length === 0 && <p className="text-[#666]">No projects yet.</p>}
            </div>
            <div className="min-w-0 flex-1">
              {proj ? (
                <Window title={proj.name} icon="📁"
                  actions={<Btn onClick={() => setProjDraft({ ...proj })}>Properties</Btn>}>
                  {proj.description && <p className="mb-2 text-[#444]">{proj.description}</p>}
                  <div className="mb-2 flex gap-2">
                    <Input placeholder="New task in this project…" value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTask()} />
                    <Btn primary onClick={addTask}>Add</Btn>
                  </div>
                  <div className="bevel-in bg-white">
                    {projTasks.length === 0 && <p className="p-3 text-[#666]">No tasks in this project.</p>}
                    {projTasks.map(row)}
                  </div>
                </Window>
              ) : <p className="text-[#666]">Create a project to get started.</p>}
            </div>
          </div>
        )}

        {tab === "all" && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <label>Group by:</label>
              <Select className="w-40" value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
                options={[{ value: "project", label: "Project" }, { value: "due", label: "Due date" }, { value: "status", label: "Status" }]} />
            </div>
            {groups.map((g) => (
              <div key={g.label} className="mb-3">
                <div className="win-titlebar" style={g.color ? { background: g.color } : undefined}>{g.label} ({g.items.length})</div>
                <div className="bevel-in bg-white">{g.items.length ? g.items.map(row) : <p className="p-2 text-[#666]">—</p>}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "calendar" && (
          <ProjectCalendar tasks={tasks} projects={projects} />
        )}
      </div>

      <Dialog title="Project Properties" open={!!projDraft} onClose={() => setProjDraft(null)}>
        {projDraft && (
          <>
            <div className="field-row"><label>Name:</label>
              <Input value={projDraft.name ?? ""} onChange={(e) => setProjDraft({ ...projDraft, name: e.target.value })} /></div>
            <div className="field-row"><label>Color:</label>
              <input type="color" className="win-input h-8 w-16 p-0" value={projDraft.color ?? "#000080"}
                onChange={(e) => setProjDraft({ ...projDraft, color: e.target.value })} /></div>
            <div className="field-row"><label>Status:</label>
              <Select value={projDraft.status ?? "active"} options={[
                { value: "active", label: "Active" }, { value: "paused", label: "Paused" },
                { value: "completed", label: "Completed" }, { value: "archived", label: "Archived" },
              ]} onChange={(e) => setProjDraft({ ...projDraft, status: e.target.value as Project["status"] })} /></div>
            <div className="field-row"><label>Target date:</label>
              <input type="date" className="win-input" value={projDraft.target_date ?? ""}
                onChange={(e) => setProjDraft({ ...projDraft, target_date: e.target.value || null })} /></div>
            <div className="field-row"><label>Description:</label>
              <TextArea value={projDraft.description ?? ""}
                onChange={(e) => setProjDraft({ ...projDraft, description: e.target.value })} /></div>
            <div className="mt-3 flex justify-end gap-2">
              <Btn onClick={() => setProjDraft(null)}>Cancel</Btn>
              <Btn primary onClick={saveProject}>OK</Btn>
            </div>
          </>
        )}
      </Dialog>

      <Dialog title="Task Properties" open={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <div className="field-row"><label>Title:</label>
              <Input value={detail.title} onChange={(e) => setDetail({ ...detail, title: e.target.value })} /></div>
            <div className="field-row"><label>Project:</label>
              <Select value={detail.project_id ?? ""} options={projects.map((p) => ({ value: p.id, label: p.name }))}
                onChange={(e) => setDetail({ ...detail, project_id: e.target.value })} /></div>
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

function ProjectCalendar({ tasks, projects }: { tasks: Task[]; projects: Project[] }) {
  const [mode, setMode] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(todayISO());
  function move(dir: 1 | -1) {
    if (mode === "week") setAnchor(addDays(anchor, dir * 7));
    else {
      const [y, m] = anchor.split("-").map(Number);
      const d = new Date(y, m - 1 + dir, 1);
      setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    }
  }
  const items = tasks.filter((t) => t.due_date).map((t) => ({
    id: t.id, date: t.due_date!, label: t.title, done: t.status === "done",
    color: projects.find((p) => p.id === t.project_id)?.color ?? "#000080",
  }));
  return (
    <div>
      <div className="mb-2 flex gap-1">
        <Btn onClick={() => move(-1)}>◀</Btn>
        <Btn onClick={() => setAnchor(todayISO())}>Today</Btn>
        <Btn onClick={() => move(1)}>▶</Btn>
        <Btn className={mode === "week" ? "win-btn-primary" : ""} onClick={() => setMode("week")}>Week</Btn>
        <Btn className={mode === "month" ? "win-btn-primary" : ""} onClick={() => setMode("month")}>Month</Btn>
      </div>
      <CalendarGrid mode={mode} anchor={anchor} items={items} />
    </div>
  );
}
