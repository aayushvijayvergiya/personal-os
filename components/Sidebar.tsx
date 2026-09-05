"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", icon: "🖥️", label: "Dashboard" },
  { href: "/notes", icon: "🗒️", label: "Notes" },
  { href: "/journal", icon: "📓", label: "Journal" },
  { href: "/tasks", icon: "📋", label: "Tasks" },
  { href: "/goals", icon: "🎯", label: "Goals" },
  { href: "/calendar", icon: "📅", label: "Calendar" },
  { href: "/projects", icon: "📁", label: "Projects" },
  { href: "/reading", icon: "📚", label: "Reading" },
  { href: "/habits", icon: "✅", label: "Habits" },
  { href: "/vision", icon: "🌄", label: "Vision Board" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <nav className="win-window w-52 flex-shrink-0 flex flex-col">
      <div className="win-titlebar">🗂️ Personal OS</div>
      <div className="py-2 flex-1 overflow-y-auto">
        {links.map((l) => (
          <Link key={l.href} href={l.href}
            className={`sidebar-link ${path === l.href ? "sidebar-link-active" : ""}`}>
            <span>{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
