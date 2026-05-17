"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import AccountMenu from "./AccountMenu";
import { cn } from "@/lib/utils";
import type { GeniusType } from "@/data/traits";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/peers", label: "Peers" },
  { href: "/orgs", label: "Orgs" },
  { href: "/teams", label: "Teams" },
  { href: "/messages", label: "Messages" },
  { href: "/notifications", label: "Notifications" },
];

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ userName, userEmail, geniusType, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full w-[220px] flex flex-col z-40 transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
      style={{
        background: "var(--n-bg2)",
        borderRight: "1px solid var(--border-md)",
      }}
    >
      <div
        className="flex items-center justify-between px-5 h-14 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: "-0.3px",
            color: "#f0f8ff",
          }}
        >
          Nivarro
        </span>
        <button
          onClick={onMobileClose}
          className="md:hidden w-7 h-7 flex items-center justify-center rounded-md"
          style={{ color: "var(--muted)" }}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

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
              onClick={onMobileClose}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all border-l-2",
              )}
              style={{
                borderLeftColor: active ? "var(--gold)" : "transparent",
                background: active ? "rgba(74,128,240,0.07)" : "transparent",
                color: active ? "var(--gold)" : "var(--text2)",
                fontFamily: "var(--font-body, sans-serif)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(74,128,240,0.04)";
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

      <div className="md:pb-0 pb-[60px]">
        <AccountMenu
          userName={userName}
          userEmail={userEmail}
          geniusType={geniusType}
        />
      </div>
    </aside>
  );
}
