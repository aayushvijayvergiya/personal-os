"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, CustomFields, Goal, GoalStatus, HorizonType } from "@/lib/types";
import { todayISO } from "@/lib/dates";
import { currentValues, groupGoals, horizonLabel, isCurrent, isPast } from "@/lib/horizons";
import { Window, Btn, Input, Select, Dialog, TextArea, Progress } from "@/components/win";
import { showToast } from "@/components/win/toast";
import CustomFieldsEditor from "@/components/CustomFieldsEditor";

const STATUS_OPTS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];
type SectionKey = "date" | "month" | "quarter" | "year";
const SECTIONS: { key: SectionKey; icon: string; short: string; title: string }[] = [
  { key: "date", icon: "📅", short: "Dated", title: "Dated Goals" },
  { key: "month", icon: "🗓️", short: "Month", title: "Monthly Goals" },
  { key: "quarter", icon: "🧭", short: "Quarter", title: "Quarterly Goals" },
  { key: "year", icon: "🏆", short: "Year", title: "Yearly Goals" },
];
const ORDER: Record<HorizonType, number> = { date: 0, month: 1, quarter: 2, year: 3 };
const emptyDraft = (today: string): Partial<Goal> => ({
  title: "", description: "", horizon_type: "month",
  horizon_value: currentValues(today).month, category_id: null,
  status: "not_started", custom_fields: {},
});

type Selection = { type: SectionKey | "all"; value?: string };

export default function GoalsPage() {
  const supabase = createClient();
  const today = todayISO();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Goal> | null>(null);
  const [sel, setSel] = useState<Selection>({ type: "all" });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ month: true });

  const load = useCallback(async () => {
    const [g, c] = await Promise.all([
      supabase.from("goals").select("*").order("created_at"),
      supabase.from("categories").select("*").order("name"),
    ]);
    if (g.error) showToast(g.error.message); else setGoals(g.data as Goal[]);
    if (!c.error) setCats(c.data as Category[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  function defaultValueFor(type: HorizonType): string {
    const cur = currentValues(today);
    return type === "date" ? today : cur[type as "month" | "quarter" | "year"];
  }
  async function save() {
    if (!draft?.title?.trim()) return;
    if (draft.horizon_type === "quarter" && !/^\d{4}-Q[1-4]$/.test(draft.horizon_value ?? "")) return showToast("Quarter format: 2026-Q3");
    if (draft.horizon_type === "year" && !/^\d{4}$/.test(draft.horizon_value ?? "")) return showToast("Year format: 2026");
    const row = {
      title: draft.title.trim(), description: draft.description || null,
      horizon_type: draft.horizon_type, horizon_value: draft.horizon_value,
      category_id: draft.category_id, status: draft.status, custom_fields: draft.custom_fields ?? {},
    };
    const { error } = draft.id
      ? await supabase.from("goals").update(row).eq("id", draft.id)
      : await supabase.from("goals").insert(row);
    if (error) return showToast(error.message);
    setDraft(null); load();
  }
  async function cycleStatus(g: Goal) {
    const next: GoalStatus = g.status === "not_started" ? "in_progress" : g.status === "in_progress" ? "done" : "not_started";
    const { error } = await supabase.from("goals").update({ status: next }).eq("id", g.id);
    if (error) showToast(error.message); else load();
  }
  async function remove(id: string) {
    const { error: viError } = await supabase.from("vision_items").delete()
      .eq("item_type", "goal").contains("content", { goal_id: id });
    if (viError) showToast(viError.message);
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) return showToast(error.message);
    setDraft(null); load();
  }

  const visible = useMemo(
    () => (filter ? goals.filter((g) => g.category_id === filter) : goals), [goals, filter]);
  const byType = useMemo(() => groupGoals(visible), [visible]);
  const periods = useCallback((k: SectionKey) => {
    const m = new Map<string, number>();
    for (const g of byType[k]) m.set(g.horizon_value, (m.get(g.horizon_value) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [byType]);

  const shown = useMemo(() => {
    const list = sel.type === "all"
      ? [...visible]
      : byType[sel.type].filter((g) => !sel.value || g.horizon_value === sel.value);
    return list.sort((a, b) =>
      ORDER[a.horizon_type] - ORDER[b.horizon_type] || a.horizon_value.localeCompare(b.horizon_value));
  }, [sel, visible, byType]);

  const meta = SECTIONS.find((s) => s.key === sel.type);
  const paneTitle = sel.type === "all" ? "All Goals"
    : `${meta!.title}${sel.value ? ` — ${horizonLabel(sel.type, sel.value)}` : ""}`;
  const shownDone = shown.filter((g) => g.status === "done").length;
  const statusIcon = (s: GoalStatus) => (s === "done" ? "✅" : s === "in_progress" ? "🔵" : "⚪");
  const isSel = (type: SectionKey | "all", value?: string) => sel.type === type && sel.value === value;

  return (
    <div className="flex flex-col gap-2">
      <Window title="Goals" icon="🎯" actions={<Btn onClick={() => setDraft(emptyDraft(today))}>New Goal</Btn>}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#444]">
          <span><b>{goals.length}</b> goals</span>
          <span>·</span>
          <span><b>{goals.filter((g) => g.status === "done").length}</b> done</span>
          <span>·</span>
          <span><b>{goals.filter((g) => g.status === "in_progress").length}</b> in progress</span>
        </div>
      </Window>

      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-[1fr_3fr]">
        {/* ── tree pane — 25% ─────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-2">
          <Window title="Horizons" icon="📂" className="lg:sticky lg:top-0">
            <div className="-mx-2.5 -my-1">
              <button className={`tree-node ${isSel("all") ? "tree-node-active" : ""}`}
                onClick={() => setSel({ type: "all" })}>
                <span className="w-4">🎯</span>
                <span className="flex-1 truncate">All Goals</span>
                <span className="tree-count">{visible.length}</span>
              </button>
              {SECTIONS.map(({ key, icon, short }) => (
                <div key={key}>
                  <div className={`tree-node ${isSel(key) ? "tree-node-active" : ""}`}>
                    <button className="w-4 shrink-0" title={expanded[key] ? "Collapse" : "Expand"}
                      onClick={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))}>
                      {expanded[key] ? "⊟" : "⊞"}
                    </button>
                    <button className="flex-1 truncate text-left" onClick={() => setSel({ type: key })}>
                      {icon} {short}
                    </button>
                    <span className="tree-count">{byType[key].length}</span>
                  </div>
                  {expanded[key] && periods(key).map(([value, n]) => (
                    <button key={value} className={`tree-node tree-child ${isSel(key, value) ? "tree-node-active" : ""}`}
                      onClick={() => setSel({ type: key, value })}>
                      <span className="flex-1 truncate">▪ {horizonLabel(key, value)}</span>
                      <span className="tree-count">{n}</span>
                    </button>
                  ))}
                  {expanded[key] && periods(key).length === 0 && (
                    <p className="tree-child py-0.5 text-xs text-[#666]">— empty —</p>
                  )}
                </div>
              ))}
            </div>
          </Window>

          <Window title="Categories" icon="🏷️">
            <div className="-mx-2.5 -my-1">
              <button className={`tree-node ${!filter ? "tree-node-active" : ""}`} onClick={() => setFilter(null)}>
                <span className="tree-swatch" style={{ background: "var(--face)" }} />
                <span className="flex-1 truncate">All categories</span>
                <span className="tree-count">{goals.length}</span>
              </button>
              {cats.map((c) => (
                <button key={c.id} className={`tree-node ${filter === c.id ? "tree-node-active" : ""}`}
                  onClick={() => setFilter(filter === c.id ? null : c.id)}>
                  <span className="tree-swatch" style={{ background: c.color }} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="tree-count">{goals.filter((g) => g.category_id === c.id).length}</span>
                </button>
              ))}
            </div>
          </Window>
        </div>

        {/* ── detail pane — 75% ───────────────────────────────────────── */}
        <Window title={paneTitle} icon={sel.type === "all" ? "🎯" : meta!.icon}>
          {shown.length > 0 && (
            <div className="mb-3 flex items-center gap-2">
              <div className="flex-1"><Progress value={shownDone} max={shown.length} /></div>
              <span className="shrink-0 text-xs font-bold text-[#444]">{shownDone} / {shown.length} complete</span>
            </div>
          )}
          {shown.length === 0 && <p className="text-[#666]">Nothing here yet.</p>}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {shown.map((g) => {
              const cat = cats.find((c) => c.id === g.category_id);
              const past = g.status !== "done" && isPast(g.horizon_type, g.horizon_value, today);
              const cur = isCurrent(g.horizon_type, g.horizon_value, today);
              return (
                <div key={g.id} className={`goal-card ${cur ? "bg-[#ffffe1]" : "bg-white"}`}
                  style={{ borderLeft: `6px solid ${cat?.color ?? "#808080"}` }}>
                  <div className="flex items-start gap-2">
                    <button title="Cycle status" onClick={() => cycleStatus(g)}>{statusIcon(g.status)}</button>
                    <button className="flex-1 text-left" onClick={() => setDraft({ ...g })}>
                      <span className={g.status === "done" ? "text-[#666] line-through" : "font-bold"}>{g.title}</span>
                    </button>
                  </div>
                  {g.description && <p className="mt-1 line-clamp-2 text-xs text-[#444]">{g.description}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    {cat && <span className="px-1.5 text-xs" style={{ background: cat.color, color: "#fff" }}>{cat.name}</span>}
                    <span className={`ml-auto text-xs ${past ? "font-bold text-[#aa0000]" : "text-[#444]"}`}>
                      {horizonLabel(g.horizon_type, g.horizon_value)}{past ? " !" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Window>
      </div>

      <Dialog title="Goal Properties" open={!!draft} onClose={() => setDraft(null)}>
        {draft && (
          <>
            <div className="field-row"><label>Title:</label>
              <Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="field-row"><label>Horizon:</label>
              <Select value={draft.horizon_type} options={[
                { value: "date", label: "Specific date" }, { value: "month", label: "Month" },
                { value: "quarter", label: "Quarter" }, { value: "year", label: "Year" },
              ]} onChange={(e) => {
                const t = e.target.value as HorizonType;
                setDraft({ ...draft, horizon_type: t, horizon_value: defaultValueFor(t) });
              }} /></div>
            <div className="field-row"><label>When:</label>
              {draft.horizon_type === "date" ? (
                <input type="date" className="win-input" value={draft.horizon_value}
                  onChange={(e) => setDraft({ ...draft, horizon_value: e.target.value })} />
              ) : draft.horizon_type === "month" ? (
                <input type="month" className="win-input" value={draft.horizon_value}
                  onChange={(e) => setDraft({ ...draft, horizon_value: e.target.value })} />
              ) : draft.horizon_type === "quarter" ? (
                <Input value={draft.horizon_value} placeholder="2026-Q3"
                  onChange={(e) => setDraft({ ...draft, horizon_value: e.target.value })} />
              ) : (
                <Input value={draft.horizon_value} placeholder="2026"
                  onChange={(e) => setDraft({ ...draft, horizon_value: e.target.value })} />
              )}</div>
            <div className="field-row"><label>Category:</label>
              <Select value={draft.category_id ?? ""} options={[
                { value: "", label: "— none —" }, ...cats.map((c) => ({ value: c.id, label: c.name })),
              ]} onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })} /></div>
            <div className="field-row"><label>Status:</label>
              <Select value={draft.status} options={STATUS_OPTS}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as GoalStatus })} /></div>
            <div className="field-row"><label>Description:</label>
              <TextArea value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <CustomFieldsEditor entity="goal" values={draft.custom_fields ?? {}}
              onChange={(custom_fields: CustomFields) => setDraft({ ...draft, custom_fields })} />
            <div className="mt-3 flex justify-between">
              {draft.id ? <Btn onClick={() => remove(draft.id!)}>Delete</Btn> : <span />}
              <span className="flex gap-2">
                <Btn onClick={() => setDraft(null)}>Cancel</Btn>
                <Btn primary onClick={save}>OK</Btn>
              </span>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
