import { describe, it, expect } from "vitest";
import { toISO, addDays, weekStart, weekDates, weekRange, monthRange, monthGridDates, isoWeekLabel, fmt } from "@/lib/dates";

describe("dates", () => {
  it("toISO formats local date", () => {
    expect(toISO(new Date(2026, 6, 19))).toBe("2026-07-19");
  });
  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
  });
  it("weekStart returns Monday (2026-07-19 is a Sunday)", () => {
    expect(weekStart("2026-07-19")).toBe("2026-07-13");
    expect(weekStart("2026-07-13")).toBe("2026-07-13");
  });
  it("weekDates returns Mon..Sun", () => {
    const w = weekDates("2026-07-19");
    expect(w).toHaveLength(7);
    expect(w[0]).toBe("2026-07-13");
    expect(w[6]).toBe("2026-07-19");
  });
  it("weekRange and monthRange", () => {
    expect(weekRange("2026-07-19")).toEqual({ start: "2026-07-13", end: "2026-07-19" });
    expect(monthRange("2026-07-19")).toEqual({ start: "2026-07-01", end: "2026-07-31" });
  });
  it("monthGridDates covers July 2026 in 42 cells starting Mon Jun 29", () => {
    const g = monthGridDates("2026-07-19");
    expect(g).toHaveLength(42);
    expect(g[0]).toBe("2026-06-29");
    expect(g[41]).toBe("2026-08-09");
  });
  it("isoWeekLabel", () => {
    expect(isoWeekLabel("2026-07-19")).toBe("Week 29, 2026");
  });
  it("fmt", () => {
    expect(fmt("2026-07-19")).toBe("Sun, Jul 19");
  });
});
