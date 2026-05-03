"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountMenu from "./AccountMenu";
import { cn } from "@/lib/utils";
import type { GeniusType } from "@/data/traits";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/peers", label: "Peers" },
  { href: "/orgs", label: "Orgs" },
  { href: "/teams", label: "Teams" },
  { href: "/messages", label: "Messages" },
];

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
}

export default function Sidebar({ userName, userEmail, geniusType }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-[#0f0f11] border-r border-[#1e1e24] flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center px-5 h-14 border-b border-[#1e1e24] flex-shrink-0">
        <span
          className="text-xl font-bold tracking-widest"
          style={{ color: "#c9a84c", letterSpacing: "0.18em" }}
        >
          NIVARRO
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-3 text-[10px] font-semibold text-[#3a3a44] uppercase tracking-widest">
          Navigation
        </p>
        {navItems.map(({ href, label }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all border-l-2",
                active
                  ? "border-[#c9a84c] bg-[#c9a84c08] text-[#c9a84c]"
                  : "border-transparent text-[#5a5a6a] hover:text-[#9898a8] hover:bg-[#16161a]"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Account section */}
      <AccountMenu
        userName={userName}
        userEmail={userEmail}
        geniusType={geniusType}
      />
    </aside>
  );
}
