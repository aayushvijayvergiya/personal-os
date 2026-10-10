import { describe, it, expect } from "vitest";
import { computeStreaks } from "@/lib/streaks";

describe("computeStreaks", () => {
  it("empty entries → zeros", () => {
    expect(computeStreaks([], "2026-07-19")).toEqual({ current: 0, best: 0, completionPct: 0 });
  });
  it("streak including today", () => {
    const s = computeStreaks(["2026-07-17", "2026-07-18", "2026-07-19"], "2026-07-19");
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });
  it("today unchecked keeps yesterday-anchored streak alive", () => {
    const s = computeStreaks(["2026-07-17", "2026-07-18"], "2026-07-19");
    expect(s.current).toBe(2);
  });
  it("gap breaks current but best remembers", () => {
    const s = computeStreaks(["2026-07-13", "2026-07-14", "2026-07-15"], "2026-07-19");
    expect(s.current).toBe(0);
    expect(s.best).toBe(3);
  });
  it("completionPct over last 30 days", () => {
    const dates = ["2026-07-19", "2026-07-18", "2026-07-17"]; // 3 of 30
    expect(computeStreaks(dates, "2026-07-19").completionPct).toBe(10);
  });
});

describe("computeStreaks with a schedule", () => {
  const WEEKEND = [5, 6];
  it("weekend-only: consecutive weekend days form a streak", () => {
    const checked = ["2026-09-26", "2026-09-27", "2026-10-03", "2026-10-04", "2026-10-10"];
    const s = computeStreaks(checked, "2026-10-10", WEEKEND);
    expect(s.current).toBe(5);
    expect(s.best).toBe(5);
  });
  it("unscheduled today with nothing checked keeps the streak", () => {
    const checked = ["2026-09-26", "2026-09-27", "2026-10-03", "2026-10-04"];
    expect(computeStreaks(checked, "2026-10-08", WEEKEND).current).toBe(4); // Thursday
  });
  it("scheduled today unchecked keeps the streak anchored on the previous scheduled day", () => {
    const checked = ["2026-10-03", "2026-10-04"];
    expect(computeStreaks(checked, "2026-10-10", WEEKEND).current).toBe(2);
  });
  it("a missed scheduled day breaks the streak", () => {
    const s = computeStreaks(["2026-10-03", "2026-10-10"], "2026-10-10", WEEKEND); // Sun 10-04 missed
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
  });
  it("Sunday-only", () => {
    const s = computeStreaks(["2026-09-27", "2026-10-04", "2026-10-11"], "2026-10-11", [6]);
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });
  it("bonus check-ins on unscheduled days neither extend nor break", () => {
    const s = computeStreaks(["2026-10-03", "2026-10-04", "2026-10-07"], "2026-10-04", WEEKEND);
    expect(s.current).toBe(2);
    expect(s.best).toBe(2);
  });
  it("only-bonus check-ins give zeros", () => {
    expect(computeStreaks(["2026-10-07"], "2026-10-10", WEEKEND)).toEqual({ current: 0, best: 0, completionPct: 0 });
  });
  it("completionPct counts scheduled days only", () => {
    // 9 weekend days in the 30 days ending 2026-10-10; 3 checked → 33%
    const s = computeStreaks(["2026-09-12", "2026-09-13", "2026-10-10"], "2026-10-10", WEEKEND);
    expect(s.completionPct).toBe(33);
  });
  it("empty schedule gives zeros without dividing by zero", () => {
    expect(computeStreaks(["2026-10-10"], "2026-10-10", [])).toEqual({ current: 0, best: 0, completionPct: 0 });
  });
});
