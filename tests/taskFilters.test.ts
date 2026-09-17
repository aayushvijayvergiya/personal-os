import { describe, it, expect } from "vitest";
import { taskFilterFor, taskOrClause } from "@/lib/taskFilters";
import { fromISO } from "@/lib/dates";

const TODAY = "2026-07-19"; // a Sunday: ISO week ends the same day, month ends 2026-07-31
const utc = (iso: string) => fromISO(iso).toISOString();

describe("taskFilterFor", () => {
  it("Done tab shows only completed rows and ignores due dates", () => {
    expect(taskFilterFor("done", false, TODAY)).toEqual({ onlyDone: true, excludeDone: false });
    expect(taskFilterFor("done", true, TODAY)).toEqual({ onlyDone: true, excludeDone: false });
  });

  it("Today bounds by today and hides completed rows", () => {
    expect(taskFilterFor("today", false, TODAY)).toEqual({
      dueLte: "2026-07-19", onlyDone: false, excludeDone: true,
    });
  });

  it("This Week bounds by the end of the ISO week", () => {
    expect(taskFilterFor("week", false, TODAY).dueLte).toBe("2026-07-19");
    expect(taskFilterFor("week", false, "2026-07-13").dueLte).toBe("2026-07-19");
  });

  it("This Month bounds by the end of the month", () => {
    expect(taskFilterFor("month", false, TODAY).dueLte).toBe("2026-07-31");
  });

  it("All applies no date bound", () => {
    expect(taskFilterFor("all", false, TODAY)).toEqual({ onlyDone: false, excludeDone: true });
    expect(taskFilterFor("all", true, TODAY)).toEqual({ onlyDone: false, excludeDone: false });
  });

  it("Today + show completed keeps only rows completed today", () => {
    expect(taskFilterFor("today", true, TODAY)).toEqual({
      dueLte: "2026-07-19", onlyDone: false, excludeDone: false,
      completedBetween: { from: utc("2026-07-19"), to: utc("2026-07-20") },
    });
  });

  it("This Week + show completed keeps rows completed Mon..Sun of this week", () => {
    expect(taskFilterFor("week", true, "2026-07-15").completedBetween).toEqual({
      from: utc("2026-07-13"), to: utc("2026-07-20"),
    });
  });

  it("This Month + show completed keeps rows completed this calendar month", () => {
    expect(taskFilterFor("month", true, TODAY).completedBetween).toEqual({
      from: utc("2026-07-01"), to: utc("2026-08-01"),
    });
  });
});

describe("taskOrClause", () => {
  it("is null when completed rows are not windowed", () => {
    expect(taskOrClause(taskFilterFor("today", false, TODAY))).toBeNull();
    expect(taskOrClause(taskFilterFor("all", true, TODAY))).toBeNull();
    expect(taskOrClause(taskFilterFor("done", true, TODAY))).toBeNull();
  });

  it("ORs open-rows-due-by-bound with done-rows-completed-in-window", () => {
    const from = utc("2026-07-19"), to = utc("2026-07-20");
    expect(taskOrClause(taskFilterFor("today", true, TODAY))).toBe(
      `and(status.neq.done,due_date.lte.2026-07-19),and(status.eq.done,completed_at.gte.${from},completed_at.lt.${to})`,
    );
  });
});
