import type { SupabaseClient } from "@supabase/supabase-js";
import { nextOccurrence } from "./recurrence";
import type { Task } from "./types";

export type NextTaskRow = Pick<Task, "title" | "description" | "priority" | "project_id" | "custom_fields" | "recurrence">
  & { status: "open"; due_date: string };

/** The row to insert after `t` is completed, or null if `t` doesn't repeat (or has no anchor date). */
export function nextTaskRow(t: Task, todayIso: string): NextTaskRow | null {
  if (!t.recurrence || !t.due_date) return null;
  // Anchor on the schedule, but never produce a date that is already in the past.
  const base = t.due_date > todayIso ? t.due_date : todayIso;
  return {
    title: t.title, description: t.description, priority: t.priority, project_id: t.project_id,
    custom_fields: t.custom_fields, recurrence: t.recurrence, status: "open",
    due_date: nextOccurrence(t.recurrence, base),
  };
}

/** Insert the next occurrence of a just-completed repeating task. Returns an error message or null. */
export async function spawnNext(supabase: SupabaseClient, t: Task, todayIso: string): Promise<string | null> {
  const row = nextTaskRow(t, todayIso);
  if (!row) return null;
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
