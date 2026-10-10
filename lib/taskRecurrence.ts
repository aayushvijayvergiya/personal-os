import type { SupabaseClient } from "@supabase/supabase-js";
import { nextOccurrence } from "./recurrence";
import type { Task } from "./types";

export type NextTaskRow = Pick<Task, "title" | "description" | "priority" | "project_id" | "custom_fields" | "recurrence">
  & { status: "open"; due_date: string };

/** The row to insert after `t` is completed, or null if `t` doesn't repeat (or has no anchor date). */
export function nextTaskRow(t: Task, todayIso: string): NextTaskRow | null {
  if (!t.recurrence || !t.due_date) return null;
  // Walk the schedule forward from the due date (keeping its phase) until the date is in the future.
  let due = t.due_date;
  for (let i = 0; i < 5000; i++) {
    due = nextOccurrence(t.recurrence, due);
    if (due > todayIso) break;
  }
  return {
    title: t.title, description: t.description, priority: t.priority, project_id: t.project_id,
    custom_fields: t.custom_fields, recurrence: t.recurrence, status: "open",
    due_date: due,
  };
}

/** Insert the next occurrence of a just-completed repeating task. Returns an error message or null. */
export async function spawnNext(supabase: SupabaseClient, t: Task, todayIso: string): Promise<string | null> {
  const row = nextTaskRow(t, todayIso);
  if (!row) return null;
  // Complete → reopen → complete would otherwise leave two identical open occurrences.
  const dup = supabase.from("tasks").select("id").eq("title", row.title).eq("due_date", row.due_date).neq("status", "done");
  const { data: existing } = await (row.project_id === null ? dup.is("project_id", null) : dup.eq("project_id", row.project_id)).limit(1);
  if (existing && existing.length > 0) return null;
  const { error } = await supabase.from("tasks").insert(row);
  return error ? `Task completed, but creating the next occurrence failed: ${error.message}` : null;
}

/**
 * Mark a task done and spawn its next occurrence. The update only matches rows that are not
 * already done, so a double-click (or two pages) completing the same task spawns exactly once.
 */
export async function completeTask(supabase: SupabaseClient, t: Task, todayIso: string): Promise<string | null> {
  const { data, error } = await supabase.from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", t.id).neq("status", "done").select("id");
  if (error) return error.message;
  if (!data || data.length === 0) return null; // already completed elsewhere
  return spawnNext(supabase, t, todayIso);
}
