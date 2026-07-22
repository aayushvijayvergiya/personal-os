import type { HorizonType } from "./types";
import { fmt } from "./dates";

export function currentValues(todayIso: string): { month: string; quarter: string; year: string } {
  const [y, m] = todayIso.split("-").map(Number);
  return { month: `${y}-${String(m).padStart(2, "0")}`, quarter: `${y}-Q${Math.ceil(m / 3)}`, year: `${y}` };
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function horizonLabel(type: HorizonType, value: string): string {
  if (type === "date") return fmt(value);
  if (type === "month") { const [y, m] = value.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; }
  if (type === "quarter") { const [y, q] = value.split("-"); return `${q} ${y}`; }
  return value;
}

export function groupGoals<T extends { horizon_type: HorizonType; horizon_value: string }>(
  goals: T[]
): { date: T[]; month: T[]; quarter: T[]; year: T[] } {
  const out = { date: [] as T[], month: [] as T[], quarter: [] as T[], year: [] as T[] };
  for (const g of goals) out[g.horizon_type].push(g);
  for (const k of Object.keys(out) as (keyof typeof out)[])
    out[k].sort((a, b) => a.horizon_value.localeCompare(b.horizon_value));
  return out;
}

export function isCurrent(type: HorizonType, value: string, todayIso: string): boolean {
  const cur = currentValues(todayIso);
  if (type === "date") return value === todayIso;
  return value === cur[type];
}

export function isPast(type: HorizonType, value: string, todayIso: string): boolean {
  const cur = currentValues(todayIso);
  if (type === "date") return value < todayIso;
  return value < cur[type];
}
