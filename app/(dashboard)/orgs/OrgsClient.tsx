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
  const [tab, setTab] = useState<"discover" | "mine">("discover");

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
      {/* Tabs */}
      <div className="flex gap-4 mb-5 border-b border-[#2a2a33]">
        {(["discover", "mine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize",
              tab === t
                ? "border-[#c9a84c] text-[#e8e8ec]"
                : "border-transparent text-[#9898a8] hover:text-[#e8e8ec]"
            )}
          >
            {t === "mine" ? "My organizations" : "Discover"}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a6a]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search organizations…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#2a2a33] bg-[#16161a] text-sm text-[#e8e8ec] placeholder-[#5a5a6a] focus:outline-none focus:border-[#c9a84c]"
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
                  : "border-[#2a2a33] text-[#9898a8] hover:border-[#3a3a44]"
              )}
              style={category === c ? { background: CATEGORY_COLORS[c] } : undefined}
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
            className="accent-[#c9a84c]"
          />
          Open only
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
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
        <div className="grid grid-cols-3 gap-4">
          {orgs.map((org) => (
            <OrgCard key={org.id} org={org} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgCard({ org }: { org: Org }) {
  const color = org.accentColor ?? CATEGORY_COLORS[org.category] ?? "#c9a84c";

  return (
    <Link href={`/orgs/${org.id}`} className="block group">
      <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl overflow-hidden hover:border-[#c9a84c] transition-all">
        {/* Banner */}
        <div
          className="h-20 flex items-end px-4 pb-3"
          style={{ background: org.heroUrl ? `url(${org.heroUrl}) center/cover` : `linear-gradient(135deg, ${color}30, ${color}10)` }}
        >
          <div
            className="w-10 h-10 rounded-lg border-2 border-[#16161a] flex items-center justify-center text-sm font-bold text-white"
            style={{ background: color }}
          >
            {org.name[0]}
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-semibold text-sm text-[#e8e8ec] truncate">{org.name}</p>
            <span
              className={cn(
                "flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                org.status === "OPEN" ? "bg-green-950 text-green-400" :
                org.status === "ROLLING" ? "bg-blue-950 text-blue-400" :
                "bg-[#1e1e24] text-[#9898a8]"
              )}
            >
              {org.status}
            </span>
          </div>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded mb-2 inline-block"
            style={{ color, background: `${color}20` }}
          >
            {org.category}
          </span>
          {org.description && (
            <p className="text-xs text-[#9898a8] line-clamp-2 leading-relaxed">
              {org.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-3 text-[11px] text-[#5a5a6a]">
            <span>Team {org.minTeamSize}–{org.maxTeamSize}</span>
            {org.deadline && <span>Due {format(new Date(org.deadline), "MMM d")}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
