"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { JournalQuestion } from "@/lib/types";
import { Btn, Input, Select } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function JournalQuestionsPanel() {
  const supabase = createClient();
  const [questions, setQuestions] = useState<JournalQuestion[]>([]);
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<"daily" | "weekly">("daily");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("journal_questions").select("*")
      .order("journal_type").order("sort_order");
    if (error) return showToast(error.message);
    setQuestions(data as JournalQuestion[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  async function add() {
    if (!prompt.trim()) return;
    const group = questions.filter((q) => q.journal_type === type);
    const n = group.reduce((m, q) => Math.max(m, q.sort_order), -1) + 1;
    const { error } = await supabase.from("journal_questions").insert({
      prompt: prompt.trim(), journal_type: type, sort_order: n });
    if (error) return showToast(error.message);
    setPrompt(""); load();
  }
  async function toggle(q: JournalQuestion) {
    const { error } = await supabase.from("journal_questions").update({ active: !q.active }).eq("id", q.id);
    if (error) return showToast(error.message);
    load();
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this question?")) return;
    const { error } = await supabase.from("journal_questions").delete().eq("id", id);
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
                <span className={`flex-1 ${q.active ? "" : "text-[#888] line-through"}`}>{q.prompt}</span>
                <Btn className="text-xs" onClick={() => toggle(q)}>{q.active ? "Disable" : "Enable"}</Btn>
                <Btn className="text-xs" onClick={() => remove(q.id)}>Delete</Btn>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
