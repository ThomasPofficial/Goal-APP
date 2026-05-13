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
    <aside
      className="fixed left-0 top-0 h-full w-[220px] flex flex-col z-40"
      style={{
        background: "var(--n-bg2)",
        borderRight: "1px solid var(--border-md)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center px-5 h-14 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="text-xl font-black tracking-widest uppercase"
          style={{
            fontFamily: "var(--font-display, 'Syne', sans-serif)",
            color: "var(--gold)",
            letterSpacing: "0.15em",
          }}
        >
          NIVARRO
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--muted)", fontFamily: "var(--font-display, sans-serif)" }}
        >
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
              )}
              style={{
                borderLeftColor: active ? "var(--gold)" : "transparent",
                background: active ? "rgba(201,168,76,0.07)" : "transparent",
                color: active ? "var(--gold)" : "var(--text2)",
                fontFamily: "var(--font-body, sans-serif)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(201,168,76,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text2)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                }
              }}
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
