"use client";
import { useEffect, useState } from "react";

export default function StatusBar() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleString(undefined, {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <footer className="bevel-out flex gap-1 p-1 text-xs">
      <div className="statusbar-cell flex-1">Ready.</div>
      <div className="statusbar-cell" id="statusbar-stats" />
      <div className="statusbar-cell">{now}</div>
    </footer>
  );
}
