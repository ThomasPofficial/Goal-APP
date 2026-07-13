"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ChevronLeft, ChevronRight, LayoutDashboard, Users, Building2, UsersRound, MessageSquare, Bell, Briefcase, Megaphone, Globe, MapPin, GraduationCap, HeartHandshake, School, ClipboardList, User } from "lucide-react";
import AccountMenu from "./AccountMenu";
import ThemeToggle from "./ThemeToggle";
import NivarroMark from "@/components/ui/NivarroMark";
import { cn } from "@/lib/utils";
import type { GeniusType } from "@/data/traits";

const STANDARD_NAV = [
  { href: "/dashboard",      label: "Dashboard",     Icon: LayoutDashboard },
  { href: "/communities",    label: "Communities",   Icon: Globe },
  { href: "/peers",          label: "Peers",         Icon: Users },
  { href: "/orgs",           label: "Organizations", Icon: Building2 },
  { href: "/teams",          label: "Teams",         Icon: UsersRound },
  { href: "/messages",       label: "Messages",      Icon: MessageSquare },
  { href: "/notifications",  label: "Notifications", Icon: Bell },
];

const SCHOOL_NAV = [
  { href: "/school/destinations", label: "Destinations",  Icon: MapPin },
  { href: "/school/alumni",       label: "Alumni Net",    Icon: GraduationCap },
  { href: "/communities",         label: "Community",     Icon: Globe },
  { href: "/school/survey",       label: "Survey",        Icon: ClipboardList },
  { href: "/campaigns",           label: "Fundraise",     Icon: HeartHandshake },
  { href: "/school/mentorship",   label: "Mentorship",    Icon: UsersRound },
  { href: "/school/roster",       label: "Roster",        Icon: Users },
];

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  myOrgId?: string | null;
  myOrgName?: string | null;
  isOrg?: boolean;
  isNivarroAdmin?: boolean;
  isSchool?: boolean;
  isWalledStudent?: boolean;
  isAlumni?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ userName, userEmail, geniusType, mobileOpen = false, onMobileClose, myOrgId, myOrgName, isOrg, isNivarroAdmin = false, isSchool = false, isWalledStudent = false, isAlumni = false, collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  const orgNav = myOrgId ? [
    { href: `/orgs/${myOrgId}`, label: myOrgName ?? "My Org", Icon: Briefcase },
    { href: "/peers",           label: "Find Students",       Icon: Users },
    { href: "/messages",        label: "Messages",            Icon: MessageSquare },
    ...(isNivarroAdmin ? [
      { href: "/admin/org-categories",   label: "Org Categories",    Icon: Building2 },
      { href: "/admin/platform-updates", label: "Platform Updates",  Icon: Megaphone },
      { href: "/admin/scraper-queue",    label: "Scraper Queue",     Icon: Bell },
    ] : []),
  ] : [];

  const studentNav = [
    ...STANDARD_NAV,
    ...(isNivarroAdmin ? SCHOOL_NAV : []),
  ];

  const walledNav = [
    { href: "/dashboard",     label: "Dashboard",      Icon: LayoutDashboard },
    { href: "/my-school",     label: "My School",      Icon: School },
    { href: "/communities",   label: "Community Chat", Icon: Globe },
    { href: "/mentorship",    label: "Mentorship",     Icon: HeartHandshake },
    ...(isAlumni ? [{ href: "/profile", label: "Profile", Icon: User }] : []),
    { href: "/notifications", label: "Notifications",  Icon: Bell },
  ];

  const navItems = isSchool ? SCHOOL_NAV : isOrg ? orgNav : isWalledStudent ? walledNav : studentNav;
  const homeHref = isSchool ? "/school/destinations" : isOrg && myOrgId ? `/orgs/${myOrgId}` : "/dashboard";

  const isActive = (href: string) => {
    if (isOrg && myOrgId && href === `/orgs/${myOrgId}`) return pathname.startsWith(`/orgs/${myOrgId}`);
    if (!isOrg && href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const w = collapsed ? 56 : 220;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full flex flex-col z-40 transition-all duration-250",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
      style={{
        width: w,
        background: "var(--n-bg2)",
        borderRight: "1px solid rgba(255,255,255,0.04)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          height: 56,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          padding: collapsed ? "0 12px" : "0 12px 0 20px",
          justifyContent: collapsed ? "center" : "space-between",
        }}
      >
        {collapsed ? (
          <Link href={homeHref} onClick={onMobileClose} style={{ textDecoration: "none" }}>
            <NivarroMark size={20} color="var(--blue)" />
          </Link>
        ) : (
          <>
            <Link href={homeHref} onClick={onMobileClose} className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
              <NivarroMark size={20} color="var(--n-text)" />
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  letterSpacing: "0.12em",
                  color: "var(--n-text)",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
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
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto" style={{ padding: collapsed ? "12px 0" : "12px 8px" }}>
        {navItems.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              title={collapsed ? label : undefined}
              className={cn("relative flex items-center transition-all", active && "nav-active")}
              style={{
                height: 36,
                gap: collapsed ? 0 : 10,
                padding: collapsed ? "0" : "0 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: "transparent",
                color: active ? "var(--n-text)" : "var(--n-text2)",
                fontFamily: "var(--font-body)",
                fontWeight: active ? 600 : 400,
                fontSize: 13,
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
              <Icon className="flex-shrink-0" size={15} />
              {!collapsed && (
                <span className="sidebar-collapsed-label" style={{ maxWidth: 140, opacity: 1 }}>
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={onToggleCollapse}
        className="hidden md:flex items-center justify-center flex-shrink-0"
        style={{
          height: 32,
          background: "none",
          border: "none",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          cursor: "pointer",
          color: "var(--n-muted)",
          width: "100%",
        }}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* Footer */}
      {!collapsed && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} className="md:pb-0 pb-[60px]">
          <div className="px-2 pt-2 pb-0">
            <ThemeToggle />
          </div>
          <AccountMenu
            userName={userName}
            userEmail={userEmail}
            geniusType={geniusType}
            isSchool={isSchool}
          />
        </div>
      )}
      {collapsed && (
        <div className="flex flex-col items-center gap-1 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <ThemeToggle compact />
        </div>
      )}
    </aside>
  );
}
