"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, ChevronRight, Save } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  geniusType: GeniusTypeKey | null;
  secondaryGeniusType: GeniusTypeKey | null;
  currentFocus: string | null;
  savedCount: number;
}

interface SpaceRow {
  id: string;
  name: string;
  hasUnread: boolean;
}

interface TickerItem {
  id: string;
  title: string;
  category: string;
  deadline: string | null;
  org: { id: string; name: string };
}

interface OpportunityCard {
  id: string;
  title: string;
  description: string | null;
  category: string;
  deadline: string | null;
  isRemote: boolean;
  saved: boolean;
  org: { id: string; name: string; heroUrl: string | null; accentColor: string | null };
  gradeEligibility: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  ACCELERATOR: "#F59E0B",
  FELLOWSHIP: "#6366F1",
  INTERNSHIP: "#14B8A6",
  COMPETITION: "#F97316",
  BOOTCAMP: "#8B5CF6",
  RESEARCH: "#06B6D4",
  CLUB: "#10B981",
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardClient({ profile, spaces, traitsDone }: { profile: ProfileData; spaces: SpaceRow[]; traitsDone: boolean }) {
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [opportunities, setOpportunities] = useState<OpportunityCard[]>([]);
  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const typeInfo = profile.geniusType ? GENIUS_TYPES[profile.geniusType] : null;

  const fetchTicker = useCallback(async () => {
    try {
      const res = await fetch("/api/opportunities/ticker");
      const data = await res.json();
      setTicker(data.opportunities ?? []);
    } catch {}
  }, []);

  const fetchFeed = useCallback(async (p: number, filter: string, replace = false) => {
    if (p === 1) setFeedLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filter !== "ALL") params.set("category", filter);
      const res = await fetch(`/api/opportunities/recommended?${params}`);
      const data = await res.json();
      setOpportunities((prev) => replace ? data.opportunities : [...prev, ...data.opportunities]);
      setHasMore(p < data.pages);
    } catch {} finally {
      setFeedLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchTicker(); }, [fetchTicker]);
  useEffect(() => {
    setPage(1);
    fetchFeed(1, activeFilter, true);
  }, [activeFilter, fetchFeed]);

  useEffect(() => {
    const id = setInterval(fetchTicker, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchTicker]);

  const sendFeedback = async () => {
    if (!feedback.trim()) return;
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: feedback }),
    });
    setFeedback("");
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 3000);
  };

  const toggleSave = async (id: string, currentlySaved: boolean) => {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, saved: !currentlySaved } : o))
    );
    try {
      if (currentlySaved) {
        await fetch(`/api/opportunities/${id}/save`, { method: "DELETE" });
      } else {
        await fetch(`/api/opportunities/${id}/save`, { method: "POST" });
      }
    } catch {
      setOpportunities((prev) =>
        prev.map((o) => (o.id === id ? { ...o, saved: currentlySaved } : o))
      );
    }
  };

  const FILTERS = ["ALL", "INTERNSHIP", "FELLOWSHIP", "COMPETITION", "ACCELERATOR", "BOOTCAMP", "RESEARCH"];

  return (
    <div className="flex gap-6 min-h-0">
      {/* ── Left column ─────────────────────────────────────────────────────── */}
      <div className="w-[300px] flex-shrink-0 space-y-4">

        {/* Identity panel */}
        <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <Avatar
              src={profile.avatarUrl}
              name={profile.displayName}
              geniusType={profile.geniusType}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#e8e8ec] truncate">{profile.displayName}</p>
              {profile.handle && (
                <p className="text-xs text-[#9898a8]">@{profile.handle}</p>
              )}
              {profile.geniusType && (
                <GeniusTypeBadge type={profile.geniusType} size="sm" className="mt-1" />
              )}
            </div>
          </div>

          {profile.currentFocus && typeInfo && (
            <div
              className="border-l-4 pl-3 py-1 mb-3 text-xs text-[#9898a8] italic leading-relaxed"
              style={{ borderColor: typeInfo.color }}
            >
              {profile.currentFocus}
            </div>
          )}

          <div className="flex gap-4 text-center mb-4">
            <div>
              <p className="text-sm font-semibold text-[#e8e8ec]">{profile.savedCount}</p>
              <p className="text-[11px] text-[#5a5a6a]">Saved</p>
            </div>
          </div>

          <Link
            href="/profile/me"
            className="block w-full text-center text-xs font-medium py-2 rounded-lg border border-[#2a2a33] text-[#9898a8] hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors"
          >
            Edit profile
          </Link>
        </div>

        {/* Spaces pulse */}
        <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a33]">
            <p className="text-xs font-semibold text-[#9898a8] uppercase tracking-wider">Spaces</p>
            <Link href="/teams" className="text-xs text-[#5a5a6a] hover:text-[#c9a84c] transition-colors">
              View all
            </Link>
          </div>
          {spaces.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-[#5a5a6a] mb-2">No active spaces yet.</p>
              <Link href="/teams" className="text-xs text-[#c9a84c]">Join or create a team →</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a33]">
              {spaces.map((s) => (
                <Link
                  key={s.id}
                  href={`/teams/${s.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[#1e1e2480] transition-colors"
                >
                  <span className="text-sm text-[#e8e8ec] truncate">{s.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.hasUnread && (
                      <span className="w-2 h-2 rounded-full bg-[#c9a84c]" />
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-[#5a5a6a]" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Feedback */}
        <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#9898a8] uppercase tracking-wider mb-2">
            Platform feedback
          </p>
          {feedbackSent ? (
            <p className="text-xs text-green-600 dark:text-green-400">Thanks — got it.</p>
          ) : (
            <div className="flex gap-2">
              <input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendFeedback()}
                placeholder="Something broken or missing?"
                className="flex-1 text-xs rounded-lg border border-[#2a2a33] bg-transparent px-3 py-2 text-[#e8e8ec] placeholder-[#5a5a6a] focus:outline-none focus:border-[#c9a84c]"
              />
              <button
                onClick={sendFeedback}
                className="text-xs px-3 py-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] rounded-lg font-medium transition-colors"
              >
                Send
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right column ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Traits nudge banner */}
        {!traitsDone && (
          <Link
            href="/quiz?tab=traits"
            className="flex items-center justify-between gap-3 bg-[#c9a84c10] border border-[#c9a84c30] hover:border-[#c9a84c60] rounded-xl px-4 py-3 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">✦</span>
              <div>
                <p className="text-sm font-semibold text-[#e8e8ec]">Complete your Skill Card</p>
                <p className="text-xs text-[#9898a8]">Take the Traits Quiz to identify your 5 core strengths</p>
              </div>
            </div>
            <span className="text-xs text-[#c9a84c] font-medium group-hover:translate-x-0.5 transition-transform">Start →</span>
          </Link>
        )}

        {/* Ticker */}
        {ticker.length > 0 && (
          <div className="bg-[#0f0f11] rounded-xl overflow-hidden h-10 flex items-center">
            <div className="ticker-wrapper overflow-hidden flex-1">
              <div className="ticker-track flex gap-12 whitespace-nowrap hover:[animation-play-state:paused]"
                style={{ animation: "ticker-scroll 40s linear infinite" }}
              >
                {[...ticker, ...ticker].map((item, i) => (
                  <Link
                    key={`${item.id}-${i}`}
                    href={`/orgs/${item.org.id}`}
                    className="inline-flex items-center gap-3 text-xs text-[#9898a8] hover:text-[#e8e8ec] transition-colors flex-shrink-0"
                  >
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color: CATEGORY_COLORS[item.category] ?? "#9898a8", background: `${CATEGORY_COLORS[item.category] ?? "#9898a8"}20` }}
                    >
                      {item.category}
                    </span>
                    <span className="text-[#9898a8]">{item.org.name}</span>
                    <span className="text-white">{item.title}</span>
                    {item.deadline && (
                      <span className="text-[#5a5a6a]">· {format(new Date(item.deadline), "MMM d")}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                activeFilter === f
                  ? "bg-[#c9a84c] border-[#c9a84c] text-[#0f0f11]"
                  : "border-[#2a2a33] text-[#9898a8] hover:border-[#c9a84c] hover:text-[#c9a84c]"
              )}
            >
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Feed header */}
        <h2 className="text-sm font-semibold text-[#e8e8ec]">Opportunities for you</h2>

        {/* Feed */}
        {feedLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-xl bg-[#16161a] animate-pulse" />
            ))}
          </div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-[#9898a8] mb-2">No opportunities found.</p>
            <button onClick={() => setActiveFilter("ALL")} className="text-xs text-[#c9a84c]">Clear filter</button>
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp) => (
              <OpportunityCard
                key={opp.id}
                opp={opp}
                onSaveToggle={() => toggleSave(opp.id, opp.saved)}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  fetchFeed(next, activeFilter);
                }}
                disabled={loadingMore}
                className="w-full py-3 text-sm text-[#9898a8] hover:text-[#c9a84c] transition-colors disabled:opacity-40"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function OpportunityCard({ opp, onSaveToggle }: { opp: OpportunityCard; onSaveToggle: () => void }) {
  const accentColor = opp.org.accentColor ?? CATEGORY_COLORS[opp.category] ?? "#c9a84c";

  return (
    <div className="relative bg-[#16161a] border border-[#2a2a33] rounded-xl overflow-hidden flex">
      <div className="w-1 flex-shrink-0" style={{ background: accentColor }} />
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ color: accentColor, background: `${accentColor}20` }}
              >
                {opp.category}
              </span>
              <span className="text-xs text-[#5a5a6a]">{opp.org.name}</span>
            </div>
            <p className="font-medium text-[#e8e8ec] text-sm truncate">{opp.title}</p>
            {opp.description && (
              <p className="text-xs text-[#9898a8] mt-1 line-clamp-2 leading-relaxed">
                {opp.description}
              </p>
            )}
          </div>
          <button
            onClick={onSaveToggle}
            className={cn(
              "flex-shrink-0 p-1.5 rounded-lg transition-colors",
              opp.saved
                ? "text-[#c9a84c]"
                : "text-[#5a5a6a] hover:text-[#c9a84c]"
            )}
            title={opp.saved ? "Unsave" : "Save"}
          >
            <Save className="w-4 h-4" fill={opp.saved ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {opp.deadline && (
            <span className="text-[11px] text-[#5a5a6a]">
              Due {format(new Date(opp.deadline), "MMM d, yyyy")}
            </span>
          )}
          {opp.isRemote && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e24] text-[#9898a8]">
              Remote
            </span>
          )}
          <Link
            href={`/orgs/${opp.org.id}`}
            className="ml-auto text-[11px] text-[#c9a84c] hover:text-[#e3c06a] flex items-center gap-1 transition-colors"
          >
            View org <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
