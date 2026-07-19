"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, CustomFields, Goal, GoalStatus, HorizonType } from "@/lib/types";
import { todayISO } from "@/lib/dates";
import { currentValues, groupGoals, horizonLabel, isCurrent, isPast } from "@/lib/horizons";
import { Window, Btn, Input, Select, Dialog, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";
import CustomFieldsEditor from "@/components/CustomFieldsEditor";

const STATUS_OPTS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];
const SECTIONS: { key: "date" | "month" | "quarter" | "year"; title: string }[] = [
  { key: "date", title: "📅 Dated Goals" }, { key: "month", title: "🗓️ Monthly Goals" },
  { key: "quarter", title: "🧭 Quarterly Goals" }, { key: "year", title: "🏆 Yearly Goals" },
];
const emptyDraft = (today: string): Partial<Goal> => ({
  title: "", description: "", horizon_type: "month",
  horizon_value: currentValues(today).month, category_id: null,
  status: "not_started", custom_fields: {},
});

export default function GoalsPage() {
  const supabase = createClient();
  const today = todayISO();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Goal> | null>(null);

  const load = useCallback(async () => {
    const [g, c] = await Promise.all([
      supabase.from("goals").select("*").order("created_at"),
      supabase.from("categories").select("*").order("name"),
    ]);
    if (g.error) showToast(g.error.message); else setGoals(g.data as Goal[]);
    if (!c.error) setCats(c.data as Category[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

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

  const visible = filter ? goals.filter((g) => g.category_id === filter) : goals;
  const grouped = groupGoals(visible);
  const statusIcon = (s: GoalStatus) => (s === "done" ? "✅" : s === "in_progress" ? "🔵" : "⚪");

  return (
    <div className="flex flex-col gap-2">
      <Window title="Goals" icon="🎯" actions={<Btn onClick={() => setDraft(emptyDraft(today))}>New Goal</Btn>}>
        <div className="flex flex-wrap gap-1">
          <Btn className={!filter ? "win-btn-primary" : ""} onClick={() => setFilter(null)}>All</Btn>
          {cats.map((c) => (
            <Btn key={c.id} className={filter === c.id ? "win-btn-primary" : ""}
              style={{ borderLeft: `6px solid ${c.color}` }} onClick={() => setFilter(c.id)}>{c.name}</Btn>
          ))}
        </div>
      </Window>

      {SECTIONS.map(({ key, title }) => (
        <Window key={key} title={title}>
          {grouped[key].length === 0 && <p className="text-[#666]">Nothing here yet.</p>}
          {grouped[key].map((g) => {
            const cat = cats.find((c) => c.id === g.category_id);
            const past = g.status !== "done" && isPast(g.horizon_type, g.horizon_value, today);
            const cur = isCurrent(g.horizon_type, g.horizon_value, today);
            return (
              <div key={g.id} className={`mb-1 flex items-center gap-2 bevel-in px-2 py-1 ${cur ? "bg-[#ffffe1]" : "bg-white"}`}>
                <button title="Cycle status" onClick={() => cycleStatus(g)}>{statusIcon(g.status)}</button>
                <button className="flex-1 text-left" onClick={() => setDraft({ ...g })}>
                  <span className={g.status === "done" ? "line-through text-[#666]" : ""}>{g.title}</span>
                </button>
                {cat && <span className="px-2 text-xs" style={{ background: cat.color, color: "#fff" }}>{cat.name}</span>}
                <span className={`text-xs ${past ? "font-bold text-[#aa0000]" : "text-[#444]"}`}>
                  {horizonLabel(g.horizon_type, g.horizon_value)}{past ? " !" : ""}
                </span>
              </div>
            );
          })}
        </Window>
      ))}

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
