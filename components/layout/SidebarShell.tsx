"use client";

import { useState } from "react";
import { Menu, LayoutDashboard, Users, Building2, UsersRound, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import type { GeniusType } from "@/data/traits";

interface Props {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
}

const BOTTOM_TABS = [
  { href: "/dashboard", label: "Home", Icon: LayoutDashboard },
  { href: "/peers", label: "Peers", Icon: Users },
  { href: "/orgs", label: "Orgs", Icon: Building2 },
  { href: "/teams", label: "Teams", Icon: UsersRound },
  { href: "/messages", label: "Messages", Icon: MessageSquare },
];

export default function SidebarShell({ userName, userEmail, geniusType }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile top bar — hidden on md+ */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: 56,
          background: "var(--n-bg2)",
          borderBottom: "1px solid var(--border-md)",
        }}
      >
        <span
          className="text-lg font-black tracking-widest uppercase"
          style={{ fontFamily: "var(--font-display, sans-serif)", letterSpacing: "0.15em" }}
        >
          <span style={{ color: "var(--text)" }}>Ni</span><span style={{ color: "var(--blue)" }}>varro</span>
        </span>
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg"
          style={{ color: "var(--text2)" }}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile bottom tab bar — hidden on md+ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
        style={{
          height: 60,
          background: "var(--n-bg2)",
          borderTop: "1px solid var(--border-md)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {BOTTOM_TABS.map(({ href, label, Icon }) => {
          const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
              style={{ color: active ? "var(--blue)" : "var(--muted)" }}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Overlay — mobile only */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        userName={userName}
        userEmail={userEmail}
        geniusType={geniusType}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
    </>
  );
}
