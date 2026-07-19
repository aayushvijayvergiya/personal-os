import type { SupabaseClient } from "@supabase/supabase-js";

const DAILY = ["What went well today?", "What could have gone better?", "What am I grateful for?"];
const WEEKLY = ["What were this week's wins?", "What did I learn this week?", "What's the focus for next week?"];

export async function ensureDefaultQuestions(supabase: SupabaseClient): Promise<void> {
  const { count } = await supabase.from("journal_questions")
    .select("*", { count: "exact", head: true });
  if (count && count > 0) return;
  await supabase.from("journal_questions").insert([
    ...DAILY.map((prompt, i) => ({ prompt, journal_type: "daily", sort_order: i })),
    ...WEEKLY.map((prompt, i) => ({ prompt, journal_type: "weekly", sort_order: i })),
  ]);
}
