export function toISO(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function todayISO(): string { return toISO(new Date()); }
export function addDays(iso: string, n: number): string {
  const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d);
}
export function weekStart(iso: string): string {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  return addDays(iso, -dow);
}
export function weekDates(iso: string): string[] {
  const start = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
export function weekRange(iso: string): { start: string; end: string } {
  const start = weekStart(iso);
  return { start, end: addDays(start, 6) };
}
export function monthRange(iso: string): { start: string; end: string } {
  const d = fromISO(iso);
  return {
    start: toISO(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}
export function monthGridDates(iso: string): string[] {
  const first = monthRange(iso).start;
  const gridStart = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}
export function isoWeekLabel(iso: string): string {
  const thursday = fromISO(weekStart(iso));
  thursday.setDate(thursday.getDate() + 3); // Thursday determines ISO week-year
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const week = Math.round((thursday.getTime() - week1Monday.getTime()) / (7 * 86400000)) + 1;
  return `Week ${week}, ${year}`;
}
export function fmt(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
