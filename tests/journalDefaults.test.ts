import { describe, it, expect } from "vitest";
import { filterQuestionsForDate } from "@/lib/journalDefaults";
import type { JournalQuestion } from "@/lib/types";

function q(over: Partial<JournalQuestion> = {}): JournalQuestion {
  return {
    id: "q1", prompt: "Prompt", journal_type: "daily", sort_order: 0, active: true,
    created_on: "1970-01-01", retired_on: null,
    ...over,
  };
}

describe("filterQuestionsForDate", () => {
  it("keeps a pre-existing question on entries from long before or after today", () => {
    const questions = [q({ created_on: "1970-01-01" })];
    expect(filterQuestionsForDate(questions, "daily", "2020-01-01")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "daily", "2026-07-19")).toEqual(questions);
  });

  it("hides a question added today from a daily entry dated before today", () => {
    const questions = [q({ created_on: "2026-07-19" })];
    expect(filterQuestionsForDate(questions, "daily", "2026-07-18")).toEqual([]);
    expect(filterQuestionsForDate(questions, "daily", "2026-07-19")).toEqual(questions);
  });

  it("shows a weekly question added mid-week on that week's entry but not an earlier week's", () => {
    const questions = [q({ journal_type: "weekly", created_on: "2026-07-17" })]; // Friday of the Mon 07-13 week
    expect(filterQuestionsForDate(questions, "weekly", "2026-07-13")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "weekly", "2026-07-06")).toEqual([]);
  });

  it("keeps a question retired today on today's daily entry and every past entry, but not tomorrow's", () => {
    const questions = [q({ retired_on: "2026-07-19" })];
    expect(filterQuestionsForDate(questions, "daily", "2026-07-18")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "daily", "2026-07-19")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "daily", "2026-07-20")).toEqual([]);
  });

  it("keeps a weekly question retired mid-week on that week's entry but not the next week's", () => {
    const questions = [q({ journal_type: "weekly", retired_on: "2026-07-17" })];
    expect(filterQuestionsForDate(questions, "weekly", "2026-07-13")).toEqual(questions);
    expect(filterQuestionsForDate(questions, "weekly", "2026-07-20")).toEqual([]);
  });
});
