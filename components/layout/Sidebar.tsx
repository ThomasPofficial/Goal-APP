"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import AccountMenu from "./AccountMenu";
import ThemeToggle from "./ThemeToggle";
import NivarroMark from "@/components/ui/NivarroMark";
import { cn } from "@/lib/utils";
import type { GeniusType } from "@/data/traits";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/peers",     label: "Peers" },
  { href: "/orgs",      label: "Orgs" },
  { href: "/teams",     label: "Teams" },
  { href: "/messages",  label: "Messages" },
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
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Header — wordmark */}
      <div
        className="flex items-center justify-between px-5 flex-shrink-0"
        style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Link href="/dashboard" onClick={onMobileClose} className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
          <NivarroMark size={22} color="var(--n-text)" />
          <span
            className="logo-text"
            style={{ fontSize: 14, letterSpacing: "0.12em", color: "var(--n-text)", fontFamily: "var(--font-display)", textTransform: "uppercase", fontWeight: 700 }}
          >
            NI<span style={{ color: "var(--blue)" }}>VARRO</span>
          </span>
        </Link>
        <button
          onClick={onMobileClose}
          className="md:hidden w-7 h-7 flex items-center justify-center"
          style={{ color: "var(--n-muted)", background: "none", border: "none", cursor: "pointer" }}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
              className={cn("relative flex items-center px-3 py-2 text-sm transition-all", active && "nav-active")}
              style={{
                background: "transparent",
                color: active ? "var(--n-text)" : "var(--n-text2)",
                fontFamily: "var(--font-display)",
                fontWeight: active ? 600 : 400,
                letterSpacing: "-0.01em",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "var(--n-text)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "var(--n-text2)";
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer — theme toggle + account */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} className="md:pb-0 pb-[60px]">
        <div className="px-3 pt-2 pb-0">
          <ThemeToggle />
        </div>
        <AccountMenu
          userName={userName}
          userEmail={userEmail}
          geniusType={geniusType}
        />
      </div>
    </aside>
  );
}
