"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import type { GeniusType } from "@/data/traits";

interface Props {
  userName?: string | null;
  userEmail?: string | null;
  geniusType?: GeniusType | null;
}

export default function SidebarShell({ userName, userEmail, geniusType }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
          style={{ fontFamily: "var(--font-display, sans-serif)", color: "var(--gold)", letterSpacing: "0.15em" }}
        >
          NIVARRO
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
