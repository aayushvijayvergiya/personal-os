"use client";
import React from "react";

export function Window({ title, icon, actions, children, className = "" }: {
  title: string; icon?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`win-window ${className}`}>
      <div className="win-titlebar">
        <span>{icon ? `${icon} ` : ""}{title}</span>
        {actions && <span className="flex gap-1">{actions}</span>}
      </div>
      <div className="win-body">{children}</div>
    </div>
  );
}

export function Btn({ primary, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button className={`win-btn ${primary ? "win-btn-primary" : ""} ${className}`} {...props} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="win-input" {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="win-textarea" rows={3} {...props} />;
}

export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
}) {
  return (
    <select className="win-select" {...props}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input type="checkbox" className="h-4 w-4 accent-[#000080]" checked={checked}
        onChange={(e) => onChange(e.target.checked)} />
      {label && <span>{label}</span>}
    </label>
  );
}

export function TabBar({ tabs, active, onSelect }: {
  tabs: { key: string; label: string }[]; active: string; onSelect: (k: string) => void;
}) {
  return (
    <div className="win-tabbar">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onSelect(t.key)}
          className={`win-tab ${active === t.key ? "win-tab-active" : ""}`}>{t.label}</button>
      ))}
    </div>
  );
}

export function Dialog({ title, open, onClose, children }: {
  title: string; open: boolean; onClose: () => void; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onMouseDown={onClose}>
      <div className="win-window w-[420px] max-w-[92vw]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="win-titlebar">
          <span>{title}</span>
          <button className="win-btn px-2 py-0 text-xs leading-none" onClick={onClose}>✕</button>
        </div>
        <div className="win-body max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
