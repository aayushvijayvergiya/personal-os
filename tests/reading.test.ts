import { describe, it, expect } from "vitest";
import { isOverdue, sortReadingItems } from "@/lib/reading";

const item = (id: string, due_date: string | null, sort_order = 0) => ({ id, due_date, sort_order });

describe("sortReadingItems", () => {
  it("orders soonest due first", () => {
    const out = sortReadingItems([item("a", "2026-09-20"), item("b", "2026-09-08")]);
    expect(out.map((i) => i.id)).toEqual(["b", "a"]);
  });
  it("puts undated items last", () => {
    const out = sortReadingItems([item("a", null), item("b", "2026-09-20")]);
    expect(out.map((i) => i.id)).toEqual(["b", "a"]);
  });
  it("falls back to sort_order when due dates match", () => {
    const out = sortReadingItems([item("a", "2026-09-08", 2), item("b", "2026-09-08", 1)]);
    expect(out.map((i) => i.id)).toEqual(["b", "a"]);
  });
  it("keeps incoming order for undated items with equal sort_order", () => {
    const out = sortReadingItems([item("a", null), item("b", null)]);
    expect(out.map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("does not mutate the input array", () => {
    const input = [item("a", "2026-09-20"), item("b", "2026-09-08")];
    sortReadingItems(input);
    expect(input.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("isOverdue", () => {
  it("past due and unfinished is overdue", () => {
    expect(isOverdue({ due_date: "2026-09-04", status: "to_read" }, "2026-09-05")).toBe(true);
  });
  it("due today is not overdue", () => {
    expect(isOverdue({ due_date: "2026-09-05", status: "to_read" }, "2026-09-05")).toBe(false);
  });
  it("finished items are never overdue", () => {
    expect(isOverdue({ due_date: "2026-09-04", status: "finished" }, "2026-09-05")).toBe(false);
  });
  it("undated items are never overdue", () => {
    expect(isOverdue({ due_date: null, status: "to_read" }, "2026-09-05")).toBe(false);
  });
});
