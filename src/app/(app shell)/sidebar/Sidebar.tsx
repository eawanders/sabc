// src/app/(app shell)/sidebar/Sidebar.tsx
"use client";

import NavItem from "./NavItem";
import { usePathname } from "next/navigation";

/** Simple placeholder icons using currentColor */
function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" />
      <path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const isSchedule = pathname?.startsWith("/schedule");

  return (
    <aside
      aria-label="Primary"
      className="
        sticky top-0 h-screen flex-none
        w-[var(--sidebar-width)]
        flex flex-col gap-2
        bg-surface text-foreground
        border-r border-border shadow
      "
    >
      {/* Brand */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-brand" />
          {/* Always show label */}
          <div className="text-heading font-extrabold">
            SABC
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 py-2 flex flex-col gap-1">
        <NavItem
          href="/schedule"
          label="Schedule"
          icon={<CalendarIcon />}
          active={!!isSchedule}
        />
        {/* Add more items as you grow:
        <NavItem href="/settings" label="Settings" icon={<CogIcon />} active={pathname==="/settings"} />
        */}
      </nav>
    </aside>
  );
}