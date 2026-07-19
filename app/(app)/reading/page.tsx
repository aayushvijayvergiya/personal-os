"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Book } from "@/lib/types";
import { todayISO } from "@/lib/dates";
import { Window, Btn, Input, TabBar, Dialog, TextArea } from "@/components/win";
import { showToast } from "@/components/win/toast";

const SHELVES = [
  { key: "to_read", label: "📕 To Read" }, { key: "reading", label: "📖 Reading" }, { key: "finished", label: "✅ Finished" },
];

export default function ReadingPage() {
  const supabase = createClient();
  const [shelf, setShelf] = useState("to_read");
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [finishing, setFinishing] = useState<Book | null>(null);
  const [editing, setEditing] = useState<Book | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("books").select("*")
      .order("sort_order").order("created_at", { ascending: false });
    if (error) showToast(error.message); else setBooks(data as Book[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!title.trim()) return;
    const { error } = await supabase.from("books").insert({ title: title.trim(), author: author.trim() || null });
    if (error) return showToast(error.message);
    setTitle(""); setAuthor(""); load();
  }
  async function move(b: Book, status: Book["status"]) {
    if (status === "finished") { setFinishing({ ...b, rating: b.rating ?? 4 }); return; }
    const patch: Partial<Book> = { status };
    if (status === "reading" && !b.started_at) patch.started_at = todayISO();
    if (b.status === "finished") { patch.finished_at = null; patch.rating = null; }
    const { error } = await supabase.from("books").update(patch).eq("id", b.id);
    if (error) { showToast(error.message); return; }
    load();
  }
  async function confirmFinish() {
    if (!finishing) return;
    const { error } = await supabase.from("books").update({
      status: "finished", rating: finishing.rating, takeaways: finishing.takeaways,
      finished_at: todayISO(),
    }).eq("id", finishing.id);
    if (error) { showToast(error.message); return; }
    setFinishing(null); load();
  }
  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase.from("books").update({
      title: editing.title, author: editing.author, link: editing.link,
      rating: editing.rating, takeaways: editing.takeaways,
    }).eq("id", editing.id);
    if (error) { showToast(error.message); return; }
    setEditing(null); load();
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this book?")) return;
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) { showToast(error.message); return; }
    setEditing(null); load();
  }

  const visible = books.filter((b) => b.status === shelf);
  const stars = (n: number | null) => n ? "★".repeat(n) + "☆".repeat(5 - n) : "";

  return (
    <div>
      <div className="mb-2">
        <Window title="Add a book" icon="📚">
          <div className="flex gap-2">
            <Input placeholder="Title…" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Author (optional)…" value={author} onChange={(e) => setAuthor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()} />
            <Btn primary onClick={add}>Add</Btn>
          </div>
        </Window>
      </div>
      <TabBar tabs={SHELVES} active={shelf} onSelect={setShelf} />
      <div className="win-tabpanel">
        {visible.length === 0 && <p className="text-[#666]">This shelf is empty.</p>}
        {visible.map((b) => (
          <div key={b.id} className="mb-1 flex items-center gap-2 bevel-in bg-white px-2 py-1">
            <button className="flex-1 text-left" onClick={() => setEditing({ ...b })}>
              <span className="font-bold">{b.title}</span>
              {b.author && <span className="text-[#444]"> — {b.author}</span>}
              {b.status === "finished" && <span className="ml-2 text-[#b8860b]">{stars(b.rating)}</span>}
            </button>
            {b.link && <a className="text-xs text-[#000080] underline" href={b.link} target="_blank">link</a>}
            {b.status !== "to_read" && <Btn className="text-xs" onClick={() => move(b, "to_read")}>To Read</Btn>}
            {b.status !== "reading" && <Btn className="text-xs" onClick={() => move(b, "reading")}>Reading</Btn>}
            {b.status !== "finished" && <Btn className="text-xs" onClick={() => move(b, "finished")}>Finish…</Btn>}
          </div>
        ))}
      </div>

      <Dialog title="Finish Book" open={!!finishing} onClose={() => setFinishing(null)}>
        {finishing && (
          <>
            <p className="mb-2 font-bold">{finishing.title}</p>
            <div className="field-row"><label>Rating:</label>
              <span className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Btn key={n} className={finishing.rating === n ? "win-btn-primary" : ""}
                    onClick={() => setFinishing({ ...finishing, rating: n })}>{n}★</Btn>
                ))}
              </span></div>
            <div className="field-row"><label>Takeaways:</label>
              <TextArea value={finishing.takeaways ?? ""}
                onChange={(e) => setFinishing({ ...finishing, takeaways: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setFinishing(null)}>Cancel</Btn>
              <Btn primary onClick={confirmFinish}>Finish Book</Btn>
            </div>
          </>
        )}
      </Dialog>

      <Dialog title="Book Properties" open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <>
            <div className="field-row"><label>Title:</label>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            <div className="field-row"><label>Author:</label>
              <Input value={editing.author ?? ""} onChange={(e) => setEditing({ ...editing, author: e.target.value })} /></div>
            <div className="field-row"><label>Link:</label>
              <Input value={editing.link ?? ""} onChange={(e) => setEditing({ ...editing, link: e.target.value })} /></div>
            {editing.status === "finished" && (
              <>
                <div className="field-row"><label>Rating:</label>
                  <span className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Btn key={n} className={editing.rating === n ? "win-btn-primary" : ""}
                        onClick={() => setEditing({ ...editing, rating: n })}>{n}★</Btn>
                    ))}
                  </span></div>
                <div className="field-row"><label>Takeaways:</label>
                  <TextArea value={editing.takeaways ?? ""}
                    onChange={(e) => setEditing({ ...editing, takeaways: e.target.value })} /></div>
              </>
            )}
            <div className="mt-3 flex justify-between">
              <Btn onClick={() => remove(editing.id)}>Delete</Btn>
              <span className="flex gap-2">
                <Btn onClick={() => setEditing(null)}>Cancel</Btn>
                <Btn primary onClick={saveEdit}>OK</Btn>
              </span>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
