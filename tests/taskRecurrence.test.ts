import { describe, it, expect } from "vitest";
import { nextTaskRow } from "@/lib/taskRecurrence";
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
});
