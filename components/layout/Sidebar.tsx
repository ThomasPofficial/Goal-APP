"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountMenu from "./AccountMenu";
<<<<<<< Updated upstream
import {
  LayoutDashboard,
  Users,
  Building2,
  Users2,
  MessageSquare,
} from "lucide-react";
=======
>>>>>>> Stashed changes
import { cn } from "@/lib/utils";
import type { GeniusType } from "@/data/traits";

const navItems = [
<<<<<<< Updated upstream
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/peers", icon: Users, label: "Peers" },
  { href: "/orgs", icon: Building2, label: "Orgs" },
  { href: "/team", icon: Users2, label: "Teams" },
  { href: "/messages", icon: MessageSquare, label: "Messages" },
=======
  { href: "/dashboard", label: "Dashboard" },
  { href: "/peers", label: "Peers" },
  { href: "/orgs", label: "Orgs" },
  { href: "/teams", label: "Teams" },
  { href: "/messages", label: "Messages" },
>>>>>>> Stashed changes
];

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
}

export default function Sidebar({ userName, userEmail, geniusType }: SidebarProps) {
  const pathname = usePathname();

  return (
<<<<<<< Updated upstream
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-[#0d0d0e] border-r border-[#1c1c20] flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-[#1c1c20] flex-shrink-0">
        <div className="w-7 h-7 rounded-md bg-[#c9a84c] flex items-center justify-center flex-shrink-0">
          <span className="text-[#080809] font-bold text-sm">N</span>
        </div>
        <span className="font-semibold text-[#c9a84c] tracking-wide">NIVARRO</span>
=======
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-[#0f0f11] border-r border-[#1e1e24] flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center px-5 h-14 border-b border-[#1e1e24] flex-shrink-0">
        <span
          className="text-xl font-bold tracking-widest"
          style={{ color: "#c9a84c", letterSpacing: "0.18em" }}
        >
          NIVARRO
        </span>
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
                  ? "bg-[#131315] text-[#eaeaea] border-l-2 border-[#c9a84c] pl-[10px]"
                  : "text-[#909098] hover:text-[#eaeaea] hover:bg-[#13131580]"
=======
                  ? "border-[#c9a84c] bg-[#c9a84c08] text-[#c9a84c]"
                  : "border-transparent text-[#5a5a6a] hover:text-[#9898a8] hover:bg-[#16161a]"
>>>>>>> Stashed changes
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
