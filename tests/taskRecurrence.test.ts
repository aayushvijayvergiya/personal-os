import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nextTaskRow, spawnNext } from "@/lib/taskRecurrence";
import type { Task } from "@/lib/types";

const base: Task = {
  id: "t1", title: "Water plants", description: "front room", due_date: "2026-10-05",
  priority: 1, status: "done", completed_at: "2026-10-05T12:00:00Z", project_id: null,
  custom_fields: { a: 1 }, created_at: "2026-09-01T00:00:00Z",
  recurrence: { freq: "weekly", interval: 1, days: [0] },
};

describe("nextTaskRow", () => {
  it("null for one-time tasks", () => {
    expect(nextTaskRow({ ...base, recurrence: null }, "2026-10-05")).toBeNull();
  });
  it("null for a repeating task with no due date", () => {
    expect(nextTaskRow({ ...base, due_date: null }, "2026-10-05")).toBeNull();
  });
  it("copies fields, reopens, and schedules from the due date", () => {
    expect(nextTaskRow(base, "2026-10-05")).toEqual({
      title: "Water plants", description: "front room", priority: 1, project_id: null,
      custom_fields: { a: 1 }, recurrence: base.recurrence, status: "open", due_date: "2026-10-12",
    });
  });
  it("completed early: next is after the (future) due date", () => {
    expect(nextTaskRow({ ...base, due_date: "2026-10-12" }, "2026-10-08")!.due_date).toBe("2026-10-19");
  });
  it("completed weeks late: next is in the future, not another overdue date", () => {
    expect(nextTaskRow(base, "2026-10-28")!.due_date).toBe("2026-11-02"); // Wed 10-28 -> next Mon
  });

  it("late monthly task keeps the monthly schedule (this month's date, if still ahead)", () => {
    const t = { ...base, recurrence: { freq: "monthly" as const, interval: 1, day: 20 }, due_date: "2026-01-20" };
    expect(nextTaskRow(t, "2026-02-05")!.due_date).toBe("2026-02-20");
  });
  it("late month-end task lands on the clamped month end", () => {
    const t = { ...base, recurrence: { freq: "monthly" as const, interval: 1, day: 31 }, due_date: "2026-01-31" };
    expect(nextTaskRow(t, "2026-02-01")!.due_date).toBe("2026-02-28");
  });
  it("late fortnightly task keeps its two-week phase", () => {
    const t = { ...base, recurrence: { freq: "weekly" as const, interval: 2, days: [0] }, due_date: "2026-01-05" };
    expect(nextTaskRow(t, "2026-01-14")!.due_date).toBe("2026-01-19");
  });
  it("late every-3-days task keeps its phase", () => {
    const t = { ...base, recurrence: { freq: "daily" as const, interval: 3 }, due_date: "2026-01-01" };
    expect(nextTaskRow(t, "2026-01-05")!.due_date).toBe("2026-01-07");
  });
});

/** Minimal chainable stand-in for the supabase-js query builder: `existing` is what the duplicate check finds. */
function fakeClient(existing: unknown[]) {
  const inserted: unknown[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {
    select: () => q, eq: () => q, neq: () => q, is: () => q,
    limit: () => Promise.resolve({ data: existing, error: null }),
    insert: (row: unknown) => { inserted.push(row); return Promise.resolve({ error: null }); },
  };
  return { client: { from: () => q } as unknown as SupabaseClient, inserted };
}

describe("spawnNext", () => {
  it("inserts the next occurrence", async () => {
    const { client, inserted } = fakeClient([]);
    expect(await spawnNext(client, base, "2026-10-05")).toBeNull();
    expect(inserted).toHaveLength(1);
  });
  it("skips when an identical open occurrence already exists (complete → reopen → complete)", async () => {
    const { client, inserted } = fakeClient([{ id: "already-there" }]);
    expect(await spawnNext(client, base, "2026-10-05")).toBeNull();
    expect(inserted).toHaveLength(0);
  });
});
