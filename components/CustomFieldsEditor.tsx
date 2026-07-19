"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomFields, FieldDefinition } from "@/lib/types";
import { Input, Select } from "@/components/win";

export default function CustomFieldsEditor({ entity, values, onChange }: {
  entity: "task" | "goal"; values: CustomFields; onChange: (v: CustomFields) => void;
}) {
  const [defs, setDefs] = useState<FieldDefinition[]>([]);
  useEffect(() => {
    createClient().from("field_definitions").select("*").eq("entity", entity)
      .order("sort_order").then(({ data }) => setDefs((data as FieldDefinition[]) ?? []));
  }, [entity]);
  if (defs.length === 0) return null;
  const set = (id: string, v: string) => onChange({ ...values, [id]: v === "" ? null : v });
  return (
    <>
      {defs.map((d) => (
        <div className="field-row" key={d.id}>
          <label>{d.name}:</label>
          {d.field_type === "select" ? (
            <Select value={(values[d.id] as string) ?? ""} onChange={(e) => set(d.id, e.target.value)}
              options={[{ value: "", label: "—" }, ...(d.options ?? []).map((o) => ({ value: o, label: o }))]} />
          ) : (
            <Input type={d.field_type === "number" ? "number" : d.field_type === "date" ? "date" : "text"}
              value={(values[d.id] as string) ?? ""} onChange={(e) => set(d.id, e.target.value)} />
          )}
        </div>
      ))}
    </>
  );
}
