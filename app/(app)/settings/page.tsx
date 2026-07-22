"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category, FieldDefinition, JournalQuestion } from "@/lib/types";
import { Window, Btn, Input, Select } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [cats, setCats] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<JournalQuestion[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [catName, setCatName] = useState(""); const [catColor, setCatColor] = useState("#000080");
  const [qPrompt, setQPrompt] = useState(""); const [qType, setQType] = useState<"daily" | "weekly">("daily");
  const [fName, setFName] = useState(""); const [fEntity, setFEntity] = useState<"task" | "goal">("task");
  const [fType, setFType] = useState<FieldDefinition["field_type"]>("text");
  const [fOptions, setFOptions] = useState("");

  const load = useCallback(async () => {
    const [c, q, f] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("journal_questions").select("*").order("journal_type").order("sort_order"),
      supabase.from("field_definitions").select("*").order("entity").order("sort_order"),
    ]);
    if (c.error) return showToast(c.error.message);
    setCats(c.data as Category[]);
    setQuestions((q.data as JournalQuestion[]) ?? []);
    setFields((f.data as FieldDefinition[]) ?? []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  async function addCat() {
    if (!catName.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: catName.trim(), color: catColor });
    if (error) return showToast(error.message);
    setCatName(""); load();
  }
  async function delCat(id: string) {
    if (!window.confirm("Delete this category?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return showToast(error.message);
    load();
  }
  async function addQuestion() {
    if (!qPrompt.trim()) return;
    const group = questions.filter((q) => q.journal_type === qType);
    const n = group.reduce((m, q) => Math.max(m, q.sort_order), -1) + 1;
    const { error } = await supabase.from("journal_questions").insert({
      prompt: qPrompt.trim(), journal_type: qType, sort_order: n });
    if (error) return showToast(error.message);
    setQPrompt(""); load();
  }
  async function toggleQuestion(q: JournalQuestion) {
    const { error } = await supabase.from("journal_questions").update({ active: !q.active }).eq("id", q.id);
    if (error) return showToast(error.message);
    load();
  }
  async function delQuestion(id: string) {
    if (!window.confirm("Delete this question?")) return;
    const { error } = await supabase.from("journal_questions").delete().eq("id", id);
    if (error) return showToast(error.message);
    load();
  }
  async function addField() {
    if (!fName.trim()) return;
    if (fType === "select" && !fOptions.trim()) return showToast("Give comma-separated options for a select field.");
    const group = fields.filter((f) => f.entity === fEntity);
    const n = group.reduce((m, f) => Math.max(m, f.sort_order), -1) + 1;
    const { error } = await supabase.from("field_definitions").insert({
      entity: fEntity, name: fName.trim(), field_type: fType,
      options: fType === "select" ? fOptions.split(",").map((s) => s.trim()).filter(Boolean) : null,
      sort_order: n,
    });
    if (error) return showToast(error.message);
    setFName(""); setFOptions(""); load();
  }
  async function delField(id: string) {
    if (!window.confirm("Delete this field definition? Its values remain in existing rows.")) return;
    const { error } = await supabase.from("field_definitions").delete().eq("id", id);
    if (error) return showToast(error.message);
    load();
  }
  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login"); router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Window title="Goal Categories" icon="🏷️">
        <div className="mb-2 flex gap-2">
          <Input placeholder="Category name…" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <input type="color" className="win-input h-8 w-14 p-0" value={catColor}
            onChange={(e) => setCatColor(e.target.value)} />
          <Btn primary onClick={addCat}>Add</Btn>
        </div>
        {cats.map((c) => (
          <div key={c.id} className="mb-1 flex items-center gap-2">
            <span className="inline-block h-4 w-4 bevel-in" style={{ background: c.color }} />
            <span className="flex-1">{c.name}</span>
            <Btn className="text-xs" onClick={() => delCat(c.id)}>Delete</Btn>
          </div>
        ))}
      </Window>

      <Window title="Journal Questions" icon="💭">
        <div className="mb-2 flex gap-2">
          <Input placeholder="New reflection question…" value={qPrompt} onChange={(e) => setQPrompt(e.target.value)} />
          <Select className="w-28" value={qType} onChange={(e) => setQType(e.target.value as "daily" | "weekly")}
            options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} />
          <Btn primary onClick={addQuestion}>Add</Btn>
        </div>
        {(["daily", "weekly"] as const).map((jt) => (
          <div key={jt} className="mb-2">
            <p className="font-bold">{jt === "daily" ? "Daily" : "Weekly"}</p>
            {questions.filter((q) => q.journal_type === jt).map((q) => (
              <div key={q.id} className="mb-1 flex items-center gap-2">
                <span className={`flex-1 ${q.active ? "" : "text-[#888] line-through"}`}>{q.prompt}</span>
                <Btn className="text-xs" onClick={() => toggleQuestion(q)}>{q.active ? "Disable" : "Enable"}</Btn>
                <Btn className="text-xs" onClick={() => delQuestion(q.id)}>Delete</Btn>
              </div>
            ))}
          </div>
        ))}
      </Window>

      <Window title="Custom Fields" icon="🧩">
        <div className="mb-2 flex flex-wrap gap-2">
          <Input className="w-40" placeholder="Field name…" value={fName} onChange={(e) => setFName(e.target.value)} />
          <Select className="w-24" value={fEntity} onChange={(e) => setFEntity(e.target.value as "task" | "goal")}
            options={[{ value: "task", label: "Task" }, { value: "goal", label: "Goal" }]} />
          <Select className="w-28" value={fType} onChange={(e) => setFType(e.target.value as FieldDefinition["field_type"])}
            options={[{ value: "text", label: "Text" }, { value: "number", label: "Number" },
              { value: "date", label: "Date" }, { value: "select", label: "Select" }]} />
          {fType === "select" && (
            <Input className="w-56" placeholder="Options, comma-separated" value={fOptions}
              onChange={(e) => setFOptions(e.target.value)} />
          )}
          <Btn primary onClick={addField}>Add</Btn>
        </div>
        {fields.map((f) => (
          <div key={f.id} className="mb-1 flex items-center gap-2">
            <span className="bevel-in bg-white px-1 text-xs">{f.entity}</span>
            <span className="flex-1">{f.name} <span className="text-xs text-[#666]">({f.field_type}
              {f.options ? `: ${f.options.join(", ")}` : ""})</span></span>
            <Btn className="text-xs" onClick={() => delField(f.id)}>Delete</Btn>
          </div>
        ))}
        <p className="mt-1 text-xs text-[#666]">Custom fields appear in Task and Goal property dialogs.</p>
      </Window>

      <Window title="Session" icon="🔐">
        <Btn onClick={signOut}>Log Off Personal OS…</Btn>
      </Window>
    </div>
  );
}
