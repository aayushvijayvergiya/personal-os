"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Note } from "@/lib/types";
import { Window, Btn, Input, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";

export default function NotesPage() {
  const supabase = createClient();
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("notes").select("*")
      .order("pinned", { ascending: false }).order("created_at", { ascending: false });
    if (error) showToast(error.message); else setNotes(data as Note[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  async function add() {
    if (!body.trim()) return;
    const { error } = await supabase.from("notes").insert({ body: body.trim() });
    if (error) return showToast(error.message);
    setBody(""); load();
  }
  async function togglePin(n: Note) {
    const { error } = await supabase.from("notes").update({ pinned: !n.pinned }).eq("id", n.id);
    if (error) return showToast(error.message);
    load();
  }
  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase.from("notes").update({ body: editing.body, title: editing.title }).eq("id", editing.id);
    if (error) return showToast(error.message);
    setEditing(null); load();
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this note permanently?")) return;
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) return showToast(error.message);
    setEditing(null); load();
  }

  const visible = notes.filter((n) =>
    !search || (n.body + " " + (n.title ?? "")).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-2">
      <Window title="Quick Capture" icon="🗒️">
        <div className="flex gap-2">
          <Input placeholder="Jot something and press Enter…" value={body}
            onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Btn primary onClick={add}>Add</Btn>
        </div>
      </Window>
      <Window title="Notes" icon="📌" actions={
        <input className="win-input w-48 text-xs" placeholder="Search…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
      }>
        {visible.length === 0 && <p className="text-[#666]">No notes found.</p>}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((n) => (
            <div key={n.id} className={`bevel-out p-2 ${n.pinned ? "bg-[#ffffe1]" : ""}`}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-[#666]">{new Date(n.created_at).toLocaleDateString()}</span>
                <span className="flex gap-1">
                  <Btn className="px-1 py-0 text-xs" onClick={() => togglePin(n)}>{n.pinned ? "📌" : "📍"}</Btn>
                  <Btn className="px-1 py-0 text-xs" onClick={() => setEditing({ ...n })}>✏️</Btn>
                  <Btn className="px-1 py-0 text-xs" onClick={() => remove(n.id)}>🗑️</Btn>
                </span>
              </div>
              {n.title && <p className="font-bold">{n.title}</p>}
              <p className="whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
        </div>
      </Window>
      {editing && (
        <Window title="Edit Note" icon="✏️">
          <div className="field-row"><label>Title:</label>
            <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
          <TextArea rows={4} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
          <div className="mt-2 flex justify-end gap-2">
            <Btn onClick={() => setEditing(null)}>Cancel</Btn>
            <Btn primary onClick={saveEdit}>Save</Btn>
          </div>
        </Window>
      )}
    </div>
  );
}
