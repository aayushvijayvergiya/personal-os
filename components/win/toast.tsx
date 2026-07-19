"use client";
import { useEffect, useState } from "react";

let push: ((msg: string) => void) | null = null;
export function showToast(msg: string) { push?.(msg); }

export function Toaster() {
  const [msgs, setMsgs] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    push = (msg) => {
      const id = Date.now() + Math.random();
      setMsgs((m) => [...m, { id, msg }]);
      setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 4000);
    };
    return () => { push = null; };
  }, []);
  return (
    <div className="fixed bottom-10 right-3 z-[100] flex flex-col gap-2">
      {msgs.map((m) => (
        <div key={m.id} className="win-window w-72">
          <div className="win-titlebar">⚠️ Personal OS</div>
          <div className="win-body text-xs">{m.msg}</div>
        </div>
      ))}
    </div>
  );
}
