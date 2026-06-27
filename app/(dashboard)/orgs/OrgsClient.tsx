"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Building2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Org {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: string;
  status: string;
  heroUrl: string | null;
  accentColor: string | null;
  minTeamSize: number;
  maxTeamSize: number;
  gradeEligibility: string | null;
  deadline: string | null;
  logoLetter: string | null;
  logoBg: string | null;
  logoColor: string | null;
  bannerGradient: string | null;
  focusTags: string;
  verified: boolean;
  _count: { teams: number };
}

const CATEGORIES = ["ACCELERATOR", "FELLOWSHIP", "INTERNSHIP", "COMPETITION", "BOOTCAMP", "RESEARCH", "CLUB"];

const CATEGORY_COLORS: Record<string, string> = {
  ACCELERATOR: "#F59E0B",
  FELLOWSHIP: "#6366F1",
  INTERNSHIP: "#14B8A6",
  COMPETITION: "#F97316",
  BOOTCAMP: "#8B5CF6",
  RESEARCH: "#06B6D4",
  CLUB: "#10B981",
};

export default function OrgsClient() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      if (category) params.set("category", category);
      if (openOnly) params.set("open", "1");
      const res = await fetch(`/api/orgs?${params}`);
      const data = await res.json();
      setOrgs(data.orgs ?? []);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, category, openOnly]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search organizations…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm focus:outline-none"
            style={{ borderColor: "var(--border-md)", background: "var(--surface2)", color: "var(--text)" }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? null : c)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                category === c
                  ? "text-white border-transparent"
                  : "text-[#9898a8]"
              )}
              style={category === c ? { background: CATEGORY_COLORS[c] } : { borderColor: "var(--border-md)" }}
            >
              {c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-[#9898a8] cursor-pointer">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="accent-[#4a80f0]"
          />
          Open only
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="h-52 rounded-xl bg-[#16161a] animate-pulse" />
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="w-8 h-8 text-[#2a2a33] mx-auto mb-3" />
          <p className="text-sm text-[#9898a8]">No organizations found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <OrgCard key={org.id} org={org} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgCard({ org }: { org: Org }) {
  const color = org.accentColor ?? CATEGORY_COLORS[org.category] ?? "#1060d8";
  const bannerBg = org.heroUrl
    ? `url(${org.heroUrl}) center/cover`
    : org.bannerGradient
    ? org.bannerGradient
    : `linear-gradient(135deg, ${color}25 0%, #030609 100%)`;

  const focusTags: string[] = (() => { try { return JSON.parse(org.focusTags || "[]"); } catch { return []; } })();

  return (
    <Link href={`/orgs/${org.id}`} className="block group">
      <div
        className="card rounded-xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-md)",
        }}
      >
        {/* Banner */}
        <div className="h-20 relative" style={{ background: bannerBg }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(6,13,26,0.9) 100%)" }} />
          <div
            className="absolute bottom-3 left-4 w-10 h-10 rounded-lg border-2 flex items-center justify-center text-sm font-bold"
            style={{
              background: org.logoBg ?? color,
              color: org.logoColor ?? "#fff",
              borderColor: "var(--surface)",
              fontSize: 16,
            }}
          >
            {org.logoLetter ?? org.name[0]}
          </div>
        </div>

        <div className="p-4 pt-3">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-semibold truncate" style={{ color: "var(--text)", fontSize: 15 }}>
                {org.name}
              </p>
              {org.verified && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0" title="Verified organization">
                  <circle cx="7" cy="7" r="7" fill="var(--amber)" />
                  <path d="M4 7l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span
              className={cn(
                "flex-shrink-0 text-[10px] font-mono font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded",
                org.status === "OPEN" ? "bg-green-950 text-green-400" :
                org.status === "ROLLING" ? "bg-blue-950 text-blue-400" : ""
              )}
              style={org.status !== "OPEN" && org.status !== "ROLLING"
                ? { background: "var(--surface3)", color: "var(--muted)" }
                : undefined}
            >
              {org.status}
            </span>

          </div>
          {org.tagline && (
            <p className="text-[11px] line-clamp-1 mb-1.5" style={{ color: "var(--muted)" }}>
              {org.tagline}
            </p>
          )}
          {focusTags.length > 0 ? (
            <div className="flex flex-wrap gap-1 mb-2">
              {focusTags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(232,137,58,0.1)", border: "1px solid rgba(232,137,58,0.25)", color: "var(--amber)" }}>
                  {tag}
                </span>
              ))}
            </div>
          ) : org.description ? (
            <p className="text-xs line-clamp-2 leading-relaxed mb-2" style={{ color: "var(--text2)" }}>
              {org.description}
            </p>
          ) : null}
          <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--muted)" }}>
            <span>Team {org.minTeamSize}–{org.maxTeamSize}</span>
            {org.deadline && <span>Due {format(new Date(org.deadline), "MMM d")}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
