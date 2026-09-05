"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FieldDefinition } from "@/lib/types";
import { Btn, Input, Select } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function CustomFieldsPanel() {
  const supabase = createClient();
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [name, setName] = useState("");
  const [entity, setEntity] = useState<"task" | "goal">("task");
  const [fieldType, setFieldType] = useState<FieldDefinition["field_type"]>("text");
  const [options, setOptions] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("field_definitions").select("*")
      .order("entity").order("sort_order");
    if (error) return showToast(error.message);
    setFields(data as FieldDefinition[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  async function add() {
    if (!name.trim()) return;
    if (fieldType === "select" && !options.trim()) return showToast("Give comma-separated options for a select field.");
    const group = fields.filter((f) => f.entity === entity);
    const n = group.reduce((m, f) => Math.max(m, f.sort_order), -1) + 1;
    const { error } = await supabase.from("field_definitions").insert({
      entity, name: name.trim(), field_type: fieldType,
      options: fieldType === "select" ? options.split(",").map((s) => s.trim()).filter(Boolean) : null,
      sort_order: n,
    });
    if (error) return showToast(error.message);
    setName(""); setOptions(""); load();
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this field definition? Its values remain in existing rows.")) return;
    const { error } = await supabase.from("field_definitions").delete().eq("id", id);
    if (error) return showToast(error.message);
    load();
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input className="w-40" placeholder="Field name…" value={name} onChange={(e) => setName(e.target.value)} />
        <Select className="w-24" value={entity} onChange={(e) => setEntity(e.target.value as "task" | "goal")}
          options={[{ value: "task", label: "Task" }, { value: "goal", label: "Goal" }]} />
        <Select className="w-28" value={fieldType}
          onChange={(e) => setFieldType(e.target.value as FieldDefinition["field_type"])}
          options={[{ value: "text", label: "Text" }, { value: "number", label: "Number" },
            { value: "date", label: "Date" }, { value: "select", label: "Select" }]} />
        {fieldType === "select" && (
          <Input className="w-56" placeholder="Options, comma-separated" value={options}
            onChange={(e) => setOptions(e.target.value)} />
        )}
        <Btn primary onClick={add}>Add</Btn>
      </div>
      {fields.length === 0 && <p className="text-[#666]">No custom fields defined.</p>}
      {fields.map((f) => (
        <div key={f.id} className="mb-1 flex items-center gap-2">
          <span className="bevel-in bg-white px-1 text-xs">{f.entity}</span>
          <span className="flex-1">{f.name} <span className="text-xs text-[#666]">({f.field_type}
            {f.options ? `: ${f.options.join(", ")}` : ""})</span></span>
          <Btn className="text-xs" onClick={() => remove(f.id)}>Delete</Btn>
        </div>
      ))}
      <p className="mt-2 text-xs text-[#666]">Custom fields appear in Task and Goal property dialogs.</p>
    </>
  );
}
