"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Btn } from "@/components/win";
import { SETTINGS_SECTIONS, type SettingsSection } from "./registry";

export default function SettingsPage() {
  const supabase = createClient();
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Head-counts for the tile subtitles; refreshed whenever you leave or enter a panel,
  // since a panel may have added or deleted rows.
  useEffect(() => {
    const counted = SETTINGS_SECTIONS.filter((s) => s.countTable);
    Promise.all(counted.map((s) =>
      supabase.from(s.countTable!).select("id", { count: "exact", head: true })
    )).then((res) => {
      const next: Record<string, number> = {};
      counted.forEach((s, i) => { if (res[i].count != null) next[s.id] = res[i].count!; });
      setCounts(next);
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const s of SETTINGS_SECTIONS) if (!seen.includes(s.group)) seen.push(s.group);
    return seen;
  }, []);

  const matches = (s: SettingsSection) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [s.title, s.description, s.group, ...(s.keywords ?? [])]
      .some((v) => v.toLowerCase().includes(q));
  };
  const hits = SETTINGS_SECTIONS.filter(matches).length;
  const section = SETTINGS_SECTIONS.find((s) => s.id === open);

  if (section) {
    return (
      <div className="win-window">
        <div className="win-titlebar">
          <span>⚙️ Control Panel ▸ {section.icon} {section.title}</span>
          <Btn className="px-2 py-0 text-xs" onClick={() => setOpen(null)}>◀ Back</Btn>
        </div>
        <div className="flex">
          <div className="settings-rail flex-shrink-0 py-1">
            {SETTINGS_SECTIONS.map((s) => (
              <button key={s.id} title={s.title}
                className={`settings-rail-btn ${s.id === open ? "settings-rail-btn-active" : ""}`}
                onClick={() => setOpen(s.id)}>{s.icon}</button>
            ))}
          </div>
          <div className="min-w-0 flex-1 p-3">
            <p className="text-base font-bold">{section.icon} {section.title}</p>
            <p className="mb-3 text-xs text-[#444]">{section.description}</p>
            <section.Panel />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="win-window">
      <div className="win-titlebar">
        <span>⚙️ Control Panel</span>
        <span className="flex items-center gap-1">
          <span>🔍</span>
          <input className="win-input w-44 px-1 py-0 text-xs" placeholder="Search settings…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </span>
      </div>
      <div className="win-body">
        {groups.map((group) => {
          const items = SETTINGS_SECTIONS.filter((s) => s.group === group && matches(s));
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-3">
              <p className="settings-group">{group}</p>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {items.map((s) => (
                  <button key={s.id} className="settings-tile" title={s.description}
                    onClick={() => setOpen(s.id)}>
                    <span className="settings-tile-icon">{s.icon}</span>
                    <span className="settings-tile-title">{s.title}</span>
                    <span className="settings-tile-sub">
                      {counts[s.id] != null ? `${counts[s.id]} item${counts[s.id] === 1 ? "" : "s"}` : " "}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {hits === 0 && <p className="text-[#666]">No settings match “{query}”.</p>}
      </div>
    </div>
  );
}
