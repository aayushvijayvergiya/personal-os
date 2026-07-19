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
