"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import AccountMenu from "./AccountMenu";
import ThemeToggle from "./ThemeToggle";
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
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Header — wordmark + close (mobile) */}
      <div
        className="flex items-center justify-between px-5 flex-shrink-0"
        style={{ height: 56, borderBottom: "1px solid var(--border)" }}
      >
        <Link href="/dashboard" onClick={onMobileClose} style={{ textDecoration: "none" }}>
          <span className="logo-text" style={{ fontSize: 18, color: "var(--text)" }}>
            Ni<span className="logo-accent">varro</span>
          </span>
        </Link>
        <button
          onClick={onMobileClose}
          className="md:hidden w-7 h-7 flex items-center justify-center rounded-md"
          style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
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
              className={cn("flex items-center px-3 py-2 rounded-md text-sm font-semibold transition-all", active && "nav-active")}
              style={{
                background: active ? "rgba(59,130,246,0.1)" : "transparent",
                color: active ? "var(--blue)" : "var(--text2)",
                fontFamily: "'Plus Jakarta Sans', var(--font-body, sans-serif)",
                letterSpacing: "-0.01em",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface2)";
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

      {/* Footer — theme toggle + account */}
      <div style={{ borderTop: "1px solid var(--border)" }} className="md:pb-0 pb-[60px]">
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
