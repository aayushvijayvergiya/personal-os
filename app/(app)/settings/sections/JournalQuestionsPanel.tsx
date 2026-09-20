"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { JournalEntry, JournalQuestion } from "@/lib/types";
import { todayISO, weekStart } from "@/lib/dates";
import { Btn, Input, Select } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function JournalQuestionsPanel() {
  const supabase = createClient();
  const [questions, setQuestions] = useState<JournalQuestion[]>([]);
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<"daily" | "weekly">("daily");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("journal_questions").select("*")
      .is("retired_on", null).order("journal_type").order("sort_order");
    if (error) return showToast(error.message);
    setQuestions(data as JournalQuestion[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  async function add() {
    if (!prompt.trim()) return;
    const group = questions.filter((q) => q.journal_type === type);
    const n = group.reduce((m, q) => Math.max(m, q.sort_order), -1) + 1;
    const { error } = await supabase.from("journal_questions").insert({
      prompt: prompt.trim(), journal_type: type, sort_order: n, created_on: todayISO() });
    if (error) return showToast(error.message);
    setPrompt(""); load();
  }
  async function toggle(q: JournalQuestion) {
    const { error } = await supabase.from("journal_questions").update({ active: !q.active }).eq("id", q.id);
    if (error) return showToast(error.message);
    load();
  }
  /**
   * Editing retires the old row and inserts a new one instead of updating `prompt` in place,
   * so the reworded text only shows from today onward — past entries keep the old wording.
   * If today's (or this week's) entry already has an answer under the old question, that
   * answer is carried over to the new question's id so it doesn't look like it vanished.
   */
  async function editPrompt(q: JournalQuestion, text: string) {
    const newPrompt = text.trim();
    if (!newPrompt || newPrompt === q.prompt) return;
    const today = todayISO();
    const effective = q.journal_type === "weekly" ? weekStart(today) : today;
    const { error: retireErr } = await supabase.from("journal_questions")
      .update({ retired_on: effective }).eq("id", q.id);
    if (retireErr) return showToast(retireErr.message);
    const { data: created, error: insertErr } = await supabase.from("journal_questions")
      .insert({ prompt: newPrompt, journal_type: q.journal_type, sort_order: q.sort_order, created_on: effective, active: q.active })
      .select().single();
    if (insertErr) { showToast(insertErr.message); return load(); } // old row is already retired — refresh so the list reflects that even though the rename failed
    const newQuestion = created as JournalQuestion;
    const { data: existing, error: existingErr } = await supabase.from("journal_entries").select("*")
      .eq("date", effective).eq("type", q.journal_type).maybeSingle();
    if (existingErr) showToast(existingErr.message);
    const entry = existing as JournalEntry | null;
    const value = entry?.answers[q.id];
    if (entry && value) {
      const answers = { ...entry.answers };
      delete answers[q.id];
      answers[newQuestion.id] = value;
      const { error: carryErr } = await supabase.from("journal_entries").update({ answers }).eq("id", entry.id);
      if (carryErr) showToast(carryErr.message);
    }
    load();
  }
  async function remove(q: JournalQuestion) {
    if (!window.confirm("Remove this question? It'll disappear from today onward — past entries keep it.")) return;
    const { error } = await supabase.from("journal_questions")
      .update({ retired_on: todayISO() }).eq("id", q.id);
    if (error) return showToast(error.message);
    load();
  }

  return (
    <>
      <div className="mb-3 flex gap-2">
        <Input placeholder="New reflection question…" value={prompt} onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <Select className="w-28" value={type} onChange={(e) => setType(e.target.value as "daily" | "weekly")}
          options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} />
        <Btn primary onClick={add}>Add</Btn>
      </div>
      {(["daily", "weekly"] as const).map((jt) => {
        const group = questions.filter((q) => q.journal_type === jt);
        return (
          <div key={jt} className="mb-3">
            <p className="settings-group">{jt === "daily" ? "Daily" : "Weekly"}</p>
            {group.length === 0 && <p className="text-[#666]">None yet.</p>}
            {group.map((q) => (
              <div key={q.id} className="mb-1 flex items-center gap-2">
                <Input key={q.id} defaultValue={q.prompt} onBlur={(e) => editPrompt(q, e.target.value)}
                  style={q.active ? undefined : { textDecoration: "line-through", color: "#888" }} />
                <Btn className="text-xs" onClick={() => toggle(q)}>{q.active ? "Disable" : "Enable"}</Btn>
                <Btn className="text-xs" onClick={() => remove(q)}>Remove</Btn>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
