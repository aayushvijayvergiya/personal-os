interface Datable { due_date: string | null; sort_order: number }

// Soonest due first, undated last, then the shelf's own sort_order. Array.sort is stable,
// so items that tie on both keys keep the order the query returned them in.
export function sortReadingItems<T extends Datable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }
    return a.sort_order - b.sort_order;
  });
}

export function isOverdue(item: { due_date: string | null; status: string }, todayIso: string): boolean {
  return !!item.due_date && item.status !== "finished" && item.due_date < todayIso;
}
