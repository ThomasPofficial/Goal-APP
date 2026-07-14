"use client";

import { useRef, useEffect, useState } from "react";
import { serverSignOut } from "@/lib/auth-actions";
import Link from "next/link";
import { LogOut, User, ChevronUp } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { GENIUS_TYPE_INFO } from "@/data/traits";
import type { GeniusType } from "@/data/traits";

interface AccountMenuProps {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
}

export default function AccountMenu({ userName, userEmail, geniusType }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initials = getInitials(userName ?? "?");
  const genius = geniusType ? GENIUS_TYPE_INFO[geniusType] : null;

  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    if (open) {
      document.addEventListener("mousedown", handleOutside as EventListener);
      document.addEventListener("touchstart", handleOutside as EventListener, { passive: true });
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutside as EventListener);
      document.removeEventListener("touchstart", handleOutside as EventListener);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const avatarStyle = {
    width: 32, height: 32, borderRadius: "50%",
    background: "rgba(74,128,240,0.12)",
    color: "var(--gold)",
    fontSize: 12, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    border: "1px solid rgba(74,128,240,0.25)",
    flexShrink: 0,
  };

  return (
    <div ref={containerRef} className="relative px-3 pb-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
      {open && (
        <div
          className="absolute bottom-full left-3 right-3 mb-2 p-4 z-50"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-md)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
            animation: "fadeIn 0.15s ease",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div className="flex items-center gap-3 mb-4 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{ ...avatarStyle, width: 40, height: 40, fontSize: 14 }}>{initials}</div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>
                {userName ?? "Your Account"}
              </div>
              {userEmail && <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{userEmail}</div>}
            </div>
          </div>

          <div className="mb-4 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
            {genius ? (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
                style={{ background: `${genius.color}18`, color: genius.color, border: `1px solid ${genius.color}30` }}
              >
                <span>{genius.icon}</span>{genius.label}
              </div>
            ) : (
              <Link href="/quiz" onClick={() => setOpen(false)} className="text-xs" style={{ color: "var(--gold)" }}>
                Take the Genius Quiz →
              </Link>
            )}
          </div>

          <div className="space-y-0.5">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors"
              style={{ color: "var(--text2)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--text2)"; }}
            >
              <User className="w-4 h-4 flex-shrink-0" />Edit Profile
            </Link>
            <form action={serverSignOut} className="w-full">
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors"
                style={{ color: "var(--text2)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text2)"; }}
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />Sign out
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors"
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <div style={avatarStyle}>{initials}</div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs font-medium truncate" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>
            {userName ?? "Account"}
          </div>
          {genius && (
            <div className="text-[10px] truncate" style={{ color: genius.color }}>{genius.icon} {genius.label}</div>
          )}
        </div>
        <ChevronUp className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-0" : "rotate-180"}`} style={{ color: "var(--muted)" }} />
      </button>
    </div>
  );
}
