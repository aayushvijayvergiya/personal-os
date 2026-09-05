export type TaskStatus = "open" | "in_progress" | "done";
export type GoalStatus = "not_started" | "in_progress" | "done";
export type HorizonType = "date" | "month" | "quarter" | "year";
export type JournalType = "daily" | "weekly";
export type CustomFields = Record<string, string | number | null>;

export interface Task {
  id: string; title: string; description: string | null; due_date: string | null;
  priority: number; status: TaskStatus; completed_at: string | null;
  project_id: string | null; custom_fields: CustomFields; created_at: string;
}
export interface Category { id: string; name: string; color: string; }
export interface Project {
  id: string; name: string; description: string | null; color: string;
  status: "active" | "paused" | "completed" | "archived"; target_date: string | null;
}
export interface Goal {
  id: string; title: string; description: string | null;
  horizon_type: HorizonType; horizon_value: string; category_id: string | null;
  status: GoalStatus; custom_fields: CustomFields; created_at: string;
}
export interface Habit { id: string; name: string; icon: string; active: boolean; sort_order: number; }
export interface HabitEntry { id: string; habit_id: string; date: string; checked: boolean; }
export interface JournalQuestion {
  id: string; prompt: string; journal_type: JournalType; sort_order: number; active: boolean;
}
export interface JournalEntry {
  id: string; date: string; type: JournalType;
  answers: Record<string, string>; notes: string; day_rating: number | null;
}
export interface Note { id: string; title: string | null; body: string; pinned: boolean; created_at: string; }
export interface Book {
  id: string; title: string; author: string | null;
  item_type: "book" | "article";
  status: "to_read" | "reading" | "finished"; rating: number | null;
  takeaways: string | null; link: string | null;
  started_at: string | null; finished_at: string | null;
  due_date: string | null; sort_order: number;
}
export interface FieldDefinition {
  id: string; entity: "task" | "goal"; name: string;
  field_type: "text" | "number" | "date" | "select";
  options: string[] | null; sort_order: number;
}
export interface VisionItem {
  id: string; item_type: "note" | "image" | "goal" | "list";
  content: { text?: string; color?: string; url?: string; caption?: string; goal_id?: string; title?: string; items?: string[] };
  pos_x: number; pos_y: number; rotation: number; z_index: number;
}
