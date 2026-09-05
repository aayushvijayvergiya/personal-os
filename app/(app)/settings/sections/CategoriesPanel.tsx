"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";
import { Btn, Input } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function CategoriesPanel() {
  const supabase = createClient();
  const [cats, setCats] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#000080");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) return showToast(error.message);
    setCats(data as Category[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: name.trim(), color });
    if (error) return showToast(error.message);
    setName(""); load();
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this category?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return showToast(error.message);
    load();
  }

  return (
    <>
      <div className="mb-3 flex gap-2">
        <Input placeholder="Category name…" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <input type="color" className="win-input h-8 w-14 p-0" value={color}
          onChange={(e) => setColor(e.target.value)} />
        <Btn primary onClick={add}>Add</Btn>
      </div>
      {cats.length === 0 && <p className="text-[#666]">No categories yet.</p>}
      {cats.map((c) => (
        <div key={c.id} className="mb-1 flex items-center gap-2">
          <span className="bevel-in inline-block h-4 w-4" style={{ background: c.color }} />
          <span className="flex-1">{c.name}</span>
          <Btn className="text-xs" onClick={() => remove(c.id)}>Delete</Btn>
        </div>
      ))}
    </>
  );
}
