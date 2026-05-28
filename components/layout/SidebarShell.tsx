"use client";

import { useState } from "react";
import { Menu, LayoutDashboard, Users, Building2, UsersRound, MessageSquare, Briefcase } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import type { GeniusType } from "@/data/traits";

interface Props {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
  myOrgId?: string | null;
  myOrgName?: string | null;
  isOrg?: boolean;
}

const STUDENT_BOTTOM_TABS = [
  { href: "/dashboard", label: "Home",     Icon: LayoutDashboard },
  { href: "/peers",     label: "Peers",    Icon: Users },
  { href: "/orgs",      label: "Orgs",     Icon: Building2 },
  { href: "/teams",     label: "Teams",    Icon: UsersRound },
  { href: "/messages",  label: "Messages", Icon: MessageSquare },
];

export default function SidebarShell({ userName, userEmail, geniusType, myOrgId, myOrgName, isOrg }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const orgHomeHref = myOrgId ? `/orgs/${myOrgId}` : "/dashboard";

  const ORG_BOTTOM_TABS = [
    { href: orgHomeHref, label: "Dashboard", Icon: Briefcase },
    { href: "/peers",    label: "Students",  Icon: Users },
    { href: "/messages", label: "Messages",  Icon: MessageSquare },
  ];

  const bottomTabs = isOrg ? ORG_BOTTOM_TABS : STUDENT_BOTTOM_TABS;

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: 56,
          background: "var(--n-bg2)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link href={isOrg ? orgHomeHref : "/dashboard"} style={{ textDecoration: "none" }}>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              color: "var(--text)",
            }}
          >
            Ni<span style={{ color: "var(--blue)" }}>varro</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg"
            style={{ color: "var(--text2)", background: "none", border: "none", cursor: "pointer" }}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
        style={{
          height: 60,
          background: "var(--n-bg2)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {bottomTabs.map(({ href, label, Icon }) => {
          const active = isOrg
            ? pathname.startsWith(href) || (href === orgHomeHref && pathname.startsWith("/orgs/"))
            : href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
              style={{ color: active ? "var(--blue)" : "var(--muted)", textDecoration: "none" }}
            >
              <Icon className="w-5 h-5" />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.01em" }}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Overlay — mobile only */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        userName={userName}
        userEmail={userEmail}
        geniusType={geniusType}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        myOrgId={myOrgId}
        myOrgName={myOrgName}
        isOrg={isOrg}
      />
    </>
  );
}
