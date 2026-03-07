"use client";

import { useRef, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
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

export default function AccountMenu({
  userName,
  userEmail,
  geniusType,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initials = getInitials(userName ?? "?");
  const genius = geniusType ? GENIUS_TYPE_INFO[geniusType] : null;

  // Close on click outside or Escape
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative px-3 pb-4 pt-3 border-t border-[#2a2a33]">
      {/* Popup panel — renders above the button */}
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-2 bg-[#1e1e24] border border-[#2a2a33] rounded-xl shadow-[0_24px_48px_rgba(0,0,0,0.6)] p-4 animate-[fadeIn_0.15s_ease] z-50">
          {/* User info */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#2a2a33]">
            <div className="w-10 h-10 rounded-full bg-[#c9a84c20] text-[#c9a84c] text-sm font-bold flex items-center justify-center ring-1 ring-[#c9a84c30] flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#e8e8ec] truncate">
                {userName ?? "Your Account"}
              </div>
              {userEmail && (
                <div className="text-xs text-[#5a5a6a] truncate">{userEmail}</div>
              )}
            </div>
          </div>

          {/* Genius type */}
          {genius ? (
            <div className="mb-4 pb-4 border-b border-[#2a2a33]">
              <div className="text-[10px] text-[#5a5a6a] uppercase tracking-wider mb-1.5">
                Genius Type
              </div>
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
                style={{
                  backgroundColor: `${genius.color}18`,
                  color: genius.color,
                  border: `1px solid ${genius.color}30`,
                }}
              >
                <span>{genius.icon}</span>
                {genius.label}
              </div>
            </div>
          ) : (
            <div className="mb-4 pb-4 border-b border-[#2a2a33]">
              <Link
                href="/quiz"
                onClick={() => setOpen(false)}
                className="text-xs text-[#c9a84c] hover:text-[#e3c06a]"
              >
                Take the Genius Quiz →
              </Link>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-0.5">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2 py-2 rounded-md text-sm text-[#9898a8] hover:text-[#e8e8ec] hover:bg-[#2a2a33] transition-colors"
            >
              <User className="w-4 h-4 flex-shrink-0" />
              Edit Profile
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm text-[#9898a8] hover:text-[#f87171] hover:bg-[#f8717110] transition-colors"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-[#1e1e2480] transition-colors group"
      >
        <div className="w-8 h-8 rounded-full bg-[#c9a84c20] text-[#c9a84c] text-xs font-bold flex items-center justify-center ring-1 ring-[#c9a84c30] flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs font-medium text-[#e8e8ec] truncate">
            {userName ?? "Account"}
          </div>
          {genius && (
            <div className="text-[10px] truncate" style={{ color: genius.color }}>
              {genius.icon} {genius.label}
            </div>
          )}
        </div>
        <ChevronUp
          className={`w-3.5 h-3.5 text-[#5a5a6a] flex-shrink-0 transition-transform duration-150 ${
            open ? "rotate-0" : "rotate-180"
          }`}
        />
      </button>
    </div>
  );
}
