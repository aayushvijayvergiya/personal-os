import { describe, it, expect } from "vitest";
import { currentValues, horizonLabel, groupGoals, isCurrent, isPast } from "@/lib/horizons";

describe("horizons", () => {
  it("currentValues for 2026-07-19", () => {
    expect(currentValues("2026-07-19")).toEqual({ month: "2026-07", quarter: "2026-Q3", year: "2026" });
  });
  it("labels", () => {
    expect(horizonLabel("date", "2026-07-19")).toBe("Sun, Jul 19");
    expect(horizonLabel("month", "2026-07")).toBe("July 2026");
    expect(horizonLabel("quarter", "2026-Q3")).toBe("Q3 2026");
    expect(horizonLabel("year", "2026")).toBe("2026");
  });
  it("groups and sorts", () => {
    const gs = [
      { horizon_type: "year" as const, horizon_value: "2027" },
      { horizon_type: "month" as const, horizon_value: "2026-08" },
      { horizon_type: "month" as const, horizon_value: "2026-07" },
    ];
    const g = groupGoals(gs);
    expect(g.month.map((x) => x.horizon_value)).toEqual(["2026-07", "2026-08"]);
    expect(g.year).toHaveLength(1);
    expect(g.date).toHaveLength(0);
  });
  it("isCurrent / isPast", () => {
    expect(isCurrent("month", "2026-07", "2026-07-19")).toBe(true);
    expect(isPast("month", "2026-06", "2026-07-19")).toBe(true);
    expect(isPast("date", "2026-07-18", "2026-07-19")).toBe(true);
    expect(isPast("quarter", "2026-Q3", "2026-07-19")).toBe(false);
    expect(isPast("year", "2027", "2026-07-19")).toBe(false);
  });
});
