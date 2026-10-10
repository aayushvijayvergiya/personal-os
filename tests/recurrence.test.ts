import { describe, it, expect } from "vitest";
import {
  ALL_DAYS, describeDays, describeRule, isScheduled, nextOccurrence,
  recurrenceError, validateRule, weekdayIndex, withAnchor, withSchedule, type Recurrence,
} from "@/lib/recurrence";

describe("weekdayIndex / isScheduled", () => {
  it("Mon=0..Sun=6", () => {
    expect(weekdayIndex("2026-10-05")).toBe(0);
    expect(weekdayIndex("2026-10-10")).toBe(5);
    expect(weekdayIndex("2026-10-11")).toBe(6);
  });
  it("isScheduled", () => {
    expect(isScheduled([5, 6], "2026-10-10")).toBe(true);
    expect(isScheduled([0, 1, 2, 3, 4], "2026-10-10")).toBe(false);
    expect(isScheduled(ALL_DAYS, "2026-10-07")).toBe(true);
  });
});

describe("nextOccurrence", () => {
  it("daily every 3 days", () => {
    expect(nextOccurrence({ freq: "daily", interval: 3 }, "2026-10-10")).toBe("2026-10-13");
  });
  it("weekly later in same week", () => {
    const r: Recurrence = { freq: "weekly", interval: 1, days: [0, 3] };
    expect(nextOccurrence(r, "2026-10-05")).toBe("2026-10-08"); // Mon -> Thu
  });
  it("weekly wraps to next week", () => {
    const r: Recurrence = { freq: "weekly", interval: 1, days: [0, 3] };
    expect(nextOccurrence(r, "2026-10-08")).toBe("2026-10-12"); // Thu -> next Mon
  });
  it("weekly interval 2 skips a week", () => {
    const r: Recurrence = { freq: "weekly", interval: 2, days: [0, 3] };
    expect(nextOccurrence(r, "2026-10-08")).toBe("2026-10-19");
  });
  it("weekly single day is strictly after", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1, days: [5] }, "2026-10-10")).toBe("2026-10-17");
  });
  it("weekly unsorted days", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1, days: [3, 0] }, "2026-10-05")).toBe("2026-10-08");
  });
  it("weekly across year boundary", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1, days: [0] }, "2026-12-31")).toBe("2027-01-04");
  });
  it("monthly clamps without drifting (day 31)", () => {
    const r: Recurrence = { freq: "monthly", interval: 1, day: 31 };
    expect(nextOccurrence(r, "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence(r, "2026-02-28")).toBe("2026-03-31");
  });
  it("monthly leap year", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 1, day: 31 }, "2028-01-31")).toBe("2028-02-29");
  });
  it("monthly interval across year end", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 2, day: 30 }, "2026-11-30")).toBe("2027-01-30");
    expect(nextOccurrence({ freq: "monthly", interval: 1, day: 15 }, "2026-12-15")).toBe("2027-01-15");
  });
});

describe("validateRule / recurrenceError / withAnchor", () => {
  it("rejects bad intervals", () => {
    expect(validateRule({ freq: "daily", interval: 0 })).toBe(false);
    expect(validateRule({ freq: "daily", interval: 1.5 })).toBe(false);
    expect(validateRule({ freq: "daily", interval: NaN })).toBe(false);
    expect(validateRule({ freq: "daily", interval: 2 })).toBe(true);
  });
  it("weekly days must be non-empty, unique, 0..6", () => {
    expect(validateRule({ freq: "weekly", interval: 1, days: [] })).toBe(false);
    expect(validateRule({ freq: "weekly", interval: 1, days: [1, 1] })).toBe(false);
    expect(validateRule({ freq: "weekly", interval: 1, days: [7] })).toBe(false);
    expect(validateRule({ freq: "weekly", interval: 1, days: [0, 6] })).toBe(true);
  });
  it("monthly day must be 1..31", () => {
    expect(validateRule({ freq: "monthly", interval: 1, day: 0 })).toBe(false);
    expect(validateRule({ freq: "monthly", interval: 1, day: 32 })).toBe(false);
    expect(validateRule({ freq: "monthly", interval: 1, day: 31 })).toBe(true);
  });
  it("recurrenceError", () => {
    expect(recurrenceError(null, null)).toBeNull();
    expect(recurrenceError({ freq: "daily", interval: 1 }, null)).toMatch(/due date/i);
    expect(recurrenceError({ freq: "weekly", interval: 1, days: [] }, "2026-10-10")).toMatch(/weekday/i);
    expect(recurrenceError({ freq: "daily", interval: 0 }, "2026-10-10")).toMatch(/1 or more/i);
    expect(recurrenceError({ freq: "daily", interval: 1 }, "2026-10-10")).toBeNull();
  });
  it("withAnchor sets monthly day only", () => {
    expect(withAnchor({ freq: "monthly", interval: 1, day: 1 }, "2026-10-17")).toEqual({ freq: "monthly", interval: 1, day: 17 });
    const d: Recurrence = { freq: "daily", interval: 1 };
    expect(withAnchor(d, "2026-10-17")).toBe(d);
    const m: Recurrence = { freq: "monthly", interval: 1, day: 5 };
    expect(withAnchor(m, null)).toBe(m);
  });
});

describe("describe", () => {
  it("describeRule", () => {
    expect(describeRule({ freq: "daily", interval: 1 })).toBe("Every day");
    expect(describeRule({ freq: "daily", interval: 3 })).toBe("Every 3 days");
    expect(describeRule({ freq: "weekly", interval: 1, days: [0, 3] })).toBe("Every week on Mon, Thu");
    expect(describeRule({ freq: "weekly", interval: 2, days: [3, 0] })).toBe("Every 2 weeks on Mon, Thu");
    expect(describeRule({ freq: "monthly", interval: 1, day: 15 })).toBe("Every month on day 15");
    expect(describeRule({ freq: "monthly", interval: 3, day: 15 })).toBe("Every 3 months on day 15");
  });
  it("describeDays", () => {
    expect(describeDays(ALL_DAYS)).toBe("Every day");
    expect(describeDays([0, 1, 2, 3, 4])).toBe("Weekdays");
    expect(describeDays([6, 5])).toBe("Weekends");
    expect(describeDays([6])).toBe("Sun");
    expect(describeDays([3, 0])).toBe("Mon, Thu");
  });
});

describe("withSchedule", () => {
  it("keeps a real schedule", () => {
    const h = { id: "h", schedule_days: [5, 6] };
    expect(withSchedule(h)).toBe(h);
  });
  it("defaults to every day when the column is missing (migration not applied) or empty", () => {
    expect(withSchedule({ id: "h" }).schedule_days).toEqual(ALL_DAYS);
    expect(withSchedule({ id: "h", schedule_days: null }).schedule_days).toEqual(ALL_DAYS);
    expect(withSchedule({ id: "h", schedule_days: [] }).schedule_days).toEqual(ALL_DAYS);
  });
});
