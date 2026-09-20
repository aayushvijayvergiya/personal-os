import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayISO } from "./dates";
import type { JournalQuestion, JournalType } from "./types";

const DAILY = ["What went well today?", "What could have gone better?", "What am I grateful for?"];
const WEEKLY = ["What were this week's wins?", "What did I learn this week?", "What's the focus for next week?"];

let ensured: Promise<void> | null = null;

export function ensureDefaultQuestions(supabase: SupabaseClient): Promise<void> {
  ensured ??= (async () => {
    const { count, error } = await supabase.from("journal_questions")
      .select("*", { count: "exact", head: true });
    if (error) { ensured = null; throw error; }
    if (count && count > 0) return;
    const created_on = todayISO();
    const { error: insErr } = await supabase.from("journal_questions").insert([
      ...DAILY.map((prompt, i) => ({ prompt, journal_type: "daily", sort_order: i, created_on })),
      ...WEEKLY.map((prompt, i) => ({ prompt, journal_type: "weekly", sort_order: i, created_on })),
    ]);
    if (insErr) { ensured = null; throw insErr; }
  })();
  return ensured;
}

/**
 * Keeps only the questions whose [created_on, retired_on) window covers `date`. For a weekly
 * entry, `date` is already the Monday of that week (per the existing `weekStart` convention),
 * so a question counts as covering the week if it was created on or before that week's Sunday.
 */
export function filterQuestionsForDate(
  questions: JournalQuestion[],
  type: JournalType,
  date: string,
): JournalQuestion[] {
  const windowEnd = type === "weekly" ? addDays(date, 6) : date;
  return questions.filter((q) => q.created_on <= windowEnd && (!q.retired_on || date < q.retired_on));
}
