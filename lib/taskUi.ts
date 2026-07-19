export const PRIORITY_OPTS = [
  { value: "1", label: "P1" }, { value: "2", label: "P2" }, { value: "3", label: "P3" },
];

export function priorityClass(p: number) {
  return p === 1 ? "text-[#aa0000] font-bold" : p === 3 ? "text-[#666666]" : "";
}
