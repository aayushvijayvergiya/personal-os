"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Goal, VisionItem } from "@/lib/types";
import { horizonLabel } from "@/lib/horizons";
import { Btn, Dialog, Input, Select, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";

const NOTE_COLORS = ["#ffffe1", "#e1ffe1", "#e1f0ff", "#ffe1f0", "#fff0d0"];

export default function VisionPage() {
  const supabase = createClient();
  const [items, setItems] = useState<VisionItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [adding, setAdding] = useState<{ x: number; y: number } | null>(null);
  const [kind, setKind] = useState<VisionItem["item_type"]>("note");
  const [text, setText] = useState("");
  const [goalId, setGoalId] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const load = useCallback(async () => {
    const [v, g] = await Promise.all([
      supabase.from("vision_items").select("*").order("z_index"),
      supabase.from("goals").select("*"),
    ]);
    if (v.error) showToast(v.error.message); else setItems(v.data as VisionItem[]);
    if (!g.error) setGoals(g.data as Goal[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  function onPointerDown(e: React.PointerEvent, it: VisionItem) {
    const rect = boardRef.current!.getBoundingClientRect();
    drag.current = { id: it.id, dx: e.clientX - rect.left - it.pos_x, dy: e.clientY - rect.top - it.pos_y };
    const maxZ = Math.max(0, ...items.map((x) => x.z_index)) + 1;
    setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, z_index: maxZ } : x));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const rect = boardRef.current!.getBoundingClientRect();
    const { id, dx, dy } = drag.current;
    const x = Math.max(0, e.clientX - rect.left - dx), y = Math.max(0, e.clientY - rect.top - dy);
    setItems((xs) => xs.map((it) => it.id === id ? { ...it, pos_x: x, pos_y: y } : it));
  }
  async function onPointerUp() {
    if (!drag.current) return;
    const it = items.find((x) => x.id === drag.current!.id);
    drag.current = null;
    if (it) {
      const { error } = await supabase.from("vision_items")
        .update({ pos_x: it.pos_x, pos_y: it.pos_y, z_index: it.z_index }).eq("id", it.id);
      if (error) showToast(error.message);
    }
  }
  function onBoardDoubleClick(e: React.MouseEvent) {
    if (e.target !== boardRef.current) return;
    const rect = boardRef.current!.getBoundingClientRect();
    setKind("note"); setText(""); setGoalId(goals[0]?.id ?? "");
    setAdding({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }
  async function addItem() {
    if (!adding) return;
    const content =
      kind === "note" ? { text, color: NOTE_COLORS[items.length % NOTE_COLORS.length] } :
      kind === "image" ? { url: text, caption: "" } :
      kind === "goal" ? { goal_id: goalId } :
      { title: text || "Non-Negotiables", items: [] as string[] };
    const { error } = await supabase.from("vision_items").insert({
      item_type: kind, content, pos_x: adding.x, pos_y: adding.y,
      rotation: (Math.random() * 6 - 3), z_index: items.length + 1,
    });
    if (error) return showToast(error.message);
    setAdding(null); load();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("vision_items").delete().eq("id", id);
    if (error) return showToast(error.message);
    load();
  }
  async function updateContent(it: VisionItem, content: VisionItem["content"]) {
    setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, content } : x));
    const { error } = await supabase.from("vision_items").update({ content }).eq("id", it.id);
    if (error) showToast(error.message);
  }

  function renderCard(it: VisionItem) {
    const g = it.item_type === "goal" ? goals.find((x) => x.id === it.content.goal_id) : null;
    const pct = g ? (g.status === "done" ? 100 : g.status === "in_progress" ? 50 : 0) : 0;
    return (
      <div key={it.id}
        onPointerDown={(e) => onPointerDown(e, it)} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        className="absolute w-52 cursor-move select-none bevel-out p-2 shadow-md"
        style={{ left: it.pos_x, top: it.pos_y, transform: `rotate(${it.rotation}deg)`, zIndex: it.z_index,
          background: it.item_type === "note" ? it.content.color ?? "#ffffe1" : "#c0c0c0" }}>
        <button className="float-right text-xs" onPointerDown={(e) => e.stopPropagation()}
          onClick={() => remove(it.id)}>✕</button>
        {it.item_type === "note" && <p className="whitespace-pre-wrap">{it.content.text}</p>}
        {it.item_type === "image" && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.content.url} alt={it.content.caption ?? "vision"} className="max-h-40 w-full bevel-in object-cover" />
            {it.content.caption && <p className="mt-1 text-center text-xs">{it.content.caption}</p>}
          </>
        )}
        {it.item_type === "goal" && (g ? (
          <>
            <p className="font-bold">🎯 {g.title}</p>
            <p className="text-xs text-[#444]">{horizonLabel(g.horizon_type, g.horizon_value)}</p>
            <div className="mt-1 bevel-in h-4 bg-white">
              <div className="h-full bg-[#000080]" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-center text-xs">{g.status.replace("_", " ")}</p>
          </>
        ) : <p className="text-xs text-[#aa0000]">Goal deleted — remove this card.</p>)}
        {it.item_type === "list" && (
          <>
            <p className="font-bold">‼️ {it.content.title}</p>
            {(it.content.items ?? []).map((li, i) => (
              <div key={i} className="flex items-center gap-1">
                <span>•</span><span className="flex-1">{li}</span>
                <button className="text-xs" onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => updateContent(it, { ...it.content, items: it.content.items!.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <input className="win-input mt-1 text-xs" placeholder="Add item + Enter"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  updateContent(it, { ...it.content, items: [...(it.content.items ?? []), e.currentTarget.value.trim()] });
                  e.currentTarget.value = "";
                }
              }} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="win-window flex h-full flex-col">
      <div className="win-titlebar">🌄 Vision Board — double-click the board to pin something</div>
      <div ref={boardRef} onDoubleClick={onBoardDoubleClick}
        className="relative flex-1 overflow-auto"
        style={{ background: "repeating-linear-gradient(45deg,#d4b896,#d4b896 12px,#ccb08e 12px,#ccb08e 24px)" }}>
        {items.map(renderCard)}
        {items.length === 0 && (
          <p className="p-6 text-[#5a4a32]">The corkboard is empty. Double-click anywhere to pin your first vision. 📌</p>
        )}
      </div>

      <Dialog title="Pin to Vision Board" open={!!adding} onClose={() => setAdding(null)}>
        <div className="field-row"><label>Type:</label>
          <Select value={kind} options={[
            { value: "note", label: "Sticky note" }, { value: "image", label: "Image (URL)" },
            { value: "goal", label: "Goal card" }, { value: "list", label: "List (e.g. Non-Negotiables)" },
          ]} onChange={(e) => setKind(e.target.value as VisionItem["item_type"])} /></div>
        {kind === "note" && <div className="field-row"><label>Text:</label>
          <TextArea value={text} onChange={(e) => setText(e.target.value)} /></div>}
        {kind === "image" && <div className="field-row"><label>Image URL:</label>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="https://…" /></div>}
        {kind === "list" && <div className="field-row"><label>List title:</label>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Non-Negotiables" /></div>}
        {kind === "goal" && <div className="field-row"><label>Goal:</label>
          <Select value={goalId} options={goals.map((g) => ({ value: g.id, label: g.title }))}
            onChange={(e) => setGoalId(e.target.value)} /></div>}
        <div className="flex justify-end gap-2">
          <Btn onClick={() => setAdding(null)}>Cancel</Btn>
          <Btn primary onClick={addItem}>Pin It</Btn>
        </div>
      </Dialog>
    </div>
  );
}
